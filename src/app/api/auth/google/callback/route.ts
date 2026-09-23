import { exchangeCodeForTokens, verifyIdToken } from '@/lib/google-oauth';
import { prisma } from '@/lib/prisma';
import { createSessionRecord, setSessionCookie, setLastAuthMethodCookie } from '@/lib/candidate-session';
import { recordAuditEvent } from '@/lib/audit';
import { sendTransactionalEmailByTemplate } from '@/lib/send-transactional-email';
import { getFirstName } from '@/lib/email-utils';
import { getClientIp, getUserAgent } from '@/lib/request-info';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code) {
            return NextResponse.redirect(new URL('/sign-in?error=no_code', request.url));
        }

        const cookieStore = await cookies();
        const storedState = cookieStore.get('google_auth_state')?.value;
        // Register vs sign-in entry point — decides how an email collision
        // with an existing password account is handled below.
        const intent = cookieStore.get('google_auth_intent')?.value === 'register' ? 'register' : 'signin';

        if (!state || state !== storedState) {
            console.warn('CSRF state mismatch');
            return NextResponse.redirect(new URL('/sign-in?error=csrf', request.url));
        }

        const tokens = await exchangeCodeForTokens(code);
        if (!tokens.id_token) {
            throw new Error('No ID token from Google');
        }

        const googleUser = await verifyIdToken(tokens.id_token);
        const email = googleUser.email?.toLowerCase();
        if (!email) throw new Error('Google account has no email');

        const ip = await getClientIp();
        const userAgent = await getUserAgent();

        cookieStore.delete('google_auth_state');
        cookieStore.delete('google_auth_intent');

        // Already-linked Google account — plain returning sign-in, regardless
        // of which page ("Continue with Google" was clicked from.
        let candidate = await prisma.candidate.findUnique({ where: { googleId: googleUser.googleId } });
        let isNewCandidate = false;

        if (!candidate) {
            const existingPasswordAccount = await prisma.candidate.findUnique({ where: { email } });

            if (existingPasswordAccount) {
                if (intent === 'register') {
                    // They tried to CREATE a new account via Google, but this
                    // email already has a password account — don't auto-link
                    // on a register intent (only sign-in intent does that,
                    // below). Send them to sign in / reset password instead.
                    return NextResponse.redirect(
                        new URL(
                            `/sign-in?error=account_exists&email=${encodeURIComponent(email)}`,
                            request.url
                        )
                    );
                }

                // Sign-in intent: prove-of-email-ownership via Google is enough
                // to link Google to the existing password account.
                candidate = await prisma.candidate.update({
                    where: { id: existingPasswordAccount.id },
                    data: { googleId: googleUser.googleId, googleEmail: email },
                });

                await recordAuditEvent(prisma, {
                    subjectType: 'candidate',
                    subjectId: candidate.id,
                    action: 'candidate.google_linked',
                    description: 'Linked Google account to existing candidate',
                    ipAddress: ip,
                });
            } else {
                // Brand-new candidate, registering via Google.
                const result = await prisma.$transaction(async (tx) => {
                    const rows = await tx.$queryRaw<{ next_applicant_number: string }[]>`SELECT next_applicant_number()`;
                    const applicantNumber = rows[0]!.next_applicant_number;

                    const created = await tx.candidate.create({
                        data: {
                            applicantNumber,
                            firstName: googleUser.firstName || email.split('@')[0] || 'Candidate',
                            lastName: googleUser.lastName || '',
                            email,
                            emailVerifiedAt: googleUser.emailVerified ? new Date() : null,
                            googleId: googleUser.googleId,
                            googleEmail: email,
                            phoneCountryCode: '+234',
                            acceptedTermsAt: new Date(),
                            marketingOptIn: false,
                        },
                    });
                    await tx.candidateProfile.create({ data: { candidateId: created.id } });

                    await recordAuditEvent(tx, {
                        subjectType: 'candidate',
                        subjectId: created.id,
                        action: 'candidate.registered',
                        description: `Registered as ${applicantNumber} via Google`,
                        ipAddress: ip,
                    });

                    return created;
                });

                candidate = result;
                isNewCandidate = true;
            }
        }

        // Session must be created before anything that can throw for
        // reasons unrelated to auth (e.g. the email provider) — a
        // candidate who was successfully created/linked above must never
        // be bounced back to /sign-in just because a downstream email
        // failed. That previously sent Google registrants to
        // /sign-in?error=auth_failed instead of straight into the
        // dashboard, even though their account existed.
        const sessionToken = await createSessionRecord(prisma, candidate.id, { userAgent, ipAddress: ip });
        await setSessionCookie(sessionToken, true);
        await setLastAuthMethodCookie('google');

        if (isNewCandidate) {
            try {
                // Same welcome email a password registrant gets.
                await sendTransactionalEmailByTemplate('account-welcome', candidate.email, {
                    firstName: getFirstName(candidate.firstName),
                    exploreProgrammesUrl: `${process.env.NEXTAUTH_URL}/programmes`,
                    currentYear: new Date().getFullYear(),
                });
            } catch (emailError) {
                console.error('Failed to send Google signup welcome email:', emailError);
            }
        }

        return NextResponse.redirect(new URL('/portal/dashboard', request.url));
    } catch (error) {
        console.error('Google callback error:', error);
        return NextResponse.redirect(new URL('/sign-in?error=auth_failed', request.url));
    }
}

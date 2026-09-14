import { exchangeCodeForTokens, verifyIdToken } from '@/lib/google-oauth';
import { prisma } from '@/lib/prisma';
import { createCandidateSession } from '@/lib/candidate-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Extract OAuth code and state from query
        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code) {
            return NextResponse.redirect(new URL('/sign-in?error=no_code', request.url));
        }

        // Verify CSRF token
        const cookieStore = await cookies();
        const storedState = cookieStore.get('google_auth_state')?.value;

        if (!state || state !== storedState) {
            console.warn('CSRF state mismatch');
            return NextResponse.redirect(new URL('/sign-in?error=csrf', request.url));
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code);
        if (!tokens.id_token) {
            throw new Error('No ID token from Google');
        }

        // Verify and extract claims from ID token
        const googleUser = await verifyIdToken(tokens.id_token);

        // Look up or create candidate
        let candidate = await prisma.candidate.findFirst({
            where: {
                OR: [
                    { googleId: googleUser.googleId },
                    { email: googleUser.email },
                ],
            },
        });

        if (candidate) {
            // EXISTING CANDIDATE
            if (!candidate.googleId) {
                // Existing password user signing in with Google → AUTO-LINK
                await prisma.candidate.update({
                    where: { id: candidate.id },
                    data: {
                        googleId: googleUser.googleId,
                        googleEmail: googleUser.email,
                    },
                });

                console.log(`Auto-linked Google to candidate ${candidate.id}`);
            }
        } else {
            // NEW CANDIDATE - CREATE via Google
            const latestApplicant = await prisma.candidate.findFirst({
                orderBy: { createdAt: 'desc' },
                select: { applicantNumber: true },
            });

            const nextNumber = latestApplicant
                ? parseInt(latestApplicant.applicantNumber.split('-')[3]) + 1
                : 1;

            const applicantNumber = `LVL-APP-${new Date().getFullYear()}-${String(nextNumber).padStart(5, '0')}`;

            candidate = await prisma.candidate.create({
                data: {
                    applicantNumber,
                    firstName: googleUser.firstName || googleUser.email?.split('@')[0] || 'User',
                    lastName: googleUser.lastName || '',
                    email: googleUser.email || '',
                    emailVerifiedAt: googleUser.emailVerified ? new Date() : null,
                    googleId: googleUser.googleId,
                    googleEmail: googleUser.email,
                    phoneCountryCode: '+234',
                    acceptedTermsAt: new Date(),
                    marketingOptIn: false,
                },
            });

            console.log(`Created new candidate ${candidate.id} via Google`);
        }

        // Create session (remember = true by default for OAuth)
        await createCandidateSession(candidate.id, true);

        // Clear CSRF state cookie
        cookieStore.delete('google_auth_state');

        // Set session cookie with actual session creation
        const session = await createCandidateSession(candidate.id, true);

        // Redirect to portal
        return NextResponse.redirect(new URL('/portal/dashboard', request.url));
    } catch (error) {
        console.error('Google callback error:', error);
        return NextResponse.redirect(new URL('/sign-in?error=auth_failed', request.url));
    }
}
import { getGoogleAuthUrl } from '@/lib/google-oauth';
import { cookies } from 'next/headers';

/**
 * Intent distinguishes "Continue with Google" clicked from /register vs
 * /sign-in — the callback needs this to decide whether an existing
 * password account with the same email should be auto-linked (sign-in
 * intent) or rejected as a duplicate (register intent).
 */
export async function POST(request: Request) {
  try {
    let intent: 'signin' | 'register' = 'signin';
    try {
      const body = await request.json();
      if (body?.intent === 'register') intent = 'register';
    } catch {
      // No/invalid JSON body — default to signin.
    }

    const { url, state } = getGoogleAuthUrl();

    const cookieStore = await cookies();
    cookieStore.set('google_auth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,  // 10 minutes
    });
    cookieStore.set('google_auth_intent', intent, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
    });

    return Response.json({ url });
  } catch (error) {
    console.error('Google authorize error:', error);
    return Response.json(
      { error: 'Failed to initiate Google sign-in' },
      { status: 500 }
    );
  }
}

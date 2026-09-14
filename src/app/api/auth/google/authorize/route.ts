import { getGoogleAuthUrl } from '@/lib/google-oauth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { url, state } = getGoogleAuthUrl();

    // Store state in httpOnly cookie for CSRF validation
    const cookieStore = await cookies();
    cookieStore.set('google_auth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,  // 10 minutes
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
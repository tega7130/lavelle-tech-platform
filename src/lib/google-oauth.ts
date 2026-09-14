import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
);

/**
 * Generate Google OAuth URL for redirect
 * Include state parameter for CSRF protection
 */
export function getGoogleAuthUrl(): { url: string; state: string } {
    const state = randomBytes(32).toString('hex');

    const url = client.generateAuthUrl({
        access_type: 'offline',  // Get refresh token
        scope: [
            'openid',
            'email',
            'profile',
        ],
        state,
        prompt: 'consent',  // Always show consent screen (prevents auto-linking to wrong account)
    });

    return { url, state };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
    const { tokens } = await client.getToken(code);
    return tokens;
}

/**
 * Verify ID token and extract claims
 */
export async function verifyIdToken(idToken: string) {
    const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error('Invalid ID token');

    return {
        googleId: payload.sub,              // Unique Google user ID
        email: payload.email,
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        emailVerified: payload.email_verified ?? false,
        picture: payload.picture,
    };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string) {
    try {
        client.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await client.refreshAccessToken();
        return credentials;
    } catch (error) {
        console.error('Failed to refresh Google token:', error);
        throw error;
    }
}
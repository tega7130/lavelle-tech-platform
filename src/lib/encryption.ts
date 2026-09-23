import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

if (!process.env.ENCRYPTION_KEY) {
    throw new Error('Missing ENCRYPTION_KEY environment variable');
}

// Convert hex string to Uint8Array
const encryptionKeyHex = process.env.ENCRYPTION_KEY;
const encryptionKey = new Uint8Array(Buffer.from(encryptionKeyHex, 'hex'));

if (encryptionKey.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits)');
}

/**
 * Encrypt sensitive data (refresh tokens)
 * Returns: nonce.encryptedData (both base64 encoded)
 */
export function encryptToken(token: string): string {
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const encrypted = nacl.secretbox(
        Buffer.from(token, 'utf-8'),
        nonce,
        encryptionKey
    );

    return encodeBase64(nonce) + '.' + encodeBase64(encrypted);
}

/**
 * Decrypt sensitive data
 * Expects: nonce.encryptedData (both base64 encoded)
 */
export function decryptToken(encryptedToken: string): string {
    try {
        const [nonceb64, encryptedb64] = encryptedToken.split('.');
        const nonce = decodeBase64(nonceb64);
        const encrypted = decodeBase64(encryptedb64);

        const decrypted = nacl.secretbox.open(encrypted, nonce, encryptionKey);
        if (!decrypted) throw new Error('Decryption failed');

        return Buffer.from(decrypted).toString('utf-8');
    } catch (error) {
        console.error('Token decryption failed:', error);
        throw new Error('Failed to decrypt token');
    }
}
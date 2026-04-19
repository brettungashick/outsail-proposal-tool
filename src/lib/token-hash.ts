import { createHash } from 'crypto';

/**
 * Hash a token using SHA-256 for secure storage.
 * The raw token is sent to the user (via email/URL), while only
 * the hash is stored in the database.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

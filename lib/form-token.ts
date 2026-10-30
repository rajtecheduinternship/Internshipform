import { createHmac, randomBytes } from 'crypto';

// Secret key for signing tokens (use env var in production)
const getSecretKey = () => {
  const key = process.env.FORM_TOKEN_SECRET || process.env.TURNSTILE_SECRET_KEY || 'default-dev-secret-change-in-production';
  return key;
};

// Use a delimiter that won't appear in IPs or other data
const DELIMITER = '|';

/** Create the same signed timestamp/nonce/IP token used by the public form. */
export function createFormToken(clientIP: string): string {
  const timestamp = Date.now();
  const nonce = randomBytes(8).toString('hex');
  const tokenData = `${timestamp}${DELIMITER}${nonce}${DELIMITER}${clientIP}`;
  const signature = createHmac('sha256', getSecretKey()).update(tokenData).digest('hex');
  return Buffer.from(`${tokenData}${DELIMITER}${signature}`).toString('base64');
}

/**
 * Verify a form token and return the elapsed time
 * Returns null if invalid, or the elapsed time in ms if valid
 */
export function verifyFormToken(token: string): { valid: boolean; elapsedMs?: number; error?: string } {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(DELIMITER);

    if (parts.length !== 4) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [timestampStr, nonce, tokenIP, providedSignature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      return { valid: false, error: 'Invalid timestamp' };
    }

    // Recreate the signature
    const tokenData = `${timestamp}${DELIMITER}${nonce}${DELIMITER}${tokenIP}`;
    const expectedSignature = createHmac('sha256', getSecretKey())
      .update(tokenData)
      .digest('hex');

    // Timing-safe comparison
    if (providedSignature.length !== expectedSignature.length) {
      return { valid: false, error: 'Invalid signature' };
    }

    let match = true;
    for (let i = 0; i < providedSignature.length; i++) {
      if (providedSignature[i] !== expectedSignature[i]) {
        match = false;
      }
    }

    if (!match) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Check if token is too old (1 hour max)
    const elapsedMs = Date.now() - timestamp;
    if (elapsedMs > 60 * 60 * 1000) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, elapsedMs };
  } catch {
    return { valid: false, error: 'Token verification failed' };
  }
}

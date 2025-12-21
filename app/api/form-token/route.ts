import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';

// Secret key for signing tokens (use env var in production)
const getSecretKey = () => {
  const key = process.env.FORM_TOKEN_SECRET || process.env.TURNSTILE_SECRET_KEY || 'default-dev-secret-change-in-production';
  return key;
};

// Use a delimiter that won't appear in IPs or other data
const DELIMITER = '|';

/**
 * Generate a signed form token that includes the timestamp
 * This prevents bots from spoofing the form load time
 */
export async function GET(request: NextRequest) {
  try {
    const clientIP = request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const timestamp = Date.now();
    const nonce = randomBytes(8).toString('hex');

    // Create token data (using | as delimiter to avoid IPv6 colon issues)
    const tokenData = `${timestamp}${DELIMITER}${nonce}${DELIMITER}${clientIP}`;

    // Sign the token
    const signature = createHmac('sha256', getSecretKey())
      .update(tokenData)
      .digest('hex');

    // Combine into final token
    const token = Buffer.from(`${tokenData}${DELIMITER}${signature}`).toString('base64');

    return NextResponse.json({
      token,
      // Don't expose timestamp to client - they don't need it
    });
  } catch (error) {
    console.error('Form token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate form token' },
      { status: 500 }
    );
  }
}

/**
 * Verify a form token and return the elapsed time
 * Returns null if invalid, or the elapsed time in ms if valid
 */
export function verifyFormToken(token: string, clientIP: string): { valid: boolean; elapsedMs?: number; error?: string } {
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

    // Optionally verify IP matches (can be disabled for users behind proxies)
    // if (tokenIP !== clientIP) {
    //   return { valid: false, error: 'IP mismatch' };
    // }

    return { valid: true, elapsedMs };
  } catch {
    return { valid: false, error: 'Token verification failed' };
  }
}

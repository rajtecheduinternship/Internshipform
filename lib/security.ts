// Security utilities for form protection

import { GENDER_OPTIONS, INTERNSHIP_TOPICS, COURSES, COLLEGES, HONOURS_SUBJECTS, SEMESTERS } from './types';

// ==================== INPUT SANITIZATION ====================

/**
 * Sanitize string input by escaping HTML entities
 */
export function sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return input
        .trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Remove potentially dangerous content from text
 */
export function cleanText(input: string, maxLength: number = 500): string {
    if (!input || typeof input !== 'string') return '';

    return input
        .trim()
        .slice(0, maxLength)
        // Remove null bytes
        .replace(/\0/g, '')
        // Remove control characters except newlines
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// ==================== SPAM DETECTION ====================

// Common spam indicators
const SPAM_PATTERNS = [
    /\b(viagra|cialis|casino|lottery|winner|prize|claim|urgent|bitcoin|crypto)\b/i,
    /\b(click here|buy now|limited offer|act now|free money)\b/i,
    /https?:\/\/[^\s]+/gi, // URLs in text fields
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
];

// Disposable email domains - expanded list
const DISPOSABLE_EMAIL_DOMAINS = [
    // Common disposable email services
    'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    '10minutemail.com', 'temp-mail.org', 'fakeinbox.com', 'trashmail.com',
    'yopmail.com', 'tempail.com', 'sharklasers.com', 'guerrillamail.info',
    'grr.la', 'spam4.me', 'getairmail.com', 'mohmal.com', 'tempmailo.com',
    // Additional domains
    'mailnesia.com', 'maildrop.cc', 'dispostable.com', 'mailcatch.com',
    'mintemail.com', 'tempr.email', 'discard.email', 'spamgourmet.com',
    'mytrashmail.com', 'mailnull.com', 'jetable.org', 'incognitomail.org',
    'emailondeck.com', 'getnada.com', 'burnermail.io', 'tempinbox.com',
    'fakemailgenerator.com', 'throwawaymail.com', 'mailsac.com', 'moakt.com',
    'tempsky.com', 'mailpoof.com', 'spambox.us', 'trash-mail.com',
    'wegwerfmail.de', 'byom.de', 'spamfree24.org', 'mail-temporaire.fr',
    'tempmailaddress.com', 'emailfake.com', 'crazymailing.com', 'tempemailco.com',
    'anonymmail.net', 'fakemail.net', 'mailtemp.net', 'inboxkitten.com',
    'gmailnator.com', 'emailnator.com', '1secmail.com', '1secmail.org',
    'guerrillamailblock.com', 'pokemail.net', 'spam.la', 'tempmails.net',
];

/**
 * Check if text contains spam patterns
 */
export function containsSpam(text: string): boolean {
    if (!text) return false;
    return SPAM_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if email is from a disposable domain
 */
export function isDisposableEmail(email: string): boolean {
    if (!email) return false;
    const domain = email.toLowerCase().split('@')[1];
    return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}

/**
 * Validate email format strictly
 */
export function isValidEmail(email: string): boolean {
    // More strict email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
}

// ==================== DROPDOWN VALIDATION ====================

/**
 * Validate that a value is in an allowed list
 */
export function isValidOption(value: string, allowedOptions: readonly string[]): boolean {
    return allowedOptions.includes(value);
}

/**
 * Validate all dropdown fields
 */
export function validateDropdowns(data: {
    gender?: string;
    internshipTopic?: string;
    course?: string;
    collegeName?: string;
    honoursSubject?: string;
    currentSemester?: string;
}): { valid: boolean; field?: string } {
    if (data.gender && !isValidOption(data.gender, GENDER_OPTIONS)) {
        return { valid: false, field: 'gender' };
    }
    if (data.internshipTopic && !isValidOption(data.internshipTopic, INTERNSHIP_TOPICS)) {
        return { valid: false, field: 'internshipTopic' };
    }
    if (data.course && !isValidOption(data.course, COURSES)) {
        return { valid: false, field: 'course' };
    }
    if (data.collegeName && !isValidOption(data.collegeName, COLLEGES)) {
        return { valid: false, field: 'collegeName' };
    }
    if (data.honoursSubject && !isValidOption(data.honoursSubject, HONOURS_SUBJECTS)) {
        return { valid: false, field: 'honoursSubject' };
    }
    if (data.currentSemester && !isValidOption(data.currentSemester, SEMESTERS)) {
        return { valid: false, field: 'currentSemester' };
    }
    return { valid: true };
}

// ==================== DATE VALIDATION ====================

/**
 * Validate date of birth is realistic (16-60 years old)
 */
export function isValidDateOfBirth(dateString: string): boolean {
    if (!dateString) return false;

    const dob = new Date(dateString);
    const now = new Date();

    if (isNaN(dob.getTime())) return false;

    const age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    // Age should be between 16 and 60
    return age >= 16 && age <= 60;
}

// ==================== FILE VALIDATION ====================

/**
 * Validate base64 image size (in bytes)
 */
export function getBase64Size(base64: string): number {
    if (!base64) return 0;

    // Remove data URL prefix if present
    const base64Data = base64.split(',')[1] || base64;

    // Calculate decoded size
    const padding = (base64Data.match(/=+$/) || [''])[0].length;
    return Math.floor((base64Data.length * 3) / 4) - padding;
}

/**
 * Validate photo file (max 250KB)
 */
export function isValidPhoto(base64: string | undefined): boolean {
    if (!base64) return true; // Photo is optional
    const size = getBase64Size(base64);
    return size <= 250 * 1024; // 250KB
}

/**
 * Validate signature file (max 150KB)
 */
export function isValidSignature(base64: string | undefined): boolean {
    if (!base64) return true; // Signature is optional
    const size = getBase64Size(base64);
    return size <= 150 * 1024; // 150KB
}

// ==================== TIMING-BASED BOT DETECTION ====================

// Track form load times
const formLoadTimes = new Map<string, number>();

/**
 * Record when a form was "loaded" (for bot detection)
 */
export function recordFormLoadTime(identifier: string): void {
    formLoadTimes.set(identifier, Date.now());
}

/**
 * Check if form was submitted too quickly (bot behavior)
 * Returns false if submission time is suspiciously fast (< 10 seconds)
 */
export function isHumanTimingWithValue(loadTime: number | undefined): boolean {
    if (!loadTime) return true; // Allow if no timing data

    const submissionTime = Date.now() - loadTime;

    // If form was filled in less than 10 seconds, likely a bot
    return submissionTime >= 10000;
}

// ==================== CAPTCHA VERIFICATION (Cloudflare Turnstile) ====================

/**
 * Verify Cloudflare Turnstile token
 */
export async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
        console.warn('TURNSTILE_SECRET_KEY not configured, skipping CAPTCHA verification');
        return true; // Allow if not configured
    }

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                secret: secretKey,
                response: token,
                remoteip: ip,
            }),
        });

        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return false;
    }
}

// ==================== SUSPICIOUS ACTIVITY TRACKING ====================

// Track failed validation attempts per IP
const suspiciousActivity = new Map<string, { count: number; firstAttempt: number }>();
const SUSPICIOUS_THRESHOLD = 10; // Number of failed attempts before temporary ban
const SUSPICIOUS_WINDOW = 60 * 60 * 1000; // 1 hour window

/**
 * Record a suspicious activity (failed validation)
 */
export function recordSuspiciousActivity(ip: string): void {
    const now = Date.now();
    const record = suspiciousActivity.get(ip);

    if (!record || now - record.firstAttempt > SUSPICIOUS_WINDOW) {
        suspiciousActivity.set(ip, { count: 1, firstAttempt: now });
    } else {
        record.count++;
        suspiciousActivity.set(ip, record);
    }
}

/**
 * Check if IP should be temporarily banned due to suspicious activity
 */
export function isSuspiciousIP(ip: string): boolean {
    const record = suspiciousActivity.get(ip);
    if (!record) return false;

    const now = Date.now();

    // Reset if window has passed
    if (now - record.firstAttempt > SUSPICIOUS_WINDOW) {
        suspiciousActivity.delete(ip);
        return false;
    }

    return record.count >= SUSPICIOUS_THRESHOLD;
}

/**
 * Cleanup old suspicious activity records
 */
export function cleanupSuspiciousActivity(): void {
    const now = Date.now();
    for (const [ip, record] of suspiciousActivity.entries()) {
        if (now - record.firstAttempt > SUSPICIOUS_WINDOW) {
            suspiciousActivity.delete(ip);
        }
    }
}

// ==================== REQUEST SIZE VALIDATION ====================

/**
 * Check if request body size is within limits
 * Max: 500KB (250KB photo + 150KB signature + ~100KB for other fields)
 */
export const MAX_REQUEST_SIZE = 500 * 1024; // 500KB

export function isRequestSizeValid(contentLength: string | null): boolean {
    if (!contentLength) return true; // Let other validation handle it

    const size = parseInt(contentLength, 10);
    return !isNaN(size) && size <= MAX_REQUEST_SIZE;
}

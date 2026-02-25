import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { InternshipFormData } from '@/lib/types';
import { uploadImagesToStorage } from '@/lib/storage';
import {
  cleanText,
  containsSpam,
  isDisposableEmail,
  isValidEmail,
  validateDropdowns,
  isValidDateOfBirth,
  isValidPhoto,
  isValidSignature,
  verifyTurnstileToken,
  isSuspiciousIP,
  recordSuspiciousActivity,
  cleanupSuspiciousActivity,
  isRequestSizeValid,
  MAX_REQUEST_SIZE,
} from '@/lib/security';
import { verifyFormToken } from '@/app/api/form-token/route';
import QRCode from 'qrcode';

// Configuration: Use database for rate limiting in production
const USE_DB_RATE_LIMITING = process.env.USE_DB_RATE_LIMITING === 'true';

// In-memory rate limiting store (fallback when DB is not configured)
const rateLimitStore = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_SUBMISSIONS_PER_WINDOW = process.env.NODE_ENV === 'development' ? 50 : 5; // Higher limit for dev

// Duplicate submission tracking (by email) - in-memory fallback
const recentEmails = new Map<string, number>();
const EMAIL_COOLDOWN = 30 * 60 * 1000; // 30 minutes cooldown for same email

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');

  // Cloudflare provides the real IP
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

function checkRateLimitInMemory(ip: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record) {
    rateLimitStore.set(ip, { count: 1, timestamp: now });
    return { allowed: true };
  }

  // Reset if window has passed
  if (now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { count: 1, timestamp: now });
    return { allowed: true };
  }

  // Check if limit exceeded
  if (record.count >= MAX_SUBMISSIONS_PER_WINDOW) {
    const waitTime = Math.ceil((RATE_LIMIT_WINDOW - (now - record.timestamp)) / 60000);
    return {
      allowed: false,
      message: `Too many submissions. Please try again in ${waitTime} minutes.`
    };
  }

  // Increment counter
  record.count++;
  rateLimitStore.set(ip, record);
  return { allowed: true };
}

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; message?: string }> {
  if (USE_DB_RATE_LIMITING) {
    const result = await db.checkRateLimit(ip, 'submission', MAX_SUBMISSIONS_PER_WINDOW, RATE_LIMIT_WINDOW);
    if (!result.allowed) {
      const waitTime = Math.ceil((result.resetAt.getTime() - Date.now()) / 60000);
      return {
        allowed: false,
        message: `Too many submissions. Please try again in ${waitTime} minutes.`
      };
    }
    return { allowed: true };
  }
  return checkRateLimitInMemory(ip);
}

function checkEmailCooldownInMemory(email: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const lastSubmission = recentEmails.get(email.toLowerCase());

  if (lastSubmission && now - lastSubmission < EMAIL_COOLDOWN) {
    const waitTime = Math.ceil((EMAIL_COOLDOWN - (now - lastSubmission)) / 60000);
    return {
      allowed: false,
      message: `This email was recently used. Please try again in ${waitTime} minutes or use a different email.`
    };
  }

  recentEmails.set(email.toLowerCase(), now);
  return { allowed: true };
}

async function checkEmailCooldown(email: string): Promise<{ allowed: boolean; message?: string }> {
  if (USE_DB_RATE_LIMITING) {
    const result = await db.checkEmailCooldown(email, EMAIL_COOLDOWN);
    if (!result.allowed) {
      const waitTime = Math.ceil(result.waitTimeMs / 60000);
      return {
        allowed: false,
        message: `This email was recently used. Please try again in ${waitTime} minutes or use a different email.`
      };
    }
    return { allowed: true };
  }
  return checkEmailCooldownInMemory(email);
}

function validateFormData(data: InternshipFormData): { valid: boolean; error?: string } {
  // Required fields validation
  const requiredFields = [
    { field: 'studentName', label: 'Student Name', maxLength: 100 },
    { field: 'fatherName', label: "Father's Name", maxLength: 100 },
    { field: 'motherName', label: "Mother's Name", maxLength: 100 },
    { field: 'gender', label: 'Gender', maxLength: 20 },
    { field: 'dateOfBirth', label: 'Date of Birth', maxLength: 20 },
    { field: 'address', label: 'Address', maxLength: 500 },
    { field: 'internshipTopic', label: 'Internship Topic', maxLength: 100 },
    { field: 'course', label: 'Course', maxLength: 50 },
    { field: 'collegeName', label: 'College Name', maxLength: 200 },
    { field: 'honoursSubject', label: 'Honours Subject', maxLength: 100 },
    { field: 'currentSemester', label: 'Current Semester', maxLength: 50 },
    { field: 'classRollNo', label: 'Class Roll No', maxLength: 50 },
    { field: 'universityRollNumber', label: 'University Roll Number', maxLength: 50 },
    { field: 'universityRegistrationNumber', label: 'University Registration Number', maxLength: 50 },
    { field: 'contactNumber', label: 'Contact Number', maxLength: 15 },
    { field: 'emailAddress', label: 'Email Address', maxLength: 254 },
  ];

  if (data.course === 'Other') {
    requiredFields.push({ field: 'otherCourse', label: 'Course (Other)', maxLength: 50 });
  }

  if (data.collegeName === 'Other') {
    requiredFields.push({ field: 'otherCollegeName', label: 'College Name (Other)', maxLength: 200 });
  }

  if (data.honoursSubject === 'Other') {
    requiredFields.push({ field: 'otherHonoursSubject', label: 'Honours Subject (Other)', maxLength: 100 });
  }

  for (const { field, label, maxLength } of requiredFields) {
    const value = data[field as keyof InternshipFormData];
    if (!value) {
      return { valid: false, error: `${label} is required` };
    }
    // Check max length
    if (typeof value === 'string' && value.length > maxLength) {
      return { valid: false, error: `${label} is too long` };
    }
  }

  // Validate dropdown values against allowed options
  const dropdownValidation = validateDropdowns({
    gender: data.gender,
    internshipTopic: data.internshipTopic,
    course: data.course,
    collegeName: data.collegeName,
    honoursSubject: data.honoursSubject,
    currentSemester: data.currentSemester,
  });
  if (!dropdownValidation.valid) {
    return { valid: false, error: `Invalid ${dropdownValidation.field} selection` };
  }

  // Email validation (strict)
  if (!isValidEmail(data.emailAddress)) {
    return { valid: false, error: 'Invalid email address format' };
  }

  // Check for disposable email
  if (isDisposableEmail(data.emailAddress)) {
    return { valid: false, error: 'Please use a permanent email address, not a disposable one' };
  }

  // Phone validation (10 digits)
  if (!/^\d{10}$/.test(data.contactNumber)) {
    return { valid: false, error: 'Contact number must be 10 digits' };
  }

  // Validate date of birth
  if (!isValidDateOfBirth(data.dateOfBirth)) {
    return { valid: false, error: 'Invalid date of birth. Age must be between 16 and 60 years.' };
  }

  // Declaration check
  if (!data.declarationAccepted) {
    return { valid: false, error: 'Please accept the declaration' };
  }

  // Check for spam content in text fields
  const textFields = [data.studentName, data.fatherName, data.motherName, data.address];
  for (const text of textFields) {
    if (containsSpam(text)) {
      return { valid: false, error: 'Invalid content detected in form fields' };
    }
  }

  // Validate file sizes
  if (!isValidPhoto(data.photo)) {
    return { valid: false, error: 'Photo must be less than 250KB' };
  }
  if (!isValidSignature(data.signature)) {
    return { valid: false, error: 'Signature must be less than 150KB' };
  }

  return { valid: true };
}

// Clean up old entries periodically (every request, check and clean)
function cleanupOldEntries() {
  const now = Date.now();

  // Clean rate limit store
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now - record.timestamp > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(ip);
    }
  }

  // Clean email cooldown store
  for (const [email, timestamp] of recentEmails.entries()) {
    if (now - timestamp > EMAIL_COOLDOWN) {
      recentEmails.delete(email);
    }
  }

  // Clean suspicious activity records
  cleanupSuspiciousActivity();
}

export async function POST(request: NextRequest) {
  try {
    // Cleanup old entries
    cleanupOldEntries();

    // Get client IP
    const clientIP = getClientIP(request);

    // Check if IP is temporarily banned due to suspicious activity
    if (isSuspiciousIP(clientIP)) {
      return NextResponse.json(
        { error: 'Your IP has been temporarily blocked due to suspicious activity. Please try again later.' },
        { status: 403 }
      );
    }

    // Check request size
    const contentLength = request.headers.get('content-length');
    if (!isRequestSizeValid(contentLength)) {
      recordSuspiciousActivity(clientIP);
      return NextResponse.json(
        { error: `Request too large. Maximum size is ${MAX_REQUEST_SIZE / 1024}KB.` },
        { status: 413 }
      );
    }

    // Check rate limit (uses DB in production if configured)
    const rateLimitResult = await checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: rateLimitResult.message },
        { status: 429 }
      );
    }

    // Parse request body
    let data: InternshipFormData & { turnstileToken?: string; formToken?: string };
    try {
      data = await request.json();
    } catch {
      recordSuspiciousActivity(clientIP);
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // Verify Turnstile CAPTCHA (REQUIRED when configured)
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!data.turnstileToken) {
        recordSuspiciousActivity(clientIP);
        return NextResponse.json(
          { error: 'CAPTCHA verification required. Please complete the CAPTCHA.' },
          { status: 400 }
        );
      }
      const isValidCaptcha = await verifyTurnstileToken(data.turnstileToken, clientIP);
      if (!isValidCaptcha) {
        recordSuspiciousActivity(clientIP);
        return NextResponse.json(
          { error: 'CAPTCHA verification failed. Please try again.' },
          { status: 400 }
        );
      }
    }

    // Verify server-side form token (prevents timing spoofing)
    if (data.formToken) {
      const tokenResult = verifyFormToken(data.formToken, clientIP);
      if (!tokenResult.valid) {
        recordSuspiciousActivity(clientIP);
        return NextResponse.json(
          {
            error: tokenResult.error === 'Token expired'
              ? 'Form session expired. Please refresh the page and try again.'
              : 'Invalid form session. Please refresh the page.'
          },
          { status: 400 }
        );
      }
      // Check if form was filled too quickly (less than 10 seconds)
      if (tokenResult.elapsedMs && tokenResult.elapsedMs < 10000) {
        recordSuspiciousActivity(clientIP);
        return NextResponse.json(
          { error: 'Form submitted too quickly. Please take your time to fill the form correctly.' },
          { status: 400 }
        );
      }
    }

    // Check email cooldown (uses DB in production if configured)
    const emailResult = await checkEmailCooldown(data.emailAddress);
    if (!emailResult.allowed) {
      return NextResponse.json(
        { error: emailResult.message },
        { status: 429 }
      );
    }

    // Validate form data (includes spam detection, file size checks, etc.)
    const validationResult = validateFormData(data);
    if (!validationResult.valid) {
      recordSuspiciousActivity(clientIP);
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    // Check for duplicate email in database
    const existingSubmission = await db.findByEmail(data.emailAddress);

    if (existingSubmission) {
      return NextResponse.json(
        { error: 'An application with this email already exists. Please use a different email.' },
        { status: 409 }
      );
    }

    // Check for duplicate university roll number
    const existingRollNumber = await db.findByRollNumber(data.universityRollNumber);

    if (existingRollNumber) {
      return NextResponse.json(
        { error: 'An application with this university roll number already exists.' },
        { status: 409 }
      );
    }

    // Upload images to Supabase Storage (if present)
    // This stores images in the 'internship-files' bucket and returns public URLs
    let photoUrl: string | undefined;
    let signatureUrl: string | undefined;

    if (data.photo || data.signature) {
      const { photoUrl: pUrl, signatureUrl: sUrl } = await uploadImagesToStorage(
        data.photo || undefined,
        data.signature || undefined,
        data.universityRollNumber
      );
      photoUrl = pUrl;
      signatureUrl = sUrl;
    }

    // Sanitize text inputs before storing
    const { error: insertError, id: formId } = await db.insertApplication({
      student_name: cleanText(data.studentName, 100),
      father_name: cleanText(data.fatherName, 100),
      mother_name: cleanText(data.motherName, 100),
      gender: data.gender,
      date_of_birth: data.dateOfBirth,
      address: cleanText(data.address, 500),
      internship_topic: data.internshipTopic,
      course: data.course === 'Other' && data.otherCourse ? cleanText(data.otherCourse, 50) : data.course,
      college_name: data.collegeName === 'Other' && data.otherCollegeName ? cleanText(data.otherCollegeName, 200) : data.collegeName,
      honours_subject: data.honoursSubject === 'Other' && data.otherHonoursSubject ? cleanText(data.otherHonoursSubject, 100) : data.honoursSubject,
      current_semester: data.currentSemester,
      class_roll_no: cleanText(data.classRollNo, 50),
      university_name: data.universityName,
      university_roll_number: cleanText(data.universityRollNumber, 50),
      university_registration_number: cleanText(data.universityRegistrationNumber, 50),
      contact_number: data.contactNumber,
      whatsapp_number: data.whatsappNumber || undefined,
      email_address: data.emailAddress.toLowerCase().trim(),
      photo: photoUrl || undefined, // Store URL instead of base64
      signature: signatureUrl || undefined, // Store URL instead of base64
      ip_address: clientIP,
      created_at: new Date().toISOString(),
    });

    if (insertError || !formId) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit application. Please try again.' },
        { status: 500 }
      );
    }

    // Generate QR code for the form view URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (request.headers.get('host') ? `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}` : 'http://localhost:3000');
    const formViewUrl = `${baseUrl}/form/view/${formId}`;
    
    let qrCodeDataUrl: string | undefined;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(formViewUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (qrError) {
      console.error('QR code generation error:', qrError);
      // Continue without QR code if generation fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Application submitted successfully!',
        formId,
        formViewUrl,
        qrCode: qrCodeDataUrl
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error. Please try again later.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { InternshipFormData } from '@/lib/types';

// In-memory rate limiting store (reset on server restart)
// In production, use Redis for persistence across instances
const rateLimitStore = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_SUBMISSIONS_PER_WINDOW = 5; // Max 5 submissions per IP per hour

// Duplicate submission tracking (by email)
const recentEmails = new Map<string, number>();
const EMAIL_COOLDOWN = 30 * 60 * 1000; // 30 minutes cooldown for same email

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; message?: string } {
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

function checkEmailCooldown(email: string): { allowed: boolean; message?: string } {
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

function validateFormData(data: InternshipFormData): { valid: boolean; error?: string } {
  // Required fields validation
  const requiredFields = [
    { field: 'studentName', label: 'Student Name' },
    { field: 'fatherName', label: "Father's Name" },
    { field: 'motherName', label: "Mother's Name" },
    { field: 'gender', label: 'Gender' },
    { field: 'dateOfBirth', label: 'Date of Birth' },
    { field: 'address', label: 'Address' },
    { field: 'internshipTopic', label: 'Internship Topic' },
    { field: 'collegeName', label: 'College Name' },
    { field: 'honoursSubject', label: 'Honours Subject' },
    { field: 'currentSemester', label: 'Current Semester' },
    { field: 'classRollNo', label: 'Class Roll No' },
    { field: 'universityRollNumber', label: 'University Roll Number' },
    { field: 'universityRegistrationNumber', label: 'University Registration Number' },
    { field: 'contactNumber', label: 'Contact Number' },
    { field: 'emailAddress', label: 'Email Address' },
  ];

  for (const { field, label } of requiredFields) {
    if (!data[field as keyof InternshipFormData]) {
      return { valid: false, error: `${label} is required` };
    }
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.emailAddress)) {
    return { valid: false, error: 'Invalid email address' };
  }

  // Phone validation (10 digits)
  if (!/^\d{10}$/.test(data.contactNumber)) {
    return { valid: false, error: 'Contact number must be 10 digits' };
  }

  // Declaration check
  if (!data.declarationAccepted) {
    return { valid: false, error: 'Please accept the declaration' };
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
}

export async function POST(request: NextRequest) {
  try {
    // Cleanup old entries
    cleanupOldEntries();

    // Get client IP
    const clientIP = getClientIP(request);

    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: rateLimitResult.message },
        { status: 429 }
      );
    }

    // Parse request body
    const data: InternshipFormData = await request.json();

    // Check email cooldown
    const emailResult = checkEmailCooldown(data.emailAddress);
    if (!emailResult.allowed) {
      return NextResponse.json(
        { error: emailResult.message },
        { status: 429 }
      );
    }

    // Validate form data
    const validationResult = validateFormData(data);
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createServerClient();

    // Check for duplicate email in database
    const { data: existingSubmission } = await supabase
      .from('internship_applications')
      .select('id')
      .eq('email_address', data.emailAddress.toLowerCase())
      .single();

    if (existingSubmission) {
      return NextResponse.json(
        { error: 'An application with this email already exists. Please use a different email.' },
        { status: 409 }
      );
    }

    // Check for duplicate university roll number
    const { data: existingRollNumber } = await supabase
      .from('internship_applications')
      .select('id')
      .eq('university_roll_number', data.universityRollNumber)
      .single();

    if (existingRollNumber) {
      return NextResponse.json(
        { error: 'An application with this university roll number already exists.' },
        { status: 409 }
      );
    }

    // Insert into database
    const { error: insertError } = await supabase
      .from('internship_applications')
      .insert({
        student_name: data.studentName.trim(),
        father_name: data.fatherName.trim(),
        mother_name: data.motherName.trim(),
        gender: data.gender,
        date_of_birth: data.dateOfBirth,
        address: data.address.trim(),
        internship_topic: data.internshipTopic,
        college_name: data.collegeName,
        honours_subject: data.honoursSubject,
        current_semester: data.currentSemester,
        class_roll_no: data.classRollNo.trim(),
        university_name: data.universityName,
        university_roll_number: data.universityRollNumber.trim(),
        university_registration_number: data.universityRegistrationNumber.trim(),
        contact_number: data.contactNumber,
        whatsapp_number: data.whatsappNumber || null,
        email_address: data.emailAddress.toLowerCase().trim(),
        photo: data.photo || null,
        signature: data.signature || null,
        ip_address: clientIP,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit application. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Application submitted successfully!' },
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

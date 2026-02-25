import { createServerClient } from './supabase';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

const BUCKET_NAME = 'internship_files';

// ── MinIO / S3 helpers (local dev) ────────────────────────────────────────────

function getS3Client(): S3Client | null {
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKeyId = process.env.MINIO_ACCESS_KEY;
  const secretAccessKey = process.env.MINIO_SECRET_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // required for MinIO
  });
}

async function ensureS3Bucket(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    // Bucket doesn't exist — create it and make it public-read
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        }],
      }),
    }));
  }
}

async function uploadToS3(buffer: Buffer, objectKey: string, contentType: string): Promise<string | null> {
  const client = getS3Client();
  if (!client) return null;
  const bucket = process.env.MINIO_BUCKET || BUCKET_NAME;
  try {
    await ensureS3Bucket(client, bucket);
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    }));
    // Public URL: <endpoint>/<bucket>/<key>
    return `${process.env.MINIO_ENDPOINT}/${bucket}/${objectKey}`;
  } catch (err) {
    console.error('MinIO upload error:', err);
    return null;
  }
}

/**
 * Converts a base64 data URL to a Blob
 */
function base64ToBlob(base64DataUrl: string): { blob: Blob; extension: string } {
    const match = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
        throw new Error('Invalid base64 data URL');
    }

    const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const base64Data = match[2];

    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const mimeType = `image/${match[1]}`;
    const blob = new Blob([bytes], { type: mimeType });

    return { blob, extension };
}

/**
 * Generates a unique filename for storage
 */
function generateFilename(universityRollNumber: string, type: 'photo' | 'signature'): string {
    const timestamp = Date.now();
    const safeRollNumber = universityRollNumber.replace(/[^a-zA-Z0-9]/g, '_');
    return `${type}/${safeRollNumber}_${timestamp}`;
}

/**
 * Uploads an image to Supabase Storage and returns the public URL
 * @param base64DataUrl - The base64 encoded image data URL
 * @param universityRollNumber - Used to create a unique filename
 * @param type - Either 'photo' or 'signature'
 * @returns The public URL of the uploaded image, or null if upload fails
 */
export async function uploadImageToStorage(
    base64DataUrl: string,
    universityRollNumber: string,
    type: 'photo' | 'signature'
): Promise<string | null> {
    try {
        const supabase = createServerClient();
        
        // If Supabase is not configured, return null
        if (!supabase) {
            return null;
        }

        // Convert base64 to blob
        const { blob, extension } = base64ToBlob(base64DataUrl);

        // Generate unique filename
        const filename = `${generateFilename(universityRollNumber, type)}.${extension}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filename, blob, {
                contentType: blob.type,
                upsert: false, // Don't overwrite if exists
            });

        if (error) {
            console.error(`Failed to upload ${type}:`, error);
            return null;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    } catch (error) {
        console.error(`Error uploading ${type} to storage:`, error);
        return null;
    }
}

/**
 * Uploads both photo and signature to storage
 * Returns URLs for both, falling back to original base64 if upload fails
 */
export async function uploadImagesToStorage(
    photo: string | undefined,
    signature: string | undefined,
    universityRollNumber: string
): Promise<{ photoUrl: string | undefined; signatureUrl: string | undefined }> {
    // Check if Supabase is configured
    const supabase = createServerClient();
    
    // If Supabase is not configured, return the base64 data as-is
    if (!supabase) {
        console.log('Supabase not configured, storing images as base64 in database');
        return {
            photoUrl: photo,
            signatureUrl: signature
        };
    }

    let photoUrl: string | undefined;
    let signatureUrl: string | undefined;

    if (photo) {
        const url = await uploadImageToStorage(photo, universityRollNumber, 'photo');
        photoUrl = url || photo; // Fallback to base64 if upload fails
    }

    if (signature) {
        const url = await uploadImageToStorage(signature, universityRollNumber, 'signature');
        signatureUrl = url || signature; // Fallback to base64 if upload fails
    }

    return { photoUrl, signatureUrl };
}

/**
 * Checks if a string is a URL (as opposed to base64)
 */
export function isUrl(str: string | null | undefined): boolean {
    if (!str) return false;
    return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Uploads a certificate PDF — uses MinIO locally (USE_LOCAL_DB=true), Supabase in prod.
 */
export async function uploadCertificatePDF(pdfBuffer: Buffer, certId: string): Promise<string | null> {
    const objectKey = `certificates/${certId}.pdf`;

    if (process.env.USE_LOCAL_DB === 'true') {
        return uploadToS3(pdfBuffer, objectKey, 'application/pdf');
    }

    // Prod path: Supabase Storage
    try {
        const supabase = createServerClient();
        if (!supabase) return null;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(objectKey, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true,
            });

        if (error) {
            console.error('Failed to upload certificate PDF:', error);
            return null;
        }

        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    } catch (error) {
        console.error('Error uploading certificate PDF:', error);
        return null;
    }
}

/**
 * Fetches an image from URL and converts it to base64 data URL
 * This is needed for PDF generation when images are stored as URLs
 */
export async function urlToBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch image from ${url}: ${response.status}`);
            return null;
        }

        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = blob.type || 'image/jpeg';

        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error(`Error converting URL to base64:`, error);
        return null;
    }
}

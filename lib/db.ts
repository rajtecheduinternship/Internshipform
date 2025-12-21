import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

// Environment flag to switch between local PostgreSQL and Supabase
const USE_LOCAL_DB = process.env.USE_LOCAL_DB === 'true';

// PostgreSQL connection pool (only created if using local DB)
let pgPool: Pool | null = null;

function getPgPool(): Pool {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pgPool = new Pool({ connectionString });
  }
  return pgPool;
}

// Supabase client (only created if not using local DB)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Database interface for internship applications
export interface ApplicationRecord {
  id?: string;
  student_name: string;
  father_name: string;
  mother_name: string;
  gender: string;
  date_of_birth: string;
  address: string;
  internship_topic: string;
  course: string;
  college_name: string;
  honours_subject: string;
  current_semester: string;
  class_roll_no: string;
  university_name?: string;
  university_roll_number: string;
  university_registration_number: string;
  contact_number: string;
  whatsapp_number?: string;
  email_address: string;
  photo?: string;
  signature?: string;
  ip_address?: string;
  created_at?: string;
}

// Database operations
export const db = {
  async findByEmail(email: string): Promise<{ id: string } | null> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      const result = await pool.query(
        'SELECT id FROM internship_applications WHERE email_address = $1',
        [email.toLowerCase()]
      );
      return result.rows[0] || null;
    } else {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('internship_applications')
        .select('id')
        .eq('email_address', email.toLowerCase())
        .single();
      return data;
    }
  },

  async findByRollNumber(rollNumber: string): Promise<{ id: string } | null> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      const result = await pool.query(
        'SELECT id FROM internship_applications WHERE university_roll_number = $1',
        [rollNumber]
      );
      return result.rows[0] || null;
    } else {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('internship_applications')
        .select('id')
        .eq('university_roll_number', rollNumber)
        .single();
      return data;
    }
  },

  async insertApplication(data: ApplicationRecord): Promise<{ error: Error | null }> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        await pool.query(
          `INSERT INTO internship_applications (
            student_name, father_name, mother_name, gender, date_of_birth,
            address, internship_topic, college_name, honours_subject,
            current_semester, class_roll_no, university_name,
            university_roll_number, university_registration_number,
            contact_number, whatsapp_number, email_address, photo,
            signature, ip_address, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
          [
            data.student_name,
            data.father_name,
            data.mother_name,
            data.gender,
            data.date_of_birth,
            data.address,
            data.internship_topic,
            data.college_name,
            data.honours_subject,
            data.current_semester,
            data.class_roll_no,
            data.university_name || null,
            data.university_roll_number,
            data.university_registration_number,
            data.contact_number,
            data.whatsapp_number || null,
            data.email_address,
            data.photo || null,
            data.signature || null,
            data.ip_address || null,
            data.created_at || new Date().toISOString(),
          ]
        );
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    } else {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('internship_applications').insert(data);
      return { error: error ? new Error(error.message) : null };
    }
  },

  async getAllApplications(): Promise<{ data: ApplicationRecord[] | null; error: Error | null }> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        const result = await pool.query(
          'SELECT * FROM internship_applications ORDER BY created_at DESC'
        );
        return { data: result.rows, error: null };
      } catch (err) {
        return { data: null, error: err as Error };
      }
    } else {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('internship_applications')
        .select('*')
        .order('created_at', { ascending: false });
      return { data, error: error ? new Error(error.message) : null };
    }
  },

  // ==================== RATE LIMITING ====================

  /**
   * Check and update rate limit for an IP address
   * Returns { allowed: boolean, remaining: number, resetAt: Date }
   */
  async checkRateLimit(
    ip: string,
    limitType: 'submission' | 'admin' = 'submission',
    maxAttempts: number = 5,
    windowMs: number = 60 * 60 * 1000 // 1 hour default
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date; error?: Error }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        // Clean up old entries and get current count in a transaction
        await pool.query('BEGIN');

        // Delete old entries
        await pool.query(
          'DELETE FROM rate_limits WHERE created_at < $1',
          [windowStart.toISOString()]
        );

        // Get current count
        const countResult = await pool.query(
          'SELECT COUNT(*) as count, MAX(created_at) as last_attempt FROM rate_limits WHERE ip_address = $1 AND limit_type = $2 AND created_at >= $3',
          [ip, limitType, windowStart.toISOString()]
        );

        const currentCount = parseInt(countResult.rows[0]?.count || '0', 10);
        const remaining = Math.max(0, maxAttempts - currentCount - 1);
        const resetAt = new Date(now.getTime() + windowMs);

        if (currentCount >= maxAttempts) {
          await pool.query('COMMIT');
          return { allowed: false, remaining: 0, resetAt };
        }

        // Record this attempt
        await pool.query(
          'INSERT INTO rate_limits (ip_address, limit_type, created_at) VALUES ($1, $2, $3)',
          [ip, limitType, now.toISOString()]
        );

        await pool.query('COMMIT');
        return { allowed: true, remaining, resetAt };
      } catch (err) {
        await pool.query('ROLLBACK');
        // Fallback to allowing the request if DB fails
        console.error('Rate limit check failed:', err);
        return { allowed: true, remaining: maxAttempts, resetAt: new Date(now.getTime() + windowMs), error: err as Error };
      }
    } else {
      const supabase = getSupabaseClient();
      try {
        // Delete old entries
        await supabase
          .from('rate_limits')
          .delete()
          .lt('created_at', windowStart.toISOString());

        // Get current count
        const { count, error: countError } = await supabase
          .from('rate_limits')
          .select('*', { count: 'exact', head: true })
          .eq('ip_address', ip)
          .eq('limit_type', limitType)
          .gte('created_at', windowStart.toISOString());

        if (countError) {
          console.error('Rate limit count error:', countError);
          return { allowed: true, remaining: maxAttempts, resetAt: new Date(now.getTime() + windowMs), error: new Error(countError.message) };
        }

        const currentCount = count || 0;
        const remaining = Math.max(0, maxAttempts - currentCount - 1);
        const resetAt = new Date(now.getTime() + windowMs);

        if (currentCount >= maxAttempts) {
          return { allowed: false, remaining: 0, resetAt };
        }

        // Record this attempt
        const { error: insertError } = await supabase
          .from('rate_limits')
          .insert({ ip_address: ip, limit_type: limitType, created_at: now.toISOString() });

        if (insertError) {
          console.error('Rate limit insert error:', insertError);
        }

        return { allowed: true, remaining, resetAt };
      } catch (err) {
        console.error('Rate limit check failed:', err);
        return { allowed: true, remaining: maxAttempts, resetAt: new Date(now.getTime() + windowMs), error: err as Error };
      }
    }
  },

  /**
   * Record email cooldown
   */
  async checkEmailCooldown(
    email: string,
    cooldownMs: number = 30 * 60 * 1000 // 30 minutes default
  ): Promise<{ allowed: boolean; waitTimeMs: number }> {
    const now = new Date();
    const cooldownStart = new Date(now.getTime() - cooldownMs);

    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        const result = await pool.query(
          'SELECT created_at FROM email_cooldowns WHERE email = $1 AND created_at >= $2 ORDER BY created_at DESC LIMIT 1',
          [email.toLowerCase(), cooldownStart.toISOString()]
        );

        if (result.rows.length > 0) {
          const lastAttempt = new Date(result.rows[0].created_at);
          const waitTimeMs = cooldownMs - (now.getTime() - lastAttempt.getTime());
          return { allowed: false, waitTimeMs };
        }

        // Record this email attempt
        await pool.query(
          'INSERT INTO email_cooldowns (email, created_at) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET created_at = $2',
          [email.toLowerCase(), now.toISOString()]
        );

        return { allowed: true, waitTimeMs: 0 };
      } catch (err) {
        console.error('Email cooldown check failed:', err);
        return { allowed: true, waitTimeMs: 0 };
      }
    } else {
      const supabase = getSupabaseClient();
      try {
        const { data } = await supabase
          .from('email_cooldowns')
          .select('created_at')
          .eq('email', email.toLowerCase())
          .gte('created_at', cooldownStart.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          const lastAttempt = new Date(data.created_at);
          const waitTimeMs = cooldownMs - (now.getTime() - lastAttempt.getTime());
          return { allowed: false, waitTimeMs };
        }

        // Record this email attempt
        await supabase
          .from('email_cooldowns')
          .upsert({ email: email.toLowerCase(), created_at: now.toISOString() });

        return { allowed: true, waitTimeMs: 0 };
      } catch (err) {
        console.error('Email cooldown check failed:', err);
        return { allowed: true, waitTimeMs: 0 };
      }
    }
  },
};

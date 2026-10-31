import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

// Environment flag to switch between local PostgreSQL and Supabase
const USE_LOCAL_DB = process.env.USE_LOCAL_DB === 'true';

// PostgreSQL connection pool (only created if using local DB)
let pgPool: Pool | null = null;

export function getPgPool(): Pool {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pgPool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX) || 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pgPool;
}

// Supabase client (only created if not using local DB)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export interface ApplicationReview { application_id: string; approval_status: ApprovalStatus; profile_id: string | null; changed: boolean }

// Database interface for internship applications
export interface ApplicationRecord {
  id?: string;
  approval_status?: ApprovalStatus;
  reviewed_at?: string | null;
  review_note?: string | null;
  student_name: string;
  father_name: string;
  mother_name: string;
  gender: string;
  date_of_birth: string;
  address: string;
  internship_topic?: string | null;
  course?: string | null;
  college_name: string;
  honours_subject?: string | null;
  current_semester?: string | null;
  class_roll_no?: string | null;
  university_name?: string | null;
  university_roll_number: string;
  university_registration_number?: string | null;
  contact_number: string;
  whatsapp_number?: string;
  email_address: string;
  photo?: string;
  signature?: string;
  ip_address?: string;
  course_id?: string | null;
  created_at?: string;
}

export interface ProfileRecord {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: 'student' | 'admin';
  college: string | null;
  roll_number: string | null;
  password_hash: string | null;
  application_id: string | null;
  course_id?: string | null;
  token_version?: number;
}

export interface CertificateRecord {
  id?: string;
  application_id: string;
  serial_number: string;
  rts_reg_number: string;
  marks: number;
  grade: string;
  grade_point: number;
  start_date: string;
  end_date: string;
  certificate_url?: string | null;
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

  async getApplicationById(id: string): Promise<ApplicationRecord | null> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        const result = await pool.query(
          'SELECT * FROM internship_applications WHERE id = $1',
          [id]
        );
        return result.rows[0] || null;
      } catch (err) {
        console.error('Error fetching application by ID:', err);
        return null;
      }
    } else {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('internship_applications')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching application by ID:', error);
        return null;
      }
      return data;
    }
  },

  async insertApplication(data: ApplicationRecord): Promise<{ error: Error | null; id?: string }> {
    const pendingData = { ...data, approval_status: 'pending' as const, reviewed_at: null, review_note: null };
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        const result = await pool.query(
          `INSERT INTO internship_applications (
            student_name, father_name, mother_name, gender, date_of_birth,
            address, internship_topic, course, college_name, honours_subject,
            current_semester, class_roll_no, university_name,
            university_roll_number, university_registration_number,
            contact_number, whatsapp_number, email_address, photo,
            signature, ip_address, created_at, course_id, approval_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, 'pending')
          RETURNING id`,
          [
            data.student_name,
            data.father_name,
            data.mother_name,
            data.gender,
            data.date_of_birth,
            data.address,
            data.internship_topic || null,
            data.course || null,
            data.college_name,
            data.honours_subject || null,
            data.current_semester || null,
            data.class_roll_no || null,
            data.university_name || null,
            data.university_roll_number,
            data.university_registration_number || null,
            data.contact_number,
            data.whatsapp_number || null,
            data.email_address,
            data.photo || null,
            data.signature || null,
            data.ip_address || null,
            data.created_at || new Date().toISOString(),
            data.course_id || null,
          ]
        );
        return { error: null, id: result.rows[0].id };
      } catch (err) {
        return { error: err as Error };
      }
    } else {
      const supabase = getSupabaseClient();
      const { data: insertedData, error } = await supabase
        .from('internship_applications')
        .insert(pendingData)
        .select('id')
        .single();
      return {
        error: error ? new Error(error.message) : null,
        id: insertedData?.id
      };
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

  /** Pending applications only, without photo/signature, for bulk approval. */
  async listPendingApplications(limit: number, excludeIds: string[] = []): Promise<{ rows: { id: string; student_name: string; university_roll_number: string }[]; total: number }> {
    const where = `approval_status = 'pending' AND NOT (id = ANY($1::uuid[]))`;
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      const rows = (await pool.query(`SELECT id, student_name, university_roll_number FROM internship_applications WHERE ${where} ORDER BY created_at LIMIT $2`, [excludeIds, limit])).rows;
      const total = Number((await pool.query(`SELECT count(*) FROM internship_applications WHERE ${where}`, [excludeIds])).rows[0].count);
      return { rows, total };
    }
    let q = getSupabaseClient().from('internship_applications').select('id, student_name, university_roll_number', { count: 'exact' })
      .eq('approval_status', 'pending').order('created_at').limit(limit);
    if (excludeIds.length) q = q.not('id', 'in', `(${excludeIds.join(',')})`);
    const { data, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data || [], total: count ?? 0 };
  },

  /** Always read the current DB value: approval/revocation must not use the profile cache. */
  async getApplicationApproval(id: string): Promise<ApprovalStatus | null> {
    if (USE_LOCAL_DB) {
      const result = await getPgPool().query('SELECT approval_status FROM internship_applications WHERE id = $1', [id]);
      return result.rows[0]?.approval_status ?? null;
    }
    const { data, error } = await getSupabaseClient().from('internship_applications').select('approval_status').eq('id', id).maybeSingle();
    if (error) throw new Error('Could not verify application approval');
    return data?.approval_status ?? null;
  },

  /** Fresh account + admission state for every protected request, across server instances. */
  async getStudentAccess(profileId: string): Promise<{ application_id: string | null; approval_status: ApprovalStatus | null; token_version: number; course_id: string | null; role: string } | null> {
    if (USE_LOCAL_DB) {
      const result = await getPgPool().query(
        `SELECT p.application_id, a.approval_status, p.token_version, p.course_id, p.role
         FROM profiles p LEFT JOIN internship_applications a ON a.id = p.application_id WHERE p.id = $1`, [profileId]);
      return result.rows[0] || null;
    }
    const { data, error } = await getSupabaseClient().from('profiles')
      .select('application_id, token_version, course_id, role, application:internship_applications(approval_status)')
      .eq('id', profileId).maybeSingle();
    if (error) throw new Error('Could not verify student access');
    if (!data) return null;
    const { application, ...account } = data;
    const state = (Array.isArray(application) ? application[0] : application) as { approval_status?: ApprovalStatus } | null;
    return { ...account, approval_status: state?.approval_status ?? null };
  },

  async reviewApplication(id: string, decision: 'approved' | 'rejected', note: string, passwordHash: string): Promise<ApplicationReview> {
    if (USE_LOCAL_DB) {
      const result = await getPgPool().query('SELECT * FROM review_internship_application($1, $2, $3, $4)', [id, decision, note, passwordHash]);
      return result.rows[0];
    }
    const { data, error } = await getSupabaseClient().rpc('review_internship_application', {
      p_application_id: id, p_decision: decision, p_note: note, p_password_hash: passwordHash,
    });
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    if (!data?.[0]) throw new Error('Application review failed');
    return data[0] as ApplicationReview;
  },

  // ==================== STUDENT ACCOUNTS ====================

  async findByPhone(phone: string): Promise<{ id: string } | null> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      const result = await pool.query(
        'SELECT id FROM internship_applications WHERE contact_number = $1 LIMIT 1',
        [phone]
      );
      return result.rows[0] || null;
    }
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('internship_applications')
      .select('id')
      .eq('contact_number', phone)
      .limit(1)
      .maybeSingle();
    return data;
  },

  /** Application matching both phone and roll number (used to provision accounts for pre-existing applicants). */
  async findApplicationByPhoneAndRoll(phone: string, rollNumber: string): Promise<ApplicationRecord | null> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      const result = await pool.query(
        `SELECT * FROM internship_applications
         WHERE contact_number = $1 AND lower(trim(university_roll_number)) = $2
         ORDER BY created_at DESC LIMIT 1`,
        [phone, rollNumber.trim().toLowerCase()]
      );
      return result.rows[0] || null;
    }
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('internship_applications')
      .select('*')
      .eq('contact_number', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    // Compare literally: SQL/PostgREST pattern characters are not passwords.
    return data && data.university_roll_number.trim().toLowerCase() === rollNumber.trim().toLowerCase() ? data : null;
  },

  async createProfile(data: {
    full_name: string;
    email: string;
    phone: string;
    college: string;
    roll_number: string;
    password_hash: string;
    application_id: string;
    course_id?: string | null;
  }): Promise<{ id?: string; error: Error | null }> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        const result = await pool.query(
          `INSERT INTO profiles (full_name, email, phone, role, college, roll_number, password_hash, application_id, course_id)
           VALUES ($1, $2, $3, 'student', $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [data.full_name, data.email.toLowerCase(), data.phone, data.college, data.roll_number, data.password_hash, data.application_id, data.course_id || null]
        );
        return { id: result.rows[0]?.id, error: null };
      } catch (err) {
        return { error: err as Error };
      }
    }
    const supabase = getSupabaseClient();
    const { data: row, error } = await supabase
      .from('profiles')
      .insert([{ ...data, email: data.email.toLowerCase(), role: 'student' }])
      .select('id')
      .single();
    return { id: row?.id, error: error ? new Error(error.message) : null };
  },

  async getProfileByPhone(phone: string): Promise<ProfileRecord | null> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      const result = await pool.query('SELECT * FROM profiles WHERE phone = $1', [phone]);
      return result.rows[0] || null;
    }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('profiles').select('*').eq('phone', phone).maybeSingle();
    return data;
  },

  async getProfileById(id: string): Promise<ProfileRecord | null> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
        return result.rows[0] || null;
      } catch {
        return null; // malformed id
      }
    }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    return data;
  },

  async updatePassword(id: string, passwordHash: string): Promise<number> {
    const r = await getPgPool().query(
      `UPDATE profiles SET password_hash = $2, password_changed_at = NOW(), token_version = token_version + 1
        WHERE id = $1 RETURNING token_version`,
      [id, passwordHash]
    );
    return r.rows[0]?.token_version ?? 0;
  },

  async bumpTokenVersion(id: string): Promise<void> {
    await getPgPool().query('UPDATE profiles SET token_version = token_version + 1 WHERE id = $1', [id]);
  },

  async touchLastLogin(id: string): Promise<void> {
    if (USE_LOCAL_DB) {
      await getPgPool().query('UPDATE profiles SET last_login_at = NOW() WHERE id = $1', [id]);
      return;
    }
    await getSupabaseClient().from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', id);
  },

  // ==================== RATE LIMITING ====================

  /**
   * Check and record an attempt for a key (IP, or "phone:<n>") in a sliding window.
   * Atomic per key (advisory lock), only prunes rows of the same limit_type, and
   * can fail closed so a database hiccup does not disable brute-force protection.
   */
  async checkRateLimit(
    ip: string,
    limitType: 'submission' | 'admin' | 'login' | 'enquiry' | 'question' = 'submission',
    maxAttempts: number = 5,
    windowMs: number = 60 * 60 * 1000, // 1 hour default
    failClosed: boolean = false
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date; error?: Error }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    const resetAt = new Date(now.getTime() + windowMs);
    const onError = (err: Error) => ({
      allowed: !failClosed,
      remaining: failClosed ? 0 : maxAttempts,
      resetAt,
      error: err,
    });

    try {
      const client = await getPgPool().connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${limitType}:${ip}`]);
        await client.query(
          'DELETE FROM rate_limits WHERE limit_type = $1 AND ip_address = $2 AND created_at < $3',
          [limitType, ip, windowStart.toISOString()]
        );
        const countResult = await client.query(
          'SELECT COUNT(*) AS count FROM rate_limits WHERE ip_address = $1 AND limit_type = $2',
          [ip, limitType]
        );
        const currentCount = parseInt(countResult.rows[0]?.count || '0', 10);
        if (currentCount >= maxAttempts) {
          await client.query('COMMIT');
          return { allowed: false, remaining: 0, resetAt };
        }
        await client.query(
          'INSERT INTO rate_limits (ip_address, limit_type, created_at) VALUES ($1, $2, $3)',
          [ip, limitType, now.toISOString()]
        );
        await client.query('COMMIT');
        return { allowed: true, remaining: Math.max(0, maxAttempts - currentCount - 1), resetAt };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Rate limit check failed:', err);
      return onError(err as Error);
    }
  },

  /** Count recent rows for a key without recording one (used for failed-login throttling). */
  async countRecentAttempts(key: string, limitType: string, windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs).toISOString();
    const res = await getPgPool().query(
      'SELECT COUNT(*) AS count FROM rate_limits WHERE ip_address = $1 AND limit_type = $2 AND created_at >= $3',
      [key, limitType, since]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  },

  async recordAttempt(key: string, limitType: string): Promise<void> {
    await getPgPool().query('INSERT INTO rate_limits (ip_address, limit_type) VALUES ($1, $2)', [key, limitType]);
  },

  async clearAttempts(key: string, limitType: string): Promise<void> {
    await getPgPool().query('DELETE FROM rate_limits WHERE ip_address = $1 AND limit_type = $2', [key, limitType]);
  },

  // ==================== CERTIFICATES ====================

  async insertCertificate(data: Omit<CertificateRecord, 'id' | 'created_at'>): Promise<{ error: Error | null; id?: string }> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        const result = await pool.query(
          `INSERT INTO certificates (application_id, serial_number, rts_reg_number, marks, grade, grade_point, start_date, end_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [data.application_id, data.serial_number, data.rts_reg_number, data.marks, data.grade, data.grade_point, data.start_date, data.end_date]
        );
        return { error: null, id: result.rows[0].id };
      } catch (err) {
        return { error: err as Error };
      }
    } else {
      const supabase = getSupabaseClient();
      const { data: inserted, error } = await supabase
        .from('certificates')
        .insert(data)
        .select('id')
        .single();
      return { error: error ? new Error(error.message) : null, id: inserted?.id };
    }
  },

  async getCertificateById(id: string): Promise<CertificateRecord | null> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        const result = await pool.query('SELECT * FROM certificates WHERE id = $1', [id]);
        return result.rows[0] || null;
      } catch (err) {
        console.error('Error fetching certificate by ID:', err);
        return null;
      }
    } else {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        console.error('Error fetching certificate by ID:', error);
        return null;
      }
      return data;
    }
  },

  async getCertificateByApplicationId(applicationId: string): Promise<CertificateRecord | null> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        const result = await pool.query('SELECT * FROM certificates WHERE application_id = $1', [applicationId]);
        return result.rows[0] || null;
      } catch (err) {
        console.error('Error fetching certificate by application ID:', err);
        return null;
      }
    } else {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('application_id', applicationId)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching certificate by application ID:', error);
      }
      return data || null;
    }
  },

  async getNextCertificateSerial(year: number): Promise<string> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        const result = await pool.query(
          `SELECT COUNT(*) as count FROM certificates WHERE serial_number LIKE $1`,
          [`RTS-CERT-${year}-%`]
        );
        const count = parseInt(result.rows[0]?.count || '0', 10);
        return `RTS-CERT-${year}-${String(count + 1).padStart(5, '0')}`;
      } catch (err) {
        console.error('Error getting next certificate serial:', err);
        return `RTS-CERT-${year}-${String(Date.now()).slice(-5)}`;
      }
    } else {
      const supabase = getSupabaseClient();
      const { count } = await supabase
        .from('certificates')
        .select('*', { count: 'exact', head: true })
        .like('serial_number', `RTS-CERT-${year}-%`);
      return `RTS-CERT-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
    }
  },

  async updateCertificateUrl(id: string, url: string): Promise<{ error: Error | null }> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      try {
        await pool.query('UPDATE certificates SET certificate_url = $1 WHERE id = $2', [url, id]);
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    } else {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('certificates')
        .update({ certificate_url: url })
        .eq('id', id);
      return { error: error ? new Error(error.message) : null };
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

  // ==================== ENQUIRIES ====================
  async insertEnquiry(data: { full_name: string; email: string; phone: string; college?: string; course_interest?: string; message?: string }) {
    if (USE_LOCAL_DB) {
      const pool = getPgPool()
      const result = await pool.query(
        `INSERT INTO enquiries (full_name, email, phone, college, course_interest, message)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [data.full_name, data.email.toLowerCase(), data.phone, data.college || null, data.course_interest || null, data.message || null]
      )
      return { id: result.rows[0].id, error: null }
    }
    const supabase = getSupabaseClient()
    const { data: record, error } = await supabase.from('enquiries').insert([data]).select('id').single()
    return { id: record?.id, error }
  },

  async getAllEnquiries() {
    if (USE_LOCAL_DB) {
      const pool = getPgPool()
      const result = await pool.query(`SELECT * FROM enquiries ORDER BY created_at DESC`)
      return { data: result.rows, error: null }
    }
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false })
    return { data, error }
  },

  // ==================== NEWS TICKER ====================

  async getActiveNews(): Promise<{ id: string; message: string; link_url: string | null; created_at: string }[]> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      const result = await pool.query(
        `SELECT id, message, link_url, created_at FROM news_ticker WHERE is_active = true ORDER BY sort_order ASC, created_at ASC`
      );
      return result.rows;
    }
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('news_ticker')
      .select('id, message, link_url, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    return data || [];
  },

  async getAllNews(): Promise<{ id: string; message: string; link_url: string | null; is_active: boolean; sort_order: number; created_at: string }[]> {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      const result = await pool.query(`SELECT * FROM news_ticker ORDER BY sort_order ASC, created_at ASC`);
      return result.rows;
    }
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('news_ticker').select('*').order('sort_order', { ascending: true });
    return data || [];
  },

  async createNews(data: { message: string; link_url: string | null; is_active: boolean; sort_order: number }) {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      const result = await pool.query(
        `INSERT INTO news_ticker (message, link_url, is_active, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
        [data.message, data.link_url, data.is_active, data.sort_order]
      );
      return result.rows[0];
    }
    const supabase = getSupabaseClient();
    const { data: row } = await supabase.from('news_ticker').insert([data]).select('*').single();
    return row;
  },

  async updateNews(data: { id: string; message?: string; link_url?: string | null; is_active?: boolean; sort_order?: number }) {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      await pool.query(
        `UPDATE news_ticker SET
          message    = COALESCE($2, message),
          link_url   = CASE WHEN $3::text IS NULL THEN link_url ELSE $3 END,
          is_active  = COALESCE($4, is_active),
          sort_order = COALESCE($5, sort_order),
          updated_at = NOW()
         WHERE id = $1`,
        [data.id, data.message ?? null, data.link_url !== undefined ? data.link_url : null, data.is_active ?? null, data.sort_order ?? null]
      );
      return;
    }
    const supabase = getSupabaseClient();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.message !== undefined) update.message = data.message;
    if (data.link_url !== undefined) update.link_url = data.link_url;
    if (data.is_active !== undefined) update.is_active = data.is_active;
    if (data.sort_order !== undefined) update.sort_order = data.sort_order;
    await supabase.from('news_ticker').update(update).eq('id', data.id);
  },

  async deleteNews(id: string) {
    if (USE_LOCAL_DB) {
      const pool = getPgPool();
      await pool.query(`DELETE FROM news_ticker WHERE id = $1`, [id]);
      return;
    }
    const supabase = getSupabaseClient();
    await supabase.from('news_ticker').delete().eq('id', id);
  },
};

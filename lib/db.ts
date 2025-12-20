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
};

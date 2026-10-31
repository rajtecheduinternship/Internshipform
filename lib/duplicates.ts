import { getPgPool } from '@/lib/db';

export interface DuplicateInput {
  studentName: string;
  fatherName: string;
  dateOfBirth?: string;
  phone: string;
  email: string;
  roll: string;
  excludeId?: string;
}

export type DuplicateReason = 'phone' | 'email' | 'roll' | 'name_father' | 'name_dob';

export interface DuplicateMatch {
  id: string;
  student_name: string;
  father_name: string;
  contact_number: string;
  email_address: string;
  university_roll_number: string;
  college_name: string | null;
  internship_topic: string | null;
  approval_status: string;
  created_at: string;
  reasons: DuplicateReason[];
  /** 'exact' = same phone/email/roll; 'likely' = same person by name and parent/birth date. */
  level: 'exact' | 'likely';
}

interface Row {
  id: string; student_name: string; father_name: string; date_of_birth: string | null;
  contact_number: string; email_address: string; university_roll_number: string;
  college_name: string | null; internship_topic: string | null; approval_status: string; created_at: string;
}

const COLUMNS = `id, student_name, father_name, date_of_birth::text AS date_of_birth, contact_number, email_address,
  university_roll_number, college_name, internship_topic, approval_status, created_at::text AS created_at`;

const NAME_MIN = 0.85;
const FATHER_MIN = 0.75;

export const normPhone = (v: string) => (v || '').replace(/\D/g, '').slice(-10);
export const normEmail = (v: string) => (v || '').trim().toLowerCase();
export const normRoll = (v: string) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normName = (v: string) => (v || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
const tokens = (v: string) => (v || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1);

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

/** 1 = identical, 0 = nothing in common. Word order and punctuation are ignored. */
function similarity(a: string, b: string): number {
  const x = normName(a), y = normName(b);
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

function compare(input: DuplicateInput, row: Row): DuplicateMatch | null {
  const reasons: DuplicateReason[] = [];
  if (normPhone(input.phone) && normPhone(input.phone) === normPhone(row.contact_number)) reasons.push('phone');
  if (normEmail(input.email) && normEmail(input.email) === normEmail(row.email_address)) reasons.push('email');
  if (normRoll(input.roll) && normRoll(input.roll) === normRoll(row.university_roll_number)) reasons.push('roll');
  const nameClose = similarity(input.studentName, row.student_name) >= NAME_MIN;
  if (nameClose && similarity(input.fatherName, row.father_name) >= FATHER_MIN) reasons.push('name_father');
  else if (nameClose && input.dateOfBirth && row.date_of_birth && input.dateOfBirth.slice(0, 10) === row.date_of_birth.slice(0, 10)) reasons.push('name_dob');
  if (!reasons.length) return null;
  return {
    id: row.id, student_name: row.student_name, father_name: row.father_name, contact_number: row.contact_number,
    email_address: row.email_address, university_roll_number: row.university_roll_number, college_name: row.college_name,
    internship_topic: row.internship_topic, approval_status: row.approval_status, created_at: row.created_at, reasons,
    level: reasons.some((r) => r === 'phone' || r === 'email' || r === 'roll') ? 'exact' : 'likely',
  };
}

const rank = (m: DuplicateMatch) => (m.level === 'exact' ? 100 : 0) + m.reasons.length;

/** Existing applications that look like the same person. Never returns the excluded id. */
export async function findDuplicates(input: DuplicateInput): Promise<DuplicateMatch[]> {
  const likes = tokens(input.studentName).map((t) => `%${t}%`);
  const { rows } = await getPgPool().query<Row>(
    `SELECT ${COLUMNS} FROM internship_applications
     WHERE ($5::uuid IS NULL OR id <> $5::uuid)
       AND (right(regexp_replace(contact_number, '\\D', '', 'g'), 10) = $1
         OR lower(btrim(email_address)) = $2
         OR regexp_replace(lower(university_roll_number), '[^a-z0-9]', '', 'g') = $3
         OR lower(student_name) LIKE ANY($4::text[]))
     LIMIT 3000`,
    [normPhone(input.phone), normEmail(input.email), normRoll(input.roll), likes, input.excludeId ?? null]
  );
  return rows.map((r) => compare(input, r)).filter((m): m is DuplicateMatch => !!m).sort((a, b) => rank(b) - rank(a));
}

/** Number of possible duplicates for every pending application, from one query. */
export async function pendingDuplicateCounts(): Promise<Record<string, number>> {
  const { rows } = await getPgPool().query<Row & { approval_status: string }>(`SELECT ${COLUMNS} FROM internship_applications`);
  const byKey = new Map<string, Row[]>();
  const add = (k: string, r: Row) => { if (k) (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r); };
  for (const r of rows) {
    add('p:' + normPhone(r.contact_number), r);
    add('e:' + normEmail(r.email_address), r);
    add('r:' + normRoll(r.university_roll_number), r);
    for (const t of tokens(r.student_name)) add('n:' + t, r);
  }
  const counts: Record<string, number> = {};
  for (const p of rows) {
    if (p.approval_status !== 'pending') continue;
    const input: DuplicateInput = {
      studentName: p.student_name, fatherName: p.father_name, dateOfBirth: p.date_of_birth ?? undefined,
      phone: p.contact_number, email: p.email_address, roll: p.university_roll_number,
    };
    const candidates = new Set<Row>([
      ...(byKey.get('p:' + normPhone(p.contact_number)) ?? []), ...(byKey.get('e:' + normEmail(p.email_address)) ?? []),
      ...(byKey.get('r:' + normRoll(p.university_roll_number)) ?? []), ...tokens(p.student_name).flatMap((t) => byKey.get('n:' + t) ?? []),
    ]);
    let n = 0;
    for (const c of candidates) if (c.id !== p.id && compare(input, c)) n++;
    if (n) counts[p.id] = n;
  }
  return counts;
}

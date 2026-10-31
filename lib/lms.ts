import { getPgPool } from '@/lib/db';
import { Interval, mergeIntervals, calculateUniqueSecondsWatched } from '@/lib/tracking';

const pool = () => getPgPool();

// ==================== TYPES ====================

export interface CourseRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  duration_weeks: number | null;
  is_published: boolean;
}

export interface VideoRow {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  required_watch_percent: number;
  order_index: number;
  is_published: boolean;
  progress?: Record<string, unknown> | null;
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'course';

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export { isUuid };

// ==================== PUBLIC ====================

/** Published courses for the application form dropdown / public catalogue. */
export async function listPublishedCourses(): Promise<Pick<CourseRow, 'id' | 'title' | 'slug' | 'description' | 'thumbnail_url' | 'duration_weeks' | 'category'>[]> {
  const r = await pool().query(
    `SELECT id, title, slug, description, thumbnail_url, duration_weeks, category
       FROM courses WHERE is_published = true ORDER BY title ASC`
  );
  return r.rows;
}

export async function getPublishedCourse(id: string): Promise<CourseRow | null> {
  if (!isUuid(id)) return null;
  const r = await pool().query(`SELECT * FROM courses WHERE id = $1 AND is_published = true`, [id]);
  return r.rows[0] || null;
}

// ==================== STUDENT ====================

/**
 * The student's own course: modules (via the shared course_modules join) with
 * published, non-archived videos and this student's progress. Three queries total.
 */
export async function getStudentCourse(courseId: string | null | undefined, studentId: string) {
  if (!courseId) return null;
  const c = await pool().query(`SELECT * FROM courses WHERE id = $1 AND is_published = true`, [courseId]);
  const course: CourseRow | undefined = c.rows[0];
  if (!course) return null;

  const mods = await pool().query(
    `SELECT m.id, m.title, m.description, m.thumbnail_url, m.is_mandatory, COALESCE(cm.order_index, 0) AS order_index
       FROM modules m LEFT JOIN course_modules cm ON cm.module_id = m.id AND cm.course_id = $1
      WHERE m.is_mandatory OR cm.course_id IS NOT NULL
      ORDER BY m.is_mandatory DESC, cm.order_index ASC NULLS LAST, m.created_at ASC`,
    [courseId]
  );
  const vids = await pool().query(
    `SELECT v.id, v.module_id, v.title, v.description, v.youtube_video_id, v.thumbnail_url,
            v.duration_seconds, v.required_watch_percent, v.order_index, v.is_published,
            p.total_seconds_watched, p.completion_percentage, p.is_completed, p.last_watched_position
       FROM videos v
       JOIN modules mm ON mm.id = v.module_id AND (mm.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.module_id = mm.id AND cm.course_id = $1))
       LEFT JOIN video_progress p ON p.video_id = v.id AND p.student_id = $2
      WHERE v.is_published = true AND v.archived_at IS NULL
      ORDER BY v.order_index ASC, v.created_at ASC`,
    [courseId, studentId]
  );

  const byModule = new Map<string, unknown[]>();
  for (const row of vids.rows) {
    const progress = row.total_seconds_watched === null || row.total_seconds_watched === undefined
      ? null
      : {
          total_seconds_watched: row.total_seconds_watched,
          completion_percentage: Number(row.completion_percentage),
          is_completed: row.is_completed,
          last_watched_position: row.last_watched_position,
        };
    const {
      total_seconds_watched: _a, completion_percentage: _b, is_completed: _c, last_watched_position: _d, ...video
    } = row;
    void _a; void _b; void _c; void _d;
    const list = byModule.get(video.module_id) || [];
    list.push({ ...video, progress });
    byModule.set(video.module_id, list);
  }

  return {
    ...course,
    modules: mods.rows.map((m) => ({ ...m, videos: byModule.get(m.id) || [] })),
  };
}

/** A video the student is allowed to watch (in their course, published, not archived). */
export async function getVideoForStudent(videoId: string, courseId: string | null | undefined, studentId: string) {
  if (!isUuid(videoId) || !courseId) return null;
  const r = await pool().query(
    `SELECT v.id, v.module_id, v.title, v.description, v.youtube_video_id, v.thumbnail_url,
            v.duration_seconds, v.required_watch_percent, v.order_index, v.is_published,
            p.id AS p_id, p.total_seconds_watched, p.completion_percentage, p.is_completed,
            p.last_watched_position, p.watched_intervals
       FROM videos v
       JOIN modules mm ON mm.id = v.module_id AND (mm.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.module_id = mm.id AND cm.course_id = $2))
       LEFT JOIN video_progress p ON p.video_id = v.id AND p.student_id = $3
      WHERE v.id = $1 AND v.is_published = true AND v.archived_at IS NULL
      LIMIT 1`,
    [videoId, courseId, studentId]
  );
  const row = r.rows[0];
  if (!row) return null;
  const { p_id, total_seconds_watched, completion_percentage, is_completed, last_watched_position, watched_intervals, ...video } = row;
  return {
    ...video,
    progress: p_id
      ? {
          total_seconds_watched,
          completion_percentage: Number(completion_percentage),
          is_completed,
          last_watched_position,
          watched_intervals,
        }
      : null,
  };
}

/** Access check + the facts the server needs to validate progress. */
export async function getVideoAccessMeta(videoId: string, courseId: string | null | undefined) {
  if (!isUuid(videoId) || !courseId) return null;
  const r = await pool().query(
    `SELECT v.id, v.duration_seconds, v.required_watch_percent
       FROM videos v JOIN modules mm ON mm.id = v.module_id AND (mm.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.module_id = mm.id AND cm.course_id = $2))
      WHERE v.id = $1 AND v.is_published = true AND v.archived_at IS NULL LIMIT 1`,
    [videoId, courseId]
  );
  return (r.rows[0] as { id: string; duration_seconds: number; required_watch_percent: number } | undefined) || null;
}

// ==================== PROGRESS (server-authoritative) ====================

const MAX_INTERVALS = 500;
/** Real-time playback can be sped up; allow 2x plus slack for network jitter. */
const MAX_SPEED = 2;
const SLACK_SECONDS = 15;

function sanitizeIntervals(raw: unknown, duration: number): Interval[] {
  if (!Array.isArray(raw)) return [];
  const out: Interval[] = [];
  for (const item of raw.slice(0, MAX_INTERVALS)) {
    if (!Array.isArray(item) || item.length !== 2) continue;
    const a = Math.floor(Number(item[0]));
    const b = Math.ceil(Number(item[1]));
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const start = Math.max(0, a);
    const end = Math.min(duration, b);
    if (end > start) out.push([start, end]);
  }
  return mergeIntervals(out);
}

/**
 * Records progress. The client only reports *what ranges it played*; the server decides
 * the percentage and completion from the video's real duration, rejects growth that is
 * faster than real time, and never lowers stored progress.
 */
export async function saveProgress(args: {
  studentId: string;
  studentEmail: string;
  video: { id: string; duration_seconds: number; required_watch_percent: number };
  intervals: unknown;
  position: unknown;
}) {
  const { video } = args;
  const duration = video.duration_seconds;
  if (!duration || duration <= 0) return { error: new Error('Video duration is not configured') };

  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT watched_intervals, total_seconds_watched, is_completed, completed_at,
              EXTRACT(EPOCH FROM (NOW() - updated_at)) AS idle_secs
         FROM video_progress WHERE student_email = $1 AND video_id = $2 FOR UPDATE`,
      [args.studentEmail, video.id]
    );
    const prev = existing.rows[0];
    const prevIntervals = prev ? sanitizeIntervals(prev.watched_intervals, duration) : [];
    const prevSeconds = calculateUniqueSecondsWatched(prevIntervals);

    // Union with what we already hold, so a stale tab can never erase progress.
    let merged = mergeIntervals([...prevIntervals, ...sanitizeIntervals(args.intervals, duration)]);
    let seconds = calculateUniqueSecondsWatched(merged);

    // Anti-cheat: you cannot gain more unique seconds than real time allows.
    const idle = prev ? Math.max(0, Number(prev.idle_secs)) : 0;
    const allowedGain = prev ? idle * MAX_SPEED + SLACK_SECONDS : SLACK_SECONDS * 2;
    if (seconds - prevSeconds > allowedGain) {
      merged = prevIntervals;
      seconds = prevSeconds;
    }

    const pct = Math.min(100, Math.round((seconds / duration) * 10000) / 100);
    const completed = Boolean(prev?.is_completed) || pct >= video.required_watch_percent;
    const position = Math.min(duration, Math.max(0, Math.floor(Number(args.position) || 0)));

    const res = await client.query(
      `INSERT INTO video_progress (
         student_id, student_email, video_id, total_seconds_watched, completion_percentage,
         is_completed, last_watched_position, watched_intervals, completed_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $6 THEN NOW() END, NOW())
       ON CONFLICT (student_email, video_id) DO UPDATE SET
         student_id = EXCLUDED.student_id,
         total_seconds_watched = GREATEST(video_progress.total_seconds_watched, EXCLUDED.total_seconds_watched),
         completion_percentage = GREATEST(video_progress.completion_percentage, EXCLUDED.completion_percentage),
         is_completed = video_progress.is_completed OR EXCLUDED.is_completed,
         last_watched_position = EXCLUDED.last_watched_position,
         watched_intervals = EXCLUDED.watched_intervals,
         completed_at = COALESCE(video_progress.completed_at, CASE WHEN EXCLUDED.is_completed THEN NOW() END),
         updated_at = NOW()
       RETURNING total_seconds_watched, completion_percentage, is_completed, last_watched_position`,
      [args.studentId, args.studentEmail, video.id, seconds, pct, completed, position, JSON.stringify(merged)]
    );
    await client.query('COMMIT');
    return { data: res.rows[0], error: null };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    return { error: err as Error };
  } finally {
    client.release();
  }
}

const ALLOWED_EVENTS = new Set(['play', 'pause', 'seek', 'blur', 'focus', 'ended']);

export async function startWatchSession(args: { studentEmail: string; videoId: string; ip: string; userAgent: string }) {
  const r = await pool().query(
    `INSERT INTO watch_sessions (student_email, video_id, ip_address, user_agent)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [args.studentEmail, args.videoId, args.ip.slice(0, 64), args.userAgent.slice(0, 300)]
  );
  return r.rows[0].id as string;
}

/** Only records events for a session that belongs to the caller. Heartbeats are not stored. */
export async function recordWatchEvent(args: {
  studentEmail: string; sessionId: string; eventType: string; videoTime: number;
}) {
  if (!ALLOWED_EVENTS.has(args.eventType) || !isUuid(args.sessionId)) return false;
  const r = await pool().query(
    `INSERT INTO watch_events (session_id, event_type, video_time)
     SELECT id, $3, $4 FROM watch_sessions WHERE id = $1 AND student_email = $2`,
    [args.sessionId, args.studentEmail, args.eventType, Math.max(0, Math.min(86400, Math.floor(args.videoTime) || 0))]
  );
  return (r.rowCount ?? 0) > 0;
}

// ==================== ADMIN: COURSES ====================

export async function adminListCourses() {
  const r = await pool().query(
    `SELECT c.*,
            (SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = c.id)::int AS module_count,
            (SELECT COUNT(*) FROM profiles p WHERE p.course_id = c.id AND p.role = 'student')::int AS student_count
       FROM courses c ORDER BY c.created_at DESC`
  );
  return r.rows;
}

export async function adminGetCourse(id: string) {
  if (!isUuid(id)) return null;
  const c = await pool().query(`SELECT * FROM courses WHERE id = $1`, [id]);
  if (!c.rows[0]) return null;
  const m = await pool().query(
    `SELECT m.id, m.title, cm.order_index FROM course_modules cm JOIN modules m ON m.id = cm.module_id
      WHERE cm.course_id = $1 ORDER BY cm.order_index ASC`,
    [id]
  );
  return { ...c.rows[0], modules: m.rows };
}

export async function adminCreateCourse(d: { title: string; description?: string; category?: string; thumbnail_url?: string | null; duration_weeks?: number; is_published?: boolean }) {
  let slug = slugify(d.title);
  const taken = await pool().query(`SELECT 1 FROM courses WHERE slug = $1`, [slug]);
  if (taken.rowCount) slug = `${slug}-${Date.now().toString(36)}`;
  const r = await pool().query(
    `INSERT INTO courses (title, slug, description, category, thumbnail_url, duration_weeks, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [d.title, slug, d.description || '', d.category || 'Internship', d.thumbnail_url || null, d.duration_weeks ?? 4, d.is_published !== false]
  );
  return r.rows[0];
}

export async function adminUpdateCourse(id: string, d: Partial<{ title: string; description: string; category: string; thumbnail_url: string | null; duration_weeks: number; is_published: boolean }>) {
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const k of ['title', 'description', 'category', 'thumbnail_url', 'duration_weeks', 'is_published'] as const) {
    if (d[k] !== undefined) { vals.push(d[k]); fields.push(`${k} = $${vals.length}`); }
  }
  if (!fields.length) return null;
  vals.push(id);
  const r = await pool().query(`UPDATE courses SET ${fields.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return r.rows[0] || null;
}

/** Students keep their account; their course_id is set NULL by the FK. */
export async function adminDeleteCourse(id: string) {
  const r = await pool().query(`DELETE FROM courses WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

// ==================== ADMIN: MODULES ====================

export async function adminListModules() {
  const r = await pool().query(
    `SELECT m.*,
            (SELECT COUNT(*) FROM videos v WHERE v.module_id = m.id AND v.archived_at IS NULL)::int AS video_count,
            COALESCE((SELECT json_agg(json_build_object('id', c.id, 'title', c.title) ORDER BY c.title)
                        FROM course_modules cm JOIN courses c ON c.id = cm.course_id WHERE cm.module_id = m.id), '[]') AS courses
       FROM modules m ORDER BY m.created_at DESC`
  );
  return r.rows;
}

export async function adminGetModule(id: string) {
  if (!isUuid(id)) return null;
  const m = await pool().query(`SELECT * FROM modules WHERE id = $1`, [id]);
  if (!m.rows[0]) return null;
  const v = await pool().query(
    `SELECT v.*, (SELECT COUNT(*) FROM video_progress p WHERE p.video_id = v.id)::int AS watcher_count
       FROM videos v WHERE v.module_id = $1 ORDER BY v.archived_at IS NOT NULL, v.order_index ASC, v.created_at ASC`,
    [id]
  );
  return { ...m.rows[0], videos: v.rows };
}

export async function adminCreateModule(d: { title: string; description?: string; thumbnail_url?: string | null; is_mandatory?: boolean }) {
  const r = await pool().query(
    `INSERT INTO modules (title, description, thumbnail_url, is_mandatory) VALUES ($1,$2,$3,$4) RETURNING *`,
    [d.title, d.description || '', d.thumbnail_url || null, d.is_mandatory === true]
  );
  return r.rows[0];
}

export async function adminUpdateModule(id: string, d: Partial<{ title: string; description: string; thumbnail_url: string | null; is_mandatory: boolean }>) {
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const k of ['title', 'description', 'thumbnail_url', 'is_mandatory'] as const) {
    if (d[k] !== undefined) { vals.push(d[k]); fields.push(`${k} = $${vals.length}`); }
  }
  if (!fields.length) return null;
  vals.push(id);
  const r = await pool().query(`UPDATE modules SET ${fields.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return r.rows[0] || null;
}

export async function adminDeleteModule(id: string) {
  const r = await pool().query(`DELETE FROM modules WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

/** Replace a course's module list (attach / detach / reorder in one atomic step). */
export async function adminSetCourseModules(courseId: string, moduleIds: string[]) {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM course_modules WHERE course_id = $1`, [courseId]);
    for (let i = 0; i < moduleIds.length; i++) {
      await client.query(
        `INSERT INTO course_modules (course_id, module_id, order_index) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [courseId, moduleIds[i], i + 1]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ==================== ADMIN: VIDEOS ====================

export async function adminCreateVideo(d: {
  module_id: string; title: string; description?: string; youtube_video_id: string; thumbnail_url?: string | null;
  duration_seconds: number; required_watch_percent?: number; order_index?: number; is_published?: boolean;
}) {
  const order = d.order_index ?? (await pool().query(
    `SELECT COALESCE(MAX(order_index), 0) + 1 AS n FROM videos WHERE module_id = $1`, [d.module_id]
  )).rows[0].n;
  const r = await pool().query(
    `INSERT INTO videos (module_id, title, description, youtube_video_id, thumbnail_url, duration_seconds, required_watch_percent, order_index, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [d.module_id, d.title, d.description || '', d.youtube_video_id, d.thumbnail_url || null, d.duration_seconds,
     d.required_watch_percent ?? 90, order, d.is_published !== false]
  );
  return r.rows[0];
}

export async function adminUpdateVideo(id: string, d: Partial<{
  title: string; description: string; youtube_video_id: string; thumbnail_url: string | null;
  duration_seconds: number; required_watch_percent: number; order_index: number; is_published: boolean; archived: boolean;
}>) {
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const k of ['title', 'description', 'youtube_video_id', 'thumbnail_url', 'duration_seconds', 'required_watch_percent', 'order_index', 'is_published'] as const) {
    if (d[k] !== undefined) { vals.push(d[k]); fields.push(`${k} = $${vals.length}`); }
  }
  if (d.archived !== undefined) fields.push(d.archived ? 'archived_at = NOW()' : 'archived_at = NULL');
  if (!fields.length) return null;
  vals.push(id);
  const r = await pool().query(`UPDATE videos SET ${fields.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return r.rows[0] || null;
}

/** Permanent delete: also erases every student's progress for this video. */
export async function adminDeleteVideo(id: string) {
  const r = await pool().query(`DELETE FROM videos WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

// ==================== ADMIN: STUDENTS & ANALYTICS ====================

/** Per-student summary: course, videos in the course, completed count, watch time. */
export async function adminListStudents() {
  const r = await pool().query(
    `SELECT p.id, p.full_name, p.email, p.phone, p.college, p.roll_number, p.last_login_at, p.created_at,
            p.course_id, c.title AS course_title,
            COALESCE(t.total_videos, 0)::int AS total_videos,
            COALESCE(pr.completed_videos, 0)::int AS completed_videos,
            COALESCE(pr.watch_seconds, 0)::int AS watch_seconds,
            pr.last_activity
       FROM profiles p
       LEFT JOIN courses c ON c.id = p.course_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total_videos
           FROM videos v JOIN modules mm ON mm.id = v.module_id AND (mm.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.module_id = mm.id AND cm.course_id = p.course_id))
          WHERE v.is_published AND v.archived_at IS NULL
       ) t ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE vp.is_completed) AS completed_videos,
                SUM(vp.total_seconds_watched) AS watch_seconds, MAX(vp.updated_at) AS last_activity
           FROM video_progress vp
           JOIN videos v ON v.id = vp.video_id AND v.archived_at IS NULL
           JOIN modules mm ON mm.id = v.module_id AND (mm.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.module_id = mm.id AND cm.course_id = p.course_id))
          WHERE vp.student_id = p.id
       ) pr ON true
      WHERE p.role = 'student'
      ORDER BY p.created_at DESC`
  );
  return r.rows;
}

export async function adminStudentDetail(studentId: string) {
  if (!isUuid(studentId)) return null;
  const p = await pool().query(
    `SELECT p.id, p.full_name, p.email, p.phone, p.college, p.roll_number, p.last_login_at, p.course_id, p.application_id,
            a.father_name, a.mother_name, a.gender, a.date_of_birth::text AS date_of_birth, a.address, a.whatsapp_number
       FROM profiles p LEFT JOIN internship_applications a ON a.id = p.application_id
      WHERE p.id = $1 AND p.role = 'student'`,
    [studentId]
  );
  if (!p.rows[0]) return null;
  const course = await getStudentCourse(p.rows[0].course_id, studentId);
  return { profile: p.rows[0], course };
}

export interface StudentEdit {
  full_name?: string; phone?: string; email?: string; college?: string; roll_number?: string;
  father_name?: string; mother_name?: string; gender?: string; date_of_birth?: string; address?: string; whatsapp_number?: string;
  course_id?: string | null;
  /** Pre-hashed password. Setting it also signs the student out everywhere. */
  password_hash?: string;
}

/** Profile columns -> the matching application columns, so the two records never drift apart. */
const PROFILE_COLS: Record<string, string> = { full_name: 'full_name', phone: 'phone', email: 'email', college: 'college', roll_number: 'roll_number' };
const APP_COLS: Record<string, string> = {
  full_name: 'student_name', phone: 'contact_number', email: 'email_address', college: 'college_name', roll_number: 'university_roll_number',
  father_name: 'father_name', mother_name: 'mother_name', gender: 'gender', date_of_birth: 'date_of_birth', address: 'address',
  whatsapp_number: 'whatsapp_number', course_id: 'course_id',
};

/** Returns false if the student does not exist. Throws the pg error (23505 = duplicate, 23503 = unknown course). */
export async function adminUpdateStudent(studentId: string, edit: StudentEdit): Promise<boolean> {
  if (!isUuid(studentId)) return false;
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(`SELECT application_id FROM profiles WHERE id = $1 AND role = 'student' FOR UPDATE`, [studentId]);
    if (!cur.rows[0]) { await client.query('ROLLBACK'); return false; }
    const applicationId: string | null = cur.rows[0].application_id;

    const sets: string[] = []; const vals: unknown[] = [studentId];
    const put = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    for (const [k, col] of Object.entries(PROFILE_COLS)) if ((edit as Record<string, unknown>)[k] !== undefined) put(col, (edit as Record<string, unknown>)[k]);
    if (edit.course_id !== undefined) put('course_id', edit.course_id);
    if (edit.password_hash) { put('password_hash', edit.password_hash); sets.push('token_version = token_version + 1'); }
    if (sets.length) await client.query(`UPDATE profiles SET ${sets.join(', ')} WHERE id = $1`, vals);

    if (applicationId) {
      const aSets: string[] = []; const aVals: unknown[] = [applicationId];
      for (const [k, col] of Object.entries(APP_COLS)) {
        const v = (edit as Record<string, unknown>)[k];
        if (v !== undefined) { aVals.push(v); aSets.push(`${col} = $${aVals.length}`); }
      }
      if (aSets.length) await client.query(`UPDATE internship_applications SET ${aSets.join(', ')} WHERE id = $1`, aVals);
    }
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function adminAnalytics() {
  const q = (sql: string) => pool().query(sql);
  const [students, hours, completions, enquiries, recent, top] = await Promise.all([
    q(`SELECT COUNT(*) AS n FROM profiles WHERE role = 'student'`),
    q(`SELECT COALESCE(SUM(total_seconds_watched), 0) AS s FROM video_progress`),
    q(`SELECT COUNT(*) AS n FROM video_progress WHERE is_completed`),
    q(`SELECT COUNT(*) AS n FROM enquiries`),
    q(`SELECT ws.id, ws.student_email, ws.duration_seconds, ws.start_time, COALESCE(v.title, 'Video') AS video_title
         FROM watch_sessions ws LEFT JOIN videos v ON v.id = ws.video_id
        ORDER BY ws.start_time DESC LIMIT 10`),
    q(`SELECT v.id, v.title, COUNT(vp.id)::int AS total_views, COALESCE(AVG(vp.completion_percentage), 0) AS completion_rate
         FROM videos v LEFT JOIN video_progress vp ON vp.video_id = v.id
        WHERE v.archived_at IS NULL GROUP BY v.id, v.title ORDER BY total_views DESC LIMIT 10`),
  ]);
  return {
    totalStudents: Number(students.rows[0].n),
    totalWatchHours: Math.round((Number(hours.rows[0].s) / 3600) * 10) / 10,
    totalCompletions: Number(completions.rows[0].n),
    totalEnquiries: Number(enquiries.rows[0].n),
    recentSessions: recent.rows,
    topVideos: top.rows.map((r) => ({ ...r, completion_rate: Number(r.completion_rate) })),
  };
}

// ==================== ADMIN: DASHBOARD ====================

/** One row per course: enrolment, completion and recent activity, plus a 14-day activity series. */
export async function adminOverview() {
  const [courses, daily, totals] = await Promise.all([
    pool().query(
      `SELECT c.id, c.title, c.is_published,
              (SELECT COUNT(*) FROM profiles p WHERE p.course_id = c.id AND p.role = 'student')::int AS students,
              (SELECT COUNT(*) FROM videos v JOIN modules mm ON mm.id = v.module_id AND (mm.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.module_id = mm.id AND cm.course_id = c.id))
                 WHERE v.is_published AND v.archived_at IS NULL)::int AS videos,
              COALESCE((SELECT COUNT(*) FROM video_progress vp JOIN profiles p ON p.id = vp.student_id
                 JOIN videos v ON v.id = vp.video_id AND v.archived_at IS NULL AND v.is_published
                 JOIN modules mm ON mm.id = v.module_id AND (mm.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.module_id = mm.id AND cm.course_id = c.id))
                 WHERE p.course_id = c.id AND vp.is_completed), 0)::int AS completions,
              (SELECT COUNT(DISTINCT vp.student_id) FROM video_progress vp JOIN profiles p ON p.id = vp.student_id
                 WHERE p.course_id = c.id AND vp.updated_at > NOW() - INTERVAL '7 days')::int AS active_7d
         FROM courses c ORDER BY students DESC, c.title ASC`
    ),
    pool().query(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
              COALESCE(SUM(ws.duration_seconds), 0)::int AS seconds,
              COUNT(DISTINCT ws.student_email)::int AS students
         FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') d
         LEFT JOIN watch_sessions ws ON ws.start_time::date = d::date
        GROUP BY d ORDER BY d`
    ),
    pool().query(
      `SELECT (SELECT COUNT(*) FROM profiles WHERE role='student')::int AS students,
              (SELECT COUNT(*) FROM profiles WHERE role='student' AND course_id IS NULL)::int AS unassigned,
              (SELECT COUNT(DISTINCT vp.student_id) FROM video_progress vp JOIN profiles p ON p.id = vp.student_id
                WHERE p.role = 'student' AND vp.updated_at > NOW() - INTERVAL '7 days')::int AS active_7d,
              (SELECT COALESCE(SUM(vp.total_seconds_watched),0) FROM video_progress vp JOIN profiles p ON p.id = vp.student_id
                WHERE p.role = 'student')::bigint AS seconds,
              (SELECT COUNT(*) FROM enquiries)::int AS enquiries`
    ),
  ]);
  const t = totals.rows[0];
  return {
    totals: { students: t.students, unassigned: t.unassigned, active7d: t.active_7d, watchSeconds: Number(t.seconds), enquiries: t.enquiries },
    courses: courses.rows,
    daily: daily.rows,
  };
}

/** Per-video funnel for one course: who started, who finished, average progress. */
export async function adminCourseVideoStats(courseId: string) {
  if (!isUuid(courseId)) return null;
  const r = await pool().query(
    `SELECT v.id, v.title, m.title AS module_title, m.is_mandatory, v.order_index, v.duration_seconds,
            COUNT(vp.id)::int AS started,
            COUNT(vp.id) FILTER (WHERE vp.is_completed)::int AS completed,
            COALESCE(AVG(vp.completion_percentage), 0)::float AS avg_pct
       FROM modules m
       LEFT JOIN course_modules cm ON cm.module_id = m.id AND cm.course_id = $1
       JOIN videos v ON v.module_id = m.id AND v.is_published AND v.archived_at IS NULL
       LEFT JOIN video_progress vp ON vp.video_id = v.id
            AND vp.student_id IN (SELECT id FROM profiles WHERE course_id = $1 AND role = 'student')
      WHERE m.is_mandatory OR cm.course_id IS NOT NULL
      GROUP BY v.id, m.title, m.is_mandatory, cm.order_index, v.order_index, v.duration_seconds, v.title
      ORDER BY m.is_mandatory DESC, cm.order_index NULLS LAST, v.order_index`,
    [courseId]
  );
  return r.rows;
}


// ==================== QUESTIONS (student asks, admin answers) ====================

export async function studentAskQuestion(studentId: string, question: string, videoId: string | null) {
  const r = await pool().query(
    `INSERT INTO student_questions (student_id, video_id, question) VALUES ($1,$2,$3) RETURNING id`,
    [studentId, videoId, question]
  );
  return r.rows[0].id as string;
}

export async function studentListQuestions(studentId: string) {
  const r = await pool().query(
    `SELECT q.id, q.question, q.answer, q.answered_at, q.created_at, v.title AS video_title, q.video_id
       FROM student_questions q LEFT JOIN videos v ON v.id = q.video_id
      WHERE q.student_id = $1 ORDER BY q.created_at DESC LIMIT 100`,
    [studentId]
  );
  return r.rows;
}

export async function adminListQuestions(filter: 'open' | 'answered' | 'all', studentId?: string) {
  const where: string[] = [];
  const vals: unknown[] = [];
  if (filter === 'open') where.push('q.answer IS NULL');
  if (filter === 'answered') where.push('q.answer IS NOT NULL');
  if (studentId && isUuid(studentId)) { vals.push(studentId); where.push(`q.student_id = $${vals.length}`); }
  const r = await pool().query(
    `SELECT q.id, q.question, q.answer, q.answered_at, q.created_at, q.student_id,
            p.full_name, p.phone, c.title AS course_title, v.title AS video_title
       FROM student_questions q
       JOIN profiles p ON p.id = q.student_id
       LEFT JOIN courses c ON c.id = p.course_id
       LEFT JOIN videos v ON v.id = q.video_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY (q.answer IS NULL) DESC, q.created_at DESC LIMIT 300`,
    vals
  );
  return r.rows;
}

export async function adminAnswerQuestion(id: string, answer: string) {
  if (!isUuid(id)) return false;
  const r = await pool().query(
    `UPDATE student_questions SET answer = $2, answered_at = NOW() WHERE id = $1`,
    [id, answer]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function adminDeleteQuestion(id: string) {
  if (!isUuid(id)) return false;
  const r = await pool().query(`DELETE FROM student_questions WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function adminOpenQuestionCount() {
  const r = await pool().query(`SELECT COUNT(*)::int AS n FROM student_questions WHERE answer IS NULL`);
  return r.rows[0].n as number;
}

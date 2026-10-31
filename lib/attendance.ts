import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/db';
import { isUuid } from '@/lib/lms';
import { LearningError, text } from '@/lib/learning-errors';
import { JOIN_EARLY_MINUTES } from '@/lib/attendance-policy';
export interface AttendanceRecord {
  class_id: string; status: 'unmarked' | 'pending' | 'present' | 'absent';
  join_clicked_at: string | null; last_join_clicked_at: string | null; join_click_count: number;
  requested_at: string | null; request_note: string; decided_at: string | null; request_pending: boolean;
}
export interface AttendanceHistory extends AttendanceRecord {
  title: string; course_title: string; module_title: string | null; starts_at: string; ends_at: string;
  is_cancelled: boolean; can_request: boolean;
}
export interface AttendanceStudent extends AttendanceRecord {
  student_id: string; full_name: string; phone: string; currently_enrolled: boolean; decision_note: string;
}
export interface AttendanceRoster {
  class: { id: string; title: string; starts_at: string; ends_at: string; is_cancelled: boolean; can_mark: boolean };
  students: AttendanceStudent[];
}
async function transaction<T>(fn: (db: PoolClient) => Promise<T>) {
  const db = await getPgPool().connect();
  try { await db.query('BEGIN'); const value = await fn(db); await db.query('COMMIT'); return value; }
  catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
const moduleScope = `(lc.module_id IS NULL OR (m.is_published AND (m.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.course_id=lc.course_id AND cm.module_id=m.id))))`;
const recordFields = `lc.id AS class_id,COALESCE(a.status,'unmarked') AS status,a.join_clicked_at,a.last_join_clicked_at,
  COALESCE(a.join_click_count,0)::int AS join_click_count,a.requested_at,COALESCE(a.request_note,'') AS request_note,a.decided_at,
  COALESCE(a.status<>'present' AND a.requested_at IS NOT NULL AND (a.decided_at IS NULL OR a.requested_at>a.decided_at),false) AS request_pending`;
async function access(db: PoolClient, classId: string, studentId: string, courseId: string | null | undefined) {
  if (!isUuid(classId) || !isUuid(studentId) || !isUuid(courseId)) throw new LearningError('Class not available.',404);
  const p = await db.query(`SELECT p.id FROM profiles p JOIN internship_applications ap ON ap.id=p.application_id
    WHERE p.id=$1 AND p.course_id=$2 AND p.role='student' AND ap.approval_status='approved' FOR SHARE OF p`,[studentId,courseId]);
  if (!p.rowCount) throw new LearningError('Class not available.',404);
  const lc = (await db.query(`SELECT lc.*,clock_timestamp() AS server_now FROM live_classes lc JOIN courses c ON c.id=lc.course_id
    LEFT JOIN modules m ON m.id=lc.module_id WHERE lc.id=$1 AND lc.course_id=$2 AND lc.is_published AND NOT lc.is_cancelled
    AND c.is_published AND ${moduleScope} FOR SHARE OF lc`,[classId,courseId])).rows[0];
  if (!lc) throw new LearningError('Class not available.',404);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`attendance:${classId}:${studentId}`]);
  return lc;
}
async function ownRecord(db: PoolClient,classId: string,studentId: string) {
  return (await db.query(`SELECT ${recordFields} FROM live_classes lc LEFT JOIN class_attendance a ON a.class_id=lc.id AND a.student_id=$2 WHERE lc.id=$1`,[classId,studentId])).rows[0] as AttendanceRecord;
}
export async function recordJoin(classId: string,studentId: string,courseId: string | null | undefined) {
  return transaction(async (db) => {
    const lc=await access(db,classId,studentId,courseId);
    const now: Date=(await db.query('SELECT clock_timestamp() AS now')).rows[0].now;
    if (+now < +lc.starts_at-JOIN_EARLY_MINUTES*60000) throw new LearningError('The join link opens 15 minutes before this class.',409);
    if (+now >= +lc.ends_at) throw new LearningError('This class has ended. You can request attendance if you joined elsewhere.',409);
    const existing=await ownRecord(db,classId,studentId);
    if(existing.last_join_clicked_at && +now-+new Date(existing.last_join_clicked_at)<30000) return {meet_url:lc.meet_url as string,attendance:existing};
    await db.query(`INSERT INTO class_attendance(class_id,student_id,join_clicked_at,last_join_clicked_at,join_click_count)
      VALUES($1,$2,$3,$3,1) ON CONFLICT(class_id,student_id) DO UPDATE SET
      join_clicked_at=COALESCE(class_attendance.join_clicked_at,EXCLUDED.join_clicked_at),last_join_clicked_at=EXCLUDED.last_join_clicked_at,
      join_click_count=LEAST(class_attendance.join_click_count+1,1000000)`,[classId,studentId,now]);
    await db.query("INSERT INTO class_attendance_events(class_id,student_id,event_type,actor_role) VALUES($1,$2,'join_clicked','student')",[classId,studentId]);
    return { meet_url: lc.meet_url as string, attendance: await ownRecord(db,classId,studentId) };
  });
}
export async function requestAttendance(classId: string,studentId: string,courseId: string | null | undefined,note: unknown) {
  const message=text(note,1000,'Attendance request');
  return transaction(async (db) => {
    const lc=await access(db,classId,studentId,courseId);
    const now: Date=(await db.query('SELECT clock_timestamp() AS now')).rows[0].now;
    if (+now < +lc.starts_at) throw new LearningError('Attendance can be requested after the class starts.',409);
    const existing=await ownRecord(db,classId,studentId);
    if(existing.status==='present') throw new LearningError('Your attendance is already approved.',409);
    if(existing.request_pending) return { attendance: existing };
    await db.query(`INSERT INTO class_attendance(class_id,student_id,requested_at,request_note) VALUES($1,$2,clock_timestamp(),$3)
      ON CONFLICT(class_id,student_id) DO UPDATE SET requested_at=EXCLUDED.requested_at,request_note=EXCLUDED.request_note`,[classId,studentId,message]);
    await db.query("INSERT INTO class_attendance_events(class_id,student_id,event_type,actor_role,note) VALUES($1,$2,'requested','student',$3)",[classId,studentId,message]);
    return { attendance: await ownRecord(db,classId,studentId) };
  });
}
export async function studentAttendance(studentId: string,courseId: string | null | undefined) {
  if(!isUuid(studentId)||!isUuid(courseId)) return [];
  return (await getPgPool().query(`SELECT ${recordFields},lc.title,c.title AS course_title,m.title AS module_title,
    lc.starts_at,lc.ends_at,lc.is_cancelled,
    (lc.is_published AND NOT lc.is_cancelled AND ${moduleScope} AND lc.starts_at<=clock_timestamp()
      AND COALESCE(a.status,'pending')<>'present' AND NOT COALESCE(a.requested_at IS NOT NULL AND (a.decided_at IS NULL OR a.requested_at>a.decided_at),false)) AS can_request
    FROM live_classes lc JOIN courses c ON c.id=lc.course_id LEFT JOIN modules m ON m.id=lc.module_id
    LEFT JOIN class_attendance a ON a.class_id=lc.id AND a.student_id=$1
    WHERE lc.course_id=$2 AND c.is_published AND EXISTS (SELECT 1 FROM profiles p JOIN internship_applications ap ON ap.id=p.application_id WHERE p.id=$1 AND p.course_id=$2 AND p.role='student' AND ap.approval_status='approved') AND ((lc.is_published AND ${moduleScope}) OR a.student_id IS NOT NULL)
    ORDER BY lc.starts_at DESC`,[studentId,courseId])).rows as AttendanceHistory[];
}
async function adminClass(db: PoolClient,classId: string) {
  if(!isUuid(classId)) throw new LearningError('Class not found.',404);
  const lc=(await db.query('SELECT *,clock_timestamp() AS server_now FROM live_classes WHERE id=$1 FOR SHARE',[classId])).rows[0];
  if(!lc) throw new LearningError('Class not found.',404);
  return lc;
}
export async function adminAttendance(classId: string): Promise<AttendanceRoster> {
  return transaction(async (db) => {
    const lc=await adminClass(db,classId);
    const students=(await db.query(`SELECT ${recordFields},p.id AS student_id,p.full_name,p.phone,
      COALESCE(p.course_id=lc.course_id AND ap.approval_status='approved',false) AS currently_enrolled,
      COALESCE((SELECT e.note FROM class_attendance_events e WHERE e.class_id=lc.id AND e.student_id=p.id AND e.actor_role='admin' ORDER BY e.created_at DESC,e.id DESC LIMIT 1),'') AS decision_note
      FROM live_classes lc JOIN profiles p ON p.role='student'
      LEFT JOIN internship_applications ap ON ap.id=p.application_id
      LEFT JOIN class_attendance a ON a.class_id=lc.id AND a.student_id=p.id
      WHERE lc.id=$1 AND ((p.course_id=lc.course_id AND ap.approval_status='approved') OR a.student_id IS NOT NULL)
      ORDER BY p.full_name,p.id`,[classId])).rows as AttendanceStudent[];
    return { class: { id:lc.id,title:lc.title,starts_at:lc.starts_at,ends_at:lc.ends_at,is_cancelled:lc.is_cancelled,can_mark:!lc.is_cancelled && +lc.server_now>=+lc.starts_at },students };
  });
}
export async function markAttendance(classId: string,studentIds: unknown,decision: unknown,note: unknown='') {
  if(!Array.isArray(studentIds)||!studentIds.length||studentIds.length>1000||!studentIds.every(isUuid)||new Set(studentIds).size!==studentIds.length) throw new LearningError('Select 1–1000 distinct students.');
  if(decision!=='present'&&decision!=='absent') throw new LearningError('Choose present or absent.');
  if(typeof note!=='string'||note.length>1000) throw new LearningError('Attendance note must be at most 1000 characters.');
  return transaction(async (db) => {
    const lc=await adminClass(db,classId);
    if(lc.is_cancelled||+lc.server_now<+lc.starts_at) throw new LearningError('Attendance can only be decided for a started, non-cancelled class.',409);
    const selected=[...studentIds].sort() as string[];
    for(const id of selected) await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`attendance:${classId}:${id}`]);
    const eligible=await db.query(`SELECT p.id FROM profiles p LEFT JOIN internship_applications ap ON ap.id=p.application_id
      WHERE p.id=ANY($1::uuid[]) AND p.role='student' AND ((p.course_id=$2 AND ap.approval_status='approved') OR EXISTS (
        SELECT 1 FROM class_attendance a WHERE a.class_id=$3 AND a.student_id=p.id)) FOR SHARE OF p`,[selected,lc.course_id,classId]);
    if(eligible.rowCount!==selected.length) throw new LearningError('Every selected student must be enrolled in this course or have an existing class record. No records were changed.',403);
    let updated=0;
    for(const id of selected) {
      const old=await ownRecord(db,classId,id);
      if(old.status===decision&&!old.request_pending) {
        if(!note.trim()) continue;
        const last=(await db.query("SELECT note FROM class_attendance_events WHERE class_id=$1 AND student_id=$2 AND event_type=$3 ORDER BY created_at DESC,id DESC LIMIT 1",[classId,id,`admin_${decision}`])).rows[0];
        if(last?.note===note.trim()) continue;
      }
      await db.query(`INSERT INTO class_attendance(class_id,student_id,status,decided_at) VALUES($1,$2,$3,clock_timestamp())
        ON CONFLICT(class_id,student_id) DO UPDATE SET status=EXCLUDED.status,decided_at=EXCLUDED.decided_at`,[classId,id,decision]);
      await db.query('INSERT INTO class_attendance_events(class_id,student_id,event_type,actor_role,note) VALUES($1,$2,$3,\'admin\',$4)',[classId,id,`admin_${decision}`,note.trim()]);
      updated++;
    }
    return { updated,selected:selected.length };
  });
}
export async function adminStudentAttendance(studentId: string) {
  if(!isUuid(studentId)) throw new LearningError('Invalid student.',404);
  return (await getPgPool().query(`SELECT ${recordFields},lc.title,lc.starts_at,lc.ends_at,lc.is_cancelled,false AS can_request,c.title AS course_title,m.title AS module_title
    FROM class_attendance a JOIN live_classes lc ON lc.id=a.class_id JOIN courses c ON c.id=lc.course_id LEFT JOIN modules m ON m.id=lc.module_id
    WHERE a.student_id=$1 ORDER BY lc.starts_at DESC`,[studentId])).rows as AttendanceHistory[];
}

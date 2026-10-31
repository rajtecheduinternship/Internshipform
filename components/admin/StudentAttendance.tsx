'use client';
import { useEffect,useState } from 'react';
import { api } from './api';
import EditorDrawer from './EditorDrawer';
import ClassAttendance from './ClassAttendance';
import { useAdminNavigation } from './UnsavedChanges';
import { useCopy } from '@/components/help/i18n';
import { classTime } from '@/lib/class-calendar';
import AttendanceStatus from '@/components/classes/AttendanceStatus';
import type { AttendanceHistory } from '@/lib/attendance';
export default function StudentAttendance({studentId}:{studentId:string}){
  const t=useCopy();const {canLeave}=useAdminNavigation();const [rows,setRows]=useState<AttendanceHistory[]>([]);const [error,setError]=useState('');const [selected,setSelected]=useState<string|null>(null);
  const load=()=>api<{attendance:AttendanceHistory[]}>(`/api/admin/students/${studentId}/attendance`).then((d)=>setRows(d.attendance));
  useEffect(()=>{void load().catch((e)=>setError(e.message));},[studentId]); // eslint-disable-line react-hooks/exhaustive-deps
  return <section className="space-y-3"><h2 className="ui-h2">{t('Class attendance','कक्षा उपस्थिति')}</h2>{error&&<p role="alert">{error}</p>}{!rows.length&&<p>{t('No attendance activity recorded yet. Manage a class roster to add manual attendance.','अभी उपस्थिति गतिविधि दर्ज नहीं है। मैन्युअल उपस्थिति के लिए कक्षा सूची खोलें।')}</p>}{rows.map((r)=><article key={r.class_id} className="ui-card ui-card-pad space-y-2"><h3 className="font-semibold">{r.title}</h3><p>{classTime(r.starts_at)} IST</p><AttendanceStatus record={r}/><button className="ui-btn" onClick={()=>setSelected(r.class_id)}>{t('Manage this class attendance','इस कक्षा की उपस्थिति सँभालें')}</button></article>)}{selected&&<EditorDrawer title={t('Class attendance','कक्षा उपस्थिति')} onClose={()=>{if(canLeave()){setSelected(null);void load().catch((e)=>setError(e.message));}}}><ClassAttendance classId={selected}/></EditorDrawer>}</section>;
}

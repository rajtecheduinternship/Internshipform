'use client';
import { useCallback,useEffect,useState } from 'react';
import { api } from './api';
import { useAdminDraft } from './UnsavedChanges';
import { useCopy } from '@/components/help/i18n';
import { classTime } from '@/lib/class-calendar';
import AttendanceStatus from '@/components/classes/AttendanceStatus';
import type { AttendanceRoster,AttendanceStudent } from '@/lib/attendance';
export default function ClassAttendance({classId}:{classId:string}){
  const t=useCopy();const [data,setData]=useState<AttendanceRoster|null>(null);const [error,setError]=useState('');const [message,setMessage]=useState('');
  const [selected,setSelected]=useState<string[]>([]);const [filter,setFilter]=useState('all');const [query,setQuery]=useState('');const [note,setNote]=useState('');const [busy,setBusy]=useState(false);
  const canLeave=useAdminDraft(!!note.trim(),busy);
  const load=useCallback(async()=>{setData(await api<AttendanceRoster>(`/api/admin/classes/${classId}/attendance`));},[classId]);
  useEffect(()=>{void load().catch((e)=>setError(e.message));},[load]);
  const shown=(data?.students||[]).filter((s)=>`${s.full_name} ${s.phone}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())&&(filter==='all'||(filter==='review'?s.status==='pending'||s.request_pending:filter==='clicked'?!!s.join_clicked_at:filter==='requested'?s.request_pending:s.status===filter)));
  function changeFilter(value:string){setFilter(value);setSelected([]);}
  async function mark(status:'present'|'absent',ids:string[]){
    if(!ids.length||ids.length>1000)return;
    if(!window.confirm(t(`Mark ${ids.length} selected student(s) ${status} for ${data?.class.title}? A link click alone is not proof of attendance.`,`${data?.class.title} के ${ids.length} चयनित छात्रों की उपस्थिति ${status==='present'?'उपस्थित':'अनुपस्थित'} दर्ज करें? केवल लिंक खोलना उपस्थिति का प्रमाण नहीं है।`)))return;
    setBusy(true);setError('');setMessage('');
    try{const result=await api<{updated:number}>(`/api/admin/classes/${classId}/attendance`,'PATCH',{student_ids:ids,status,note});setSelected([]);setNote('');await load();setMessage(t(`${result.updated} attendance record(s) updated.`,`${result.updated} उपस्थिति रिकॉर्ड बदले गए।`));}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const toggle=(s:AttendanceStudent,checked:boolean)=>setSelected((ids)=>checked?[...ids,s.student_id]:ids.filter((id)=>id!==s.student_id));
  return <div className="space-y-4">
    <p>{t('Join clicks and student requests are evidence only. Only your approval marks a student present. You can also mark students who joined outside the app.','लिंक क्लिक और छात्रों के अनुरोध केवल संकेत हैं। आपकी मंज़ूरी से ही छात्र उपस्थित माना जाएगा। ऐप के बाहर से जुड़े छात्रों की उपस्थिति भी दर्ज कर सकते हैं।')}</p>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    <button className="ui-btn" disabled={busy} onClick={()=>{if(canLeave()){void load().then(()=>setError('')).catch((e)=>setError(e.message));setSelected([]);setNote('');}}}>{t('Refresh attendance','उपस्थिति फिर लोड करें')}</button>
    {!data?<p role="status">{t('Loading roster…','छात्र सूची लोड हो रही है…')}</p>:<>
      <h3 className="ui-h2">{data.class.title}</h3><p>{classTime(data.class.starts_at)} IST</p>
      {!data.class.can_mark&&<p role="status">{t('This class has not started or is cancelled. Attendance decisions are disabled.','यह कक्षा शुरू नहीं हुई है या रद्द है। उपस्थिति निर्णय अभी बंद हैं।')}</p>}
      <p>{data.students.filter((s)=>s.status==='present').length}/{data.students.length} {t('approved present','उपस्थित स्वीकृत')}</p>
      <div className="admin-filter-grid"><label>{t('Find student','छात्र खोजें')}<input className="ui-field" value={query} onChange={(e)=>{setQuery(e.target.value);setSelected([]);}}/></label><label>{t('Attendance filter','उपस्थिति फ़िल्टर')}<select className="ui-field" value={filter} onChange={(e)=>changeFilter(e.target.value)}><option value="all">{t('All students','सभी छात्र')}</option><option value="review">{t('Needs review','समीक्षा बाकी')}</option><option value="clicked">{t('Join link opened','जुड़ने का लिंक खोला')}</option><option value="requested">{t('Attendance requested','उपस्थिति अनुरोध')}</option><option value="present">{t('Approved present','उपस्थित स्वीकृत')}</option><option value="absent">{t('Marked absent','अनुपस्थित दर्ज')}</option></select></label></div>
      <fieldset disabled={busy} className="space-y-3">
        <label className="flex gap-2 items-center"><input type="checkbox" checked={shown.length>0&&shown.every((s)=>selected.includes(s.student_id))} onChange={(e)=>setSelected(e.target.checked?shown.map((s)=>s.student_id):[])}/>{t('Select all students in this filtered list','इस फ़िल्टर सूची के सभी छात्र चुनें')} ({shown.length})</label>
        <p>{selected.length} {t('selected (maximum 1000 per batch)','चयनित (एक बार में अधिकतम 1000)')}</p>
        <label className="block">{t('Admin decision note (optional, internal)','एडमिन निर्णय टिप्पणी (वैकल्पिक, निजी)')}<textarea aria-label={t('Admin decision note (optional, internal)', 'एडमिन निर्णय टिप्पणी (वैकल्पिक, निजी)')} className="ui-field" maxLength={1000} value={note} onChange={(e)=>setNote(e.target.value)}/></label>
        <div className="flex flex-wrap gap-2"><button className="ui-btn ui-btn-primary" disabled={!data.class.can_mark||!selected.length||selected.length>1000} onClick={()=>mark('present',selected)}>{t('Approve selected as present','चयनित छात्रों को उपस्थित मंज़ूर करें')}</button><button className="ui-btn" disabled={!data.class.can_mark||!selected.length||selected.length>1000} onClick={()=>mark('absent',selected)}>{t('Mark selected absent','चयनित छात्रों को अनुपस्थित दर्ज करें')}</button></div>
        {!shown.length&&<p>{t('No students match.','कोई छात्र नहीं मिला।')}</p>}
        {shown.map((s)=><article key={s.student_id} className="ui-card ui-card-pad space-y-2"><label className="flex gap-2 font-semibold"><input type="checkbox" aria-label={t(`Select ${s.full_name}`,`${s.full_name} चुनें`)} checked={selected.includes(s.student_id)} onChange={(e)=>toggle(s,e.target.checked)}/>{s.full_name}</label><p className="ui-muted">{s.phone}{!s.currently_enrolled?` · ${t('Historical enrollment record','पुराना प्रवेश रिकॉर्ड')}`:''}</p><AttendanceStatus record={s}/>
          {s.join_clicked_at?<><p>{t('First app join click','ऐप में पहला जुड़ने का क्लिक')}: {classTime(s.join_clicked_at)} IST</p><p>{t('Last click / count','आखिरी क्लिक / संख्या')}: {classTime(s.last_join_clicked_at||s.join_clicked_at)} IST · {s.join_click_count}</p></>:<p>{t('No app join recorded · may have joined using an external link','ऐप से जुड़ने का रिकॉर्ड नहीं · बाहरी लिंक से जुड़े हो सकते हैं')}</p>}
          {s.decided_at&&<p>{t('Last admin decision','आखिरी एडमिन निर्णय')}: {classTime(s.decided_at)} IST</p>}{s.decision_note&&<p className="whitespace-pre-wrap">{t('Admin note (internal)','एडमिन टिप्पणी (निजी)')}: {s.decision_note}</p>}
          {s.requested_at&&<div><p>{t('Student request','छात्र अनुरोध')}: {classTime(s.requested_at)} IST</p><p className="whitespace-pre-wrap">{s.request_note}</p></div>}
          <div className="flex flex-wrap gap-2"><button className="ui-btn ui-btn-sm" disabled={!data.class.can_mark} onClick={()=>mark('present',[s.student_id])}>{t('Approve present','उपस्थित मंज़ूर करें')}</button><button className="ui-btn ui-btn-sm" disabled={!data.class.can_mark} onClick={()=>mark('absent',[s.student_id])}>{t('Mark absent','अनुपस्थित दर्ज करें')}</button></div>
        </article>)}
      </fieldset>
    </>}
  </div>;
}

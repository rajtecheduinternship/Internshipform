'use client';
import { createContext,useContext,useCallback,useEffect,useRef,useState } from 'react';
import { useCopy } from '@/components/help/i18n';
import { classTime } from '@/lib/class-calendar';
import { joinWindow } from '@/lib/attendance-policy';
import type { AttendanceHistory,AttendanceRecord } from '@/lib/attendance';
import type { LiveClass } from '@/lib/live-classes';
import AttendanceStatus from './AttendanceStatus';
const Context=createContext<ReturnType<typeof useAttendance>|null>(null);
export function AttendanceProvider({children}:{children:React.ReactNode}){const data=useAttendance();return <Context.Provider value={data}>{children}</Context.Provider>;}
const changed=()=>window.dispatchEvent(new Event('class-attendance-changed'));
export function JoinClass({ item,now }: {item:LiveClass;now:number}) {
  const t=useCopy();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [fallback,setFallback]=useState(''); const [local,setLocal]=useState<AttendanceRecord>(); const context=useContext(Context); const row=context?.records.find((r)=>r.class_id===item.id); const stamp=(r?:AttendanceRecord)=>Math.max(0,...[r?.decided_at,r?.requested_at,r?.last_join_clicked_at].map((v)=>v?+new Date(v):0)); const record=local&&stamp(local)>stamp(row)?local:row||local;
  async function join(){
    const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
    setBusy(true);setError('');
    try{
      const r=await fetch(`/api/portal/classes/${item.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to record join');
      // The URL is server-validated; a click is evidence only, never automatic presence.
      setLocal(d.attendance);changed();if(popup)popup.location.href=d.meet_url;else setFallback(d.meet_url);
    }catch(e){popup?.close();setError((e as Error).message);}finally{setBusy(false);}
  }
  const available=joinWindow(item.starts_at,item.ends_at,now)&&!item.is_cancelled;
  return <div className="space-y-2"><AttendanceStatus record={record}/><button type="button" className="ui-btn ui-btn-primary" disabled={!available||busy} onClick={join}>{busy?t('Recording join…','जुड़ना दर्ज हो रहा है…'):t('Join Google Meet','Google Meet से जुड़ें')} ↗</button>{!available&&+new Date(item.ends_at)>now&&<p className="ui-muted">{t('The link opens 15 minutes before class.','कक्षा से 15 मिनट पहले लिंक खुलेगा।')}</p>}{fallback&&<a className="ui-link" href={fallback} target="_blank" rel="noopener noreferrer">{t('Popup blocked? Open the recorded Meet link','पॉपअप रुका? दर्ज किया गया Meet लिंक खोलें')} ↗</a>}{error&&<p role="alert">{error}</p>}<AttendanceRequest classId={item.id} record={record} allowed={!!row?.can_request}/></div>;
}
export function AttendanceRequest({ classId,record,allowed }: {classId:string;record?:AttendanceRecord;allowed:boolean}) {
  const t=useCopy();const [open,setOpen]=useState(false);const [note,setNote]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  if(record?.status==='present'||record?.request_pending||!allowed)return null;
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
    const r=await fetch(`/api/portal/classes/${classId}/attendance-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({note})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');setOpen(false);setNote('');changed();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="space-y-2">{!open?<button className="ui-btn ui-btn-sm" onClick={()=>setOpen(true)}>{t('Request attendance','उपस्थिति का अनुरोध करें')}</button>:<form onSubmit={submit} className="space-y-2"><label className="block">{t('How did you join this class?','आप इस कक्षा में कैसे जुड़े?')}<textarea aria-label={t('How did you join this class?', 'आप इस कक्षा में कैसे जुड़े?')} required maxLength={1000} className="ui-field" value={note} disabled={busy} onChange={(e)=>setNote(e.target.value)} placeholder={t('For example: I joined using the WhatsApp link.','जैसे: मैं WhatsApp लिंक से जुड़ा था।')}/></label><p className="ui-muted">{t('This request does not mark you present. Your teacher will review it.','इस अनुरोध से आप उपस्थित नहीं माने जाएँगे। शिक्षक इसकी समीक्षा करेंगे।')}</p>{error&&<p role="alert">{error}</p>}<div className="flex flex-wrap gap-2"><button className="ui-btn ui-btn-primary" disabled={busy||!note.trim()}>{t('Send attendance request','उपस्थिति अनुरोध भेजें')}</button><button type="button" className="ui-btn" disabled={busy} onClick={()=>setOpen(false)}>{t('Cancel','रद्द करें')}</button></div></form>}</div>;
}
export function useAttendance(enabled=true){
  const sequence=useRef(0);
  const [records,setRecords]=useState<AttendanceHistory[]>([]);const [error,setError]=useState(false);const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{const current=++sequence.current;try{const r=await fetch('/api/portal/attendance',{cache:'no-store'});if(!r.ok)throw new Error('attendance');const d=await r.json();if(current===sequence.current){setRecords(d.attendance||[]);setError(false);}}catch{if(current===sequence.current)setError(true);}finally{if(current===sequence.current)setLoading(false);}},[]);
  useEffect(()=>{if(!enabled)return;void load();const timer=setInterval(()=>{void load();},60000);window.addEventListener('focus',load);window.addEventListener('class-attendance-changed',load);return()=>{clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('class-attendance-changed',load);};},[enabled,load]);
  return {records,error,loading,load};
}
export default function StudentAttendance({enabled=true}:{enabled?:boolean}){
  const t=useCopy();const context=useContext(Context);const fetched=useAttendance(enabled&&!context);const data=context||fetched;
  return <section className="ui-card ui-card-pad space-y-4"><h2 className="ui-h2">{t('My class attendance','मेरी कक्षा की उपस्थिति')}</h2><p>{t('Only admin-approved records count as attended. Opening a link is not proof of attendance.','केवल एडमिन द्वारा स्वीकृत रिकॉर्ड उपस्थित माने जाते हैं। लिंक खोलना उपस्थिति का प्रमाण नहीं है।')}</p>{data.loading?<p role="status">{t('Loading attendance…','उपस्थिति लोड हो रही है…')}</p>:data.error?<p role="alert">{t('Attendance could not load.','उपस्थिति नहीं खुली।')} <button className="ui-link" onClick={data.load}>{t('Retry','फिर कोशिश करें')}</button></p>:<><p className="font-semibold">{data.records.filter((r)=>r.status==='present').length} {t('classes approved as attended','कक्षाओं में उपस्थिति स्वीकृत')}</p>{!data.records.length&&<p>{t('No class records yet.','अभी कोई कक्षा रिकॉर्ड नहीं है।')}</p>}{data.records.map((r)=><article key={r.class_id} className="border-t pt-3 space-y-2"><h3 className="font-semibold">{r.title}</h3><p className="ui-muted">{classTime(r.starts_at)} IST</p><AttendanceStatus record={r}/>{r.is_cancelled&&<p>{t('Class cancelled','कक्षा रद्द')}</p>}<AttendanceRequest classId={r.class_id} record={r} allowed={r.can_request}/></article>)}</>}</section>;
}

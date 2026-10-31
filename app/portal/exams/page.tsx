'use client';
import StudentNavbar from '@/components/layout/StudentNavbar';
import PortalFooter from '@/components/layout/PortalFooter';
import ExamLinks from '@/components/exams/ExamLinks';
import { useStudent } from '@/hooks/useStudent';
import { useExams } from '@/hooks/useExams';
import { useCopy } from '@/components/help/i18n';
export default function ExamsPage() {
  const student = useStudent(); const t = useCopy(); const { exams, loading, error, reload } = useExams(!!student);
  return <div className="ui-page student-page"><StudentNavbar /><main id="main-content" className="portal-main space-y-5"><h1 className="ui-h1">{t('My module examinations', 'मेरी मॉड्यूल परीक्षाएँ')}</h1><p>{t('Only examinations published for your course appear here. Open an exam to view the rules before starting your timer.', 'यहाँ केवल आपके कोर्स के लिए प्रकाशित परीक्षाएँ दिखती हैं। समय शुरू करने से पहले नियम देखने के लिए परीक्षा खोलें।')}</p>{loading ? <p role="status">{t('Loading…', 'लोड हो रहा है…')}</p> : error ? <p role="alert">{t('Examinations could not load.', 'परीक्षाएँ नहीं खुलीं।')} <button className="ui-link" onClick={reload}>{t('Retry', 'फिर कोशिश करें')}</button></p> : !exams.length ? <p>{t('No examinations have been published yet.', 'अभी कोई परीक्षा प्रकाशित नहीं हुई है।')}</p> : <ExamLinks exams={exams} />}</main><PortalFooter /></div>;
}

'use client';
import { useExams } from '@/hooks/useExams';
import { useCopy } from '@/components/help/i18n';
import ExamLinks from './ExamLinks';
export default function StudentExamRecord({ enabled }: { enabled: boolean }) {
  const t = useCopy(); const data = useExams(enabled);
  const appeared = data.exams.filter((e) => e.attempt_status && e.attempt_status !== 'not_started');
  return <section className="ui-card ui-card-pad space-y-3"><h2 className="ui-h2">{t('My exam participation & results', 'मेरी परीक्षा उपस्थिति और परिणाम')}</h2>{data.loading ? <p>{t('Loading exams…', 'परीक्षाएँ लोड हो रही हैं…')}</p> : data.error ? <p role="alert">{t('Exam records could not load.', 'परीक्षा रिकॉर्ड नहीं खुले।')} <button className="ui-link" onClick={data.reload}>{t('Retry', 'फिर कोशिश करें')}</button></p> : !appeared.length ? <p>{t('You have not attempted an exam yet.', 'आपने अभी किसी परीक्षा का प्रयास नहीं किया है।')}</p> : <ExamLinks exams={appeared} />}</section>;
}

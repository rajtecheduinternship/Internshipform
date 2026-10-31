'use client';
import { useCopy } from '@/components/help/i18n';
import type { ExamSummary, PublicAttempt } from '@/lib/exams';
export default function ExamStatus({ status, publishedAt, percent, passed }: { status: ExamSummary['attempt_status']; publishedAt?: string | null; percent?: number | null; passed?: boolean | null }) {
  const t = useCopy();
  if (status === 'in_progress') return <p>{t('Exam in progress', 'परीक्षा जारी है')}</p>;
  if (status !== 'submitted') return null;
  return <p>{publishedAt ? `${t('Appeared · Result published', 'परीक्षा दी · परिणाम प्रकाशित')} · ${percent}% · ${passed ? t('Passed', 'उत्तीर्ण') : t('Not passed', 'अनुत्तीर्ण')}` : t('Appeared · Submitted · Result awaiting publication', 'परीक्षा दी · जमा की · परिणाम प्रकाशित होना बाकी है')}</p>;
}
export function SubmittedResult({ attempt }: { attempt: PublicAttempt }) {
  const t = useCopy();
  return <>
    {attempt.result_published_at ? <><h3 className="font-semibold">{t('Result published', 'परिणाम प्रकाशित')}</h3><p>{attempt.correct_count}/{attempt.questions.length} · {attempt.score_percent}% · {attempt.passed ? t('Passed', 'उत्तीर्ण') : t('Not passed', 'अनुत्तीर्ण')}</p></> : <p>{t('You appeared in this exam. Your answers are saved. Your result is awaiting publication by your teacher.', 'आपने यह परीक्षा दी है। आपके उत्तर सेव हैं। शिक्षक द्वारा परिणाम प्रकाशित किया जाना बाकी है।')}</p>}
    <p>{t('Your teacher can review your answers and calculation. Marks appear only after publication. A new exam is needed for another attempt.', 'शिक्षक आपके उत्तर और गणना की समीक्षा कर सकते हैं। प्रकाशित होने के बाद ही अंक दिखेंगे। दोबारा प्रयास के लिए नई परीक्षा चाहिए।')}</p>
  </>;
}

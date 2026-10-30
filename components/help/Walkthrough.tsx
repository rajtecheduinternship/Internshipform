'use client';

import { useCallback, useState } from 'react';
import { LangToggle, useLang } from './i18n';
import { useDialogFocus } from '@/components/ui';
import { Icon } from '@/components/icons';

type Step = { title: { en: string; hi: string }; body: { en: string; hi: string } };

// Hindi is written in simple, spoken Hindi with the common English words people actually use
// (course, video, password, login) so it reads naturally to students.
const STUDENT_STEPS: Step[] = [
  { title: { en: 'Welcome to your student portal', hi: 'आपके Student Portal में स्वागत है' },
    body: { en: 'Here you watch your lectures, track your progress and ask questions. This short tour takes one minute.',
            hi: 'यहाँ आप अपने lectures देख सकते हैं, अपनी progress देख सकते हैं और सवाल पूछ सकते हैं। यह छोटा सा tour सिर्फ़ एक मिनट का है।' } },
  { title: { en: 'My learning', hi: 'मेरी पढ़ाई' },
    body: { en: 'Open “My learning” to see every module and lecture. The green button at the top takes you to the next lecture to watch.',
            hi: '“My learning” खोलिए, वहाँ आपके सारे modules और lectures दिखेंगे। ऊपर का हरा button आपको अगला lecture देखने ले जाएगा।' } },
  { title: { en: 'Watch the lecture properly', hi: 'Lecture ध्यान से पूरा देखिए' },
    body: { en: 'A lecture is marked “Completed” only after you watch the required part. Skipping ahead does not count, so please watch it fully.',
            hi: 'Lecture “Completed” तभी होगा जब आप ज़रूरी हिस्सा देख लेंगे। आगे skip करने से progress नहीं बढ़ती, इसलिए पूरा देखिए।' } },
  { title: { en: 'Have a doubt? Ask here', hi: 'कोई doubt है? यहाँ पूछिए' },
    body: { en: 'Below every lecture there is an “Ask a question” box. Type your doubt in Hindi or English. The teacher’s answer will appear in the same place.',
            hi: 'हर lecture के नीचे “Ask a question” का box है। अपना doubt Hindi या English में लिखिए। टीचर का जवाब उसी जगह दिखेगा।' } },
  { title: { en: 'Check your progress', hi: 'अपनी progress देखिए' },
    body: { en: 'The “My progress” page shows how many lectures you finished and your total watch time.',
            hi: '“My progress” page पर आप देख सकते हैं कि कितने lectures पूरे हुए और कुल कितना समय देखा।' } },
  { title: { en: 'Keep your account safe', hi: 'अपना account सुरक्षित रखिए' },
    body: { en: 'Your first password is your roll number. Go to “My account” and set your own password. Do not share it with anyone.',
            hi: 'आपका पहला password आपका roll number है। “My account” में जाकर अपना नया password बना लीजिए। इसे किसी को मत बताइए।' } },
];

const ADMIN_STEPS: Step[] = [
  { title: { en: 'Admin tour', hi: 'Admin का tour' },
    body: { en: 'A quick look at the main parts of this dashboard.', hi: 'इस dashboard के मुख्य हिस्सों की एक छोटी सी झलक।' } },
  { title: { en: 'Overview', hi: 'Overview' },
    body: { en: 'See totals first. Click a course to see which lectures students finish and where they stop. Click “View students” to go deeper.',
            hi: 'पहले कुल आँकड़े दिखते हैं। किसी course पर click करके देखिए कि कौन से lecture students पूरे करते हैं और कहाँ रुक जाते हैं। और गहराई में जाने के लिए “View students” दबाइए।' } },
  { title: { en: 'Courses and modules', hi: 'Courses और modules' },
    body: { en: 'A course has modules, a module has videos. To add a video: open the Module library, click “Edit & videos”, then add it.',
            hi: 'एक course में modules होते हैं और एक module में videos। Video जोड़ने के लिए: Module library खोलिए, “Edit & videos” दबाइए, फिर video add कीजिए।' } },
  { title: { en: 'Common modules', hi: 'Common modules (सबके लिए)' },
    body: { en: 'Tick “Common to all courses” on a module and every student gets it automatically. You do not need to add it to each course.',
            hi: 'किसी module पर “Common to all courses” पर tick कर दीजिए, तो वह हर student को अपने-आप मिल जाएगा। हर course में अलग से जोड़ने की ज़रूरत नहीं।' } },
  { title: { en: 'Students', hi: 'Students' },
    body: { en: 'Pick a course on the left, filter by status, and click a student to see every lecture they watched. You can also change their course here.',
            hi: 'बाईं तरफ़ से course चुनिए, status से filter कीजिए, और किसी student पर click करके देखिए उसने कौन-कौन से lecture देखे। यहीं से उसका course भी बदल सकते हैं।' } },
  { title: { en: 'Questions', hi: 'Questions (सवाल)' },
    body: { en: 'Students’ doubts arrive in the Questions tab. Type an answer and press “Send answer”; the student sees it on their lecture page.',
            hi: 'Students के doubts “Questions” tab में आते हैं। जवाब लिखकर “Send answer” दबाइए; student को वह उसके lecture page पर दिखेगा।' } },
];

export default function Walkthrough({ kind, storageKey, label }: { kind: 'student' | 'admin'; storageKey: string; label?: { en: string; hi: string } }) {
  const { lang } = useLang();
  const steps = kind === 'student' ? STUDENT_STEPS : ADMIN_STEPS;
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
  }, [storageKey]);

  const dialogRef = useDialogFocus(open, close);

  const s = steps[i];
  const last = i === steps.length - 1;
  const t = (x: { en: string; hi: string }) => x[lang];

  return (
    <>
      <button type="button" className="ui-btn ui-btn-sm guide-button" onClick={() => { setI(0); setOpen(true); }}>
        <Icon name="help" size={16} />{label ? t(label) : lang === 'hi' ? 'कैसे इस्तेमाल करें' : 'Quick guide'}
      </button>
      {open && (
        <div className="ui-overlay" onClick={close}>
          <div ref={dialogRef} tabIndex={-1} className="ui-modal" role="dialog" aria-modal="true" aria-label={lang === 'hi' ? 'इस्तेमाल करने की गाइड' : 'Quick guide'} style={{ maxWidth: '30rem' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <span className="ui-eyebrow tnum">{i + 1} / {steps.length}</span>
              <LangToggle />
            </div>
            <h2 className="ui-h1" style={{ marginTop: 12, fontSize: '1.25rem' }}>{t(s.title)}</h2>
            <span className="ui-accent-bar" />
            <p style={{ marginTop: 12, lineHeight: 1.75, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>{t(s.body)}</p>
            <div className="mt-4 flex gap-1" aria-hidden>
              {steps.map((_, n) => <span key={n} style={{ height: 4, flex: 1, borderRadius: 2, background: n <= i ? 'var(--brand)' : 'var(--line)' }} />)}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button className="ui-link" onClick={close}>{lang === 'hi' ? 'छोड़ें' : 'Skip'}</button>
              <div className="flex gap-2">
                {i > 0 && <button className="ui-btn" onClick={() => setI(i - 1)}>{lang === 'hi' ? 'पीछे' : 'Back'}</button>}
                <button className="ui-btn ui-btn-primary" onClick={() => (last ? close() : setI(i + 1))}>
                  {last ? (lang === 'hi' ? 'समझ गया' : 'Got it') : lang === 'hi' ? 'आगे' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

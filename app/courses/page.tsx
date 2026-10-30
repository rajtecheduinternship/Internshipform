'use client';

import Link from 'next/link';
import { useCopy, useLang } from '@/components/help/i18n';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui';
import PublicNavbar from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';
import NewsTicker from '@/components/layout/NewsTicker';

export default function CoursesPage() {
  const t = useCopy();
  const { lang } = useLang();
  const tracks = [
    {
      id: 'office-skills',
      title: 'Master Modern Office Skills',
      duration: '4 Weeks / 60 Hours',
      level: 'All Streams (B.A., B.Sc., B.Com.)',
      description: 'Create documents, work with spreadsheets, make presentations, and collaborate with your team online.',
      syllabus: [
        'Module 1: Microsoft Word & Advanced Document Publishing (Styles, Indexes, Mail Merge)',
        'Module 2: Advanced Microsoft Excel (Formulas, Pivot Tables, Charts, Data Cleaning)',
        'Module 3: Impactful Presentation Design in PowerPoint & Google Slides',
        'Module 4: Google Workspace (Drive, Docs, Sheets, Forms, Calendar & Meet)',
        'Module 5: Professional Business Email Etiquette & Corporate File Handling',
      ],
      topics: ['MS Word', 'Excel', 'PowerPoint', 'Google Suite', 'Email Writing'],
    },
    {
      id: 'basic-it-digital',
      title: 'Basic IT and Digital Skill',
      duration: '4 Weeks / 60 Hours',
      level: 'Computer basics',
      description: 'Learn computer basics, browse safely, manage files, and use everyday digital services.',
      syllabus: [
        'Module 1: Computer Hardware, Architecture, OS Basics (Windows / Linux)',
        'Module 2: Internet, Web Browsing Safety, Cyber Threats, Antivirus & Passwords',
        'Module 3: Cloud Storage Management, File Compression (ZIP), PDF Manipulation',
        'Module 4: Digital Banking, UPI Safety, DigiLocker & Government Portal Services',
        'Module 5: Introduction to Social Media Management & Digital Marketing Tools',
      ],
      topics: ['OS Navigation', 'Cyber Safety', 'Cloud Storage', 'Digital Banking', 'DigiLocker'],
    },
    {
      id: 'basic-it-ai',
      title: 'Basic IT and Artificial Intelligence (AI)',
      duration: '4 Weeks / 60 Hours',
      level: 'AI tools for everyday work',
      description: 'Give AI tools clear instructions and use them to help with research, documents, images, and routine tasks.',
      syllabus: [
        'Module 1: Introduction to Generative AI, LLMs & Core AI Concepts',
        'Module 2: Prompt Engineering: Crafting clear instructions for ChatGPT & Claude',
        'Module 3: AI for Academic Research, Summarization, and Document Analysis',
        'Module 4: AI Image Generation & Visual Content Creation for Business',
        'Module 5: Automating Repetitive Office Tasks and Ethical AI Usage Guidelines',
      ],
      topics: ['Prompt Engineering', 'ChatGPT / Claude', 'AI Research', 'Automation', 'Ethics'],
    },
    {
      id: 'tally-gst',
      title: 'Basic IT and Tally Prime with GST',
      duration: '4 Weeks / 60 Hours',
      level: 'Commerce & Accounting Focus',
      description: 'Learn accounts, business entries, GST invoices, and reports using Tally Prime.',
      syllabus: [
        'Module 1: Accounting Fundamentals & Company Creation in Tally Prime',
        'Module 2: Ledger Configuration, Groups & Inventory Item Master Data',
        'Module 3: Voucher Entry: Payment, Receipt, Sales, Purchase & Journal',
        'Module 4: GST Configuration (CGST, SGST, IGST), Invoicing & E-Way Bill Basics',
        'Module 5: Balance Sheet Generation, Profit & Loss Statements, Bank Reconciliation',
      ],
      topics: ['Tally Prime', 'GST Invoicing', 'Ledgers', 'Balance Sheets', 'Bank Reconciliation'],
    },
    {
      id: 'office-management',
      title: 'Basic IT with Office Management',
      duration: '4 Weeks / 60 Hours',
      level: 'Everyday office work',
      description: 'Organise meetings, track tasks, manage records, and communicate clearly at work.',
      syllabus: [
        'Module 1: Modern Office Administrative Roles & Workflow Optimization',
        'Module 2: Meeting Scheduling, Agendas & Writing Actionable Minutes (MoM)',
        'Module 3: Task & Project Management Systems (Notion, Trello, Asana)',
        'Module 4: Records Management: Digital Archiving, Security & Data Backup',
        'Module 5: Client Communication, Conflict Resolution & Team Leadership',
      ],
      topics: ['Office Admin', 'Minute Taking', 'Task Boards', 'Archiving', 'Team Coordination'],
    },
    {
      id: 'printing-accounting',
      title: 'Basic IT and Printing / Accounting',
      duration: '4 Weeks / 60 Hours',
      level: 'Printing & practical projects',
      description: 'Create print layouts, scan documents, design receipts, and keep simple business records.',
      syllabus: [
        'Module 1: Printing Hardware, DPI & Page Layout Dimensions (A4, A3, Legal)',
        'Module 2: Designing Commercial Forms, Letterheads, Receipts & Badges',
        'Module 3: High-Resolution Document Scanning & OCR Text Extraction',
        'Module 4: Daily Cash Book Management, Billing & Expense Recording',
        'Module 5: Final Project: Publishing an End-to-End Business Stationery Kit',
      ],
      topics: ['DTP Layouts', 'DPI Standards', 'OCR Scanning', 'Cash Book', 'Receipt Design'],
    },
  ];

  const hindi = [
    { title: 'आधुनिक ऑफ़िस के हुनर', level: 'B.A., B.Sc., B.Com. सहित सभी विषयों के लिए', description: 'दस्तावेज़, स्प्रेडशीट, प्रेज़ेंटेशन और टीम के साथ ऑनलाइन काम करना सीखें।', syllabus: ['Word में दस्तावेज़, स्टाइल, इंडेक्स और मेल मर्ज', 'Excel में फ़ॉर्मूले, पिवट टेबल, चार्ट और डेटा की सफ़ाई', 'PowerPoint और Google Slides में प्रेज़ेंटेशन', 'Google Drive, Docs, Sheets, Forms, Calendar और Meet', 'काम के ईमेल लिखना और फ़ाइलें सँभालना'] },
    { title: 'कंप्यूटर और डिजिटल हुनर की बुनियाद', level: 'शुरुआत करने वाले छात्रों के लिए', description: 'कंप्यूटर चलाएँ, इंटरनेट पर सुरक्षित रहें और रोज़ के डिजिटल काम सीखें।', syllabus: ['कंप्यूटर हार्डवेयर और Windows / Linux की बुनियाद', 'सुरक्षित इंटरनेट, ऑनलाइन ख़तरे, एंटीवायरस और पासवर्ड', 'क्लाउड स्टोरेज, ZIP और PDF फ़ाइलों पर काम', 'डिजिटल बैंकिंग, सुरक्षित UPI, DigiLocker और सरकारी पोर्टल', 'सोशल मीडिया और डिजिटल मार्केटिंग की शुरुआत'] },
    { title: 'कंप्यूटर और आर्टिफ़िशियल इंटेलिजेंस (AI)', level: 'AI टूल सीखने के लिए', description: 'AI को साफ़ निर्देश देना और पढ़ाई व ऑफ़िस के काम में इस्तेमाल करना सीखें।', syllabus: ['जनरेटिव AI, भाषा मॉडल और AI की बुनियाद', 'ChatGPT और Claude को साफ़ निर्देश देना', 'रिसर्च, सारांश और दस्तावेज़ समझने में AI की मदद', 'AI से चित्र और काम के लिए दृश्य सामग्री बनाना', 'बार-बार होने वाले काम आसान करना और AI का ज़िम्मेदार इस्तेमाल'] },
    { title: 'कंप्यूटर, Tally Prime और GST', level: 'वाणिज्य और हिसाब-किताब के लिए', description: 'Tally में हिसाब, एंट्री, GST बिल और रिपोर्ट बनाना सीखें।', syllabus: ['हिसाब-किताब की बुनियाद और Tally में कंपनी बनाना', 'लेजर, ग्रुप और स्टॉक आइटम की जानकारी', 'भुगतान, रसीद, बिक्री, ख़रीद और जर्नल की एंट्री', 'CGST, SGST, IGST, बिल और ई-वे बिल की बुनियाद', 'बैलेंस शीट, लाभ-हानि और बैंक मिलान'] },
    { title: 'कंप्यूटर और ऑफ़िस प्रबंधन', level: 'ऑफ़िस के कामकाज के लिए', description: 'मीटिंग, काम की सूची, रिकॉर्ड और टीम के साथ काम करने के तरीके सीखें।', syllabus: ['ऑफ़िस की ज़िम्मेदारियाँ और काम का आसान क्रम', 'मीटिंग तय करना, एजेंडा और बैठक का सार लिखना', 'Notion, Trello और Asana से काम व प्रोजेक्ट सँभालना', 'डिजिटल रिकॉर्ड, सुरक्षा और डेटा का बैकअप', 'ग्राहकों से बात करना, मतभेद सुलझाना और टीम का साथ देना'] },
    { title: 'कंप्यूटर, प्रिंटिंग और हिसाब-किताब', level: 'प्रिंटिंग और DTP का अभ्यास', description: 'पेज बनाना, प्रिंटिंग, स्कैनिंग, बिल और छोटे व्यापार का हिसाब सीखें।', syllabus: ['प्रिंटर, DPI और A4, A3, Legal पेज का आकार', 'फॉर्म, लेटरहेड, रसीद और बैज बनाना', 'साफ़ स्कैन करना और OCR से टेक्स्ट निकालना', 'कैश बुक, बिल और ख़र्च का रिकॉर्ड', 'आख़िरी प्रोजेक्ट: व्यापार के लिए पूरा स्टेशनरी सेट बनाना'] },
  ];
  return <div className="ui-page public-page"><PublicNavbar /><NewsTicker /><main className="portal-main space-y-7"><div className="page-heading"><div><div className="ui-eyebrow">{t('COURSES & SYLLABUS', 'कोर्स और पाठ्यक्रम')}</div><h1>{t('What would you like to learn?', 'आप क्या सीखना चाहेंगे?')}</h1><p>{t('Explore the programme outlines below. Ask our team about the courses currently open for applications.', 'नीचे कोर्स की जानकारी देखें। अभी किन कोर्स में आवेदन हो रहे हैं, यह हमारी टीम से पूछें।')}</p></div><Link href="/enquiry" className="ui-btn">{t('Help me choose', 'चुनने में मदद करें')}<Icon name="message" size={17} /></Link></div>
    <nav className="course-jump-links" aria-label={t('Jump to a course', 'कोर्स पर जाएँ')}>{tracks.map((course, i) => <a key={course.id} href={`#${course.id}`}>{lang === 'hi' ? hindi[i].title : course.title}</a>)}</nav>
    {tracks.map((course, i) => <section id={course.id} key={course.id} className="ui-card overflow-hidden scroll-mt-28"><div className="ui-card-head"><div className="flex items-center gap-3"><span className="module-number">{String(i + 1).padStart(2, '0')}</span><h2 className="ui-h2">{lang === 'hi' ? hindi[i].title : course.title}</h2></div><Badge tone="brand">{lang === 'hi' ? hindi[i].level : course.level}</Badge></div><div className="course-detail-grid"><div className="ui-card-pad"><p className="text-sm leading-7" style={{ color: 'var(--ink-2)' }}>{lang === 'hi' ? hindi[i].description : course.description}</p><div className="flex items-center gap-2 mt-5 text-sm"><Icon name="clock" size={17} />{t(course.duration, '4 हफ़्ते / 60 घंटे')}</div><div className="flex flex-wrap gap-2 mt-5">{course.topics.map((topic) => <Badge key={topic}>{topic}</Badge>)}</div><Link href="/apply" className="ui-btn ui-btn-primary mt-6">{t('Apply for this programme', 'इस कार्यक्रम का फॉर्म भरें')}<Icon name="arrow" size={17} /></Link></div><div className="ui-card-pad course-syllabus"><div className="ui-eyebrow">{t('WHAT YOU’LL LEARN', 'आप क्या सीखेंगे')}</div><ol className="mt-4 space-y-3">{course.syllabus.map((item, index) => <li key={item} className="flex items-start gap-3"><span className="text-xs font-semibold mt-1" style={{ color: 'var(--brand)' }}>{String(index + 1).padStart(2, '0')}</span><span className="text-sm leading-7">{lang === 'hi' ? hindi[i].syllabus[index] : item.replace(/^Module \d+: /, '')}</span></li>)}</ol></div></div></section>)}
    <p className="ui-muted">{t('Your assigned course and published lessons appear in your student portal after admin approval. Confirm your college’s internship requirements with your coordinator.', 'एडमिन की मंज़ूरी के बाद आपका कोर्स और प्रकाशित पाठ छात्र पेज पर दिखेंगे। अपने कॉलेज की इंटर्नशिप की शर्तें शिक्षक से पक्की कर लें।')}</p>
  </main><Footer /></div>;
}

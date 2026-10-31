'use client';

import LoadingState from '@/components/LoadingState';

import { BusyText } from '@/components/LoadingState';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import Script from 'next/script';
import PublicNavbar from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';
import { useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';
import { ConfirmDialog, Progress } from '@/components/ui';
import {
  InternshipFormData,
  GENDER_OPTIONS,
  COLLEGES,
} from '@/lib/types';

const initialFormData: InternshipFormData = {
  studentName: '',
  fatherName: '',
  motherName: '',
  gender: '',
  dateOfBirth: '',
  address: '',
  courseId: '',
  collegeName: '',
  otherCollegeName: '',
  universityRollNumber: '',
  contactNumber: '',
  whatsappNumber: '',
  emailAddress: '',
  declarationAccepted: false,
};

export default function InternshipForm() {
  const t = useCopy();
  const [clearForm, setClearForm] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const [formData, setFormData] = useState<InternshipFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<{ code: 'ALREADY_REGISTERED' | 'POSSIBLE_DUPLICATE'; phoneHint?: string } | null>(null);
  const [confirmNotDuplicate, setConfirmNotDuplicate] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [submittedData, setSubmittedData] = useState<InternshipFormData | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{ qrCode?: string; formViewUrl?: string; formId?: string } | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [courseOptions, setCourseOptions] = useState<{ id: string; title: string }[]>([]);

  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState(false);

  // Courses are defined by the admin; the student only picks one.
  useEffect(() => {
    let active = true;
    fetch('/api/courses')
      .then((r) => { if (!r.ok) throw new Error('courses'); return r.json(); })
      .then((d) => { if (active) setCourseOptions(d.courses || []); })
      .catch(() => { if (active) setCoursesError(true); })
      .finally(() => { if (active) setCoursesLoading(false); });
    return () => { active = false; };
  }, []);

  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [formToken, setFormToken] = useState<string>(''); // Server-side signed token

  // Turnstile callback
  const onTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  // Make callback available globally for Turnstile
  useEffect(() => {
    (window as unknown as { onTurnstileVerify: (token: string) => void }).onTurnstileVerify = onTurnstileVerify;
  }, [onTurnstileVerify]);

  useEffect(() => {

    // Fetch server-side form token for timing verification
    const fetchFormToken = async () => {
      try {
        const response = await fetch('/api/form-token');
        if (response.ok) {
          const data = await response.json();
          setFormToken(data.token);
        }
      } catch (error) {
        console.error('Failed to fetch form token:', error);
      }
    };
    fetchFormToken();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.studentName.trim()) return t('Student Name is required', 'छात्र का नाम लिखें।');
    if (!formData.fatherName.trim()) return t('Father\'s Name is required', 'पिता का नाम लिखें।');
    if (!formData.motherName.trim()) return t('Mother\'s Name is required', 'माता का नाम लिखें।');
    if (!formData.gender) return t('Please select Gender', 'लिंग चुनें।');
    if (!formData.dateOfBirth) return t('Date of Birth is required', 'जन्मतिथि भरें।');
    if (!formData.address.trim()) return t('Address is required', 'पता लिखें।');
    if (!formData.courseId) return t('Please select a Course', 'कोर्स चुनें।');
    if (!formData.collegeName) return t('Please select College Name', 'कॉलेज चुनें।');
    if (formData.collegeName === 'Other' && !formData.otherCollegeName?.trim()) return t('Please enter College Name', 'कॉलेज का नाम लिखें।');
    if (!formData.universityRollNumber.trim()) return t('University / College Roll Number is required', 'विश्वविद्यालय / कॉलेज का रोल नंबर लिखें।');
    if (!formData.contactNumber.trim()) return t('Contact Number is required', 'मोबाइल नंबर लिखें।');
    if (!/^\d{10}$/.test(formData.contactNumber)) return t('Contact Number must be 10 digits', 'मोबाइल नंबर 10 अंकों का होना चाहिए।');
    if (!formData.emailAddress.trim()) return t('Email Address is required', 'ईमेल पता लिखें।');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailAddress)) return t('Please enter a valid email address', 'सही ईमेल पता लिखें।');
    if (!formData.declarationAccepted) return t('Please accept the declaration', 'घोषणा स्वीकार करें।');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (honeypot) {
      console.log('Bot detected');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setSubmitStatus({ type: 'error', message: validationError });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);
    setDuplicate(null);

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          turnstileToken,
          formToken, // Server-side signed token for timing verification
          confirmNotDuplicate,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Capture the submitted data before resetting
        setSubmittedData({ ...formData, courseTitle: courseOptions.find((c) => c.id === formData.courseId)?.title });
        setQrCodeData({
          qrCode: result.qrCode,
          formViewUrl: result.formViewUrl,
          formId: result.formId
        });
        setShowSuccessScreen(true);
        setSubmitStatus({ type: 'success', message: 'Application submitted successfully!' });
      } else if (response.status === 409 && (result.code === 'ALREADY_REGISTERED' || result.code === 'POSSIBLE_DUPLICATE')) {
        setDuplicate({ code: result.code, phoneHint: result.phoneHint });
        if (typeof window !== 'undefined' && (window as unknown as { resetTurnstile?: () => void }).resetTurnstile) {
          (window as unknown as { resetTurnstile: () => void }).resetTurnstile();
          setTurnstileToken('');
        }
      } else {
        setSubmitStatus({ type: 'error', message: result.error || t('Could not submit your application. Please try again.', 'फॉर्म जमा नहीं हो पाया। फिर कोशिश करें।') });
        // Reset Turnstile to get a new token for retry
        if (typeof window !== 'undefined' && (window as unknown as { resetTurnstile?: () => void }).resetTurnstile) {
          (window as unknown as { resetTurnstile: () => void }).resetTurnstile();
          setTurnstileToken('');
        }
      }
    } catch {
      setSubmitStatus({ type: 'error', message: t('Check your internet and try again.', 'इंटरनेट जाँचें और फिर कोशिश करें।') });
      // Reset Turnstile on network error too
      if (typeof window !== 'undefined' && (window as unknown as { resetTurnstile?: () => void }).resetTurnstile) {
        (window as unknown as { resetTurnstile: () => void }).resetTurnstile();
        setTurnstileToken('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    setFormData(initialFormData);

    // Reset Turnstile widget
    if (typeof window !== 'undefined' && (window as unknown as { resetTurnstile?: () => void }).resetTurnstile) {
      (window as unknown as { resetTurnstile: () => void }).resetTurnstile();
      setTurnstileToken('');
    }

    // Fetch a new form token for the next submission
    try {
      const response = await fetch('/api/form-token');
      if (response.ok) {
        const data = await response.json();
        setFormToken(data.token);
      }
    } catch (error) {
      console.error('Failed to fetch new form token:', error);
    }
  };

  const handleNewApplication = () => {
    setShowSuccessScreen(false);
    setSubmittedData(null);
    setQrCodeData(null);
    setSubmitStatus(null);
    handleReset();
  };

  const generatePDF = async () => {
    if (!submittedData) return;

    setIsGeneratingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let yPos = 20;

      // Header with company name
      pdf.setFillColor(30, 58, 95);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Rajtech Technological Systems', pageWidth / 2, 18, { align: 'center' });
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Internship Application Request', pageWidth / 2, 28, { align: 'center' });
      pdf.text('Patliputra University', pageWidth / 2, 35, { align: 'center' });

      yPos = 55;
      pdf.setTextColor(0, 0, 0);

      // Helper function to add section header
      const addSectionHeader = (title: string) => {
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, yPos - 5, contentWidth, 10, 'F');
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 58, 95);
        pdf.text(title, margin + 3, yPos + 2);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        yPos += 12;
      };

      // Helper function to add field
      const addField = (label: string, value: string, isFullWidth = false) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(100, 100, 100);
        pdf.text(label + ':', margin, yPos);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        const maxWidth = isFullWidth ? contentWidth - 5 : contentWidth / 2 - 5;
        const splitValue = pdf.splitTextToSize(value || 'N/A', maxWidth);
        pdf.text(splitValue, margin + 50, yPos);
        yPos += Math.max(splitValue.length * 5, 7);
      };

      addField('Application Status', 'Pending admin approval', true);
      yPos += 5;
      // Personal Information
      addSectionHeader('Personal Information');
      addField('Student Name', submittedData.studentName);
      addField("Father's Name", submittedData.fatherName);
      addField("Mother's Name", submittedData.motherName);
      addField('Gender', submittedData.gender);
      addField('Date of Birth', submittedData.dateOfBirth);
      addField('Address', submittedData.address, true);
      yPos += 5;

      // Academic Information
      addSectionHeader('Academic Information');
      addField('College Name', submittedData.collegeName === 'Other' ? submittedData.otherCollegeName || '' : submittedData.collegeName);
      addField('Roll Number', submittedData.universityRollNumber);
      yPos += 5;

      // Course
      addSectionHeader('Course');
      addField('Course', submittedData.courseTitle || '', true);
      yPos += 5;

      // Contact Information
      addSectionHeader('Contact Information');
      addField('Contact Number', submittedData.contactNumber);
      addField('WhatsApp', submittedData.whatsappNumber || 'Same as contact');
      addField('Email Address', submittedData.emailAddress);
      yPos += 10;

      // Declaration
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 100, 100);
      const declaration = 'I hereby declare that all the information provided above is true and correct to the best of my knowledge.';
      const declarationLines = pdf.splitTextToSize(declaration, contentWidth);
      pdf.text(declarationLines, margin, yPos);
      yPos += declarationLines.length * 5 + 10;

      // Submission timestamp
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Submitted on: ${new Date().toLocaleString('en-IN')}`, margin, yPos);

      // Footer
      pdf.setFillColor(30, 58, 95);
      pdf.rect(0, 285, pageWidth, 12, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.text('Contact: +91 9931005560, +91 89869962080 | Email: rtseducationintern@gmail.com | Website: rtseducation.in', pageWidth / 2, 292, { align: 'center' });

      // Save the PDF
      const safeName = submittedData.studentName.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Internship_Application_${safeName}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(t('Could not create the PDF. Please try again.', 'PDF नहीं बन पाई। फिर कोशिश करें।'));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  useEffect(() => {
    if (submitStatus?.type === 'error') { errorRef.current?.focus(); errorRef.current?.scrollIntoView({ block: 'center' }); }
  }, [submitStatus]);
  useEffect(() => { if (showSuccessScreen) window.scrollTo(0, 0); }, [showSuccessScreen]);

  const textField = (name: 'studentName' | 'fatherName' | 'motherName' | 'dateOfBirth' | 'otherCollegeName' | 'universityRollNumber' | 'contactNumber' | 'whatsappNumber' | 'emailAddress', label: string, type = 'text', required = true, hint?: string) => (
    <div key={name}><label className="ui-label" htmlFor={`apply-${name}`}>{label}{required ? ' *' : ` (${t('optional', 'ज़रूरी नहीं')})`}</label><input id={`apply-${name}`} name={name} type={type} required={required} className="ui-field" value={formData[name] || ''} onChange={handleInputChange} inputMode={type === 'tel' ? 'numeric' : undefined} pattern={type === 'tel' ? '[0-9]{10}' : undefined} maxLength={type === 'tel' ? 10 : undefined} autoComplete={name === 'studentName' ? 'name' : name === 'contactNumber' ? 'tel-national' : name === 'emailAddress' ? 'email' : undefined} aria-describedby={hint ? `hint-${name}` : undefined} />{hint && <p id={`hint-${name}`} className="ui-muted mt-2">{hint}</p>}</div>
  );
  const requiredFields = [formData.studentName, formData.fatherName, formData.motherName, formData.gender, formData.dateOfBirth, formData.address, formData.courseId, formData.collegeName === 'Other' ? formData.otherCollegeName : formData.collegeName, formData.universityRollNumber, formData.contactNumber, formData.emailAddress];
  const filled = requiredFields.filter((value) => value?.trim()).length + (formData.declarationAccepted ? 1 : 0);
  const total = requiredFields.length + 1;

  if (showSuccessScreen && submittedData) {
    const summary = [
      [t('Student name', 'छात्र का नाम'), submittedData.studentName], [t('Father’s name', 'पिता का नाम'), submittedData.fatherName],
      [t('Mother’s name', 'माता का नाम'), submittedData.motherName], [t('Gender', 'लिंग'), submittedData.gender === 'Male' ? t('Male', 'पुरुष') : submittedData.gender === 'Female' ? t('Female', 'महिला') : t('Other', 'अन्य')],
      [t('Date of birth', 'जन्मतिथि'), submittedData.dateOfBirth], [t('Address', 'पता'), submittedData.address],
      [t('College', 'कॉलेज'), submittedData.collegeName === 'Other' ? submittedData.otherCollegeName : submittedData.collegeName],
      [t('Roll number', 'रोल नंबर'), submittedData.universityRollNumber], [t('Course', 'कोर्स'), submittedData.courseTitle],
      [t('Mobile number', 'मोबाइल नंबर'), submittedData.contactNumber], [t('WhatsApp number', 'व्हाट्सऐप नंबर'), submittedData.whatsappNumber || submittedData.contactNumber],
      [t('Email', 'ईमेल'), submittedData.emailAddress],
    ];
    return <div className="ui-page public-page"><PublicNavbar /><main className="portal-main space-y-6">
      <section className="ui-card ui-card-pad"><span className="stat-icon teal"><Icon name="check" size={25} /></span><h1 className="ui-h1 mt-5">{t('Application received. Approval is next.', 'आवेदन मिल गया। अब मंज़ूरी का इंतज़ार करें।')}</h1><p className="ui-muted mt-3">{t('Submitting this form does not confirm admission. The admin will review it and approve or reject your request.', 'फॉर्म जमा करने से प्रवेश पक्का नहीं होता। एडमिन इसे जाँचकर मंज़ूर या नामंज़ूर करेंगे।')}</p></section>
      <section className="ui-card ui-card-pad"><div className="flex items-center gap-3"><span className="stat-icon orange"><Icon name="clock" size={23} /></span><h2 className="ui-h2">{t('Pending admin approval', 'एडमिन की मंज़ूरी बाकी है')}</h2></div><ol className="learning-steps"><li><span><Icon name="check" size={16} /></span><div><strong>{t('Application saved', 'आवेदन सेव हो गया')}</strong><p>{t('Download a copy below for your records.', 'नीचे से अपने फॉर्म की कॉपी डाउनलोड कर लें।')}</p></div></li><li><span>2</span><div><strong>{t('Admin reviews your request', 'एडमिन आवेदन जाँचेंगे')}</strong><p>{t('Your portal account is not active yet. Only an admin can confirm admission.', 'अभी छात्र खाता चालू नहीं है। सिर्फ़ एडमिन प्रवेश पक्का कर सकते हैं।')}</p></div></li><li><span>3</span><div><strong>{t('Start learning after approval', 'मंज़ूरी के बाद पढ़ाई शुरू करें')}</strong><p>{t('After approval, use your mobile number and roll number to sign in to your assigned course.', 'मंज़ूरी के बाद मोबाइल नंबर और रोल नंबर से अपने तय कोर्स में लॉगिन करें।')}</p></div></li></ol>{qrCodeData?.formViewUrl && <a href={qrCodeData.formViewUrl} className="ui-btn ui-btn-primary">{t('View application status', 'आवेदन की स्थिति देखें')}<Icon name="arrow" size={17} /></a>}<Link href="/enquiry" className="ui-link inline-block ml-4">{t('Ask our team', 'हमारी टीम से पूछें')} →</Link></section>
      <section className="ui-card overflow-hidden"><div className="ui-card-head"><h2 className="ui-h2">{t('Your application summary', 'आपके आवेदन की जानकारी')}</h2><button onClick={generatePDF} disabled={isGeneratingPDF} className="ui-btn"><Icon name="download" size={17} />{isGeneratingPDF ? <BusyText>{t('Preparing…', 'तैयार हो रहा है…')}</BusyText> : t('Download application PDF', 'फॉर्म की PDF डाउनलोड करें')}</button></div><dl className="grid sm:grid-cols-2 gap-6 p-6 text-sm">{summary.map(([label, value]) => <div key={label}><dt className="ui-eyebrow">{label}</dt><dd className="mt-2 break-words">{value || '—'}</dd></div>)}</dl></section>
      {qrCodeData?.qrCode && <section className="ui-card ui-card-pad"><h2 className="ui-h2">{t('Keep your application handy', 'अपना फॉर्म आसानी से देखें')}</h2><p className="ui-muted mt-2">{t('Scan or save this QR code to open your application later.', 'बाद में फॉर्म खोलने के लिए यह QR कोड स्कैन करें या सेव कर लें।')}</p><div className="flex flex-wrap items-center gap-6 mt-5"><Image src={qrCodeData.qrCode} alt={t('QR code for your application', 'आपके आवेदन का QR कोड')} width={180} height={180} unoptimized /><div className="flex flex-wrap gap-3"><a href={qrCodeData.qrCode} download={`internship-qr-${qrCodeData.formId || 'code'}.png`} className="ui-btn">{t('Download QR code', 'QR कोड डाउनलोड करें')}</a>{qrCodeData.formViewUrl && <a href={qrCodeData.formViewUrl} target="_blank" rel="noopener noreferrer" className="ui-btn">{t('View application', 'अपना फॉर्म देखें')} ↗</a>}</div></div></section>}
      <button className="ui-link" onClick={handleNewApplication}>{t('Submit another application', 'एक और आवेदन भरें')} →</button>
    </main><Footer /></div>;
  }

  return <div className="ui-page public-page"><PublicNavbar /><main className="portal-main">
    <div className="page-heading"><div><div className="ui-eyebrow">{t('LET’S GET YOU STARTED', 'आइए, शुरुआत करें')}</div><h1>{t('Your next chapter starts here.', 'आपकी नई शुरुआत यहीं से है।')}</h1><p>{t('Fill in your details as they appear in your college records. Fields marked * are required.', 'जानकारी अपने कॉलेज के रिकॉर्ड के अनुसार भरें। * वाले खाने भरना ज़रूरी है।')}</p></div></div>
    <div className="application-layout">
      <form onSubmit={handleSubmit} className="min-w-0 space-y-6" aria-busy={isSubmitting}>
        <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        {duplicate && <div role="alert" className="rounded-xl p-5 space-y-3" style={{ background: 'var(--warn-soft, #fff7e6)', color: 'var(--ink, #1f2937)', border: '1px solid var(--warn, #f59e0b)' }}>
          <h3 className="ui-h2">{duplicate.code === 'ALREADY_REGISTERED' ? t('You are already registered', 'आप पहले से रजिस्टर्ड हैं') : t('You may already be registered', 'हो सकता है आप पहले से रजिस्टर्ड हों')}</h3>
          <p>{t('Please sign in to the portal instead of filling this form again. Use the mobile number your college gave us and your university roll number (the long number on your admit card) as the password.', 'कृपया फॉर्म दोबारा भरने की जगह पोर्टल में लॉगिन करें। यूज़र आईडी में वही मोबाइल नंबर डालें जो कॉलेज के ज़रिये हमें मिला था, और पासवर्ड में अपना यूनिवर्सिटी रोल नंबर (एडमिट कार्ड वाला लंबा नंबर) डालें।')}</p>
          {duplicate.phoneHint && <p className="text-sm">{t(`The registered mobile number ends in ••••••••${duplicate.phoneHint}.`, `रजिस्टर्ड मोबाइल नंबर के आख़िरी अंक ••••••••${duplicate.phoneHint} हैं।`)}</p>}
          <div className="flex flex-wrap gap-3"><Link href="/portal/login" className="ui-btn ui-btn-primary">{t('Go to sign in', 'लॉगिन पर जाएँ')}<Icon name="arrow" size={17} /></Link><Link href="/enquiry" className="ui-btn">{t('Ask our team', 'हमारी टीम से पूछें')}</Link></div>
          {duplicate.code === 'POSSIBLE_DUPLICATE' && <label className="flex items-start gap-3 text-sm cursor-pointer"><input type="checkbox" className="custom-checkbox shrink-0 mt-1" checked={confirmNotDuplicate} onChange={(e) => setConfirmNotDuplicate(e.target.checked)} /><span>{t('I tried signing in and it did not work, or I am a different student. Submit my application anyway.', 'मैंने लॉगिन करके देखा पर नहीं हुआ, या मैं दूसरा छात्र हूँ। फिर भी मेरा फॉर्म जमा करें।')}</span></label>}
        </div>}
        {submitStatus?.type === 'error' && <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl p-4 text-sm" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}>{submitStatus.message}</div>}
        <section className="ui-card overflow-hidden scroll-mt-28" id="personal-details"><div className="ui-card-head"><div className="flex gap-3 items-center"><span className="module-number">01</span><div><h2 className="ui-h2">{t('About you', 'आपकी जानकारी')}</h2><p className="ui-muted">{t('Tell us who you are.', 'अपनी जानकारी भरें।')}</p></div></div><Icon name="user" /></div><div className="ui-card-pad space-y-5"><div className="grid sm:grid-cols-2 gap-5">{textField('studentName', t('Full name', 'पूरा नाम'))}{textField('fatherName', t('Father’s name', 'पिता का नाम'))}{textField('motherName', t('Mother’s name', 'माता का नाम'))}<div><label htmlFor="apply-gender" className="ui-label">{t('Gender', 'लिंग')} *</label><select id="apply-gender" name="gender" value={formData.gender} onChange={handleInputChange} required className="ui-field"><option value="">{t('Choose one', 'एक चुनें')}</option>{GENDER_OPTIONS.map((value) => <option key={value} value={value}>{value === 'Male' ? t('Male', 'पुरुष') : value === 'Female' ? t('Female', 'महिला') : t('Other', 'अन्य')}</option>)}</select></div>{textField('dateOfBirth', t('Date of birth', 'जन्मतिथि'), 'date')}</div><div><label htmlFor="apply-address" className="ui-label">{t('Full address', 'पूरा पता')} *</label><textarea id="apply-address" rows={3} required className="ui-field" name="address" autoComplete="street-address" value={formData.address} onChange={handleInputChange} /></div></div></section>
        <section className="ui-card overflow-hidden scroll-mt-28" id="academic-details"><div className="ui-card-head"><div className="flex gap-3 items-center"><span className="module-number">02</span><div><h2 className="ui-h2">{t('Your college & course', 'आपका कॉलेज और कोर्स')}</h2><p className="ui-muted">{t('Use the details in your college records.', 'कॉलेज के रिकॉर्ड वाली जानकारी दें।')}</p></div></div><Icon name="book" /></div><div className="ui-card-pad space-y-5"><div><label htmlFor="apply-college" className="ui-label">{t('College name', 'कॉलेज का नाम')} *</label><select id="apply-college" name="collegeName" value={formData.collegeName} onChange={handleInputChange} required className="ui-field"><option value="">{t('Choose your college', 'अपना कॉलेज चुनें')}</option>{COLLEGES.map((college) => <option key={college} value={college}>{college === 'Other' ? t('Other college', 'अन्य कॉलेज') : college}</option>)}</select></div>{formData.collegeName === 'Other' && textField('otherCollegeName', t('Write your college name', 'अपने कॉलेज का नाम लिखें'))}{textField('universityRollNumber', t('University / college roll number', 'विश्वविद्यालय / कॉलेज रोल नंबर'), 'text', true, t('This will be your first password. Copy it exactly from your college records.', 'यही आपका पहला पासवर्ड होगा। इसे कॉलेज के रिकॉर्ड से सही-सही लिखें।'))}<div><label htmlFor="apply-course" className="ui-label">{t('Internship course', 'इंटर्नशिप का कोर्स')} *</label><select disabled={coursesLoading || coursesError} aria-busy={coursesLoading} id="apply-course" name="courseId" value={formData.courseId} onChange={handleInputChange} required className="ui-field"><option value="">{t('Choose your course', 'अपना कोर्स चुनें')}</option>{courseOptions.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select>{coursesLoading && <LoadingState compact label={t('Loading available courses', 'उपलब्ध कोर्स लोड हो रहे हैं')} />}{coursesError && <p role="alert" className="ui-muted mt-2">{t('Courses could not load. Please reload the page or contact our team.', 'कोर्स नहीं खुल पाए। पेज फिर खोलें या हमारी टीम से संपर्क करें।')} <Link href="/enquiry" className="ui-link">{t('Get help', 'मदद लें')}</Link></p>}{!coursesLoading && !coursesError && !courseOptions.length && <p className="ui-muted mt-2">{t('No courses are available right now.', 'अभी कोई कोर्स नहीं दिख रहा है।')} <Link href="/enquiry" className="ui-link">{t('Ask our team for help', 'हमारी टीम से मदद लें')}</Link></p>}</div></div></section>
        <section className="ui-card overflow-hidden scroll-mt-28" id="contact-details"><div className="ui-card-head"><div className="flex gap-3 items-center"><span className="module-number">03</span><div><h2 className="ui-h2">{t('How to reach you', 'आपसे संपर्क कैसे करें')}</h2><p className="ui-muted">{t('Use a phone number you can access.', 'ऐसा नंबर दें जो आप इस्तेमाल करते हैं।')}</p></div></div><Icon name="message" /></div><div className="ui-card-pad grid sm:grid-cols-2 gap-5">{textField('contactNumber', t('Mobile number', 'मोबाइल नंबर'), 'tel', true, t('Your 10-digit number will be your sign-in ID.', 'आपका 10 अंकों का नंबर ही लॉगिन ID होगा।'))}{textField('whatsappNumber', t('WhatsApp number', 'व्हाट्सऐप नंबर'), 'tel', false, t('Leave blank if it is the same as your mobile number.', 'मोबाइल नंबर वाला ही हो तो खाली छोड़ें।'))}{textField('emailAddress', t('Email address', 'ईमेल पता'), 'email')}</div></section>
        <section className="ui-card overflow-hidden scroll-mt-28" id="review-details"><div className="ui-card-head"><div className="flex gap-3 items-center"><span className="module-number">04</span><div><h2 className="ui-h2">{t('Check & submit', 'जाँचें और जमा करें')}</h2><p className="ui-muted">{t('Take a moment to check your details.', 'अपनी जानकारी एक बार ध्यान से जाँच लें।')}</p></div></div><Icon name="check" /></div><div className="ui-card-pad space-y-5"><div className="auth-hint"><Icon name="help" size={18} /><p>{t('I declare that the information above is true to the best of my knowledge. I understand that false information may lead to cancellation of my application.', 'मैं घोषणा करता/करती हूँ कि दी गई जानकारी मेरी जानकारी के अनुसार सही है। गलत जानकारी देने पर मेरा आवेदन रद्द किया जा सकता है।')}</p></div><label className="flex items-start gap-3 text-sm cursor-pointer"><input type="checkbox" name="declarationAccepted" required checked={formData.declarationAccepted} onChange={handleInputChange} className="custom-checkbox shrink-0 mt-1" /><span>{t('I have checked my details and accept this declaration.', 'मैंने अपनी जानकारी जाँच ली है और यह घोषणा स्वीकार करता/करती हूँ।')} *</span></label><div id="cf-turnstile-container" className="flex justify-center" />
{turnstileSiteKey && <><Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback"
            async={true}
            defer={true}
          />
          <Script id="turnstile-callback" strategy="afterInteractive">
            {`
              window.onloadTurnstileCallback = function () {
                if (window.turnstile) {
                  window.turnstileWidgetId = window.turnstile.render('#cf-turnstile-container', {
                    sitekey: '${process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}',
                    callback: function(token) {
                      window.onTurnstileVerify(token);
                    },
                    theme: 'light',
                  });
                }
              };
              // Function to reset Turnstile widget
              window.resetTurnstile = function() {
                if (window.turnstile && window.turnstileWidgetId) {
                  window.turnstile.reset(window.turnstileWidgetId);
                }
              };
            `}
          </Script></>}
        <button type="submit" disabled={isSubmitting} className="ui-btn ui-btn-primary w-full">{isSubmitting ? <BusyText>{t('Submitting your application…', 'आपका फॉर्म जमा हो रहा है…')}</BusyText> : t('Submit my application', 'मेरा फॉर्म जमा करें')}<Icon name="arrow" size={18} /></button><button type="button" disabled={isSubmitting} className="ui-link block mx-auto" onClick={() => setClearForm(true)}>{t('Clear this form', 'यह फॉर्म खाली करें')}</button><p className="ui-muted text-center">{t('Submission is a request for admission. Only the admin can approve access to your course.', 'यह प्रवेश के लिए आवेदन है। कोर्स का प्रवेश सिर्फ़ एडमिन की मंज़ूरी से मिलेगा।')}</p></div></section>
      </form>
      <aside className="application-aside space-y-5"><div className="ui-card ui-card-pad"><div className="ui-eyebrow">{t('YOUR APPLICATION', 'आपका आवेदन')}</div><h2 className="ui-h2 mt-2">{filled}/{total} {t('required fields filled', 'ज़रूरी खाने भरे गए')}</h2><div className="mt-4"><Progress value={filled / total * 100} label={t('Form fields filled', 'फॉर्म के भरे हुए खाने')} /></div><nav className="application-steps" aria-label={t('Application sections', 'फॉर्म के भाग')}>{[[t('About you', 'आपकी जानकारी'), 'personal-details'], [t('College & course', 'कॉलेज और कोर्स'), 'academic-details'], [t('Contact details', 'संपर्क की जानकारी'), 'contact-details'], [t('Check & submit', 'जाँचें और जमा करें'), 'review-details']].map(([label, id], i) => <a key={id} href={`#${id}`}><span>{i + 1}</span>{label}<Icon name="chevron" size={15} /></a>)}</nav></div><section className="help-card"><h2>{t('Keep these ready', 'ये जानकारी पास रखें')}</h2><ul className="list-disc pl-4 mt-3 text-sm space-y-2" style={{ color: 'var(--ink-2)' }}><li>{t('Your college name and roll number', 'कॉलेज का नाम और रोल नंबर')}</li><li>{t('Your mobile number and email', 'मोबाइल नंबर और ईमेल')}</li><li>{t('Your date of birth and address', 'जन्मतिथि और पता')}</li></ul><p>{t('Need help with a field?', 'कोई खाना भरने में मदद चाहिए?')}</p><Link href="/enquiry" className="ui-link">{t('Ask our team', 'हमारी टीम से पूछें')} →</Link></section></aside>
    </div>
  </main>{clearForm && <ConfirmDialog title={t('Clear this form?', 'यह फॉर्म खाली करें?')} body={t('The details you have entered will be removed. Your application has not been submitted.', 'आपकी भरी हुई जानकारी हट जाएगी। अभी आपका फॉर्म जमा नहीं हुआ है।')} confirmLabel={t('Clear form', 'फॉर्म खाली करें')} onCancel={() => setClearForm(false)} onConfirm={() => { void handleReset(); setClearForm(false); }} />}<Footer /></div>;
}

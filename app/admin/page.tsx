'use client';

import LoadingState, { BusyText, Spinner } from '@/components/LoadingState';

import { useAdminCopy } from '@/components/admin/copy';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Icon, IconName } from '@/components/icons';
import { ConfirmDialog, useDialogFocus } from '@/components/ui';
import JSZip from 'jszip';
import CoursesManager from '@/components/admin/CoursesManager';
import StudentsManager from '@/components/admin/StudentsManager';
import OverviewTab from '@/components/admin/Overview';
import ApplicationReview, { ApplicationStatus } from '@/components/admin/ApplicationReview';
import type { ApprovalStatus } from '@/lib/db';
import QuestionsManager from '@/components/admin/QuestionsManager';
import Walkthrough from '@/components/help/Walkthrough';
import { LangToggle, useCopy } from '@/components/help/i18n';
import { GENDER_OPTIONS, INTERNSHIP_TOPICS, COURSES, COLLEGES, HONOURS_SUBJECTS, SEMESTERS, DashboardAnalytics, Enquiry } from '@/lib/types';

interface Submission {
  id: string;
  approval_status?: ApprovalStatus;
  review_note?: string | null;
  reviewed_at?: string | null;
  student_name: string;
  father_name: string;
  mother_name: string;
  gender: string;
  date_of_birth: string;
  address: string;
  internship_topic: string;
  college_name: string;
  honours_subject: string;
  current_semester: string;
  class_roll_no: string;
  university_name: string;
  university_roll_number: string;
  university_registration_number: string;
  contact_number: string;
  whatsapp_number: string | null;
  email_address: string;
  photo: string | null;
  signature: string | null;
  created_at: string;
}

export default function AdminPage() {
  const t = useAdminCopy();
  const copy = useCopy();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDialogFocus(menuOpen, () => setMenuOpen(false));
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 901px)');
    const close = () => { if (media.matches) setMenuOpen(false); };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, []);
  const [signingOut, setSigningOut] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [enquiriesLoading, setEnquiriesLoading] = useState(true);
  const [enquiriesError, setEnquiriesError] = useState(false);
  const [newsWorking, setNewsWorking] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const detailsDialogRef = useDialogFocus(Boolean(selectedSubmission), () => setSelectedSubmission(null));
  const [searchTerm, setSearchTerm] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | ApprovalStatus>('pending');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');

  // Tab & Extended Admin state
  type AdminTab = 'analytics' | 'applications' | 'enquiries' | 'news' | 'courses' | 'students' | 'questions';
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [openQuestions, setOpenQuestions] = useState(0);
  const [studentCourse, setStudentCourse] = useState<string | undefined>(undefined);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);

  // News ticker state
  interface NewsItem { id: string; message: string; link_url: string | null; is_active: boolean; sort_order: number; created_at: string; }
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsMessage, setNewsMessage] = useState('');
  const [newsLinkUrl, setNewsLinkUrl] = useState('');
  const [newsSortOrder, setNewsSortOrder] = useState(0);
  const [newsSubmitting, setNewsSubmitting] = useState(false);
  const [newsError, setNewsError] = useState('');

  // Certificate modal state
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [certTarget, setCertTarget] = useState<Submission | null>(null);
  const [certRtsRegNumber, setCertRtsRegNumber] = useState('');
  const [certMarks, setCertMarks] = useState<number | ''>('');
  const [certStartDate, setCertStartDate] = useState('');
  const [certEndDate, setCertEndDate] = useState('');
  const [certLoading, setCertLoading] = useState(false);
  const [certResult, setCertResult] = useState<{
    success?: boolean; error?: string;
    certificateUrl?: string; viewUrl?: string; grade?: string; serialNumber?: string;
  } | null>(null);

  // Scratch (walk-in) certificate state
  type ScratchForm = {
    studentName: string; fatherName: string; gender: string; dob: string;
    contact: string; email: string; course: string; otherCourse: string;
    college: string; otherCollege: string; semester: string;
    honoursSubject: string; otherHonoursSubject: string;
    rollNo: string; regNo: string; classRoll: string;
    topic: string; photo: string | null;
    rtsRegNumber: string; marks: number | ''; startDate: string; endDate: string;
  };
  const SCRATCH_DEFAULTS: ScratchForm = {
    studentName: '', fatherName: '', gender: 'Male', dob: '',
    contact: '', email: '', course: '', otherCourse: '',
    college: '', otherCollege: '', semester: '',
    honoursSubject: '', otherHonoursSubject: '',
    rollNo: '', regNo: '', classRoll: '', topic: '', photo: null,
    rtsRegNumber: '', marks: '', startDate: '', endDate: '',
  };
  const [scratchModalOpen, setScratchModalOpen] = useState(false);
  const [scratchForm, setScratchForm] = useState<ScratchForm>(SCRATCH_DEFAULTS);
  const [scratchLoading, setScratchLoading] = useState(false);
  const [scratchResult, setScratchResult] = useState<{
    success?: boolean; error?: string;
    certificateUrl?: string; viewUrl?: string; grade?: string; serialNumber?: string;
  } | null>(null);

  function setScratch<K extends keyof ScratchForm>(field: K, value: ScratchForm[K]) {
    setScratchForm(prev => ({ ...prev, [field]: value }));
  }

  function previewGrade(marks: number | ''): string {
    if (marks === '') return '';
    if (marks >= 90) return 'O (Outstanding) — GP 10';
    if (marks >= 80) return 'A+ — GP 9';
    if (marks >= 70) return 'A — GP 8';
    if (marks >= 60) return 'B+ — GP 7';
    if (marks >= 50) return 'B — GP 6';
    if (marks >= 45) return 'C — GP 5';
    if (marks >= 40) return 'D — GP 4';
    return 'F (Fail) — GP 0';
  }

  async function handleGenerateCertificate() {
    if (!certTarget || certMarks === '' || !certStartDate || !certEndDate || !certRtsRegNumber) return;
    setCertLoading(true);
    setCertResult(null);
    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationId: certTarget.id,
          rtsRegNumber: certRtsRegNumber,
          marks: certMarks,
          startDate: certStartDate,
          endDate: certEndDate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCertResult({
          success: true,
          grade: data.grade,
          serialNumber: data.serialNumber,
          certificateUrl: data.certificateUrl,
          viewUrl: data.viewUrl,
        });
      } else {
        setCertResult({ error: data.error || 'Generation failed' });
      }
    } catch {
      setCertResult({ error: 'Network error' });
    } finally {
      setCertLoading(false);
    }
  }

  async function handleGenerateScratchCertificate() {
    const { studentName, fatherName, course, otherCourse, college, otherCollege, honoursSubject, otherHonoursSubject, semester, rollNo, regNo, classRoll, topic, rtsRegNumber, marks, startDate, endDate } = scratchForm;
    const resolvedCourse = course === 'Other' ? otherCourse : course;
    const resolvedCollege = college === 'Other' ? otherCollege : college;
    const resolvedHonours = honoursSubject === 'Other' ? otherHonoursSubject : honoursSubject;
    if (!studentName || !fatherName || !resolvedCourse || !resolvedCollege || !semester || !rollNo || !regNo || !classRoll || !topic || !rtsRegNumber || marks === '' || !startDate || !endDate) return;
    setScratchLoading(true);
    setScratchResult(null);
    try {
      const res = await fetch('/api/certificates/generate-scratch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scratchForm, course: resolvedCourse, college: resolvedCollege, honoursSubject: resolvedHonours }),
      });
      const data = await res.json();
      if (res.ok) {
        setScratchResult({ success: true, grade: data.grade, serialNumber: data.serialNumber, certificateUrl: data.certificateUrl, viewUrl: data.viewUrl });
      } else {
        setScratchResult({ error: data.error || 'Generation failed' });
      }
    } catch {
      setScratchResult({ error: 'Network error' });
    } finally {
      setScratchLoading(false);
    }
  }

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/submissions', {
      });

      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.submissions || []);
      } else {
        setAuthError('Failed to fetch submissions');
      }
    } catch {
      setAuthError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.error('Analytics fetch error:', e);
    }
  }, []);

  const fetchEnquiries = useCallback(async () => {
    setEnquiriesLoading(true); setEnquiriesError(false);
    try {
      const res = await fetch('/api/enquiries');
      if (!res.ok) throw new Error('enquiries');
      if (res.ok) {
        const data = await res.json();
        setEnquiries(data.enquiries || []);
      }
    } catch (e) {
      setEnquiriesError(true);
      console.error('Enquiries fetch error:', e);
    } finally { setEnquiriesLoading(false); }
  }, []);

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await fetch('/api/admin/news', {

      });
      if (res.ok) {
        const data = await res.json();
        setNewsItems(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('News fetch error:', e);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // Session lives in an httpOnly cookie; restore it after a page refresh.
  useEffect(() => {
    fetch('/api/admin/verify')
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) {
          setIsAuthenticated(true);
          fetchSubmissions();
          fetchAnalytics();
          fetchEnquiries();
        }
      })
      .catch(() => undefined).finally(() => setCheckingSession(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setPassword('');
        setIsAuthenticated(true);
        await fetchSubmissions();
        fetchAnalytics();
        fetchEnquiries();
      } else {
        const body = await response.json().catch(() => ({}));
        setAuthError(body.error || 'Invalid password');
      }
    } catch {
      setAuthError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Student Name', 'Father Name', 'Mother Name', 'Gender', 'DOB', 'Address',
      'Internship Topic', 'College', 'Honours Subject', 'Semester', 'Class Roll',
      'University', 'Uni Roll No', 'Uni Reg No', 'Contact', 'WhatsApp', 'Email',
      'Has Photo', 'Has Signature', 'Submitted At', 'Approval Status'
    ];

    const rows = submissions.map(s => [
      s.student_name, s.father_name, s.mother_name, s.gender, s.date_of_birth, s.address,
      s.internship_topic, s.college_name, s.honours_subject, s.current_semester, s.class_roll_no,
      s.university_name, s.university_roll_number, s.university_registration_number,
      s.contact_number, s.whatsapp_number || '', s.email_address,
      s.photo ? 'Yes' : 'No', s.signature ? 'Yes' : 'No', s.created_at, s.approval_status || 'pending'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `internship_applications_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper function to check if a string is a URL
  const isUrl = (str: string | null | undefined): boolean => {
    if (!str) return false;
    return str.startsWith('http://') || str.startsWith('https://');
  };

  // Helper function to download a single image (handles both URL and base64)
  const downloadImage = async (imageData: string, filename: string) => {
    if (isUrl(imageData)) {
      // For URLs, fetch the image and download
      try {
        const response = await fetch(imageData);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading image:', error);
        // Fallback: open in new tab
        window.open(imageData, '_blank');
      }
    } else {
      // For base64, use direct download
      const link = document.createElement('a');
      link.href = imageData;
      link.download = filename;
      link.click();
    }
  };

  // Download all images as ZIP
  const [downloadingZip, setDownloadingZip] = useState(false);

  const downloadAllImagesAsZip = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const photosFolder = zip.folder('photos');
      const signaturesFolder = zip.folder('signatures');

      for (const submission of submissions) {
        // Clean filename - remove special characters
        const safeName = submission.student_name.replace(/[^a-zA-Z0-9]/g, '_');
        const rollNo = submission.university_roll_number.replace(/[^a-zA-Z0-9]/g, '_');

        if (submission.photo && photosFolder) {
          if (isUrl(submission.photo)) {
            // Fetch image from URL and add to ZIP
            try {
              const response = await fetch(submission.photo);
              const blob = await response.blob();
              const extension = blob.type.split('/')[1] || 'jpg';
              photosFolder.file(`${safeName}_${rollNo}.${extension}`, blob);
            } catch (error) {
              console.error(`Failed to fetch photo for ${safeName}:`, error);
            }
          } else {
            // Handle legacy base64 data
            const photoMatch = submission.photo.match(/^data:image\/(\w+);base64,(.+)$/);
            if (photoMatch) {
              const extension = photoMatch[1];
              const base64Data = photoMatch[2];
              photosFolder.file(`${safeName}_${rollNo}.${extension}`, base64Data, { base64: true });
            }
          }
        }

        if (submission.signature && signaturesFolder) {
          if (isUrl(submission.signature)) {
            // Fetch signature from URL and add to ZIP
            try {
              const response = await fetch(submission.signature);
              const blob = await response.blob();
              const extension = blob.type.split('/')[1] || 'png';
              signaturesFolder.file(`${safeName}_${rollNo}_signature.${extension}`, blob);
            } catch (error) {
              console.error(`Failed to fetch signature for ${safeName}:`, error);
            }
          } else {
            // Handle legacy base64 data
            const sigMatch = submission.signature.match(/^data:image\/(\w+);base64,(.+)$/);
            if (sigMatch) {
              const extension = sigMatch[1];
              const base64Data = sigMatch[2];
              signaturesFolder.file(`${safeName}_${rollNo}_signature.${extension}`, base64Data, { base64: true });
            }
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `internship_images_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating ZIP:', error);
      alert('Failed to create ZIP file. Please try again.');
    } finally {
      setDownloadingZip(false);
    }
  };

  const pendingCount = submissions.filter((s) => (s.approval_status || 'pending') === 'pending').length;
  const filteredSubmissions = submissions.filter(s => (approvalFilter === 'all' || (s.approval_status || 'pending') === approvalFilter) && (
    s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_number.includes(searchTerm) ||
    s.college_name.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  // Refresh data periodically when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        fetchSubmissions();
        fetchAnalytics();
        fetchEnquiries();
      }, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchSubmissions, fetchAnalytics, fetchEnquiries]);

  const refreshOpenQuestions = useCallback(() => {
    fetch('/api/admin/questions?filter=open').then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOpenQuestions(d.questions.length)).catch(() => undefined);
  }, []);
  useEffect(() => { if (isAuthenticated) refreshOpenQuestions(); }, [isAuthenticated, refreshOpenQuestions]);

  if (checkingSession) return <main className="portal-main"><LoadingState label={copy('Checking your session', 'आपका सत्र जाँचा जा रहा है')} /></main>;

  if (!isAuthenticated) {
    return (
      <div className="auth-page ui-page">
        <aside className="auth-story">
          <Link href="/" className="portal-brand"><span className="brand-logo"><Image src="/logo.png" alt="" width={34} height={34} /></span><span><strong>RAJTECH<span className="brand-dot">.</span></strong><small>TECHNOLOGICAL SYSTEMS</small></span></Link>
          <div><span className="hero-label">{copy('THE PEOPLE BEHIND THE PROGRESS', 'छात्रों की प्रगति के पीछे आप हैं')}</span><h1>{copy('Better learning.', 'बेहतर पढ़ाई।')}<br /><span>{copy('Made possible by you.', 'आपकी मदद से।')}</span></h1><p>{copy('A calmer workspace to support students, build courses, and keep learning moving.', 'छात्रों की मदद करें, कोर्स बनाएँ और पढ़ाई को आगे बढ़ाएँ। सब एक आसान जगह पर।')}</p></div>
          <div className="auth-story-footer">{copy('Rajtech · Admin workspace', 'राजटेक · प्रबंधन की जगह')}</div>
        </aside>
        <main className="auth-form-panel"><div className="auth-top"><Link href="/">← {copy('Back to website', 'वेबसाइट पर वापस')}</Link><LangToggle /></div><div className="auth-form-wrap"><span className="stat-icon teal"><Icon name="lock" size={23} /></span><h2>{copy('Welcome back, admin.', 'स्वागत है, एडमिन।')}</h2><p>{copy('Sign in to manage your internship programme.', 'इंटर्नशिप का काम सँभालने के लिए लॉगिन करें।')}</p>
          <form onSubmit={handleLogin} className="space-y-5" aria-busy={loading}>
            <div><label className="ui-label" htmlFor="admin-pw">{copy('Admin password', 'एडमिन पासवर्ड')}</label><input id="admin-pw" type="password" className="ui-field" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></div>
            {authError && <div role="alert" className="text-sm" style={{ color: 'var(--bad)' }}>{copy('Could not sign in. Check your password and connection, then try again.', 'लॉगिन नहीं हुआ। पासवर्ड और इंटरनेट जाँचकर फिर कोशिश करें।')}</div>}
            <button type="submit" disabled={loading} className="ui-btn ui-btn-primary w-full">{loading ? <BusyText>{copy('Checking…', 'जाँच रहे हैं…')}</BusyText> : copy('Open admin workspace', 'एडमिन पेज खोलें')}<Icon name="arrow" size={17} /></button>
          </form><div className="auth-register">{copy('Are you a student?', 'क्या आप छात्र हैं?')} <Link href="/portal/login">{copy('Go to student sign in', 'छात्र लॉगिन पर जाएँ')} →</Link></div>
        </div></main>
      </div>
    );
  }

  const TABS: { key: AdminTab; label: string; hindi: string; description: string; hint: string; icon: IconName; count?: number }[] = [
    { key: 'analytics', label: 'Overview', hindi: 'एक नज़र में', icon: 'grid', description: copy('Your internship, at a glance.', 'आपकी इंटर्नशिप, एक नज़र में।'), hint: copy('See how learning is going and where your students need support.', 'देखें कि पढ़ाई कैसी चल रही है और किन छात्रों को मदद चाहिए।') },
    { key: 'students', label: 'Students', hindi: 'छात्र', icon: 'users', description: copy('Find and support your students.', 'छात्रों को खोजें और मदद करें।'), hint: copy('Find a student, assign a course, or check their lesson progress.', 'छात्र खोजें, कोर्स जोड़ें या उनकी पढ़ाई की प्रगति देखें।') },
    { key: 'courses', label: 'Courses & lessons', hindi: 'कोर्स और पाठ', icon: 'book', description: copy('Manage courses and lessons.', 'कोर्स और पाठ सँभालें।'), hint: copy('Create a course, add modules, then publish lessons for your students.', 'कोर्स बनाएँ, उसमें भाग जोड़ें, फिर छात्रों के लिए पाठ प्रकाशित करें।') },
    { key: 'questions', label: 'Student questions', hindi: 'छात्रों के सवाल', icon: 'message', count: openQuestions || undefined, description: copy('Answer your students’ questions.', 'छात्रों के सवालों के जवाब दें।'), hint: copy('Reply in simple Hindi or English. Students see your answer below their lesson.', 'सरल हिन्दी या अंग्रेज़ी में जवाब दें। छात्रों को जवाब उनके पाठ के नीचे दिखेगा।') },
    { key: 'applications', label: 'Applications', hindi: 'आवेदन', icon: 'file', count: pendingCount, description: copy('Review internship applications.', 'इंटर्नशिप के आवेदन देखें।'), hint: copy('Review applications and approve or reject admission. Students cannot learn until you approve.', 'आवेदन जाँचें और प्रवेश मंज़ूर या नामंज़ूर करें। आपकी मंज़ूरी के बिना छात्र पढ़ाई शुरू नहीं कर सकते।') },
    { key: 'enquiries', label: 'Enquiries', hindi: 'पूछताछ', icon: 'help', count: enquiries.length, description: copy('Respond to student enquiries.', 'छात्रों की पूछताछ का जवाब दें।'), hint: copy('Find students who need more information and help them get started.', 'जानकारी चाहने वाले छात्रों से संपर्क करें और शुरू करने में मदद करें।') },
    { key: 'news', label: 'Announcements', hindi: 'सूचनाएँ', icon: 'bell', count: newsItems.length || undefined, description: copy('Share an announcement.', 'सभी तक ज़रूरी सूचना पहुँचाएँ।'), hint: copy('Add notices to the homepage Notice Board. You can publish several notices; long lists scroll automatically.', 'मुख्य पेज के सूचना बोर्ड के लिए सूचनाएँ जोड़ें। कई सूचनाएँ जोड़ सकते हैं; लंबी सूची अपने आप स्क्रॉल होगी।') },
  ];
  const current = TABS.find((item) => item.key === activeTab)!;
  const selectTab = (key: AdminTab) => { setActiveTab(key); setMenuOpen(false); if (key === 'news') fetchNews(); };
  async function approveAllPending() {
    setBulkConfirm(false); setBulkBusy(true); setBulkMsg('');
    let approved = 0;
    const failed: { id: string; name: string; reason: string }[] = [];
    try {
      // The server approves in batches; keep calling until nothing is left (failed ones are skipped).
      for (;;) {
        const res = await fetch('/api/admin/submissions/approve-all', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skipIds: failed.map((f) => f.id) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        approved += data.approved; failed.push(...data.failed);
        setBulkMsg(copy(`Approved ${approved} so far…`, `अब तक ${approved} मंज़ूर…`));
        if (!data.remaining) break;
      }
      setBulkMsg(failed.length
        ? copy(`Approved ${approved}. ${failed.length} need a look: ${failed.slice(0, 5).map((f) => `${f.name} (${f.reason})`).join(', ')}${failed.length > 5 ? '…' : ''}`, `${approved} मंज़ूर। ${failed.length} को जाँचें: ${failed.slice(0, 5).map((f) => f.name).join(', ')}`)
        : copy(`Approved ${approved} applications.`, `${approved} आवेदन मंज़ूर हो गए।`));
    } catch {
      setBulkMsg(copy(`Stopped after approving ${approved}. Check your connection and try again.`, `${approved} मंज़ूर होने के बाद रुक गया। इंटरनेट जाँचें और फिर कोशिश करें।`));
    } finally { setBulkBusy(false); fetchSubmissions(); }
  }

  const refresh = () => { fetchSubmissions(); fetchAnalytics(); fetchEnquiries(); refreshOpenQuestions(); if (activeTab === 'news') fetchNews(); setRefreshKey((key) => key + 1); };

  return (
    <div className="ui-page admin-shell">
      <a className="skip-link" href="#main-content">{copy('Skip to content', 'मुख्य जानकारी पर जाएँ')}</a>
      {menuOpen && <div className="admin-mobile-backdrop" onClick={() => setMenuOpen(false)} />}
      <div ref={menuRef} tabIndex={-1} className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`} role={menuOpen ? 'dialog' : undefined} aria-modal={menuOpen ? true : undefined} aria-label={copy('Admin navigation', 'एडमिन नेविगेशन')}>
        <div className="flex items-center justify-between"><Link href="/" className="portal-brand"><span className="brand-logo"><Image src="/logo.png" alt="" width={30} height={30} /></span><span><strong>RAJTECH<span className="brand-dot">.</span></strong><small>{copy('Admin workspace', 'एडमिन की जगह')}</small></span></Link><button className="icon-button admin-mobile-menu" onClick={() => setMenuOpen(false)} aria-label={copy('Close menu', 'मेन्यू बंद करें')}><Icon name="close" size={18} /></button></div>
        <div><div className="admin-nav-label">{copy('WORKSPACE', 'काम की जगह')}</div><nav className="admin-nav" aria-label={copy('Admin sections', 'एडमिन के भाग')}>{TABS.map((item) => <button key={item.key} aria-current={activeTab === item.key ? 'page' : undefined} onClick={() => selectTab(item.key)}><Icon name={item.icon} size={19} /><span>{copy(item.label, item.hindi)}</span>{!!item.count && <span className={`admin-nav-count ${item.key === 'questions' ? 'needs-answer' : ''}`}>{item.count}</span>}</button>)}</nav></div>
        <div className="admin-sidebar-bottom"><span className="hero-label">{copy('HERE TO HELP YOU HELP', 'आपकी मदद के लिए')}</span><p>{copy('Less time finding things. More time helping students.', 'जानकारी खोजने में कम समय। छात्रों की मदद में ज़्यादा समय।')}</p><Walkthrough kind="admin" storageKey="rts_tour_admin" /><Link href="/portal/videos" className="mt-5"><Icon name="book" size={17} />{copy('Open student portal', 'छात्र पेज खोलें')} ↗</Link></div>
      </div>
      <header className="admin-topbar"><div className="admin-topbar-title"><button className="icon-button admin-mobile-menu" aria-expanded={menuOpen} aria-label={copy('Open menu', 'मेन्यू खोलें')} onClick={() => setMenuOpen(true)}><Icon name="menu" size={19} /></button><span>{copy('Workspace', 'काम की जगह')} /</span><strong>{copy(current.label, current.hindi)}</strong></div><div className="admin-topbar-actions"><LangToggle /><button className="icon-button" onClick={refresh} aria-label={copy('Refresh data', 'जानकारी फिर लाएँ')} title={copy('Refresh data', 'जानकारी फिर लाएँ')}>{loading ? <Spinner /> : <Icon name="refresh" size={18} />}</button><button className="icon-button" disabled={signingOut} onClick={async () => {
        setSigningOut(true);
        try { const res = await fetch('/api/admin/logout', { method: 'POST' }); if (!res.ok) throw new Error('logout'); setIsAuthenticated(false); setPassword(''); setSubmissions([]); }
        catch { setAuthError(copy('Could not sign out. Please try again.', 'बाहर नहीं निकल पाए। फिर कोशिश करें।')); } finally { setSigningOut(false); }
      }} aria-label={copy('Sign out', 'बाहर निकलें')} title={copy('Sign out', 'बाहर निकलें')}>{signingOut ? <Spinner /> : <Icon name="logout" size={18} />}</button></div></header>
      <main id="main-content" tabIndex={-1} className="admin-content">
        <section className="admin-context"><div className="page-heading"><div><div className="ui-eyebrow">{copy(current.label, current.hindi)}</div><h1>{current.description}</h1><p>{current.hint}</p></div>{activeTab === 'applications' && <button className="ui-btn ui-btn-primary" onClick={() => { setScratchForm(SCRATCH_DEFAULTS); setScratchResult(null); setScratchModalOpen(true); }}><Icon name="award" size={18} />{copy('New certificate', 'नया प्रमाणपत्र')}</button>}</div>
          <div className="admin-action-strip"><p>{copy('Clear next steps. Everything in its place.', 'अगला कदम साफ़ है। हर चीज़ अपनी जगह है।')}</p><details className="admin-tools"><summary className="ui-btn ui-btn-sm"><Icon name="download" size={16} />{copy('Downloads', 'डाउनलोड')}</summary><div className="admin-tools-menu"><button onClick={exportToCSV}><Icon name="file" size={17} />{copy('Application records (CSV)', 'आवेदन रिकॉर्ड (CSV)')}</button><button onClick={downloadAllImagesAsZip} disabled={downloadingZip || submissions.length === 0}><Icon name="download" size={17} />{downloadingZip ? <BusyText>{copy('Preparing images…', 'फ़ोटो तैयार हो रहे हैं…')}</BusyText> : copy('All student images (ZIP)', 'सभी छात्रों के फ़ोटो (ZIP)')}</button></div></details></div>
          {authError && <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--bad)' }}>{authError}</p>}
          {activeTab === 'analytics' && pendingCount > 0 && <div className="admin-alert mt-5"><Icon name="users" size={19} /><span>{copy(`${pendingCount} ${pendingCount === 1 ? 'application needs' : 'applications need'} your approval before students can enter.`, `${pendingCount} छात्रों के प्रवेश के लिए आपकी मंज़ूरी बाकी है।`)}</span><button onClick={() => { setApprovalFilter('pending'); selectTab('applications'); }}>{copy('Review applications', 'आवेदन जाँचें')} →</button></div>}
          {activeTab === 'analytics' && openQuestions > 0 && <div className="admin-alert mt-5"><Icon name="message" size={19} /><span>{copy(`${openQuestions} student question${openQuestions === 1 ? ' is' : 's are'} waiting for your reply.`, `${openQuestions} छात्रों के सवाल आपके जवाब का इंतज़ार कर रहे हैं।`)}</span><button onClick={() => selectTab('questions')}>{copy('Answer questions', 'सवालों के जवाब दें')} →</button></div>}
        </section>
        <div key={refreshKey}>
      {activeTab === 'courses' && <CoursesManager />}
      {activeTab === 'questions' && <QuestionsManager onChanged={refreshOpenQuestions} />}
      {activeTab === 'students' && <StudentsManager key={studentCourse} initialCourse={studentCourse} />}

      {activeTab === 'analytics' && (
        <OverviewTab recent={analytics?.recentSessions || []}
          onOpenCourse={(id) => { setStudentCourse(id); setActiveTab('students'); }} />
      )}

      {/* Enquiries CRM Tab View */}
      {activeTab === 'enquiries' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="bg-white rounded-2xl shadow overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-gray-800">{t("Student Enquiries & Leads CRM")}</h2>
                <p className="text-xs text-gray-500">{t("Inquiries submitted via the /enquiry public form")}</p>
              </div>
              <button
                onClick={fetchEnquiries}
                className="text-xs text-[#1b5e32] hover:underline font-semibold"
              >{t("Refresh Leads")}</button>
            </div>

            {enquiriesLoading ? <LoadingState label={copy('Loading enquiries', 'पूछताछ लोड हो रही है')} /> : enquiriesError ? <div role="alert" className="p-4 text-sm">{copy('Enquiries could not load.', 'पूछताछ नहीं खुल पाई।')} <button className="ui-link" onClick={fetchEnquiries}>{copy('Try again', 'फिर कोशिश करें')}</button></div> : <>
            <div className="admin-enquiry-cards">{enquiries.map((enq) => <article key={enq.id} className="admin-student-card">
              <strong>{enq.full_name}</strong><div className="admin-student-meta"><a className="ui-link" href={`tel:${enq.phone}`}>{enq.phone}</a><span>{enq.course_interest || '—'}</span></div><p className="ui-muted">{enq.college}</p><p className="text-sm break-words">{enq.message || '—'}</p><a className="ui-link text-sm break-all" href={`mailto:${enq.email}`}>{enq.email}</a>
            </article>)}{!enquiries.length && <p className="p-4 ui-muted">{t('No enquiries submitted yet.')}</p>}</div>
            <div className="overflow-x-auto admin-enquiry-table">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">{t("Candidate Name")}</th>
                    <th className="px-4 py-3 text-left">{t("Contact Info")}</th>
                    <th className="px-4 py-3 text-left">{t("College & Course")}</th>
                    <th className="px-4 py-3 text-left">{t("Message")}</th>
                    <th className="px-4 py-3 text-left">{t("Date")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {enquiries.length > 0 ? (
                    enquiries.map((enq) => (
                      <tr key={enq.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-gray-900">{enq.full_name}</td>
                        <td className="px-4 py-3 space-y-0.5">
                          <div className="text-emerald-700 font-semibold">{enq.phone}</div>
                          <div className="text-gray-500 font-mono text-[11px]">{enq.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-800 font-medium">{enq.course_interest || 'N/A'}</div>
                          <div className="text-gray-500 text-[11px]">{enq.college || t("Not specified")}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs">{enq.message || '-'}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {enq.created_at ? new Date(enq.created_at).toLocaleDateString('en-IN') : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t("No enquiries submitted yet.")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div></>}
          </div>
        </div>
      )}

      {/* News Ticker Tab View */}
      {activeTab === 'news' && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Add news form */}
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">{copy('Add a homepage notice', 'मुख्य पेज की सूचना जोड़ें')}</h2><p className="ui-muted mb-5">{copy('Write in English, Hindi, or both. Each active notice appears on the homepage. Use a lower order number to show a notice first.', 'अंग्रेज़ी, हिन्दी या दोनों में लिखें। चालू सूचनाएँ मुख्य पेज पर दिखेंगी। पहले दिखाने के लिए क्रम संख्या छोटी रखें।')}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{t("Message")} <span className="text-red-500">*</span></label>
                <textarea
                  id="notice-message" aria-label={copy('Notice message', 'सूचना का संदेश')} maxLength={5000}
                  value={newsMessage}
                  onChange={e => setNewsMessage(e.target.value)}
                  rows={2}
                  placeholder={copy('e.g. New batch registrations are open. Contact the office to apply.', 'जैसे: नए बैच के आवेदन शुरू हैं। फॉर्म भरने के लिए कार्यालय से संपर्क करें।')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b5e32] focus:border-transparent resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t("Link URL (optional)")}</label>
                  <input
                    type="url"
                    aria-label={copy('Notice link (optional)', 'सूचना का लिंक (ज़रूरी नहीं)')}
                    value={newsLinkUrl}
                    onChange={e => setNewsLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b5e32] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t("Sort Order (lower = first)")}</label>
                  <input
                    type="number"
                    aria-label={copy('Notice display order', 'सूचना का क्रम')}
                    value={newsSortOrder}
                    onChange={e => setNewsSortOrder(Number(e.target.value))}
                    min={0}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b5e32] focus:border-transparent"
                  />
                </div>
              </div>
              {newsError && <p className="text-xs text-red-600 font-medium">{newsError}</p>}
              <button
                disabled={newsSubmitting}
                onClick={async () => {
                  if (!newsMessage.trim()) { setNewsError(t("Message is required")); return; }
                  setNewsError('');
                  setNewsSubmitting(true);
                  try {
                    const res = await fetch('/api/admin/news', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: newsMessage.trim(), link_url: newsLinkUrl.trim() || null, sort_order: newsSortOrder }),
                    });
                    if (res.ok) {
                      setNewsMessage(''); setNewsLinkUrl(''); setNewsSortOrder(0);
                      fetchNews();
                    } else {
                      const d = await res.json();
                      setNewsError(d.error || t("Failed to add news"));
                    }
                  } catch { setNewsError('Network error'); }
                  finally { setNewsSubmitting(false); }
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1b5e32] hover:bg-[#134624] disabled:opacity-50 transition-colors"
              >
                {newsSubmitting ? <BusyText>{copy('Adding…', 'जोड़ रहे हैं…')}</BusyText> : copy('Publish notice', 'सूचना प्रकाशित करें')}
              </button>
            </div>
          </div>

          {/* News list */}
          <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-base font-bold text-gray-800">{t("All News / Announcements")}</h2>
              <button onClick={fetchNews} className="text-xs text-[#1b5e32] hover:underline font-semibold">
                Refresh
              </button>
            </div>
            {newsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-[#1b5e32] border-t-transparent rounded-full mx-auto" />
                <p className="mt-4 text-gray-500 text-sm">{t("Loading...")}</p>
              </div>
            ) : newsItems.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">{t("No news items yet. Add one above.")}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {newsItems.map(item => (
                  <div key={item.id} className="admin-notice-row p-4 flex items-start justify-between gap-4 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 font-medium leading-snug">{item.message}</p>
                      {item.link_url && (
                        <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-0.5 block truncate">
                          {item.link_url}
                        </a>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {item.is_active ? t("Active") : t("Hidden")}
                        </span>
                        <span className="text-[10px] text-gray-400">{t("Order:")} {item.sort_order}</span>
                        <span className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        disabled={newsWorking !== null}
                        aria-busy={newsWorking === item.id}
                        onClick={async () => {
                          setNewsWorking(item.id);
                          try {
                            const response = await fetch('/api/admin/news', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
                            });
                            if (!response.ok) throw new Error('notice');
                            await fetchNews();
                          } catch { setNewsError(copy('Could not update notice. Try again.', 'सूचना नहीं बदल पाई। फिर कोशिश करें।')); } finally { setNewsWorking(null); }
                        }}
                        className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${item.is_active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                      >
                        {newsWorking === item.id ? <BusyText>{t("Saving…")}</BusyText> : item.is_active ? t("Hide") : t("Show")}
                      </button>
                      <button
                        disabled={newsWorking !== null}
                        aria-busy={newsWorking === item.id}
                        onClick={async () => {
                          if (!confirm(t("Delete this news item?"))) return;
                          setNewsWorking(item.id);
                          try {
                            const response = await fetch(`/api/admin/news?id=${item.id}`, {
                              method: 'DELETE',

                            });
                            if (!response.ok) throw new Error('notice');
                            await fetchNews();
                          } catch { setNewsError(copy('Could not update notice. Try again.', 'सूचना नहीं बदल पाई। फिर कोशिश करें।')); } finally { setNewsWorking(null); }
                        }}
                        className="text-xs px-3 py-1.5 rounded font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      >{newsWorking === item.id ? <BusyText>{t("Saving…")}</BusyText> : t("Delete")}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Candidates & Certificates Tab View */}
      {activeTab === 'applications' && (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-3xl font-bold text-[#1b5e32]">{submissions.length}</div>
            <div className="text-gray-500">{t("Total Applications")}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-3xl font-bold text-green-600">
              {submissions.filter(s => new Date(s.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}
            </div>
            <div className="text-gray-500">{t("Last 24 Hours")}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-3xl font-bold text-blue-600">
              {[...new Set(submissions.map(s => s.college_name))].length}
            </div>
            <div className="text-gray-500">{t("Colleges")}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-3xl font-bold text-purple-600">
              {[...new Set(submissions.map(s => s.internship_topic))].length}
            </div>
            <div className="text-gray-500">{t("Topics")}</div>
          </div>
        </div>

        <div className="ui-card ui-card-pad mb-6"><h2 className="ui-h2">{copy('Admission requests', 'प्रवेश के आवेदन')}</h2><p className="ui-muted mt-2">{copy(`${pendingCount} ${pendingCount === 1 ? 'application is' : 'applications are'} waiting for your decision. Open View details to approve or reject.`, `${pendingCount} आवेदन आपके फ़ैसले का इंतज़ार कर रहे हैं। मंज़ूर या नामंज़ूर करने के लिए जानकारी देखें।`)}</p><div className="flex flex-wrap gap-2 mt-4" role="group" aria-label={copy('Filter by admission status', 'प्रवेश की स्थिति के अनुसार चुनें')}>{(['pending', 'approved', 'rejected', 'all'] as const).map((status) => <button key={status} className={`ui-btn ui-btn-sm ${approvalFilter === status ? 'ui-btn-primary' : ''}`} aria-pressed={approvalFilter === status} onClick={() => setApprovalFilter(status)}>{status === 'pending' ? copy('Pending', 'मंज़ूरी बाकी') : status === 'approved' ? copy('Approved', 'मंज़ूर') : status === 'rejected' ? copy('Rejected', 'नामंज़ूर') : copy('All applications', 'सभी आवेदन')} <span className="tnum">{status === 'all' ? submissions.length : submissions.filter((s) => (s.approval_status || 'pending') === status).length}</span></button>)}</div>{pendingCount > 0 && <div className="mt-4 flex flex-wrap items-center gap-3"><button className="ui-btn ui-btn-primary" disabled={bulkBusy} onClick={() => setBulkConfirm(true)}>{bulkBusy ? copy('Approving…', 'मंज़ूर हो रहे हैं…') : copy(`Approve all pending (${pendingCount})`, `सभी बाकी आवेदन मंज़ूर करें (${pendingCount})`)}</button></div>}{bulkMsg && <p role="status" className="ui-muted mt-3">{bulkMsg}</p>}</div>
        {bulkConfirm && <ConfirmDialog tone="brand" title={copy('Approve all pending applications?', 'सभी बाकी आवेदन मंज़ूर करें?')} body={<p>{copy(`${pendingCount} students will be able to sign in with their phone number and roll number. Rejected applications are not affected.`, `${pendingCount} छात्र अपने मोबाइल नंबर और रोल नंबर से लॉगिन कर सकेंगे। नामंज़ूर आवेदन नहीं बदलेंगे।`)}</p>} confirmLabel={copy('Approve all', 'सभी मंज़ूर करें')} onCancel={() => setBulkConfirm(false)} onConfirm={approveAllPending} />}
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={copy('Search applications', 'आवेदन खोजें')} placeholder={t("Search by name, email, phone, or college...")}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b5e32] focus:border-transparent"
          />
        </div>

        {/* Submissions List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-[#1b5e32] border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-4 text-gray-500">{t("Loading submissions...")}</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm ? t("No matching submissions found") : submissions.length === 0 ? t("No submissions yet") : approvalFilter === 'pending' ? copy('No applications are waiting for approval.', 'कोई आवेदन मंज़ूरी के लिए बाकी नहीं है।') : copy('No applications in this category.', 'इस श्रेणी में कोई आवेदन नहीं है।')}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden divide-y divide-gray-200">
                {filteredSubmissions.map((submission, index) => (
                  <div
                    key={submission.id}
                    className="p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate">#{index + 1} {submission.student_name}</div><span className="inline-block mt-2"><ApplicationStatus status={submission.approval_status} /></span>
                        <div className="text-sm text-gray-500 truncate">{submission.email_address}</div>
                      </div>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full flex-shrink-0 ml-2">
                        {submission.internship_topic}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{submission.contact_number}</span>
                      <span className="text-gray-400 text-xs">
                        {new Date(submission.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">{submission.college_name}</div>
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={() => setSelectedSubmission(submission)}
                        className="text-[#1b5e32] text-sm font-medium"
                      >{t("View Details")}</button>
                      <button
                        onClick={() => {
                          setCertTarget(submission);
                          setCertRtsRegNumber('');
                          setCertMarks('');
                          setCertStartDate('');
                          setCertEndDate('');
                          setCertResult(null);
                          setCertModalOpen(true);
                        }}
                        className="text-green-700 text-sm font-medium"
                      >{t("Certificate")}</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">#</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("Student")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("Father's Name")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{copy('Contact', 'संपर्क')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("College")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("Topic")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("Submitted")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredSubmissions.map((submission, index) => (
                      <tr key={submission.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{submission.student_name}</div><span className="inline-block mt-2"><ApplicationStatus status={submission.approval_status} /></span>
                          <div className="text-sm text-gray-500">{submission.email_address}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">{submission.father_name}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-800">{submission.contact_number}</div>
                          {submission.whatsapp_number && (
                            <div className="text-xs text-gray-500">WA: {submission.whatsapp_number}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">{submission.college_name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {submission.internship_topic}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(submission.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedSubmission(submission)}
                              className="text-[#1b5e32] hover:underline text-sm font-medium"
                            >{t("View Details")}</button>
                            <button
                              onClick={() => {
                                setCertTarget(submission);
                                setCertRtsRegNumber('');
                                setCertMarks('');
                                setCertStartDate('');
                                setCertEndDate('');
                                setCertResult(null);
                                setCertModalOpen(true);
                              }}
                              className="text-green-700 hover:underline text-sm font-medium"
                            >{t("Certificate")}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* Certificate Modal */}
      {certModalOpen && certTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 z-50">
          <div className="bg-white sm:rounded-xl rounded-t-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#1b5e32] text-white p-4 flex justify-between items-center rounded-t-2xl sm:rounded-t-xl">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/30 rounded-full sm:hidden"></div>
              <h2 className="text-lg font-bold">{t("Generate Certificate")}</h2>
              <button onClick={() => setCertModalOpen(false)} className="text-white/70 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Student summary */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="font-semibold text-gray-800">{certTarget.student_name}</div>
                <div className="text-gray-500">{t("Uni Reg No:")} {certTarget.university_registration_number}</div>
              </div>

              {/* RTS Reg Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("RTS Registration Number")}</label>
                <input
                  type="text"
                  value={certRtsRegNumber}
                  onChange={(e) => setCertRtsRegNumber(e.target.value)}
                  placeholder="e.g. 1225/RTS-11/RC027/INT959"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b5e32] focus:border-transparent text-sm"
                  disabled={!!certResult?.success}
                />
              </div>

              {/* Marks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Marks (0–100)")}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={certMarks}
                  onChange={(e) => {
                    const v = e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value)));
                    setCertMarks(v);
                  }}
                  placeholder={t("Enter marks")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b5e32] focus:border-transparent text-sm"
                  disabled={!!certResult?.success}
                />
                {certMarks !== '' && (
                  <p className="text-xs text-blue-700 mt-1 font-medium">{t("Grade:")} {previewGrade(certMarks)}</p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Start Date")}</label>
                  <input
                    type="date"
                    value={certStartDate}
                    onChange={(e) => setCertStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b5e32] focus:border-transparent text-sm"
                    disabled={!!certResult?.success}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("End Date")}</label>
                  <input
                    type="date"
                    value={certEndDate}
                    onChange={(e) => setCertEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b5e32] focus:border-transparent text-sm"
                    disabled={!!certResult?.success}
                  />
                </div>
              </div>

              {/* Generate button */}
              {!certResult?.success && (
                <button
                  onClick={handleGenerateCertificate}
                  disabled={
                    certLoading ||
                    certMarks === '' ||
                    !certStartDate ||
                    !certEndDate ||
                    !certRtsRegNumber.trim()
                  }
                  className="w-full bg-[#1b5e32] text-white py-2.5 rounded-lg font-medium hover:bg-[#134624] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {certLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>{t("Generating...")}</>
                  ) : (
                    t("Generate Certificate")
                  )}
                </button>
              )}

              {/* Result banner */}
              {certResult?.success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm space-y-2">
                  <div className="font-semibold text-green-800">{t("Certificate generated successfully!")}</div>
                  <div className="text-green-700">{t("Serial:")} {certResult.serialNumber}</div>
                  <div className="text-green-700">{t("Grade:")} {certResult.grade}</div>
                  {certResult.viewUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs">{t("View URL:")}</span>
                      <a href={certResult.viewUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-700 hover:underline text-xs break-all font-mono">{certResult.viewUrl}</a>
                      <button onClick={() => navigator.clipboard.writeText(certResult.viewUrl!)}
                        className="text-gray-400 hover:text-gray-700 flex-shrink-0" title={t("Copy URL")}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {certResult.certificateUrl && (
                    <a href={certResult.certificateUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>{t("Download PDF")}</a>
                  )}
                </div>
              )}

              {certResult?.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {certResult.error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scratch Certificate Modal */}
      {scratchModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 z-50">
          <div className="bg-white sm:rounded-xl rounded-t-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-emerald-700 text-white p-4 flex justify-between items-center rounded-t-2xl sm:rounded-t-xl z-10">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/30 rounded-full sm:hidden"></div>
              <h2 className="text-lg font-bold">{t("New Certificate (Walk-in Student)")}</h2>
              <button onClick={() => setScratchModalOpen(false)} className="text-white/70 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Student Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("Student Details")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Student Name *")}</label>
                    <input type="text" value={scratchForm.studentName} onChange={e => setScratch('studentName', e.target.value)}
                      placeholder={t("Full name")} disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Father's Name *")}</label>
                    <input type="text" value={scratchForm.fatherName} onChange={e => setScratch('fatherName', e.target.value)}
                      placeholder={copy("Father's full name", "पिता का पूरा नाम")} disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Gender *")}</label>
                    <select value={scratchForm.gender} onChange={e => setScratch('gender', e.target.value)}
                      disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                      {GENDER_OPTIONS.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Date of Birth")} <span className="text-gray-400">{t("(optional)")}</span></label>
                    <input type="date" value={scratchForm.dob} onChange={e => setScratch('dob', e.target.value)}
                      disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Contact Number *")}</label>
                    <input type="text" value={scratchForm.contact} onChange={e => setScratch('contact', e.target.value)}
                      placeholder={copy("10-digit number", "10 अंकों का मोबाइल नंबर")} disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Email")} <span className="text-gray-400">{t("(optional)")}</span></label>
                    <input type="email" value={scratchForm.email} onChange={e => setScratch('email', e.target.value)}
                      placeholder={copy("Leave blank to create automatically", "खाली छोड़ने पर अपने आप बनेगा")} disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Course *")}</label>
                    <select value={scratchForm.course} onChange={e => setScratch('course', e.target.value)}
                      disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                      <option value="">{t("Select Course")}</option>
                      {COURSES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    {scratchForm.course === 'Other' && (
                      <input type="text" value={scratchForm.otherCourse} onChange={e => setScratch('otherCourse', e.target.value)}
                        placeholder={t("Enter course name")} disabled={!!scratchResult?.success}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Internship Topic *")}</label>
                    <select value={scratchForm.topic} onChange={e => setScratch('topic', e.target.value)}
                      disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                      <option value="">{t("Select Topic")}</option>
                      {INTERNSHIP_TOPICS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("College Name *")}</label>
                    <select value={scratchForm.college} onChange={e => setScratch('college', e.target.value)}
                      disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                      <option value="">{t("Select College")}</option>
                      {COLLEGES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    {scratchForm.college === 'Other' && (
                      <input type="text" value={scratchForm.otherCollege} onChange={e => setScratch('otherCollege', e.target.value)}
                        placeholder={t("Enter college name")} disabled={!!scratchResult?.success}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Honours Subject *")}</label>
                    <select value={scratchForm.honoursSubject} onChange={e => setScratch('honoursSubject', e.target.value)}
                      disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                      <option value="">{t("Select Subject")}</option>
                      {HONOURS_SUBJECTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                    {scratchForm.honoursSubject === 'Other' && (
                      <input type="text" value={scratchForm.otherHonoursSubject} onChange={e => setScratch('otherHonoursSubject', e.target.value)}
                        placeholder={t("Enter subject name")} disabled={!!scratchResult?.success}
                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Current Semester *")}</label>
                    <select value={scratchForm.semester} onChange={e => setScratch('semester', e.target.value)}
                      disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                      <option value="">{t("Select Semester")}</option>
                      {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Class Roll No *")}</label>
                    <input type="text" value={scratchForm.classRoll} onChange={e => setScratch('classRoll', e.target.value)}
                      placeholder={t("Class roll number")} disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("University Roll No *")}</label>
                    <input type="text" value={scratchForm.rollNo} onChange={e => setScratch('rollNo', e.target.value)}
                      placeholder={t("University roll number")} disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("University Reg No *")}</label>
                    <input type="text" value={scratchForm.regNo} onChange={e => setScratch('regNo', e.target.value)}
                      placeholder={t("University registration number")} disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Student Photo")} <span className="text-gray-400">{t("(optional)")}</span></label>
                    {scratchForm.photo ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={scratchForm.photo} alt={t("Preview")} className="w-16 h-20 object-cover rounded border" />
                        <button onClick={() => setScratch('photo', null)}
                          className="text-red-600 text-sm hover:underline" disabled={!!scratchResult?.success}>{t("Remove")}</button>
                      </div>
                    ) : (
                      <input type="file" accept="image/*" disabled={!!scratchResult?.success}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => setScratch('photo', ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }}
                        className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                    )}
                  </div>
                </div>
              </div>

              {/* Certificate Details */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t("Certificate Details")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("RTS Registration Number *")}</label>
                    <input type="text" value={scratchForm.rtsRegNumber} onChange={e => setScratch('rtsRegNumber', e.target.value)}
                      placeholder="e.g. 1225/RTS-11/RC027/INT959" disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Marks (0–100) *")}</label>
                    <input type="number" min={0} max={100} value={scratchForm.marks} disabled={!!scratchResult?.success}
                      onChange={e => setScratch('marks', e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value))))}
                      placeholder={t("Enter marks")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                    {scratchForm.marks !== '' && (
                      <p className="text-xs text-emerald-700 mt-1 font-medium">{t("Grade:")} {previewGrade(scratchForm.marks)}</p>
                    )}
                  </div>
                  <div></div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("Start Date *")}</label>
                    <input type="date" value={scratchForm.startDate} onChange={e => setScratch('startDate', e.target.value)}
                      disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t("End Date *")}</label>
                    <input type="date" value={scratchForm.endDate} onChange={e => setScratch('endDate', e.target.value)}
                      disabled={!!scratchResult?.success}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                </div>
              </div>

              {/* Generate button */}
              {!scratchResult?.success && (
                <button onClick={handleGenerateScratchCertificate} disabled={
                  scratchLoading || !scratchForm.studentName || !scratchForm.fatherName ||
                  !scratchForm.course || (scratchForm.course === 'Other' && !scratchForm.otherCourse) ||
                  !scratchForm.college || (scratchForm.college === 'Other' && !scratchForm.otherCollege) ||
                  !scratchForm.honoursSubject || (scratchForm.honoursSubject === 'Other' && !scratchForm.otherHonoursSubject) ||
                  !scratchForm.semester || !scratchForm.topic ||
                  !scratchForm.rollNo || !scratchForm.regNo || !scratchForm.classRoll ||
                  !scratchForm.rtsRegNumber.trim() ||
                  scratchForm.marks === '' || !scratchForm.startDate || !scratchForm.endDate
                }
                  className="w-full bg-emerald-700 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {scratchLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>{t("Generating...")}</>
                  ) : t("Generate Certificate")}
                </button>
              )}

              {/* Result banner */}
              {scratchResult?.success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm space-y-2">
                  <div className="font-semibold text-green-800">{t("Certificate generated successfully!")}</div>
                  <div className="text-green-700">{t("Serial:")} {scratchResult.serialNumber}</div>
                  <div className="text-green-700">{t("Grade:")} {scratchResult.grade}</div>
                  {scratchResult.viewUrl && (
                    <div className="space-y-1">
                      <div className="text-xs text-gray-600 font-medium">{t("Certificate view URL (share this):")}</div>
                      <div className="flex items-center gap-2 bg-white border rounded p-2">
                        <a href={scratchResult.viewUrl} target="_blank" rel="noopener noreferrer"
                          className="text-blue-700 hover:underline text-xs break-all font-mono flex-1">{scratchResult.viewUrl}</a>
                        <button onClick={() => navigator.clipboard.writeText(scratchResult!.viewUrl!)}
                          className="text-gray-400 hover:text-gray-700 flex-shrink-0" title={t("Copy URL")}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  {scratchResult.certificateUrl && (
                    <a href={scratchResult.certificateUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>{t("Download PDF")}</a>
                  )}
                </div>
              )}

              {scratchResult?.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {scratchResult.error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {
        selectedSubmission && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 z-50">
            <div ref={detailsDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={copy('Application details and admission review', 'आवेदन की जानकारी और प्रवेश का फ़ैसला')} className="bg-white sm:rounded-xl rounded-t-2xl w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-[#1b5e32] text-white p-4 flex justify-between items-center rounded-t-2xl sm:rounded-t-xl">
                {/* Mobile drag indicator */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/30 rounded-full sm:hidden"></div>
                <h2 className="text-xl font-bold">{t("Application Details")}</h2>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  aria-label={copy('Close application details', 'आवेदन जानकारी बंद करें')}
                  className="text-white/70 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                <ApplicationReview key={selectedSubmission.id} application={selectedSubmission} onReviewed={(update) => {
                  setSubmissions((rows) => rows.map((row) => row.id === selectedSubmission.id ? { ...row, ...update } : row));
                  setSelectedSubmission((row) => row ? { ...row, ...update } : row);
                }} />
                {/* Photo & Signature */}
                {(selectedSubmission.photo || selectedSubmission.signature) && (
                  <div className="flex flex-wrap gap-6 justify-center">
                    {selectedSubmission.photo && (
                      <div className="text-center">
                        <Image
                          src={selectedSubmission.photo}
                          alt={t("Photo")}
                          width={120}
                          height={150}
                          className="rounded border object-cover"
                        />
                        <p className="text-xs text-gray-500 mt-1">{t("Photo")}</p>
                        <button
                          onClick={() => {
                            const photo = selectedSubmission.photo!;
                            const safeName = selectedSubmission.student_name.replace(/[^a-zA-Z0-9]/g, '_');
                            // Determine extension from URL or base64
                            let ext = 'jpg';
                            if (isUrl(photo)) {
                              const urlParts = photo.split('.');
                              ext = urlParts[urlParts.length - 1].split('?')[0] || 'jpg';
                            } else {
                              ext = photo.match(/^data:image\/(\w+);/)?.[1] || 'jpg';
                            }
                            downloadImage(photo, `${safeName}_photo.${ext}`);
                          }}
                          className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1 mx-auto"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>{t("Download")}</button>
                      </div>
                    )}
                    {selectedSubmission.signature && (
                      <div className="text-center">
                        <Image
                          src={selectedSubmission.signature}
                          alt={t("Signature")}
                          width={150}
                          height={60}
                          className="rounded border object-contain bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">{t("Signature")}</p>
                        <button
                          onClick={() => {
                            const sig = selectedSubmission.signature!;
                            const safeName = selectedSubmission.student_name.replace(/[^a-zA-Z0-9]/g, '_');
                            // Determine extension from URL or base64
                            let ext = 'png';
                            if (isUrl(sig)) {
                              const urlParts = sig.split('.');
                              ext = urlParts[urlParts.length - 1].split('?')[0] || 'png';
                            } else {
                              ext = sig.match(/^data:image\/(\w+);/)?.[1] || 'png';
                            }
                            downloadImage(sig, `${safeName}_signature.${ext}`);
                          }}
                          className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1 mx-auto"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>{t("Download")}</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Personal Info */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#1b5e32] rounded-full"></span>{t("Personal Information")}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                    <div><span className="text-gray-500">{t("Name:")}</span> <span className="font-medium">{selectedSubmission.student_name}</span></div>
                    <div><span className="text-gray-500">{t("Gender:")}</span> <span className="font-medium">{selectedSubmission.gender}</span></div>
                    <div><span className="text-gray-500">{t("Father:")}</span> <span className="font-medium">{selectedSubmission.father_name}</span></div>
                    <div><span className="text-gray-500">{t("Mother:")}</span> <span className="font-medium">{selectedSubmission.mother_name}</span></div>
                    <div><span className="text-gray-500">{t("DOB:")}</span> <span className="font-medium">{selectedSubmission.date_of_birth}</span></div>
                    <div className="col-span-2"><span className="text-gray-500">{t("Address:")}</span> <span className="font-medium">{selectedSubmission.address}</span></div>
                  </div>
                </div>

                {/* Academic Info */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>{t("Academic Information")}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                    <div><span className="text-gray-500">{t("Topic:")}</span> <span className="font-medium">{selectedSubmission.internship_topic}</span></div>
                    <div><span className="text-gray-500">{t("College:")}</span> <span className="font-medium">{selectedSubmission.college_name}</span></div>
                    <div><span className="text-gray-500">{t("Honours:")}</span> <span className="font-medium">{selectedSubmission.honours_subject}</span></div>
                    <div><span className="text-gray-500">{t("Semester:")}</span> <span className="font-medium">{selectedSubmission.current_semester}</span></div>
                    <div><span className="text-gray-500">{t("Class Roll:")}</span> <span className="font-medium">{selectedSubmission.class_roll_no}</span></div>
                    <div><span className="text-gray-500">{t("University:")}</span> <span className="font-medium">{selectedSubmission.university_name}</span></div>
                    <div><span className="text-gray-500">{t("Uni Roll No:")}</span> <span className="font-medium">{selectedSubmission.university_roll_number}</span></div>
                    <div><span className="text-gray-500">{t("Uni Reg No:")}</span> <span className="font-medium">{selectedSubmission.university_registration_number}</span></div>
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>{t("Contact Information")}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                    <div><span className="text-gray-500">{t("Phone:")}</span> <span className="font-medium">{selectedSubmission.contact_number}</span></div>
                    <div><span className="text-gray-500">{t("WhatsApp:")}</span> <span className="font-medium">{selectedSubmission.whatsapp_number || t("Same as phone")}</span></div>
                    <div className="col-span-2"><span className="text-gray-500">{t("Email:")}</span> <span className="font-medium">{selectedSubmission.email_address}</span></div>
                  </div>
                </div>

                <div className="text-xs text-gray-400 pt-4 border-t">{t("Submitted on")} {new Date(selectedSubmission.created_at).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        )
      }
        </div>
      </main>
    </div >
  );
}

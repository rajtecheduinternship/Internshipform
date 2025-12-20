'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  InternshipFormData,
  GENDER_OPTIONS,
  INTERNSHIP_TOPICS,
  COLLEGES,
  HONOURS_SUBJECTS,
  SEMESTERS,
} from '@/lib/types';

// Icons as SVG components
const PersonIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const AcademicIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
  </svg>
);

const UploadIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
  </svg>
);

const DeclarationIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
  </svg>
);

const CameraIcon = () => (
  <svg className="w-12 h-12 text-gray-300 group-hover:text-purple-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
);

const SignatureIcon = () => (
  <svg className="w-12 h-12 text-gray-300 group-hover:text-purple-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
  </svg>
);

const initialFormData: InternshipFormData = {
  studentName: '',
  fatherName: '',
  motherName: '',
  gender: '',
  dateOfBirth: '',
  address: '',
  internshipTopic: '',
  collegeName: '',
  honoursSubject: '',
  currentSemester: '',
  classRollNo: '',
  universityName: 'Patliputra University',
  universityRollNumber: '',
  universityRegistrationNumber: '',
  contactNumber: '',
  whatsappNumber: '',
  emailAddress: '',
  photo: '',
  signature: '',
  declarationAccepted: false,
};

// Animated background particles
const FloatingParticle = ({ delay, duration, size, left, top }: { delay: number; duration: number; size: number; left: string; top: string }) => (
  <div
    className="absolute rounded-full bg-gradient-to-r from-emerald-400/20 to-teal-400/20 animate-float"
    style={{
      width: size,
      height: size,
      left,
      top,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  />
);

export default function InternshipForm() {
  const [formData, setFormData] = useState<InternshipFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const [honeypot, setHoneypot] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setSubmitStatus({ type: 'error', message: 'Please upload only JPG or PNG images' });
      return;
    }

    const maxSize = type === 'photo' ? 500 * 1024 : 300 * 1024;
    if (file.size > maxSize) {
      setSubmitStatus({
        type: 'error',
        message: `${type === 'photo' ? 'Photo' : 'Signature'} must be less than ${type === 'photo' ? '500' : '300'} KB`
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === 'photo') {
        setPhotoPreview(base64);
        setFormData(prev => ({ ...prev, photo: base64 }));
      } else {
        setSignaturePreview(base64);
        setFormData(prev => ({ ...prev, signature: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const validateForm = (): string | null => {
    if (!formData.studentName.trim()) return 'Student Name is required';
    if (!formData.fatherName.trim()) return 'Father\'s Name is required';
    if (!formData.motherName.trim()) return 'Mother\'s Name is required';
    if (!formData.gender) return 'Please select Gender';
    if (!formData.dateOfBirth) return 'Date of Birth is required';
    if (!formData.address.trim()) return 'Address is required';
    if (!formData.internshipTopic) return 'Please select Internship Topic';
    if (!formData.collegeName) return 'Please select College Name';
    if (!formData.honoursSubject) return 'Please select Honours Subject';
    if (!formData.currentSemester) return 'Please select Current Semester';
    if (!formData.classRollNo.trim()) return 'Class Roll No is required';
    if (!formData.universityRollNumber.trim()) return 'University Roll Number is required';
    if (!formData.universityRegistrationNumber.trim()) return 'University Registration Number is required';
    if (!formData.contactNumber.trim()) return 'Contact Number is required';
    if (!/^\d{10}$/.test(formData.contactNumber)) return 'Contact Number must be 10 digits';
    if (!formData.emailAddress.trim()) return 'Email Address is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailAddress)) return 'Please enter a valid email address';
    if (!formData.declarationAccepted) return 'Please accept the declaration';
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

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitStatus({ type: 'success', message: 'Application submitted successfully!' });
        handleReset();
      } else {
        setSubmitStatus({ type: 'error', message: result.error || 'Failed to submit application' });
      }
    } catch {
      setSubmitStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setPhotoPreview(null);
    setSignaturePreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (signatureInputRef.current) signatureInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2310b981' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"}} />
        {mounted && (
          <>
            <FloatingParticle delay={0} duration={20} size={300} left="10%" top="20%" />
            <FloatingParticle delay={5} duration={25} size={200} left="70%" top="10%" />
            <FloatingParticle delay={10} duration={30} size={250} left="80%" top="60%" />
            <FloatingParticle delay={3} duration={22} size={180} left="20%" top="70%" />
            <FloatingParticle delay={8} duration={28} size={220} left="50%" top="40%" />
          </>
        )}
        {/* Gradient Orbs */}
        <div className="absolute top-0 -left-40 w-80 h-80 bg-emerald-500/30 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-0 -right-40 w-80 h-80 bg-teal-500/30 rounded-full blur-[100px] animate-pulse-slow animation-delay-2000" />
      </div>

      {/* Top Banner */}
      <div className="relative bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white py-3 px-4 text-center shadow-lg backdrop-blur-sm bg-opacity-90">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        <span className="relative font-semibold tracking-wide">Patliputra University Internship Program 2024-25</span>
      </div>

      <div className="relative max-w-4xl mx-auto py-8 px-4">
        {/* Header Card with 3D effect */}
        <div
          className={`transform transition-all duration-1000 ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}
        >
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden mb-8 border border-white/20 hover:shadow-emerald-500/20 hover:shadow-3xl transition-all duration-500 group">
            {/* Glassmorphism overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            {/* Company Header */}
            <div className="relative bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80 p-8 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  {/* 3D Logo */}
                  <div className="relative transform hover:scale-110 transition-transform duration-300">
                    <div className="absolute inset-0 bg-emerald-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                    <div className="relative bg-white rounded-2xl p-3 shadow-2xl transform hover:rotate-3 transition-transform duration-300">
                      <Image
                        src="/logo.svg"
                        alt="RTS Logo"
                        width={70}
                        height={60}
                        className="h-14 w-auto"
                      />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">
                      Rajtech Technological Systems
                    </h1>
                    <p className="text-emerald-300 text-sm md:text-lg font-medium mt-2 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      Excellence in Computer Education
                    </p>
                  </div>
                </div>
                <a
                  href="https://rtseducation.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-white/20 px-5 py-3 rounded-xl transition-all duration-300 text-sm border border-white/20 hover:border-white/40 hover:scale-105 hover:shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                  Visit Website
                </a>
              </div>
            </div>

            {/* Form Title with gradient */}
            <div className="relative bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 px-8 py-5 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              <div className="relative flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm shadow-inner">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white drop-shadow-md">Internship Registration Form</h2>
                  <p className="text-emerald-100 text-sm mt-1">Fill all required fields carefully</p>
                </div>
              </div>
            </div>

            {/* Mobile Website Link */}
            <div className="md:hidden bg-white/5 px-6 py-4 border-t border-white/10">
              <a
                href="https://rtseducation.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-300 hover:text-emerald-200 flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Visit Official Website: rtseducation.in
              </a>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Honeypot */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ display: 'none' }}
            tabIndex={-1}
            autoComplete="off"
          />

          {/* Personal Information */}
          <div
            className={`transform transition-all duration-700 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
          >
            <div className="group relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/20 hover:border-white/30 hover:shadow-2xl hover:shadow-slate-500/10 transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 px-8 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <div className="relative flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-xl shadow-inner transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <PersonIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white">Personal Information</h3>
                </div>
              </div>
              <div className="relative p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group/input">
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Student Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="studentName"
                      value={formData.studentName}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-emerald-400 focus:bg-white/15 transition-all duration-300 text-white placeholder-white/40 backdrop-blur-sm focus:shadow-lg focus:shadow-emerald-500/20 focus:-translate-y-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Father&apos;s Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="fatherName"
                      value={formData.fatherName}
                      onChange={handleInputChange}
                      placeholder="Enter father's name"
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-emerald-400 focus:bg-white/15 transition-all duration-300 text-white placeholder-white/40 backdrop-blur-sm focus:shadow-lg focus:shadow-emerald-500/20 focus:-translate-y-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Mother&apos;s Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="motherName"
                      value={formData.motherName}
                      onChange={handleInputChange}
                      placeholder="Enter mother's name"
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-emerald-400 focus:bg-white/15 transition-all duration-300 text-white placeholder-white/40 backdrop-blur-sm focus:shadow-lg focus:shadow-emerald-500/20 focus:-translate-y-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Gender <span className="text-red-400">*</span>
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-emerald-400 focus:bg-white/15 transition-all duration-300 text-white backdrop-blur-sm focus:shadow-lg focus:shadow-emerald-500/20 focus:-translate-y-0.5 [&>option]:bg-slate-800 [&>option]:text-white"
                    >
                      <option value="">Select Gender</option>
                      {GENDER_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Date of Birth <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-emerald-400 focus:bg-white/15 transition-all duration-300 text-white backdrop-blur-sm focus:shadow-lg focus:shadow-emerald-500/20 focus:-translate-y-0.5 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-semibold text-white/80 mb-3">
                    Address <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter your complete address"
                    rows={3}
                    className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-emerald-400 focus:bg-white/15 transition-all duration-300 text-white placeholder-white/40 backdrop-blur-sm resize-none focus:shadow-lg focus:shadow-emerald-500/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div
            className={`transform transition-all duration-700 delay-200 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
          >
            <div className="group relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/20 hover:border-blue-400/30 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-8 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <div className="relative flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-xl shadow-inner transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <AcademicIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white">Academic Information</h3>
                </div>
              </div>
              <div className="relative p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Internship Topic <span className="text-red-400">*</span>
                    </label>
                    <select
                      name="internshipTopic"
                      value={formData.internshipTopic}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-blue-400 focus:bg-white/15 transition-all duration-300 text-white backdrop-blur-sm focus:shadow-lg focus:shadow-blue-500/20 focus:-translate-y-0.5 [&>option]:bg-slate-800 [&>option]:text-white"
                    >
                      <option value="">Select Internship Topic</option>
                      {INTERNSHIP_TOPICS.map(topic => (
                        <option key={topic} value={topic}>{topic}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      College Name <span className="text-red-400">*</span>
                    </label>
                    <select
                      name="collegeName"
                      value={formData.collegeName}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-blue-400 focus:bg-white/15 transition-all duration-300 text-white backdrop-blur-sm focus:shadow-lg focus:shadow-blue-500/20 focus:-translate-y-0.5 [&>option]:bg-slate-800 [&>option]:text-white"
                    >
                      <option value="">Select College</option>
                      {COLLEGES.map(college => (
                        <option key={college} value={college}>{college}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Honours Subject <span className="text-red-400">*</span>
                    </label>
                    <select
                      name="honoursSubject"
                      value={formData.honoursSubject}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-blue-400 focus:bg-white/15 transition-all duration-300 text-white backdrop-blur-sm focus:shadow-lg focus:shadow-blue-500/20 focus:-translate-y-0.5 [&>option]:bg-slate-800 [&>option]:text-white"
                    >
                      <option value="">Select Honours Subject</option>
                      {HONOURS_SUBJECTS.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Current Semester <span className="text-red-400">*</span>
                    </label>
                    <select
                      name="currentSemester"
                      value={formData.currentSemester}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-blue-400 focus:bg-white/15 transition-all duration-300 text-white backdrop-blur-sm focus:shadow-lg focus:shadow-blue-500/20 focus:-translate-y-0.5 [&>option]:bg-slate-800 [&>option]:text-white"
                    >
                      <option value="">Select Semester</option>
                      {SEMESTERS.map(semester => (
                        <option key={semester} value={semester}>{semester}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Class Roll No <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="classRollNo"
                      value={formData.classRollNo}
                      onChange={handleInputChange}
                      placeholder="Enter class roll number"
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-blue-400 focus:bg-white/15 transition-all duration-300 text-white placeholder-white/40 backdrop-blur-sm focus:shadow-lg focus:shadow-blue-500/20 focus:-translate-y-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      University Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="universityName"
                      value={formData.universityName}
                      readOnly
                      className="w-full px-5 py-4 bg-white/5 border-2 border-white/10 rounded-xl text-white/60 backdrop-blur-sm cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      University Roll Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="universityRollNumber"
                      value={formData.universityRollNumber}
                      onChange={handleInputChange}
                      placeholder="Enter university roll number"
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-blue-400 focus:bg-white/15 transition-all duration-300 text-white placeholder-white/40 backdrop-blur-sm focus:shadow-lg focus:shadow-blue-500/20 focus:-translate-y-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      University Registration Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="universityRegistrationNumber"
                      value={formData.universityRegistrationNumber}
                      onChange={handleInputChange}
                      placeholder="Enter university registration number"
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-blue-400 focus:bg-white/15 transition-all duration-300 text-white placeholder-white/40 backdrop-blur-sm focus:shadow-lg focus:shadow-blue-500/20 focus:-translate-y-0.5"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div
            className={`transform transition-all duration-700 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
          >
            <div className="group relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/20 hover:border-orange-400/30 hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 px-8 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <div className="relative flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-xl shadow-inner transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <PhoneIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white">Contact Information</h3>
                </div>
              </div>
              <div className="relative p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Contact Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleInputChange}
                      placeholder="Enter 10-digit mobile number"
                      maxLength={10}
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-orange-400 focus:bg-white/15 transition-all duration-300 text-white placeholder-white/40 backdrop-blur-sm focus:shadow-lg focus:shadow-orange-500/20 focus:-translate-y-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      name="whatsappNumber"
                      value={formData.whatsappNumber}
                      onChange={handleInputChange}
                      placeholder="Enter WhatsApp number"
                      maxLength={10}
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-orange-400 focus:bg-white/15 transition-all duration-300 text-white placeholder-white/40 backdrop-blur-sm focus:shadow-lg focus:shadow-orange-500/20 focus:-translate-y-0.5"
                    />
                    <p className="text-xs text-white/40 mt-2">If different from contact number</p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      name="emailAddress"
                      value={formData.emailAddress}
                      onChange={handleInputChange}
                      placeholder="Enter email address"
                      className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:border-orange-400 focus:bg-white/15 transition-all duration-300 text-white placeholder-white/40 backdrop-blur-sm focus:shadow-lg focus:shadow-orange-500/20 focus:-translate-y-0.5"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Documents */}
          <div
            className={`transform transition-all duration-700 delay-400 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
          >
            <div className="group relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/20 hover:border-purple-400/30 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="bg-gradient-to-r from-purple-600 via-violet-500 to-purple-600 px-8 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <div className="relative flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-xl shadow-inner transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <UploadIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white">Upload Documents</h3>
                </div>
              </div>
              <div className="relative p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Photo <span className="text-white/40 font-normal">(Max: 500 KB, JPG/PNG)</span>
                    </label>
                    <div
                      onClick={() => photoInputRef.current?.click()}
                      className="group/upload border-2 border-dashed border-white/20 rounded-2xl p-8 text-center cursor-pointer hover:border-purple-400/50 hover:bg-white/5 transition-all duration-300 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 translate-x-[-100%] group-hover/upload:translate-x-[100%] transition-transform duration-700" />
                      {photoPreview ? (
                        <Image
                          src={photoPreview}
                          alt="Photo preview"
                          width={120}
                          height={150}
                          className="mx-auto rounded-xl object-cover shadow-xl ring-4 ring-white/20"
                        />
                      ) : (
                        <div className="relative">
                          <CameraIcon />
                          <p className="text-white/60 mt-3 font-medium">Click to upload photo</p>
                          <p className="text-xs text-white/30 mt-1">Max size: 500 KB</p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={(e) => handleFileChange(e, 'photo')}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-3">
                      Signature <span className="text-white/40 font-normal">(Max: 300 KB, JPG/PNG)</span>
                    </label>
                    <div
                      onClick={() => signatureInputRef.current?.click()}
                      className="group/upload border-2 border-dashed border-white/20 rounded-2xl p-8 text-center cursor-pointer hover:border-purple-400/50 hover:bg-white/5 transition-all duration-300 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 translate-x-[-100%] group-hover/upload:translate-x-[100%] transition-transform duration-700" />
                      {signaturePreview ? (
                        <Image
                          src={signaturePreview}
                          alt="Signature preview"
                          width={180}
                          height={80}
                          className="mx-auto rounded-xl object-contain bg-white/10 shadow-xl p-3 ring-4 ring-white/20"
                        />
                      ) : (
                        <div className="relative">
                          <SignatureIcon />
                          <p className="text-white/60 mt-3 font-medium">Click to upload signature</p>
                          <p className="text-xs text-white/30 mt-1">Max size: 300 KB</p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={(e) => handleFileChange(e, 'signature')}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Declaration */}
          <div
            className={`transform transition-all duration-700 delay-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
          >
            <div className="group relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white/20 hover:border-amber-400/30 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 px-8 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <div className="relative flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-xl shadow-inner transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <DeclarationIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white">Declaration / घोषणा</h3>
                </div>
              </div>
              <div className="relative p-8">
                <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-l-4 border-amber-400 p-6 rounded-r-2xl mb-6 backdrop-blur-sm">
                  <h4 className="font-bold text-white mb-3">Declaration:</h4>
                  <p className="text-white/80 leading-relaxed">
                    I hereby declare that the information provided above is true to the best of my knowledge.
                    I understand that any false information may lead to cancellation of my application.
                  </p>

                  <h4 className="font-bold text-white mt-5 mb-3">घोषणा:</h4>
                  <p className="text-white/80 leading-relaxed">
                    मैं घोषणा करता/करती हूँ कि उपरोक्त दी गई जानकारी मेरी जानकारी के अनुसार सत्य है।
                    किसी भी गलत जानकारी की स्थिति में मेरा आवेदन निरस्त किया जा सकता है।
                  </p>
                </div>

                <label className="flex items-start gap-4 cursor-pointer group/checkbox">
                  <div className="relative">
                    <input
                      type="checkbox"
                      name="declarationAccepted"
                      checked={formData.declarationAccepted}
                      onChange={handleInputChange}
                      className="w-6 h-6 rounded-lg border-2 border-white/30 bg-white/10 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer transition-all duration-300 checked:bg-emerald-500 checked:border-emerald-500"
                    />
                    {formData.declarationAccepted && (
                      <div className="absolute inset-0 bg-emerald-500 rounded-lg animate-ping opacity-30" />
                    )}
                  </div>
                  <span className="text-white/80 group-hover/checkbox:text-white transition-colors">
                    I accept the above declaration / मैं उपरोक्त घोषणा स्वीकार करता/करती हूँ
                    <span className="text-red-400 ml-1">*</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div
            className={`flex flex-col sm:flex-row gap-4 justify-center pt-6 transform transition-all duration-700 delay-600 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
          >
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white px-10 py-5 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:shadow-emerald-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden transform hover:-translate-y-1 hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="relative flex items-center justify-center gap-3">
                {isSubmitting ? (
                  <>
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                    </svg>
                    Submit Application
                  </>
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="group relative bg-white/10 hover:bg-white/20 text-white px-10 py-5 rounded-2xl font-bold text-lg border-2 border-white/20 hover:border-white/40 transition-all duration-300 overflow-hidden transform hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="relative flex items-center justify-center gap-3">
                <svg className="w-6 h-6 transform group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Reset Form
              </span>
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className={`mt-16 text-center transform transition-all duration-700 delay-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500 rounded-xl blur-lg opacity-30" />
              <div className="relative bg-white rounded-xl p-2">
                <Image
                  src="/logo.svg"
                  alt="RTS Logo"
                  width={45}
                  height={40}
                  className="h-10 w-auto"
                />
              </div>
            </div>
            <span className="text-white/80 font-semibold text-lg">Rajtech Technological Systems</span>
          </div>
          <p className="text-white/40 text-sm">&copy; 2024 All rights reserved.</p>
          <a
            href="https://rtseducation.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium mt-2 inline-flex items-center gap-2 transition-colors"
          >
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            rtseducation.in
          </a>
        </div>
      </div>

      {/* Toast Notification */}
      {submitStatus && (
        <div
          className={`fixed bottom-8 right-8 px-8 py-5 rounded-2xl shadow-2xl z-50 flex items-center gap-4 backdrop-blur-xl border animate-slide-in ${
            submitStatus.type === 'success'
              ? 'bg-emerald-500/90 border-emerald-400/50 shadow-emerald-500/30'
              : 'bg-red-500/90 border-red-400/50 shadow-red-500/30'
          }`}
        >
          {submitStatus.type === 'success' ? (
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-30" />
              <svg className="relative w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          ) : (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          )}
          <span className="font-semibold text-lg">{submitStatus.message}</span>
          <button
            onClick={() => setSubmitStatus(null)}
            className="ml-2 hover:bg-white/20 p-1 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes slide-in {
          from {
            transform: translateX(100%) scale(0.8);
            opacity: 0;
          }
          to {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
        }
        .animate-float {
          animation: float 20s ease-in-out infinite;
        }
        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
        .animate-slide-in {
          animation: slide-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { CertificateRecord, ApplicationRecord } from '@/lib/db';

export default function CertificateViewPage() {
  const params = useParams();
  const id = params.id as string;
  const [cert, setCert] = useState<CertificateRecord | null>(null);
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/certificates/${id}`);
        const result = await res.json();
        if (!res.ok) {
          setError(result.error || 'Certificate not found');
          return;
        }
        setCert(result.data.certificate);
        setApplication(result.data.application);
      } catch {
        setError('Failed to load certificate');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#1e3a5f] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !cert || !application) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Certificate Not Found</h2>
          <p className="text-gray-600">{error || 'The requested certificate could not be found.'}</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-6 border-b border-gray-200 pb-6 mb-6">
            {/* Left: PPU Info */}
            <div className="flex items-center gap-4 text-left">
              <Image src="/ppu-logo.png" alt="PPU Logo" width={70} height={70} className="object-contain" />
              <div>
                <h2 className="text-xl font-bold text-[#1e3a5f]">PATLIPUTRA UNIVERSITY</h2>
                <p className="text-gray-600 text-sm">Patna, Bihar</p>
                <p className="text-gray-500 text-xs text-blue-600">www.ppup.ac.in</p>
              </div>
            </div>

            {/* Right: RTS Info */}
            <div className="flex flex-row-reverse md:flex-row items-center gap-4 text-right">
              <div>
                <h2 className="text-xl font-bold text-[#1e3a5f]">RAJTECH TECHNOLOGICAL SYSTEM</h2>
                <p className="font-semibold text-[#1e3a5f] text-sm">(PVT.) LTD</p>
                <p className="text-gray-600 text-xs mt-1">Reg. No: U72900BR2023PTC062819</p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <Image src="/ISO_cropped.png" alt="ISO Logo" width={24} height={24} className="object-contain" />
                  <p className="text-gray-600 text-xs">ISO 9001:2015 Certified</p>
                </div>
              </div>
              <Image src="/logo.png" alt="RTS Logo" width={70} height={70} className="object-contain" />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-serif italic text-red-800 mb-3 block">Certificate</h1>
            <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
              Verified & Authentic
            </div>
          </div>
        </div>

        {/* Certificate Details */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
            <span className="w-2 h-2 bg-[#1e3a5f] rounded-full"></span>
            Certificate Information
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <InfoField label="Serial Number" value={cert.serial_number} />
            <InfoField label="RTS Reg. Number" value={cert.rts_reg_number} />
            <InfoField label="Marks Obtained" value={`${cert.marks} / 100`} />
            <InfoField label="Grade" value={`${cert.grade} (GP: ${cert.grade_point})`} />
            <InfoField label="Internship Start" value={formatDate(cert.start_date)} />
            <InfoField label="Internship End" value={formatDate(cert.end_date)} />
            <InfoField label="Date of Issue" value={cert.created_at ? formatDate(cert.created_at) : 'N/A'} />
          </div>
        </div>

        {/* Student Details */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Student Information
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <InfoField label="Student Name" value={application.student_name} />
            <InfoField label="Father's Name" value={application.father_name} />
            <InfoField label="University Reg. No." value={application.university_registration_number} />
            <InfoField label="University Roll No." value={application.university_roll_number} />
            <InfoField label="Course" value={application.course} />
            <InfoField label="Current Semester" value={application.current_semester} />
            <InfoField label="College" value={application.college_name} fullWidth />
            <InfoField label="Internship Topic" value={application.internship_topic} fullWidth />
          </div>
        </div>

        {/* Download */}
        {cert.certificate_url && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 text-center">
            <a
              href={cert.certificate_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#152a45] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Certificate PDF
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-xs mt-4">
          <p>Certificate ID: {id}</p>
          <p className="mt-1">This certificate can be verified at www.rtseducation.in</p>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, fullWidth = false }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
      <label className="block text-sm font-semibold text-gray-600 mb-1">{label}</label>
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 text-sm">
        {value || 'N/A'}
      </div>
    </div>
  );
}

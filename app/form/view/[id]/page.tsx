'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { ApplicationRecord } from '@/lib/db';

export default function ViewFormPage() {
  const params = useParams();
  const id = params.id as string;
  const [formData, setFormData] = useState<ApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        const response = await fetch(`/api/forms/${id}`);
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Failed to load form');
          return;
        }

        setFormData(result.data);
      } catch (err) {
        setError('Failed to load form data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchFormData();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form data...</p>
        </div>
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Form Not Found</h2>
          <p className="text-gray-600">{error || 'The requested form could not be found or has expired.'}</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Image
                src="/logo.png"
                alt="RTS Logo"
                width={80}
                height={80}
                className="object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Internship Application Form
            </h1>
            <p className="text-gray-600">Read-Only View</p>
            <div className="mt-4 inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
              ✓ Submitted Successfully
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </span>
            Personal Information
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <InfoField label="Student Name" value={formData.student_name} />
            <InfoField label="Father's Name" value={formData.father_name} />
            <InfoField label="Mother's Name" value={formData.mother_name} />
            <InfoField label="Gender" value={formData.gender} />
            <InfoField label="Date of Birth" value={formatDate(formData.date_of_birth)} />
            <InfoField label="Address" value={formData.address} fullWidth />
          </div>
        </div>

        {/* Academic Information */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
              </svg>
            </span>
            Academic Information
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <InfoField label="Internship Topic" value={formData.internship_topic} fullWidth />
            <InfoField label="Course" value={formData.course} />
            <InfoField label="College Name" value={formData.college_name} fullWidth />
            <InfoField label="Honours Subject" value={formData.honours_subject} />
            <InfoField label="Current Semester" value={formData.current_semester} />
            <InfoField label="Class Roll No" value={formData.class_roll_no} />
            <InfoField label="University Name" value={formData.university_name || 'Patliputra University'} />
            <InfoField label="University Roll Number" value={formData.university_roll_number} />
            <InfoField label="University Registration Number" value={formData.university_registration_number} fullWidth />
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </span>
            Contact Information
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <InfoField label="Contact Number" value={formData.contact_number} />
            <InfoField label="WhatsApp Number" value={formData.whatsapp_number || 'Not provided'} />
            <InfoField label="Email Address" value={formData.email_address} fullWidth />
          </div>
        </div>

        {/* Uploaded Files */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
              </svg>
            </span>
            Uploaded Documents
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {formData.photo && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Photo</label>
                <div className="relative w-48 h-48 border-2 border-gray-200 rounded-lg overflow-hidden">
                  <Image
                    src={formData.photo}
                    alt="Student Photo"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            )}
            {formData.signature && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Signature</label>
                <div className="relative w-48 h-24 border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                  <Image
                    src={formData.signature}
                    alt="Student Signature"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submission Info */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Submission Details</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <InfoField label="Submission ID" value={formData.id || 'N/A'} />
            <InfoField label="Submitted On" value={formData.created_at ? formatDate(formData.created_at) : 'N/A'} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600">
          <p className="text-sm">
            This is a read-only view of the submitted application form.
          </p>
          <p className="text-sm mt-2">
            For any queries, please contact the administration.
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper component for displaying information fields
function InfoField({ label, value, fullWidth = false }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-800">
        {value || 'Not provided'}
      </div>
    </div>
  );
}

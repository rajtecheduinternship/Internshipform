'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import JSZip from 'jszip';

interface Submission {
  id: string;
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/submissions', {
        headers: {
          'Authorization': `Bearer ${password}`,
        },
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
  }, [password]);

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
        setIsAuthenticated(true);
        fetchSubmissions();
      } else {
        setAuthError('Invalid password');
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
      'Has Photo', 'Has Signature', 'Submitted At'
    ];

    const rows = submissions.map(s => [
      s.student_name, s.father_name, s.mother_name, s.gender, s.date_of_birth, s.address,
      s.internship_topic, s.college_name, s.honours_subject, s.current_semester, s.class_roll_no,
      s.university_name, s.university_roll_number, s.university_registration_number,
      s.contact_number, s.whatsapp_number || '', s.email_address,
      s.photo ? 'Yes' : 'No', s.signature ? 'Yes' : 'No', s.created_at
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `internship_applications_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper function to download a single image
  const downloadImage = (base64Data: string, filename: string) => {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = filename;
    link.click();
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
          // Extract base64 data and extension
          const photoMatch = submission.photo.match(/^data:image\/(\w+);base64,(.+)$/);
          if (photoMatch) {
            const extension = photoMatch[1];
            const base64Data = photoMatch[2];
            photosFolder.file(`${safeName}_${rollNo}.${extension}`, base64Data, { base64: true });
          }
        }

        if (submission.signature && signaturesFolder) {
          const sigMatch = submission.signature.match(/^data:image\/(\w+);base64,(.+)$/);
          if (sigMatch) {
            const extension = sigMatch[1];
            const base64Data = sigMatch[2];
            signaturesFolder.file(`${safeName}_${rollNo}_signature.${extension}`, base64Data, { base64: true });
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

  const filteredSubmissions = submissions.filter(s =>
    s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_number.includes(searchTerm) ||
    s.college_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Refresh data periodically when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(fetchSubmissions, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchSubmissions]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="bg-[#1e3a5f] text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Access</h1>
            <p className="text-gray-500 mt-2">Enter password to view submissions</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                required
              />
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a5f] text-white py-3 rounded-lg font-medium hover:bg-[#152a45] transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white py-3 px-4 sm:py-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Top row - Title and Logout */}
          <div className="flex justify-between items-center">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">Admin Dashboard</h1>
              <p className="text-white/70 text-xs sm:text-sm truncate">Rajtech - Internship Applications</p>
            </div>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                setPassword('');
                setSubmissions([]);
              }}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 sm:px-4 rounded-lg text-sm flex items-center gap-1 flex-shrink-0 ml-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
          {/* Bottom row - Action buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={fetchSubmissions}
              className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
            <button
              onClick={exportToCSV}
              className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export CSV</span>
            </button>
            <button
              onClick={downloadAllImagesAsZip}
              disabled={downloadingZip || submissions.length === 0}
              className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center disabled:opacity-50"
            >
              {downloadingZip ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              <span>{downloadingZip ? 'Creating...' : 'Images ZIP'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-3xl font-bold text-[#1e3a5f]">{submissions.length}</div>
            <div className="text-gray-500">Total Applications</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-3xl font-bold text-green-600">
              {submissions.filter(s => new Date(s.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}
            </div>
            <div className="text-gray-500">Last 24 Hours</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-3xl font-bold text-blue-600">
              {[...new Set(submissions.map(s => s.college_name))].length}
            </div>
            <div className="text-gray-500">Colleges</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-3xl font-bold text-purple-600">
              {[...new Set(submissions.map(s => s.internship_topic))].length}
            </div>
            <div className="text-gray-500">Topics</div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, phone, or college..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
          />
        </div>

        {/* Submissions List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading submissions...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm ? 'No matching submissions found' : 'No submissions yet'}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden divide-y divide-gray-200">
                {filteredSubmissions.map((submission, index) => (
                  <div
                    key={submission.id}
                    onClick={() => setSelectedSubmission(submission)}
                    className="p-4 hover:bg-gray-50 cursor-pointer active:bg-gray-100"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate">#{index + 1} {submission.student_name}</div>
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
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">#</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Student</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Father&apos;s Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Contact</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">College</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Topic</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Submitted</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredSubmissions.map((submission, index) => (
                      <tr key={submission.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{submission.student_name}</div>
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
                          <button
                            onClick={() => setSelectedSubmission(submission)}
                            className="text-[#1e3a5f] hover:underline text-sm font-medium"
                          >
                            View Details
                          </button>
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

      {/* Detail Modal */}
      {
        selectedSubmission && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 z-50">
            <div className="bg-white sm:rounded-xl rounded-t-2xl w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-[#1e3a5f] text-white p-4 flex justify-between items-center rounded-t-2xl sm:rounded-t-xl">
                {/* Mobile drag indicator */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/30 rounded-full sm:hidden"></div>
                <h2 className="text-xl font-bold">Application Details</h2>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-white/70 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* Photo & Signature */}
                {(selectedSubmission.photo || selectedSubmission.signature) && (
                  <div className="flex flex-wrap gap-6 justify-center">
                    {selectedSubmission.photo && (
                      <div className="text-center">
                        <Image
                          src={selectedSubmission.photo}
                          alt="Photo"
                          width={120}
                          height={150}
                          className="rounded border object-cover"
                        />
                        <p className="text-xs text-gray-500 mt-1">Photo</p>
                        <button
                          onClick={() => {
                            const ext = selectedSubmission.photo?.match(/^data:image\/(\w+);/)?.[1] || 'jpg';
                            const safeName = selectedSubmission.student_name.replace(/[^a-zA-Z0-9]/g, '_');
                            downloadImage(selectedSubmission.photo!, `${safeName}_photo.${ext}`);
                          }}
                          className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1 mx-auto"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                      </div>
                    )}
                    {selectedSubmission.signature && (
                      <div className="text-center">
                        <Image
                          src={selectedSubmission.signature}
                          alt="Signature"
                          width={150}
                          height={60}
                          className="rounded border object-contain bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Signature</p>
                        <button
                          onClick={() => {
                            const ext = selectedSubmission.signature?.match(/^data:image\/(\w+);/)?.[1] || 'png';
                            const safeName = selectedSubmission.student_name.replace(/[^a-zA-Z0-9]/g, '_');
                            downloadImage(selectedSubmission.signature!, `${safeName}_signature.${ext}`);
                          }}
                          className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1 mx-auto"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Personal Info */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#1e3a5f] rounded-full"></span>
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                    <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedSubmission.student_name}</span></div>
                    <div><span className="text-gray-500">Gender:</span> <span className="font-medium">{selectedSubmission.gender}</span></div>
                    <div><span className="text-gray-500">Father:</span> <span className="font-medium">{selectedSubmission.father_name}</span></div>
                    <div><span className="text-gray-500">Mother:</span> <span className="font-medium">{selectedSubmission.mother_name}</span></div>
                    <div><span className="text-gray-500">DOB:</span> <span className="font-medium">{selectedSubmission.date_of_birth}</span></div>
                    <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium">{selectedSubmission.address}</span></div>
                  </div>
                </div>

                {/* Academic Info */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Academic Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                    <div><span className="text-gray-500">Topic:</span> <span className="font-medium">{selectedSubmission.internship_topic}</span></div>
                    <div><span className="text-gray-500">College:</span> <span className="font-medium">{selectedSubmission.college_name}</span></div>
                    <div><span className="text-gray-500">Honours:</span> <span className="font-medium">{selectedSubmission.honours_subject}</span></div>
                    <div><span className="text-gray-500">Semester:</span> <span className="font-medium">{selectedSubmission.current_semester}</span></div>
                    <div><span className="text-gray-500">Class Roll:</span> <span className="font-medium">{selectedSubmission.class_roll_no}</span></div>
                    <div><span className="text-gray-500">University:</span> <span className="font-medium">{selectedSubmission.university_name}</span></div>
                    <div><span className="text-gray-500">Uni Roll No:</span> <span className="font-medium">{selectedSubmission.university_roll_number}</span></div>
                    <div><span className="text-gray-500">Uni Reg No:</span> <span className="font-medium">{selectedSubmission.university_registration_number}</span></div>
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                    <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{selectedSubmission.contact_number}</span></div>
                    <div><span className="text-gray-500">WhatsApp:</span> <span className="font-medium">{selectedSubmission.whatsapp_number || 'Same as phone'}</span></div>
                    <div className="col-span-2"><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedSubmission.email_address}</span></div>
                  </div>
                </div>

                <div className="text-xs text-gray-400 pt-4 border-t">
                  Submitted on {new Date(selectedSubmission.created_at).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

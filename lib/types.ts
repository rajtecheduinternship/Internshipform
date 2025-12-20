export interface InternshipFormData {
  // Personal Information
  studentName: string;
  fatherName: string;
  motherName: string;
  gender: string;
  dateOfBirth: string;
  address: string;

  // Academic Information
  internshipTopic: string;
  collegeName: string;
  honoursSubject: string;
  currentSemester: string;
  classRollNo: string;
  universityName: string;
  universityRollNumber: string;
  universityRegistrationNumber: string;

  // Contact Information
  contactNumber: string;
  whatsappNumber?: string;
  emailAddress: string;

  // Files (base64 encoded)
  photo?: string;
  signature?: string;

  // Declaration
  declarationAccepted: boolean;
}

export interface FormSubmission extends InternshipFormData {
  id?: string;
  createdAt?: string;
  ipAddress?: string;
}

// Dropdown options
export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

export const INTERNSHIP_TOPICS = [
  'Web Development',
  'Mobile App Development',
  'Data Science',
  'Machine Learning',
  'Cloud Computing',
  'Cyber Security',
  'Database Management',
  'Software Testing',
  'UI/UX Design',
  'Digital Marketing',
  'Python Programming',
  'Java Programming',
  'C/C++ Programming',
  'Artificial Intelligence',
  'Internet of Things (IoT)',
];

export const COLLEGES = [
  'A.N. College, Patna',
  'Patna Science College',
  'Patna Women\'s College',
  'B.N. College, Patna',
  'Magadh Mahila College',
  'College of Commerce, Patna',
  'Vanijya Mahavidyalaya',
  'L.N. Mishra College of Business Management',
  'J.D. Women\'s College',
  'Ram Lakhan Singh Yadav College',
  'Patliputra University (Main Campus)',
  'Other',
];

export const HONOURS_SUBJECTS = [
  'Computer Science',
  'Information Technology',
  'Computer Application (BCA)',
  'Electronics',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Statistics',
  'Economics',
  'Commerce',
  'Management',
  'Other',
];

export const SEMESTERS = [
  '1st Semester',
  '2nd Semester',
  '3rd Semester',
  '4th Semester',
  '5th Semester',
  '6th Semester',
  '7th Semester',
  '8th Semester',
];

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
  otherCollegeName?: string;
  otherHonoursSubject?: string;

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
  'Basic IT and Digital Skill',
  'Basic IT and Office Skill',
  'Basic IT and Artificial Intelligence (AI)',
  'Basic IT and Printing',
  'Basic IT and Accounting',
  'Basic IT and Tally Prime with GST',
  'Basic IT with Office Management',
];

export const COLLEGES = [
  'Govt. Degree College, Rajgir',
  'Kisan College, Nalanda',
  'Nalanda College, Biharsharif',
  'Nalanda Mahila College, Biharsharif',
  'S P M College, Udantpuri, Nalanda',
  'S U College, Hilsa',
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

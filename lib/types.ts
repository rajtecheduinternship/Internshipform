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
  course: string;
  collegeName: string;
  honoursSubject: string;
  currentSemester: string;
  classRollNo: string;
  universityName: string;
  universityRollNumber: string;
  universityRegistrationNumber: string;
  otherCollegeName?: string;
  otherCourse?: string;
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
  'Master Modern Office Skills',
  'Basic IT and Digital Skill',
  'Basic IT and Office Skill',
  'Basic IT and Artificial Intelligence (AI)',
  'Basic IT and Printing',
  'Basic IT and Accounting',
  'Basic IT and Tally Prime with GST',
  'Basic IT with Office Management',
];

export const COURSES = [
  'B.A.',
  'B.Sc.',
  'B.Com.',
  'Other',
];

export const COLLEGES = [
  'S U College, Hilsa',
  'S P College, Hilsa',
  'Dr. Ram Raj Singh Mahila, Mahavidyalay, Chandi, Nalanda',
  'L.S.T. Gramin Mahavidyalaya, Aungaridham, Nalanda',
  'Govt. Degree College, Rajgir',
  'Kisan College, Nalanda',
  'Nalanda College, Biharsharif',
  'Nalanda Mahila College, Biharsharif',
  'S P M College, Udantpuri, Nalanda',
  'Sugara College, Biharsarif',
  'Allama Iqbal College, Biharsharif',
  'B.R. Degree College',
  'Deo Sharan Women\'s Evening College, Sohsarai, Nalanda',
  'G D M College, Harnaut',
  'K S T College, Sohsarai',
  'Magadh Mahavidyalaya, Chandi, Nalanda',
  'Mahabodhi Mahavidyalaya, Nalanda',
  'Mahatma Budh Hiraman College',
  'Mata Annapuri Mahavidyalay',
  'Nalanda Sodh Sansthan',
  'P M S College, Paharpura',
  'R Lal College, Nalanda',
  'R LS Y College, Nalanda',
  'R P S College, Harnaut',
  'S.P. Verma College Rajakuan, Biharsharif,Nalanda',
  'Snatak College, Nalanda',
  'Vardhman Mahavir College, Pawapuri',
  'A N College, Patna',
  'ANS College, Barh',
  'B D College, Patna',
  'B.S. College',
  'College Of Commerce, Arts & Science Patna',
  'C J College, Rambagh, Bihta',
  'Ganga Devi Mahila Mahavidyalaya, Patna',
  'J D Womens College, Patna',
  'Jagat Narayan Lal College, Patna',
  'L N C College, Bikram',
  'Mahila College, Khagaul',
  'Malti Dhari College, Naubatpur',
  'R L S Y College, Bakhtiarpur',
  'R M College, Patna City',
  'Ram Krishna Dwarika College, Patna',
  'Ram Ratan Singh College, Mokama, Patna',
  'S M D College, Punpun,Patna',
  'Sri Arvind Mahila College, Patna',
  'Sri Guru Gobind Singh College, Patna Saheb',
  'T P S College, Patna',
  'Govt. Women\'s College, Gardnibagh, Patna',
  'Rajkiya Mahila Mahavidyalaya, Gulzarbagh, Patna',
  'Oriental College, Patna City',
  'Awadhesh Prasad Mahavidyalaya',
  'B B M B G Karya College',
  'B L P College, Masaurhi',
  'Bansopan Ram Bahadur Singh Yadav College, Kanhauli, Patna',
  'Chandradeo Prasad Verma College, Simri, Patna',
  'D R College, Masaurhi',
  'Dr. C P Thakur College, Naubatpur, Patna',
  'Jyoti Kunwar College, Fatehpur, Patna',
  'Kameshwar Prasad Singh College, Nadwan',
  'L P Shahi College, Patna',
  'Navwait Jagdev Singh College, Bakhtiyarpur, Patna',
  'P L S College, Masaurhi',
  'P N K College, Achhua',
  'Patna Muslim Science College, Patna',
  'R P College, Datiyana, Bikram',
  'R L S Y Colge, Anishabad, Patna',
  'R P S College, Bailey Road, Patna',
  'R P S Mahila College, Bailey Road, Patna',
  'Ram Roop Prasad College,Patna',
  'S K M V College, Fatuha',
  'S M N Evening College, Barh',
  'Sant Sandhya Das Mahila College, Barh, Patna',
  'Sir Ganesh Dutt Memorial College, Patna',
  'Sri Ishwarneshwari Baja College, Barh, Patna',
  'Sri Ram Narayan College, Barh',
  'Vanijya Mahavidyalaya, Patna - Pin - 804453',
  'Other',
];

export const HONOURS_SUBJECTS = [
  'Hindi',
  'English',
  'Sanskrit',
  'Maithili',
  'Urdu',
  'Pali',
  'Magahi',
  'Bangala',
  'Persian',
  'Prakrit',
  'Philosophy',
  'Music',
  'History',
  'Pol. Science',
  'Economics',
  'Geography',
  'Sociology',
  'A.I. & A.S',
  'Psychology',
  'Rural Economics',
  'Physics',
  'Chemistry',
  'Mathematics',
  'Botany',
  'Zoology',
  'Electronics',
  'Accounts',
  'Corporate Accounts',
  'Dental',
  'B. Pharma',
  'B. Ed.',
  'B. Tech',
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

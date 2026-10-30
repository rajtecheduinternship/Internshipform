import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Student Learning Portal | Rajtech',
  description: 'Learn with Rajtech. Watch your lessons, see your progress, and ask your teacher in Hindi or English.',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}

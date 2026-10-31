'use client';
import StudentNavbar from '@/components/layout/StudentNavbar';
import PortalFooter from '@/components/layout/PortalFooter';
import StudentClasses from '@/components/classes/StudentClasses';
import { useStudent } from '@/hooks/useStudent';
import { useCopy } from '@/components/help/i18n';
export default function ClassesPage() {
  const student = useStudent(); const t = useCopy();
  return <div className="ui-page student-page"><StudentNavbar /><main id="main-content" className="portal-main"><h1 className="ui-h1 mb-6">{t('My online classes', 'मेरी ऑनलाइन कक्षाएँ')}</h1>{student && <StudentClasses calendar />}</main><PortalFooter /></div>;
}

import LoadingState from '@/components/LoadingState';
import StudentNavbar from '@/components/layout/StudentNavbar';

export default function Loading() {
  return <div className="ui-page student-page"><StudentNavbar /><main id="main-content" className="portal-main"><LoadingState /></main></div>;
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  college: string | null;
  roll_number: string | null;
}

/** Loads the logged-in student from the server session; redirects to login if there is none. */
export function useStudent(): StudentProfile | null {
  const router = useRouter();
  const [student, setStudent] = useState<StudentProfile | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/portal/me')
      .then((res) => {
        if (!res.ok) throw new Error('unauthenticated');
        return res.json();
      })
      .then((data) => {
        if (active) setStudent(data.profile);
      })
      .catch(() => {
        if (active) router.push('/portal/login');
      });
    return () => {
      active = false;
    };
  }, [router]);

  return student;
}

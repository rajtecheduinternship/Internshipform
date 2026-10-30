import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { getStudentCourse, listPublishedCourses } from '@/lib/lms';

/**
 * GET /api/courses
 *  - public (no session): the list of published courses, used by the application form
 *  - student session:     only that student's own course with modules, videos and progress
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await getSessionProfile(req);
    if (!profile) {
      const courses = await listPublishedCourses();
      return NextResponse.json({ courses });
    }
    const course = await getStudentCourse(profile.course_id, profile.id);
    return NextResponse.json({ courses: course ? [course] : [] });
  } catch (error) {
    console.error('Courses GET error:', error);
    return NextResponse.json({ error: 'Failed to load courses' }, { status: 500 });
  }
}

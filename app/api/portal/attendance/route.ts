import { NextRequest,NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { studentAttendance } from '@/lib/attendance';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function GET(req: NextRequest) {
  const p=await getSessionProfile(req);if(!p) return NextResponse.json({error:'Not authenticated'},{status:401});
  try{return NextResponse.json({attendance:await studentAttendance(p.id,p.course_id)},{headers:{'Cache-Control':'no-store'}});}catch(e){return learningErrorResponse(e);}
}

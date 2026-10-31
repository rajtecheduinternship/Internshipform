import { NextRequest,NextResponse } from 'next/server';
import { getSessionProfile,isSameOrigin } from '@/lib/auth';
import { requestAttendance } from '@/lib/attendance';
import { LearningError,learningErrorResponse,readLearningJson } from '@/lib/learning-errors';
export async function POST(req: NextRequest,ctx:{params:Promise<{id:string}>}) {
  if(!isSameOrigin(req)) return NextResponse.json({error:'Bad origin'},{status:403});
  const p=await getSessionProfile(req);if(!p) return NextResponse.json({error:'Not authenticated'},{status:401});
  try {
    const d=await readLearningJson(req,6000);if(Object.keys(d).some((k)=>k!=='note')) throw new LearningError('Provide only an attendance request note.');
    return NextResponse.json(await requestAttendance((await ctx.params).id,p.id,p.course_id,d.note),{headers:{'Cache-Control':'no-store'}});
  }catch(e){return learningErrorResponse(e);}
}

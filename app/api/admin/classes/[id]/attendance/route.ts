import { NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminAttendance,markAttendance } from '@/lib/attendance';
import { LearningError,learningErrorResponse,readLearningJson } from '@/lib/learning-errors';
type Context={params:Promise<{id:string}>};
export async function GET(req:NextRequest,ctx:Context){
  const denied=requireAdmin(req);if(denied)return denied;
  try{return NextResponse.json(await adminAttendance((await ctx.params).id),{headers:{'Cache-Control':'no-store'}});}catch(e){return learningErrorResponse(e);}
}
export async function PATCH(req:NextRequest,ctx:Context){
  const denied=requireAdmin(req);if(denied)return denied;
  try{
    const d=await readLearningJson(req);if(Object.keys(d).some((k)=>!['student_ids','status','note'].includes(k)))throw new LearningError('Unexpected attendance decision fields.');
    return NextResponse.json(await markAttendance((await ctx.params).id,d.student_ids,d.status,d.note),{headers:{'Cache-Control':'no-store'}});
  }catch(e){return learningErrorResponse(e);}
}

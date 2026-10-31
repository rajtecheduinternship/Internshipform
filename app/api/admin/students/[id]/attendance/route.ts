import { NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminStudentAttendance } from '@/lib/attendance';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}){
  const denied=requireAdmin(req);if(denied)return denied;
  try{return NextResponse.json({attendance:await adminStudentAttendance((await ctx.params).id)},{headers:{'Cache-Control':'no-store'}});}catch(e){return learningErrorResponse(e);}
}

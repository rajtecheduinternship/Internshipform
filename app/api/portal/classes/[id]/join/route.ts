import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile,isSameOrigin } from '@/lib/auth';
import { recordJoin } from '@/lib/attendance';
import { LearningError,learningErrorResponse,readLearningJson } from '@/lib/learning-errors';
export async function POST(req: NextRequest,ctx:{params:Promise<{id:string}>}) {
  if(!isSameOrigin(req)) return NextResponse.json({error:'Bad origin'},{status:403});
  const p=await getSessionProfile(req);if(!p) return NextResponse.json({error:'Not authenticated'},{status:401});
  try {
    const d=await readLearningJson(req,3000);if(Object.keys(d).length) throw new LearningError('Join requests must not include attendance decisions.');
    return NextResponse.json(await recordJoin((await ctx.params).id,p.id,p.course_id),{headers:{'Cache-Control':'no-store'}});
  } catch(e){return learningErrorResponse(e);}
}

/* eslint-disable @typescript-eslint/no-require-imports */
// Real HTTP + browser + PostgreSQL workflow. No API interception; synthetic data
// lives in a random schema and the production test server receives only that DB.
// BUILD_DIR must contain a fresh production build of this checkout.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path');
const { spawn } = require('node:child_process');
const { setup, load } = require('./lms-test-harness.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const port = Number(process.env.E2E_PORT || 3103); const base = `http://localhost:${port}`;
const secret = 'isolated-learning-e2e-session-secret'; const adminPassword = 'Synthetic-Admin-Only-123';
const pause = (ms) => new Promise((r) => setTimeout(r,ms));
(async () => {
  const h = await setup(); let server; let browser; let logs = '';
  try {
    const { pool, root } = h;
    const schema = (await pool.query('SELECT current_schema() AS name')).rows[0].name;
    for (const file of ['003_news_ticker.sql','007_application_approval.sql','012_live_classes.sql','013_examinations.sql','014_exam_result_publication.sql']) {
      await pool.query(fs.readFileSync(path.join(root,'migrations',file),'utf8').replaceAll('SET search_path = public', `SET search_path = ${schema}`));
    }
    const auth = load('lib/auth.ts',{ '@/lib/db':{ db:{} } });
    const courses=[];
    for (const slug of ['e2e-a','e2e-b']) courses.push((await pool.query('INSERT INTO courses(title,slug,is_published) VALUES($1,$2,true) RETURNING id',['Synthetic ' + slug,slug])).rows[0].id);
    const students=[];
    for (let i=0;i<3;i++) {
      const course=courses[i===2?1:0]; const phone='999000000'+i; const password='E2E-ROLL-'+i; const hash=await auth.hashPassword(password);
      const application=(await pool.query("INSERT INTO internship_applications(student_name,father_name,mother_name,gender,date_of_birth,address,college_name,university_roll_number,contact_number,email_address,course_id,approval_status) VALUES($1,'Test','Test','Female','2000-01-01','Test','Test',$5,$2,$3,$4,'approved') RETURNING id",['Synthetic Student '+i,phone,`e2e${i}@example.test`,course,password])).rows[0].id;
      const id=(await pool.query("INSERT INTO profiles(full_name,email,phone,role,application_id,course_id,password_hash,roll_number) VALUES($1,$2,$3,'student',$4,$5,$6,$7) RETURNING id",['Synthetic Student '+i,`e2e${i}@example.test`,phone,application,course,hash,password])).rows[0].id;
      students.push({id,phone,password});
    }
    const dbUrl=new URL(process.env.DATABASE_URL); dbUrl.searchParams.set('options','-c search_path='+schema);
    assert(process.env.BUILD_DIR,'Set BUILD_DIR to the isolated production build directory.');
    const env={...process.env,DATABASE_URL:dbUrl.toString(),USE_LOCAL_DB:'true',SESSION_SECRET:secret,ADMIN_PASSWORD:adminPassword,NODE_ENV:'production'};
    // Do not pass Git credentials to the application test server.
    for (const key of Object.keys(env)) if (/^(git_token|GH_TOKEN|GITHUB_TOKEN)$/i.test(key)) delete env[key];
    server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--port',String(port),'--hostname','127.0.0.1'],{cwd:process.env.BUILD_DIR,env,stdio:['ignore','pipe','pipe']});
    for (const stream of [server.stdout,server.stderr]) stream.on('data',(v)=>{logs=(logs+v.toString()).slice(-16000);});
    let up=false;
    for (let i=0;i<80;i++) { try { const r=await fetch(base+'/api/admin/verify'); if (r.ok) {up=true;break;} } catch {} await pause(250); }
    assert(up,'Isolated production server did not start.');
    browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
    const admin=await browser.newContext({viewport:{width:1440,height:1100}});
    const student=await browser.newContext({viewport:{width:390,height:844}});
    const other=await browser.newContext(); const peer=await browser.newContext();
    const errors=[]; const consoleMessages=[]; const responseChecks=[]; const networkErrors=[];
    function assertStudentPayload(value) {
      if (!value || typeof value!=='object') return;
      for(const [key,child] of Object.entries(value)) {
        assert(!['answer_index','correct_index','correct_answer','marks_awarded','grade'].includes(key),'student network exposed '+key);
        if(['score_percent','correct_count','passed'].includes(key) && child!==null) assert(value.result_published_at,'unreleased grade in student network payload');
        assertStudentPayload(child);
      }
    }
    student.on('response',(r)=>{ if(r.url().startsWith(base+'/api/')) responseChecks.push(r.json().then(assertStudentPayload).catch((e)=>networkErrors.push(e.message))); });
    for (const ctx of [admin,student,other,peer]) {
      ctx.on('page',(p)=>{p.on('pageerror',(e)=>errors.push(e.message));p.on('console',(m)=>consoleMessages.push(m.text()));p.on('dialog',(d)=>d.accept());});
      await ctx.addInitScript(()=>{try{localStorage.setItem('rts_lang','en');}catch{}});
    }
    async function request(ctx,url,method='GET',body) { return ctx.request.fetch(base+url,{method,headers:{origin:base},...(body===undefined?{}:{data:body})}); }
    async function json(ctx,url,method='GET',body,status=200) { const r=await request(ctx,url,method,body); assert.equal(r.status(),status,`${method} ${url}: ${await r.text()}`);return r.json(); }
    assert.equal((await request(student,'/api/admin/exams')).status(),401);
    await json(admin,'/api/admin/verify','POST',{password:'incorrect'},401);
    await json(admin,'/api/admin/verify','POST',{password:adminPassword});
    for (const [ctx,record] of [[student,students[0]],[peer,students[1]],[other,students[2]]]) await json(ctx,'/api/portal/login','POST',{phone:record.phone,password:record.password});
    const mod=(await json(admin,'/api/admin/modules','POST',{title:'E2E module',course_ids:[courses[0]],is_published:false},201)).module;
    await json(admin,`/api/admin/modules/${mod.id}`,'PATCH',{is_published:false});
    // Publication is updated explicitly; a draft's content must remain inaccessible.
    const video=(await json(admin,'/api/admin/videos','POST',{module_id:mod.id,title:'E2E lesson',youtube_video_id:'dQw4w9WgXcQ',duration_seconds:20,required_watch_percent:90,is_published:true},201)).video;
    assert.equal((await request(student,`/api/videos/${video.id}`)).status(),404);
    await json(admin,`/api/admin/modules/${mod.id}`,'PATCH',{is_published:true});
    const questionInput=['Alpha','Beta','Gamma'].map((title)=>({prompt:`E2E ${title} question`,options:['Correct option','Incorrect option'],answer_index:0}));
    const bank=(await json(admin,'/api/admin/question-bank','POST',{course_id:courses[0],module_id:mod.id,questions:questionInput},201)).questions;
    const exam=(await json(admin,'/api/admin/exams','POST',{course_id:courses[0],module_id:mod.id,title:'E2E assessment',duration_minutes:15,pass_percent:34,requires_module_completion:true,question_ids:bank.map((q)=>q.id)},201)).exam;
    const attemptUrl=`/api/portal/exams/${exam.id}/attempt`;
    assert.equal((await json(student,'/api/portal/exams')).exams.length,0);
    await json(student,attemptUrl,'POST',{},404);
    await json(admin,`/api/admin/exams/${exam.id}`,'PATCH',{is_published:true});
    await json(student,attemptUrl,'POST',{},403);
    await json(other,attemptUrl,'POST',{},404);
    await json(student,'/api/tracking/heartbeat','POST',{video_id:video.id,watched_intervals:[[0,20]],last_watched_position:20});
    assert.equal((await json(student,'/api/courses')).courses[0].completion.is_completed,true);
    const classRaw={course_id:courses[0],module_id:mod.id,title:'E2E class',description:'Synthetic class',meet_url:'https://meet.google.com/abc-defg-hij',starts_at:new Date(Date.now()-60000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),is_published:false};
    const live=(await json(admin,'/api/admin/classes','POST',classRaw,201)).class;
    assert.equal((await json(student,'/api/portal/classes')).classes.length,0);
    await json(admin,`/api/admin/classes/${live.id}`,'PATCH',{...classRaw,is_published:true});
    assert.equal((await json(student,'/api/portal/classes')).classes.length,1);
    assert.equal((await json(other,'/api/portal/classes')).classes.length,0);
    const notices=await json(other,'/api/news'); assert(notices.some((n)=>n.id==='online-class-notice')); assert.equal(JSON.stringify(notices).includes('abc-defg-hij'),false);
    const sp=await student.newPage(); await sp.goto(base+'/portal/classes'); await sp.getByRole('heading',{name:'Class calendar',exact:true}).waitFor();
    await sp.getByText('Student, your online class is live on Google Meet. Join now.').waitFor();
    await sp.goto(base+`/portal/exams/${exam.id}`); await sp.getByRole('button',{name:'Start examination',exact:true}).click(); await sp.getByRole('timer').waitFor();
    const stored=(await pool.query('SELECT * FROM exam_attempts WHERE exam_id=$1 AND student_id=$2',[exam.id,students[0].id])).rows[0];
    const deadline=+stored.deadline_at;
    await json(student,attemptUrl,'PATCH',{answers:{[stored.questions[0].id]:999}},400);
    await json(student,attemptUrl,'PATCH',{answers:{'not-a-question':0}},400);
    await json(peer,attemptUrl,'PATCH',{attempt_id:stored.id,answers:{}},409);
    await json(student,`/api/admin/question-bank?course_id=${courses[0]}`,'GET',undefined,401);
    for (let i=0;i<2;i++) {
      const q=stored.questions[i]; const option=i===0?q.answer_index:1-q.answer_index;
      await sp.locator('fieldset').filter({hasText:q.prompt}).getByRole('radio').nth(option).check();
      await sp.getByText('All changes saved',{exact:true}).waitFor();
    }
    await sp.reload(); await sp.getByRole('timer').waitFor();
    assert.equal((await json(student,attemptUrl)).attempt.deadline_at,new Date(deadline).toISOString());
    await sp.getByRole('button',{name:'Submit examination',exact:true}).click();
    await sp.getByRole('heading',{name:'Examination submitted'}).waitFor(); await sp.getByText('Your result is awaiting publication',{exact:false}).waitFor();
    for(const method of ['POST','PATCH','PUT']) {
      const tampered=(await json(student,attemptUrl,method,{answers:{},score_percent:100,passed:true,result_published_at:new Date().toISOString()})).attempt;
      assert.equal(tampered.score_percent,null);assert.equal(tampered.result_published_at,null);
    }
    const privateAttempt=(await json(student,attemptUrl)).attempt;
    for (const key of ['score_percent','correct_count','passed','result_published_at']) assert.equal(privateAttempt[key],null);
    assert.equal(JSON.stringify(privateAttempt).includes('answer_index'),false);
    const reportUrl=`/api/admin/exams/${exam.id}/results`; const reviewUrl=reportUrl+'/'+stored.id;
    assert.equal((await request(student,reviewUrl)).status(),401);
    await json(student,reviewUrl,'PATCH',{is_published:true},401);
    await json(admin,reviewUrl,'PATCH',{is_published:true,score_percent:100},400);
    const csrf=await admin.request.patch(base+reviewUrl,{headers:{origin:'https://evil.test'},data:{is_published:true}});assert.equal(csrf.status(),403);
    const review=(await json(admin,reviewUrl)).review;
    assert.equal(review.grade.correct_count,1); assert.equal(review.grade.incorrect_count,1);assert.equal(review.grade.unanswered_count,1);assert.equal(review.grade.score_percent,33.33);assert.equal(review.grade.passed,false);
    const ap=await admin.newPage();await ap.goto(base+'/admin');await ap.getByRole('button',{name:'Examinations',exact:true}).click();
    await ap.getByRole('button',{name:'View results',exact:true}).click();await ap.getByText('Private result · student sees submission only, not marks',{exact:true}).waitFor();
    await ap.getByRole('button',{name:'Review answers & calculation',exact:true}).click();await ap.getByRole('region',{name:'Answer sheet review'}).waitFor();
    await ap.getByText('1 ÷ 3 × 100 = 33.33%',{exact:false}).waitFor();
    async function screenshot(page,name) {if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,name+'.png'),fullPage:true});}}
    await screenshot(ap,'real-admin-answer-review');
    await ap.setViewportSize({width:320,height:900});assert(await ap.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshot(ap,'real-admin-answer-review-mobile');
    await ap.getByRole('button',{name:'Close answer review',exact:true}).click();
    await ap.getByRole('button',{name:'Publish result',exact:true}).click();await ap.getByText('Results published to students.',{exact:true}).waitFor();
    await sp.getByRole('button',{name:'Refresh result',exact:true}).click();await sp.getByRole('heading',{name:'Result published',exact:true}).waitFor();
    assert((await json(student,attemptUrl)).attempt.score_percent===33.33);assert.equal(JSON.stringify((await json(student,attemptUrl)).attempt).includes('correct_index'),false);
    await screenshot(sp,'real-student-published-result');
    await sp.goto(base+'/portal/profile');await sp.getByText('Appeared · Result published',{exact:false}).waitFor();assert((await sp.locator('body').textContent()).includes('33.33%'));
    await ap.getByRole('button',{name:'Make result private',exact:true}).click();await ap.getByText('Results are private. Internal records are retained.',{exact:true}).waitFor();
    assert.equal((await json(student,attemptUrl)).attempt.score_percent,null);
    await sp.reload();await sp.getByText('Appeared · Submitted · Result awaiting publication',{exact:true}).waitFor();assert.equal((await sp.locator('body').textContent()).includes('33.33%'),false);
    const after=(await pool.query('SELECT answers,score_percent FROM exam_attempts WHERE id=$1',[stored.id])).rows[0];assert.equal(Number(after.score_percent),33.33);assert.deepEqual(after.answers,privateAttempt.answers);
    // Ongoing, expired and future submissions, plus bulk release does not auto-release later attempts.
    const peerExam=(await json(admin,'/api/admin/exams','POST',{course_id:courses[0],module_id:mod.id,title:'E2E expiry',duration_minutes:2,pass_percent:50,requires_module_completion:false,question_ids:[bank[0].id]},201)).exam;
    await json(admin,`/api/admin/exams/${peerExam.id}`,'PATCH',{is_published:true});
    const peerAttempt=(await json(peer,`/api/portal/exams/${peerExam.id}/attempt`,'POST',{})).attempt;
    await json(admin,`/api/admin/exams/${peerExam.id}/results/${peerAttempt.id}`,'PATCH',{is_published:true},409);
    await pool.query("UPDATE exam_attempts SET deadline_at=clock_timestamp()-interval '1 second' WHERE id=$1",[peerAttempt.id]);
    const expired=(await json(peer,`/api/portal/exams/${peerExam.id}/attempt`)).attempt;assert(expired.submitted_at);assert.equal(expired.score_percent,null);
    await json(admin,`/api/admin/exams/${peerExam.id}/results`,'PATCH',{is_published:true});assert.equal((await json(peer,`/api/portal/exams/${peerExam.id}/attempt`)).attempt.score_percent,0);
    const later=(await json(student,`/api/portal/exams/${peerExam.id}/attempt`,'POST',{})).attempt;
    assert.equal((await json(student,`/api/portal/exams/${peerExam.id}/attempt`,'PUT',{answers:{}})).attempt.result_published_at,null);
    await json(admin,`/api/admin/exams/${exam.id}/results/${later.id}`,'PATCH',{is_published:true},404);
    await json(admin,`/api/admin/classes/${live.id}`,'PATCH',{...classRaw,is_published:true,is_cancelled:true});assert((await json(student,'/api/portal/classes')).classes[0].is_cancelled);
    assert.equal((await json(other,'/api/news')).some((n)=>n.id==='online-class-notice'),false);
    const studentRecord=await json(admin,`/api/admin/students/${students[0].id}/exams`);assert.equal(studentRecord.results.find((r)=>r.id===stored.id).score_percent,33.33);
    await Promise.all(responseChecks); assert.deepEqual(networkErrors,[],'student network payload confidentiality'); assert.equal(consoleMessages.some((v)=>/answer_index|correct_index|correct_answer|marks_awarded|score_percent/.test(v)),false,'sensitive exam data must not be logged to browser console');
    assert.deepEqual(errors,[]);
    if(process.env.RUN_FIXTURE_REGRESSIONS==='true') {
      for(const script of ['test-learning-ui.cjs','test-mobile-loading.cjs']) {
        await new Promise((resolve,reject)=>{
          const run=spawn(process.execPath,[path.join(root,'scripts',script)],{cwd:root,env:{...process.env,BASE_URL:base},stdio:['ignore','pipe','pipe']});
          run.stdout.on('data',(data)=>process.stdout.write(data));run.stderr.on('data',(data)=>process.stderr.write(data));
          run.once('error',reject);run.once('exit',(code)=>code===0?resolve():reject(new Error(script+' failed with exit '+code)));
        });
      }
    }
    console.log('PASS REAL E2E: password logins; module/video publication and tracked completion; scoped Meet notices/calendar/cancel; draft/prerequisite/enrollment denials; browser attempt/save/reload/submit; private grades; admin answer review and score calculation; UI release/withdrawal; student dashboard; expiry/bulk/future submissions; role/CSRF/tampering negatives; mobile layout. No real student records changed.');
  } catch (e) { console.error('Isolated server diagnostics:',logs.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[database URL redacted]'));throw e; }
  finally {
    if(browser) await browser.close();
    if(server) {server.kill('SIGTERM');await new Promise((resolve)=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(()=>{server.kill('SIGKILL');resolve();},5000).unref();});}
    await h.cleanup();
  }
})().catch((e)=>{console.error(e);process.exitCode=1;});

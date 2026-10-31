/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs');const assert=require('node:assert/strict');const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.BASE_URL || 'http://localhost:3000',out=process.env.SCREENSHOT_DIR || '/private/tmp/rts-admin-ux-tests';fs.mkdirSync(out,{recursive:true});
const id=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const courses=[{id:id(1),title:'Computer Fundamentals and Office Productivity',description:'A practical course for office work.',is_published:true,module_count:4,student_count:24,duration_weeks:5,duration_hours:90},{id:id(2),title:'Accounting and Business Management',description:'Business basics',is_published:true,module_count:3,student_count:18,duration_weeks:5,duration_hours:90}];
const modules=[{id:id(3),title:'Word processing and document preparation',courses:[courses[0]],is_mandatory:false,is_published:true,video_count:4},{id:id(4),title:'Spreadsheets, data analysis and reporting',courses:[courses[0]],is_mandatory:false,is_published:true,video_count:3}];
const bank=Array.from({length:40},(_,i)=>({id:id(100+i),course_id:courses[0].id,module_id:modules[0].id,prompt:`Question ${i+1}: Which option is the best way to format and prepare a document for printing?`,options:['Use consistent styles','Change every word manually','Do not save the file','Remove all headings'],answer_index:0}));
const exams=Array.from({length:8},(_,i)=>({id:id(200+i),course_id:courses[0].id,module_id:modules[0].id,title:`Module examination ${i+1}: Computer and office skills`,module_title:modules[0].title,duration_minutes:30,pass_percent:60,requires_module_completion:true,question_ids:bank.slice(0,20).map(q=>q.id),is_published:i%3!==0,published_at:i%3!==0?new Date().toISOString():null,opens_at:null,closes_at:null}));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const classes=Array.from({length:12},(_,i)=>({id:id(300+i),course_id:courses[0].id,module_id:i%2?modules[0].id:null,title:i===0?'DRAFT: Planning an extended live session on spreadsheets and advanced reporting':'Office skills online class '+(i+1),description:'Practical demonstration and student doubts.',meet_url:'https://meet.google.com/abc-defg-hij',starts_at:new Date(`${today}T${String(8+i).padStart(2,'0')}:00:00+05:30`).toISOString(),ends_at:new Date(`${today}T${String(9+i).padStart(2,'0')}:00:00+05:30`).toISOString(),is_published:i!==0,is_cancelled:i===3,course_title:courses[0].title,module_title:i%2?modules[0].title:null}));
const students=[{id:id(9),full_name:'Synthetic Student',email:'student@example.test',phone:'9990000000',college:'Test College',roll_number:'R100',course_id:courses[0].id,course_title:courses[0].title,total_videos:4,completed_videos:1,watch_seconds:600,last_activity:new Date().toISOString(),last_login_at:new Date().toISOString()}];
const results=Array.from({length:12},(_,i)=>({id:id(500+i),exam_id:exams[0].id,student_id:id(700+i),full_name:'Synthetic Student '+(i+1),phone:'9990000000',exam_title:exams[0].title,module_title:modules[0].title,submitted_at:new Date().toISOString(),result_published_at:i%2?new Date().toISOString():null,correct_count:12,total_questions:20,score_percent:60,passed:true,focus_events:0,deadline_at:new Date().toISOString()}));

let writes=[]; const errors=[];let discard=false;let confirmations=0;
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.addInitScript(()=>{try{localStorage.setItem('rts_lang','en');}catch{}});
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{if(d.type()==='confirm'){confirmations++;return discard?d.accept():d.dismiss();}return d.accept();});
 await page.route('**/api/**',async route=>{const req=route.request(),p=new URL(req.url()).pathname;if(req.method()!=='GET')writes.push({method:req.method(),path:p});
 let data={};
 if(p==='/api/admin/verify')data={authenticated:true};
 else if(p==='/api/admin/courses')data={courses};
 else if(p.startsWith('/api/admin/courses/'))data={course:{...courses[0],modules}};
 else if(p==='/api/admin/modules')data={modules};
 else if(p.startsWith('/api/admin/modules/'))data={module:{...modules[0],course_ids:[courses[0].id],videos:[]}};
 else if(p==='/api/admin/question-bank')data={questions:bank};
 else if(p==='/api/admin/exams')data={exams};
 else if(p.endsWith('/results'))data={results};
 else if(p.includes('/results/'))data={review:{...results[0],grade:{questions:bank.slice(0,20).map((q,i)=>({...q,selected_index:i<12?0:1,selected_answer:q.options[i<12?0:1],correct_index:0,correct_answer:q.options[0],is_correct:i<12,marks_awarded:i<12?1:0,maximum_marks:1})),correct_count:12,total_questions:20,incorrect_count:8,unanswered_count:0,score_percent:60,passed:true,pass_percent:60}}};
 else if(p==='/api/admin/classes')data={classes};
 else if(p==='/api/admin/students')data={students};
 else if(p.endsWith('/exams'))data={results:results.slice(0,3)};
 else if(p.startsWith('/api/admin/students/'))data={profile:students[0],course:{...courses[0],modules:modules.map(m=>({...m,videos:[]}))}};
 else if(p==='/api/admin/submissions')data={submissions:[]};
 else if(p==='/api/admin/analytics')data={recentSessions:[]};
 else if(p==='/api/admin/overview')data={totals:{students:42,unassigned:0,active7d:24,watchSeconds:5000,enquiries:5},courses:[],daily:[]};
 else if(p==='/api/admin/questions')data={questions:[]};
 else if(p==='/api/admin/news')data=[];
 else if(p==='/api/enquiries')data={enquiries:[]};
 await route.fulfill({status:200,json:data});});

 async function tab(name){await page.evaluate(()=>scrollTo(0,0));const open=page.getByRole('button',{name:'Open menu',exact:true});if(await open.isVisible())await open.click();await page.locator('.admin-nav-groups').getByRole('button',{name,exact:true}).click();}
 async function noOverflow(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflows');}
 async function chooseContext(){await page.getByLabel('Course',{exact:true}).selectOption(courses[0].id);await page.getByLabel('Module',{exact:true}).selectOption(modules[0].id);}
 await page.goto(base+'/admin');await page.locator('.admin-nav-groups').waitFor();assert.equal(await page.locator('.admin-nav-groups > section').count(),6);
 await tab('Examinations');await chooseContext();assert.equal(await page.locator('main form').count(),0);
 await page.getByRole('button',{name:'Create exam',exact:true}).click();await page.getByLabel('Exam title',{exact:true}).fill('Keep my unsaved exam');
 await page.getByRole('button',{name:'Refresh data',exact:true}).evaluate(el=>el.click());assert.equal(await page.getByLabel('Exam title',{exact:true}).inputValue(),'Keep my unsaved exam');assert(confirmations>0);
 await page.keyboard.press('Escape');assert(await page.getByRole('dialog').isVisible());assert.equal(await page.getByLabel('Exam title',{exact:true}).inputValue(),'Keep my unsaved exam');
 assert(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}));
 discard=true;await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});discard=false;
 await page.getByRole('button',{name:'Question Bank',exact:true}).click();await page.getByRole('button',{name:'Add question',exact:true}).click();await page.getByLabel('Question (Hindi or English)',{exact:true}).fill('Unsaved question');await page.keyboard.press('Escape');assert(await page.getByRole('dialog').isVisible());discard=true;await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});discard=false;
 await page.reload();await page.locator('.admin-nav-groups button[aria-current="page"]').filter({hasText:'Examinations'}).waitFor();await page.getByRole('button',{name:'Question Bank',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Question Bank',exact:true}).getAttribute('aria-current'),'page');
 await page.getByRole('button',{name:'Exams',exact:true}).click();await page.getByRole('button',{name:'View results',exact:true}).first().click();await page.getByRole('heading',{name:'Examination results',exact:false}).waitFor();
 const resultPosition=await page.getByRole('heading',{name:'Examination results',exact:false}).evaluate(el=>el.getBoundingClientRect().top);assert(resultPosition>=0&&resultPosition<700,'result heading should be in view');
 await page.getByRole('button',{name:'Review answers & calculation',exact:true}).first().click();await page.getByRole('dialog',{name:'Answer sheet review',exact:true}).waitFor();assert(await page.getByRole('region',{name:'Answer sheet review',exact:true}).isVisible());await page.getByRole('button',{name:'Close answer review',exact:true}).click();
 await tab('Online classes');await page.getByRole('heading',{name:'Class calendar',exact:true}).waitFor();assert(await page.getByText(classes[0].title,{exact:true}).isVisible());assert(await page.getByText('Draft · not visible to students',{exact:true}).isVisible());assert.equal(await page.locator('main form').count(),0);
 await page.getByRole('button',{name:'Schedule class',exact:true}).click();await page.getByLabel('Class title',{exact:true}).fill('Unsaved class');await page.keyboard.press('Escape');assert(await page.getByRole('dialog').isVisible());discard=true;await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});discard=false;
 for(const width of [320,390,768,900,1024,1440]){
  await page.setViewportSize({width,height:900});await tab('Certificates & downloads');await page.getByRole('button',{name:'New certificate',exact:true}).waitFor();assert.equal(await page.locator('.admin-tools-menu').count(),0);
  for(const label of ['Application records (CSV)','All student images (ZIP)']){const r=await page.getByRole('button',{name:label,exact:true}).boundingBox();assert(r.x>=0&&r.x+r.width<=width+1,'download should fit '+width);}
  await noOverflow('records '+width);
  await tab('Online classes');await page.getByRole('button',{name:'Schedule class',exact:true}).click();await page.getByRole('dialog').waitFor();await page.waitForTimeout(220);await noOverflow('class editor '+width);await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
 }

 await page.setViewportSize({width:1440,height:1000});await tab('Courses & lessons');await page.getByRole('button',{name:'New course',exact:true}).click();await page.getByRole('dialog').locator('input').first().fill('Unsaved course');await page.keyboard.press('Escape');assert(await page.getByRole('dialog').isVisible());discard=true;await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});discard=false;
 await tab('Certificates & downloads');await page.getByRole('button',{name:'New certificate',exact:true}).click();await page.getByRole('dialog',{name:'New certificate',exact:true}).getByPlaceholder('Full name',{exact:true}).fill('Unsaved certificate');await page.keyboard.press('Escape');assert(await page.getByRole('dialog').isVisible());discard=true;await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});discard=false;
 await page.setViewportSize({width:390,height:900});await tab('Students');await page.locator('.admin-student-cards').getByRole('button',{name:'Synthetic Student',exact:false}).click();await page.locator('#stu-course').waitFor();await page.waitForTimeout(220);assert((await page.locator('#stu-course').boundingBox()).y<900,'course assignment should be immediately accessible');assert.equal(await page.getByRole('heading',{name:'Exam participation & results'}).count(),0);
 await page.getByRole('dialog').getByRole('button',{name:'Examinations',exact:true}).click();await page.getByRole('heading',{name:'Exam participation & results'}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'हिन्दी',exact:true}).click();await page.getByRole('button',{name:'मेन्यू खोलें',exact:true}).click();assert(await page.getByText('छात्र और प्रवेश',{exact:true}).isVisible());await noOverflow('Hindi menu');await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS admin UX: grouped navigation, bank/exams/results separation, list-first editors, unsaved discard/cancel/refresh/unload guards, saved section, visible results and answer drawer, draft planning, records bounds, student profile priority, Hindi and 320–1440px layouts; synthetic reads only');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

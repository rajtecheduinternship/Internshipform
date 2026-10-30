/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness isolates TypeScript server modules. */
// Integration test in an isolated random schema. Never reads/writes student records.
// Uses DATABASE_URL or the local .env, requires CREATE SCHEMA on a test-capable DB role.
// Run: node scripts/test-application-approval.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const pg = require('pg');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env');
for (const line of (fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
process.env.USE_LOCAL_DB = 'true';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'isolated-approval-test-secret-not-for-production';
const schema = 'rts_approval_test_' + randomBytes(6).toString('hex');
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to a PostgreSQL database that permits isolated test schemas.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, options: '-c search_path=' + schema });
const owner = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const managed = [];
function load(relative, mocks = {}) {
  const file = path.join(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)((name) => name in mocks ? mocks[name] : require(name), mod, mod.exports);
  return mod.exports;
}
function request(url, method = 'GET', body, cookie) {
  return new NextRequest('http://localhost' + url, { method, headers: { host: 'localhost', origin: 'http://localhost', ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
let createdSchema = false;
let passed = 0;
function pass(label) { passed++; console.log('PASS', label); }
(async () => {
  const tokens = load('lib/form-token.ts');
  const signed = tokens.createFormToken('127.0.0.1');
  assert.equal(tokens.verifyFormToken(signed).valid, true);
  pass('form-token generation and verification remain compatible');
  const parts = Buffer.from(signed, 'base64').toString().split('|');
  parts[1] += 'tampered';
  assert.equal(tokens.verifyFormToken(Buffer.from(parts.join('|')).toString('base64')).valid, false);
  assert.equal(tokens.verifyFormToken('not-a-token').valid, false);
  pass('tampered and malformed form tokens are rejected');
  const now = Date.now;
  let expired;
  try { Date.now = () => now() - 2 * 60 * 60 * 1000; expired = tokens.createFormToken('127.0.0.1'); }
  finally { Date.now = now; }
  assert.equal(tokens.verifyFormToken(expired).error, 'Token expired');
  pass('expired form tokens stay blocked after the helper extraction');
  await owner.query(`CREATE SCHEMA ${schema}`);
  createdSchema = true;
  const base = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8').split('-- ==================== APPLICATION APPROVAL (007)')[0];
  await pool.query(base);
  const course = (await pool.query("INSERT INTO courses(title,slug,is_published) VALUES ('Test course','test-course',true) RETURNING id")).rows[0].id;
  const legacy = (await pool.query("INSERT INTO internship_applications(student_name,father_name,mother_name,gender,date_of_birth,address,college_name,university_roll_number,contact_number,email_address,course_id) VALUES('Legacy Test','Test','Test','Female','2000-01-01','Test','Test','LEGACY','0000000001','legacy@example.test',$1) RETURNING id", [course])).rows[0].id;
  await pool.query("INSERT INTO profiles(full_name,email,phone,role,application_id,course_id) VALUES('Legacy Test','legacy@example.test','0000000001','student',$1,$2)", [legacy, course]);
  const migration = fs.readFileSync(path.join(root, 'migrations/007_application_approval.sql'), 'utf8').replace('SET search_path = public', `SET search_path = ${schema}`);
  await pool.query(migration);
  assert.equal((await pool.query('SELECT approval_status FROM internship_applications WHERE id=$1', [legacy])).rows[0].approval_status, 'approved');
  pass('migration preserves existing linked accounts');
  class TestPool extends pg.Pool { constructor(options) { super({ ...options, options: '-c search_path=' + schema }); managed.push(this); } }
  const dbModule = load('lib/db.ts', { pg: { Pool: TestPool } });
  const auth = load('lib/auth.ts', { '@/lib/db': dbModule });
  const login = load('app/api/portal/login/route.ts', { '@/lib/db': dbModule, '@/lib/auth': auth });
  const reviewRoute = load('app/api/admin/submissions/[id]/review/route.ts', { '@/lib/db': dbModule, '@/lib/auth': auth, '@/lib/lms': { isUuid: (id) => /^[0-9a-f-]{36}$/i.test(id) }, '@/lib/security': { cleanText: (s, max) => s.trim().slice(0, max) } });
  const { db } = dbModule;
  const app = { student_name: 'Synthetic Applicant', father_name: 'Test', mother_name: 'Test', gender: 'Female', date_of_birth: '2000-01-01', address: 'Test', college_name: 'Test', university_roll_number: 'TEST-ROLL', contact_number: '0000000000', email_address: 'approval@example.test', course_id: course, approval_status: 'approved' };
  const inserted = await db.insertApplication(app);
  assert.equal(inserted.error, null); const id = inserted.id;
  assert.equal(await db.getApplicationApproval(id), 'pending');
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM profiles WHERE application_id=$1', [id])).rows[0].n, 0);
  pass('public insertion forces pending and does not provision an account');
  let res = await login.POST(request('/api/portal/login', 'POST', { phone: app.contact_number, password: 'test-roll' }));
  assert.equal(res.status, 403); assert.equal((await res.json()).code, 'APPLICATION_PENDING'); assert.equal(res.cookies.get(auth.SESSION_COOKIE), undefined);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM profiles WHERE application_id=$1', [id])).rows[0].n, 0);
  pass('pending credentials cannot create an account or receive a session');
  res = await login.POST(request('/api/portal/login', 'POST', { phone: app.contact_number, password: '%' }));
  assert.equal(res.status, 401); pass('incorrect and pattern-like passwords do not reveal application state');
  res = await reviewRoute.PATCH(request(`/api/admin/submissions/${id}/review`, 'PATCH', { decision: 'approved' }), { params: Promise.resolve({ id }) });
  assert.equal(res.status, 401); pass('unauthenticated review is denied');
  const adminCookie = `${auth.ADMIN_COOKIE}=${auth.createAdminToken()}`;
  const crossOrigin = request(`/api/admin/submissions/${id}/review`, 'PATCH', { decision: 'approved' }, adminCookie);
  crossOrigin.headers.set('origin', 'https://untrusted.example');
  res = await reviewRoute.PATCH(crossOrigin, { params: Promise.resolve({ id }) });
  assert.equal(res.status, 403); pass('cross-origin admin review is denied');
  const decision = async (status, target=id) => reviewRoute.PATCH(request(`/api/admin/submissions/${target}/review`, 'PATCH', { decision: status, note: 'Synthetic review note' }, adminCookie), { params: Promise.resolve({ id: target }) });
  res = await decision('approved'); assert.equal(res.status, 200);
  const profile = await db.getProfileByPhone(app.contact_number);
  assert.ok(profile); assert.ok(await auth.verifyPassword('TEST-ROLL', profile.password_hash)); assert.equal(profile.course_id, course);
  pass('admin approval atomically creates a hashed-password account for the requested course');
  res = await login.POST(request('/api/portal/login', 'POST', { phone: app.contact_number, password: 'TEST-ROLL' }));
  assert.equal(res.status, 200); const cookie = res.cookies.get(auth.SESSION_COOKIE); assert.ok(cookie);
  const sessionRequest = () => request('/api/portal/me', 'GET', null, `${auth.SESSION_COOKIE}=${cookie.value}`);
  assert.ok(await auth.getSessionProfile(sessionRequest()));
  pass('approved students can sign in and obtain course-scoped sessions');
  const version = profile.token_version;
  res = await decision('approved'); assert.equal(res.status, 200); assert.equal((await res.json()).review.changed, false);
  assert.equal((await db.getProfileByPhone(app.contact_number)).token_version, version);
  pass('repeated approvals are idempotent and do not reset credentials');
  res = await decision('rejected'); assert.equal(res.status, 200);
  // Also test a deliberately cached old profile: the fresh application gate must deny it.
  assert.equal(await auth.getSessionProfile(sessionRequest()), null);
  res = await login.POST(request('/api/portal/login', 'POST', { phone: app.contact_number, password: 'TEST-ROLL' }));
  assert.equal(res.status, 403); assert.equal((await res.json()).code, 'APPLICATION_REJECTED');
  pass('rejection blocks new logins and revokes an existing cached session');
  const chosenHash = await auth.hashCustomPassword('Chosen-Test-Password');
  await pool.query('UPDATE profiles SET password_hash=$1 WHERE id=$2', [chosenHash, profile.id]);
  await decision('approved'); assert.equal((await db.getProfileByPhone(app.contact_number)).password_hash, chosenHash);
  assert.equal(await auth.getSessionProfile(sessionRequest()), null);
  pass('reapproval preserves custom passwords and never revives old cookies');
  const beforeCycle = await db.getProfileByPhone(app.contact_number);
  const cycleCookie = `${auth.SESSION_COOKIE}=${auth.createSessionToken(beforeCycle.id, beforeCycle.token_version)}`;
  assert.ok(await auth.getSessionProfile(request('/api/portal/me', 'GET', null, cycleCookie)));
  await db.reviewApplication(id, 'rejected', '', '');
  await db.reviewApplication(id, 'approved', '', await auth.hashPassword('TEST-ROLL'));
  // Simulate another server instance whose profile cache was not invalidated by review.
  globalThis.__rtsProfileCache.set(beforeCycle.id, { profile: beforeCycle, at: Date.now() });
  assert.equal(await auth.getSessionProfile(request('/api/portal/me', 'GET', null, cycleCookie)), null);
  pass('cross-instance stale caches cannot revive sessions after reject/reapprove');
  await decision('rejected'); await pool.query(migration);
  assert.equal(await db.getApplicationApproval(id), 'rejected');
  pass('migration reruns never turn rejected students back into approved ones');
  const second = await db.insertApplication({ ...app, contact_number: '0000000002', email_address: 'second@example.test', university_roll_number: 'SECOND', course_id: null });
  res = await decision('approved', second.id); assert.equal(res.status, 409);
  assert.equal(await db.getApplicationApproval(second.id), 'pending');
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM profiles WHERE application_id=$1', [second.id])).rows[0].n, 0);
  pass('missing-course approval rolls back without granting access');
  const third = await db.insertApplication({ ...app, contact_number: '0000000003', email_address: 'third@example.test', university_roll_number: 'THIRD' });
  const hash = await auth.hashPassword('THIRD');
  const results = await Promise.all([db.reviewApplication(third.id, 'approved', '', hash), db.reviewApplication(third.id, 'approved', '', hash)]);
  assert.equal(results.filter(r=>r.changed).length, 1);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM profiles WHERE application_id=$1', [third.id])).rows[0].n, 1);
  pass('concurrent approvals create exactly one account');
  const permission = (await pool.query("SELECT proacl::text acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.proname='review_internship_application'", [schema])).rows[0].acl;
  assert.ok(!/(^|[,{])=X\//.test(permission));
  pass('review RPC is not executable by PUBLIC');
  console.log(`\n${passed} security checks passed. No real student records were changed.`);
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await Promise.all(managed.map(p=>p.end())); await pool.end();
  if (createdSchema) await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await owner.end();
});

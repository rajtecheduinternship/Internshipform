/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const pg = require('pg');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '..');
for (const line of (fs.existsSync(path.join(root, '.env')) ? fs.readFileSync(path.join(root, '.env'), 'utf8') : '').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
function load(relative, mocks = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)((name) => name in mocks ? mocks[name] : require(name), mod, mod.exports);
  return mod.exports;
}
async function setup({ legacyProgress = false } = {}) {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to a PostgreSQL database permitting isolated schemas.');
  const schema = 'rts_lms_test_' + randomBytes(6).toString('hex');
  const owner = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, options: '-c search_path=' + schema });
  await owner.query(`CREATE SCHEMA ${schema}`);
  const cleanup = async () => { await pool.end(); await owner.query(`DROP SCHEMA ${schema} CASCADE`); await owner.end(); };
  try {
    const base = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8').split('-- ==================== APPLICATION APPROVAL (007)')[0];
    await pool.query(legacyProgress ? base.replace('UNIQUE(student_id, video_id)', 'UNIQUE(student_email, video_id)') : base);
    await pool.query(fs.readFileSync(path.join(root, 'migrations/010_module_published.sql'), 'utf8'));
    if (!legacyProgress) await pool.query(fs.readFileSync(path.join(root, 'migrations/011_progress_identity.sql'), 'utf8'));
    const tracking = load('lib/tracking.ts');
    const completion = load('lib/completion.ts');
    const mocks = { '@/lib/db': { getPgPool: () => pool }, '@/lib/tracking': tracking, '@/lib/completion': completion };
    const lms = load('lib/lms.ts', mocks);
    return { pool, lms, mocks, load, cleanup, root };
  } catch (e) { await cleanup(); throw e; }
}
module.exports = { setup, load };

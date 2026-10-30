// Local PostgreSQL only. Existing account/course migrations and admission approval
// are applied together in one transaction. Use --dry-run to validate then roll back.
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

const root = new URL('../', import.meta.url);
const envFile = new URL('.env', root);
for (const line of (existsSync(envFile) ? readFileSync(envFile, 'utf8') : '').split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
if (process.env.USE_LOCAL_DB !== 'true' || !process.env.DATABASE_URL) throw new Error('This runner is for the configured local PostgreSQL database only.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const file of ['004_student_accounts.sql', '005_courses_and_security.sql', '006_mandatory_modules_and_questions.sql', '007_application_approval.sql']) {
    const sql = readFileSync(new URL(`migrations/${file}`, root), 'utf8').replace(/^(?:BEGIN|COMMIT);\s*$/gm, '');
    await client.query(sql);
    console.log('Validated', file);
  }
  const counts = await client.query('SELECT approval_status, COUNT(*)::int count FROM internship_applications GROUP BY approval_status ORDER BY approval_status');
  console.log('Application counts:', counts.rows);
  await client.query(process.argv.includes('--dry-run') ? 'ROLLBACK' : 'COMMIT');
  console.log(process.argv.includes('--dry-run') ? 'Dry run complete; all changes rolled back.' : 'Approval migration committed.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Migration rolled back:', error.message);
  process.exitCode = 1;
} finally {
  client.release(); await pool.end();
}

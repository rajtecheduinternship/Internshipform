// Run: DATABASE_URL=... node scripts/test-batch-notice.mjs
// Uses a random schema in one rolled-back transaction; never edits real notices.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

const root = new URL('../', import.meta.url);
const envFile = new URL('.env', root);
for (const line of (existsSync(envFile) ? readFileSync(envFile, 'utf8') : '').split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for a PostgreSQL database that permits isolated test schemas.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
const schema = 'rts_notice_test_' + randomBytes(6).toString('hex');
const noticeId = '203bcc8c-ee60-5965-99bd-de202a5b97cb';
const message = 'New batch starts on 3 November 2026.\nनया बैच 3 नवंबर 2026 से शुरू होगा।';
const migration = readFileSync(new URL('migrations/008_november_batch_notice.sql', root), 'utf8');
let passed = 0;
const pass = (label) => { passed++; console.log('PASS', label); };

try {
  await client.query('BEGIN');
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET LOCAL search_path TO ${schema}`);
  await client.query(readFileSync(new URL('migrations/003_news_ticker.sql', root), 'utf8'));
  await client.query("INSERT INTO news_ticker(message, is_active, sort_order) VALUES ('Existing welcome notice', true, 0)");
  const original = (await client.query('SELECT * FROM news_ticker ORDER BY id')).rows;

  await client.query(migration);
  const notices = (await client.query('SELECT * FROM news_ticker ORDER BY sort_order, created_at')).rows;
  assert.equal(notices.length, original.length + 1);
  const added = notices.find((notice) => notice.id === noticeId);
  assert.ok(added);
  assert.equal(added.message, message);
  assert.equal(added.link_url, '/apply');
  assert.equal(added.is_active, true);
  assert.equal(added.sort_order, 1);
  pass('adds exactly one active bilingual notice with the explicit 3 November 2026 date and registration link');

  assert.deepEqual((await client.query('SELECT * FROM news_ticker WHERE id <> $1 ORDER BY id', [noticeId])).rows, original);
  pass('preserves all existing notices and their display order');

  await client.query(migration);
  assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM news_ticker')).rows[0].count, notices.length);
  pass('re-running the migration does not duplicate the notice');

  await client.query("UPDATE news_ticker SET message = 'Edited by admin', is_active = false WHERE id = $1", [noticeId]);
  await client.query(migration);
  const edited = (await client.query('SELECT * FROM news_ticker WHERE id = $1', [noticeId])).rows[0];
  assert.equal(edited.message, 'Edited by admin');
  assert.equal(edited.is_active, false);
  pass('re-running never overwrites an admin edit or re-enables a hidden notice');

  await client.query('DELETE FROM news_ticker WHERE id = $1', [noticeId]);
  const existing = (await client.query('INSERT INTO news_ticker(message, is_active, sort_order) VALUES ($1, true, 1) RETURNING id', [message])).rows[0];
  await client.query(migration);
  const matching = (await client.query('SELECT id FROM news_ticker WHERE message = $1', [message])).rows;
  assert.deepEqual(matching, [{ id: existing.id }]);
  pass('does not duplicate an identical notice previously added by an admin');

  console.log(`\n${passed} notice checks passed. All test data is rolled back.`);
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}

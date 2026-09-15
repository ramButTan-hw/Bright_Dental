const fs = require('fs');
const path = require('path');
require('dotenv').config();
const pool = require('./db');
const { runSqlScript } = require('./sql-script-runner');

async function ensureMigrationLogTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function importSchemaIfDatabaseIsEmpty(db) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS table_count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()`
  );

  const tableCount = Number(rows?.[0]?.table_count || 0);
  if (tableCount > 0) {
    console.log('Database already has tables; skipping full schema import.');
    return;
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await runSqlScript(db, schemaSql);
  console.log('Imported base schema from database/schema.sql.');
}

async function runPendingMigrations(db) {
  await ensureMigrationLogTable(db);

  const migrationDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationDir)) {
    return;
  }

  const [appliedRows] = await db.query('SELECT migration_name FROM schema_migrations');
  const appliedMigrations = new Set(appliedRows.map((row) => row.migration_name));

  const migrationFiles = fs
    .readdirSync(migrationDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of migrationFiles) {
    if (appliedMigrations.has(fileName)) {
      continue;
    }

    const filePath = path.join(migrationDir, fileName);
    const migrationSql = fs.readFileSync(filePath, 'utf8').trim();

    if (!migrationSql) {
      await db.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [fileName]);
      continue;
    }

    await runSqlScript(db, migrationSql);
    await db.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [fileName]);
    console.log(`Applied migration ${fileName}`);
  }
}

async function main() {
  let db;
  let locked = false;

  try {
    // A dedicated connection holds the advisory lock across every DDL statement.
    db = await pool.promise().getConnection();
    const [rows] = await db.query("SELECT GET_LOCK('bright-dental-bootstrap', 120) AS acquired");
    locked = Number(rows[0].acquired) === 1;
    if (!locked) throw new Error('Timed out waiting for the database bootstrap lock');
    await importSchemaIfDatabaseIsEmpty(db);
    await runPendingMigrations(db);
    console.log('Database bootstrap complete.');
  } catch (error) {
    console.error('Database bootstrap failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (db) {
      try {
        if (locked) await db.query("SELECT RELEASE_LOCK('bright-dental-bootstrap')");
      } finally {
        db.release();
      }
    }
    await pool.promise().end();
  }
}

main().catch((error) => {
  console.error('Database bootstrap cleanup failed:', error.message);
  process.exit(1);
});

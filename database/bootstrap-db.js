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
  const db = pool.promise();

  try {
    await importSchemaIfDatabaseIsEmpty(db);
    await runPendingMigrations(db);
    console.log('Database bootstrap complete.');
    process.exit(0);
  } catch (error) {
    console.error('Database bootstrap failed:', error.message);
    process.exit(1);
  }
}

main();

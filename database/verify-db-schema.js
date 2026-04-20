const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

function parseArgs(argv) {
  const args = { target: 'default' };
  for (const part of argv.slice(2)) {
    if (part.startsWith('--target=')) {
      args.target = part.slice('--target='.length).trim().toLowerCase();
    }
  }
  return args;
}

function resolveConfig(target) {
  const prefix = target === 'local' ? 'LOCAL_' : target === 'railway' ? 'RAILWAY_' : '';
  const read = (key) => process.env[`${prefix}${key}`] || (target === 'local' ? process.env[key] : '');

  const config = {
    host: target === 'default' ? process.env.DB_HOST : read('DB_HOST'),
    port: Number((target === 'default' ? process.env.DB_PORT : read('DB_PORT')) || 3306),
    user: target === 'default' ? process.env.DB_USER : read('DB_USER'),
    password: target === 'default' ? process.env.DB_PASSWORD : read('DB_PASSWORD'),
    database: target === 'default' ? process.env.DB_NAME : read('DB_NAME')
  };

  const missing = ['host', 'user', 'database'].filter((k) => !String(config[k] || '').trim());
  if (missing.length > 0) {
    const label = target === 'default' ? 'DB_' : `${prefix}DB_`;
    throw new Error(`Missing required ${label} env vars for ${target}: ${missing.join(', ')}`);
  }

  return config;
}

function extractIdentifiers(sql, regex) {
  const out = [];
  let match;
  while ((match = regex.exec(sql)) !== null) {
    out.push((match[1] || '').trim());
  }
  return out;
}

function loadExpectedFromSchema(schemaPath) {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const tableNames = extractIdentifiers(
    sql,
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/gi
  );
  const triggerNames = extractIdentifiers(
    sql,
    /CREATE\s+TRIGGER\s+`?([A-Za-z0-9_]+)`?/gi
  );
  return {
    tables: new Set(tableNames),
    triggers: new Set(triggerNames)
  };
}

function applyMigrationsToTriggers(migrationsDir, initialTriggerSet) {
  const finalTriggers = new Set(initialTriggerSet);
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const dropped = extractIdentifiers(sql, /DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/gi);
    const created = extractIdentifiers(sql, /CREATE\s+TRIGGER\s+`?([A-Za-z0-9_]+)`?/gi);
    for (const name of dropped) finalTriggers.delete(name);
    for (const name of created) finalTriggers.add(name);
  }

  return {
    triggers: finalTriggers,
    migrationFiles
  };
}

function diffSets(expectedSet, actualSet) {
  const missing = [...expectedSet].filter((name) => !actualSet.has(name)).sort();
  const extras = [...actualSet].filter((name) => !expectedSet.has(name)).sort();
  return { missing, extras };
}

async function querySet(conn, query, key) {
  const [rows] = await conn.query(query);
  const normalizedKey = String(key || '').toLowerCase();
  return new Set(
    rows
      .map((row) => {
        if (!row || typeof row !== 'object') return '';
        const resolvedKey = Object.keys(row).find((k) => String(k).toLowerCase() === normalizedKey) || key;
        return String(row[resolvedKey] || '').trim();
      })
      .filter(Boolean)
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const target = args.target;

  const schemaPath = path.join(__dirname, 'schema.sql');
  const migrationsDir = path.join(__dirname, 'migrations');

  const { tables: expectedTables, triggers: schemaTriggers } = loadExpectedFromSchema(schemaPath);
  const { triggers: expectedTriggers, migrationFiles } = applyMigrationsToTriggers(migrationsDir, schemaTriggers);

  const config = resolveConfig(target);
  const conn = await mysql.createConnection(config);

  try {
    const actualTables = await querySet(
      conn,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`,
      'table_name'
    );
    const actualTriggers = await querySet(
      conn,
      `SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = DATABASE()`,
      'trigger_name'
    );

    let actualMigrations = new Set();
    const [migrationTableRows] = await conn.query(
      `SELECT COUNT(*) AS c
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'`
    );
    const hasMigrationTable = Number(migrationTableRows?.[0]?.c || 0) > 0;
    if (hasMigrationTable) {
      actualMigrations = await querySet(conn, `SELECT migration_name FROM schema_migrations`, 'migration_name');
    }

    const tableDiff = diffSets(expectedTables, actualTables);
    const triggerDiff = diffSets(expectedTriggers, actualTriggers);
    const expectedMigrationSet = new Set(migrationFiles);
    const migrationDiff = hasMigrationTable
      ? diffSets(expectedMigrationSet, actualMigrations)
      : { missing: migrationFiles.slice(), extras: [] };

    const ok =
      tableDiff.missing.length === 0
      && triggerDiff.missing.length === 0
      && migrationDiff.missing.length === 0;

    console.log(`\nSchema verification target: ${target}`);
    console.log(`Database: ${config.host}:${config.port}/${config.database}`);
    console.log(`Expected tables: ${expectedTables.size}, found: ${actualTables.size}`);
    console.log(`Expected triggers: ${expectedTriggers.size}, found: ${actualTriggers.size}`);
    console.log(`Expected migrations: ${migrationFiles.length}, applied: ${actualMigrations.size}`);

    if (tableDiff.missing.length) {
      console.log(`\nMissing tables (${tableDiff.missing.length}):`);
      tableDiff.missing.forEach((name) => console.log(`- ${name}`));
    }
    if (triggerDiff.missing.length) {
      console.log(`\nMissing triggers (${triggerDiff.missing.length}):`);
      triggerDiff.missing.forEach((name) => console.log(`- ${name}`));
    }
    if (migrationDiff.missing.length) {
      console.log(`\nMissing migrations (${migrationDiff.missing.length}):`);
      migrationDiff.missing.forEach((name) => console.log(`- ${name}`));
    }

    if (tableDiff.extras.length) {
      console.log(`\nExtra tables (not required by current schema + migrations): ${tableDiff.extras.length}`);
    }
    if (triggerDiff.extras.length) {
      console.log(`Extra triggers (not required by current schema + migrations): ${triggerDiff.extras.length}`);
    }
    if (hasMigrationTable && migrationDiff.extras.length) {
      console.log(`Extra recorded migrations: ${migrationDiff.extras.length}`);
    }

    if (!ok) {
      process.exitCode = 1;
      return;
    }

    console.log('\nOK: All required tables, triggers, and migrations are present.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(`Schema verification failed: ${err.message}`);
  process.exit(1);
});

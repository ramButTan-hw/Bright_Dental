const fs = require('fs');
const pool = require('./db').promise();

function parseSqlStatements(sqlText) {
  const lines = sqlText.split(/\r?\n/);
  let delimiter = ';';
  let buffer = '';
  const statements = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith('DELIMITER ')) {
      delimiter = trimmed.substring('DELIMITER '.length).trim();
      continue;
    }

    buffer += line + '\n';
    const candidate = buffer.trimEnd();
    if (candidate.endsWith(delimiter)) {
      const statement = candidate.slice(0, -delimiter.length).trim();
      buffer = '';
      if (statement) {
        statements.push(statement);
      }
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
}

function stripCheckConstraints(statement) {
  const lines = statement.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    const t = line.trim().toUpperCase();
    return !(t.startsWith('CONSTRAINT ') && t.includes(' CHECK ')) && !t.startsWith('CHECK ');
  });

  const rebuilt = filtered.join('\n').replace(/,\s*\)/g, '\n)');
  return rebuilt;
}

async function run() {
  const schemaPath = './database/schema.sql';
  const sqlText = fs.readFileSync(schemaPath, 'utf8');
  const statements = parseSqlStatements(sqlText);

  console.log(`Parsed ${statements.length} SQL statements from ${schemaPath}`);

  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i];
    try {
      await pool.query(stmt);
    } catch (error) {
      const canRetryWithoutChecks =
        stmt.trim().toUpperCase().startsWith('CREATE TABLE') &&
        /check constraint|check\s*\(/i.test(error.message);

      if (canRetryWithoutChecks) {
        const retryStmt = stripCheckConstraints(stmt);
        if (retryStmt !== stmt) {
          try {
            await pool.query(retryStmt);
            console.log(`Retried statement ${i + 1} without CHECK constraints.`);
            continue;
          } catch (retryError) {
            const preview = stmt.split('\n').slice(0, 6).join('\n');
            console.error(`\nFailed at statement ${i + 1}/${statements.length}:`);
            console.error(preview);
            console.error('\nMySQL error:', retryError.message);
            process.exitCode = 1;
            break;
          }
        }
      }

      const preview = stmt.split('\n').slice(0, 6).join('\n');
      console.error(`\nFailed at statement ${i + 1}/${statements.length}:`);
      console.error(preview);
      console.error('\nMySQL error:', error.message);
      process.exitCode = 1;
      break;
    }
  }

  await pool.end();

  if (!process.exitCode) {
    console.log('Schema applied successfully.');
  }
}

run().catch((error) => {
  console.error('Unexpected error while applying schema:', error.message);
  process.exit(1);
});

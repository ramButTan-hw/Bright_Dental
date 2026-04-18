function splitSqlScript(sqlText) {
  const statements = [];
  const lines = String(sqlText || '').split(/\r?\n/);
  let currentStatement = [];
  let currentDelimiter = ';';

  const flushStatement = () => {
    const statement = currentStatement.join('\n').trim();
    currentStatement = [];
    if (statement) {
      statements.push(statement);
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      if (currentStatement.length > 0) {
        currentStatement.push(line);
      }
      continue;
    }

    if (trimmedLine.toUpperCase().startsWith('DELIMITER ')) {
      if (currentStatement.length > 0) {
        flushStatement();
      }
      currentDelimiter = trimmedLine.slice('DELIMITER '.length).trim();
      continue;
    }

    currentStatement.push(line);

    if (currentDelimiter === '$$') {
      if (trimmedLine.endsWith('$$')) {
        currentStatement[currentStatement.length - 1] = line.replace(/\s*\$\$\s*$/, '');
        flushStatement();
      }
      continue;
    }

    if (trimmedLine.endsWith(';')) {
      flushStatement();
    }
  }

  flushStatement();
  return statements;
}

async function runSqlScript(db, sqlText) {
  const statements = splitSqlScript(sqlText);

  for (const statement of statements) {
    if (statement) {
      await db.query(statement);
    }
  }
}

module.exports = {
  splitSqlScript,
  runSqlScript
};
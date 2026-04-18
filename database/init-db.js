const fs = require('fs');
const pool = require('./db'); 
const { runSqlScript } = require('./sql-script-runner');

const setupDatabase = () => {
  console.log('Reading schema.sql...');
  
  const schema = fs.readFileSync('./database/schema.sql', 'utf8');
  const db = pool.promise();

  runSqlScript(db, schema)
    .then(() => {
      console.log('Success! Database tables are ready.');
      process.exit();
    })
    .catch((err) => {
      console.error('Error building database:', err.message);
      process.exit(1);
    });
};

setupDatabase();
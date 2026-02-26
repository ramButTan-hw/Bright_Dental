const fs = require('fs');
const pool = require('./db'); 

const setupDatabase = () => {
  console.log('Reading schema.sql...');
  
  const schema = fs.readFileSync('./database/schema.sql', 'utf8');

  pool.query(schema, (err, results) => {
    if (err) {
      console.error('Error building database:', err.message);
    } else {
      console.log('Success! Database tables are ready.');
    }
    
    process.exit(); 
  });
};

setupDatabase();
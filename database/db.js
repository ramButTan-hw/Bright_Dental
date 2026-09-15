const mysql = require('mysql2');
const dotenv = require('dotenv');


dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const { resolveConfig } = require('./config');
const dbConfig = {
  ...resolveConfig(),
  multipleStatements: true,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);


pool.getConnection((err, connection) => {
  const envName = isProduction ? 'Azure' : 'Local';
  
  if (err) {
    console.error(`Error connecting to ${envName} MySQL:`, err.message);
    return;
  }
  
  console.log(`Successfully connected to the ${envName} MySQL server.`);
  connection.release(); 
});

module.exports = pool;
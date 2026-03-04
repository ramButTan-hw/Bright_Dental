const mysql = require('mysql2');
const dotenv = require('dotenv');


dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true, 
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
};


if (isProduction) {
  dbConfig.ssl = {
    rejectUnauthorized: true 
  };
}


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
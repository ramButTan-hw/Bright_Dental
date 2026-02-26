const mysql = require('mysql');
const dotenv = require('dotenv');

// Load environment variables from your local .env file
dotenv.config();

// Check if the app is running in production
const isProduction = process.env.NODE_ENV === 'production';

// 1. Define the base configuration shared by both environments
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
};

// 2. Conditionally append SSL settings ONLY if in production (Azure)
if (isProduction) {
  dbConfig.ssl = {
    rejectUnauthorized: true 
  };
}

// 3. Create the pool with the dynamic configuration
const pool = mysql.createPool(dbConfig);

// Test the connection with dynamic console logging
pool.getConnection((err, connection) => {
  const envName = isProduction ? 'Azure' : 'Local';
  
  if (err) {
    console.error(`Error connecting to ${envName} MySQL:`, err.message);
    return;
  }
  
  console.log(`Successfully connected to the ${envName} MySQL server.`);
  connection.release(); // Always release the connection back to the pool
});

module.exports = pool;
// backend/config/database.js - Fixed MySQL Configuration
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration with corrected options for MySQL2
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root@1234',
  database: process.env.DB_NAME || 'eduportal',
  charset: 'utf8mb4',
  timezone: '+00:00',
  // Fixed: Removed invalid options for MySQL2
  multipleStatements: true,
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true
};

// Connection pool configuration with corrected options
const poolConfig = {
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  // Fixed: Use correct MySQL2 pool options
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Create connection pool
export const pool = mysql.createPool(poolConfig);

// Test database connection
export const testConnection = async () => {
  let connection = null;
  try {
    // Get connection from pool
    connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    
    // Test query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Database test query successful');
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Connection details:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      passwordProvided: !!dbConfig.password
    });
    return false;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Execute query with error handling
export const executeQuery = async (query, params = []) => {
  let connection = null;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.execute(query, params);
    return { success: true, data: results };
  } catch (error) {
    console.error('Database query error:', error);
    return { success: false, error: error.message };
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Execute transaction
export const executeTransaction = async (queries) => {
  let connection = null;
  
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params);
      results.push(result);
    }
    
    await connection.commit();
    return { success: true, data: results };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Transaction error:', error);
    return { success: false, error: error.message };
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Close pool connections
export const closePool = async () => {
  try {
    await pool.end();
    console.log('✅ Database pool closed');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
};

// Database initialization with better error handling
export const initializeDatabase = async () => {
  try {
    console.log('🔍 Testing database connection...');
    
    // Create database if it doesn't exist (without selecting database first)
    const tempConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      charset: 'utf8mb4',
      timezone: '+00:00'
    };
    
    console.log('📊 Connecting to MySQL server...');
    const tempConnection = await mysql.createConnection(tempConfig);
    
    console.log(`📋 Creating database '${dbConfig.database}' if it doesn't exist...`);
    await tempConnection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    
    console.log(`✅ Database '${dbConfig.database}' is ready`);
    await tempConnection.end();
    
    // Test the main connection with database selected
    const isConnected = await testConnection();
    
    if (!isConnected) {
      throw new Error('Failed to connect to database after creation');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    
    // Provide helpful error messages
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Troubleshooting tips:');
      console.error('   1. Check your MySQL username and password in .env file');
      console.error('   2. Make sure MySQL server is running');
      console.error('   3. Try connecting with MySQL client: mysql -u root -p');
      console.error('   4. Reset MySQL root password if needed');
      console.error('   5. Check if user has proper permissions');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 MySQL server is not running. Start it with:');
      console.error('   - Windows: net start mysql80 (or your MySQL service name)');
      console.error('   - macOS: brew services start mysql');
      console.error('   - Linux: sudo systemctl start mysql');
    } else if (error.code === 'ENOTFOUND') {
      console.error('💡 Cannot resolve database host. Check DB_HOST in .env file');
    }
    
    return false;
  }
};

// Health check for database
export const healthCheck = async () => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT 1 as health_check');
    connection.release();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connection_pool: {
        total: pool.pool._allConnections.length,
        free: pool.pool._freeConnections.length,
        used: pool.pool._allConnections.length - pool.pool._freeConnections.length
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

export default pool;
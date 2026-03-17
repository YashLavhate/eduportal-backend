// backend/scripts/migrate.js - Updated Database Migration Script
import { pool, initializeDatabase } from '../config/database.js';

const migrations = [
  {
    name: 'create_users_table',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        uid VARCHAR(36) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role ENUM('student', 'teacher', 'administrator') NOT NULL,
        student_id VARCHAR(50) NULL UNIQUE,
        teacher_id VARCHAR(50) NULL UNIQUE,
        admin_id VARCHAR(50) NULL UNIQUE,
        department VARCHAR(100) NULL,
        batch VARCHAR(10) NULL,
        specialization VARCHAR(100) NULL,
        enrollment_year INT NULL,
        join_date DATE NULL,
        cgpa DECIMAL(3,2) NULL,
        experience INT NULL,
        permissions JSON NULL,
        access_level VARCHAR(50) NULL,
        is_active BOOLEAN DEFAULT TRUE,
        email_verified BOOLEAN DEFAULT FALSE,
        profile_picture VARCHAR(255) NULL,
        phone VARCHAR(20) NULL,
        address TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        
        INDEX idx_email (email),
        INDEX idx_role (role),
        INDEX idx_student_id (student_id),
        INDEX idx_teacher_id (teacher_id),
        INDEX idx_admin_id (admin_id),
        INDEX idx_is_active (is_active),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  
  {
    name: 'create_refresh_tokens_table',
    sql: `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        token_id VARCHAR(36) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at),
        INDEX idx_is_revoked (is_revoked)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  
  {
    name: 'create_password_resets_table',
    sql: `
      CREATE TABLE IF NOT EXISTS password_resets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_token (token),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  
  {
    name: 'create_projects_table_updated',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        student_id INT NOT NULL,
        teacher_id INT NULL,
        department VARCHAR(100) NOT NULL,
        year VARCHAR(100) NOT NULL,
        semester VARCHAR(100) NOT NULL,
        project_type ENUM('individual', 'group') DEFAULT 'individual',
        members JSON NULL,
        file_url VARCHAR(500) NULL,
        file_hash VARCHAR(255) NULL,
        status ENUM('draft', 'submitted', 'pending', 'approved', 'rejected') DEFAULT 'draft',
        submission_date TIMESTAMP NULL,
        approval_date TIMESTAMP NULL,
        grade VARCHAR(100) NULL,
        feedback TEXT NULL,
        technologies_used TEXT NULL,
        github_url VARCHAR(255) NULL,
        live_demo_url VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_student_id (student_id),
        INDEX idx_teacher_id (teacher_id),
        INDEX idx_status (status),
        INDEX idx_submission_date (submission_date),
        INDEX idx_department (department),
        INDEX idx_year (year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  
  {
    name: 'create_internships_table_updated',
    sql: `
      CREATE TABLE IF NOT EXISTS internships (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        position VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        duration VARCHAR(50) NOT NULL,
        stipend ENUM('yes', 'no') NOT NULL,
        description TEXT NULL,
        skills_learned TEXT NULL,
        supervisor_name VARCHAR(255) NULL,
        supervisor_email VARCHAR(255) NULL,
        certificate_url VARCHAR(500) NULL,
        certificate_hash VARCHAR(255) NULL,
        status ENUM('draft', 'submitted', 'pending', 'verified', 'rejected') DEFAULT 'draft',
        verification_date TIMESTAMP NULL,
        verified_by INT NULL,
        feedback TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_student_id (student_id),
        INDEX idx_verified_by (verified_by),
        INDEX idx_status (status),
        INDEX idx_start_date (start_date),
        INDEX idx_end_date (end_date),
        INDEX idx_company_name (company_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  
  {
    name: 'create_audit_logs_table',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NULL,
        action VARCHAR(100) NOT NULL,
        table_name VARCHAR(50) NOT NULL,
        record_id INT NULL,
        old_values JSON NULL,
        new_values JSON NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_table_name (table_name),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },

  {
    name: 'add_student_verification_fields',
    sql: `
      ALTER TABLE users
      ADD COLUMN account_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN verified_by INT NULL,
      ADD COLUMN verification_date TIMESTAMP NULL,
      ADD COLUMN verification_notes TEXT NULL;
    `
  },

  {
    name: 'add_verification_foreign_key',
    sql: `
      ALTER TABLE users
      ADD CONSTRAINT fk_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
    `
  },

  {
    name: 'add_verification_indexes',
    sql: `
      ALTER TABLE users
      ADD INDEX idx_account_verified (account_verified),
      ADD INDEX idx_verified_by (verified_by);
    `
  },

  {
    name: 'insert_default_admin',
    sql: `
      INSERT IGNORE INTO users (
        uid, email, password_hash, first_name, last_name, role,
        admin_id, is_active, email_verified, phone, created_at
      ) VALUES (
        UUID(),
        'admin@eduportal.com',
        '$2a$10$EIXguxwE77Xm7FaEgV6.KuvKKOYzgVLBsP.Q5GD0/eW6GzP4V.zfi', -- password: 1234567890
        'System',
        'Administrator',
        'administrator',
        'ADMIN001',
        true,
        true,
        '1234567890',
        CURRENT_TIMESTAMP
      );
    `
  },

  {
    name: 'add_teacher_fields',
    sql: `
      ALTER TABLE users
      ADD COLUMN joining_year INT NULL,
      ADD COLUMN qualifications VARCHAR(200) NULL;
    `
  },

];

// Run migrations
const runMigrations = async () => {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Initialize database
    await initializeDatabase();
    
    // Create migrations tracking table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Get executed migrations
    const [executedMigrations] = await pool.execute('SELECT name FROM migrations');
    const executedNames = executedMigrations.map(m => m.name);
    
    // Run pending migrations
    for (const migration of migrations) {
      if (!executedNames.includes(migration.name)) {
        console.log(`📝 Running migration: ${migration.name}`);
        
        await pool.execute(migration.sql);
        await pool.execute('INSERT INTO migrations (name) VALUES (?)', [migration.name]);
        
        console.log(`✅ Migration completed: ${migration.name}`);
      } else {
        console.log(`⏭️  Migration already executed: ${migration.name}`);
      }
    }
    
    console.log('🎉 All migrations completed successfully!');
    console.log('📋 Default admin credentials:');
    console.log('   Email: admin@eduportal.com');
    console.log('   Password: password');
    console.log('   ⚠️  Please change the default password after first login!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await runMigrations();
  process.exit(0);
}

export { runMigrations };
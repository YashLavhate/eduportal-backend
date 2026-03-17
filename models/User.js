// backend/models/User.js - User Model with MySQL
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool, executeQuery, executeTransaction } from '../config/database.js';

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.uid = data.uid;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.role = data.role;
    this.studentId = data.student_id;
    this.teacherId = data.teacher_id;
    this.adminId = data.admin_id;
    this.department = data.department;
    this.batch = data.batch;
    this.specialization = data.specialization;
    this.enrollmentYear = data.enrollment_year;
    this.joinDate = data.join_date;
    this.cgpa = data.cgpa;
    this.experience = data.experience;
    this.permissions = data.permissions ? JSON.parse(data.permissions) : null;
    this.accessLevel = data.access_level;
    this.isActive = data.is_active;
    this.emailVerified = data.email_verified;
    this.profilePicture = data.profile_picture;
    this.phone = data.phone;
    this.address = data.address;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.lastLogin = data.last_login;
  }

  // Create new user
  static async create(userData) {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        role,
        studentId,
        teacherId,
        adminId,
        department,
        batch,
        specialization,
        enrollmentYear,
        joinDate,
        permissions,
        accessLevel
      } = userData;

      // Check if email already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        throw new Error('Email already exists');
      }

      // Check role-specific ID uniqueness
      await User.validateRoleId(role, { studentId, teacherId, adminId });

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Generate UUID
      const uid = uuidv4();

      // Prepare user data
      const query = `
        INSERT INTO users (
          uid, email, password_hash, first_name, last_name, role,
          student_id, teacher_id, admin_id, department, batch,
          specialization, enrollment_year, join_date, permissions,
          access_level, is_active, email_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        uid,
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        studentId || null,
        teacherId || null,
        adminId || null,
        department || null,
        batch || null,
        specialization || null,
        enrollmentYear || null,
        joinDate || null,
        permissions ? JSON.stringify(permissions) : null,
        accessLevel || null,
        true, // is_active
        false // email_verified
      ];

      const result = await executeQuery(query, params);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // Return created user (without password)
      const newUser = await User.findById(result.data.insertId);
      return newUser;

    } catch (error) {
      throw new Error(`User creation failed: ${error.message}`);
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = ? AND is_active = true';
      const result = await executeQuery(query, [id]);
      
      if (result.success && result.data.length > 0) {
        return new User(result.data[0]);
      }
      return null;
    } catch (error) {
      throw new Error(`Find user by ID failed: ${error.message}`);
    }
  }

  // Find user by UID
  static async findByUid(uid) {
    try {
      const query = 'SELECT * FROM users WHERE uid = ? AND is_active = true';
      const result = await executeQuery(query, [uid]);
      
      if (result.success && result.data.length > 0) {
        return new User(result.data[0]);
      }
      return null;
    } catch (error) {
      throw new Error(`Find user by UID failed: ${error.message}`);
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = ?';
      const result = await executeQuery(query, [email]);
      
      if (result.success && result.data.length > 0) {
        return new User(result.data[0]);
      }
      return null;
    } catch (error) {
      throw new Error(`Find user by email failed: ${error.message}`);
    }
  }

  // Find user by role-specific ID
  static async findByRoleId(role, roleId) {
    try {
      let field;
      switch (role) {
        case 'student':
          field = 'student_id';
          break;
        case 'teacher':
          field = 'teacher_id';
          break;
        case 'administrator':
          field = 'admin_id';
          break;
        default:
          throw new Error('Invalid role');
      }

      const query = `SELECT * FROM users WHERE ${field} = ? AND role = ? AND is_active = true`;
      const result = await executeQuery(query, [roleId, role]);
      
      if (result.success && result.data.length > 0) {
        return new User(result.data[0]);
      }
      return null;
    } catch (error) {
      throw new Error(`Find user by role ID failed: ${error.message}`);
    }
  }

  // Validate role-specific ID uniqueness
  static async validateRoleId(role, ids) {
    const { studentId, teacherId, adminId } = ids;
    
    switch (role) {
      case 'student':
        if (!studentId) throw new Error('Student ID is required');
        const existingStudent = await User.findByRoleId('student', studentId);
        if (existingStudent) throw new Error('Student ID already exists');
        break;
        
      case 'teacher':
        if (!teacherId) throw new Error('Teacher ID is required');
        const existingTeacher = await User.findByRoleId('teacher', teacherId);
        if (existingTeacher) throw new Error('Teacher ID already exists');
        break;
        
      case 'administrator':
        if (!adminId) throw new Error('Admin ID is required');
        const existingAdmin = await User.findByRoleId('administrator', adminId);
        if (existingAdmin) throw new Error('Admin ID already exists');
        break;
        
      default:
        throw new Error('Invalid role');
    }
  }

  // Verify password
  async verifyPassword(password) {
    try {
      return await bcrypt.compare(password, this.passwordHash);
    } catch (error) {
      throw new Error('Password verification failed');
    }
  }

  // Update password
  async updatePassword(newPassword) {
    try {
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
      
      const query = 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      const result = await executeQuery(query, [newPasswordHash, this.id]);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      this.passwordHash = newPasswordHash;
      return true;
    } catch (error) {
      throw new Error(`Password update failed: ${error.message}`);
    }
  }

  // Update last login
  async updateLastLogin() {
    try {
      const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      const result = await executeQuery(query, [this.id]);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      this.lastLogin = new Date();
      return true;
    } catch (error) {
      throw new Error(`Last login update failed: ${error.message}`);
    }
  }

  // Update user profile
  async updateProfile(updateData) {
    try {
      const allowedFields = [
        'first_name', 'last_name', 'department', 'batch', 'specialization',
        'phone', 'address', 'profile_picture', 'cgpa', 'experience'
      ];

      const updates = [];
      const params = [];

      Object.keys(updateData).forEach(key => {
        const dbField = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        if (allowedFields.includes(dbField)) {
          updates.push(`${dbField} = ?`);
          params.push(updateData[key]);
        }
      });

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(this.id);

      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      const result = await executeQuery(query, params);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update instance properties
      Object.keys(updateData).forEach(key => {
        if (this.hasOwnProperty(key)) {
          this[key] = updateData[key];
        }
      });

      return true;
    } catch (error) {
      throw new Error(`Profile update failed: ${error.message}`);
    }
  }

  // Deactivate user
  async deactivate() {
    try {
      const query = 'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      const result = await executeQuery(query, [this.id]);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      this.isActive = false;
      return true;
    } catch (error) {
      throw new Error(`User deactivation failed: ${error.message}`);
    }
  }

  // Get all users with pagination
  static async getAll(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE is_active = true';
      const params = [];

      if (filters.role) {
        whereClause += ' AND role = ?';
        params.push(filters.role);
      }

      if (filters.department) {
        whereClause += ' AND department = ?';
        params.push(filters.department);
      }

      if (filters.search) {
        whereClause += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
      const countResult = await executeQuery(countQuery, params);
      const total = countResult.data[0].total;

      // Get users
      const query = `
        SELECT id, uid, email, first_name, last_name, role, student_id, 
               teacher_id, admin_id, department, batch, specialization,
               enrollment_year, join_date, is_active, email_verified,
               profile_picture, phone, created_at, updated_at, last_login
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      params.push(limit, offset);
      const result = await executeQuery(query, params);

      if (!result.success) {
        throw new Error(result.error);
      }

      const users = result.data.map(userData => new User(userData));

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Get users failed: ${error.message}`);
    }
  }

  // Convert to JSON (excluding sensitive data)
  toJSON() {
    const {
      passwordHash,
      ...userWithoutPassword
    } = this;

    return {
      ...userWithoutPassword,
      permissions: typeof this.permissions === 'string' 
        ? JSON.parse(this.permissions) 
        : this.permissions
    };
  }

  // Get user's full name
  getFullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  // Check if user has specific role
  hasRole(role) {
    return this.role === role;
  }

  // Check if user has permission
  hasPermission(permission) {
    if (this.role === 'administrator') {
      return this.permissions?.includes('all') || this.permissions?.includes(permission);
    }

    const rolePermissions = {
      student: ['view_profile', 'edit_profile', 'submit_projects', 'view_internships'],
      teacher: ['view_profile', 'edit_profile', 'manage_projects', 'view_students'],
      administrator: ['all']
    };

    return rolePermissions[this.role]?.includes(permission) || false;
  }
}

export default User;
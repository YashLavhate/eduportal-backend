// backend/routes/authRoutes.js - Authentication Routes
import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { executeQuery } from '../config/database.js';
import { jwtService } from '../services/jwtService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

// Rate limiting for registration
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 3 registration attempts per hour
  message: {
    success: false,
    message: 'Too many registration attempts, please try again later.',
    code: 'REGISTRATION_RATE_LIMIT_EXCEEDED'
  }
});

// Password strength validation
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
  .required()
  .messages({
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (!@#$%^&*)',
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password cannot exceed 128 characters'
  });

// Student registration validation schema
const studentRegistrationSchema = Joi.object({
  studentId: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Student PRN must be exactly 10 digits',
    }),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: passwordSchema,
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match'
  }),
  phone: Joi.string().pattern(/^\d{10}$/).required().messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits'
  }),
  department: Joi.string().min(2).max(100).required(),
  batch: Joi.string().min(2).max(10).required(),
  specialization: Joi.string().min(2).max(100).allow('').optional(),
  enrollmentYear: Joi.number().integer().min(2000).max(2030).required()
});

// Student Registration
router.post('/register/student', registrationLimiter, async (req, res) => {
  try {
    // Validate input
    const { error, value } = studentRegistrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message)
      });
    }

    const {
      studentId,
      firstName,
      lastName,
      email,
      password,
      phone,
      department,
      batch,
      specialization,
      enrollmentYear
    } = value;

    // Check if student ID already exists
    const existingStudentQuery = 'SELECT id FROM users WHERE student_id = ?';
    const existingStudent = await executeQuery(existingStudentQuery, [studentId]);

    if (existingStudent.success && existingStudent.data.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Student PRN already exists'
      });
    }

    // Check if email already exists
    const existingEmailQuery = 'SELECT id FROM users WHERE email = ?';
    const existingEmail = await executeQuery(existingEmailQuery, [email]);

    if (existingEmail.success && existingEmail.data.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Check if phone already exists
    const existingPhoneQuery = 'SELECT id FROM users WHERE phone = ?';
    const existingPhone = await executeQuery(existingPhoneQuery, [phone]);

    if (existingPhone.success && existingPhone.data.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate UUID
    const uid = uuidv4();

    // Insert new student
    const insertQuery = `
      INSERT INTO users (
        uid, email, password_hash, first_name, last_name, role,
        student_id, department, batch, specialization, enrollment_year,
        phone, is_active, email_verified, account_verified, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const insertParams = [
      uid,
      email,
      passwordHash,
      firstName,
      lastName,
      'student',
      studentId,
      department,
      batch,
      specialization || null,
      enrollmentYear,
      phone,
      true, // is_active
      false, // email_verified
      false // account_verified - requires teacher verification
    ];

    const result = await executeQuery(insertQuery, insertParams);

    if (!result.success) {
      console.error('Student registration error:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to register student'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Student registration successful. Your account is pending verification by a teacher.',
      data: {
        studentId,
        email,
        firstName,
        lastName,
        accountStatus: 'pending_verification'
      }
    });

  } catch (error) {
    console.error('Student registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Teacher registration validation schema
const teacherRegistrationSchema = Joi.object({
  employeeId: Joi.string()
    .pattern(/^SIT\d{4}$/)
    .required()
    .messages({
      'string.pattern.base': 'Employee ID must be in format SIT followed by 4 digits (e.g., SIT1234)',
    }),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: passwordSchema,
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match'
  }),
  phone: Joi.string().pattern(/^\d{10}$/).required().messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits'
  }),
  department: Joi.string().min(2).max(100).required(),
  experience: Joi.number().integer().min(0).max(50).required(),
  joiningYear: Joi.number().integer().min(1990).max(2030).required(),
  qualifications: Joi.string().min(5).max(200).required(),
  specialization: Joi.string().min(2).max(100).allow('').optional()
});

// Teacher Registration
router.post('/register/teacher', registrationLimiter, async (req, res) => {
  try {
    // Validate input
    const { error, value } = teacherRegistrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message)
      });
    }

    const {
      employeeId,
      firstName,
      lastName,
      email,
      password,
      phone,
      department,
      experience,
      joiningYear,
      qualifications,
      specialization
    } = value;

    // Check if employee ID already exists
    const existingTeacherQuery = 'SELECT id FROM users WHERE teacher_id = ?';
    const existingTeacher = await executeQuery(existingTeacherQuery, [employeeId]);

    if (existingTeacher.success && existingTeacher.data.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID already exists'
      });
    }

    // Check if email already exists
    const existingEmailQuery = 'SELECT id FROM users WHERE email = ?';
    const existingEmail = await executeQuery(existingEmailQuery, [email]);

    if (existingEmail.success && existingEmail.data.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Check if phone already exists
    const existingPhoneQuery = 'SELECT id FROM users WHERE phone = ?';
    const existingPhone = await executeQuery(existingPhoneQuery, [phone]);

    if (existingPhone.success && existingPhone.data.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate UUID
    const uid = uuidv4();

    // Insert new teacher
    const insertQuery = `
      INSERT INTO users (
        uid, email, password_hash, first_name, last_name, role,
        teacher_id, department, experience, joining_year,
        qualifications, specialization, phone, is_active, email_verified,
        account_verified, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const insertParams = [
      uid,
      email,
      passwordHash,
      firstName,
      lastName,
      'teacher',
      employeeId,
      department,
      experience,
      joiningYear,
      qualifications,
      specialization || null,
      phone,
      true, // is_active
      false, // email_verified
      false // account_verified - requires admin verification
    ];

    const result = await executeQuery(insertQuery, insertParams);

    if (!result.success) {
      console.error('Teacher registration error:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to register teacher'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Teacher registration successful. Your account is pending verification by an administrator.',
      data: {
        employeeId,
        email,
        firstName,
        lastName,
        accountStatus: 'pending_verification'
      }
    });

  } catch (error) {
    console.error('Teacher registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Student/Teacher Login (using student_id/teacher_id as username)
router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validation
    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and role are required'
      });
    }

    if (!['student', 'teacher', 'administrator'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    let query;
    let queryParams;

    // Different login logic based on role
    if (role === 'student') {
      query = 'SELECT * FROM users WHERE student_id = ? AND role = ? AND is_active = true';
      queryParams = [username, role];
    } else if (role === 'teacher') {
      // Teachers can login with either employee ID or email
      query = 'SELECT * FROM users WHERE (teacher_id = ? OR email = ?) AND role = ? AND is_active = true';
      queryParams = [username, username, role];
    } else if (role === 'administrator') {
      // Administrators can login with either email or PRN
      query = 'SELECT * FROM users WHERE (email = ? OR student_id = ?) AND role = ? AND is_active = true';
      queryParams = [username, username, role];
    }

    const result = await executeQuery(query, queryParams);
    
    if (!result.success || result.data.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = result.data[0];

    // Check account verification status for students and teachers
    if (user.role === 'student' && !user.account_verified) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending verification by a teacher. Please contact your institution for account activation.',
        code: 'ACCOUNT_NOT_VERIFIED'
      });
    }

    if (user.role === 'teacher' && !user.account_verified) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending verification by an administrator. Please contact your institution for account activation.',
        code: 'ACCOUNT_NOT_VERIFIED'
      });
    }

    // Password validation logic based on role
    let isValidPassword = false;

    if (user.role === 'teacher' || user.role === 'administrator') {
      // Teachers and administrators use hashed passwords
      if (user.password_hash) {
        isValidPassword = await bcrypt.compare(password, user.password_hash);
      }
    } else {
      // Students: try phone number first (legacy), then hashed password
      if (user.phone && password === user.phone) {
        isValidPassword = true;
      } else if (user.password_hash) {
        isValidPassword = await bcrypt.compare(password, user.password_hash);
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const tokens = await jwtService.generateTokenPair(user);

    // Update last login
    await executeQuery(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Remove sensitive data
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        ...tokens
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Admin Login (separate endpoint for better security)
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Admin login attempt:', { email, password: password ? '***' : 'missing' });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const query = 'SELECT * FROM users WHERE email = ? AND role = ? AND is_active = true';
    const result = await executeQuery(query, [email, 'administrator']);
    
    console.log('Database query result:', result.success, result.data?.length || 0);
    
    if (!result.success || result.data.length === 0) {
      console.log('User not found or query failed');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = result.data[0];
    console.log('Found user:', { id: user.id, email: user.email, phone: user.phone, hasPassword: !!user.password_hash });
    
    // Try phone number first, then hashed password
    let isValidPassword = false;
    
    if (user.phone && password === user.phone) {
      console.log('Password matched phone number');
      isValidPassword = true;
    } else if (user.password_hash) {
      isValidPassword = await bcrypt.compare(password, user.password_hash);
      console.log('Password hash comparison result:', isValidPassword);
    }

    if (!isValidPassword) {
      console.log('Password validation failed');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const tokens = await jwtService.generateTokenPair(user);

    await executeQuery(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: userWithoutPassword,
        ...tokens
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const newTokens = await jwtService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: newTokens
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Token refresh failed'
    });
  }
});

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Extract token ID from refresh token
      const tokenInfo = await jwtService.verifyRefreshToken(refreshToken);
      await jwtService.revokeRefreshToken(tokenInfo.tokenId);
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.json({
      success: true,
      message: 'Logout successful'
    });
  }
});

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const query = 'SELECT * FROM users WHERE id = ? AND is_active = true';
    const result = await executeQuery(query, [req.user.userId]);
    
    if (!result.success || result.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { password_hash, ...userWithoutPassword } = result.data[0];

    res.json({
      success: true,
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
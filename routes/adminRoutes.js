// backend/routes/adminRoutes.js - Admin Management Routes
import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../config/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(authMiddleware);
router.use(roleMiddleware(['administrator']));

// Create Student Account
router.post('/students', async (req, res) => {
  try {
    const { studentName, studentId, department, mobileNo, batch, specialization, enrollmentYear } = req.body;

    // Validation
    if (!studentName || !studentId || !department || !mobileNo) {
      return res.status(400).json({
        success: false,
        message: 'Student name, student ID, department, and mobile number are required'
      });
    }

    // Check if student ID already exists
    const checkQuery = 'SELECT id FROM users WHERE student_id = ?';
    const existingStudent = await executeQuery(checkQuery, [studentId]);
    
    if (existingStudent.success && existingStudent.data.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Student ID already exists'
      });
    }

    // Split student name into first and last name
    const nameParts = studentName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create student account
    const query = `
      INSERT INTO users (
        uid, email, password_hash, first_name, last_name, role, 
        student_id, department, phone, batch, specialization, enrollment_year
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const uid = uuidv4();
    const email = `${studentId}@student.edu`; // Auto-generated email
    const passwordHash = await bcrypt.hash('defaultPassword123', 10); // Default password

    const params = [
      uid, email, passwordHash, firstName, lastName, 'student',
      studentId, department, mobileNo, batch, specialization, enrollmentYear
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create student account'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Student account created successfully',
      data: {
        studentId,
        name: studentName,
        department,
        loginCredentials: {
          username: studentId,
          password: mobileNo
        }
      }
    });

  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create Teacher Account
router.post('/teachers', async (req, res) => {
  try {
    const { teacherName, empId, department, mobileNo, experience, specialization } = req.body;

    // Validation
    if (!teacherName || !empId || !department || !mobileNo) {
      return res.status(400).json({
        success: false,
        message: 'Teacher name, employee ID, department, and mobile number are required'
      });
    }

    // Check if employee ID already exists
    const checkQuery = 'SELECT id FROM users WHERE teacher_id = ?';
    const existingTeacher = await executeQuery(checkQuery, [empId]);
    
    if (existingTeacher.success && existingTeacher.data.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID already exists'
      });
    }

    // Split teacher name into first and last name
    const nameParts = teacherName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create teacher account
    const query = `
      INSERT INTO users (
        uid, email, password_hash, first_name, last_name, role, 
        teacher_id, department, phone, experience, specialization, join_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)
    `;

    const uid = uuidv4();
    const email = `${empId}@teacher.edu`; // Auto-generated email
    const passwordHash = await bcrypt.hash('defaultPassword123', 10); // Default password

    const params = [
      uid, email, passwordHash, firstName, lastName, 'teacher',
      empId, department, mobileNo, experience, specialization
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create teacher account'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Teacher account created successfully',
      data: {
        empId,
        name: teacherName,
        department,
        loginCredentials: {
          username: empId,
          password: mobileNo
        }
      }
    });

  } catch (error) {
    console.error('Create teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all students
router.get('/students', async (req, res) => {
  try {
    const { department, batch } = req.query;
    
    let query = `
      SELECT id, uid, first_name, last_name, student_id, department, 
             phone, batch, specialization, enrollment_year, is_active, created_at
      FROM users 
      WHERE role = 'student'
    `;
    
    const params = [];
    
    if (department) {
      query += ' AND department = ?';
      params.push(department);
    }
    
    if (batch) {
      query += ' AND batch = ?';
      params.push(batch);
    }
    
    query += ' ORDER BY created_at DESC';

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch students'
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all teachers
router.get('/teachers', async (req, res) => {
  try {
    const { department } = req.query;
    
    let query = `
      SELECT id, uid, first_name, last_name, teacher_id, department, 
             phone, experience, specialization, is_active, join_date, created_at
      FROM users 
      WHERE role = 'teacher'
    `;
    
    const params = [];
    
    if (department) {
      query += ' AND department = ?';
      params.push(department);
    }
    
    query += ' ORDER BY created_at DESC';

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch teachers'
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    const queries = [
      'SELECT COUNT(*) as count FROM users WHERE role = "student" AND is_active = true',
      'SELECT COUNT(*) as count FROM users WHERE role = "teacher" AND is_active = true',
      'SELECT COUNT(*) as count FROM projects WHERE status = "submitted"',
      'SELECT COUNT(*) as count FROM internships WHERE status = "ongoing"'
    ];

    const results = await Promise.all(queries.map(query => executeQuery(query)));

    const stats = {
      totalStudents: results[0].success ? results[0].data[0].count : 0,
      totalTeachers: results[1].success ? results[1].data[0].count : 0,
      pendingProjects: results[2].success ? results[2].data[0].count : 0,
      ongoingInternships: results[3].success ? results[3].data[0].count : 0
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PERMANENT DELETE STUDENT - NEW ROUTE (place this BEFORE the soft delete route)
router.delete('/students/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;

    // First, get student information for logging and response
    const getStudentQuery = `
      SELECT id, first_name, last_name, student_id, email 
      FROM users 
      WHERE id = ? AND role = 'student'
    `;
    
    const studentResult = await executeQuery(getStudentQuery, [id]);

    if (!studentResult.success || studentResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
        code: 'STUDENT_NOT_FOUND'
      });
    }

    const student = studentResult.data[0];

    // TODO: Delete related records if you have any foreign key relationships
    // Example: If you have tables like student_projects, student_submissions, etc.
    // await executeQuery('DELETE FROM student_projects WHERE user_id = ?', [id]);
    // await executeQuery('DELETE FROM student_submissions WHERE user_id = ?', [id]);
    // await executeQuery('DELETE FROM student_grades WHERE user_id = ?', [id]);

    // Permanently delete the student from users table
    const deleteQuery = 'DELETE FROM users WHERE id = ? AND role = "student"';
    const deleteResult = await executeQuery(deleteQuery, [id]);

    if (!deleteResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to permanently delete student from database'
      });
    }

    if (deleteResult.data.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or already deleted'
      });
    }

    // Log the permanent deletion for audit purposes
    console.log(`PERMANENT DELETION AUDIT LOG:`, {
      action: 'PERMANENT_DELETE_STUDENT',
      deletedStudent: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        studentId: student.student_id,
        email: student.email
      },
      adminUser: req.user.email,
      timestamp: new Date().toISOString(),
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Student ${student.first_name} ${student.last_name} has been permanently deleted from the database`,
      data: {
        deletedStudent: {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          studentId: student.student_id
        }
      }
    });

  } catch (error) {
    console.error('Permanent delete student error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during permanent deletion',
      code: 'PERMANENT_DELETE_ERROR'
    });
  }
});

// Delete student (soft delete - existing functionality)
router.delete('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'UPDATE users SET is_active = false WHERE id = ? AND role = "student"';
    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to deactivate student'
      });
    }

    res.json({
      success: true,
      message: 'Student deactivated successfully'
    });

  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PERMANENT DELETE TEACHER - NEW ROUTE (place this BEFORE the soft delete route)
router.delete('/teachers/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;

    // First, get teacher information for logging and response
    const getTeacherQuery = `
      SELECT id, first_name, last_name, teacher_id, email 
      FROM users 
      WHERE id = ? AND role = 'teacher'
    `;
    
    const teacherResult = await executeQuery(getTeacherQuery, [id]);

    if (!teacherResult.success || teacherResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found',
        code: 'TEACHER_NOT_FOUND'
      });
    }

    const teacher = teacherResult.data[0];

    // TODO: Delete related records if you have any foreign key relationships
    // Example: If you have tables like teacher_courses, teacher_projects, etc.
    // await executeQuery('DELETE FROM teacher_courses WHERE user_id = ?', [id]);
    // await executeQuery('DELETE FROM teacher_assignments WHERE user_id = ?', [id]);
    // await executeQuery('DELETE FROM teacher_evaluations WHERE user_id = ?', [id]);

    // Permanently delete the teacher from users table
    const deleteQuery = 'DELETE FROM users WHERE id = ? AND role = "teacher"';
    const deleteResult = await executeQuery(deleteQuery, [id]);

    if (!deleteResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to permanently delete teacher from database'
      });
    }

    if (deleteResult.data.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found or already deleted'
      });
    }

    // Log the permanent deletion for audit purposes
    console.log(`PERMANENT DELETION AUDIT LOG:`, {
      action: 'PERMANENT_DELETE_TEACHER',
      deletedTeacher: {
        id: teacher.id,
        name: `${teacher.first_name} ${teacher.last_name}`,
        teacherId: teacher.teacher_id,
        email: teacher.email
      },
      adminUser: req.user.email,
      timestamp: new Date().toISOString(),
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Teacher ${teacher.first_name} ${teacher.last_name} has been permanently deleted from the database`,
      data: {
        deletedTeacher: {
          id: teacher.id,
          name: `${teacher.first_name} ${teacher.last_name}`,
          teacherId: teacher.teacher_id
        }
      }
    });

  } catch (error) {
    console.error('Permanent delete teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during permanent deletion',
      code: 'PERMANENT_DELETE_ERROR'
    });
  }
});

// Delete teacher (soft delete - existing functionality)
router.delete('/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'UPDATE users SET is_active = false WHERE id = ? AND role = "teacher"';
    const result = await executeQuery(query, [id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to deactivate teacher'
      });
    }

    res.json({
      success: true,
      message: 'Teacher deactivated successfully'
    });

  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get pending teacher accounts for verification
router.get('/teachers/pending', async (req, res) => {
  try {
    const query = `
      SELECT
        id, uid, first_name, last_name, email, teacher_id,
        department, experience, joining_year,
        qualifications, specialization, phone, created_at
      FROM users
      WHERE role = 'teacher' AND account_verified = false AND is_active = true
      ORDER BY created_at DESC
    `;

    const result = await executeQuery(query);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch pending teacher accounts'
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: result.data.length > 0 ? 'Pending teachers fetched successfully' : 'No pending teacher accounts found'
    });

  } catch (error) {
    console.error('Get pending teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get verified teachers
router.get('/teachers/verified', async (req, res) => {
  try {
    const query = `
      SELECT
        id, uid, first_name, last_name, email, teacher_id,
        department, experience, joining_year,
        qualifications, specialization, phone, created_at, last_login
      FROM users
      WHERE role = 'teacher' AND account_verified = true AND is_active = true
      ORDER BY created_at DESC
    `;

    const result = await executeQuery(query);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch verified teachers'
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: result.data.length > 0 ? 'Verified teachers fetched successfully' : 'No verified teachers found'
    });

  } catch (error) {
    console.error('Get verified teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify teacher account
router.patch('/teachers/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "approve" or "reject"'
      });
    }

    // Get teacher details first
    const teacherQuery = 'SELECT * FROM users WHERE id = ? AND role = "teacher"';
    const teacherResult = await executeQuery(teacherQuery, [id]);

    if (!teacherResult.success || teacherResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    const teacher = teacherResult.data[0];

    if (action === 'approve') {
      // Approve teacher account
      const updateQuery = `
        UPDATE users
        SET account_verified = true, email_verified = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const updateResult = await executeQuery(updateQuery, [id]);

      if (!updateResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to approve teacher account'
        });
      }

      res.json({
        success: true,
        message: `Teacher account for ${teacher.first_name} ${teacher.last_name} has been approved`,
        data: {
          teacherId: teacher.teacher_id,
          name: `${teacher.first_name} ${teacher.last_name}`,
          email: teacher.email,
          status: 'approved'
        }
      });

    } else {
      // Reject teacher account - deactivate instead of delete
      const updateQuery = `
        UPDATE users
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const updateResult = await executeQuery(updateQuery, [id]);

      if (!updateResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to reject teacher account'
        });
      }

      res.json({
        success: true,
        message: `Teacher account for ${teacher.first_name} ${teacher.last_name} has been rejected`,
        data: {
          teacherId: teacher.teacher_id,
          name: `${teacher.first_name} ${teacher.last_name}`,
          email: teacher.email,
          status: 'rejected'
        }
      });
    }

  } catch (error) {
    console.error('Verify teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
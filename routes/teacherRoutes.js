// backend/routes/teacherRoutes.js - Teacher Management Routes
import express from 'express';
import { executeQuery } from '../config/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all teacher routes
router.use(authMiddleware);
router.use(roleMiddleware(['teacher']));

// Get pending student accounts for verification
router.get('/students/pending', async (req, res) => {
  try {
    const query = `
      SELECT id, uid, student_id, first_name, last_name, email, phone,
             department, batch, specialization, enrollment_year, created_at
      FROM users
      WHERE role = 'student' AND account_verified = false AND is_active = true
      ORDER BY created_at DESC
    `;

    const result = await executeQuery(query);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch pending student accounts'
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get pending students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify student account
router.patch('/students/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Valid action (approve, reject) is required'
      });
    }

    // Check if student exists and is pending verification
    const checkQuery = `
      SELECT id, first_name, last_name, student_id, email
      FROM users
      WHERE id = ? AND role = 'student' AND account_verified = false AND is_active = true
    `;

    const checkResult = await executeQuery(checkQuery, [id]);

    if (!checkResult.success || checkResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or already verified'
      });
    }

    const student = checkResult.data[0];

    if (action === 'approve') {
      // Approve student account
      const updateQuery = `
        UPDATE users
        SET account_verified = true,
            verified_by = ?,
            verification_date = CURRENT_TIMESTAMP,
            verification_notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const result = await executeQuery(updateQuery, [req.user.userId, notes || null, id]);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to approve student account'
        });
      }

      res.json({
        success: true,
        message: `Student account for ${student.first_name} ${student.last_name} (${student.student_id}) has been approved`
      });
    } else {
      // Reject student account (deactivate)
      const updateQuery = `
        UPDATE users
        SET is_active = false,
            verified_by = ?,
            verification_notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const result = await executeQuery(updateQuery, [req.user.userId, notes || 'Account rejected', id]);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to reject student account'
        });
      }

      res.json({
        success: true,
        message: `Student account for ${student.first_name} ${student.last_name} (${student.student_id}) has been rejected`
      });
    }

  } catch (error) {
    console.error('Verify student error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get verified students
router.get('/students/verified', async (req, res) => {
  try {
    const query = `
      SELECT s.id, s.uid, s.student_id, s.first_name, s.last_name, s.email, s.phone,
             s.department, s.batch, s.specialization, s.enrollment_year,
             s.verification_date, s.verification_notes,
             CONCAT(t.first_name, ' ', t.last_name) as verified_by_name,
             t.teacher_id as verified_by_id
      FROM users s
      LEFT JOIN users t ON s.verified_by = t.id
      WHERE s.role = 'student' AND s.account_verified = true AND s.is_active = true
      ORDER BY s.verification_date DESC
    `;

    const result = await executeQuery(query);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch verified students'
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get verified students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get projects where teacher is the guide
router.get('/projects', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT p.*, 
             CONCAT(s.first_name, ' ', s.last_name) as student_name,
             s.student_id,
             s.department as student_department,
             s.batch
      FROM projects p
      JOIN users s ON p.student_id = s.id
      WHERE p.teacher_id = ?
    `;
    
    const params = [req.user.userId];
    
    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY p.created_at DESC';

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch projects'
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get teacher projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get internships where teacher is the guide
router.get('/internships', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT i.*, 
             CONCAT(s.first_name, ' ', s.last_name) as student_name,
             s.student_id,
             s.department as student_department,
             s.batch
      FROM internships i
      JOIN users s ON i.student_id = s.id
      WHERE i.verified_by = ?
    `;
    
    const params = [req.user.userId];
    
    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY i.created_at DESC';

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch internships'
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get teacher internships error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update project status
router.patch('/projects/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;

    // Validation
    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (pending, approved, rejected) is required'
      });
    }

    // Check if project belongs to this teacher
    const checkQuery = `
      SELECT id FROM projects 
      WHERE id = ? AND teacher_id = ?
    `;
    
    const checkResult = await executeQuery(checkQuery, [id, req.user.userId]);
    
    if (!checkResult.success || checkResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Update project status
    const updateQuery = `
      UPDATE projects 
      SET status = ?, feedback = ?, 
          approval_date = ${status === 'approved' ? 'CURRENT_TIMESTAMP' : 'NULL'},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = await executeQuery(updateQuery, [status, feedback || null, id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update project status'
      });
    }

    res.json({
      success: true,
      message: 'Project status updated successfully'
    });

  } catch (error) {
    console.error('Update project status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update internship status
router.patch('/internships/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;

    // Validation
    if (!status || !['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (pending, verified, rejected) is required'
      });
    }

    // Check if internship belongs to this teacher
    const checkQuery = `
      SELECT id FROM internships 
      WHERE id = ? AND verified_by = ?
    `;
    
    const checkResult = await executeQuery(checkQuery, [id, req.user.userId]);
    
    if (!checkResult.success || checkResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Internship not found or access denied'
      });
    }

    // Update internship status
    const updateQuery = `
      UPDATE internships 
      SET status = ?, feedback = ?, 
          verification_date = ${status === 'verified' ? 'CURRENT_TIMESTAMP' : 'NULL'},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = await executeQuery(updateQuery, [status, feedback || null, id]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update internship status'
      });
    }

    res.json({
      success: true,
      message: 'Internship status updated successfully'
    });

  } catch (error) {
    console.error('Update internship status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get teacher dashboard summary
router.get('/dashboard/summary', async (req, res) => {
  try {
    const queries = [
      'SELECT COUNT(*) as count FROM projects WHERE teacher_id = ?',
      'SELECT COUNT(*) as count FROM projects WHERE teacher_id = ? AND status = "submitted"',
      'SELECT COUNT(*) as count FROM projects WHERE teacher_id = ? AND status = "approved"',
      'SELECT COUNT(*) as count FROM internships WHERE verified_by = ?',
      'SELECT COUNT(*) as count FROM internships WHERE verified_by = ? AND status = "submitted"',
      'SELECT COUNT(*) as count FROM internships WHERE verified_by = ? AND status = "verified"'
    ];

    const userId = req.user.userId;
    const results = await Promise.all(queries.map(query => executeQuery(query, [userId])));

    const summary = {
      totalProjects: results[0].success ? results[0].data[0].count : 0,
      pendingProjects: results[1].success ? results[1].data[0].count : 0,
      approvedProjects: results[2].success ? results[2].data[0].count : 0,
      totalInternships: results[3].success ? results[3].data[0].count : 0,
      pendingInternships: results[4].success ? results[4].data[0].count : 0,
      verifiedInternships: results[5].success ? results[5].data[0].count : 0
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Get teacher summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get repository of approved projects and verified internships (accessible by all teachers)
router.get('/repository/projects', async (req, res) => {
  try {
    const query = `
      SELECT p.*, 
             CONCAT(s.first_name, ' ', s.last_name) as student_name,
             s.student_id,
             s.department as student_department,
             s.batch,
             CONCAT(t.first_name, ' ', t.last_name) as guide_name,
             t.teacher_id as guide_id
      FROM projects p
      JOIN users s ON p.student_id = s.id
      JOIN users t ON p.teacher_id = t.id
      WHERE p.status = 'approved'
      ORDER BY p.approval_date DESC
    `;

    const result = await executeQuery(query);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch project repository'
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get project repository error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/repository/internships', async (req, res) => {
  try {
    const query = `
      SELECT i.*, 
             CONCAT(s.first_name, ' ', s.last_name) as student_name,
             s.student_id,
             s.department as student_department,
             s.batch,
             CONCAT(t.first_name, ' ', t.last_name) as guide_name,
             t.teacher_id as guide_id
      FROM internships i
      JOIN users s ON i.student_id = s.id
      JOIN users t ON i.verified_by = t.id
      WHERE i.status = 'verified'
      ORDER BY i.verification_date DESC
    `;

    const result = await executeQuery(query);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch internship repository'
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get internship repository error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Download project file
router.get('/download/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT file_url, title, 
             CONCAT(s.first_name, ' ', s.last_name) as student_name
      FROM projects p
      JOIN users s ON p.student_id = s.id
      WHERE p.id = ? AND (p.teacher_id = ? OR p.status = 'approved')
    `;

    const result = await executeQuery(query, [id, req.user.userId]);

    if (!result.success || result.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    const project = result.data[0];
    
    res.json({
      success: true,
      data: {
        downloadUrl: project.file_url,
        fileName: `${project.title}_${project.student_name}.zip`
      }
    });

  } catch (error) {
    console.error('Download project error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Download certificate
router.get('/download/certificate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT certificate_url, company_name, position,
             CONCAT(s.first_name, ' ', s.last_name) as student_name
      FROM internships i
      JOIN users s ON i.student_id = s.id
      WHERE i.id = ? AND (i.verified_by = ? OR i.status = 'verified')
    `;

    const result = await executeQuery(query, [id, req.user.userId]);

    if (!result.success || result.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found or access denied'
      });
    }

    const internship = result.data[0];
    
    res.json({
      success: true,
      data: {
        downloadUrl: internship.certificate_url,
        fileName: `${internship.company_name}_${internship.position}_${internship.student_name}_certificate.pdf`
      }
    });

  } catch (error) {
    console.error('Download certificate error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
// backend/routes/studentRoutes.js - Student Management Routes
import express from 'express';
import multer from 'multer';
import { executeQuery } from '../config/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';
import { uploadToPinata } from '../services/pinataService.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'projectFile') {
      // Only allow zip files for projects
      if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
        cb(null, true);
      } else {
        cb(new Error('Only ZIP files are allowed for projects'), false);
      }
    } else if (file.fieldname === 'certificate') {
      // Allow PDF, JPG, PNG for certificates
      if (file.mimetype === 'application/pdf' || 
          file.mimetype === 'image/jpeg' || 
          file.mimetype === 'image/png') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF, JPG, and PNG files are allowed for certificates'), false);
      }
    } else {
      cb(new Error('Invalid file field'), false);
    }
  }
});

// Apply auth middleware to all student routes
router.use(authMiddleware);
router.use(roleMiddleware(['student']));

// Get all teachers for dropdown
router.get('/teachers', async (req, res) => {
  try {
    const query = `
      SELECT id, first_name, last_name, teacher_id, department, specialization
      FROM users 
      WHERE role = 'teacher' AND is_active = true
      ORDER BY first_name, last_name
    `;

    const result = await executeQuery(query);

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

// Submit Project
router.post('/projects', upload.single('projectFile'), async (req, res) => {
  try {
    const {
      projectName,
      department,
      year,
      semester,
      projectType, // 'individual' or 'group'
      members,
      projectGuideId
    } = req.body;

    // Validation
    if (!projectName || !department || !year || !semester || !projectType || !projectGuideId) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Project file (ZIP) is required'
      });
    }

    // Upload file to Pinata
    const uploadResult = await uploadToPinata(req.file);
    
    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload project file'
      });
    }

    // Parse members if it's a group project
    let parsedMembers = null;
    if (projectType === 'group' && members) {
      try {
        parsedMembers = JSON.parse(members);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid members format'
        });
      }
    }

    // Insert project into database
    const query = `
      INSERT INTO projects (
        title, student_id, teacher_id, department, year, semester,
        project_type, members, file_url, file_hash, status, submission_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', CURRENT_TIMESTAMP)
    `;

    const params = [
      projectName,
      req.user.userId,
      projectGuideId,
      department,
      year,
      semester,
      projectType,
      parsedMembers ? JSON.stringify(parsedMembers) : null,
      uploadResult.fileUrl,
      uploadResult.fileHash
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to submit project'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Project submitted successfully',
      data: {
        projectId: result.data.insertId,
        fileUrl: uploadResult.fileUrl
      }
    });

  } catch (error) {
    console.error('Submit project error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Submit Internship Certificate
router.post('/internships', upload.single('certificate'), async (req, res) => {
  try {
    const {
      companyName,
      role,
      duration,
      stipend, // 'yes' or 'no'
      internshipGuideId
    } = req.body;

    // Validation
    if (!companyName || !role || !duration || !stipend || !internshipGuideId) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Certificate file is required'
      });
    }

    // Upload certificate to Pinata
    const uploadResult = await uploadToPinata(req.file);
    
    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload certificate'
      });
    }

    // Parse duration (assuming format: "3 months" or "6 weeks")
    const durationParts = duration.split(' ');
    const durationValue = parseInt(durationParts[0]);
    const durationUnit = durationParts[1];

    // Calculate start and end dates (approximate)
    const endDate = new Date();
    const startDate = new Date();
    if (durationUnit.includes('month')) {
      startDate.setMonth(startDate.getMonth() - durationValue);
    } else if (durationUnit.includes('week')) {
      startDate.setDate(startDate.getDate() - (durationValue * 7));
    }

    // Insert internship into database
    const query = `
      INSERT INTO internships (
        student_id, company_name, position, start_date, end_date,
        duration, stipend, verified_by, certificate_url, certificate_hash,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', CURRENT_TIMESTAMP)
    `;

    const params = [
      req.user.userId,
      companyName,
      role,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      duration,
      stipend,
      internshipGuideId,
      uploadResult.fileUrl,
      uploadResult.fileHash
    ];

    const result = await executeQuery(query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to submit internship certificate'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Internship certificate submitted successfully',
      data: {
        internshipId: result.data.insertId,
        certificateUrl: uploadResult.fileUrl
      }
    });

  } catch (error) {
    console.error('Submit internship error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get student's projects
router.get('/projects', async (req, res) => {
  try {
    const query = `
      SELECT p.*,
             CONCAT(t.first_name, ' ', t.last_name) as guide_name,
             t.teacher_id as guide_id,
             CONCAT(u.first_name, ' ', u.last_name) as creator_name,
             u.student_id as creator_student_id
      FROM projects p
      LEFT JOIN users t ON p.teacher_id = t.id
      LEFT JOIN users u ON p.student_id = u.id
      WHERE p.student_id = ?
         OR (p.project_type = 'group' AND JSON_SEARCH(p.members, 'one', ?, NULL, '$[*].studentId') IS NOT NULL)
      ORDER BY p.created_at DESC
    `;

    const result = await executeQuery(query, [req.user.userId, req.user.studentId]);

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
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get student's internships
router.get('/internships', async (req, res) => {
  try {
    const query = `
      SELECT i.*, 
             CONCAT(t.first_name, ' ', t.last_name) as guide_name,
             t.teacher_id as guide_id
      FROM internships i
      LEFT JOIN users t ON i.verified_by = t.id
      WHERE i.student_id = ?
      ORDER BY i.created_at DESC
    `;

    const result = await executeQuery(query, [req.user.userId]);

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
    console.error('Get internships error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get dashboard summary
router.get('/dashboard/summary', async (req, res) => {
  try {
    const queries = [
      `SELECT COUNT(*) as count FROM projects WHERE student_id = ?
       OR (project_type = 'group' AND JSON_SEARCH(members, 'one', ?, NULL, '$[*].studentId') IS NOT NULL)`,
      `SELECT COUNT(*) as count FROM projects WHERE (student_id = ?
       OR (project_type = 'group' AND JSON_SEARCH(members, 'one', ?, NULL, '$[*].studentId') IS NOT NULL))
       AND status = "approved"`,
      'SELECT COUNT(*) as count FROM internships WHERE student_id = ?',
      'SELECT COUNT(*) as count FROM internships WHERE student_id = ? AND status = "verified"'
    ];

    const userId = req.user.userId;
    const studentId = req.user.studentId;

    // Prepare parameters for each query
    const queryParams = [
      [userId, studentId],  // Total projects
      [userId, studentId],  // Approved projects
      [userId],             // Total internships
      [userId]              // Verified internships
    ];

    const results = await Promise.all(queries.map((query, index) =>
      executeQuery(query, queryParams[index])
    ));

    const summary = {
      totalProjects: results[0].success ? results[0].data[0].count : 0,
      approvedProjects: results[1].success ? results[1].data[0].count : 0,
      totalInternships: results[2].success ? results[2].data[0].count : 0,
      verifiedInternships: results[3].success ? results[3].data[0].count : 0
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
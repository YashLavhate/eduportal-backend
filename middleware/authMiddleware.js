// backend/middleware/authMiddleware.js - Authentication Middleware
import { jwtService } from '../services/jwtService.js';
import { executeQuery } from '../config/database.js';

// Authentication middleware
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwtService.verifyAccessToken(token);
      
      // Get fresh user data from database
      const query = 'SELECT * FROM users WHERE id = ? AND is_active = true';
      const result = await executeQuery(query, [decoded.userId]);
      
      if (!result.success || result.data.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND'
        });
      }

      const user = result.data[0];
      
      // Add user info to request object
      req.user = {
        userId: user.id,
        uid: user.uid,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
        studentId: user.student_id,
        teacherId: user.teacher_id,
        adminId: user.admin_id,
        department: user.department,
        toJSON: () => {
          const { password_hash, ...userWithoutPassword } = user;
          return userWithoutPassword;
        }
      };

      next();
    } catch (tokenError) {
      let errorMessage = 'Invalid token';
      let errorCode = 'INVALID_TOKEN';

      if (tokenError.message.includes('expired')) {
        errorMessage = 'Token expired';
        errorCode = 'TOKEN_EXPIRED';
      }

      return res.status(401).json({
        success: false,
        message: errorMessage,
        code: errorCode
      });
    }

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

// Role-based authorization middleware
export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error',
        code: 'AUTH_ERROR'
      });
    }
  };
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwtService.verifyAccessToken(token);
      
      const query = 'SELECT * FROM users WHERE id = ? AND is_active = true';
      const result = await executeQuery(query, [decoded.userId]);
      
      if (result.success && result.data.length > 0) {
        const user = result.data[0];
        req.user = {
          userId: user.id,
          uid: user.uid,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          studentId: user.student_id,
          teacherId: user.teacher_id,
          adminId: user.admin_id,
          department: user.department,
          toJSON: () => {
            const { password_hash, ...userWithoutPassword } = user;
            return userWithoutPassword;
          }
        };
      } else {
        req.user = null;
      }
    } catch (tokenError) {
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};

// Admin only middleware
export const adminOnlyMiddleware = roleMiddleware(['administrator']);

// Teacher or Admin middleware
export const teacherOrAdminMiddleware = roleMiddleware(['teacher', 'administrator']);

// Student only middleware
export const studentOnlyMiddleware = roleMiddleware(['student']);

// Check if user owns the resource (for students accessing their own data)
export const resourceOwnerMiddleware = (resourceUserIdField = 'student_id') => {
  return async (req, res, next) => {
    try {
      // For students, they can only access their own resources
      if (req.user.role === 'student') {
        // Extract resource ID from params
        const resourceId = req.params.id || req.params.projectId || req.params.internshipId;
        
        if (!resourceId) {
          return res.status(400).json({
            success: false,
            message: 'Resource ID required'
          });
        }

        // Check if the resource belongs to the current user
        const tableName = req.baseUrl.includes('projects') ? 'projects' : 'internships';
        const query = `SELECT ${resourceUserIdField} FROM ${tableName} WHERE id = ?`;
        const result = await executeQuery(query, [resourceId]);
        
        if (!result.success || result.data.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Resource not found'
          });
        }

        const resourceOwnerId = result.data[0][resourceUserIdField];
        
        if (resourceOwnerId !== req.user.userId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You can only access your own resources'
          });
        }
      }

      // Teachers and admins can access any resource
      next();
    } catch (error) {
      console.error('Resource owner middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

export default {
  authMiddleware,
  roleMiddleware,
  optionalAuthMiddleware,
  adminOnlyMiddleware,
  teacherOrAdminMiddleware,
  studentOnlyMiddleware,
  resourceOwnerMiddleware
};
// backend/services/jwtService.js - JWT Token Service
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';

class JWTService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'your_access_token_secret';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'your_refresh_token_secret';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  // Generate access token
  generateAccessToken(payload) {
    try {
      const tokenPayload = {
        userId: payload.id,
        uid: payload.uid,
        email: payload.email,
        role: payload.role,
        isActive: payload.isActive,
        tokenType: 'access'
      };

      return jwt.sign(tokenPayload, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiry,
        issuer: 'eduportal-api',
        audience: 'eduportal-client'
      });
    } catch (error) {
      throw new Error(`Access token generation failed: ${error.message}`);
    }
  }

  // Generate refresh token
  async generateRefreshToken(userId) {
    try {
      const tokenId = uuidv4();
      const tokenPayload = {
        tokenId,
        userId,
        tokenType: 'refresh'
      };

      const refreshToken = jwt.sign(tokenPayload, this.refreshTokenSecret, {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'eduportal-api',
        audience: 'eduportal-client'
      });

      // Hash the token for storage
      const tokenHash = await bcrypt.hash(refreshToken, 10);
      
      // Calculate expiry date
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7); // 7 days

      // Store refresh token in database
      const query = `
        INSERT INTO refresh_tokens (token_id, user_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?)
      `;
      
      const result = await executeQuery(query, [tokenId, userId, tokenHash, expiryDate]);
      
      if (!result.success) {
        throw new Error('Failed to store refresh token');
      }

      return { refreshToken, tokenId };
    } catch (error) {
      throw new Error(`Refresh token generation failed: ${error.message}`);
    }
  }

  // Generate token pair
  async generateTokenPair(user) {
    try {
      const accessToken = this.generateAccessToken(user);
      const { refreshToken, tokenId } = await this.generateRefreshToken(user.id);

      return {
        accessToken,
        refreshToken,
        tokenId,
        expiresIn: this.accessTokenExpiry
      };
    } catch (error) {
      throw new Error(`Token pair generation failed: ${error.message}`);
    }
  }

  // Verify access token
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'eduportal-api',
        audience: 'eduportal-client'
      });

      if (decoded.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      } else {
        throw new Error(`Access token verification failed: ${error.message}`);
      }
    }
  }

  // Verify refresh token
  async verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'eduportal-api',
        audience: 'eduportal-client'
      });

      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if token exists in database and is not revoked
      const query = `
        SELECT rt.*, u.id, u.uid, u.email, u.role, u.is_active
        FROM refresh_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token_id = ? AND rt.is_revoked = false AND rt.expires_at > NOW()
      `;
      
      const result = await executeQuery(query, [decoded.tokenId]);
      
      if (!result.success || result.data.length === 0) {
        throw new Error('Invalid or expired refresh token');
      }

      const tokenData = result.data[0];
      
      // Verify token hash
      const isValidToken = await bcrypt.compare(token, tokenData.token_hash);
      if (!isValidToken) {
        throw new Error('Invalid refresh token');
      }

      // Check if user is still active
      if (!tokenData.is_active) {
        throw new Error('User account is inactive');
      }

      return {
        tokenId: decoded.tokenId,
        userId: decoded.userId,
        user: {
          id: tokenData.id,
          uid: tokenData.uid,
          email: tokenData.email,
          role: tokenData.role,
          isActive: tokenData.is_active
        }
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else {
        throw new Error(`Refresh token verification failed: ${error.message}`);
      }
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken) {
    try {
      const { user, tokenId } = await this.verifyRefreshToken(refreshToken);
      
      // Generate new access token
      const newAccessToken = this.generateAccessToken(user);
      
      return {
        accessToken: newAccessToken,
        expiresIn: this.accessTokenExpiry,
        tokenType: 'Bearer'
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  // Revoke refresh token
  async revokeRefreshToken(tokenId) {
    try {
      const query = `
        UPDATE refresh_tokens 
        SET is_revoked = true, updated_at = CURRENT_TIMESTAMP 
        WHERE token_id = ?
      `;
      
      const result = await executeQuery(query, [tokenId]);
      
      if (!result.success) {
        throw new Error('Failed to revoke token');
      }

      return true;
    } catch (error) {
      throw new Error(`Token revocation failed: ${error.message}`);
    }
  }

  // Revoke all user tokens
  async revokeAllUserTokens(userId) {
    try {
      const query = `
        UPDATE refresh_tokens 
        SET is_revoked = true, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND is_revoked = false
      `;
      
      const result = await executeQuery(query, [userId]);
      
      if (!result.success) {
        throw new Error('Failed to revoke user tokens');
      }

      return true;
    } catch (error) {
      throw new Error(`User tokens revocation failed: ${error.message}`);
    }
  }

  // Clean expired tokens
  async cleanExpiredTokens() {
    try {
      const query = `
        DELETE FROM refresh_tokens 
        WHERE expires_at < NOW() OR is_revoked = true
      `;
      
      const result = await executeQuery(query);
      
      if (!result.success) {
        throw new Error('Failed to clean expired tokens');
      }

      return result.data.affectedRows || 0;
    } catch (error) {
      throw new Error(`Token cleanup failed: ${error.message}`);
    }
  }

  // Get token info
  getTokenInfo(token) {
    try {
      // Don't verify, just decode to get info
      const decoded = jwt.decode(token);
      return {
        tokenType: decoded.tokenType,
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        issuedAt: new Date(decoded.iat * 1000),
        expiresAt: new Date(decoded.exp * 1000),
        issuer: decoded.iss,
        audience: decoded.aud
      };
    } catch (error) {
      throw new Error('Failed to decode token');
    }
  }

  // Generate password reset token
  async generatePasswordResetToken(userId) {
    try {
      const token = uuidv4();
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1); // 1 hour expiry

      const query = `
        INSERT INTO password_resets (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `;
      
      const result = await executeQuery(query, [userId, token, expiryDate]);
      
      if (!result.success) {
        throw new Error('Failed to generate password reset token');
      }

      return token;
    } catch (error) {
      throw new Error(`Password reset token generation failed: ${error.message}`);
    }
  }

  // Verify password reset token
  async verifyPasswordResetToken(token) {
    try {
      const query = `
        SELECT pr.*, u.id, u.email, u.first_name, u.last_name
        FROM password_resets pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.token = ? AND pr.is_used = false AND pr.expires_at > NOW()
      `;
      
      const result = await executeQuery(query, [token]);
      
      if (!result.success || result.data.length === 0) {
        throw new Error('Invalid or expired password reset token');
      }

      return result.data[0];
    } catch (error) {
      throw new Error(`Password reset token verification failed: ${error.message}`);
    }
  }

  // Mark password reset token as used
  async markPasswordResetTokenUsed(token) {
    try {
      const query = `
        UPDATE password_resets 
        SET is_used = true 
        WHERE token = ?
      `;
      
      const result = await executeQuery(query, [token]);
      
      if (!result.success) {
        throw new Error('Failed to mark token as used');
      }

      return true;
    } catch (error) {
      throw new Error(`Password reset token update failed: ${error.message}`);
    }
  }
}

// Create and export singleton instance
export const jwtService = new JWTService();
export default jwtService;
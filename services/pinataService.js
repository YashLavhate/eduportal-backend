// backend/services/pinataService.js - Pinata Cloud Storage Service
import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';

class PinataService {
  constructor() {
    this.apiKey = process.env.PINATA_API_KEY;
    this.secretKey = process.env.PINATA_SECRET_KEY;
    this.gatewayUrl = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';
    
    if (!this.apiKey || !this.secretKey) {
      console.warn('⚠️  Pinata API credentials not found. File uploads will not work.');
    }
  }

  // Upload file to Pinata
  async uploadFile(file) {
    try {
      if (!this.apiKey || !this.secretKey) {
        throw new Error('Pinata API credentials not configured');
      }

      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const fileHash = crypto.createHash('md5').update(file.buffer).digest('hex');
      const uniqueFilename = `${timestamp}_${fileHash}_${file.originalname}`;

      // Add metadata
      const metadata = {
        name: uniqueFilename,
        keyvalues: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          fileSize: file.size,
          mimeType: file.mimetype,
          hash: fileHash
        }
      };

      formData.append('pinataMetadata', JSON.stringify(metadata));

      // Pin options
      const pinataOptions = {
        cidVersion: 0,
        customPinPolicy: {
          regions: [
            {
              id: 'FRA1',
              desiredReplicationCount: 1
            },
            {
              id: 'NYC1', 
              desiredReplicationCount: 1
            }
          ]
        }
      };

      formData.append('pinataOptions', JSON.stringify(pinataOptions));

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            'pinata_api_key': this.apiKey,
            'pinata_secret_api_key': this.secretKey,
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 120000 // 2 minutes timeout
        }
      );

      if (response.status === 200 && response.data.IpfsHash) {
        const fileUrl = `${this.gatewayUrl}/ipfs/${response.data.IpfsHash}`;
        
        return {
          success: true,
          data: {
            ipfsHash: response.data.IpfsHash,
            fileUrl: fileUrl,
            fileName: uniqueFilename,
            originalName: file.originalname,
            fileSize: file.size,
            timestamp: response.data.Timestamp,
            pinSize: response.data.PinSize,
            fileHash: fileHash
          }
        };
      } else {
        throw new Error('Upload failed: Invalid response from Pinata');
      }

    } catch (error) {
      console.error('Pinata upload error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Upload failed',
        details: error.response?.data
      };
    }
  }

  // Get file info from Pinata
  async getFileInfo(ipfsHash) {
    try {
      if (!this.apiKey || !this.secretKey) {
        throw new Error('Pinata API credentials not configured');
      }

      const response = await axios.get(
        `https://api.pinata.cloud/data/pinList?hashContains=${ipfsHash}`,
        {
          headers: {
            'pinata_api_key': this.apiKey,
            'pinata_secret_api_key': this.secretKey
          }
        }
      );

      if (response.status === 200 && response.data.rows.length > 0) {
        return {
          success: true,
          data: response.data.rows[0]
        };
      } else {
        throw new Error('File not found');
      }

    } catch (error) {
      console.error('Get file info error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to get file info'
      };
    }
  }

  // Unpin file from Pinata (delete)
  async unpinFile(ipfsHash) {
    try {
      if (!this.apiKey || !this.secretKey) {
        throw new Error('Pinata API credentials not configured');
      }

      const response = await axios.delete(
        `https://api.pinata.cloud/pinning/unpin/${ipfsHash}`,
        {
          headers: {
            'pinata_api_key': this.apiKey,
            'pinata_secret_api_key': this.secretKey
          }
        }
      );

      if (response.status === 200) {
        return {
          success: true,
          message: 'File unpinned successfully'
        };
      } else {
        throw new Error('Unpin failed');
      }

    } catch (error) {
      console.error('Unpin file error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to unpin file'
      };
    }
  }

  // Test Pinata connection
  async testAuthentication() {
    try {
      if (!this.apiKey || !this.secretKey) {
        return {
          success: false,
          error: 'API credentials not configured'
        };
      }

      const response = await axios.get(
        'https://api.pinata.cloud/data/testAuthentication',
        {
          headers: {
            'pinata_api_key': this.apiKey,
            'pinata_secret_api_key': this.secretKey
          }
        }
      );

      if (response.status === 200) {
        return {
          success: true,
          message: 'Pinata authentication successful',
          data: response.data
        };
      } else {
        throw new Error('Authentication failed');
      }

    } catch (error) {
      console.error('Pinata auth test error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Authentication test failed'
      };
    }
  }

  // Get account usage
  async getUsageStats() {
    try {
      if (!this.apiKey || !this.secretKey) {
        throw new Error('Pinata API credentials not configured');
      }

      const response = await axios.get(
        'https://api.pinata.cloud/data/userPinnedDataTotal',
        {
          headers: {
            'pinata_api_key': this.apiKey,
            'pinata_secret_api_key': this.secretKey
          }
        }
      );

      if (response.status === 200) {
        return {
          success: true,
          data: {
            pinCount: response.data.pin_count,
            pinSizeTotal: response.data.pin_size_total,
            pinSizeWithReplicationsTotal: response.data.pin_size_with_replications_total
          }
        };
      } else {
        throw new Error('Failed to get usage stats');
      }

    } catch (error) {
      console.error('Get usage stats error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to get usage stats'
      };
    }
  }

  // Generate direct download URL
  generateDownloadUrl(ipfsHash, filename = null) {
    const baseUrl = `${this.gatewayUrl}/ipfs/${ipfsHash}`;
    
    if (filename) {
      return `${baseUrl}?filename=${encodeURIComponent(filename)}`;
    }
    
    return baseUrl;
  }

  // Validate file before upload
  validateFile(file, maxSize = 50 * 1024 * 1024) { // 50MB default
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { valid: false, errors };
    }

    if (file.size > maxSize) {
      errors.push(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    // Check for potentially dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const fileExt = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (dangerousExtensions.includes(fileExt)) {
      errors.push('File type not allowed for security reasons');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Helper function for easy upload
export const uploadToPinata = async (file) => {
  const pinataService = new PinataService();
  
  // Validate file first
  const validation = pinataService.validateFile(file);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join(', ')
    };
  }

  // Upload file
  const result = await pinataService.uploadFile(file);
  
  if (result.success) {
    return {
      success: true,
      fileUrl: result.data.fileUrl,
      fileHash: result.data.fileHash,
      ipfsHash: result.data.ipfsHash,
      fileName: result.data.fileName,
      originalName: result.data.originalName,
      fileSize: result.data.fileSize
    };
  } else {
    return result;
  }
};

// Create and export singleton instance
export const pinataService = new PinataService();
export default pinataService;
const validator = require('validator');
const mongoose = require('mongoose');

// XSS sanitization
const sanitizeInput = (req, res, next) => {
  try {
    // Function to recursively sanitize an object
    const sanitizeObj = (obj) => {
      if (typeof obj === 'string') {
        // Remove potential XSS patterns
        return validator.escape(obj.trim());
      } else if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObj(item));
      } else if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            sanitized[key] = sanitizeObj(obj[key]);
          }
        }
        return sanitized;
      }
      return obj;
    };

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObj(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObj(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObj(req.params);
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    return res.status(400).json({
      status: 'error',
      message: 'Invalid input data'
    });
  }
};

// MongoDB ObjectId validation
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: `${paramName} is required`
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid ${paramName} format`
      });
    }

    next();
  };
};

// Email validation middleware
const validateEmail = (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      status: 'error',
      message: 'Email is required'
    });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide a valid email address'
    });
  }

  // Normalize email
  req.body.email = validator.normalizeEmail(email);
  next();
};

// Phone number validation
const validatePhone = (req, res, next) => {
  const { phoneNumber } = req.body;
  
  if (phoneNumber) {
    // Basic phone validation (10 digits for Indian numbers)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid 10-digit phone number'
      });
    }
  }

  next();
};

// Password strength validation
const validatePassword = (req, res, next) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      status: 'error',
      message: 'Password is required'
    });
  }

  // Password should be at least 8 characters with at least one letter and one number
  if (!validator.isStrongPassword(password, {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 0,
    minNumbers: 1,
    minSymbols: 0
  })) {
    return res.status(400).json({
      status: 'error',
      message: 'Password must be at least 8 characters long and contain at least one letter and one number'
    });
  }

  next();
};

// Price validation
const validatePrice = (req, res, next) => {
  const prices = ['regularPrice', 'salePrice', 'orderAmount', 'amount'];
  
  for (const priceField of prices) {
    if (req.body[priceField] !== undefined) {
      const price = parseFloat(req.body[priceField]);
      
      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          status: 'error',
          message: `${priceField} must be a valid positive number`
        });
      }

      if (price > 10000000) { // 1 crore limit
        return res.status(400).json({
          status: 'error',
          message: `${priceField} cannot exceed ₹1,00,00,000`
        });
      }

      req.body[priceField] = price;
    }
  }

  next();
};

// File upload validation
const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];
    
    for (const file of files) {
      if (file) {
        // Check file size
        if (file.size > maxSize) {
          return res.status(400).json({
            status: 'error',
            message: `File size cannot exceed ${Math.round(maxSize / (1024 * 1024))}MB`
          });
        }

        // Check file type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({
            status: 'error',
            message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
          });
        }
      }
    }

    next();
  };
};

// Pagination validation
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({
      status: 'error',
      message: 'Page must be a positive integer'
    });
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      status: 'error',
      message: 'Limit must be between 1 and 100'
    });
  }
  
  req.query.page = pageNum;
  req.query.limit = limitNum;
  
  next();
};

module.exports = {
  sanitizeInput,
  validateObjectId,
  validateEmail,
  validatePhone,
  validatePassword,
  validatePrice,
  validateFileUpload,
  validatePagination
};

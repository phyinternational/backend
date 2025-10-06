const axios = require('axios');

// 2Factor API Configuration
const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY;
const OTP_TEMPLATE_NAME = process.env.OTP_TEMPLATE_NAME || 'OTP1';
const TWOFACTOR_BASE_URL = 'https://2factor.in/API/V1';

/**
 * Generate a random 6-digit OTP
 * @returns {string} 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Format phone number to international format if needed
 * @param {string} phoneNumber - Phone number (can be with or without country code)
 * @returns {string} Formatted phone number with country code
 */
const formatPhoneNumber = (phoneNumber) => {
  // Remove any non-numeric characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, assume India and add +91
  if (!cleaned.startsWith('+')) {
    // If it's 10 digits, it's likely Indian number without country code
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      // If it starts with 91 but no +, add it
      cleaned = '+' + cleaned;
    } else {
      // Default to adding +91
      cleaned = '+91' + cleaned;
    }
  }
  
  return cleaned;
};

/**
 * Send OTP via 2Factor SMS service
 * @param {string} phoneNumber - User's phone number
 * @param {string} otp - OTP value to send (optional, will generate if not provided)
 * @returns {Promise<{success: boolean, sessionId: string, otp: string, message: string}>}
 */
const sendOTP = async (phoneNumber, otp = null) => {
  try {
    // Validate API key
    if (!TWOFACTOR_API_KEY) {
      throw new Error('2Factor API key not configured. Please set TWOFACTOR_API_KEY in environment variables.');
    }

    // Generate OTP if not provided
    const otpValue = otp || generateOTP();
    
    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Build API URL
    const url = `${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/SMS/${formattedPhone}/${otpValue}/${OTP_TEMPLATE_NAME}`;
    
    console.log(`Sending OTP to ${formattedPhone}...`);
    
    // Call 2Factor API
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
    });
    
    if (response.data.Status === 'Success') {
      return {
        success: true,
        sessionId: response.data.Details,
        otp: otpValue, // Return OTP for development/testing
        message: 'OTP sent successfully',
        phoneNumber: formattedPhone,
      };
    } else {
      throw new Error(response.data.Details || 'Failed to send OTP');
    }
  } catch (error) {
    console.error('Error sending OTP:', error.message);
    
    // Handle specific axios errors
    if (error.response) {
      // 2Factor API returned an error
      throw new Error(error.response.data?.Details || 'Failed to send OTP via 2Factor service');
    } else if (error.request) {
      // Network error
      throw new Error('Network error while contacting 2Factor service');
    } else {
      // Other errors
      throw error;
    }
  }
};

/**
 * Verify OTP via 2Factor service
 * @param {string} phoneNumber - User's phone number
 * @param {string} otp - OTP entered by user
 * @returns {Promise<{success: boolean, message: string}>}
 */
const verifyOTP = async (phoneNumber, otp) => {
  try {
    // Validate API key
    if (!TWOFACTOR_API_KEY) {
      throw new Error('2Factor API key not configured');
    }

    // Format phone number (2Factor verify expects format like 91XXXXXXXXXX without +)
    let formattedPhone = formatPhoneNumber(phoneNumber);
    // Remove + for verification endpoint
    formattedPhone = formattedPhone.replace('+', '');
    
    // Build API URL
    const url = `${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/SMS/VERIFY3/${formattedPhone}/${otp}`;
    
    console.log(`Verifying OTP for ${formattedPhone}...`);
    
    // Call 2Factor API
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
    });
    
    if (response.data.Status === 'Success') {
      return {
        success: true,
        message: response.data.Details || 'OTP verified successfully',
      };
    } else {
      return {
        success: false,
        message: response.data.Details || 'Invalid OTP',
      };
    }
  } catch (error) {
    console.error('Error verifying OTP:', error.message);
    
    // Handle specific axios errors
    if (error.response) {
      const errorMsg = error.response.data?.Details || 'OTP verification failed';
      return {
        success: false,
        message: errorMsg,
      };
    } else if (error.request) {
      throw new Error('Network error while contacting 2Factor service');
    } else {
      throw error;
    }
  }
};

module.exports = {
  generateOTP,
  sendOTP,
  verifyOTP,
  formatPhoneNumber,
};

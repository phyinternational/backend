const express = require("express");
const router = express.Router();
const bulkUploadController = require("../controllers/bulk-upload.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const multer = require("multer");
const path = require("path");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/bulk/') // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bulk-products-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only CSV and Excel files
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Admin routes for bulk upload
router.post("/admin/products/bulk-upload", 
  requireAdminLogin, 
  upload.single('file'), 
  bulkUploadController.bulkUploadProducts
);

router.get("/admin/products/bulk-template", 
  requireAdminLogin, 
  bulkUploadController.downloadSampleTemplate
);

router.get("/admin/products/upload-history", 
  requireAdminLogin, 
  bulkUploadController.getUploadHistory
);

module.exports = router;

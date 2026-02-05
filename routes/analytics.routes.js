const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");

router.get("/admin/analytics", requireAdminLogin, analyticsController.getAnalytics_get);

module.exports = router;

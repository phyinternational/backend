const notificationController = require("../controllers/notification.controller");
const express = require("express");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const router = express.Router();

router.get("/notifications/", requireAdminLogin,notificationController.getNotifications);
router.patch("/notifications/:id",requireAdminLogin, notificationController.updateNotification);

module.exports = router;

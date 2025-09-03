const express = require("express");
const faqController = require("../controllers/FAQ.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const router = express.Router();

router.post("/admin/faq/add", requireAdminLogin, faqController.addFAQ_post);
router.delete(
  "/admin/faq/:faqId/delete",
  requireAdminLogin,
  faqController.deleteFAQ_delete
);
router.post(
  "/admin/faq/:faqId/edit",
  requireAdminLogin,
  faqController.editFAQ_delete
);
router.get("/faq/all", faqController.getAllFAQ_get);

module.exports = router;

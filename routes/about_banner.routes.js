const express = require("express");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const aboutBannerController = require("../controllers/about_banner.controller");
const upload = require("../middlewares/Multer");
const router = express.Router();

router.post(
  "/admin/about/banner/add",
  // requireAdminLogin,
  upload.fields([{ name: "image", maxCount: 5 }]),
  aboutBannerController.addBanner_post 
);
router.get("/about/banner/all", aboutBannerController.getAllBanners_get);
router.delete("/admin/about/banner/delete/:id", aboutBannerController.deleteBanner); 

module.exports = router;

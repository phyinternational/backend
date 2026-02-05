const express = require("express");
const bannerController = require("../controllers/banner.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const router = express.Router();
const upload = require("../middlewares/Multer");

// Routes for managing banners
router.post("/admin/banners", requireAdminLogin, upload.array("images"), bannerController.addBanner_post);
router.get("/banners", bannerController.getAllBanners_get);
router.get("/banners/active", bannerController.getActiveBanners_get);
router.get("/banners/:id", bannerController.getBannerById);
/* router.get("/banners/slug/:slug", bannerController.);
 */router.put("/admin/banners/:id", requireAdminLogin, upload.array("images"), bannerController.editBanner);
router.put("/admin/banners/reorder/bulk", requireAdminLogin, bannerController.reorderBanners_put);
router.delete("/admin/banners/:id", requireAdminLogin, bannerController.deleteBanner);

module.exports = router;

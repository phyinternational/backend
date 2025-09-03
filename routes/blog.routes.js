const express = require("express");
const blogController = require("../controllers/blog.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const router = express.Router();

router.post("/admin/blog/add", requireAdminLogin, blogController.addBlog_post);
router.get("/blog/all", blogController.getAllBlogs_get);
router.delete("/admin/blog/:_id/delete", blogController.deleteBlog);
router.post("/admin/blog/:_id/edit", blogController.editBlog);
router.get("/blog/:id", blogController.getBlogById);

module.exports = router;

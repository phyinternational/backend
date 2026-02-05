const express = require("express");
const blogController = require("../controllers/blog.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const router = express.Router();

router.post("/admin/blog/add", requireAdminLogin, blogController.addBlog_post);
router.get("/blog/all", blogController.getAllBlogs_get);
router.get("/blog/id/:id", blogController.getBlogById);
router.delete("/admin/blog/:_id/delete", blogController.deleteBlog);
router.patch("/admin/blog/:_id/toggle-status", blogController.toggleBlogStatus);
router.put("/admin/blog/:_id/edit", blogController.editBlog);
router.get("/blog/:slug", blogController.getBlogBySlug);

module.exports = router;
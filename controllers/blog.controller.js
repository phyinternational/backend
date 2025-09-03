const mongoose = require("mongoose");
const Blog = mongoose.model("Blog");
const {
  errorRes,
  successRes,
  internalServerError,
  shortIdChar,
} = require("../utility");
const catchAsync = require("../utility/catch-async");

module.exports.addBlog_post = catchAsync(async (req, res) => {
  const { title, content, displayImage } = req.body;

  const slug = String(title).toLowerCase().split(" ").join("-");

  const slugExists = await Blog.findOne({ slug });

  if (slugExists)
    return errorRes(res, 400, "Blog with this title already exists.");

  const blog = await Blog.create({
    title,
    slug,
    content,
    displayImage,
  });

  successRes(res, { blog, message: "Blog added successfully." });
});

module.exports.editBlog = catchAsync(async (req, res) => {
  const { _id } = req.params;
  const { title, content, displayImage } = req.body;
  const blog = await Blog.findByIdAndUpdate(
    _id,
    {
      title,
      content,
      displayImage,
    },
    { new: true }
  );
  if (!blog) return errorRes(res, 404, "Blog does not exist.");
  successRes(res, { blog, message: "Blog updated successfully." });
});

module.exports.getAllBlogs_get = (req, res) => {
  Blog.find()
    .sort("-createdAt")
    .then((blogs) => successRes(res, { blogs }))
    .catch((err) => internalServerError(res, err));
};

module.exports.deleteBlog = catchAsync(async (req, res) => {
  const { _id } = req.params;
  const blog = await Blog.findByIdAndDelete(_id);
  if (!blog) return errorRes(res, 404, "Blog does not exist.");
  successRes(res, { message: "Blog deleted successfully." });
});

module.exports.getBlogById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const blog = await Blog.findById(id);
  if (!blog) return errorRes(res, 404, "Blog does not exist.");
  successRes(res, { blog });
});

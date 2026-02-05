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
  try {
    const { title, content, displayImage } = req.body;

    const slug = String(title).toLowerCase().split(" ").join("-");

    const slugExists = await Blog.findOne({ slug });

    if (slugExists)
      return errorRes(res, 400, "Blog with this title already exists.");

    // Normalize displayImage to match schema (array of objects with url property)
    let normalizedDisplayImage = [{ url: "https://raajsi-kohl.vercel.app/images/home/img5.png" }]; // default
    
    if (displayImage) {
      if (Array.isArray(displayImage)) {
        // If it's an array, ensure each item has url property
        normalizedDisplayImage = displayImage.map(item => {
          if (typeof item === 'string') {
            return { url: item };
          } else if (item && typeof item === 'object' && item.url) {
            return { url: item.url };
          } else {
            return { url: "https://raajsi-kohl.vercel.app/images/home/img5.png" };
          }
        });
      } else if (typeof displayImage === 'string') {
        // If it's a single string, convert to array format
        normalizedDisplayImage = [{ url: displayImage }];
      }
    }

    const blog = await Blog.create({
      title,
      slug,
      content,
      displayImage: normalizedDisplayImage,
    });

    successRes(res, { blog, message: "Blog added successfully." });
  } catch (err) {
    internalServerError(res, err);
  }});

module.exports.editBlog = catchAsync(async (req, res) => {
  const { _id } = req.params;
  const { title, content, displayImage } = req.body;

  // Normalize displayImage to match schema (array of objects with url property)
  let normalizedDisplayImage = [{ url: "https://raajsi-kohl.vercel.app/images/home/img5.png" }]; // default
  
  if (displayImage) {
    if (Array.isArray(displayImage)) {
      // If it's an array, ensure each item has url property
      normalizedDisplayImage = displayImage.map(item => {
        if (typeof item === 'string') {
          return { url: item };
        } else if (item && typeof item === 'object' && item.url) {
          return { url: item.url };
        } else {
          return { url: "https://raajsi-kohl.vercel.app/images/home/img5.png" };
        }
      });
    } else if (typeof displayImage === 'string') {
      // If it's a single string, convert to array format
      normalizedDisplayImage = [{ url: displayImage }];
    }
  }

  const blog = await Blog.findByIdAndUpdate(
    _id,
    {
      title,
      content,
      displayImage: normalizedDisplayImage,
    },
    { new: true }
  );
  if (!blog) return errorRes(res, 404, "Blog does not exist.");
  successRes(res, { blog, message: "Blog updated successfully." });
});

module.exports.getAllBlogs_get = catchAsync(async (req, res) => {
  const { admin } = req.query;
  const filter = admin === "true" ? {} : { isActive: { $ne: false } };
  
  const blogs = await Blog.find(filter).sort("-createdAt");
  successRes(res, { blogs });
});

module.exports.deleteBlog = catchAsync(async (req, res) => {
  const { _id } = req.params;
  const blog = await Blog.findByIdAndDelete(_id);
  if (!blog) return errorRes(res, 404, "Blog does not exist.");
  successRes(res, { message: "Blog deleted successfully." });
});

module.exports.toggleBlogStatus = catchAsync(async (req, res) => {
  const { _id } = req.params;
  const blog = await Blog.findById(_id);
  if (!blog) return errorRes(res, 404, "Blog does not exist.");
  
  blog.isActive = !blog.isActive;
  await blog.save();
  
  successRes(res, { 
    blog, 
    message: `Blog ${blog.isActive ? 'activated' : 'deactivated'} successfully.` 
  });
});

module.exports.getBlogBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const blog = await Blog.findOne({ slug });
  if (!blog) return errorRes(res, 404, "Blog not found.");
  successRes(res, { blog });
});

module.exports.getBlogById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const blog = await Blog.findById(id);
  if (!blog) return errorRes(res, 404, "Blog not found.");
  successRes(res, { blog });
});
const Banner = require("../models/banner.model");
const { errorRes, successRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");
const cloudinary = require("cloudinary").v2;

module.exports.addBanner_post = catchAsync(async (req, res) => {
  const { bannerImages, title, content, meaning, isActive, position } = req.body;

  let imageUrls = Array.isArray(bannerImages) ? bannerImages : [];
  
  // Handle new file uploads
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const data = await cloudinary.uploader.upload(file.path);
      if (data && data.secure_url) {
        imageUrls.push(data.secure_url);
      }
    }
  }

  const banner = await Banner.create({
    bannerImages: imageUrls,
    title,
    content,
    meaning,
    isActive: isActive === undefined ? true : (isActive === 'true' || isActive === true),
    position: position || 0,
  });

  successRes(res, { banner, message: "Banner added successfully." });
});

module.exports.editBanner = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { bannerImages, title, content, meaning, isActive, position } = req.body;

  let imageUrls = Array.isArray(bannerImages) ? bannerImages : [];
  
  // If bannerImages comes as a single string (FormData case), normalize it
  if (typeof bannerImages === 'string') {
    imageUrls = [bannerImages];
  }

  // Handle new file uploads
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const data = await cloudinary.uploader.upload(file.path);
      if (data && data.secure_url) {
        imageUrls.push(data.secure_url);
      }
    }
  }

  const banner = await Banner.findByIdAndUpdate(
    id,
    {
      bannerImages: imageUrls,
      title,
      content,
      meaning,
      isActive: isActive === undefined ? undefined : (isActive === 'true' || isActive === true),
      position: position === undefined ? undefined : position,
    },
    { new: true }
  );

  if (!banner) return errorRes(res, 404, "Banner does not exist.");

  successRes(res, { banner, message: "Banner updated successfully." });
});

module.exports.getAllBanners_get = (req, res) => {
  Banner.find()
    .sort("position -createdAt")
    .then((banners) => successRes(res, { banners }))
    .catch((err) => internalServerError(res, err));
};

module.exports.getActiveBanners_get = (req, res) => {
  Banner.find({ isActive: true })
    .sort("position -createdAt")
    .then((banners) => successRes(res, { banners }))
    .catch((err) => internalServerError(res, err));
};

module.exports.deleteBanner = catchAsync(async (req, res) => {
  const { id } = req.params;

  const banner = await Banner.findByIdAndDelete(id);

  if (!banner) return errorRes(res, 404, "Banner does not exist.");

  successRes(res, { message: "Banner deleted successfully." });
});

module.exports.reorderBanners_put = catchAsync(async (req, res) => {
  const { orders } = req.body; // Array of { id, position }

  if (!orders || !Array.isArray(orders)) {
    return errorRes(res, 400, "Orders array is required.");
  }

  const updatePromises = orders.map((order) =>
    Banner.findByIdAndUpdate(order.id, { position: order.position })
  );

  await Promise.all(updatePromises);

  successRes(res, { message: "Banners reordered successfully." });
});

module.exports.getBannerById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const banner = await Banner.findById(id);

  if (!banner) return errorRes(res, 404, "Banner does not exist.");

  successRes(res, { banner });
});

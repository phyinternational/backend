const Banner = require("../models/banner.model");
const { errorRes, successRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");

module.exports.addBanner_post = catchAsync(async (req, res) => {
  const { bannerImages, title, content } = req.body;

  const banner = await Banner.create({
    bannerImages,
    title,
    content,
  });

  successRes(res, { banner, message: "Banner added successfully." });
});

module.exports.editBanner = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { bannerImages, title, content } = req.body;

  const banner = await Banner.findByIdAndUpdate(
    id,
    {
      bannerImages,
      title,
      content,
    },
    { new: true }
  );

  if (!banner) return errorRes(res, 404, "Banner does not exist.");

  successRes(res, { banner, message: "Banner updated successfully." });
});

module.exports.getAllBanners_get = (req, res) => {
  Banner.find()
    .sort("-createdAt")
    .then((banners) => successRes(res, { banners }))
    .catch((err) => internalServerError(res, err));
};

module.exports.deleteBanner = catchAsync(async (req, res) => {
  const { id } = req.params;

  const banner = await Banner.findByIdAndDelete(id);

  if (!banner) return errorRes(res, 404, "Banner does not exist.");

  successRes(res, { message: "Banner deleted successfully." });
});

module.exports.getBannerById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const banner = await Banner.findById(id);

  if (!banner) return errorRes(res, 404, "Banner does not exist.");

  successRes(res, { banner });
});

const mongoose = require("mongoose");
const Site_Trending_Product = mongoose.model("Site_Trending_Product");
const { errorRes, internalServerError, successRes } = require("../utility");
const {uploadOnCloudinary} = require("../middlewares/Cloudinary");

module.exports.addTrendingProduct_post = async (req, res) => {
  const { prevImages } = req.body;
  let prevImagesParsed = JSON.parse(prevImages);
  const result = [];

  if (!prevImages || prevImages?.length == 0)
    return errorRes(res, 400, "Banner list empty.");

  try {
    await Site_Trending_Product.deleteMany({});
    console.log(req.files.image);
    if (req?.files?.image?.length) {
      await Promise.all(
        req?.files?.image?.map(async (item, index) => {
          const imageurl1 = await uploadOnCloudinary(req.files.image[index]);
          const productImage = new Site_Trending_Product({
            productImage: { url: imageurl1 },
          });
          console.log(productImage, "<<<thisisprevimage");

          await productImage
            .save()
            .then((productImage) => result.push(productImage));
        })
      );
    }
    if (prevImagesParsed.length > 0) {
      await Promise.all(
        prevImagesParsed?.map(async (item) => {
          // const imageurl1 = await uploadOnCloudinary(req.files.image[index]);
          const productImage = new Site_Trending_Product({
            productImage: { url: item },
          });
          console.log(productImage, "<<<thisisprevimage");
          await productImage
            .save()
            .then((productImage) => result.push(productImage));
        })
      );
    }

    console.log(prevImagesParsed, "<<<thisisprevImages");

    // await Promise.all(
    //   productImages.map(async item => {
    //     const productImage = new Site_Trending_Product(item);
    //     await productImage
    //       .save()
    //       .then(productImage => result.push(productImage));
    //   })
    // );

    if (result.length == 0)
      return successRes(res, {
        site_trending_product: result,
        message: "Trending products saved successfully.",
      });
    else
      return successRes(res, {
        site_trending_product: result,
        message: "Trending products saved successfully.",
      });
  } catch (error) {
    internalServerError(res, error);
  }
};

module.exports.getAllTrendingProduct_get = (req, res) => {
  Site_Trending_Product.find()
    .then((site_trending_products) =>
      successRes(res, { site_trending_products })
    )
    .catch((err) => internalServerError(res, err));
};

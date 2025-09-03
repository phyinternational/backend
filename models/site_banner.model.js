const mongoose = require("mongoose");

const siteBannerSchema = new mongoose.Schema(
  {
    bannerImage: {
      url: {
        type: String,
        default:
          "https://res.cloudinary.com/piyush27/image/upload/v1677079091/WhatsApp_Image_2023-02-22_at_8.47.17_PM_agawba.jpg",
      },
    },
    title: {
      type: String,
    },
    content: {
      type: String,
    },
  },
  { timestamps: true }
);

mongoose.model("Site_Banner", siteBannerSchema);

const mongoose = require("mongoose");

const siteTrendingPoductSchema = new mongoose.Schema({
  productImage: {
    url: {
      type: String,
      default:
        "https://res.cloudinary.com/piyush27/image/upload/v1677079091/WhatsApp_Image_2023-02-22_at_8.47.17_PM_agawba.jpg",
    },
  },
},{timestamps:true});

mongoose.model("Site_Trending_Product", siteTrendingPoductSchema);

const silverPriceService = require("../services/silver-price.service");
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");

// Get current silver price (public route - uses saved data only)
module.exports.getCurrentSilverPrice = catchAsync(async (req, res) => {
  try {
    const SilverPrice = require("../models/silver-price.model");
    
    // Get the most recent active silver price from database only
    const silverPrice = await SilverPrice.findOne({ isActive: true })
      .sort({ lastUpdated: -1 });
    
    if (!silverPrice) {
      return errorRes(res, 404, "No silver price data available. Please contact admin.");
    }
    
    successRes(res, {
      silverPrice,
      message: "Current silver price retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting silver price:", error);
    internalServerError(res, "Error retrieving silver price");
  }
});

// Calculate dynamic price for a product (public route - uses saved price data only)
module.exports.calculateProductPrice = catchAsync(async (req, res) => {
  try {
    const { silverWeight, laborPercentage, gst } = req.body;

    if (!silverWeight || silverWeight <= 0) {
      return errorRes(res, 400, "Valid silver weight is required");
    }

    const SilverPrice = require("../models/silver-price.model");
    
    // Get current silver price from database only (no API call)
    const silverPrice = await SilverPrice.findOne({ isActive: true })
      .sort({ lastUpdated: -1 });
    
    if (!silverPrice) {
      return errorRes(res, 404, "No silver price data available. Please contact admin.");
    }

    // Calculate pricing manually using saved silver price
    const silverCost = silverWeight * silverPrice.pricePerGram;
    const laborCost = (laborPercentage || 0) / 100 * silverCost;
    const subtotal = silverCost + laborCost;
    const gstAmount = (gst || 18) / 100 * subtotal;
    const finalPrice = subtotal + gstAmount;

    const priceCalculation = {
      breakdown: {
        silverWeight: silverWeight,
        silverPricePerGram: silverPrice.pricePerGram,
        silverCost: Math.round(silverCost * 100) / 100,
        laborPercentage: laborPercentage || 0,
        laborCost: Math.round(laborCost * 100) / 100,
        subtotal: Math.round(subtotal * 100) / 100,
        gstPercentage: gst || 18,
        gstAmount: Math.round(gstAmount * 100) / 100,
        finalPrice: Math.round(finalPrice * 100) / 100
      },
      finalPrice: Math.round(finalPrice * 100) / 100,
      lastUpdated: silverPrice.lastUpdated
    };

    successRes(res, {
      priceCalculation,
      message: "Price calculated successfully"
    });
  } catch (error) {
    console.error("Error calculating price:", error);
    internalServerError(res, "Error calculating product price");
  }
});

// Admin: Force update silver price
module.exports.forceUpdateSilverPrice = catchAsync(async (req, res) => {
  try {
    const newPriceData = await silverPriceService.fetchCurrentSilverPrice();
    const savedPrice = await silverPriceService.saveSilverPrice(newPriceData);
    
    successRes(res, {
      silverPrice: savedPrice,
      message: "Silver price updated successfully"
    });
  } catch (error) {
    console.error("Error force updating silver price:", error);
    internalServerError(res, "Error updating silver price");
  }
});

// Get silver price history
module.exports.getSilverPriceHistory = catchAsync(async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const SilverPrice = require("../models/silver-price.model");
    
    const history = await SilverPrice.find()
      .sort({ lastUpdated: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await SilverPrice.countDocuments();

    successRes(res, {
      history,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      message: "Silver price history retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting price history:", error);
    internalServerError(res, "Error retrieving price history");
  }
});

// Admin: Update labor percentage settings
module.exports.updateLaborSettings = catchAsync(async (req, res) => {
  try {
    const { defaultLaborPercentage, categoryLaborRates } = req.body;

    // You might want to store these in a settings model
    const Constant = require("../models/constant.model");
    
    const updates = [];
    
    if (defaultLaborPercentage !== undefined) {
      updates.push({
        name: "defaultLaborPercentage",
        value: defaultLaborPercentage
      });
    }

    if (categoryLaborRates) {
      updates.push({
        name: "categoryLaborRates",
        value: JSON.stringify(categoryLaborRates)
      });
    }

    for (const update of updates) {
      await Constant.findOneAndUpdate(
        { name: update.name },
        { value: update.value },
        { new: true, upsert: true }
      );
    }

    successRes(res, {
      message: "Labor settings updated successfully",
      updates
    });
  } catch (error) {
    console.error("Error updating labor settings:", error);
    internalServerError(res, "Error updating labor settings");
  }
});

// Get labor settings
module.exports.getLaborSettings = catchAsync(async (req, res) => {
  try {
    const Constant = require("../models/constant.model");
    
    const settings = await Constant.find({
      name: { $in: ["defaultLaborPercentage", "categoryLaborRates"] }
    });

    const laborSettings = {};
    settings.forEach(setting => {
      if (setting.name === "categoryLaborRates") {
        laborSettings[setting.name] = JSON.parse(setting.value || "{}");
      } else {
        laborSettings[setting.name] = setting.value;
      }
    });

    successRes(res, {
      laborSettings,
      message: "Labor settings retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting labor settings:", error);
    internalServerError(res, "Error retrieving labor settings");
  }
});

const UserLoyalty = require("../models/user-loyalty.model");
const LoyaltyProgram = require("../models/loyalty-program.model");
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");

// Get user's loyalty details
module.exports.getUserLoyalty = catchAsync(async (req, res) => {
  try {
    let userLoyalty = await UserLoyalty.findOne({ user: req.user._id });
    
    if (!userLoyalty) {
      // Create new loyalty record for user
      userLoyalty = new UserLoyalty({
        user: req.user._id,
        totalPoints: 0,
        availablePoints: 0
      });
      await userLoyalty.save();
    }

    // Update tier before sending response
    await userLoyalty.updateTier();

    successRes(res, {
      loyalty: userLoyalty,
      message: "User loyalty data retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting user loyalty:", error);
    internalServerError(res, "Error retrieving loyalty data");
  }
});

// Get loyalty program details (public)
module.exports.getLoyaltyProgram = catchAsync(async (req, res) => {
  try {
    const program = await LoyaltyProgram.findOne({ isActive: true });
    
    if (!program) {
      return errorRes(res, 404, "No active loyalty program found");
    }

    successRes(res, {
      program,
      message: "Loyalty program details retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting loyalty program:", error);
    internalServerError(res, "Error retrieving loyalty program");
  }
});

// Calculate points for order amount
module.exports.calculatePoints = catchAsync(async (req, res) => {
  try {
    const { orderAmount } = req.body;
    
    if (!orderAmount || orderAmount <= 0) {
      return errorRes(res, 400, "Valid order amount is required");
    }

    const program = await LoyaltyProgram.findOne({ isActive: true });
    
    if (!program) {
      return errorRes(res, 404, "No active loyalty program found");
    }

    const pointsEarned = Math.floor(orderAmount * program.pointsPerRupee);
    const pointsValue = Math.floor(pointsEarned / program.redemptionRules.pointsToRupeeRatio);

    successRes(res, {
      calculation: {
        orderAmount,
        pointsEarned,
        pointsValue,
        pointsPerRupee: program.pointsPerRupee
      },
      message: "Points calculated successfully"
    });
  } catch (error) {
    console.error("Error calculating points:", error);
    internalServerError(res, "Error calculating points");
  }
});

// Redeem points for discount
module.exports.redeemPoints = catchAsync(async (req, res) => {
  try {
    const { pointsToRedeem, orderAmount } = req.body;
    
    if (!pointsToRedeem || pointsToRedeem <= 0) {
      return errorRes(res, 400, "Valid points amount is required");
    }

    if (!orderAmount || orderAmount <= 0) {
      return errorRes(res, 400, "Valid order amount is required");
    }

    const userLoyalty = await UserLoyalty.findOne({ user: req.user._id });
    
    if (!userLoyalty) {
      return errorRes(res, 404, "User loyalty record not found");
    }

    const program = await LoyaltyProgram.findOne({ isActive: true });
    
    if (!program) {
      return errorRes(res, 404, "No active loyalty program found");
    }

    // Validation checks
    if (pointsToRedeem < program.redemptionRules.minPointsToRedeem) {
      return errorRes(res, 400, `Minimum ${program.redemptionRules.minPointsToRedeem} points required for redemption`);
    }

    if (userLoyalty.availablePoints < pointsToRedeem) {
      return errorRes(res, 400, "Insufficient loyalty points");
    }

    const discountAmount = Math.floor(pointsToRedeem / program.redemptionRules.pointsToRupeeRatio);
    const maxDiscountAllowed = Math.floor((orderAmount * program.redemptionRules.maxRedemptionPercentage) / 100);

    if (discountAmount > maxDiscountAllowed) {
      return errorRes(res, 400, `Maximum discount allowed is ₹${maxDiscountAllowed} (${program.redemptionRules.maxRedemptionPercentage}% of order value)`);
    }

    successRes(res, {
      redemption: {
        pointsToRedeem,
        discountAmount,
        remainingPoints: userLoyalty.availablePoints - pointsToRedeem,
        maxDiscountAllowed
      },
      message: "Points redemption calculated successfully"
    });
  } catch (error) {
    console.error("Error redeeming points:", error);
    internalServerError(res, "Error processing point redemption");
  }
});

// Get user's points history
module.exports.getPointsHistory = catchAsync(async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const userLoyalty = await UserLoyalty.findOne({ user: req.user._id })
      .populate("pointsHistory.orderId", "createdAt order_price")
      .populate("pointsHistory.guestOrderId", "createdAt orderTotal");

    if (!userLoyalty) {
      return errorRes(res, 404, "User loyalty record not found");
    }

    // Sort history by date (newest first) and paginate
    const sortedHistory = userLoyalty.pointsHistory
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + parseInt(limit));

    const totalRecords = userLoyalty.pointsHistory.length;

    successRes(res, {
      history: sortedHistory,
      pagination: {
        total: totalRecords,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalRecords / limit)
      },
      summary: userLoyalty.statistics,
      message: "Points history retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting points history:", error);
    internalServerError(res, "Error retrieving points history");
  }
});

// Admin: Update loyalty program
module.exports.updateLoyaltyProgram = catchAsync(async (req, res) => {
  try {
    const updateData = req.body;
    
    const program = await LoyaltyProgram.findOneAndUpdate(
      { isActive: true },
      updateData,
      { new: true, upsert: true }
    );

    successRes(res, {
      program,
      message: "Loyalty program updated successfully"
    });
  } catch (error) {
    console.error("Error updating loyalty program:", error);
    internalServerError(res, "Error updating loyalty program");
  }
});

// Admin: Get all users' loyalty stats
module.exports.getAllUsersLoyalty = catchAsync(async (req, res) => {
  try {
    const { page = 1, limit = 50, sortBy = "totalPoints", sortOrder = "desc" } = req.query;
    const skip = (page - 1) * limit;
    
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const loyaltyData = await UserLoyalty.find()
      .populate("user", "name email phoneNumber")
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await UserLoyalty.countDocuments();

    // Calculate overall stats
    const overallStats = await UserLoyalty.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalPointsIssued: { $sum: "$statistics.totalEarned" },
          totalPointsRedeemed: { $sum: "$statistics.totalRedeemed" },
          totalLifetimeSpent: { $sum: "$lifetimeSpent" },
          averageOrderValue: { $avg: "$statistics.averageOrderValue" }
        }
      }
    ]);

    successRes(res, {
      loyaltyData,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      overallStats: overallStats[0] || {},
      message: "All users loyalty data retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting all users loyalty:", error);
    internalServerError(res, "Error retrieving loyalty data");
  }
});

// Service function to award points for order (used internally)
module.exports.awardPointsForOrder = async (userId, orderAmount, orderId, guestOrderId = null) => {
  try {
    const program = await LoyaltyProgram.findOne({ isActive: true });
    if (!program) return false;

    let userLoyalty = await UserLoyalty.findOne({ user: userId });
    
    if (!userLoyalty) {
      userLoyalty = new UserLoyalty({
        user: userId,
        totalPoints: 0,
        availablePoints: 0
      });
    }

    const pointsEarned = Math.floor(orderAmount * program.pointsPerRupee);
    
    if (pointsEarned > 0) {
      await userLoyalty.addPoints(
        pointsEarned, 
        "EARNED", 
        `Points earned from order #${orderId || guestOrderId}`, 
        orderId,
        guestOrderId
      );

      // Update statistics
      userLoyalty.lifetimeSpent += orderAmount;
      userLoyalty.statistics.orderCount += 1;
      userLoyalty.statistics.averageOrderValue = userLoyalty.lifetimeSpent / userLoyalty.statistics.orderCount;
      
      await userLoyalty.updateTier();
      await userLoyalty.save();

      return {
        success: true,
        pointsEarned,
        totalPoints: userLoyalty.totalPoints,
        currentTier: userLoyalty.currentTier.name
      };
    }

    return { success: false, message: "No points earned" };
  } catch (error) {
    console.error("Error awarding points:", error);
    return { success: false, error: error.message };
  }
};

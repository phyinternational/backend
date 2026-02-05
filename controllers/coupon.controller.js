const mongoose = require("mongoose");
const { errorRes, successRes, internalServerError } = require("../utility");
const Coupon = require("../models/coupon.model");
const User = mongoose.model("User");
const catchAsync = require("../utility/catch-async");

// Create a new coupon
module.exports.addCoupon_post = catchAsync(async (req, res) => {
  const { couponCode } = req.body;
  
  // Check if coupon already exists (case-insensitive)
  const couponExist = await Coupon.findOne({ 
    couponCode: couponCode.toUpperCase().trim() 
  });
  if (couponExist) {
    return errorRes(res, 400, "Coupon code already exists.");
  }

  // Add admin ID who created the coupon
  const couponData = {
    ...req.body,
    createdBy: req.admin._id, // Assuming admin is authenticated
  };

  const coupon = await Coupon.create(couponData);
  if (!coupon) {
    return errorRes(res, 400, "Failed to create coupon.");
  }

  // Return coupon without sensitive data
  const { createdBy, ...couponResponse } = coupon.toObject();
  
  successRes(res, { 
    coupon: couponResponse, 
    message: "Coupon created successfully." 
  });
});

// Delete a coupon
module.exports.deleteCoupon_delete = catchAsync(async (req, res) => {
  const { _id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return errorRes(res, 400, "Invalid coupon ID.");
  }

  const deletedCoupon = await Coupon.findByIdAndDelete(_id);
  if (!deletedCoupon) {
    return errorRes(res, 404, "Coupon not found.");
  }

  successRes(res, {
    message: "Coupon deleted successfully.",
    deletedCoupon: { _id: deletedCoupon._id, couponCode: deletedCoupon.couponCode }
  });
});

// Update coupon
module.exports.editCoupons_post = catchAsync(async (req, res) => {
  const { _id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return errorRes(res, 400, "Invalid coupon ID.");
  }

  // Prevent updating certain fields after creation
  const { createdBy, usedQuantity, ...updateData } = req.body;
  
  // If updating coupon code, check for duplicates
  if (updateData.couponCode) {
    const existingCoupon = await Coupon.findOne({
      couponCode: updateData.couponCode.toUpperCase().trim(),
      _id: { $ne: _id }
    });
    if (existingCoupon) {
      return errorRes(res, 400, "Coupon code already exists.");
    }
  }

  const updatedCoupon = await Coupon.findByIdAndUpdate(_id, updateData, {
    new: true,
    runValidators: true,
  });
  
  if (!updatedCoupon) {
    return errorRes(res, 404, "Coupon not found.");
  }

  successRes(res, {
    updatedCoupon,
    message: "Coupon updated successfully.",
  });
});

// Get all coupons with filtering and pagination
module.exports.getAllCoupons_get = catchAsync(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    isActive, 
    couponType, 
    expired,
    search 
  } = req.query;
  
  const filter = {};
  
  // Build filter object
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (couponType) filter.couponType = couponType;
  if (search) {
    filter.couponCode = { $regex: search, $options: 'i' };
  }
  
  // Handle expired filter
  if (expired !== undefined) {
    const now = new Date();
    if (expired === 'true') {
      filter.expiryDate = { $lt: now };
    } else {
      filter.expiryDate = { $gte: now };
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email'),
    Coupon.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  successRes(res, {
    coupons,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalCoupons: total,
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1
    }
  });
});

// Get coupon by code (fixed the bug)
module.exports.getParticularCoupon_get = catchAsync(async (req, res) => {
  const { code } = req.params;
  
  const coupon = await Coupon.findOne({ 
    couponCode: { $regex: new RegExp(`^${code}$`, "i") } // Fixed: use couponCode, not code
  });
  
  if (!coupon) {
    return errorRes(res, 404, "Coupon not found.");
  }
  
  // Check if coupon is valid
  const isValid = coupon.isValidCoupon();
  const response = {
    ...coupon.toObject(),
    isValid,
    remainingQuantity: coupon.remainingQuantity,
    usagePercentage: coupon.usagePercentage
  };
  
  successRes(res, { coupon: response });
});

// Get coupon by ID
module.exports.getSingleById_get = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorRes(res, 400, "Invalid coupon ID.");
  }
  
  const coupon = await Coupon.findById(id).populate('createdBy', 'name email');
  
  if (!coupon) {
    return errorRes(res, 404, "Coupon not found.");
  }
  
  const response = {
    ...coupon.toObject(),
    remainingQuantity: coupon.remainingQuantity,
    usagePercentage: coupon.usagePercentage
  };
  
  successRes(res, { coupon: response });
});

// Apply/Validate coupon for a user with category validation
module.exports.applyCoupon_post = catchAsync(async (req, res) => {
  const { couponCode, cartAmount, cartItems = [] } = req.body;
  const userId = req.user?._id || req.body.userId;
  
  const coupon = await Coupon.findOne({ 
    couponCode: couponCode.toUpperCase().trim() 
  }).populate('applicableCategories excludeCategories');
  
  if (!coupon) {
    return errorRes(res, 404, "Invalid coupon code.");
  }
  
  // Check basic validity
  if (!coupon.isValidCoupon(cartAmount)) {
    let message = "Coupon is not valid.";
    if (!coupon.isActive) message = "Coupon is currently inactive.";
    else if (coupon.expiryDate <= new Date()) message = "Coupon has expired.";
    else if (coupon.usedQuantity >= coupon.couponQuantity) message = "Coupon usage limit reached.";
    else if (cartAmount < coupon.minCartAmount) {
      message = `Minimum cart amount of ₹${coupon.minCartAmount} required.`;
    }
    
    return errorRes(res, 400, message);
  }
  
  // Category validation if categories are specified
  if (cartItems.length > 0 && (coupon.applicableCategories.length > 0 || coupon.excludeCategories.length > 0)) {
    const cartCategoryIds = cartItems.map(item => item.categoryId).filter(Boolean);
    
    // Check if cart has applicable categories
    if (coupon.applicableCategories.length > 0) {
      const hasApplicableCategory = cartCategoryIds.some(catId => 
        coupon.applicableCategories.some(appCat => appCat._id.toString() === catId.toString())
      );
      if (!hasApplicableCategory) {
        return errorRes(res, 400, "This coupon is not applicable to items in your cart.");
      }
    }
    
    // Check if cart has excluded categories
    if (coupon.excludeCategories.length > 0) {
      const hasExcludedCategory = cartCategoryIds.some(catId => 
        coupon.excludeCategories.some(excCat => excCat._id.toString() === catId.toString())
      );
      if (hasExcludedCategory) {
        return errorRes(res, 400, "This coupon cannot be applied to some items in your cart.");
      }
    }
  }
  
  // Check user-specific usage limit
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      const userCouponUsage = user.coupon_applied?.filter(
        applied => applied.couponId?.toString() === coupon._id.toString()
      ).length || 0;
      
      if (userCouponUsage >= coupon.usagePerUser) {
        return errorRes(res, 400, "You have reached the usage limit for this coupon.");
      }
    }
  }
  
  // Calculate discount
  const discountAmount = coupon.calculateDiscount(cartAmount);
  const finalAmount = cartAmount - discountAmount;
  // Perform an atomic increment to avoid race conditions where multiple
  // requests could over-consume the coupon quota. We increment usedQuantity
  // only if usedQuantity < couponQuantity.
  let updatedCoupon;
  try {
    updatedCoupon = await Coupon.findOneAndUpdate(
      { _id: coupon._id, usedQuantity: { $lt: coupon.couponQuantity } },
      { $inc: { usedQuantity: 1 } },
      { new: true }
    );

    if (!updatedCoupon) {
      // Another request may have consumed the last available slot.
      return errorRes(res, 400, 'Coupon usage limit reached.');
    }
  } catch (err) {
    console.error('Failed to atomically increment coupon usage:', err);
    return internalServerError(res, err);
  }

  // Record user's coupon application. If this fails, attempt to roll back the
  // coupon increment to keep counts consistent.
  if (userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        $push: { coupon_applied: { couponId: coupon._id, usedAt: new Date() } },
      });
    } catch (userErr) {
      console.error('Failed to record coupon on user, attempting rollback:', userErr);
      try {
        await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedQuantity: -1 } });
      } catch (rollbackErr) {
        console.error('Failed to roll back coupon increment after user update failure:', rollbackErr);
      }
      return errorRes(res, 500, 'Failed to record coupon application for user. Please try again.');
    }
  }

  // Use the updated coupon counts in the response
  const remainingQuantity = (updatedCoupon.couponQuantity || 0) - (updatedCoupon.usedQuantity || 0);
  const usagePercentage = updatedCoupon.couponQuantity
    ? Math.round(((updatedCoupon.usedQuantity || 0) / updatedCoupon.couponQuantity) * 100)
    : 0;

  successRes(res, {
    valid: true,
    coupon: {
      _id: updatedCoupon._id,
      couponCode: updatedCoupon.couponCode,
      couponType: updatedCoupon.couponType,
      couponAmount: updatedCoupon.couponAmount,
      description: updatedCoupon.description,
      maxDiscountAmount: updatedCoupon.maxDiscountAmount,
      remainingQuantity,
      usagePercentage,
    },
    discountAmount,
    originalAmount: cartAmount,
    finalAmount,
    savings: discountAmount,
    message: `Coupon applied successfully! You saved ₹${discountAmount}.`,
  });
});

// Bulk operations
module.exports.bulkUpdateCoupons_post = catchAsync(async (req, res) => {
  const { couponIds, updateData } = req.body;
  
  if (!Array.isArray(couponIds) || couponIds.length === 0) {
    return errorRes(res, 400, "Coupon IDs array is required.");
  }
  
  // Validate all IDs
  const invalidIds = couponIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    return errorRes(res, 400, `Invalid coupon IDs: ${invalidIds.join(', ')}`);
  }
  
  const result = await Coupon.updateMany(
    { _id: { $in: couponIds } },
    updateData,
    { runValidators: true }
  );
  
  successRes(res, {
    message: `${result.modifiedCount} coupons updated successfully.`,
    updated: result.modifiedCount,
    matched: result.matchedCount
  });
});

// Get coupon analytics
module.exports.getCouponAnalytics_get = catchAsync(async (req, res) => {
  const analytics = await Coupon.aggregate([
    {
      $group: {
        _id: null,
        totalCoupons: { $sum: 1 },
        activeCoupons: { $sum: { $cond: ['$isActive', 1, 0] } },
        expiredCoupons: { $sum: { $cond: [{ $lt: ['$expiryDate', new Date()] }, 1, 0] } },
        totalUsage: { $sum: '$usedQuantity' },
        totalAvailable: { $sum: '$couponQuantity' },
        avgDiscountAmount: { $avg: '$couponAmount' }
      }
    }
  ]);
  
  const typeAnalytics = await Coupon.aggregate([
    {
      $group: {
        _id: '$couponType',
        count: { $sum: 1 },
        totalUsage: { $sum: '$usedQuantity' }
      }
    }
  ]);
  
  successRes(res, {
    analytics: analytics[0] || {},
    typeAnalytics
  });
});

// ========== USER-FACING CONTROLLERS ==========

// Get available coupons for a user based on their cart
module.exports.getAvailableCoupons_get = catchAsync(async (req, res) => {
  const { cartAmount = 0, categoryIds = [] } = req.query;
  const userId = req.user?._id;
  
  const now = new Date();
  let filter = {
    isActive: true,
    expiryDate: { $gt: now },
    $expr: { $lt: ['$usedQuantity', '$couponQuantity'] },
    minCartAmount: { $lte: parseFloat(cartAmount) || 0 }
  };
  
  // Category filtering
  const categoryArray = Array.isArray(categoryIds) ? categoryIds : categoryIds.split(',').filter(Boolean);
  if (categoryArray.length > 0) {
    filter.$or = [
      { applicableCategories: { $size: 0 } }, // Applicable to all
      { applicableCategories: { $in: categoryArray } }
    ];
    filter.excludeCategories = { $nin: categoryArray };
  }
  
  const availableCoupons = await Coupon.find(filter)
    .select('couponCode couponAmount couponType minCartAmount maxDiscountAmount description expiryDate usagePerUser')
    .sort({ couponAmount: -1 })
    .limit(20);
    
  // Filter out coupons user has already used maximum times
  let userFilteredCoupons = availableCoupons;
  if (userId) {
    const user = await User.findById(userId);
    if (user && user.coupon_applied) {
      userFilteredCoupons = availableCoupons.filter(coupon => {
        const userUsage = user.coupon_applied.filter(
          applied => applied.couponId?.toString() === coupon._id.toString()
        ).length;
        return userUsage < coupon.usagePerUser;
      });
    }
  }
  
  // Add calculated discount for each coupon
  const couponsWithDiscount = userFilteredCoupons.map(coupon => {
    const discount = coupon.calculateDiscount(parseFloat(cartAmount) || 0);
    return {
      ...coupon.toObject(),
      estimatedDiscount: discount,
      estimatedSavings: discount
    };
  });
  
  successRes(res, { 
    coupons: couponsWithDiscount,
    message: `Found ${couponsWithDiscount.length} available coupons.`
  });
});

// Get user's coupon usage history
module.exports.getUserCouponHistory_get = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10 } = req.query;
  
  const user = await User.findById(userId).populate({
    path: 'coupon_applied.couponId',
    select: 'couponCode couponType couponAmount description'
  });
  
  if (!user || !user.coupon_applied) {
    return successRes(res, { history: [], pagination: {} });
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = user.coupon_applied.length;
  const history = user.coupon_applied
    .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
    .slice(skip, skip + parseInt(limit));
  
  successRes(res, {
    history,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalRecords: total
    }
  });
});

// Check if a specific coupon is valid for user's cart
module.exports.validateCouponForCart_post = catchAsync(async (req, res) => {
  const { couponCode, cartAmount, cartItems = [] } = req.body;
  const userId = req.user?._id;
  
  const coupon = await Coupon.findOne({ 
    couponCode: couponCode.toUpperCase().trim() 
  }).populate('applicableCategories excludeCategories');
  
  if (!coupon) {
    return errorRes(res, 404, "Coupon not found.");
  }
  
  // Run all validations
  const validationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  if (!coupon.isActive) {
    validationResult.isValid = false;
    validationResult.errors.push("Coupon is currently inactive.");
  }
  
  if (coupon.expiryDate <= new Date()) {
    validationResult.isValid = false;
    validationResult.errors.push("Coupon has expired.");
  }
  
  if (coupon.usedQuantity >= coupon.couponQuantity) {
    validationResult.isValid = false;
    validationResult.errors.push("Coupon usage limit reached.");
  }
  
  if (cartAmount < coupon.minCartAmount) {
    validationResult.isValid = false;
    validationResult.errors.push(`Minimum cart amount of ₹${coupon.minCartAmount} required.`);
  }
  
  // Category validation
  if (cartItems.length > 0 && (coupon.applicableCategories.length > 0 || coupon.excludeCategories.length > 0)) {
    const cartCategoryIds = cartItems.map(item => item.categoryId).filter(Boolean);
    
    if (coupon.applicableCategories.length > 0) {
      const hasApplicableCategory = cartCategoryIds.some(catId => 
        coupon.applicableCategories.some(appCat => appCat._id.toString() === catId.toString())
      );
      if (!hasApplicableCategory) {
        validationResult.isValid = false;
        validationResult.errors.push("This coupon is not applicable to items in your cart.");
      }
    }
    
    if (coupon.excludeCategories.length > 0) {
      const hasExcludedCategory = cartCategoryIds.some(catId => 
        coupon.excludeCategories.some(excCat => excCat._id.toString() === catId.toString())
      );
      if (hasExcludedCategory) {
        validationResult.isValid = false;
        validationResult.errors.push("This coupon cannot be applied to some items in your cart.");
      }
    }
  }
  
  // User usage validation
  if (userId) {
    const user = await User.findById(userId);
    if (user && user.coupon_applied) {
      const userUsage = user.coupon_applied.filter(
        applied => applied.couponId?.toString() === coupon._id.toString()
      ).length;
      
      if (userUsage >= coupon.usagePerUser) {
        validationResult.isValid = false;
        validationResult.errors.push("You have reached the usage limit for this coupon.");
      } else if (userUsage > 0) {
        validationResult.warnings.push(`You have used this coupon ${userUsage} out of ${coupon.usagePerUser} times.`);
      }
    }
  }
  
  let discount = 0;
  if (validationResult.isValid) {
    discount = coupon.calculateDiscount(cartAmount);
  }
  
  successRes(res, {
    ...validationResult,
    coupon: {
      _id: coupon._id,
      couponCode: coupon.couponCode,
      description: coupon.description,
      couponType: coupon.couponType,
      couponAmount: coupon.couponAmount
    },
    discount,
    finalAmount: cartAmount - discount
  });
});

// ========== ADMIN CONTROLLERS ==========

// Get detailed coupon usage analytics
module.exports.getDetailedCouponAnalytics_get = catchAsync(async (req, res) => {
  const { startDate, endDate, couponId } = req.query;
  
  let dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }
  
  let couponFilter = {};
  if (couponId) couponFilter._id = mongoose.Types.ObjectId(couponId);
  
  // Overall statistics
  const overallStats = await Coupon.aggregate([
    { $match: { ...couponFilter, ...dateFilter } },
    {
      $group: {
        _id: null,
        totalCoupons: { $sum: 1 },
        activeCoupons: { $sum: { $cond: ['$isActive', 1, 0] } },
        expiredCoupons: { $sum: { $cond: [{ $lt: ['$expiryDate', new Date()] }, 1, 0] } },
        totalUsage: { $sum: '$usedQuantity' },
        totalAvailable: { $sum: '$couponQuantity' },
        avgDiscountAmount: { $avg: '$couponAmount' },
        totalPossibleSavings: { $sum: { $multiply: ['$couponQuantity', '$couponAmount'] } }
      }
    }
  ]);
  
  // Top performing coupons
  const topCoupons = await Coupon.find({ ...couponFilter, ...dateFilter })
    .sort({ usedQuantity: -1 })
    .limit(10)
    .select('couponCode usedQuantity couponQuantity couponAmount couponType');
  
  // Usage by type
  const typeStats = await Coupon.aggregate([
    { $match: { ...couponFilter, ...dateFilter } },
    {
      $group: {
        _id: '$couponType',
        count: { $sum: 1 },
        totalUsage: { $sum: '$usedQuantity' },
        avgAmount: { $avg: '$couponAmount' }
      }
    }
  ]);
  
  // Monthly usage trend
  const monthlyTrend = await Coupon.aggregate([
    { $match: { ...couponFilter, ...dateFilter } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        couponsCreated: { $sum: 1 },
        totalUsage: { $sum: '$usedQuantity' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  
  successRes(res, {
    overallStats: overallStats[0] || {},
    topCoupons,
    typeStats,
    monthlyTrend
  });
});

// Bulk activate/deactivate coupons
module.exports.bulkToggleCoupons_post = catchAsync(async (req, res) => {
  const { couponIds, isActive } = req.body;
  
  if (!Array.isArray(couponIds) || couponIds.length === 0) {
    return errorRes(res, 400, "Coupon IDs array is required.");
  }
  
  const result = await Coupon.updateMany(
    { _id: { $in: couponIds } },
    { isActive: Boolean(isActive) }
  );
  
  successRes(res, {
    message: `${result.modifiedCount} coupons ${isActive ? 'activated' : 'deactivated'} successfully.`,
    updated: result.modifiedCount
  });
});

// Get coupons expiring soon
module.exports.getExpiringCoupons_get = catchAsync(async (req, res) => {
  const { days = 7 } = req.query;
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + parseInt(days));
  
  const expiringCoupons = await Coupon.find({
    isActive: true,
    expiryDate: { $lte: futureDate, $gt: new Date() }
  })
  .sort({ expiryDate: 1 })
  .populate('createdBy', 'name email');
  
  successRes(res, {
    coupons: expiringCoupons,
    count: expiringCoupons.length,
    message: `${expiringCoupons.length} coupons expiring in the next ${days} days.`
  });
});

// Duplicate coupon with modifications
module.exports.duplicateCoupon_post = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { newCouponCode, modifications = {} } = req.body;
  
  const originalCoupon = await Coupon.findById(id);
  if (!originalCoupon) {
    return errorRes(res, 404, "Original coupon not found.");
  }
  
  // Check if new coupon code exists
  const existingCoupon = await Coupon.findOne({ 
    couponCode: newCouponCode.toUpperCase().trim() 
  });
  if (existingCoupon) {
    return errorRes(res, 400, "New coupon code already exists.");
  }
  
  // Create new coupon with modifications
  const newCouponData = {
    ...originalCoupon.toObject(),
    _id: undefined,
    couponCode: newCouponCode.toUpperCase().trim(),
    usedQuantity: 0,
    createdBy: req.admin._id,
    createdAt: undefined,
    updatedAt: undefined,
    ...modifications
  };
  
  const newCoupon = await Coupon.create(newCouponData);
  
  successRes(res, {
    coupon: newCoupon,
    message: "Coupon duplicated successfully."
  });
});

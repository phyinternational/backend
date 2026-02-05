const mongoose = require("mongoose");
const User_Order = mongoose.model("User_Order");
const User = mongoose.model("User");
const Product = mongoose.model("Product");
const catchAsync = require("../utility/catch-async");
const { successRes, errorRes } = require("../utility");
const {
  buildDateRangeFilter,
  getValidOrderMatch,
  calculateOrderTotalStage,
} = require("../utility/analytics-helpers");
const cacheService = require("../services/cache.service");

/**
 * Get comprehensive analytics for the admin dashboard
 */
module.exports.getAnalytics_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const dateFilter = buildDateRangeFilter(startDate, endDate);
    const validOrderMatch = getValidOrderMatch();

    // Cache key for this specific date range
    const cacheKey = `analytics:${startDate || "all"}:${endDate || "all"}`;
    
    const analyticsData = await cacheService.getWithFallback(
      cacheKey,
      async () => {
        // 1. Order and Revenue Metrics
        const orderMetrics = await User_Order.aggregate([
          {
            $match: {
              ...validOrderMatch,
              createdAt: dateFilter,
            },
          },
          calculateOrderTotalStage(),
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              // Orders that actually generated revenue (excluding returns/cancellations)
              successOrders: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $or: [
                            { $eq: ["$payment_status", "COMPLETE"] },
                            {
                              $and: [
                                { $eq: ["$payment_mode", "COD"] },
                                { $eq: ["$order_status", "DELIVERED"] },
                              ],
                            },
                          ],
                        },
                        { $not: [{ $in: ["$order_status", ["CANCELLED_BY_ADMIN", "CANCELLED_BY_USER", "RETURNED"]] }] }
                      ]
                    },
                    1,
                    0,
                  ],
                },
              },
              grossRevenue: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ["$payment_status", "COMPLETE"] },
                        {
                          $and: [
                            { $eq: ["$payment_mode", "COD"] },
                            { $eq: ["$order_status", "DELIVERED"] },
                          ],
                        },
                      ],
                    },
                    "$orderTotal",
                    0,
                  ],
                },
              },
              returnedRevenue: {
                $sum: {
                  $cond: [{ $eq: ["$order_status", "RETURNED"] }, "$orderTotal", 0],
                },
              },
              activeOrders: {
                $sum: {
                  $cond: [
                    { $in: ["$order_status", ["PLACED", "SHIPPED"]] },
                    1,
                    0,
                  ],
                },
              },
              completedOrders: {
                $sum: {
                  $cond: [{ $eq: ["$order_status", "DELIVERED"] }, 1, 0],
                },
              },
              cancelledOrders: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$order_status",
                        ["CANCELLED_BY_ADMIN", "CANCELLED_BY_USER"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              returnedOrders: {
                $sum: {
                  $cond: [{ $eq: ["$order_status", "RETURNED"] }, 1, 0],
                },
              },
            },
          },
        ]);

        const metrics = orderMetrics[0] || {
          totalOrders: 0,
          successOrders: 0,
          grossRevenue: 0,
          returnedRevenue: 0,
          activeOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          returnedOrders: 0,
        };

        const netRevenue = metrics.grossRevenue - metrics.returnedRevenue;
        const aov = metrics.successOrders > 0 ? netRevenue / metrics.successOrders : 0;

        // 2. Customer Metrics
        const [customerCount, loggedInUsers] = await Promise.all([
          // Paying customers (at least one delivered order, excluding duplicates/replacements)
          User_Order.distinct("buyer", { 
            order_status: "DELIVERED",
            parent_order: null 
          }).then(
            (buyers) => buyers.length
          ),
          // Total logged in users
          User.countDocuments({ accountType: "user", isBlocked: false }),
        ]);

        // 3. Order Status Breakdown for Chart
        const statusBreakdown = await User_Order.aggregate([
          {
            $match: {
              ...validOrderMatch,
              createdAt: dateFilter,
            },
          },
          {
            $group: {
              _id: "$order_status",
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              status: "$_id",
              count: 1,
              _id: 0,
            },
          },
        ]);

        // 4. Top Products by Net Revenue
        const topProducts = await User_Order.aggregate([
          {
            $match: {
              ...validOrderMatch,
              createdAt: dateFilter,
              order_status: {
                $nin: ["CANCELLED_BY_ADMIN", "CANCELLED_BY_USER", "RETURNED"],
              },
              $or: [
                { payment_status: "COMPLETE" },
                {
                  $and: [
                    { payment_mode: "COD" },
                    { order_status: "DELIVERED" },
                  ],
                },
              ],
            },
          },
          { $unwind: "$products" },
          {
            $group: {
              _id: "$products.product",
              quantitySold: { $sum: "$products.quantity" },
              revenue: {
                $sum: { $multiply: ["$products.price", "$products.quantity"] },
              },
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "_id",
              as: "productInfo",
            },
          },
          { $unwind: "$productInfo" },
          {
            $project: {
              name: "$productInfo.productTitle",
              sku: "$productInfo.skuNo",
              quantitySold: 1,
              revenue: 1,
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
        ]);

        // 5. Sales Trend (Daily Revenue)
        const salesTrend = await User_Order.aggregate([
          {
            $match: {
              ...validOrderMatch,
              createdAt: dateFilter,
              // Only count revenue-generating orders
              $or: [
                { payment_status: "COMPLETE" },
                {
                  $and: [
                    { payment_mode: "COD" },
                    { order_status: "DELIVERED" },
                  ],
                },
              ],
              order_status: {
                $nin: ["CANCELLED_BY_ADMIN", "CANCELLED_BY_USER", "RETURNED"],
              },
            },
          },
          calculateOrderTotalStage(),
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              revenue: { $sum: "$orderTotal" },
              orders: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              date: "$_id",
              revenue: 1,
              orders: 1,
              _id: 0,
            },
          },
        ]);

        return {
          financials: {
            grossRevenue: metrics.grossRevenue,
            returnedRevenue: metrics.returnedRevenue,
            netRevenue,
            aov,
          },
          orders: {
            total: metrics.totalOrders,
            active: metrics.activeOrders,
            completed: metrics.completedOrders,
            cancelled: metrics.cancelledOrders,
            returned: metrics.returnedOrders,
            statusBreakdown,
          },
          customers: {
            payingCustomers: customerCount,
            totalUsers: loggedInUsers,
          },
          topProducts,
          salesTrend,
        };
      },
      cacheService.TTL.SHORT // 5 minutes
    );

    return successRes(res, analyticsData);
  } catch (error) {
    console.error("Analytics Error:", error);
    return errorRes(res, 400, error.message);
  }
});

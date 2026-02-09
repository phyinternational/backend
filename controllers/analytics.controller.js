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
  calculateItemDeductionsStage,
  checkItemCancelledOrReturnedStage,
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
          calculateItemDeductionsStage(),
          {
            // Compute effective totals after item-level deductions
            $addFields: {
              effectiveOrderTotal: {
                $subtract: [
                  "$orderTotal",
                  { $add: [
                    { $ifNull: ["$cancelledItemsValue", 0] },
                    { $ifNull: ["$approvedReturnItemsValue", 0] }
                  ]}
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              // Orders that actually generated revenue (excluding full cancellations/returns)
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
                                { $in: ["$order_status", ["DELIVERED", "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "REPLACEMENT_REQUESTED", "REPLACEMENT_APPROVED", "REPLACEMENT_REJECTED"]] },
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
              // Gross revenue: use effectiveOrderTotal (minus cancelled items) for paid orders
              grossRevenue: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ["$payment_status", "COMPLETE"] },
                        {
                          $and: [
                            { $eq: ["$payment_mode", "COD"] },
                            { $in: ["$order_status", ["DELIVERED", "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "REPLACEMENT_REQUESTED", "REPLACEMENT_APPROVED", "REPLACEMENT_REJECTED"]] },
                          ],
                        },
                      ],
                    },
                    { $subtract: ["$orderTotal", { $ifNull: ["$cancelledItemsValue", 0] }] },
                    0,
                  ],
                },
              },
              // Returned revenue: order-level RETURNED + item-level approved returns
              returnedRevenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$order_status", "RETURNED"] },
                    "$orderTotal",
                    { $ifNull: ["$approvedReturnItemsValue", 0] },
                  ],
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
              // Delivered: include orders that were delivered even if they later had returns/replacements
              completedOrders: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ["$order_status", "DELIVERED"] },
                        { $in: ["$order_status", [
                          "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "RETURNED",
                          "REPLACEMENT_REQUESTED", "REPLACEMENT_APPROVED", "REPLACEMENT_REJECTED", "REPLACEMENT_IN_PROGRESS"
                        ]]}
                      ]
                    },
                    1,
                    0,
                  ],
                },
              },
              // Cancelled: order-level OR any item-level cancellations
              cancelledOrders: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $in: ["$order_status", ["CANCELLED_BY_ADMIN", "CANCELLED_BY_USER"]] },
                        { $gt: [{ $size: { $ifNull: ["$cancelled_items", []] } }, 0] }
                      ]
                    },
                    1,
                    0,
                  ],
                },
              },
              // Returned: order-level OR any item-level return requests
              returnedOrders: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ["$order_status", "RETURNED"] },
                        { $gt: [{ $size: { $ifNull: ["$item_return_requests", []] } }, 0] }
                      ]
                    },
                    1,
                    0,
                  ],
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

        // Calculate previous period for comparison
        const dateDiff = endDate ?
          (new Date(endDate).getTime() - new Date(startDate || new Date(0)).getTime()) :
          (30 * 24 * 60 * 60 * 1000); // Default 30 days

        const prevStartDate = new Date((new Date(startDate || new Date()).getTime()) - dateDiff);
        const prevEndDate = new Date(startDate || new Date());

        const prevDateFilter = {
          $gte: prevStartDate,
          $lt: prevEndDate,
        };

        // Previous period metrics for comparison
        const prevOrderMetrics = await User_Order.aggregate([
          {
            $match: {
              ...validOrderMatch,
              createdAt: prevDateFilter,
            },
          },
          calculateOrderTotalStage(),
          calculateItemDeductionsStage(),
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              grossRevenue: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ["$payment_status", "COMPLETE"] },
                        {
                          $and: [
                            { $eq: ["$payment_mode", "COD"] },
                            { $in: ["$order_status", ["DELIVERED", "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "REPLACEMENT_REQUESTED", "REPLACEMENT_APPROVED", "REPLACEMENT_REJECTED"]] },
                          ],
                        },
                      ],
                    },
                    { $subtract: ["$orderTotal", { $ifNull: ["$cancelledItemsValue", 0] }] },
                    0,
                  ],
                },
              },
              returnedRevenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$order_status", "RETURNED"] },
                    "$orderTotal",
                    { $ifNull: ["$approvedReturnItemsValue", 0] },
                  ],
                },
              },
            },
          },
        ]);

        const prevMetrics = prevOrderMetrics[0] || { grossRevenue: 0, returnedRevenue: 0, totalOrders: 0 };
        const prevNetRevenue = prevMetrics.grossRevenue - prevMetrics.returnedRevenue;

        const revenueGrowth = prevNetRevenue > 0
          ? ((netRevenue - prevNetRevenue) / prevNetRevenue) * 100
          : 0;
        const orderGrowth = prevMetrics.totalOrders > 0
          ? ((metrics.totalOrders - prevMetrics.totalOrders) / prevMetrics.totalOrders) * 100
          : 0;

        // 2. Customer Metrics
        const [customerCount, loggedInUsers] = await Promise.all([
          // Paying customers (at least one delivered order, excluding duplicates/replacements)
          User_Order.distinct("buyer", {
            order_status: { $in: [
              "DELIVERED",
              "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "RETURNED",
              "REPLACEMENT_REQUESTED", "REPLACEMENT_APPROVED", "REPLACEMENT_REJECTED", "REPLACEMENT_IN_PROGRESS"
            ]},
            parent_order: null
          }).then(
            (buyers) => buyers.length
          ),
          // Total logged in users
          User.countDocuments({ accountType: "user", isBlocked: false }),
        ]);

        // 3. Order Status Breakdown for Chart (item-level)
        const statusBreakdown = await User_Order.aggregate([
          {
            $match: {
              ...validOrderMatch,
              createdAt: dateFilter,
            },
          },
          { $unwind: "$products" },
          {
            $addFields: {
              // Check if this product is cancelled
              _isCancelled: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ["$cancelled_items", []] },
                        as: "c",
                        cond: { $eq: ["$$c.product", "$products.product"] }
                      }
                    }
                  },
                  0
                ]
              },
              // Find item-level return request for this product
              _returnReq: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: { $ifNull: ["$item_return_requests", []] },
                      as: "r",
                      cond: { $eq: ["$$r.product", "$products.product"] }
                    }
                  },
                  0
                ]
              },
              // Find item-level replacement request for this product
              _replReq: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: { $ifNull: ["$item_replacement_requests", []] },
                      as: "r",
                      cond: { $eq: ["$$r.product", "$products.product"] }
                    }
                  },
                  0
                ]
              }
            }
          },
          {
            $addFields: {
              computedItemStatus: {
                $switch: {
                  branches: [
                    { case: "$_isCancelled", then: "CANCELLED" },
                    {
                      case: { $ne: [{ $ifNull: ["$_returnReq", null] }, null] },
                      then: {
                        $switch: {
                          branches: [
                            { case: { $eq: ["$_returnReq.status", "PENDING"] }, then: "RETURN_REQUESTED" },
                            { case: { $eq: ["$_returnReq.status", "APPROVED"] }, then: "RETURN_APPROVED" },
                            { case: { $eq: ["$_returnReq.status", "REJECTED"] }, then: "RETURN_REJECTED" },
                          ],
                          default: "$order_status"
                        }
                      }
                    },
                    {
                      case: { $ne: [{ $ifNull: ["$_replReq", null] }, null] },
                      then: {
                        $switch: {
                          branches: [
                            { case: { $eq: ["$_replReq.status", "PENDING"] }, then: "REPLACEMENT_REQUESTED" },
                            { case: { $eq: ["$_replReq.status", "APPROVED"] }, then: "REPLACEMENT_APPROVED" },
                            { case: { $eq: ["$_replReq.status", "REJECTED"] }, then: "REPLACEMENT_REJECTED" },
                          ],
                          default: "$order_status"
                        }
                      }
                    },
                    // Order-level return/replacement request (legacy) - all items share
                    {
                      case: { $ne: [{ $ifNull: ["$return_request", null] }, null] },
                      then: {
                        $switch: {
                          branches: [
                            { case: { $eq: ["$return_request.status", "PENDING"] }, then: "RETURN_REQUESTED" },
                            { case: { $eq: ["$return_request.status", "APPROVED"] }, then: "RETURN_APPROVED" },
                            { case: { $eq: ["$return_request.status", "REJECTED"] }, then: "RETURN_REJECTED" },
                          ],
                          default: "$order_status"
                        }
                      }
                    },
                    {
                      case: { $ne: [{ $ifNull: ["$replacement_request", null] }, null] },
                      then: {
                        $switch: {
                          branches: [
                            { case: { $eq: ["$replacement_request.status", "PENDING"] }, then: "REPLACEMENT_REQUESTED" },
                            { case: { $eq: ["$replacement_request.status", "APPROVED"] }, then: "REPLACEMENT_APPROVED" },
                            { case: { $eq: ["$replacement_request.status", "REJECTED"] }, then: "REPLACEMENT_REJECTED" },
                          ],
                          default: "$order_status"
                        }
                      }
                    },
                    // If order status changed due to another item's request, this item is still delivered
                    {
                      case: {
                        $and: [
                          {
                            $or: [
                              { $gt: [{ $size: { $ifNull: ["$item_return_requests", []] } }, 0] },
                              { $gt: [{ $size: { $ifNull: ["$item_replacement_requests", []] } }, 0] }
                            ]
                          },
                          {
                            $in: ["$order_status", [
                              "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED",
                              "REPLACEMENT_REQUESTED", "REPLACEMENT_APPROVED", "REPLACEMENT_REJECTED"
                            ]]
                          }
                        ]
                      },
                      then: "DELIVERED"
                    }
                  ],
                  default: "$order_status"
                }
              }
            }
          },
          {
            $group: {
              _id: "$computedItemStatus",
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
                    { order_status: { $in: ["DELIVERED", "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "REPLACEMENT_REQUESTED", "REPLACEMENT_APPROVED", "REPLACEMENT_REJECTED"] } },
                  ],
                },
              ],
            },
          },
          { $unwind: "$products" },
          // Exclude cancelled or approved-return items
          checkItemCancelledOrReturnedStage(),
          { $match: { _isItemCancelled: false, _isItemReturnApproved: false } },
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
        const salesTrendRaw = await User_Order.aggregate([
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
                    { order_status: { $in: ["DELIVERED", "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "REPLACEMENT_REQUESTED", "REPLACEMENT_APPROVED", "REPLACEMENT_REJECTED"] } },
                  ],
                },
              ],
              order_status: {
                $nin: ["CANCELLED_BY_ADMIN", "CANCELLED_BY_USER", "RETURNED"],
              },
            },
          },
          calculateOrderTotalStage(),
          calculateItemDeductionsStage(),
          {
            $addFields: {
              effectiveOrderTotal: {
                $subtract: [
                  "$orderTotal",
                  { $add: [
                    { $ifNull: ["$cancelledItemsValue", 0] },
                    { $ifNull: ["$approvedReturnItemsValue", 0] }
                  ]}
                ]
              }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              revenue: { $sum: "$effectiveOrderTotal" },
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

        // Fill in missing dates so the chart spans the full range
        const trendMap = new Map(salesTrendRaw.map(d => [d.date, d]));
        const salesTrend = [];
        const rangeStart = startDate ? new Date(startDate) : new Date();
        const rangeEnd = endDate ? new Date(endDate) : new Date();
        rangeStart.setUTCHours(0, 0, 0, 0);
        rangeEnd.setUTCHours(0, 0, 0, 0);
        for (let d = new Date(rangeStart); d <= rangeEnd; d.setUTCDate(d.getUTCDate() + 1)) {
          const key = d.toISOString().slice(0, 10);
          salesTrend.push(trendMap.get(key) || { date: key, revenue: 0, orders: 0 });
        }

        // 6. Revenue by Payment Method
        const revenueByPaymentMethod = await User_Order.aggregate([
          {
            $match: {
              ...validOrderMatch,
              createdAt: dateFilter,
              $or: [
                { payment_status: "COMPLETE" },
                {
                  $and: [
                    { payment_mode: "COD" },
                    { order_status: { $in: ["DELIVERED", "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "REPLACEMENT_REQUESTED", "REPLACEMENT_APPROVED", "REPLACEMENT_REJECTED"] } },
                  ],
                },
              ],
              order_status: {
                $nin: ["CANCELLED_BY_ADMIN", "CANCELLED_BY_USER", "RETURNED"],
              },
            },
          },
          calculateOrderTotalStage(),
          calculateItemDeductionsStage(),
          {
            $addFields: {
              effectiveOrderTotal: {
                $subtract: [
                  "$orderTotal",
                  { $add: [
                    { $ifNull: ["$cancelledItemsValue", 0] },
                    { $ifNull: ["$approvedReturnItemsValue", 0] }
                  ]}
                ]
              }
            }
          },
          {
            $group: {
              _id: "$payment_mode",
              revenue: { $sum: "$effectiveOrderTotal" },
              orders: { $sum: 1 },
            },
          },
          {
            $project: {
              paymentMethod: "$_id",
              revenue: 1,
              orders: 1,
              _id: 0,
            },
          },
        ]);

        // 7. Revenue by Category
        const revenueByCategory = await User_Order.aggregate([
          {
            $match: {
              ...validOrderMatch,
              createdAt: dateFilter,
              $or: [
                { payment_status: "COMPLETE" },
                {
                  $and: [
                    { payment_mode: "COD" },
                    { order_status: { $in: ["DELIVERED", "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "REPLACEMENT_REQUESTED", "REPLACEMENT_APPROVED", "REPLACEMENT_REJECTED"] } },
                  ],
                },
              ],
              order_status: {
                $nin: ["CANCELLED_BY_ADMIN", "CANCELLED_BY_USER", "RETURNED"],
              },
            },
          },
          { $unwind: "$products" },
          // Exclude cancelled or approved-return items
          checkItemCancelledOrReturnedStage(),
          { $match: { _isItemCancelled: false, _isItemReturnApproved: false } },
          {
            $lookup: {
              from: "products",
              localField: "products.product",
              foreignField: "_id",
              as: "productDetails",
            },
          },
          { $unwind: "$productDetails" },
          {
            $lookup: {
              from: "product_categories",
              localField: "productDetails.category",
              foreignField: "_id",
              as: "categoryDetails",
            },
          },
          { $unwind: "$categoryDetails" },
          {
            $group: {
              _id: "$categoryDetails._id",
              categoryName: { $first: "$categoryDetails.categoryName" },
              revenue: {
                $sum: { $multiply: ["$products.price", "$products.quantity"] },
              },
              orders: { $addToSet: "$_id" },
            },
          },
          {
            $project: {
              categoryName: 1,
              revenue: 1,
              orders: { $size: "$orders" },
              _id: 0,
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
        ]);

        return {
          financials: {
            grossRevenue: metrics.grossRevenue,
            returnedRevenue: metrics.returnedRevenue,
            netRevenue,
            aov,
            revenueGrowth: Math.round(revenueGrowth * 100) / 100,
            previousPeriodRevenue: prevNetRevenue,
            revenueByPaymentMethod,
            revenueByCategory,
          },
          orders: {
            total: metrics.totalOrders,
            active: metrics.activeOrders,
            completed: metrics.completedOrders,
            cancelled: metrics.cancelledOrders,
            returned: metrics.returnedOrders,
            orderGrowth: Math.round(orderGrowth * 100) / 100,
            previousPeriodOrders: prevMetrics.totalOrders,
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

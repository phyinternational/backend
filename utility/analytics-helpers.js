/**
 * Analytics utility helpers for date filtering and aggregation
 */

/**
 * Builds a date range filter for MongoDB $match stage
 * @param {string|Date} startDate 
 * @param {string|Date} endDate 
 * @returns {Object} MongoDB filter object for createdAt
 */
const buildDateRangeFilter = (startDate, endDate) => {
  const filter = {};
  
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    filter.$gte = start;
  }
  
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  
  return filter;
};

/**
 * Returns match criteria for valid business orders
 * Excludes replacements (parent_order != null)
 * @returns {Object} Match stage object
 */
const getValidOrderMatch = () => {
  return {
    parent_order: null, // Exclude replacements
    payment_status: { $ne: "FAILED" }
  };
};

/**
 * Aggregation stage to calculate order total from products
 * @returns {Object} $addFields stage
 */
const calculateOrderTotalStage = () => {
  return {
    $addFields: {
      orderTotal: {
        $reduce: {
          input: "$products",
          initialValue: 0,
          in: {
            $add: [
              "$$value",
              { $multiply: ["$$this.price", "$$this.quantity"] }
            ]
          }
        }
      }
    }
  };
};

/**
 * Aggregation stage to calculate item-level deductions from order total.
 * Computes cancelledItemsValue and approvedReturnItemsValue by cross-referencing
 * cancelled_items/item_return_requests with the products array.
 * Must be used AFTER calculateOrderTotalStage().
 * @returns {Object} $addFields stage
 */
const calculateItemDeductionsStage = () => {
  // Reusable sub-expression: find a matching product's price for a given item
  const matchProductPrice = (itemProductField) => ({
    $let: {
      vars: {
        matchedProduct: {
          $arrayElemAt: [
            {
              $filter: {
                input: "$products",
                as: "p",
                cond: { $eq: ["$$p.product", itemProductField] }
              }
            },
            0
          ]
        }
      },
      in: { $ifNull: ["$$matchedProduct.price", 0] }
    }
  });

  return {
    $addFields: {
      // Sum of (price * qty) for all cancelled items
      cancelledItemsValue: {
        $reduce: {
          input: { $ifNull: ["$cancelled_items", []] },
          initialValue: 0,
          in: {
            $add: [
              "$$value",
              {
                $multiply: [
                  matchProductPrice("$$this.product"),
                  { $ifNull: ["$$this.quantity", 0] }
                ]
              }
            ]
          }
        }
      },
      // Sum of (price * qty) for item-level returns with APPROVED status
      approvedReturnItemsValue: {
        $reduce: {
          input: {
            $filter: {
              input: { $ifNull: ["$item_return_requests", []] },
              as: "r",
              cond: { $eq: ["$$r.status", "APPROVED"] }
            }
          },
          initialValue: 0,
          in: {
            $add: [
              "$$value",
              {
                $multiply: [
                  matchProductPrice("$$this.product"),
                  { $ifNull: ["$$this.quantity", 0] }
                ]
              }
            ]
          }
        }
      }
    }
  };
};

/**
 * Aggregation stage to check if a specific unwound product is cancelled or has an approved return.
 * Use AFTER { $unwind: "$products" } to filter out cancelled/returned items from revenue queries.
 * @returns {Object} $addFields stage
 */
const checkItemCancelledOrReturnedStage = () => ({
  $addFields: {
    _isItemCancelled: {
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
    _isItemReturnApproved: {
      $gt: [
        {
          $size: {
            $filter: {
              input: { $ifNull: ["$item_return_requests", []] },
              as: "r",
              cond: {
                $and: [
                  { $eq: ["$$r.product", "$products.product"] },
                  { $eq: ["$$r.status", "APPROVED"] }
                ]
              }
            }
          }
        },
        0
      ]
    }
  }
});

module.exports = {
  buildDateRangeFilter,
  getValidOrderMatch,
  calculateOrderTotalStage,
  calculateItemDeductionsStage,
  checkItemCancelledOrReturnedStage
};

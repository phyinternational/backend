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

module.exports = {
  buildDateRangeFilter,
  getValidOrderMatch,
  calculateOrderTotalStage
};

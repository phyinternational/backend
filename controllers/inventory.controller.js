const Inventory = require("../models/inventory.model");
const Product = require("../models/product.model");
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");
const cacheService = require("../services/cache.service");

// Get inventory summary for dashboard
module.exports.getInventorySummary = catchAsync(async (req, res) => {
  try {
    const summary = await cacheService.getWithFallback(
      'inventory:summary',
      async () => {
        const result = await Inventory.getStockSummary();
        return result[0] || {
          totalProducts: 0,
          totalStock: 0,
          totalReserved: 0,
          totalAvailable: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          overStockCount: 0
        };
      },
      cacheService.TTL.MEDIUM
    );

    successRes(res, {
      summary,
      message: "Inventory summary retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting inventory summary:", error);
    internalServerError(res, "Error retrieving inventory summary");
  }
});

// Get all inventory items with pagination and filters
module.exports.getAllInventory = catchAsync(async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      location = '', 
      stockStatus = '', 
      sort = 'product' 
    } = req.query;

    const filter = {};
    
    // Apply filters
    if (stockStatus) {
      switch(stockStatus) {
        case 'low':
          filter['alerts.lowStock'] = true;
          break;
        case 'out':
          filter['alerts.outOfStock'] = true;
          break;
        case 'over':
          filter['alerts.overStock'] = true;
          break;
      }
    }

    if (location) {
      filter['location.warehouse'] = { $regex: location, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    
    // Build sort object
    const sortOptions = {};
    switch(sort) {
      case 'stock_asc':
        sortOptions.availableStock = 1;
        break;
      case 'stock_desc':
        sortOptions.availableStock = -1;
        break;
      case 'updated':
        sortOptions.updatedAt = -1;
        break;
      default:
        sortOptions.product = 1;
    }

    const inventory = await Inventory.find(filter)
      .populate('product', 'productTitle skuNo productImageUrl')
      .populate('variant', 'varientName')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Inventory.countDocuments(filter);

    successRes(res, {
      inventory,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      message: "Inventory retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting inventory:", error);
    internalServerError(res, "Error retrieving inventory");
  }
});

// Get low stock items
module.exports.getLowStockItems = catchAsync(async (req, res) => {
  try {
    const lowStockItems = await cacheService.getWithFallback(
      'inventory:low_stock',
      async () => {
        return await Inventory.getLowStockItems();
      },
      cacheService.TTL.SHORT
    );

    successRes(res, {
      items: lowStockItems,
      count: lowStockItems.length,
      message: "Low stock items retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting low stock items:", error);
    internalServerError(res, "Error retrieving low stock items");
  }
});

// Update stock manually
module.exports.updateStock = catchAsync(async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { quantity, type, reason, notes } = req.body;

    if (!quantity || !type || !reason) {
      return errorRes(res, 400, "Quantity, type, and reason are required");
    }

    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return errorRes(res, 404, "Inventory item not found");
    }

    await inventory.updateStock(
      quantity, 
      type, 
      reason, 
      null, 
      req.user._id, 
      notes
    );

    // Clear cache
    await cacheService.clearPattern('inventory:*');

    successRes(res, {
      inventory,
      message: "Stock updated successfully"
    });
  } catch (error) {
    console.error("Error updating stock:", error);
    internalServerError(res, error.message || "Error updating stock");
  }
});

// Bulk update reorder points
module.exports.bulkUpdateReorderPoints = catchAsync(async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return errorRes(res, 400, "Updates must be an array");
    }

    const results = [];
    
    for (const update of updates) {
      const { inventoryId, reorderPoint } = update;
      
      if (!inventoryId || typeof reorderPoint !== 'number') {
        results.push({
          inventoryId,
          success: false,
          error: "Invalid inventory ID or reorder point"
        });
        continue;
      }

      try {
        await Inventory.findByIdAndUpdate(
          inventoryId,
          { reorderPoint },
          { new: true }
        );
        
        results.push({
          inventoryId,
          success: true
        });
      } catch (error) {
        results.push({
          inventoryId,
          success: false,
          error: error.message
        });
      }
    }

    // Clear cache
    await cacheService.clearPattern('inventory:*');

    successRes(res, {
      results,
      message: "Bulk reorder points update completed"
    });
  } catch (error) {
    console.error("Error bulk updating reorder points:", error);
    internalServerError(res, "Error updating reorder points");
  }
});

// Get inventory movements/history
module.exports.getInventoryMovements = catchAsync(async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const inventory = await Inventory.findById(inventoryId)
      .populate('movements.orderId', 'createdAt order_status')
      .populate('movements.performedBy', 'name email');

    if (!inventory) {
      return errorRes(res, 404, "Inventory item not found");
    }

    // Sort movements by timestamp (newest first)
    const sortedMovements = inventory.movements
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice((page - 1) * limit, page * limit);

    const total = inventory.movements.length;

    successRes(res, {
      movements: sortedMovements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      message: "Inventory movements retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting inventory movements:", error);
    internalServerError(res, "Error retrieving inventory movements");
  }
});

// Create or update inventory for a product
module.exports.createOrUpdateInventory = catchAsync(async (req, res) => {
  try {
    const { productId, variantId, initialStock, reorderPoint, maxStock, location, supplier } = req.body;

    if (!productId) {
      return errorRes(res, 400, "Product ID is required");
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return errorRes(res, 404, "Product not found");
    }

    // Check if inventory already exists
    const existingInventory = await Inventory.findOne({
      product: productId,
      variant: variantId || null
    });

    if (existingInventory) {
      // Update existing inventory
      Object.assign(existingInventory, {
        ...(initialStock !== undefined && { currentStock: initialStock }),
        ...(reorderPoint !== undefined && { reorderPoint }),
        ...(maxStock !== undefined && { maxStock }),
        ...(location && { location }),
        ...(supplier && { supplier })
      });

      await existingInventory.save();

      // Clear cache
      await cacheService.clearPattern('inventory:*');

      return successRes(res, {
        inventory: existingInventory,
        message: "Inventory updated successfully"
      });
    }

    // Create new inventory
    const inventory = new Inventory({
      product: productId,
      variant: variantId || null,
      currentStock: initialStock || 0,
      reorderPoint: reorderPoint || 10,
      maxStock: maxStock || 1000,
      location: location || {},
      supplier: supplier || {}
    });

    await inventory.save();

    // Clear cache
    await cacheService.clearPattern('inventory:*');

    successRes(res, {
      inventory,
      message: "Inventory created successfully"
    });
  } catch (error) {
    console.error("Error creating/updating inventory:", error);
    internalServerError(res, "Error managing inventory");
  }
});

// Generate stock report
module.exports.generateStockReport = catchAsync(async (req, res) => {
  try {
    const { format = 'json', includeMovements = false } = req.query;

    const inventory = await Inventory.find({})
      .populate('product', 'productTitle skuNo')
      .populate('variant', 'varientName')
      .sort({ 'product.productTitle': 1 });

    if (format === 'json') {
      const report = inventory.map(item => ({
        productTitle: item.product.productTitle,
        skuNo: item.product.skuNo,
        variantName: item.variant?.varientName || 'N/A',
        currentStock: item.currentStock,
        reservedStock: item.reservedStock,
        availableStock: item.availableStock,
        reorderPoint: item.reorderPoint,
        alerts: item.alerts,
        location: item.location,
        lastRestocked: item.lastRestocked,
        ...(includeMovements && { movements: item.movements })
      }));

      successRes(res, {
        report,
        generatedAt: new Date(),
        message: "Stock report generated successfully"
      });
    } else {
      // Could implement CSV export here
      return errorRes(res, 400, "Only JSON format is currently supported");
    }
  } catch (error) {
    console.error("Error generating stock report:", error);
    internalServerError(res, "Error generating stock report");
  }
});

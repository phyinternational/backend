/**
 * Cleanup Script: Remove invalid return_request and replacement_request fields
 *
 * This script fixes orders that have empty return_request or replacement_request
 * objects with only status: "PENDING" due to the schema bug.
 *
 * Run: node scripts/cleanup-return-replacement-requests.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Load models
require("../models/order.model");
const User_Order = mongoose.model("User_Order");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/raajsi";

async function cleanupOrders() {
  try {
    // Connect to database
    console.log("🔌 Connecting to database...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to database\n");

    // Find all orders
    const allOrders = await User_Order.find({});
    console.log(`📦 Found ${allOrders.length} total orders\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const order of allOrders) {
      let needsUpdate = false;
      const updates = {};

      // Check return_request
      if (order.return_request) {
        const hasReason = order.return_request.reason && order.return_request.reason.trim() !== "";
        const hasImages = order.return_request.proof_images && order.return_request.proof_images.length > 0;
        const hasRequestDate = order.return_request.requestedAt;

        // If it's an empty/invalid request (no reason, no images, no request date)
        if (!hasReason && !hasImages && !hasRequestDate) {
          console.log(`🔧 Order ${order._id}: Removing invalid return_request`);
          updates.return_request = null;
          needsUpdate = true;
        } else {
          // It's a valid return request, ensure status is set
          if (!order.return_request.status) {
            console.log(`🔧 Order ${order._id}: Setting return_request status to PENDING`);
            updates["return_request.status"] = "PENDING";
            needsUpdate = true;
          }
        }
      }

      // Check replacement_request
      if (order.replacement_request) {
        const hasReason = order.replacement_request.reason && order.replacement_request.reason.trim() !== "";
        const hasImages = order.replacement_request.proof_images && order.replacement_request.proof_images.length > 0;
        const hasRequestDate = order.replacement_request.requestedAt;

        // If it's an empty/invalid request (no reason, no images, no request date)
        if (!hasReason && !hasImages && !hasRequestDate) {
          console.log(`🔧 Order ${order._id}: Removing invalid replacement_request`);
          updates.replacement_request = null;
          needsUpdate = true;
        } else {
          // It's a valid replacement request, ensure status is set
          if (!order.replacement_request.status) {
            console.log(`🔧 Order ${order._id}: Setting replacement_request status to PENDING`);
            updates["replacement_request.status"] = "PENDING";
            needsUpdate = true;
          }
        }
      }

      // Update the order if needed
      if (needsUpdate) {
        await User_Order.updateOne({ _id: order._id }, { $set: updates });
        fixedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log("\n📊 Cleanup Summary:");
    console.log(`   ✅ Fixed: ${fixedCount} orders`);
    console.log(`   ⏭️  Skipped: ${skippedCount} orders (no changes needed)`);
    console.log(`   📦 Total: ${allOrders.length} orders`);

    // Verify the cleanup
    console.log("\n🔍 Verifying cleanup...");
    const ordersWithEmptyReturnRequest = await User_Order.countDocuments({
      "return_request": { $exists: true, $ne: null },
      "return_request.reason": { $exists: false }
    });
    const ordersWithEmptyReplacementRequest = await User_Order.countDocuments({
      "replacement_request": { $exists: true, $ne: null },
      "replacement_request.reason": { $exists: false }
    });

    console.log(`   Orders with invalid return_request: ${ordersWithEmptyReturnRequest}`);
    console.log(`   Orders with invalid replacement_request: ${ordersWithEmptyReplacementRequest}`);

    if (ordersWithEmptyReturnRequest === 0 && ordersWithEmptyReplacementRequest === 0) {
      console.log("\n✅ All orders are clean!");
    } else {
      console.log("\n⚠️  Some orders may still need manual review");
    }

  } catch (error) {
    console.error("\n❌ Error during cleanup:", error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
    process.exit(0);
  }
}

// Run the cleanup
console.log("🚀 Starting cleanup script...\n");
cleanupOrders();

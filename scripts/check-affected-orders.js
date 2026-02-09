/**
 * Check Script: Find orders affected by the return/replacement request bug
 *
 * This script checks how many orders have invalid return_request or
 * replacement_request fields without running any updates.
 *
 * Run: node scripts/check-affected-orders.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Load models
require("../models/order.model");
const User_Order = mongoose.model("User_Order");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/raajsi";

async function checkAffectedOrders() {
  try {
    // Connect to database
    console.log("🔌 Connecting to database...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to database\n");

    // Find all orders
    const totalOrders = await User_Order.countDocuments({});
    console.log(`📦 Total orders in database: ${totalOrders}\n`);

    // Find orders with potentially invalid return_request
    const ordersWithReturnRequest = await User_Order.find({
      return_request: { $exists: true, $ne: null }
    }).select("_id buyer createdAt order_status return_request");

    let invalidReturnRequests = 0;
    let validReturnRequests = 0;

    console.log("🔍 Checking return_request fields...");
    for (const order of ordersWithReturnRequest) {
      const hasReason = order.return_request.reason && order.return_request.reason.trim() !== "";
      const hasImages = order.return_request.proof_images && order.return_request.proof_images.length > 0;
      const hasRequestDate = order.return_request.requestedAt;

      if (!hasReason && !hasImages && !hasRequestDate) {
        invalidReturnRequests++;
        console.log(`   ❌ Order ${order._id} - Invalid (empty) return_request`);
      } else {
        validReturnRequests++;
      }
    }

    // Find orders with potentially invalid replacement_request
    const ordersWithReplacementRequest = await User_Order.find({
      replacement_request: { $exists: true, $ne: null }
    }).select("_id buyer createdAt order_status replacement_request");

    let invalidReplacementRequests = 0;
    let validReplacementRequests = 0;

    console.log("\n🔍 Checking replacement_request fields...");
    for (const order of ordersWithReplacementRequest) {
      const hasReason = order.replacement_request.reason && order.replacement_request.reason.trim() !== "";
      const hasImages = order.replacement_request.proof_images && order.replacement_request.proof_images.length > 0;
      const hasRequestDate = order.replacement_request.requestedAt;

      if (!hasReason && !hasImages && !hasRequestDate) {
        invalidReplacementRequests++;
        console.log(`   ❌ Order ${order._id} - Invalid (empty) replacement_request`);
      } else {
        validReplacementRequests++;
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total orders:                        ${totalOrders}`);
    console.log(`\nReturn Requests:`);
    console.log(`   ❌ Invalid (will be removed):      ${invalidReturnRequests}`);
    console.log(`   ✅ Valid (will be kept):           ${validReturnRequests}`);
    console.log(`\nReplacement Requests:`);
    console.log(`   ❌ Invalid (will be removed):      ${invalidReplacementRequests}`);
    console.log(`   ✅ Valid (will be kept):           ${validReplacementRequests}`);
    console.log(`\nTotal affected orders:              ${invalidReturnRequests + invalidReplacementRequests}`);
    console.log("=".repeat(60));

    if (invalidReturnRequests > 0 || invalidReplacementRequests > 0) {
      console.log("\n⚠️  You have affected orders. Run the cleanup script:");
      console.log("   node scripts/cleanup-return-replacement-requests.js");
    } else {
      console.log("\n✅ No affected orders found! Your database is clean.");
    }

  } catch (error) {
    console.error("\n❌ Error during check:", error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
    process.exit(0);
  }
}

// Run the check
console.log("🚀 Starting check script...\n");
checkAffectedOrders();

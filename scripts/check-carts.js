/**
 * Script to check and fix orphaned/duplicate carts
 * Identifies users with multiple carts or carts without users
 * 
 * Run with: node scripts/check-carts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

mongoose.set('strictQuery', false);

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MongoDB connection string not found');
  process.exit(1);
}

async function checkCarts() {
  try {
    console.log('🔍 Checking cart integrity...\n');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const users = db.collection('users');
    const carts = db.collection('user_carts');

    // Find all carts
    const allCarts = await carts.find({}).toArray();
    console.log(`📦 Total carts: ${allCarts.length}\n`);

    // Check for duplicate carts per user
    const cartsByUser = {};
    for (const cart of allCarts) {
      const userId = cart.userId?.toString();
      if (!cartsByUser[userId]) {
        cartsByUser[userId] = [];
      }
      cartsByUser[userId].push(cart);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Checking for duplicate carts...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let duplicatesFound = false;
    for (const [userId, userCarts] of Object.entries(cartsByUser)) {
      if (userCarts.length > 1) {
        duplicatesFound = true;
        console.log(`⚠️  User ${userId} has ${userCarts.length} carts:`);
        for (const cart of userCarts) {
          console.log(`   - Cart ${cart._id}: ${cart.products?.length || 0} products`);
        }
        console.log('');
      }
    }

    if (!duplicatesFound) {
      console.log('✅ No duplicate carts found\n');
    }

    // Check for orphaned carts
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Checking for orphaned carts...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let orphansFound = false;
    for (const cart of allCarts) {
      const userId = cart.userId;
      if (!userId) {
        orphansFound = true;
        console.log(`⚠️  Cart ${cart._id} has no userId`);
        continue;
      }

      const user = await users.findOne({ _id: userId });
      if (!user) {
        orphansFound = true;
        console.log(`⚠️  Cart ${cart._id} belongs to non-existent user ${userId}`);
      }
    }

    if (!orphansFound) {
      console.log('✅ No orphaned carts found\n');
    } else {
      console.log('');
    }

    // Check for users without carts
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Checking for users without carts...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const allUsers = await users.find({}).toArray();
    console.log(`👤 Total users: ${allUsers.length}\n`);

    let usersWithoutCarts = false;
    for (const user of allUsers) {
      if (!user.cart) {
        usersWithoutCarts = true;
        console.log(`⚠️  User ${user._id} (${user.phoneNumber || user.email}) has no cart reference`);
      } else {
        const cart = await carts.findOne({ _id: user.cart });
        if (!cart) {
          usersWithoutCarts = true;
          console.log(`⚠️  User ${user._id} (${user.phoneNumber || user.email}) references non-existent cart ${user.cart}`);
        }
      }
    }

    if (!usersWithoutCarts) {
      console.log('✅ All users have valid carts\n');
    } else {
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Users: ${allUsers.length}`);
    console.log(`Carts: ${allCarts.length}`);
    console.log(`Empty carts: ${allCarts.filter(c => !c.products || c.products.length === 0).length}`);
    console.log(`Carts with items: ${allCarts.filter(c => c.products && c.products.length > 0).length}\n`);

    if (duplicatesFound || orphansFound || usersWithoutCarts) {
      console.log('💡 Recommendation: Run clean-test-data.js to reset all user data\n');
    } else {
      console.log('✅ All cart data looks healthy!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

checkCarts();

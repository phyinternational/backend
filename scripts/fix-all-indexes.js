/**
 * Comprehensive script to fix all problematic unique indexes
 * This will drop unique constraints on nullable fields and optionally clean test data
 * 
 * Run with: node scripts/fix-all-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Suppress strictQuery warning
mongoose.set('strictQuery', false);

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MongoDB connection string not found in environment variables');
  console.error('Please ensure MONGO_URI is set in your .env file');
  process.exit(1);
}

async function fixAllIndexes() {
  try {
    console.log('🔧 Starting comprehensive index fix...\n');
    console.log('Connecting to MongoDB...');
    console.log('URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Hide password
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully\n');

    const db = mongoose.connection.db;

    // ============================================
    // 1. Fix user_carts collection
    // ============================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Fixing user_carts collection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const cartsCollection = db.collection('user_carts');
    
    console.log('Current indexes on user_carts:');
    const cartIndexes = await cartsCollection.indexes();
    cartIndexes.forEach(index => {
      const unique = index.unique ? ' (UNIQUE)' : '';
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${unique}`);
    });

    // Drop problematic cart index
    try {
      console.log('\n🗑️  Dropping index: products.productId_1');
      await cartsCollection.dropIndex('products.productId_1');
      console.log('✅ Successfully dropped index: products.productId_1');
    } catch (error) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log('ℹ️  Index products.productId_1 does not exist (already dropped)');
      } else {
        throw error;
      }
    }

    // ============================================
    // 2. Fix users collection
    // ============================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Fixing users collection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const usersCollection = db.collection('users');
    
    console.log('Current indexes on users:');
    const userIndexes = await usersCollection.indexes();
    userIndexes.forEach(index => {
      const unique = index.unique ? ' (UNIQUE)' : '';
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${unique}`);
    });

    // Drop problematic email index if it's unique
    try {
      const emailIndex = userIndexes.find(idx => idx.name === 'email_1');
      if (emailIndex && emailIndex.unique) {
        console.log('\n🗑️  Dropping unique index: email_1');
        await usersCollection.dropIndex('email_1');
        console.log('✅ Successfully dropped unique index: email_1');
        
        // Recreate as non-unique sparse index
        console.log('🔨 Creating new sparse index on email (non-unique)');
        await usersCollection.createIndex({ email: 1 }, { sparse: true, unique: false });
        console.log('✅ Created sparse index on email');
      } else {
        console.log('ℹ️  Email index is not unique or does not exist');
      }
    } catch (error) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log('ℹ️  Index email_1 does not exist');
      } else {
        console.log('⚠️  Could not modify email index:', error.message);
      }
    }

    // ============================================
    // 3. Show final state
    // ============================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Final Index State');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Remaining indexes on user_carts:');
    const finalCartIndexes = await cartsCollection.indexes();
    finalCartIndexes.forEach(index => {
      const unique = index.unique ? ' (UNIQUE)' : '';
      const sparse = index.sparse ? ' (SPARSE)' : '';
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${unique}${sparse}`);
    });

    console.log('\nRemaining indexes on users:');
    const finalUserIndexes = await usersCollection.indexes();
    finalUserIndexes.forEach(index => {
      const unique = index.unique ? ' (UNIQUE)' : '';
      const sparse = index.sparse ? ' (SPARSE)' : '';
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${unique}${sparse}`);
    });

    // ============================================
    // 4. Count documents
    // ============================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 Collection Statistics');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const userCount = await usersCollection.countDocuments();
    const cartCount = await cartsCollection.countDocuments();
    
    console.log(`Users: ${userCount} documents`);
    console.log(`Carts: ${cartCount} documents`);

    // Check for problematic documents
    const usersWithNullEmail = await usersCollection.countDocuments({ email: null });
    const cartsWithNullProducts = await cartsCollection.countDocuments({ 
      $or: [
        { products: { $size: 0 } },
        { 'products.productId': null }
      ]
    });

    console.log(`\nUsers with null email: ${usersWithNullEmail}`);
    console.log(`Carts with empty/null products: ${cartsWithNullProducts}`);

    console.log('\n✅ Index fix completed successfully!');
    console.log('\n💡 Tips:');
    console.log('  - Test OTP registration now');
    console.log('  - Multiple users can now have null emails');
    console.log('  - Multiple carts can have empty products arrays');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

// Run the script
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║     MongoDB Index Fix - Comprehensive Solution        ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

fixAllIndexes();

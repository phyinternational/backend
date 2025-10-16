/**
 * Script to drop the problematic unique index on products.productId
 * This index prevents creating multiple empty carts
 * 
 * Run with: node scripts/drop-cart-index.js
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

async function dropCartIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully');

    const db = mongoose.connection.db;
    const collection = db.collection('user_carts');

    // List all indexes
    console.log('\nCurrent indexes on user_carts collection:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log('-', index.name, ':', JSON.stringify(index.key));
    });

    // Drop the problematic index
    try {
      console.log('\nDropping index: products.productId_1');
      await collection.dropIndex('products.productId_1');
      console.log('✅ Successfully dropped index: products.productId_1');
    } catch (error) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log('⚠️  Index products.productId_1 does not exist (already dropped or never created)');
      } else {
        throw error;
      }
    }

    // Show remaining indexes
    console.log('\nRemaining indexes on user_carts collection:');
    const remainingIndexes = await collection.indexes();
    remainingIndexes.forEach(index => {
      console.log('-', index.name, ':', JSON.stringify(index.key));
    });

    console.log('\n✅ Index cleanup completed successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

// Run the script
dropCartIndex();

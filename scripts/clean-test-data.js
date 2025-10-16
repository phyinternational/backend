/**
 * Script to clean all test data from database
 * WARNING: This will delete ALL user data, carts, orders, etc.
 * Only use this for test/development databases!
 * 
 * Run with: node scripts/clean-test-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// Suppress strictQuery warning
mongoose.set('strictQuery', false);

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MongoDB connection string not found in environment variables');
  process.exit(1);
}

// Collections that will be cleaned (add more as needed)
const COLLECTIONS_TO_CLEAN = [
  'users',
  'user_carts',
  'orders',
  'user_wishlists',
  'user_loyalties',
  'notifications'
];

// Collections that will be preserved (products, categories, etc.)
const COLLECTIONS_TO_PRESERVE = [
  'products',
  'product_categories',
  'product_subcategories',
  'product_colors',
  'product_varients',
  'brands',
  'banners',
  'blogs',
  'faqs',
  'coupons',
  'tncs',
  'trending_products'
];

function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function cleanTestData() {
  try {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║        ⚠️  DANGER: Database Cleanup Script ⚠️         ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    console.log('🔧 Connecting to MongoDB...');
    console.log('Database:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully\n');

    const db = mongoose.connection.db;
    const dbName = db.databaseName;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Database: ${dbName}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Show what will be deleted
    console.log('❌ Collections that will be DELETED:');
    for (const collectionName of COLLECTIONS_TO_CLEAN) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        console.log(`   - ${collectionName}: ${count} documents`);
      } catch (error) {
        console.log(`   - ${collectionName}: Collection doesn't exist`);
      }
    }

    console.log('\n✅ Collections that will be PRESERVED:');
    for (const collectionName of COLLECTIONS_TO_PRESERVE) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        console.log(`   - ${collectionName}: ${count} documents`);
      } catch (error) {
        console.log(`   - ${collectionName}: Collection doesn't exist`);
      }
    }

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This action cannot be undone!\n');
    const confirmed = await askConfirmation('Are you sure you want to delete all test data? (yes/no): ');

    if (!confirmed) {
      console.log('\n❌ Operation cancelled by user');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Double confirmation
    console.log('');
    const doubleConfirmed = await askConfirmation('Type "yes" again to confirm deletion: ');

    if (!doubleConfirmed) {
      console.log('\n❌ Operation cancelled by user');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Delete data
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗑️  Deleting data...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let totalDeleted = 0;

    for (const collectionName of COLLECTIONS_TO_CLEAN) {
      try {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({});
        console.log(`✅ Deleted ${result.deletedCount} documents from ${collectionName}`);
        totalDeleted += result.deletedCount;
      } catch (error) {
        console.log(`⚠️  Could not delete from ${collectionName}: ${error.message}`);
      }
    }

    console.log(`\n✅ Total documents deleted: ${totalDeleted}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Cleanup completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 Next steps:');
    console.log('   1. Run: node scripts/fix-all-indexes.js');
    console.log('   2. Restart your server');
    console.log('   3. Test OTP registration with fresh data\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed\n');
    process.exit(0);
  }
}

// Run the script
cleanTestData();

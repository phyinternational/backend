# OTP Verification Cart Error Fix

## Problem
OTP verification was failing with error:
```json
{
    "status": "error",
    "error": {
        "code": 500,
        "message": "E11000 duplicate key error collection: test.user_carts index: products.productId_1 dup key: { products.productId: null }"
    }
}
```

## Root Cause
MongoDB has a **unique index** on `products.productId` field in the `user_carts` collection. This index was likely created manually or by an old version of the code. When creating multiple empty carts (with `products: []`), all have `null` for productId, which violates the unique constraint.

## Impact
- New users cannot register via OTP
- User creation fails at cart creation step
- Prevents onboarding flow

## Solution

### 1. Drop the Problematic Index (REQUIRED)

Run the migration script to remove the unique index:

```bash
cd raajsi-backend
node scripts/drop-cart-index.js
```

This script will:
- Connect to MongoDB
- List all current indexes on user_carts collection
- Drop the `products.productId_1` index
- Show remaining indexes

**Expected Output:**
```
Connecting to MongoDB...
Connected successfully

Current indexes on user_carts collection:
- _id_ : {"_id":1}
- products.productId_1 : {"products.productId":1}

Dropping index: products.productId_1
✅ Successfully dropped index: products.productId_1

Remaining indexes on user_carts collection:
- _id_ : {"_id":1}

✅ Index cleanup completed successfully
```

### 2. Code Changes (COMPLETED)

Updated `otp.controller.js` to handle cart creation errors gracefully:

**Before:**
```javascript
const newCart = new User_Cart({
  userId: user._id,
  products: [],
});
const cart = await newCart.save();
user.cart = cart._id;
```

**After:**
```javascript
try {
  const newCart = new User_Cart({
    userId: user._id,
    products: [],
  });
  const cart = await newCart.save();
  user.cart = cart._id;
} catch (cartError) {
  if (cartError.code === 11000) {
    console.log('Cart duplicate key error, attempting to find existing cart for user');
    const existingCart = await User_Cart.findOne({ userId: user._id });
    if (existingCart) {
      user.cart = existingCart._id;
    } else {
      throw cartError;
    }
  } else {
    throw cartError;
  }
}
```

## Changes Made

### Files Modified:
1. **controllers/otp.controller.js**
   - Added try-catch for cart creation in new user flow
   - Added try-catch for cart creation in existing user flow (if cart missing)
   - Handles duplicate key error by finding existing cart
   - Lines: 143-198

### Files Created:
2. **scripts/drop-cart-index.js**
   - Migration script to drop the problematic index
   - Lists all indexes before and after
   - Safe error handling if index doesn't exist

## Testing Steps

### 1. Check Current Indexes (Optional)
```bash
mongo
use test  # or your database name
db.user_carts.getIndexes()
```

You should see:
```json
[
  { "v": 2, "key": { "_id": 1 }, "name": "_id_" },
  { "v": 2, "key": { "products.productId": 1 }, "name": "products.productId_1", "unique": true }
]
```

### 2. Run Migration Script
```bash
cd raajsi-backend
node scripts/drop-cart-index.js
```

### 3. Test OTP Registration
1. Send OTP to a new phone number:
   ```bash
   POST http://localhost:5000/auth/send-otp
   Content-Type: application/json
   
   {
     "phoneNumber": "9876543210"
   }
   ```

2. Verify OTP:
   ```bash
   POST http://localhost:5000/auth/verify-otp
   Content-Type: application/json
   
   {
     "phoneNumber": "9876543210",
     "otp": "123456"  # Use OTP from response
   }
   ```

3. Expected response:
   ```json
   {
     "status": "success",
     "data": {
       "user": {
         "_id": "...",
         "phoneNumber": "+919876543210",
         "isPhoneVerified": true,
         "isOnboarded": false,
         "cart": "...",
         "token": "..."
       },
       "message": "Login successful. Please complete your profile."
     }
   }
   ```

### 4. Test Multiple Users
Register 2-3 new users to confirm multiple empty carts can be created without errors.

## Why This Happened

The unique index on `products.productId` was likely added:
- Manually via MongoDB shell/Compass
- By an old migration script
- By an old version of the model with `unique: true`

**The cart model never defined this index**, so it's an orphaned constraint.

## Prevention

To prevent similar issues:

1. **Review all MongoDB indexes:**
   ```bash
   db.user_carts.getIndexes()
   ```

2. **Document required indexes** in model files or migration scripts

3. **Add index validation** to ensure only intended indexes exist

4. **Use mongoose index management:**
   ```javascript
   cartSchema.index({ userId: 1 }); // Proper index definition
   ```

## Rollback (If Needed)

If you need to recreate the index for some reason:
```bash
mongo
use test
db.user_carts.createIndex({ "products.productId": 1 }, { unique: true, sparse: true })
```

Note: Use `sparse: true` to allow multiple null values.

## Related Files
- `models/cart.model.js` - Cart schema definition
- `controllers/otp.controller.js` - OTP verification flow
- `scripts/drop-cart-index.js` - Index cleanup script

## Status
- ✅ Migration script created
- ✅ Error handling added to OTP controller
- ⏳ **ACTION REQUIRED:** Run migration script to drop index
- ⏳ Test OTP registration with new users

## Notes
- This fix is backward compatible
- Existing carts are not affected
- The code now handles cart creation errors gracefully
- If the index is already dropped, the script will report it safely

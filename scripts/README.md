# Database Cleanup Scripts

## Return/Replacement Request Bug Fix

### Background
Due to a bug in the Mongoose schema definition, orders were being created with empty `return_request` and `replacement_request` objects that had `status: "PENDING"`. This made it appear as if return and replacement requests were automatically created for every new order.

### Fix Applied
The schema has been updated to remove the nested `default: "PENDING"` that was causing this issue. However, existing orders in the database may still have these invalid fields.

---

## Scripts

### 1. Check Affected Orders (Safe - No Changes)
**File:** `check-affected-orders.js`

This script checks how many orders are affected by the bug without making any changes.

```bash
cd raajsi-backend
node scripts/check-affected-orders.js
```

**Output:**
- Lists all orders with invalid return/replacement requests
- Shows a summary of affected vs valid orders
- Recommends whether cleanup is needed

---

### 2. Cleanup Script (Makes Changes)
**File:** `cleanup-return-replacement-requests.js`

This script fixes affected orders by:
- Removing empty/invalid `return_request` and `replacement_request` fields (sets them to `null`)
- Keeping valid requests that have actual data (reason, images, dates)
- Ensuring valid requests have the correct `status: "PENDING"`

```bash
cd raajsi-backend
node scripts/cleanup-return-replacement-requests.js
```

**What it does:**
- Connects to your MongoDB database
- Finds all orders with invalid return/replacement requests
- Updates them to set these fields to `null`
- Provides a summary of changes made
- Verifies the cleanup was successful

---

## Recommended Steps

### Step 1: Check for affected orders
```bash
node scripts/check-affected-orders.js
```

### Step 2: If affected orders are found, run the cleanup
```bash
node scripts/cleanup-return-replacement-requests.js
```

### Step 3: Verify the fix (optional - re-run check)
```bash
node scripts/check-affected-orders.js
```

---

## Safety Notes

✅ **Safe to run multiple times** - The scripts are idempotent and won't cause issues if run repeatedly

✅ **No data loss** - Only removes empty/invalid fields, preserves legitimate return/replacement requests

✅ **Backup recommended** - As with any database operation, it's good practice to backup your database first:
```bash
mongodump --uri="your-mongodb-uri" --out=./backup-$(date +%Y%m%d)
```

---

## Verification

After running the cleanup, you can verify orders in your database:

```javascript
// In MongoDB shell or Compass
db.user_orders.find({
  $or: [
    { return_request: { $ne: null } },
    { replacement_request: { $ne: null } }
  ]
})
```

All remaining `return_request` and `replacement_request` fields should have:
- A `reason` field with actual content
- A `requestedAt` date
- A valid `status` ("PENDING", "APPROVED", or "REJECTED")

---

## Questions?

If you encounter any issues or have questions about these scripts, please check:
1. Your `.env` file has the correct `MONGODB_URI`
2. The database connection is working
3. You have the necessary permissions to update documents

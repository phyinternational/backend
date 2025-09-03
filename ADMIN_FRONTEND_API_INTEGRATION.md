# Ecolove Admin Dashboard API Integration Guide

This document provides instructions for integrating the admin frontend with the Ecolove Jewelry backend APIs.

**Base URL**: `http://localhost:5000` (for development)

**Authentication**: The API uses HttpOnly cookies for authentication. After successful login, the server sets a `token` cookie that will be automatically included in subsequent requests.

**CORS Configuration**: The following origins are allowed:
- `https://ecolove-website-frontend.vercel.app`
- `http://localhost:3000`
- `https://ecoloveclothing-admin-frontend.vercel.app`
- `http://localhost:3001`
- `http://localhost:5173`

---

## 1. Authentication

### Admin Signin

- **Endpoint**: `POST /admin/signin`
- **Description**: Authenticates an admin user and sets an HttpOnly cookie with JWT token
- **Request Body**:
  ```json
  {
    "email": "admin@example.com",
    "password": "adminpassword"
  }
  ```
- **Success Response** (200):
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "_id": "...",
        "fullName": "Admin User",
        "email": "admin@example.com",
        "role": "admin",
        "isVerified": true
      }
    }
  }
  ```

### Get Admin Data

- **Endpoint**: `GET /user/current`
- **Description**: Gets the current admin's profile data
- **Authentication**: Required (Admin only)
- **Success Response** (200):
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "_id": "...",
        "fullName": "Admin User",
        "email": "admin@example.com",
        "role": "admin"
      }
    }
  }
  ```

### Logout

- **Endpoint**: `GET /logout`
- **Description**: Clears the authentication cookie
- **Success Response** (200):
  ```json
  {
    "message": "User logged out successfully"
  }
  ```

---

## 2. Products Management

### Add Product

- **Endpoint**: `POST /product`
- **Description**: Creates a new product
- **Authentication**: Required (Admin only)
- **Request Body**:
  ```json
  {
    "product": {
      "productTitle": "Silver Ring",
      "productSlug": "silver-ring",
      "description": "Beautiful silver ring",
      "skuNo": "SR001",
      "category": "categoryId",
      "price": 2999,
      "salePrice": 2499,
      "silverWeight": 10.5,
      "isDynamicPricing": true,
      "laborPercentage": 20,
      "gst": 3,
      "displayImage": [
        {
          "url": "image-url",
          "public_id": "cloudinary-public-id"
        }
      ]
    }
  }
  ```

### Get All Products

- **Endpoint**: `GET /product/all`
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `search`: Search by product title
  - `categoryId`: Filter by category
- **Success Response** (200):
  ```json
  {
    "success": true,
    "products": [...],
    "totalPage": 5,
    "currentPage": 1,
    "limit": 10
  }
  ```

### Get Single Product

- **Endpoint**: `GET /product/:productId`
- **URL Parameters**: 
  - `productId`: ID of the product
- **Success Response** (200):
  ```json
  {
    "success": true,
    "product": {
      // product details
    },
    "variants": [...],
    "images": [...]
  }
  ```

### Update Product

- **Endpoint**: `POST /product/:productId`
- **Authentication**: Required (Admin only)
- **URL Parameters**:
  - `productId`: ID of the product to update
- **Request Body**: Same as Add Product

### Delete Product

- **Endpoint**: `DELETE /product/:productId`
- **Authentication**: Required (Admin only)
- **URL Parameters**:
  - `productId`: ID of the product to delete

### Update Featured Status

- **Endpoint**: `PUT /product/featured/:productId`
- **Authentication**: Required (Admin only)
- **Request Body**:
  ```json
  {
    "isFeatured": true
  }
  ```

### Get Featured Products

- **Endpoint**: `GET /product/featured`
- **Description**: Returns up to 8 random featured products

---

## 3. Product Variants

### Add Variant

- **Endpoint**: `POST /product-variant`
- **Authentication**: Required (Admin only)
- **Request Body**:
  ```json
  {
    "productId": "product-id",
    "size": "M",
    "price": 2999,
    "salePrice": 2499,
    "stock": 10,
    "color": "color-id",
    "imageUrls": [...]
  }
  ```

### Get Product Variants

- **Endpoint**: `GET /product-variant/:productId`
- **URL Parameters**:
  - `productId`: ID of the product

---

## 4. Categories

### Add Category

- **Endpoint**: `POST /product-category`
- **Authentication**: Required (Admin only)
- **Request Body**:
  ```json
  {
    "type": "Jewelry",
    "name": "Rings",
    "slug": "rings",
    "imageUrl": "image-url",
    "parentId": "parentCategoryId"  // Optional - set to null or omit for top-level categories
  }
  ```
- **Note**: If a category has no parent (top-level category), you should either omit the `parentId` field, set it to `null`, or send an empty string.

### Get All Categories

- **Endpoint**: `GET /product-category/all`

---

## 5. Orders

### Get All Orders

- **Endpoint**: `GET /order/all`
- **Authentication**: Required (Admin only)
- **Query Parameters**:
  - `page`: Page number
  - `limit`: Items per page

### Update Order Status

- **Endpoint**: `PUT /order/status/:orderId`
- **Authentication**: Required (Admin only)
- **Request Body**:
  ```json
  {
    "status": "SHIPPED"
  }
  ```

---

## 6. Dynamic Pricing

### Update Product Pricing

- **Endpoint**: `POST /product/:productId/update-pricing`
- **Authentication**: Required (Admin only)
- **Description**: Updates the price of a product based on current silver rate and labor costs
- **Response**:
  ```json
  {
    "success": true,
    "product": {
      // Updated product with new pricing
    },
    "priceCalculation": {
      "breakdown": {
        "silverCost": 2800,
        "laborCost": 560,
        "gst": 100.8
      },
      "finalPrice": 3460.8
    }
  }
  ```

### Bulk Update All Product Prices

- **Endpoint**: `POST /product/bulk-update-pricing`
- **Authentication**: Required (Admin only)
- **Description**: Updates prices for all products with dynamic pricing enabled
- **Response**:
  ```json
  {
    "success": true,
    "updatedCount": 150,
    "errors": []
  }
  ```

---

## 7. Inventory Management

### Get Low Stock Items

- **Endpoint**: `GET /admin/inventory/low-stock`
- **Description**: Retrieves a list of product variants that are below the stock threshold
- **Authentication**: Required (Admin only)
- **Success Response** (200):
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "_id": "inventoryId",
          "product": {
            "_id": "productId",
            "productTitle": "Silver Ring",
            "skuNo": "SR001"
          },
          "variant": {
            "_id": "variantId",
            "varientName": "Small"
          },
          "availableStock": 5
        }
      ],
      "count": 1,
      "message": "Low stock items retrieved successfully"
    }
  }
  ```
  
> ⚠️ **IMPORTANT**: Do NOT use `/product/low-stock` as this will cause an error. The correct endpoint is `/admin/inventory/low-stock`.
>
> **Why?** If you use `/product/low-stock`, the backend interprets "low-stock" as a product ID and tries to find a product with `_id = "low-stock"`. Since this is not a valid MongoDB ObjectId, you will get a CastError. Always use `/admin/inventory/low-stock` for low stock queries.

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP Status Codes:
- `400`: Bad Request (Invalid input)
- `401`: Unauthorized (Not logged in)
- `403`: Forbidden (Not enough permissions)
- `404`: Not Found
- `500`: Internal Server Error

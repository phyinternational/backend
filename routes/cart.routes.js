const express = require("express");
const router = express.Router();
const cart_controller = require("../controllers/cart.controller");
const wishlistController = require("../controllers/wishlist.controller");
const {
  requireUserLogin,
  requireAdminLogin,
} = require("../middlewares/requireLogin");
const validate = require("../validation/validate");
const { upsertCartSchema, postCartItem, deleteCartItem } = require("../validation/user-cart");
router.get("/user/cart", requireUserLogin, cart_controller.getCartDetails_get);
router.get(
  "/admin/user/cart/:userId",
  requireAdminLogin,
  cart_controller.getCartDetailsByUser
);
router.put(
  "/user/cart/",
  requireUserLogin,
  validate(upsertCartSchema),
  cart_controller.upsertCart
);

router.post(
  "/user/cart/",
  requireUserLogin,
  validate(postCartItem),
  cart_controller.addProduct
);

router.put(
  "/user/cart/update",
  requireUserLogin,
  validate(postCartItem),
  cart_controller.updateProduct
);

router.post(
  "/user/cart/remove",
  requireUserLogin,
  validate(deleteCartItem),
  cart_controller.removeFromCart
);

router.post(
  "/user/wishlist/",
  requireUserLogin,
  wishlistController.addtoWishlist
);

router.delete(
  "/user/wishlist/:productId",
  requireUserLogin,
  wishlistController.removeFromWishlist
);

router.get(
  "/user/wishlist/",
  requireUserLogin,
  wishlistController.getWishlistByUser
);

module.exports = router;

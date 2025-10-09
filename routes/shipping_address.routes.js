// const express = require("express");
// const router = express.Router();
// const shippingAddressController = require("../controllers/shipping_address.controller");
// const { requireUserLogin } = require("../middlewares/requireLogin");
// const validate = require("../validation/validate");
// const { addShippingAddressSchema, updateShippingAddressSchema } = require("../validation/shipping_address");

// router.post(
//   "/address/add",
//   requireUserLogin,
//   validate(addShippingAddressSchema),
//   shippingAddressController.addShippingAddress
// );

// router.put(
//   "/address/update/:addressId",
//   requireUserLogin,
//   validate(updateShippingAddressSchema),
//   shippingAddressController.updateShippingAddress
// );

// router.get("/address", requireUserLogin, shippingAddressController.getUserShippingAddresses);

// router.delete("/address/delete/:addressId", requireUserLogin, shippingAddressController.deleteShippingAddress);

// module.exports = router;

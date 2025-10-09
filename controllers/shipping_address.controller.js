// const mongoose = require('mongoose');
// const ShippingAddress = require('../models/shipping_address.model');
// const {
//   errorRes,
//   successRes,
//   internalServerError,
// } = require('../utility');
// const catchAsync = require('../utility/catch-async');
// const ObjectId = mongoose.Types.ObjectId;
// const User = mongoose.model('User');
// module.exports.addShippingAddress = catchAsync(async (req, res) => {
//     try {
//         const user = await User.findById(req.user._id);
//         if (!user) {
//             return errorRes(res, 404, 'User not found.');
//         }
//         if (user._id.toString() !== req.user._id.toString()) {
//             return errorRes(res, 403, 'You are not authorized to add address for this user.');
//         }
//         const { firstName, lastName, phone, addressLine1, addressLine2, city, state, postalCode, country } = req.body;
//         const newShippingAddress = new ShippingAddress({
//             userId: req.user._id,
//             firstName,
//             lastName,
//             phone,
//             addressLine1,
//             addressLine2,
//             city,
//             state,
//             postalCode,
//             country
//         });
//         await newShippingAddress.save();
//         successRes(res, newShippingAddress);
//     } catch (error) {
//         internalServerError(res, error);
//     }
// });
// module.exports.updateShippingAddress = catchAsync(async (req, res) => {
//     try {
//         const { id } = req.user._id;
//         if (!ObjectId.isValid(id)) {
//             return errorRes(res, 400, 'Invalid address ID.');
//         }
//         if (id !== req.user._id.toString()) {
//             return errorRes(res, 403, 'You are not authorized to update this address.');
//         }
//         const shippingAddressId = req.params.addressId;
//         const shippingAddress = await ShippingAddress.findById(shippingAddressId);
//         if (!shippingAddress) {
//             return errorRes(res, 404, 'Shipping address not found.');
//         }
        
//         const updates = req.body;
//         Object.keys(updates).forEach((key) => {
//             shippingAddress[key] = updates[key];
//         });
//         await shippingAddress.save();
//         successRes(res, shippingAddress);
//     } catch (error) {
//         internalServerError(res, error);
//     }
// });

// module.exports.getUserShippingAddresses = catchAsync(async (req, res) => {
//     try {
//         const { userId } = req.user._id;
//         if (!ObjectId.isValid(userId)) {
//             return errorRes(res, 400, 'Invalid user ID.');
//         }
//         if (userId !== req.user._id.toString()) {
//             return errorRes(res, 403, 'You are not authorized to view these addresses.');
//         }
//         const shippingAddresses = await ShippingAddress.find({ userId });
//         successRes(res, shippingAddresses);
//     } catch (error) {
//         internalServerError(res, error);
//     }
// });

// module.exports.deleteShippingAddress = catchAsync(async (req, res) => {
//     try {
//         const { id } = req.user._id;
//         if (!ObjectId.isValid(id)) {
//             return errorRes(res, 400, 'Invalid user ID.');
//         }
//         if (id !== req.user._id.toString()) {
//             return errorRes(res, 403, 'You are not authorized to delete this address.');
//         }
//         const { addressId } = req.params;
//         if (!ObjectId.isValid(addressId)) {
//             return errorRes(res, 400, 'Invalid address ID.');
//         }

//         const shippingAddress = await ShippingAddress.findById(addressId);
//         if (!shippingAddress) {
//             return errorRes(res, 404, 'Shipping address not found.');
//         }
//         if (shippingAddress.userId.toString() !== req.user._id.toString()) {
//             return errorRes(res, 403, 'You are not authorized to delete this address.');
//         }
//         await ShippingAddress.findByIdAndDelete(addressId);
//         successRes(res, { message: 'Shipping address deleted successfully.' });
//     } catch (error) {
//         internalServerError(res, error);
//     }
// });
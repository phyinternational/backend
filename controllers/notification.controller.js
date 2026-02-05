const Notification = require("../models/notification.model");
const catchAsync = require("../utility/catch-async");
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");

exports.updateNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { $set: { status: "READ" } },
      { new: true }
    );

    if (!updatedNotification) {
      return next(new ErrorHandler("Notification does not exist", 404));
    }

    res.status(204).json();
  } catch (err) {
    console.log(`Error occurred while updating notification :: ${err}`);
    next(err);
  }
};

exports.getNotifications = catchAsync(async (req, res, next) => {
    const statusFilter = req.query.status || null;
     let filter = {};
    if (statusFilter) {
      const statusArray = statusFilter.split(",");
      filter.status = { $in: statusArray };
    }

    const notifications = await buildPaginatedSortedFilteredQuery(
      Notification.find(filter).populate('userId orderId adminId'),
      req,
      Notification
    );

    res.status(200).json({
      message: "success",
      data: {
        notifications,
        page: notifications.page,
        limit: notifications.limit,
        total: notifications.total,
      },
    });
  
});

exports.createNotification = async (data) => {
  try {
    const notification = new Notification(data);
    await notification.save();
    return notification;
  } catch (err) {
    console.log(`Error occurred while creating notification :: ${err}`);
  }
};

exports.addProductUpdateNotification = catchAsync(async (userId, orderId) => {
  const notification = new Notification({
    userId,
    orderId,
    type: 'ORDER_UPDATE',
    title: 'Order Updated',
    text: `Order #${orderId} has been updated by the user`,
  });
  await notification.save();

  return notification;
});

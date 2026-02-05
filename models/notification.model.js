const mongoose = require('mongoose')

const notificationSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User_Order'
  },
  title: {
    type: String
  },
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['NEW_ORDER', 'CANCELLATION', 'RETURN_REQUEST', 'REPLACEMENT_REQUEST', 'ORDER_UPDATE'],
    default: 'ORDER_UPDATE'
  },
  status: {
    type: String,
    enum: ['READ', 'UNREAD'],
    default: 'UNREAD'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
})

notificationSchema.pre('findOneAndUpdate', async function (next) {
  this.set({ updatedAt: new Date() })
  next()
})

const Notification = mongoose.model('Notification', notificationSchema)

module.exports = Notification

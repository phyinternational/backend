const mongoose = require('mongoose')

const notificationSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'userId is required'],
    ref: 'Company'
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'orderId is required'],
    ref: 'Order'
  },
  text: {
    type: String
  },
  status: {
    type: String,
    enum: ['READ', 'UNREAD'],
    default: 'UNREAD'
  },
  createdAt: {
    type: Date,
    default: Date.now()
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

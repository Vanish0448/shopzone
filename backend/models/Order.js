const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

    orderNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 60
    },

    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null
    },

    customerName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    customerEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 254
    },

    customerPhone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30
    },

    deliveryAddress: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },

    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: false
            },

            name: {
                type: String,
                required: true,
                trim: true,
                maxlength: 150
            },

            price: {
                type: Number,
                required: true,
                min: 0
            },

            quantity: {
                type: Number,
                required: true,
                min: 1
            }
        }
    ],

    subtotal: {
        type: Number,
        min: 0,
        default: 0
    },

    couponCode: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 50,
        default: ""
    },

    discountType: {
        type: String,
        enum: ["percentage", "fixed", ""],
        default: ""
    },

    discountAmount: {
        type: Number,
        min: 0,
        default: 0
    },

    total: {
        type: Number,
        required: true,
        min: 0
    },

    status: {
        type: String,
        enum: [
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ],
        default: "Pending"
    },

    paymentStatus: {
        type: String,
        enum: [
            "Pending",
            "Successful",
            "Failed"
        ],
        default: "Pending"
    },

    paymentMethod: {
        type: String,
        default: "Paystack",
        trim: true
    },

    stockRestored: {
        type: Boolean,
        default: false
    },

    date: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
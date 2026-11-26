const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({

    reference: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 100
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
                required: true
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
        required: true,
        min: 0
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

    amountKobo: {
        type: Number,
        required: true,
        min: 1
    },

    currency: {
        type: String,
        default: "NGN",
        uppercase: true
    },

    status: {
        type: String,
        enum: [
            "Pending",
            "Successful",
            "Failed"
        ],
        default: "Pending"
    },

    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        default: null
    },

    verifiedAt: {
        type: Date,
        default: null
    },

    failureReason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ""
    }

}, {
    timestamps: true
});

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
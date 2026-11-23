const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({

    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    discountType: {
        type: String,
        required: true,
        enum: ["percentage", "fixed"]
    },

    discountValue: {
        type: Number,
        required: true,
        min: 0
    },

    minimumOrderAmount: {
        type: Number,
        default: 0,
        min: 0
    },

    maximumDiscountAmount: {
        type: Number,
        default: null,
        min: 0
    },

    usageLimit: {
        type: Number,
        default: null,
        min: 1
    },

    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },

    expiryDate: {
        type: Date,
        default: null
    },

    isActive: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

// Ensure percentage discounts do not exceed 100%
couponSchema.pre("validate", function () {
    if (
        this.discountType === "percentage" &&
        this.discountValue > 100
    ) {
        this.invalidate(
            "discountValue",
            "Percentage discount cannot exceed 100%"
        );
    }
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
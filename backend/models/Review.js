const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        customerName: {
            type: String,
            required: true,
            trim: true
        },

        customerEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },

        comment: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        },

        verifiedPurchase: {
            type: Boolean,
            default: false
        },

        // REVIEW MODERATION STATUS
        moderationStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },

        // DATE REVIEW WAS MODERATED
        moderatedAt: {
            type: Date,
            default: null
        },

        // OPTIONAL ADMIN MODERATION NOTE
        moderationNote: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

// Prevent the same customer from reviewing a product twice.
reviewSchema.index(
    { product: 1, customerEmail: 1 },
    { unique: true }
);

// Improve review moderation queries.
reviewSchema.index({
    moderationStatus: 1,
    createdAt: -1
});

module.exports = mongoose.model("Review", reviewSchema);
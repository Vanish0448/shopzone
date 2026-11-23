const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        category: {
            type: String,
            required: true,
            trim: true
        },

        image: {
            type: String,
            default: "https://placehold.co/300x200?text=Product"
        },

        description: {
            type: String,
            default: ""
        },

        stock: {
            type: Number,
            default: 0,
            min: 0
        },

        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },

        numReviews: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Product", productSchema);
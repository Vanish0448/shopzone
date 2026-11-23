const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        productName: {
            type: String,
            required: true
        },

        movementType: {
            type: String,
            enum: [
                "RESTOCK",
                "SALE",
                "CANCELLATION_RESTOCK",
                "STOCK_ADJUSTMENT"
            ],
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        previousStock: {
            type: Number,
            required: true,
            min: 0
        },

        newStock: {
            type: Number,
            required: true,
            min: 0
        },

        orderNumber: {
            type: String,
            default: null
        },

        description: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "StockMovement",
    stockMovementSchema
);
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 254
    },

    phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30
    },

    password: {
        type: String,
        required: true,
        select: false
    }

}, {
    timestamps: true
});

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
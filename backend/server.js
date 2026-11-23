const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dns = require("node:dns");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

require("dotenv").config();

// =====================================
// DNS CONFIGURATION FOR MONGODB ATLAS
// =====================================

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();

// =====================================
// SECURITY HEADERS
// =====================================

app.use(helmet());

// =====================================
// CORS CONFIGURATION
// =====================================

const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    ...(process.env.FRONTEND_URL || "")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean)
];

app.use(cors({
    origin: (origin, callback) => {

        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Access denied by CORS policy."));
    },

    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE"
    ],

    allowedHeaders: [
        "Content-Type",
        "Authorization"
    ]
}));

// =====================================
// REQUEST BODY LIMIT
// =====================================

app.use(express.json({
    limit: "1mb"
}));

// =====================================
// ORDER TRACKING RATE LIMITER
// =====================================

const trackingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many order tracking attempts. Please try again after 15 minutes."
    }
});

app.use("/api/orders/track", trackingLimiter);

// =====================================
// IMPORT ROUTES
// =====================================

const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/productRoutes");
const stockMovementRoutes = require("./routes/stockMovementRoutes");
const couponRoutes = require("./routes/couponRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const imageRoutes = require("./routes/imageRoutes");

// =====================================
// WELCOME ROUTE
// =====================================

app.get("/", (req, res) => {
    res.send("Welcome to the ShopZone Backend API!");
});

// =====================================
// API ROUTES
// =====================================

app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/stock-movements", stockMovementRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/images", imageRoutes);

// =====================================
// SERVER CONFIGURATION
// =====================================

const PORT = process.env.PORT || 5000;

// =====================================
// CONNECT TO MONGODB
// =====================================

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {

        console.log("MongoDB connected successfully!");

        app.listen(PORT, () => {
            console.log(`ShopZone server is running on port ${PORT}`);
        });

    })
    .catch((error) => {

        console.error("MongoDB connection failed:");
        console.error(error.message);

        process.exit(1);
    });
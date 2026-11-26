const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dns = require("node:dns");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

require("dotenv").config();

// =====================================
// DNS CONFIGURATION
// =====================================

dns.setServers(["1.1.1.1", "8.8.8.8"]);

// =====================================
// IMPORT ROUTES
// =====================================

const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const customerRoutes = require("./routes/customerRoutes");
const productRoutes = require("./routes/productRoutes");
const stockMovementRoutes = require("./routes/stockMovementRoutes");
const couponRoutes = require("./routes/couponRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const imageRoutes = require("./routes/imageRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

// =====================================
// INITIALIZE EXPRESS
// =====================================

const app = express();

// =====================================
// SECURITY MIDDLEWARE
// =====================================

app.use(helmet());

// =====================================
// CORS CONFIGURATION
// =====================================

const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    ...(process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(",")
            .map(origin => origin.trim())
            .filter(Boolean)
        : [])
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],

    allowedHeaders: ["Content-Type", "Authorization"]
}));

// =====================================
// BODY PARSER
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
// PAYMENT RATE LIMITER
// =====================================

const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many payment attempts. Please try again later."
    }
});

// =====================================
// PAYMENT ROUTES
// =====================================

app.use("/api/payments", paymentLimiter);
app.use("/api/payments", paymentRoutes);

// =====================================
// PREVENT DIRECT UNPAID ORDERS
// =====================================

app.post("/api/orders", (req, res) => {
    return res.status(410).json({
        success: false,
        message: "Direct order creation is disabled. Please complete payment through checkout."
    });
});

// =====================================
// APPLICATION ROUTES
// =====================================

app.use("/api/orders", orderRoutes);

app.use("/api/admin", adminRoutes);

// CUSTOMER REGISTRATION AND LOGIN
app.use("/api/customers", customerRoutes);

app.use("/api/products", productRoutes);

app.use("/api/stock-movements", stockMovementRoutes);

app.use("/api/coupons", couponRoutes);

app.use("/api/reviews", reviewRoutes);

app.use("/api/images", imageRoutes);

// =====================================
// WELCOME ROUTE
// =====================================

app.get("/", (req, res) => {
    res.send("Welcome to the ShopZone Backend API!");
});

// =====================================
// SERVER CONFIGURATION
// =====================================

const PORT = process.env.PORT || 5000;

// =====================================
// CONNECT TO MONGODB AND START SERVER
// =====================================

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("Connected to MongoDB successfully!");

        app.listen(PORT, () => {
            console.log(`ShopZone server running on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error("MongoDB connection failed:");
        console.error(error.message);

        process.exit(1);
    });
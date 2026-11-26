const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const Customer = require("../models/Customer");
const protectCustomer = require("../middleware/customerAuth");

const router = express.Router();

// =====================================
// REGISTRATION RATE LIMITER
// =====================================

const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many registration attempts. Please try again later."
    }
});

// =====================================
// LOGIN RATE LIMITER
// =====================================

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many login attempts. Please try again after 15 minutes."
    }
});

// =====================================
// CUSTOMER REGISTRATION
// =====================================

router.post("/register", registrationLimiter, async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name must contain between 2 and 100 characters."
            });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        if (cleanEmail.length > 254) {
            return res.status(400).json({
                success: false,
                message: "Email address is too long."
            });
        }

        if (cleanPhone.length < 7 || cleanPhone.length > 30) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid phone number."
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (password.length > 128) {
            return res.status(400).json({
                success: false,
                message: "Password is too long."
            });
        }

        const existingCustomer = await Customer.findOne({
            email: cleanEmail
        });

        if (existingCustomer) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const customer = await Customer.create({
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            password: hashedPassword
        });

        const token = jwt.sign(
            {
                customerId: customer._id.toString(),
                email: customer.email,
                role: "customer"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.status(201).json({
            success: true,
            message: "Customer account created successfully!",
            token,
            customer: {
                id: customer._id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        console.error("Customer registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to create your account."
        });
    }
});

// =====================================
// CUSTOMER LOGIN
// =====================================

router.post("/login", loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const customer = await Customer.findOne({
            email: cleanEmail
        }).select("+password");

        if (!customer) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            customer.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Server authentication configuration error."
            });
        }

        const token = jwt.sign(
            {
                customerId: customer._id.toString(),
                email: customer.email,
                role: "customer"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            token,
            customer: {
                id: customer._id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone
            }
        });

    } catch (error) {
        console.error("Customer login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to complete customer login."
        });
    }
});

// =====================================
// GET LOGGED-IN CUSTOMER PROFILE
// =====================================

router.get("/me", protectCustomer, async (req, res) => {
    try {
        const customer = await Customer.findById(
            req.customer.customerId
        );

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer account not found."
            });
        }

        return res.status(200).json({
            success: true,
            customer: {
                id: customer._id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                createdAt: customer.createdAt
            }
        });

    } catch (error) {
        console.error("Customer profile error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve customer profile."
        });
    }
});

module.exports = router;
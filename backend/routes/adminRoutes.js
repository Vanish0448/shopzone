const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// =====================================
// ADMIN LOGIN RATE LIMITER
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
// ADMIN LOGIN
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

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        if (
            !adminEmail ||
            !adminPasswordHash ||
            !process.env.JWT_SECRET
        ) {
            return res.status(500).json({
                success: false,
                message: "Admin authentication is not configured."
            });
        }

        if (
            email.trim().toLowerCase() !==
            adminEmail.toLowerCase()
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            adminPasswordHash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            {
                email: adminEmail,
                role: "admin"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        return res.status(200).json({
            success: true,
            message: "Admin login successful!",
            token,
            admin: {
                email: adminEmail
            }
        });

    } catch (error) {
        console.error("Admin login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to complete admin login."
        });
    }
});

module.exports = router;
const jwt = require("jsonwebtoken");

const protectAdmin = (req, res, next) => {
    try {
        // Check server security configuration
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is missing from environment variables.");

            return res.status(500).json({
                success: false,
                message: "Server authentication configuration error."
            });
        }

        // Get authorization header
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                success: false,
                message: "Access denied. Please log in."
            });
        }

        // Extract token
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access denied. Invalid authentication token."
            });
        }

        // Verify token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Confirm administrator role
        if (decoded.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required."
            });
        }

        // Attach administrator information
        req.admin = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired login session."
        });
    }
};

module.exports = protectAdmin;
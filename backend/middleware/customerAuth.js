const jwt = require("jsonwebtoken");

const protectCustomer = (req, res, next) => {
    try {
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Server authentication configuration error."
            });
        }

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Please log in to continue."
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token."
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decoded.role !== "customer" || !decoded.customerId) {
            return res.status(403).json({
                success: false,
                message: "Customer access required."
            });
        }

        req.customer = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Your login session is invalid or has expired."
        });
    }
};

module.exports = protectCustomer;
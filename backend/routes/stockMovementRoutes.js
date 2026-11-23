const express = require("express");
const router = express.Router();

const StockMovement = require("../models/StockMovement");
const protectAdmin = require("../middleware/authMiddleware");

// =====================================
// ADMIN: GET STOCK MOVEMENT HISTORY
// =====================================

router.get("/", protectAdmin, async (req, res) => {
    try {
        const movements = await StockMovement.find()
            .sort({ createdAt: -1 })
            .limit(200);

        res.status(200).json({
            success: true,
            count: movements.length,
            movements
        });

    } catch (error) {
        console.error(
            "Fetching stock movement history error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Unable to retrieve stock movement history."
        });
    }
});

module.exports = router;
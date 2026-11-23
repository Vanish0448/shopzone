const express = require("express");
const router = express.Router();

const Coupon = require("../models/Coupon");
const Order = require("../models/Order");
const protectAdmin = require("../middleware/authMiddleware");

// =====================================
// AUTOMATIC COUPON EXPIRY
// =====================================

async function deactivateExpiredCoupons() {
    try {
        const result = await Coupon.updateMany(
            {
                isActive: true,
                expiryDate: {
                    $ne: null,
                    $lte: new Date()
                }
            },
            {
                $set: {
                    isActive: false
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(
                `${result.modifiedCount} expired coupon(s) automatically deactivated.`
            );
        }

    } catch (error) {
        console.error(
            "Automatic coupon expiry error:",
            error.message
        );
    }
}

// Run once when this route loads.
deactivateExpiredCoupons();

// Check for expired coupons every 60 seconds.
const couponExpiryTimer = setInterval(() => {
    deactivateExpiredCoupons();
}, 60 * 1000);

// Allow the server to exit normally if this timer is the only active task.
if (typeof couponExpiryTimer.unref === "function") {
    couponExpiryTimer.unref();
}

// =====================================
// CUSTOMER: VALIDATE COUPON
// =====================================

router.post("/validate", async (req, res) => {
    try {
        await deactivateExpiredCoupons();

        const { code, subtotal } = req.body;

        if (!code || subtotal === undefined) {
            return res.status(400).json({
                success: false,
                message: "Please provide a coupon code and order subtotal."
            });
        }

        const orderSubtotal = Number(subtotal);

        if (!Number.isFinite(orderSubtotal) || orderSubtotal <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid order subtotal."
            });
        }

        const coupon = await Coupon.findOne({
            code: String(code).trim().toUpperCase()
        });

        if (!coupon || !coupon.isActive) {
            return res.status(404).json({
                success: false,
                message: "Invalid, inactive or expired coupon code."
            });
        }

        if (
            coupon.expiryDate &&
            new Date() >= new Date(coupon.expiryDate)
        ) {
            coupon.isActive = false;
            await coupon.save();

            return res.status(400).json({
                success: false,
                message: "This coupon has expired."
            });
        }

        if (
            coupon.usageLimit !== null &&
            coupon.usedCount >= coupon.usageLimit
        ) {
            return res.status(400).json({
                success: false,
                message: "This coupon has reached its usage limit."
            });
        }

        if (orderSubtotal < coupon.minimumOrderAmount) {
            return res.status(400).json({
                success: false,
                message: `Minimum order amount for this coupon is ₦${coupon.minimumOrderAmount.toLocaleString()}.`
            });
        }

        let discountAmount = 0;

        if (coupon.discountType === "percentage") {
            discountAmount =
                orderSubtotal * coupon.discountValue / 100;

            if (coupon.maximumDiscountAmount !== null) {
                discountAmount = Math.min(
                    discountAmount,
                    coupon.maximumDiscountAmount
                );
            }
        } else {
            discountAmount = coupon.discountValue;
        }

        discountAmount = Math.round(
            Math.min(discountAmount, orderSubtotal) * 100
        ) / 100;

        res.status(200).json({
            success: true,
            message: "Coupon applied successfully!",
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue
            },
            subtotal: orderSubtotal,
            discountAmount,
            total: Math.max(0, orderSubtotal - discountAmount)
        });

    } catch (error) {
        console.error("Coupon validation error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to validate coupon."
        });
    }
});


// =====================================
// ADMIN: COUPON USAGE ANALYTICS
// =====================================

router.get("/analytics", protectAdmin, async (req, res) => {
    try {
        await deactivateExpiredCoupons();

        const coupons = await Coupon.find().sort({
            createdAt: -1
        });

        const orders = await Order.find({
            couponCode: { $nin: ["", null] },
            status: { $ne: "Cancelled" }
        }).select(
            "couponCode discountAmount total subtotal status"
        );

        let totalDiscountsGiven = 0;
        let totalCouponUses = 0;

        const couponPerformance = coupons.map(coupon => {
            const couponOrders = orders.filter(order =>
                String(order.couponCode).toUpperCase() ===
                coupon.code.toUpperCase()
            );

            const totalUses = couponOrders.length;

            const totalDiscount = couponOrders.reduce(
                (sum, order) => sum + Number(order.discountAmount || 0),
                0
            );

            const revenueGenerated = couponOrders.reduce(
                (sum, order) => sum + Number(order.total || 0),
                0
            );

            totalCouponUses += totalUses;
            totalDiscountsGiven += totalDiscount;

            return {
                couponId: coupon._id,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                isActive: coupon.isActive,
                usageLimit: coupon.usageLimit,
                recordedUses: coupon.usedCount,
                actualUses: totalUses,
                totalDiscount: Math.round(totalDiscount * 100) / 100,
                revenueGenerated: Math.round(revenueGenerated * 100) / 100
            };
        });

        const mostUsedCoupon = [...couponPerformance].sort(
            (a, b) => b.actualUses - a.actualUses
        )[0];

        res.status(200).json({
            success: true,
            analytics: {
                totalCoupons: coupons.length,

                activeCoupons: coupons.filter(
                    coupon => coupon.isActive
                ).length,

                inactiveCoupons: coupons.filter(
                    coupon => !coupon.isActive
                ).length,

                totalCouponUses,

                totalDiscountsGiven:
                    Math.round(totalDiscountsGiven * 100) / 100,

                mostUsedCoupon: mostUsedCoupon &&
                    mostUsedCoupon.actualUses > 0
                    ? mostUsedCoupon.code
                    : "No coupon usage yet",

                couponPerformance
            }
        });

    } catch (error) {
        console.error("Coupon analytics error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve coupon analytics."
        });
    }
});


// =====================================
// ADMIN: GET ALL COUPONS
// =====================================

router.get("/", protectAdmin, async (req, res) => {
    try {
        await deactivateExpiredCoupons();

        const coupons = await Coupon.find().sort({
            createdAt: -1
        });

        res.status(200).json({
            success: true,
            count: coupons.length,
            coupons
        });

    } catch (error) {
        console.error("Fetching coupons error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve coupons."
        });
    }
});


// =====================================
// ADMIN: CREATE COUPON
// =====================================

router.post("/", protectAdmin, async (req, res) => {
    try {
        const {
            code,
            discountType,
            discountValue,
            minimumOrderAmount,
            maximumDiscountAmount,
            usageLimit,
            expiryDate
        } = req.body;

        if (
            !code ||
            !["percentage", "fixed"].includes(discountType) ||
            discountValue === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a coupon code, discount type and discount value."
            });
        }

        const coupon = new Coupon({
            code: String(code).trim().toUpperCase(),
            discountType,
            discountValue,
            minimumOrderAmount: minimumOrderAmount ?? 0,
            maximumDiscountAmount: maximumDiscountAmount ?? null,
            usageLimit: usageLimit ?? null,
            expiryDate: expiryDate || null
        });

        if (
            coupon.expiryDate &&
            new Date(coupon.expiryDate) <= new Date()
        ) {
            coupon.isActive = false;
        }

        await coupon.save();

        res.status(201).json({
            success: true,
            message: "Coupon created successfully!",
            coupon
        });

    } catch (error) {
        console.error("Creating coupon error:", error.message);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A coupon with this code already exists."
            });
        }

        res.status(400).json({
            success: false,
            message: error.message || "Unable to create coupon."
        });
    }
});


// =====================================
// ADMIN: EDIT COUPON
// =====================================

router.put("/:id", protectAdmin, async (req, res) => {
    try {
        const {
            code,
            discountType,
            discountValue,
            minimumOrderAmount,
            maximumDiscountAmount,
            usageLimit,
            expiryDate
        } = req.body;

        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found."
            });
        }

        if (code !== undefined) {
            if (!String(code).trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Coupon code cannot be empty."
                });
            }

            coupon.code = String(code).trim().toUpperCase();
        }

        if (discountType !== undefined) {
            if (!["percentage", "fixed"].includes(discountType)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid discount type."
                });
            }

            coupon.discountType = discountType;
        }

        if (discountValue !== undefined) {
            coupon.discountValue = discountValue;
        }

        if (minimumOrderAmount !== undefined) {
            coupon.minimumOrderAmount = minimumOrderAmount;
        }

        if (maximumDiscountAmount !== undefined) {
            coupon.maximumDiscountAmount =
                maximumDiscountAmount === "" ||
                maximumDiscountAmount === null
                    ? null
                    : maximumDiscountAmount;
        }

        if (usageLimit !== undefined) {
            coupon.usageLimit =
                usageLimit === "" || usageLimit === null
                    ? null
                    : usageLimit;
        }

        if (expiryDate !== undefined) {
            coupon.expiryDate = expiryDate || null;
        }

        if (
            coupon.expiryDate &&
            new Date(coupon.expiryDate) <= new Date()
        ) {
            coupon.isActive = false;
        }

        await coupon.save();

        res.status(200).json({
            success: true,
            message: "Coupon updated successfully.",
            coupon
        });

    } catch (error) {
        console.error("Editing coupon error:", error.message);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Another coupon already uses this code."
            });
        }

        res.status(400).json({
            success: false,
            message: error.message || "Unable to update coupon."
        });
    }
});


// =====================================
// ADMIN: ACTIVATE OR DEACTIVATE COUPON
// =====================================

router.patch("/:id/status", protectAdmin, async (req, res) => {
    try {
        const { isActive } = req.body;

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid coupon status."
            });
        }

        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found."
            });
        }

        if (
            isActive &&
            coupon.expiryDate &&
            new Date(coupon.expiryDate) <= new Date()
        ) {
            coupon.isActive = false;
            await coupon.save();

            return res.status(400).json({
                success: false,
                message: "An expired coupon cannot be activated."
            });
        }

        coupon.isActive = isActive;
        await coupon.save();

        res.status(200).json({
            success: true,
            message: isActive
                ? "Coupon activated successfully."
                : "Coupon deactivated successfully.",
            coupon
        });

    } catch (error) {
        console.error("Updating coupon error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to update coupon."
        });
    }
});


// =====================================
// ADMIN: DELETE COUPON
// =====================================

router.delete("/:id", protectAdmin, async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(
            req.params.id
        );

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found."
            });
        }

        res.status(200).json({
            success: true,
            message: "Coupon deleted successfully."
        });

    } catch (error) {
        console.error("Deleting coupon error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to delete coupon."
        });
    }
});

module.exports = router;
const express = require("express");
const mongoose = require("mongoose");
const crypto = require("node:crypto");

const router = express.Router();

const Order = require("../models/Order");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const StockMovement = require("../models/StockMovement");
const protectAdmin = require("../middleware/authMiddleware");

// =====================================
// GENERATE SECURE ORDER NUMBER
// =====================================

function generateOrderNumber() {
    const timestamp = Date.now();
    const randomCode = crypto.randomBytes(6).toString("hex").toUpperCase();

    return `SZ-${timestamp}-${randomCode}`;
}


// =====================================
// ADMIN: GET ALL ORDERS
// =====================================

router.get("/", protectAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });

    } catch (error) {
        console.error("Fetching orders error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve orders."
        });
    }
});


// =====================================
// CUSTOMER: TRACK ORDER
// REQUIRES ORDER NUMBER AND EMAIL
// =====================================

router.post("/track", async (req, res) => {
    try {
        const { orderNumber, customerEmail } = req.body;

        if (!orderNumber || !customerEmail) {
            return res.status(400).json({
                success: false,
                message: "Please enter your order number and email address."
            });
        }

        const order = await Order.findOne({
            orderNumber: String(orderNumber).trim(),
            customerEmail: String(customerEmail).trim().toLowerCase()
        }).select(
            "orderNumber customerName customerEmail items subtotal couponCode discountType discountAmount total status date createdAt updatedAt"
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "No order was found with those details. Please check your order number and email address."
            });
        }

        res.status(200).json({
            success: true,
            message: "Order found successfully.",
            order
        });

    } catch (error) {
        console.error("Customer order tracking error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to track your order. Please try again."
        });
    }
});


// =====================================
// ADMIN: UPDATE ORDER STATUS
// INCLUDING AUTOMATIC STOCK RESTORATION
// =====================================

router.patch("/:orderNumber/status", protectAdmin, async (req, res) => {
    let session;

    try {
        const { status } = req.body;

        const allowedStatuses = [
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status."
            });
        }

        session = await mongoose.startSession();

        let updatedOrder;

        await session.withTransaction(async () => {

            const order = await Order.findOne({
                orderNumber: req.params.orderNumber
            }).session(session);

            if (!order) {
                const error = new Error("ORDER_NOT_FOUND");
                error.code = "ORDER_NOT_FOUND";
                throw error;
            }

            if (order.status === "Cancelled") {
                const error = new Error("ORDER_ALREADY_CANCELLED");
                error.code = "ORDER_ALREADY_CANCELLED";
                throw error;
            }

            // CANCEL ORDER AND RESTORE STOCK

            if (status === "Cancelled") {

                if (
                    order.status === "Shipped" ||
                    order.status === "Delivered"
                ) {
                    const error = new Error("ORDER_CANNOT_BE_CANCELLED");
                    error.code = "ORDER_CANNOT_BE_CANCELLED";
                    throw error;
                }

                if (order.stockRestored) {
                    const error = new Error("STOCK_ALREADY_RESTORED");
                    error.code = "STOCK_ALREADY_RESTORED";
                    throw error;
                }

                for (const item of order.items) {

                    if (
                        !item.productId ||
                        !mongoose.isValidObjectId(item.productId)
                    ) {
                        const error = new Error("PRODUCT_REFERENCE_MISSING");
                        error.code = "PRODUCT_REFERENCE_MISSING";
                        throw error;
                    }

                    if (
                        !Number.isInteger(item.quantity) ||
                        item.quantity < 1
                    ) {
                        const error = new Error("INVALID_ORDER_QUANTITY");
                        error.code = "INVALID_ORDER_QUANTITY";
                        throw error;
                    }
                }

                // RESTORE STOCK AND RECORD MOVEMENTS

                for (const item of order.items) {

                    const updatedProduct = await Product.findOneAndUpdate(
                        { _id: item.productId },
                        {
                            $inc: {
                                stock: item.quantity
                            }
                        },
                        {
                            returnDocument: "after",
                            session
                        }
                    );

                    if (!updatedProduct) {
                        const error = new Error("PRODUCT_NOT_FOUND");
                        error.code = "PRODUCT_NOT_FOUND";
                        throw error;
                    }

                    const previousStock =
                        updatedProduct.stock - item.quantity;

                    await StockMovement.create(
                        [{
                            product: updatedProduct._id,
                            productName: updatedProduct.name,
                            movementType: "CANCELLATION_RESTOCK",
                            quantity: item.quantity,
                            previousStock,
                            newStock: updatedProduct.stock,
                            orderNumber: order.orderNumber,
                            description:
                                `Stock restored after cancellation of order ${order.orderNumber}.`
                        }],
                        {
                            session,
                            ordered: true
                        }
                    );
                }

                order.status = "Cancelled";
                order.stockRestored = true;

                await order.save({ session });

            } else {

                order.status = status;

                await order.save({ session });
            }

            updatedOrder = order;
        });

        res.status(200).json({
            success: true,
            message: status === "Cancelled"
                ? "Order cancelled successfully! Product stock has been restored."
                : "Order status updated successfully!",
            order: updatedOrder
        });

    } catch (error) {
        console.error("Updating order status error:", error.message);

        if (error.code === "ORDER_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        if (error.code === "ORDER_ALREADY_CANCELLED") {
            return res.status(400).json({
                success: false,
                message: "This order has already been cancelled."
            });
        }

        if (error.code === "ORDER_CANNOT_BE_CANCELLED") {
            return res.status(400).json({
                success: false,
                message: "Shipped or delivered orders cannot be cancelled."
            });
        }

        if (error.code === "STOCK_ALREADY_RESTORED") {
            return res.status(400).json({
                success: false,
                message: "Stock has already been restored for this order."
            });
        }

        if (error.code === "PRODUCT_REFERENCE_MISSING") {
            return res.status(400).json({
                success: false,
                message: "Stock cannot be restored because this order has a missing product reference."
            });
        }

        if (error.code === "INVALID_ORDER_QUANTITY") {
            return res.status(400).json({
                success: false,
                message: "Stock cannot be restored because an order quantity is invalid."
            });
        }

        if (error.code === "PRODUCT_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Stock could not be restored because a product no longer exists."
            });
        }

        res.status(500).json({
            success: false,
            message: "Unable to update order status."
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
});


// =====================================
// ADMIN: GET ONE ORDER
// =====================================

router.get("/:orderNumber", protectAdmin, async (req, res) => {
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        console.error("Fetching order error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve order."
        });
    }
});// =====================================
// CUSTOMER: CREATE ORDER
// WITH SECURE COUPON PROCESSING
// STOCK DEDUCTION AND HISTORY
// =====================================

router.post("/", async (req, res) => {
    let session;

    try {
        const {
            customerName,
            customerEmail,
            customerPhone,
            deliveryAddress,
            items,
            couponCode
        } = req.body;

        if (
            !customerName ||
            !customerEmail ||
            !customerPhone ||
            !deliveryAddress
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all customer information."
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Your order must contain at least one product."
            });
        }

        const quantities = new Map();

        for (const item of items) {

            if (
                !item.productId ||
                !mongoose.isValidObjectId(item.productId) ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "One or more order items are invalid."
                });
            }

            const productId = String(item.productId);

            quantities.set(
                productId,
                (quantities.get(productId) || 0) + item.quantity
            );
        }

        const normalizedCouponCode = couponCode
            ? String(couponCode).trim().toUpperCase()
            : "";

        // The backend generates the order number.
        // Any order number supplied by the customer is ignored.

        const finalOrderNumber = generateOrderNumber();

        session = await mongoose.startSession();

        let savedOrder;

        await session.withTransaction(async () => {

            const productIds = [...quantities.keys()];

            const products = await Product.find({
                _id: { $in: productIds }
            }).session(session);

            const productMap = new Map(
                products.map(product => [
                    String(product._id),
                    product
                ])
            );

            const orderItems = [];
            const stockMovements = [];

            let subtotal = 0;

            // =====================================
            // VALIDATE PRODUCTS AND CALCULATE SUBTOTAL
            // =====================================

            for (const [productId, quantity] of quantities) {

                const product = productMap.get(productId);

                if (!product) {
                    const error = new Error("PRODUCT_NOT_FOUND");
                    error.code = "PRODUCT_NOT_FOUND";
                    throw error;
                }

                if (product.stock < quantity) {
                    const error = new Error("INSUFFICIENT_STOCK");
                    error.code = "INSUFFICIENT_STOCK";
                    error.productName = product.name;
                    error.availableStock = product.stock;
                    throw error;
                }

                orderItems.push({
                    productId: product._id,
                    name: product.name,
                    price: product.price,
                    quantity
                });

                subtotal += product.price * quantity;
            }

            subtotal = Math.round(
                (subtotal + Number.EPSILON) * 100
            ) / 100;

            // =====================================
            // VALIDATE AND APPLY COUPON
            // =====================================

            let appliedCoupon = null;
            let discountAmount = 0;
            let discountType = "";

            if (normalizedCouponCode) {

                const coupon = await Coupon.findOne({
                    code: normalizedCouponCode
                }).session(session);

                if (!coupon) {
                    const error = new Error("COUPON_NOT_FOUND");
                    error.code = "COUPON_NOT_FOUND";
                    throw error;
                }

                if (!coupon.isActive) {
                    const error = new Error("COUPON_INACTIVE");
                    error.code = "COUPON_INACTIVE";
                    throw error;
                }

                if (
                    coupon.expiryDate &&
                    new Date(coupon.expiryDate) <= new Date()
                ) {
                    const error = new Error("COUPON_EXPIRED");
                    error.code = "COUPON_EXPIRED";
                    throw error;
                }

                if (
                    coupon.usageLimit !== null &&
                    coupon.usageLimit !== undefined &&
                    coupon.usedCount >= coupon.usageLimit
                ) {
                    const error = new Error("COUPON_USAGE_LIMIT");
                    error.code = "COUPON_USAGE_LIMIT";
                    throw error;
                }

                if (subtotal < coupon.minimumOrderAmount) {
                    const error = new Error("COUPON_MINIMUM_NOT_MET");
                    error.code = "COUPON_MINIMUM_NOT_MET";
                    error.minimumOrderAmount = coupon.minimumOrderAmount;
                    throw error;
                }

                if (
                    !Number.isFinite(coupon.discountValue) ||
                    coupon.discountValue <= 0
                ) {
                    const error = new Error("INVALID_COUPON_VALUE");
                    error.code = "INVALID_COUPON_VALUE";
                    throw error;
                }

                if (coupon.discountType === "percentage") {

                    if (coupon.discountValue > 100) {
                        const error = new Error("INVALID_COUPON_VALUE");
                        error.code = "INVALID_COUPON_VALUE";
                        throw error;
                    }

                    discountAmount =
                        subtotal * (coupon.discountValue / 100);

                } else if (coupon.discountType === "fixed") {

                    discountAmount = coupon.discountValue;

                } else {

                    const error = new Error("INVALID_COUPON_VALUE");
                    error.code = "INVALID_COUPON_VALUE";
                    throw error;
                }

                if (
                    coupon.maximumDiscountAmount !== null &&
                    coupon.maximumDiscountAmount !== undefined
                ) {
                    discountAmount = Math.min(
                        discountAmount,
                        coupon.maximumDiscountAmount
                    );
                }

                discountAmount = Math.round(
                    Math.min(discountAmount, subtotal) * 100
                ) / 100;

                discountType = coupon.discountType;

                // Atomically claim one coupon use.
                // The transaction rolls this back if order creation fails.

                const updatedCoupon = await Coupon.findOneAndUpdate(
                    {
                        _id: coupon._id,
                        isActive: true,
                        $or: [
                            { usageLimit: null },
                            {
                                $expr: {
                                    $lt: [
                                        "$usedCount",
                                        "$usageLimit"
                                    ]
                                }
                            }
                        ]
                    },
                    {
                        $inc: {
                            usedCount: 1
                        }
                    },
                    {
                        new: true,
                        session
                    }
                );

                if (!updatedCoupon) {

                    const error = new Error("COUPON_USAGE_LIMIT");
                    error.code = "COUPON_USAGE_LIMIT";

                    throw error;
                }

                appliedCoupon = updatedCoupon;
            }

            const total = Math.round(
                Math.max(0, subtotal - discountAmount) * 100
            ) / 100;

            // =====================================
            // DEDUCT STOCK AND PREPARE SALE RECORDS
            // =====================================

            for (const [productId, quantity] of quantities) {

                const product = productMap.get(productId);

                const previousStock = product.stock;
                const newStock = previousStock - quantity;

                const result = await Product.updateOne(
                    {
                        _id: productId,
                        stock: { $gte: quantity }
                    },
                    {
                        $inc: {
                            stock: -quantity
                        }
                    },
                    { session }
                );

                if (result.modifiedCount !== 1) {
                    const error = new Error("INSUFFICIENT_STOCK");
                    error.code = "INSUFFICIENT_STOCK";
                    error.productName = product.name;
                    error.availableStock = previousStock;
                    throw error;
                }

                stockMovements.push({
                    product: product._id,
                    productName: product.name,
                    movementType: "SALE",
                    quantity,
                    previousStock,
                    newStock,
                    orderNumber: finalOrderNumber,
                    description:
                        `${quantity} units deducted for order ${finalOrderNumber}.`
                });
            }

            // SAVE ALL SALE MOVEMENTS

            if (stockMovements.length > 0) {
                await StockMovement.create(
                    stockMovements,
                    {
                        session,
                        ordered: true
                    }
                );
            }

            // =====================================
            // CREATE ORDER WITH DISCOUNT DETAILS
            // =====================================

            const newOrder = new Order({
                orderNumber: finalOrderNumber,
                customerName,
                customerEmail: String(customerEmail).trim().toLowerCase(),
                customerPhone,
                deliveryAddress,
                items: orderItems,

                subtotal,
                couponCode: appliedCoupon
                    ? appliedCoupon.code
                    : "",
                discountType,
                discountAmount,
                total
            });

            const orders = await Order.create(
                [newOrder],
                {
                    session,
                    ordered: true
                }
            );

            savedOrder = orders[0];
        });

        res.status(201).json({
            success: true,
            message: "Order saved successfully! Product stock, coupon usage and stock movement history have been updated.",
            order: savedOrder
        });    } catch (error) {
        console.error("Order creation error:", error.message);

        if (error.code === "PRODUCT_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "One or more products could not be found."
            });
        }

        if (error.code === "INSUFFICIENT_STOCK") {
            return res.status(400).json({
                success: false,
                message: `Not enough stock for ${error.productName}. Available stock: ${error.availableStock ?? 0}.`
            });
        }

        if (error.code === "COUPON_NOT_FOUND") {
            return res.status(400).json({
                success: false,
                message: "This promo code does not exist."
            });
        }

        if (error.code === "COUPON_INACTIVE") {
            return res.status(400).json({
                success: false,
                message: "This promo code is currently inactive."
            });
        }

        if (error.code === "COUPON_EXPIRED") {
            return res.status(400).json({
                success: false,
                message: "This promo code has expired."
            });
        }

        if (error.code === "COUPON_USAGE_LIMIT") {
            return res.status(400).json({
                success: false,
                message: "This promo code has reached its usage limit."
            });
        }

        if (error.code === "COUPON_MINIMUM_NOT_MET") {
            return res.status(400).json({
                success: false,
                message: `Your order must be at least ₦${Number(error.minimumOrderAmount).toLocaleString()} to use this promo code.`
            });
        }

        if (error.code === "INVALID_COUPON_VALUE") {
            return res.status(400).json({
                success: false,
                message: "This promo code has an invalid discount configuration."
            });
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A duplicate order number was generated. Please try placing your order again."
            });
        }

        res.status(500).json({
            success: false,
            message: "Unable to save order."
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
});

module.exports = router;
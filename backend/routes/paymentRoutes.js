const express = require("express");
const mongoose = require("mongoose");
const crypto = require("node:crypto");

const router = express.Router();

const Payment = require("../models/Payment");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const StockMovement = require("../models/StockMovement");

// =====================================
// GENERATE SECURE REFERENCES
// =====================================

function generatePaymentReference() {
    return `SZPAY-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

function generateOrderNumber() {
    return `SZ-${Date.now()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

function roundMoney(amount) {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}


// =====================================
// PAYSTACK CONFIGURATION
// =====================================

function getPaystackSecretKey() {
    return process.env.PAYSTACK_SECRET_KEY || "";
}

async function paystackRequest(url, options = {}) {

    const secretKey = getPaystackSecretKey();

    if (!secretKey) {
        throw new Error("PAYSTACK_SECRET_KEY is not configured.");
    }

    const response = await fetch(url, {
        ...options,

        headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
        throw new Error(
            data.message || "Paystack request failed."
        );
    }

    return data;
}


// =====================================
// VALIDATE CUSTOMER INFORMATION
// =====================================

function validateCustomerDetails(body) {

    const {
        customerName,
        customerEmail,
        customerPhone,
        deliveryAddress
    } = body;

    if (
        typeof customerName !== "string" ||
        typeof customerEmail !== "string" ||
        typeof customerPhone !== "string" ||
        typeof deliveryAddress !== "string"
    ) {
        return "Please provide all customer information.";
    }

    if (
        !customerName.trim() ||
        !customerEmail.trim() ||
        !customerPhone.trim() ||
        !deliveryAddress.trim()
    ) {
        return "Please provide all customer information.";
    }

    if (customerName.trim().length > 100) {
        return "Customer name is too long.";
    }

    if (
        customerEmail.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
    ) {
        return "Please provide a valid email address.";
    }

    if (customerPhone.trim().length > 30) {
        return "Phone number is too long.";
    }

    if (deliveryAddress.trim().length > 500) {
        return "Delivery address is too long.";
    }

    return null;
}


// =====================================
// VALIDATE AND COLLECT CART ITEMS
// =====================================

function validateCartItems(items) {

    if (
        !Array.isArray(items) ||
        items.length === 0 ||
        items.length > 50
    ) {
        return {
            error: "Your order must contain valid products."
        };
    }

    const quantities = new Map();

    for (const item of items) {

        if (
            !item.productId ||
            !mongoose.isValidObjectId(item.productId) ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 99
        ) {
            return {
                error: "One or more order items are invalid."
            };
        }

        const productId = String(item.productId);

        const newQuantity =
            (quantities.get(productId) || 0) + item.quantity;

        if (newQuantity > 99) {
            return {
                error: "The quantity for a product cannot exceed 99."
            };
        }

        quantities.set(productId, newQuantity);
    }

    return {
        quantities
    };
}


// =====================================
// VALIDATE COUPON AND CALCULATE DISCOUNT
// =====================================

async function calculateCouponDiscount(
    couponCode,
    subtotal,
    session = null
) {

    let discountAmount = 0;
    let discountType = "";
    let appliedCoupon = null;

    if (!couponCode) {
        return {
            discountAmount,
            discountType,
            appliedCoupon
        };
    }

    const couponQuery = Coupon.findOne({
        code: couponCode
    });

    if (session) {
        couponQuery.session(session);
    }

    const coupon = await couponQuery;

    if (!coupon) {
        const error = new Error("This promo code does not exist.");
        error.code = "COUPON_NOT_FOUND";
        throw error;
    }

    if (!coupon.isActive) {
        const error = new Error("This promo code is currently inactive.");
        error.code = "COUPON_INACTIVE";
        throw error;
    }

    if (
        coupon.expiryDate &&
        new Date(coupon.expiryDate) <= new Date()
    ) {
        const error = new Error("This promo code has expired.");
        error.code = "COUPON_EXPIRED";
        throw error;
    }

    if (
        coupon.usageLimit !== null &&
        coupon.usageLimit !== undefined &&
        coupon.usedCount >= coupon.usageLimit
    ) {
        const error = new Error("This promo code has reached its usage limit.");
        error.code = "COUPON_USAGE_LIMIT";
        throw error;
    }

    if (subtotal < coupon.minimumOrderAmount) {
        const error = new Error(
            `Your order must be at least ₦${Number(coupon.minimumOrderAmount).toLocaleString()} to use this promo code.`
        );

        error.code = "COUPON_MINIMUM_NOT_MET";
        throw error;
    }

    if (
        !Number.isFinite(coupon.discountValue) ||
        coupon.discountValue <= 0
    ) {
        const error = new Error("Invalid coupon discount configuration.");
        error.code = "INVALID_COUPON_VALUE";
        throw error;
    }

    if (coupon.discountType === "percentage") {

        if (coupon.discountValue > 100) {
            const error = new Error("Invalid coupon discount configuration.");
            error.code = "INVALID_COUPON_VALUE";
            throw error;
        }

        discountAmount =
            subtotal * (coupon.discountValue / 100);

    } else if (coupon.discountType === "fixed") {

        discountAmount = coupon.discountValue;

    } else {

        const error = new Error("Invalid coupon discount configuration.");
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

    discountAmount = roundMoney(
        Math.min(discountAmount, subtotal)
    );

    discountType = coupon.discountType;
    appliedCoupon = coupon;

    return {
        discountAmount,
        discountType,
        appliedCoupon
    };
}


// =====================================
// INITIALIZE PAYSTACK PAYMENT
// POST /api/payments/initialize
// =====================================

router.post("/initialize", async (req, res) => {

    try {

        if (!getPaystackSecretKey()) {
            return res.status(503).json({
                success: false,
                message: "Payment service is not configured."
            });
        }

        // VALIDATE CUSTOMER DETAILS

        const customerError = validateCustomerDetails(req.body);

        if (customerError) {
            return res.status(400).json({
                success: false,
                message: customerError
            });
        }

        const {
            customerName,
            customerEmail,
            customerPhone,
            deliveryAddress,
            items,
            couponCode
        } = req.body;

        // VALIDATE CART

        const cartResult = validateCartItems(items);

        if (cartResult.error) {
            return res.status(400).json({
                success: false,
                message: cartResult.error
            });
        }

        const quantities = cartResult.quantities;

        // NORMALIZE COUPON CODE

        const normalizedCouponCode = couponCode
            ? String(couponCode).trim().toUpperCase()
            : "";

        if (normalizedCouponCode.length > 50) {
            return res.status(400).json({
                success: false,
                message: "Invalid coupon code."
            });
        }

        // FETCH REAL PRODUCT INFORMATION FROM MONGODB

        const productIds = [...quantities.keys()];

        const products = await Product.find({
            _id: {
                $in: productIds
            }
        });

        const productMap = new Map(
            products.map(product => [
                String(product._id),
                product
            ])
        );

        const orderItems = [];

        let subtotal = 0;

        for (const [productId, quantity] of quantities) {

            const product = productMap.get(productId);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "One or more products could not be found."
                });
            }

            if (product.stock < quantity) {
                return res.status(400).json({
                    success: false,
                    message:
                        `Not enough stock for ${product.name}. Available stock: ${product.stock}.`
                });
            }

            orderItems.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity
            });

            subtotal += product.price * quantity;
        }

        subtotal = roundMoney(subtotal);

        // CALCULATE DISCOUNT

        const couponResult = await calculateCouponDiscount(
            normalizedCouponCode,
            subtotal
        );

        const discountAmount = couponResult.discountAmount;
        const discountType = couponResult.discountType;

        const total = roundMoney(
            Math.max(0, subtotal - discountAmount)
        );

        // PAYSTACK USES KOBO

        const amountKobo = Math.round(total * 100);

        if (!Number.isSafeInteger(amountKobo) || amountKobo < 5000) {
            return res.status(400).json({
                success: false,
                message: "The minimum Paystack payment is ₦50."
            });
        }

        // GENERATE UNIQUE PAYMENT REFERENCE

        const reference = generatePaymentReference();

        // SAVE PENDING PAYMENT

        const payment = await Payment.create({

            reference,

            customerName: customerName.trim(),

            customerEmail: customerEmail.trim().toLowerCase(),

            customerPhone: customerPhone.trim(),

            deliveryAddress: deliveryAddress.trim(),

            items: orderItems,

            subtotal,

            couponCode: couponResult.appliedCoupon
                ? couponResult.appliedCoupon.code
                : "",

            discountType,

            discountAmount,

            total,

            amountKobo,

            currency: "NGN",

            status: "Pending"

        });

        // INITIALIZE TRANSACTION WITH PAYSTACK

        const frontendUrl = (
            process.env.FRONTEND_URL || ""
        ).split(",")[0].trim().replace(/\/+$/, "");

        const callbackUrl = frontendUrl
            ? `${frontendUrl}/?payment=callback`
            : undefined;

        const paystackData = await paystackRequest(
            "https://api.paystack.co/transaction/initialize",
            {
                method: "POST",

                body: JSON.stringify({

                    email: payment.customerEmail,

                    amount: amountKobo,

                    currency: "NGN",

                    reference,

                    ...(callbackUrl
                        ? { callback_url: callbackUrl }
                        : {}),

                    metadata: {
                        reference,
                        customer_name: payment.customerName
                    }

                })
            }
        );

        res.status(200).json({

            success: true,

            message: "Payment initialized successfully.",

            authorizationUrl: paystackData.data.authorization_url,

            reference: paystackData.data.reference

        });

    } catch (error) {

        console.error(
            "Payment initialization error:",
            error.message
        );

        if (error.code === "COUPON_NOT_FOUND") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === "COUPON_INACTIVE") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === "COUPON_EXPIRED") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === "COUPON_USAGE_LIMIT") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === "COUPON_MINIMUM_NOT_MET") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === "INVALID_COUPON_VALUE") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: "Unable to initialize payment. Please try again."
        });
    }
});


// =====================================
// VERIFY PAYSTACK PAYMENT
// POST /api/payments/verify
// =====================================

router.post("/verify", async (req, res) => {

    let session;

    try {

        if (!getPaystackSecretKey()) {
            return res.status(503).json({
                success: false,
                message: "Payment service is not configured."
            });
        }

        const reference = req.body.reference;

        if (
            typeof reference !== "string" ||
            !reference.trim() ||
            reference.length > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid payment reference is required."
            });
        }

        const normalizedReference = reference.trim();

        // FIND THE PAYMENT CREATED BY SHOPZONE

        const payment = await Payment.findOne({
            reference: normalizedReference
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment reference not found."
            });
        }

        // RETURN EXISTING ORDER IF ALREADY COMPLETED

        if (payment.status === "Successful" && payment.orderId) {

            const existingOrder = await Order.findById(
                payment.orderId
            );

            if (existingOrder) {
                return res.status(200).json({
                    success: true,
                    message: "Payment has already been verified.",
                    order: existingOrder
                });
            }
        }

        if (payment.status === "Failed") {
            return res.status(400).json({
                success: false,
                message: "This payment was marked as failed."
            });
        }

        // VERIFY DIRECTLY WITH PAYSTACK

        const verificationData = await paystackRequest(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(normalizedReference)}`,
            {
                method: "GET"
            }
        );

        const transaction = verificationData.data;

        // CHECK TRANSACTION REFERENCE

        if (transaction.reference !== payment.reference) {
            return res.status(400).json({
                success: false,
                message: "Payment reference verification failed."
            });
        }

        // CHECK PAYMENT STATUS

        if (transaction.status !== "success") {

            if (
                transaction.status === "failed" ||
                transaction.status === "abandoned"
            ) {
                await Payment.updateOne(
                    {
                        _id: payment._id,
                        status: "Pending"
                    },
                    {
                        $set: {
                            status: "Failed",
                            failureReason: "Paystack reported an unsuccessful transaction."
                        }
                    }
                );
            }

            return res.status(400).json({
                success: false,
                message: "Payment has not been completed successfully.",
                paymentStatus: transaction.status
            });
        }

        // CHECK AMOUNT, CURRENCY AND CUSTOMER EMAIL

        if (
            transaction.amount !== payment.amountKobo ||
            transaction.currency !== "NGN" ||
            String(transaction.customer.email).toLowerCase() !==
                payment.customerEmail.toLowerCase()
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment details do not match the ShopZone order."
            });
        }

        // CREATE ORDER ONLY AFTER VERIFIED PAYMENT

        session = await mongoose.startSession();

        let savedOrder = null;

        await session.withTransaction(async () => {

            // RELOAD PAYMENT INSIDE TRANSACTION

            const currentPayment = await Payment.findById(
                payment._id
            ).session(session);

            if (!currentPayment) {
                const error = new Error("PAYMENT_NOT_FOUND");
                error.code = "PAYMENT_NOT_FOUND";
                throw error;
            }

            // PREVENT DUPLICATE ORDER CREATION

            if (
                currentPayment.status === "Successful" &&
                currentPayment.orderId
            ) {

                savedOrder = await Order.findById(
                    currentPayment.orderId
                ).session(session);

                return;
            }

            if (currentPayment.status === "Failed") {
                const error = new Error("PAYMENT_FAILED");
                error.code = "PAYMENT_FAILED";
                throw error;
            }

            const finalOrderNumber = generateOrderNumber();

            const orderItems = currentPayment.items.map(item => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            }));

            const stockMovements = [];

            // RECHECK AND DEDUCT STOCK

            for (const item of orderItems) {

                const product = await Product.findById(
                    item.productId
                ).session(session);

                if (!product) {
                    const error = new Error("PRODUCT_NOT_FOUND");
                    error.code = "PRODUCT_NOT_FOUND";
                    throw error;
                }

                if (product.stock < item.quantity) {
                    const error = new Error("INSUFFICIENT_STOCK");
                    error.code = "INSUFFICIENT_STOCK";
                    error.productName = product.name;
                    error.availableStock = product.stock;
                    throw error;
                }

                const previousStock = product.stock;

                const result = await Product.updateOne(
                    {
                        _id: product._id,
                        stock: {
                            $gte: item.quantity
                        }
                    },
                    {
                        $inc: {
                            stock: -item.quantity
                        }
                    },
                    {
                        session
                    }
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

                    quantity: item.quantity,

                    previousStock,

                    newStock: previousStock - item.quantity,

                    orderNumber: finalOrderNumber,

                    description:
                        `${item.quantity} units deducted for order ${finalOrderNumber}.`

                });
            }

            // APPLY COUPON USAGE AFTER PAYMENT

            let appliedCoupon = null;

            if (currentPayment.couponCode) {

                const coupon = await Coupon.findOne({
                    code: currentPayment.couponCode
                }).session(session);

                if (!coupon || !coupon.isActive) {
                    const error = new Error("COUPON_NO_LONGER_AVAILABLE");
                    error.code = "COUPON_NO_LONGER_AVAILABLE";
                    throw error;
                }

                if (
                    coupon.expiryDate &&
                    new Date(coupon.expiryDate) <= new Date()
                ) {
                    const error = new Error("COUPON_NO_LONGER_AVAILABLE");
                    error.code = "COUPON_NO_LONGER_AVAILABLE";
                    throw error;
                }

                if (
                    coupon.discountType !== currentPayment.discountType ||
                    coupon.minimumOrderAmount > currentPayment.subtotal
                ) {
                    const error = new Error("COUPON_NO_LONGER_AVAILABLE");
                    error.code = "COUPON_NO_LONGER_AVAILABLE";
                    throw error;
                }

                const updatedCoupon = await Coupon.findOneAndUpdate(
                    {
                        _id: coupon._id,
                        isActive: true,
                        $or: [
                            {
                                usageLimit: null
                            },
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
                    const error = new Error("COUPON_NO_LONGER_AVAILABLE");
                    error.code = "COUPON_NO_LONGER_AVAILABLE";
                    throw error;
                }

                appliedCoupon = updatedCoupon;
            }

            // SAVE STOCK MOVEMENT HISTORY

            if (stockMovements.length > 0) {

                await StockMovement.create(
                    stockMovements,
                    {
                        session,
                        ordered: true
                    }
                );
            }

            // CREATE THE CUSTOMER ORDER

            const newOrder = new Order({

                orderNumber: finalOrderNumber,

                customerName: currentPayment.customerName,

                customerEmail: currentPayment.customerEmail,

                customerPhone: currentPayment.customerPhone,

                deliveryAddress: currentPayment.deliveryAddress,

                items: orderItems,

                subtotal: currentPayment.subtotal,

                couponCode: appliedCoupon
                    ? appliedCoupon.code
                    : "",

                discountType: currentPayment.discountType,

                discountAmount: currentPayment.discountAmount,

                total: currentPayment.total

            });

            const orders = await Order.create(
                [newOrder],
                {
                    session,
                    ordered: true
                }
            );

            savedOrder = orders[0];

            // MARK PAYMENT SUCCESSFUL

            currentPayment.status = "Successful";

            currentPayment.orderId = savedOrder._id;

            currentPayment.verifiedAt = new Date();

            currentPayment.failureReason = "";

            await currentPayment.save({
                session
            });
        });

        if (!savedOrder) {
            return res.status(500).json({
                success: false,
                message: "Payment was verified, but the order could not be retrieved. Please contact ShopZone support."
            });
        }

        res.status(200).json({

            success: true,

            message: "Payment verified and order created successfully.",

            order: savedOrder

        });

    } catch (error) {

        console.error(
            "Payment verification error:",
            error.message
        );

        if (error.code === "PAYMENT_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Payment record could not be found."
            });
        }

        if (error.code === "PAYMENT_FAILED") {
            return res.status(400).json({
                success: false,
                message: "This payment was marked as failed."
            });
        }

        if (error.code === "PRODUCT_NOT_FOUND") {
            return res.status(409).json({
                success: false,
                message: "Payment was received, but a product is no longer available. Please contact ShopZone support."
            });
        }

        if (error.code === "INSUFFICIENT_STOCK") {
            return res.status(409).json({
                success: false,
                message:
                    `Payment was received, but stock is insufficient for ${error.productName}. Please contact ShopZone support.`
            });
        }

        if (error.code === "COUPON_NO_LONGER_AVAILABLE") {
            return res.status(409).json({
                success: false,
                message: "Payment was received, but the coupon could not be applied during order processing. Please contact ShopZone support."
            });
        }

        res.status(500).json({
            success: false,
            message: "Unable to complete payment verification. Please try again or contact ShopZone support."
        });

    } finally {

        if (session) {
            await session.endSession();
        }
    }
});

module.exports = router;
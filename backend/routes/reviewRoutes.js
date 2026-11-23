const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");

const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const protectAdmin = require("../middleware/authMiddleware");

// =====================================
// HELPER: FIND A QUALIFYING CUSTOMER ORDER
// SUPPORTS OLDER ORDERS WITHOUT PRODUCT IDs
// =====================================

async function findQualifyingOrder(customerEmail, productId, productName) {

    return await Order.findOne({
        customerEmail: customerEmail.trim().toLowerCase(),

        status: { $ne: "Cancelled" },

        $or: [
            // NEWER ORDERS: MATCH USING PRODUCT ID
            {
                items: {
                    $elemMatch: {
                        productId: productId
                    }
                }
            },

            // OLDER ORDERS: MATCH PRODUCT NAME
            // ONLY WHEN PRODUCT ID IS MISSING OR NULL
            {
                items: {
                    $elemMatch: {
                        productId: null,
                        name: productName
                    }
                }
            }
        ]
    });
}

// =====================================
// HELPER: RECALCULATE PRODUCT RATINGS
// ONLY APPROVED REVIEWS COUNT
// =====================================

async function updateProductRating(productId) {

    const ratingStats = await Review.aggregate([
        {
            $match: {
                product: new mongoose.Types.ObjectId(productId),
                moderationStatus: {
                    $in: ["approved", null]
                }
            }
        },
        {
            $group: {
                _id: null,
                averageRating: { $avg: "$rating" },
                numReviews: { $sum: 1 }
            }
        }
    ]);

    let averageRating = 0;
    let numReviews = 0;

    if (ratingStats.length > 0) {

        averageRating = Number(
            ratingStats[0].averageRating.toFixed(1)
        );

        numReviews = ratingStats[0].numReviews;
    }

    await Product.findByIdAndUpdate(productId, {
        averageRating,
        numReviews
    });

    return {
        averageRating,
        numReviews
    };
}

// =====================================
// ADMIN: GET ALL CUSTOMER REVIEWS
// =====================================

router.get("/admin/all", protectAdmin, async (req, res) => {

    try {

        // APPROVE OLD REVIEWS CREATED BEFORE
        // THE MODERATION SYSTEM WAS INTRODUCED.

        await Review.updateMany(
            {
                moderationStatus: { $exists: false }
            },
            {
                $set: {
                    moderationStatus: "approved",
                    moderatedAt: new Date(),
                    moderationNote: "Existing review approved during moderation rollout."
                }
            }
        );

        const reviews = await Review.find()
            .populate("product", "name")
            .sort({ createdAt: -1 });

        const totalReviews = reviews.length;

        const verifiedReviews = reviews.filter(
            review => review.verifiedPurchase === true
        ).length;

        const unverifiedReviews =
            totalReviews - verifiedReviews;

        const pendingReviews = reviews.filter(
            review => review.moderationStatus === "pending"
        ).length;

        const approvedReviews = reviews.filter(
            review => review.moderationStatus === "approved"
        ).length;

        const rejectedReviews = reviews.filter(
            review => review.moderationStatus === "rejected"
        ).length;

        const ratingStats = await Review.aggregate([
            {
                $match: {
                    moderationStatus: "approved"
                }
            },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: "$rating" }
                }
            }
        ]);

        const averageRating = ratingStats.length > 0
            ? Number(ratingStats[0].averageRating.toFixed(1))
            : 0;

        res.status(200).json({
            success: true,
            totalReviews,
            verifiedReviews,
            unverifiedReviews,
            pendingReviews,
            approvedReviews,
            rejectedReviews,
            averageRating,
            reviews
        });

    } catch (error) {

        console.error(
            "Admin fetching reviews error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Unable to retrieve customer reviews."
        });
    }
});

// =====================================
// ADMIN: APPROVE OR REJECT REVIEW
// =====================================

router.patch(
    "/admin/:reviewId/moderation",
    protectAdmin,
    async (req, res) => {

        try {

            const { reviewId } = req.params;
            const { status, moderationNote } = req.body;

            if (!mongoose.Types.ObjectId.isValid(reviewId)) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid review ID."
                });
            }

            if (!["approved", "rejected"].includes(status)) {

                return res.status(400).json({
                    success: false,
                    message: "Status must be approved or rejected."
                });
            }

            if (
                moderationNote !== undefined &&
                (
                    typeof moderationNote !== "string" ||
                    moderationNote.length > 500
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Moderation note must not exceed 500 characters."
                });
            }

            const review = await Review.findById(reviewId);

            if (!review) {

                return res.status(404).json({
                    success: false,
                    message: "Review not found."
                });
            }

            review.moderationStatus = status;
            review.moderatedAt = new Date();

            if (moderationNote !== undefined) {
                review.moderationNote = moderationNote.trim();
            }

            await review.save();

            const updatedRating = await updateProductRating(
                review.product
            );

            res.status(200).json({
                success: true,
                message: `Review ${status} successfully.`,
                review,
                rating: updatedRating
            });

        } catch (error) {

            console.error(
                "Review moderation error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Unable to update review moderation status."
            });
        }
    }
);

// =====================================
// ADMIN: DELETE CUSTOMER REVIEW
// =====================================

router.delete(
    "/admin/:reviewId",
    protectAdmin,
    async (req, res) => {

        try {

            const { reviewId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(reviewId)) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid review ID."
                });
            }

            const review = await Review.findById(reviewId);

            if (!review) {

                return res.status(404).json({
                    success: false,
                    message: "Review not found."
                });
            }

            const productId = review.product;

            await Review.findByIdAndDelete(reviewId);

            const updatedRating = await updateProductRating(productId);

            res.status(200).json({
                success: true,
                message: "Customer review deleted successfully.",
                rating: updatedRating
            });

        } catch (error) {

            console.error(
                "Admin deleting review error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Unable to delete customer review."
            });
        }
    }
);

// =====================================
// PUBLIC: GET APPROVED REVIEWS
// FOR A PRODUCT
// =====================================

router.get("/:productId", async (req, res) => {

    try {

        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }

        const product = await Product.findById(productId);

        if (!product) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const reviews = await Review.find({
            product: productId,
            moderationStatus: {
                $in: ["approved", null]
            }
        }).sort({ createdAt: -1 });

        // VERIFY EXISTING CUSTOMER PURCHASES

        for (const review of reviews) {

            const verifiedOrder = await findQualifyingOrder(
                review.customerEmail,
                productId,
                product.name
            );

            if (
                verifiedOrder &&
                review.verifiedPurchase !== true
            ) {

                await Review.updateOne(
                    { _id: review._id },
                    {
                        $set: {
                            verifiedPurchase: true
                        }
                    }
                );

                review.verifiedPurchase = true;
            }
        }

        const updatedRating = await updateProductRating(productId);

        res.status(200).json({
            success: true,
            count: reviews.length,
            averageRating: updatedRating.averageRating,
            numReviews: updatedRating.numReviews,
            reviews
        });

    } catch (error) {

        console.error(
            "Fetching reviews error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Unable to retrieve reviews."
        });
    }
});

// =====================================
// CUSTOMER: SUBMIT VERIFIED REVIEW
// NEW REVIEWS REQUIRE ADMIN APPROVAL
// =====================================

router.post("/", async (req, res) => {

    try {

        const {
            productId,
            customerName,
            customerEmail,
            rating,
            comment
        } = req.body;

        if (
            !productId ||
            !customerName?.trim() ||
            !customerEmail?.trim() ||
            rating === undefined ||
            !comment?.trim()
        ) {

            return res.status(400).json({
                success: false,
                message: "Please provide all review details."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }

        const numericRating = Number(rating);

        if (
            !Number.isInteger(numericRating) ||
            numericRating < 1 ||
            numericRating > 5
        ) {

            return res.status(400).json({
                success: false,
                message: "Rating must be a whole number between 1 and 5."
            });
        }

        if (comment.trim().length > 1000) {

            return res.status(400).json({
                success: false,
                message: "Review cannot exceed 1000 characters."
            });
        }

        const product = await Product.findById(productId);

        if (!product) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const normalizedEmail = customerEmail
            .trim()
            .toLowerCase();

        // CHECK CUSTOMER PURCHASE.
        // SUPPORTS NEW AND OLDER ORDER FORMATS.

        const verifiedOrder = await findQualifyingOrder(
            normalizedEmail,
            productId,
            product.name
        );

        if (!verifiedOrder) {

            return res.status(403).json({
                success: false,
                message: "You can only review products you have purchased. No qualifying order was found for this product and email address."
            });
        }

        // PREVENT DUPLICATE REVIEWS

        const existingReview = await Review.findOne({
            product: productId,
            customerEmail: normalizedEmail
        });

        if (existingReview) {

            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product."
            });
        }

        // CREATE NEW PENDING REVIEW

        const review = await Review.create({
            product: productId,
            customerName: customerName.trim(),
            customerEmail: normalizedEmail,
            rating: numericRating,
            comment: comment.trim(),
            verifiedPurchase: true,
            moderationStatus: "pending"
        });

        res.status(201).json({
            success: true,
            message: "Your review was submitted successfully and is awaiting administrator approval.",
            review,
            moderationStatus: "pending"
        });

    } catch (error) {

        if (error.code === 11000) {

            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product."
            });
        }

        console.error(
            "Submitting review error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Unable to submit your review."
        });
    }
});

module.exports = router;
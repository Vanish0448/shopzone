const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const protectAdmin = require("../middleware/authMiddleware");

// =====================================
// PUBLIC: GET ALL PRODUCTS
// =====================================

router.get("/", async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: products.length,
            products
        });

    } catch (error) {
        console.error("Fetching products error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve products."
        });
    }
});


// =====================================
// ADMIN: ADD NEW PRODUCT
// =====================================

router.post("/", protectAdmin, async (req, res) => {
    try {
        const {
            name,
            price,
            category,
            image,
            description,
            stock
        } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof category !== "string" ||
            !category.trim() ||
            price === undefined ||
            price === null ||
            price === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Product name, price and category are required."
            });
        }

        const productPrice = Number(price);
        const productStock = stock === undefined ? 0 : Number(stock);

        if (
            !Number.isFinite(productPrice) ||
            productPrice < 0 ||
            !Number.isSafeInteger(productStock) ||
            productStock < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Price and stock must be valid non-negative numbers."
            });
        }

        const product = new Product({
            name: name.trim(),
            price: productPrice,
            category: category.trim(),
            image,
            description,
            stock: productStock
        });

        const savedProduct = await product.save();

        res.status(201).json({
            success: true,
            message: "Product added successfully!",
            product: savedProduct
        });

    } catch (error) {
        console.error("Adding product error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to add product."
        });
    }
});


// =====================================
// ADMIN: RESTOCK PRODUCT
// =====================================

router.post("/:id/restock", protectAdmin, async (req, res) => {
    let session;

    try {
        const { id } = req.params;
        const quantity = Number(req.body.quantity);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }

        if (
            !Number.isSafeInteger(quantity) ||
            quantity <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Restock quantity must be a positive whole number."
            });
        }

        session = await mongoose.startSession();

        let updatedProduct = null;

        await session.withTransaction(async () => {

            updatedProduct = await Product.findOneAndUpdate(
                { _id: id },
                {
                    $inc: {
                        stock: quantity
                    }
                },
                {
                    returnDocument: "after",
                    runValidators: true,
                    session
                }
            );

            if (!updatedProduct) {
                return;
            }

            const previousStock = updatedProduct.stock - quantity;

            await StockMovement.create(
                [
                    {
                        product: updatedProduct._id,
                        productName: updatedProduct.name,
                        movementType: "RESTOCK",
                        quantity,
                        previousStock,
                        newStock: updatedProduct.stock,
                        description: `${quantity} units added to stock.`
                    }
                ],
                { session }
            );
        });

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        res.status(200).json({
            success: true,
            message: `${quantity} units added to ${updatedProduct.name} successfully!`,
            product: updatedProduct
        });

    } catch (error) {
        console.error("Restocking product error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to restock product."
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
});


// =====================================
// ADMIN: UPDATE PRODUCT
// WITH AUTOMATIC STOCK HISTORY
// =====================================

router.put("/:id", protectAdmin, async (req, res) => {
    let session;

    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }

        const {
            name,
            price,
            category,
            image,
            description,
            stock
        } = req.body;

        const updates = {};

        if (name !== undefined) {
            if (
                typeof name !== "string" ||
                !name.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Product name cannot be empty."
                });
            }

            updates.name = name.trim();
        }

        if (price !== undefined) {
            const productPrice = Number(price);

            if (
                !Number.isFinite(productPrice) ||
                productPrice < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Price must be a valid non-negative number."
                });
            }

            updates.price = productPrice;
        }

        if (category !== undefined) {
            if (
                typeof category !== "string" ||
                !category.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Category cannot be empty."
                });
            }

            updates.category = category.trim();
        }

        if (image !== undefined) {
            updates.image = image;
        }

        if (description !== undefined) {
            updates.description = description;
        }

        if (stock !== undefined) {
            const productStock = Number(stock);

            if (
                !Number.isSafeInteger(productStock) ||
                productStock < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Stock must be a non-negative whole number."
                });
            }

            updates.stock = productStock;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No product information was provided for updating."
            });
        }

        session = await mongoose.startSession();

        let updatedProduct = null;
        let stockAdjustment = null;

        await session.withTransaction(async () => {

            const product = await Product.findById(
                req.params.id
            ).session(session);

            if (!product) {
                return;
            }

            const previousStock = product.stock;

            // UPDATE PRODUCT INFORMATION

            Object.assign(product, updates);

            await product.save({ session });

            updatedProduct = product;

            // =====================================
            // RECORD MANUAL STOCK ADJUSTMENT
            // =====================================

            if (
                stock !== undefined &&
                updates.stock !== previousStock
            ) {

                const quantity = Math.abs(
                    updates.stock - previousStock
                );

                stockAdjustment = {
                    product: product._id,
                    productName: product.name,
                    movementType: "STOCK_ADJUSTMENT",
                    quantity,
                    previousStock,
                    newStock: updates.stock,
                    description: updates.stock > previousStock
                        ? `Manual stock increase: ${quantity} units added.`
                        : `Manual stock decrease: ${quantity} units removed.`
                };

                await StockMovement.create(
                    [stockAdjustment],
                    { session }
                );
            }
        });

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        res.status(200).json({
            success: true,
            message: stockAdjustment
                ? "Product updated successfully! Stock adjustment recorded."
                : "Product updated successfully!",
            product: updatedProduct
        });

    } catch (error) {
        console.error("Updating product error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to update product."
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
});


// =====================================
// ADMIN: DELETE PRODUCT
// =====================================

router.delete("/:id", protectAdmin, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }

        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        res.status(200).json({
            success: true,
            message: "Product deleted successfully!"
        });

    } catch (error) {
        console.error("Deleting product error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to delete product."
        });
    }
});


module.exports = router;
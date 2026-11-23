const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { URL } = require("url");

const protectAdmin = require("../middleware/authMiddleware");

const router = express.Router();

// =====================================
// CLOUDINARY CONFIGURATION
// =====================================

if (process.env.CLOUDINARY_URL) {
    cloudinary.config();
}

// =====================================
// MULTER CONFIGURATION
// =====================================

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, callback) => {

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return callback(
                new Error("Only JPG, PNG and WEBP images are allowed.")
            );
        }

        callback(null, true);
    }
});

// =====================================
// CLOUDINARY UPLOAD HELPER
// =====================================

const uploadToCloudinary = (buffer) => {

    return new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "shopzone/products",
                resource_type: "image"
            },

            (error, result) => {

                if (error) {
                    return reject(error);
                }

                resolve(result);
            }
        );

        stream.end(buffer);
    });
};

// =====================================
// CHECK CLOUDINARY CONFIGURATION
// =====================================

const checkCloudinary = (req, res, next) => {

    const configuration = cloudinary.config();

    if (!configuration.cloud_name) {
        return res.status(500).json({
            success: false,
            message: "Cloudinary is not configured correctly."
        });
    }

    next();
};

// =====================================
// PIXABAY IMAGE SEARCH
// =====================================

router.get(
    "/search",
    protectAdmin,
    async (req, res) => {

        try {

            const query = String(req.query.q || "").trim();

            if (!query) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a product name to search."
                });
            }

            if (query.length > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Search term is too long."
                });
            }

            if (!process.env.PIXABAY_API_KEY) {
                return res.status(500).json({
                    success: false,
                    message: "Pixabay API key is missing."
                });
            }

            const searchUrl = new URL(
                "https://pixabay.com/api/"
            );

            searchUrl.searchParams.set(
                "key",
                process.env.PIXABAY_API_KEY
            );

            searchUrl.searchParams.set("q", query);
            searchUrl.searchParams.set("image_type", "photo");
            searchUrl.searchParams.set("safesearch", "true");
            searchUrl.searchParams.set("per_page", "12");
            searchUrl.searchParams.set("order", "popular");

            const response = await fetch(searchUrl, {
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                throw new Error("Pixabay image search failed.");
            }

            const data = await response.json();

            const images = (data.hits || []).map((image) => ({
                id: image.id,
                previewURL: image.previewURL,
                webformatURL: image.webformatURL,
                largeImageURL: image.largeImageURL,
                pageURL: image.pageURL,
                user: image.user,
                tags: image.tags
            }));

            res.json({
                success: true,
                count: images.length,
                images: images
            });

        } catch (error) {

            console.error(
                "Pixabay search error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Unable to search for product images right now."
            });
        }
    }
);

// =====================================
// UPLOAD OWN PRODUCT IMAGE
// =====================================

router.post(
    "/upload",
    protectAdmin,
    checkCloudinary,
    (req, res, next) => {

        upload.single("image")(req, res, (error) => {

            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            next();
        });

    },
    async (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Please select an image to upload."
                });
            }

            const result = await uploadToCloudinary(
                req.file.buffer
            );

            res.status(201).json({
                success: true,
                message: "Image uploaded successfully.",
                image: result.secure_url
            });

        } catch (error) {

            console.error(
                "Cloudinary upload error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Image upload failed. Please try again."
            });
        }
    }
);

// =====================================
// IMPORT SELECTED PIXABAY IMAGE
// =====================================

router.post(
    "/import-pixabay",
    protectAdmin,
    checkCloudinary,
    async (req, res) => {

        try {

            const imageUrl = req.body.imageUrl;

            if (!imageUrl) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a Pixabay image."
                });
            }

            let parsedUrl;

            try {
                parsedUrl = new URL(imageUrl);
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "Invalid image URL."
                });
            }

            // Accept only official Pixabay image hosts.
            const allowedHosts = [
                "cdn.pixabay.com",
                "pixabay.com"
            ];

            if (
                parsedUrl.protocol !== "https:" ||
                !allowedHosts.includes(parsedUrl.hostname) ||
                parsedUrl.username ||
                parsedUrl.password ||
                parsedUrl.port
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Only valid Pixabay image URLs are allowed."
                });
            }

            // Fetch without following redirects to prevent
            // requests being redirected to untrusted websites.
            const response = await fetch(parsedUrl, {
                signal: AbortSignal.timeout(20000),
                redirect: "manual"
            });

            if (response.status >= 300 && response.status < 400) {
                return res.status(400).json({
                    success: false,
                    message: "Pixabay redirected this image. Please select another picture."
                });
            }

            if (!response.ok) {
                return res.status(400).json({
                    success: false,
                    message: "Unable to retrieve the selected Pixabay image."
                });
            }

            const contentType = response.headers.get(
                "content-type"
            ) || "";

            if (!contentType.startsWith("image/")) {
                return res.status(400).json({
                    success: false,
                    message: "The selected URL does not contain an image."
                });
            }

            const contentLength = Number(
                response.headers.get("content-length") || 0
            );

            if (contentLength > 5 * 1024 * 1024) {
                return res.status(400).json({
                    success: false,
                    message: "The selected image is too large."
                });
            }

            const imageBuffer = Buffer.from(
                await response.arrayBuffer()
            );

            if (imageBuffer.length > 5 * 1024 * 1024) {
                return res.status(400).json({
                    success: false,
                    message: "The selected image is too large."
                });
            }

            if (imageBuffer.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "The selected image is empty."
                });
            }

            const result = await uploadToCloudinary(
                imageBuffer
            );

            res.status(201).json({
                success: true,
                message: "Pixabay image imported successfully.",
                image: result.secure_url
            });

        } catch (error) {

            console.error(
                "Pixabay import error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Unable to import this image. Please try another."
            });
        }
    }
);

module.exports = router;
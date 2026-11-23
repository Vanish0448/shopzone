// =====================================
// SHOPZONE PRODUCT IMAGE MANAGER
// PIXABAY + CLOUDINARY
// =====================================

const IMAGE_API_URL = "http://localhost:5000/api/images";

const imageAdminToken = localStorage.getItem(
    "shopzone-admin-token"
);

// =====================================
// HTML ELEMENTS
// =====================================

const imageProductName = document.getElementById(
    "product-name"
);

const imageProductUrl = document.getElementById(
    "product-image"
);

const imageSearchInput = document.getElementById(
    "product-image-search"
);

const imageSearchButton = document.getElementById(
    "search-product-images"
);

const imageSearchMessage = document.getElementById(
    "image-search-message"
);

const imageResultsContainer = document.getElementById(
    "product-image-results"
);

const imageUploadInput = document.getElementById(
    "product-image-upload"
);

const imageUploadButton = document.getElementById(
    "upload-product-image"
);

const imageUploadMessage = document.getElementById(
    "image-upload-message"
);

const selectedImageContainer = document.getElementById(
    "selected-product-image-preview"
);

const selectedImagePreview = document.getElementById(
    "selected-product-image"
);

// =====================================
// IMAGE MANAGER STYLES
// =====================================

const imageManagerStyles = document.createElement("style");

imageManagerStyles.textContent = `

    .image-tools-panel {
        width: 100%;
        padding: 20px;
        margin-top: 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
    }

    .image-tools-panel h3 {
        margin-bottom: 10px;
        color: #172554;
    }

    .image-tools-panel p {
        margin-bottom: 12px;
        color: #475569;
    }

    .image-search-controls {
        margin-top: 20px;
    }

    .image-search-controls label,
    .image-upload-section label {
        display: block;
        margin-bottom: 10px;
        font-weight: 600;
    }

    .image-search-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }

    .image-search-row input {
        flex: 1;
        min-width: 180px;
    }

    .image-search-row button,
    .image-upload-section button {
        padding: 12px 18px;
        border: none;
        border-radius: 6px;
        background: #1d4ed8;
        color: white;
        cursor: pointer;
        font-weight: 600;
    }

    .image-search-row button:hover,
    .image-upload-section button:hover {
        background: #1e40af;
    }

    .image-search-row button:disabled,
    .image-upload-section button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .product-image-results {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 15px;
        margin-top: 20px;
    }

    .product-image-card {
        padding: 10px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
    }

    .product-image-card img {
        width: 100%;
        height: 140px;
        object-fit: cover;
        border-radius: 7px;
        display: block;
    }

    .product-image-card p {
        margin: 10px 0;
        font-size: 13px;
    }

    .product-image-card button {
        width: 100%;
        padding: 9px;
        border: none;
        border-radius: 6px;
        background: #15803d;
        color: white;
        cursor: pointer;
        font-weight: 600;
    }

    .product-image-card button:hover {
        background: #166534;
    }

    .product-image-card button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .image-attribution-note {
        margin-top: 15px;
        font-size: 12px;
    }

    .image-attribution {
        display: block;
        margin: 8px 0;
        font-size: 12px;
        color: #64748b;
    }

    .image-attribution a {
        color: #1d4ed8;
    }

    .image-upload-section {
        margin-top: 20px;
    }

    .image-upload-section input {
        display: block;
        width: 100%;
        margin-bottom: 12px;
    }

    .image-upload-section small {
        display: block;
        margin-bottom: 15px;
        color: #64748b;
    }

    .selected-product-image-preview {
        margin-top: 20px;
        padding: 15px;
        background: white;
        border: 1px solid #bbf7d0;
        border-radius: 10px;
    }

    .selected-product-image-preview h4 {
        margin-bottom: 10px;
        color: #166534;
    }

    .selected-product-image-preview img {
        width: 100%;
        max-width: 300px;
        max-height: 250px;
        object-fit: contain;
        display: block;
        border-radius: 8px;
    }

    #image-search-message,
    #image-upload-message {
        margin-top: 12px;
        font-weight: 600;
    }

    @media (max-width: 600px) {

        .image-search-row {
            flex-direction: column;
        }

        .image-search-row button {
            width: 100%;
        }

        .product-image-results {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

    }

`;

document.head.appendChild(imageManagerStyles);

// =====================================
// AUTHENTICATION HEADERS
// =====================================

function getImageHeaders() {

    return {
        "Authorization": `Bearer ${imageAdminToken}`
    };

}

// =====================================
// DISPLAY MESSAGES
// =====================================

function showImageMessage(element, message, success = false) {

    element.textContent = message;

    element.style.color = success
        ? "#15803d"
        : "#dc2626";

}

// =====================================
// SHOW SELECTED IMAGE PREVIEW
// =====================================

function showSelectedImage(imageUrl) {

    if (!imageUrl) {
        return;
    }

    selectedImagePreview.src = imageUrl;

    selectedImageContainer.hidden = false;

    imageProductUrl.value = imageUrl;

}

// =====================================
// SEARCH PIXABAY IMAGES
// =====================================

async function searchProductImages() {

    const searchTerm = imageSearchInput.value.trim();

    if (!searchTerm) {

        showImageMessage(
            imageSearchMessage,
            "Enter a product name before searching."
        );

        imageSearchInput.focus();

        return;
    }

    if (!imageAdminToken) {

        showImageMessage(
            imageSearchMessage,
            "Your admin session has expired. Please log in again."
        );

        return;
    }

    imageSearchButton.disabled = true;

    imageSearchButton.textContent = "Searching...";

    imageResultsContainer.innerHTML = "";

    showImageMessage(
        imageSearchMessage,
        "Searching Pixabay for product pictures...",
        true
    );

    try {

        const response = await fetch(
            `${IMAGE_API_URL}/search?q=${encodeURIComponent(searchTerm)}`,
            {
                method: "GET",
                headers: getImageHeaders()
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Image search failed."
            );
        }

        if (!data.images || data.images.length === 0) {

            showImageMessage(
                imageSearchMessage,
                "No pictures found. Try another search term."
            );

            return;
        }

        displayPixabayImages(data.images);

        showImageMessage(
            imageSearchMessage,
            `${data.images.length} pictures found. Select the picture that matches your product.`,
            true
        );

    } catch (error) {

        console.error("Product image search error:", error);

        showImageMessage(
            imageSearchMessage,
            error.message || "Unable to search for pictures."
        );

    } finally {

        imageSearchButton.disabled = false;

        imageSearchButton.textContent = "Search Images";
    }

}

// =====================================
// DISPLAY PIXABAY SEARCH RESULTS
// =====================================

function displayPixabayImages(images) {

    imageResultsContainer.innerHTML = "";

    images.forEach((image) => {

        const card = document.createElement("div");

        card.className = "product-image-card";

        const preview = document.createElement("img");

        preview.src = image.previewURL;

        preview.alt = image.tags || "Product image";

        preview.loading = "lazy";

        preview.referrerPolicy = "no-referrer";

        const photographer = document.createElement("p");

        photographer.textContent = `Photographer: ${image.user || "Pixabay contributor"}`;

        const attribution = document.createElement("span");

        attribution.className = "image-attribution";

        const sourceLink = document.createElement("a");

        sourceLink.href = image.pageURL;

        sourceLink.target = "_blank";

        sourceLink.rel = "noopener noreferrer";

        sourceLink.textContent = "View original on Pixabay";

        attribution.appendChild(sourceLink);

        const selectButton = document.createElement("button");

        selectButton.type = "button";

        selectButton.textContent = "Select This Picture";

        selectButton.addEventListener("click", () => {

            importPixabayImage(
                image.largeImageURL,
                selectButton
            );

        });

        card.appendChild(preview);

        card.appendChild(photographer);

        card.appendChild(attribution);

        card.appendChild(selectButton);

        imageResultsContainer.appendChild(card);

    });

}

// =====================================
// IMPORT SELECTED PIXABAY IMAGE
// =====================================

async function importPixabayImage(imageUrl, button) {

    if (!imageUrl) {

        showImageMessage(
            imageSearchMessage,
            "This picture does not have a valid image URL."
        );

        return;
    }

    const previousText = button.textContent;

    button.disabled = true;

    button.textContent = "Saving image...";

    showImageMessage(
        imageSearchMessage,
        "Importing your selected picture into Cloudinary...",
        true
    );

    try {

        const response = await fetch(
            `${IMAGE_API_URL}/import-pixabay`,
            {
                method: "POST",

                headers: {
                    ...getImageHeaders(),
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    imageUrl: imageUrl
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Unable to import this picture."
            );
        }

        showSelectedImage(data.image);

        showImageMessage(
            imageSearchMessage,
            "Picture selected and saved successfully! The image URL has been added to your product form.",
            true
        );

        button.textContent = "Selected";

    } catch (error) {

        console.error("Pixabay image import error:", error);

        showImageMessage(
            imageSearchMessage,
            error.message || "Unable to save this picture."
        );

        button.disabled = false;

        button.textContent = previousText;
    }

}

// =====================================
// UPLOAD YOUR OWN PRODUCT IMAGE
// =====================================

async function uploadOwnProductImage() {

    const file = imageUploadInput.files[0];

    if (!file) {

        showImageMessage(
            imageUploadMessage,
            "Please choose a picture first."
        );

        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {

        showImageMessage(
            imageUploadMessage,
            "Only JPG, PNG and WEBP pictures are allowed."
        );

        return;
    }

    if (file.size > 5 * 1024 * 1024) {

        showImageMessage(
            imageUploadMessage,
            "Picture is too large. Maximum size is 5MB."
        );

        return;
    }

    if (!imageAdminToken) {

        showImageMessage(
            imageUploadMessage,
            "Your admin session has expired. Please log in again."
        );

        return;
    }

    imageUploadButton.disabled = true;

    imageUploadButton.textContent = "Uploading...";

    showImageMessage(
        imageUploadMessage,
        "Uploading picture to Cloudinary...",
        true
    );

    try {

        const formData = new FormData();

        formData.append("image", file);

        const response = await fetch(
            `${IMAGE_API_URL}/upload`,
            {
                method: "POST",

                headers: getImageHeaders(),

                body: formData
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Picture upload failed."
            );
        }

        showSelectedImage(data.image);

        showImageMessage(
            imageUploadMessage,
            "Picture uploaded successfully! Its Cloudinary URL has been added to your product form.",
            true
        );

        imageUploadInput.value = "";

    } catch (error) {

        console.error("Product image upload error:", error);

        showImageMessage(
            imageUploadMessage,
            error.message || "Unable to upload your picture."
        );

    } finally {

        imageUploadButton.disabled = false;

        imageUploadButton.textContent = "Upload Picture";
    }

}

// =====================================
// AUTOMATIC SEARCH FIELD
// =====================================

imageProductName.addEventListener("input", () => {

    imageSearchInput.value = imageProductName.value;

});

// =====================================
// SEARCH BUTTON
// =====================================

imageSearchButton.addEventListener(
    "click",
    searchProductImages
);

// =====================================
// ENTER KEY SEARCH
// =====================================

imageSearchInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {

        event.preventDefault();

        searchProductImages();
    }

});

// =====================================
// UPLOAD BUTTON
// =====================================

imageUploadButton.addEventListener(
    "click",
    uploadOwnProductImage
);

// =====================================
// PREVIEW IMAGE WHEN EDITING PRODUCT
// =====================================

if (imageProductUrl.value) {

    showSelectedImage(imageProductUrl.value);

}

console.log("ShopZone Product Image Manager loaded successfully.");
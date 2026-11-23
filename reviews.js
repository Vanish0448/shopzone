// =====================================
// SHOPZONE CUSTOMER PRODUCT REVIEWS
// =====================================

(function () {
    if (window.shopZoneReviewsLoaded) {
        return;
    }

    window.shopZoneReviewsLoaded = true;

    const API_URL = "https://shopzone-sojz.onrender.com/api";
    const PRODUCTS_URL = `${API_URL}/products`;
    const REVIEWS_URL = `${API_URL}/reviews`;

    // =====================================
    // HTML ELEMENTS
    // =====================================

    const reviewForm = document.getElementById("review-form");
    const reviewProductInput = document.getElementById("review-product");
    const reviewNameInput = document.getElementById("review-customer-name");
    const reviewEmailInput = document.getElementById("review-customer-email");
    const reviewCommentInput = document.getElementById("review-comment");
    const reviewRatingInput = document.getElementById("review-rating");

    const reviewStarSelector = document.getElementById("review-star-selector");
    const submitReviewButton = document.getElementById("submit-review-button");
    const reviewMessage = document.getElementById("review-message");

    const reviewsProductFilter = document.getElementById("reviews-product-filter");
    const productRatingSummary = document.getElementById("product-rating-summary");
    const reviewsList = document.getElementById("reviews-list");

    let products = [];

    // =====================================
    // SECURITY: ESCAPE HTML
    // =====================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    // =====================================
    // DISPLAY MESSAGE
    // =====================================

    function showReviewMessage(message, color) {
        reviewMessage.textContent = message;
        reviewMessage.style.color = color;
    }

    // =====================================
    // LOAD PRODUCTS
    // =====================================

    async function loadReviewProducts() {
        try {
            const response = await fetch(PRODUCTS_URL);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to load products.");
            }

            products = data.products || [];

            reviewProductInput.innerHTML =
                '<option value="">Choose a product</option>';

            reviewsProductFilter.innerHTML =
                '<option value="">Select a product</option>';

            products.forEach(product => {
                const option1 = document.createElement("option");
                option1.value = product._id;
                option1.textContent = product.name;

                const option2 = document.createElement("option");
                option2.value = product._id;
                option2.textContent = product.name;

                reviewProductInput.appendChild(option1);
                reviewsProductFilter.appendChild(option2);
            });

        } catch (error) {
            console.error("Loading review products error:", error);

            showReviewMessage(
                "Unable to load products. Please refresh the page.",
                "red"
            );
        }
    }

    // =====================================
    // STAR RATING SELECTION
    // =====================================

    function updateStarSelection(rating) {
        const stars = reviewStarSelector.querySelectorAll("button");

        stars.forEach(star => {
            const starRating = Number(star.dataset.rating);

            star.classList.toggle(
                "selected",
                starRating <= rating
            );

            star.setAttribute(
                "aria-pressed",
                starRating === rating ? "true" : "false"
            );
        });

        reviewRatingInput.value = rating;
    }

    reviewStarSelector.addEventListener("click", function (event) {
        const star = event.target.closest("button[data-rating]");

        if (!star) {
            return;
        }

        updateStarSelection(Number(star.dataset.rating));
    });

    // =====================================
    // DISPLAY STAR RATING
    // =====================================

    function displayStars(rating) {
        const roundedRating = Math.max(
            0,
            Math.min(5, Math.round(Number(rating) || 0))
        );

        return `
            <span class="review-stars">
                ${"★".repeat(roundedRating)}${"☆".repeat(5 - roundedRating)}
            </span>
        `;
    }

    // =====================================
    // LOAD REVIEWS FOR A PRODUCT
    // =====================================

    async function loadProductReviews(productId) {
        if (!productId) {
            productRatingSummary.innerHTML = "";

            reviewsList.innerHTML =
                "<p>Select a product to see its reviews.</p>";

            return;
        }

        reviewsList.innerHTML = "<p>Loading reviews...</p>";
        productRatingSummary.innerHTML = "";

        try {
            const response = await fetch(
                `${REVIEWS_URL}/${encodeURIComponent(productId)}`
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to load reviews.");
            }

            displayReviewSummary(data);
            displayReviews(data.reviews || []);

        } catch (error) {
            console.error("Loading reviews error:", error);

            reviewsList.innerHTML =
                `<p>${escapeHTML(error.message)}</p>`;
        }
    }

    // =====================================
    // DISPLAY PRODUCT RATING SUMMARY
    // =====================================

    function displayReviewSummary(data) {
        const averageRating = Number(data.averageRating) || 0;
        const numReviews = Number(data.numReviews) || 0;

        productRatingSummary.innerHTML = `
            <div class="rating-summary">
                <h3>${averageRating.toFixed(1)} / 5</h3>

                ${displayStars(averageRating)}

                <p>
                    Based on ${numReviews}
                    ${numReviews === 1 ? "review" : "reviews"}
                </p>
            </div>
        `;
    }

    // =====================================
    // DISPLAY CUSTOMER REVIEWS
    // =====================================

    function displayReviews(reviews) {
        if (!reviews.length) {
            reviewsList.innerHTML = `
                <p>
                    No reviews yet.
                    Be the first to review this product!
                </p>
            `;

            return;
        }

        reviewsList.innerHTML = reviews.map(review => {
            const reviewDate = review.createdAt
                ? new Date(review.createdAt).toLocaleDateString("en-NG")
                : "";

            const verifiedBadge = review.verifiedPurchase === true
                ? `
                    <span class="verified-purchase-badge"
                          title="This customer purchased this product">
                        Verified Purchase
                    </span>
                `
                : "";

            return `
                <article class="customer-review">

                    <div class="customer-review-header">
                        <div class="review-customer-info">
                            <h4>${escapeHTML(review.customerName)}</h4>
                            ${verifiedBadge}
                        </div>

                        <span>${displayStars(review.rating)}</span>
                    </div>

                    <p class="review-date">
                        ${escapeHTML(reviewDate)}
                    </p>

                    <p class="review-comment">
                        ${escapeHTML(review.comment)}
                    </p>

                </article>
            `;
        }).join("");
    }

    // =====================================
    // CHANGE PRODUCT FOR REVIEW DISPLAY
    // =====================================

    reviewsProductFilter.addEventListener("change", function () {
        loadProductReviews(this.value);
    });

    // =====================================
    // SUBMIT CUSTOMER REVIEW
    // =====================================

    reviewForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const productId = reviewProductInput.value;
        const customerName = reviewNameInput.value.trim();
        const customerEmail = reviewEmailInput.value.trim();
        const rating = Number(reviewRatingInput.value);
        const comment = reviewCommentInput.value.trim();

        if (!productId) {
            showReviewMessage("Please select a product.", "red");
            return;
        }

        if (!customerName || !customerEmail || !comment) {
            showReviewMessage("Please complete all review fields.", "red");
            return;
        }

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            showReviewMessage(
                "Please select a rating from 1 to 5 stars.",
                "red"
            );
            return;
        }

        submitReviewButton.disabled = true;
        submitReviewButton.textContent = "Submitting...";

        try {
            const response = await fetch(REVIEWS_URL, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    productId,
                    customerName,
                    customerEmail,
                    rating,
                    comment
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to submit review.");
            }

            showReviewMessage(
                "Your verified purchase review was submitted successfully!",
                "green"
            );

            reviewForm.reset();
            updateStarSelection(0);

            await loadReviewProducts();

            reviewsProductFilter.value = productId;

            await loadProductReviews(productId);

        } catch (error) {
            console.error("Submitting review error:", error);

            showReviewMessage(error.message, "red");

        } finally {
            submitReviewButton.disabled = false;
            submitReviewButton.textContent = "Submit Review";
        }
    });

    // =====================================
    // INITIALIZE REVIEWS
    // =====================================

    loadReviewProducts();

})();
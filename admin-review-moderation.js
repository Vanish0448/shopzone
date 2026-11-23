// =====================================
// SHOPZONE ADMIN REVIEW MODERATION
// =====================================

(function () {

    if (window.shopZoneAdminReviewModerationLoaded) {
        return;
    }

    window.shopZoneAdminReviewModerationLoaded = true;

    const API_URL = "https://shopzone-sojz.onrender.com/api/reviews/admin/all";

    const MODERATION_API_URL = "https://shopzone-sojz.onrender.com/api/reviews/admin";

    const adminToken = localStorage.getItem("shopzone-admin-token");

    // =====================================
    // HTML ELEMENTS
    // =====================================

    const totalReviewsElement = document.getElementById(
        "admin-total-reviews"
    );

    const verifiedReviewsElement = document.getElementById(
        "admin-verified-reviews"
    );

    const unverifiedReviewsElement = document.getElementById(
        "admin-unverified-reviews"
    );

    const pendingReviewsElement = document.getElementById(
        "admin-pending-reviews"
    );

    const approvedReviewsElement = document.getElementById(
        "admin-approved-reviews"
    );

    const rejectedReviewsElement = document.getElementById(
        "admin-rejected-reviews"
    );

    const searchInput = document.getElementById(
        "admin-review-search"
    );

    const filterSelect = document.getElementById(
        "admin-review-filter"
    );

    const reviewsTableBody = document.getElementById(
        "admin-reviews-table-body"
    );

    const messageElement = document.getElementById(
        "admin-review-message"
    );

    let allReviews = [];

    // =====================================
    // CHECK ADMIN TOKEN
    // =====================================

    if (!adminToken) {

        window.location.href = "admin.html";

        return;
    }

    // =====================================
    // SAFE HTML ESCAPING
    // =====================================

    function escapeHTML(value) {

        return String(value ?? "").replace(
            /[&<>"']/g,
            function (character) {

                const characters = {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"
                };

                return characters[character];
            }
        );
    }

    // =====================================
    // FORMAT DATE
    // =====================================

    function formatReviewDate(dateValue) {

        if (!dateValue) {
            return "Unknown date";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "Unknown date";
        }

        return date.toLocaleString("en-NG");
    }

    // =====================================
    // FORMAT RATING
    // =====================================

    function displayStars(rating) {

        const numericRating = Number(rating) || 0;

        const fullStars = Math.max(
            0,
            Math.min(5, Math.round(numericRating))
        );

        return "★".repeat(fullStars) +
            "☆".repeat(5 - fullStars) +
            ` (${numericRating}/5)`;
    }

    // =====================================
    // GET REVIEW STATUS
    // =====================================

    function getReviewStatus(review) {

        // Existing reviews without a moderation status
        // are treated as approved.

        return review.moderationStatus || "approved";
    }

    // =====================================
    // DISPLAY MESSAGE
    // =====================================

    function showMessage(message, type = "success") {

        if (!messageElement) {
            return;
        }

        messageElement.textContent = message;

        messageElement.style.color =
            type === "error" ? "#dc3545" : "#198754";

        messageElement.style.marginTop = "15px";

        messageElement.style.fontWeight = "bold";
    }

    // =====================================
    // UPDATE REVIEW STATISTICS
    // =====================================

    function updateReviewStatistics(data) {

        const pending = allReviews.filter(
            review => getReviewStatus(review) === "pending"
        ).length;

        const approved = allReviews.filter(
            review => getReviewStatus(review) === "approved"
        ).length;

        const rejected = allReviews.filter(
            review => getReviewStatus(review) === "rejected"
        ).length;

        if (totalReviewsElement) {
            totalReviewsElement.textContent =
                data.totalReviews ?? allReviews.length;
        }

        if (verifiedReviewsElement) {
            verifiedReviewsElement.textContent =
                data.verifiedReviews ??
                allReviews.filter(
                    review => review.verifiedPurchase === true
                ).length;
        }

        if (unverifiedReviewsElement) {
            unverifiedReviewsElement.textContent =
                data.unverifiedReviews ??
                allReviews.filter(
                    review => review.verifiedPurchase !== true
                ).length;
        }

        if (pendingReviewsElement) {
            pendingReviewsElement.textContent = pending;
        }

        if (approvedReviewsElement) {
            approvedReviewsElement.textContent = approved;
        }

        if (rejectedReviewsElement) {
            rejectedReviewsElement.textContent = rejected;
        }
    }

    // =====================================
    // LOAD ALL CUSTOMER REVIEWS
    // =====================================

    async function loadAdminReviews() {

        if (!reviewsTableBody) {
            return;
        }

        reviewsTableBody.innerHTML = `
            <tr>
                <td colspan="9">Loading customer reviews...</td>
            </tr>
        `;

        try {

            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${adminToken}`
                }
            });

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                localStorage.removeItem("shopzone-admin-token");

                window.location.href = "admin.html";

                return;
            }

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message || "Unable to load customer reviews."
                );
            }

            allReviews = Array.isArray(data.reviews)
                ? data.reviews
                : [];

            updateReviewStatistics(data);

            displayFilteredReviews();

        } catch (error) {

            console.error(
                "Admin review loading error:",
                error
            );

            reviewsTableBody.innerHTML = `
                <tr>
                    <td colspan="9">
                        Unable to load customer reviews.
                    </td>
                </tr>
            `;

            showMessage(error.message, "error");
        }
    }

    // =====================================
    // FILTER CUSTOMER REVIEWS
    // =====================================

    function displayFilteredReviews() {

        const searchTerm = searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

        const filterValue = filterSelect
            ? filterSelect.value
            : "all";

        let filteredReviews = [...allReviews];

        // SEARCH FILTER

        if (searchTerm) {

            filteredReviews = filteredReviews.filter(review => {

                const customerName =
                    String(review.customerName || "").toLowerCase();

                const customerEmail =
                    String(review.customerEmail || "").toLowerCase();

                const productName =
                    String(
                        review.product?.name || "Deleted Product"
                    ).toLowerCase();

                const comment =
                    String(review.comment || "").toLowerCase();

                return (
                    customerName.includes(searchTerm) ||
                    customerEmail.includes(searchTerm) ||
                    productName.includes(searchTerm) ||
                    comment.includes(searchTerm)
                );
            });
        }

        // MODERATION AND VERIFICATION FILTERS

        if (
            ["pending", "approved", "rejected"].includes(filterValue)
        ) {

            filteredReviews = filteredReviews.filter(
                review => getReviewStatus(review) === filterValue
            );

        } else if (filterValue === "verified") {

            filteredReviews = filteredReviews.filter(
                review => review.verifiedPurchase === true
            );

        } else if (filterValue === "unverified") {

            filteredReviews = filteredReviews.filter(
                review => review.verifiedPurchase !== true
            );
        }

        renderReviews(filteredReviews);
    }

    // =====================================
    // MODERATION STATUS BADGE
    // =====================================

    function createStatusBadge(status) {

        const styles = {

            pending: {
                background: "#fff3cd",
                color: "#664d03",
                label: "Pending"
            },

            approved: {
                background: "#d1e7dd",
                color: "#0f5132",
                label: "Approved"
            },

            rejected: {
                background: "#f8d7da",
                color: "#842029",
                label: "Rejected"
            }

        };

        const style = styles[status] || styles.pending;

        return `
            <span style="
                background:${style.background};
                color:${style.color};
                padding:6px 10px;
                border-radius:15px;
                font-size:11px;
                font-weight:bold;
                white-space:nowrap;
            ">
                ${style.label}
            </span>
        `;
    }

    // =====================================
    // RENDER CUSTOMER REVIEWS
    // =====================================

    function renderReviews(reviews) {

        if (!reviewsTableBody) {
            return;
        }

        if (reviews.length === 0) {

            reviewsTableBody.innerHTML = `
                <tr>
                    <td colspan="9">
                        No customer reviews found.
                    </td>
                </tr>
            `;

            return;
        }

        reviewsTableBody.innerHTML = reviews.map(review => {

            const productName = review.product?.name ||
                "Deleted Product";

            const customerName = review.customerName ||
                "Unknown Customer";

            const customerEmail = review.customerEmail ||
                "No email";

            const comment = review.comment ||
                "No comment";

            const verified = review.verifiedPurchase === true;

            const status = getReviewStatus(review);

            const verificationBadge = verified
                ? `
                    <span style="
                        background:#d1e7dd;
                        color:#0f5132;
                        padding:5px 9px;
                        border-radius:15px;
                        font-size:11px;
                        font-weight:bold;
                        white-space:nowrap;
                    ">
                        ✓ Verified
                    </span>
                  `
                : `
                    <span style="
                        background:#fff3cd;
                        color:#664d03;
                        padding:5px 9px;
                        border-radius:15px;
                        font-size:11px;
                        font-weight:bold;
                        white-space:nowrap;
                    ">
                        Unverified
                    </span>
                  `;

            const approveButton = status !== "approved"
                ? `
                    <button
                        type="button"
                        class="admin-moderate-review-button"
                        data-review-id="${escapeHTML(review._id)}"
                        data-status="approved"
                        style="
                            background:#198754;
                            color:white;
                            border:none;
                            padding:7px 10px;
                            border-radius:5px;
                            cursor:pointer;
                            margin:3px;
                        "
                    >
                        Approve
                    </button>
                  `
                : "";

            const rejectButton = status !== "rejected"
                ? `
                    <button
                        type="button"
                        class="admin-moderate-review-button"
                        data-review-id="${escapeHTML(review._id)}"
                        data-status="rejected"
                        style="
                            background:#fd7e14;
                            color:white;
                            border:none;
                            padding:7px 10px;
                            border-radius:5px;
                            cursor:pointer;
                            margin:3px;
                        "
                    >
                        Reject
                    </button>
                  `
                : "";

            return `
                <tr>

                    <td>
                        ${escapeHTML(productName)}
                    </td>

                    <td>
                        ${escapeHTML(customerName)}
                    </td>

                    <td>
                        ${escapeHTML(customerEmail)}
                    </td>

                    <td style="color:#f0ad00; white-space:nowrap;">
                        ${escapeHTML(displayStars(review.rating))}
                    </td>

                    <td style="min-width:200px; max-width:300px;">
                        ${escapeHTML(comment)}
                    </td>

                    <td>
                        ${verificationBadge}
                    </td>

                    <td>
                        ${createStatusBadge(status)}
                    </td>

                    <td style="white-space:nowrap;">
                        ${escapeHTML(formatReviewDate(review.createdAt))}
                    </td>

                    <td style="min-width:180px;">

                        ${approveButton}

                        ${rejectButton}

                        <button
                            type="button"
                            class="admin-delete-review-button"
                            data-review-id="${escapeHTML(review._id)}"
                            style="
                                background:#dc3545;
                                color:white;
                                border:none;
                                padding:7px 10px;
                                border-radius:5px;
                                cursor:pointer;
                                margin:3px;
                            "
                        >
                            Delete
                        </button>

                    </td>

                </tr>
            `;

        }).join("");
    }

    // =====================================
    // APPROVE OR REJECT CUSTOMER REVIEW
    // =====================================

    async function moderateReview(reviewId, status) {

        if (!["approved", "rejected"].includes(status)) {
            return;
        }

        const action = status === "approved"
            ? "approve"
            : "reject";

        const confirmed = window.confirm(
            `Are you sure you want to ${action} this customer review?`
        );

        if (!confirmed) {
            return;
        }

        let moderationNote = "";

        const note = window.prompt(
            "Optional: Enter an admin note. Leave empty if you do not need one.",
            ""
        );

        if (note === null) {
            return;
        }

        moderationNote = note.trim();

        if (moderationNote.length > 500) {

            showMessage(
                "The moderation note cannot exceed 500 characters.",
                "error"
            );

            return;
        }

        try {

            showMessage(
                status === "approved"
                    ? "Approving review..."
                    : "Rejecting review..."
            );

            const response = await fetch(
                `${MODERATION_API_URL}/${encodeURIComponent(reviewId)}/moderation`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${adminToken}`
                    },

                    body: JSON.stringify({
                        status,
                        moderationNote
                    })
                }
            );

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                localStorage.removeItem("shopzone-admin-token");

                window.location.href = "admin.html";

                return;
            }

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message || `Unable to ${action} review.`
                );
            }

            showMessage(
                status === "approved"
                    ? "Review approved successfully. Product rating updated."
                    : "Review rejected successfully. Product rating updated."
            );

            await loadAdminReviews();

        } catch (error) {

            console.error(
                "Review moderation error:",
                error
            );

            showMessage(error.message, "error");
        }
    }

    // =====================================
    // DELETE CUSTOMER REVIEW
    // =====================================

    async function deleteReview(reviewId) {

        const confirmed = window.confirm(
            "Are you sure you want to delete this customer review? This action cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        try {

            showMessage("Deleting review...");

            const response = await fetch(
                `${MODERATION_API_URL}/${encodeURIComponent(reviewId)}`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization": `Bearer ${adminToken}`
                    }
                }
            );

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                localStorage.removeItem("shopzone-admin-token");

                window.location.href = "admin.html";

                return;
            }

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message || "Unable to delete review."
                );
            }

            showMessage(
                "Customer review deleted successfully. Product rating updated."
            );

            await loadAdminReviews();

        } catch (error) {

            console.error(
                "Deleting customer review error:",
                error
            );

            showMessage(error.message, "error");
        }
    }

    // =====================================
    // REVIEW TABLE BUTTON EVENTS
    // =====================================

    if (reviewsTableBody) {

        reviewsTableBody.addEventListener(
            "click",
            function (event) {

                const approveRejectButton = event.target.closest(
                    ".admin-moderate-review-button"
                );

                if (approveRejectButton) {

                    const reviewId =
                        approveRejectButton.dataset.reviewId;

                    const status =
                        approveRejectButton.dataset.status;

                    if (reviewId && status) {

                        moderateReview(reviewId, status);
                    }

                    return;
                }

                const deleteButton = event.target.closest(
                    ".admin-delete-review-button"
                );

                if (deleteButton) {

                    const reviewId =
                        deleteButton.dataset.reviewId;

                    if (reviewId) {
                        deleteReview(reviewId);
                    }
                }
            }
        );
    }

    // =====================================
    // SEARCH EVENT
    // =====================================

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            displayFilteredReviews
        );
    }

    // =====================================
    // FILTER EVENT
    // =====================================

    if (filterSelect) {

        filterSelect.addEventListener(
            "change",
            displayFilteredReviews
        );
    }

    // =====================================
    // INITIALIZE REVIEW MANAGEMENT
    // =====================================

    loadAdminReviews();

})();
// =====================================
// SHOPZONE ADMIN COUPON MANAGEMENT
// =====================================

(function () {
    if (window.shopZoneCouponManagementLoaded) {
        return;
    }

    window.shopZoneCouponManagementLoaded = true;

    const COUPONS_API_URL = "http://localhost:5000/api/coupons";
    const COUPON_ANALYTICS_URL = `${COUPONS_API_URL}/analytics`;

    const couponAdminToken = localStorage.getItem("shopzone-admin-token");

    // =====================================
    // HTML ELEMENTS
    // =====================================

    const couponForm = document.getElementById("coupon-form");
    const couponCodeInput = document.getElementById("coupon-code");
    const couponDiscountTypeInput = document.getElementById("coupon-discount-type");
    const couponDiscountValueInput = document.getElementById("coupon-discount-value");
    const couponMinimumOrderInput = document.getElementById("coupon-minimum-order");
    const couponMaximumDiscountInput = document.getElementById("coupon-maximum-discount");
    const couponUsageLimitInput = document.getElementById("coupon-usage-limit");
    const couponExpiryDateInput = document.getElementById("coupon-expiry-date");

    const saveCouponButton = document.getElementById("save-coupon-button");
    const couponMessage = document.getElementById("coupon-message");
    const couponsTableBody = document.getElementById("coupons-table-body");

    let editingCouponId = null;

    // =====================================
    // CREATE ANALYTICS SECTION
    // =====================================

    const couponSection = document.getElementById("coupons");

    const couponAnalyticsContainer = document.createElement("div");

    couponAnalyticsContainer.id = "coupon-analytics-container";

    couponAnalyticsContainer.innerHTML = `
        <div class="section-heading" style="margin-top:30px;">
            <h2>Coupon Usage Analytics</h2>
            <span>Monitor coupon performance and discount spending</span>
        </div>

        <div id="coupon-analytics-message">
            Loading coupon analytics...
        </div>

        <div id="coupon-analytics-summary"
             style="
                display:grid;
                grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
                gap:20px;
                margin:20px 0;
             ">
        </div>

        <div class="analytics-card" style="margin-bottom:25px;">
            <h3>Individual Coupon Performance</h3>
            <p>See how each promotional code performs.</p>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Coupon Code</th>
                            <th>Total Uses</th>
                            <th>Discounts Given</th>
                            <th>Revenue Generated</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody id="coupon-performance-body">
                        <tr>
                            <td colspan="5">Loading coupon performance...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const couponFormContainer = couponSection
        ? couponSection.querySelector(".product-form-container")
        : null;

    if (couponFormContainer) {
        couponFormContainer.insertAdjacentElement(
            "beforebegin",
            couponAnalyticsContainer
        );
    }

    const couponAnalyticsMessage =
        document.getElementById("coupon-analytics-message");

    const couponAnalyticsSummary =
        document.getElementById("coupon-analytics-summary");

    const couponPerformanceBody =
        document.getElementById("coupon-performance-body");

    // =====================================
    // CANCEL EDIT BUTTON
    // =====================================

    const cancelEditButton = document.createElement("button");

    cancelEditButton.type = "button";
    cancelEditButton.textContent = "Cancel Edit";
    cancelEditButton.style.display = "none";
    cancelEditButton.style.marginLeft = "10px";
    cancelEditButton.style.padding = "10px 15px";
    cancelEditButton.style.cursor = "pointer";

    if (saveCouponButton) {
        saveCouponButton.insertAdjacentElement(
            "afterend",
            cancelEditButton
        );
    }

    // =====================================
    // CURRENCY FORMAT
    // =====================================

    function formatCouponCurrency(amount) {
        return `₦${Number(amount || 0).toLocaleString("en-NG", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    // =====================================
    // CONVERT DATE TO LOCAL DATETIME INPUT
    // =====================================

    function formatDateForDateTimeInput(dateValue) {
        if (!dateValue) {
            return "";
        }

        const date = new Date(dateValue);

        if (isNaN(date.getTime())) {
            return "";
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // =====================================
    // AUTHENTICATION
    // =====================================

    function checkCouponAuthentication(response) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("shopzone-admin-token");
            window.location.href = "admin.html";
            return true;
        }

        return false;
    }

    // =====================================
    // DISPLAY MESSAGE
    // =====================================

    function showCouponMessage(message, color) {
        if (!couponMessage) return;

        couponMessage.textContent = message;
        couponMessage.style.color = color;
    }

    // =====================================
    // CREATE TABLE CELL
    // =====================================

    function createCouponCell(value) {
        const cell = document.createElement("td");
        cell.textContent = value;
        return cell;
    }

    // =====================================
    // RESET FORM
    // =====================================

    function resetCouponForm(clearMessage = true) {
        editingCouponId = null;

        if (couponForm) {
            couponForm.reset();
        }

        if (saveCouponButton) {
            saveCouponButton.textContent = "Create Coupon";
        }

        cancelEditButton.style.display = "none";

        if (clearMessage) {
            showCouponMessage("", "");
        }
    }

    cancelEditButton.addEventListener("click", () => {
        resetCouponForm();
    });

    // =====================================
    // LOAD COUPON ANALYTICS
    // =====================================

    async function loadCouponAnalytics() {
        if (!couponAnalyticsSummary || !couponPerformanceBody) {
            return;
        }

        couponAnalyticsMessage.textContent =
            "Loading coupon analytics...";

        try {
            const response = await fetch(COUPON_ANALYTICS_URL, {
                headers: {
                    Authorization: `Bearer ${couponAdminToken}`
                }
            });

            if (checkCouponAuthentication(response)) return;

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to load coupon analytics."
                );
            }

            displayCouponAnalytics(data.analytics);

        } catch (error) {
            console.error("Coupon analytics error:", error);

            couponAnalyticsMessage.textContent =
                "Unable to load coupon analytics. Please refresh the page.";

            couponPerformanceBody.innerHTML =
                '<tr><td colspan="5">Could not load coupon performance.</td></tr>';
        }
    }

    // =====================================
    // DISPLAY COUPON ANALYTICS
    // =====================================

    function displayCouponAnalytics(analytics) {
        couponAnalyticsMessage.textContent =
            "Coupon analytics updated successfully.";

        couponAnalyticsMessage.style.color = "green";

        const cards = [
            {
                title: "Total Coupons",
                value: analytics.totalCoupons
            },
            {
                title: "Active Coupons",
                value: analytics.activeCoupons
            },
            {
                title: "Inactive Coupons",
                value: analytics.inactiveCoupons
            },
            {
                title: "Total Coupon Uses",
                value: analytics.totalCouponUses
            },
            {
                title: "Total Discounts Given",
                value: formatCouponCurrency(
                    analytics.totalDiscountsGiven
                )
            },
            {
                title: "Most Used Coupon",
                value: analytics.mostUsedCoupon
            }
        ];

        couponAnalyticsSummary.innerHTML = "";

        cards.forEach(card => {
            const cardElement = document.createElement("div");

            cardElement.className = "stat-card";

            cardElement.style.padding = "20px";
            cardElement.style.minHeight = "100px";

            const heading = document.createElement("h3");
            heading.textContent = card.title;

            const value = document.createElement("p");
            value.textContent = card.value ?? 0;
            value.style.fontSize = "22px";
            value.style.fontWeight = "bold";
            value.style.overflowWrap = "anywhere";

            cardElement.append(heading, value);

            couponAnalyticsSummary.appendChild(cardElement);
        });

        displayCouponPerformance(
            analytics.couponPerformance || []
        );
    }

    // =====================================
    // DISPLAY INDIVIDUAL COUPON PERFORMANCE
    // =====================================

    function displayCouponPerformance(coupons) {
        couponPerformanceBody.innerHTML = "";

        if (coupons.length === 0) {
            couponPerformanceBody.innerHTML =
                '<tr><td colspan="5">No coupons available for analytics.</td></tr>';

            return;
        }

        coupons.forEach(coupon => {
            const row = document.createElement("tr");

            row.appendChild(
                createCouponCell(coupon.code)
            );

            row.appendChild(
                createCouponCell(coupon.actualUses)
            );

            row.appendChild(
                createCouponCell(
                    formatCouponCurrency(coupon.totalDiscount)
                )
            );

            row.appendChild(
                createCouponCell(
                    formatCouponCurrency(coupon.revenueGenerated)
                )
            );

            const statusCell = document.createElement("td");

            statusCell.textContent = coupon.isActive
                ? "Active"
                : "Inactive";

            statusCell.style.color = coupon.isActive
                ? "green"
                : "red";

            statusCell.style.fontWeight = "bold";

            row.appendChild(statusCell);

            couponPerformanceBody.appendChild(row);
        });
    }

    // =====================================
    // LOAD COUPONS
    // =====================================

    async function loadCoupons() {
        if (!couponsTableBody) return;

        couponsTableBody.innerHTML =
            '<tr><td colspan="7">Loading coupons...</td></tr>';

        try {
            const response = await fetch(COUPONS_API_URL, {
                headers: {
                    Authorization: `Bearer ${couponAdminToken}`
                }
            });

            if (checkCouponAuthentication(response)) return;

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to load coupons."
                );
            }

            displayCoupons(data.coupons || []);

        } catch (error) {
            console.error("Coupon loading error:", error);

            couponsTableBody.innerHTML =
                '<tr><td colspan="7">Could not load coupons.</td></tr>';
        }
    }

    // =====================================
    // DISPLAY COUPONS
    // =====================================

    function displayCoupons(coupons) {
        couponsTableBody.innerHTML = "";

        if (coupons.length === 0) {
            couponsTableBody.innerHTML =
                '<tr><td colspan="7">No discount coupons have been created yet.</td></tr>';

            return;
        }

        coupons.forEach(coupon => {
            const row = document.createElement("tr");

            row.appendChild(
                createCouponCell(coupon.code || "N/A")
            );

            const discountText = coupon.discountType === "percentage"
                ? `${coupon.discountValue}%`
                : formatCouponCurrency(coupon.discountValue);

            row.appendChild(
                createCouponCell(discountText)
            );

            row.appendChild(
                createCouponCell(
                    formatCouponCurrency(coupon.minimumOrderAmount)
                )
            );

            const usageText = coupon.usageLimit !== null &&
                coupon.usageLimit !== undefined
                ? `${coupon.usedCount || 0} / ${coupon.usageLimit}`
                : `${coupon.usedCount || 0} / Unlimited`;

            row.appendChild(
                createCouponCell(usageText)
            );

            let expiryText = "No expiry";

            if (coupon.expiryDate) {
                const expiry = new Date(coupon.expiryDate);

                expiryText = isNaN(expiry.getTime())
                    ? "Invalid date"
                    : expiry.toLocaleString("en-NG");
            }

            row.appendChild(
                createCouponCell(expiryText)
            );

            const statusCell = document.createElement("td");

            const statusBadge = document.createElement("span");

            statusBadge.textContent = coupon.isActive
                ? "Active"
                : "Inactive";

            statusBadge.style.fontWeight = "bold";

            statusBadge.style.color = coupon.isActive
                ? "green"
                : "red";

            statusCell.appendChild(statusBadge);
            row.appendChild(statusCell);

            const actionCell = document.createElement("td");

            // EDIT
            const editButton = document.createElement("button");

            editButton.textContent = "Edit";
            editButton.style.margin = "3px";
            editButton.style.padding = "7px 10px";

            editButton.addEventListener("click", () => {
                editCoupon(coupon);
            });

            // ACTIVATE / DEACTIVATE
            const statusButton = document.createElement("button");

            statusButton.textContent = coupon.isActive
                ? "Deactivate"
                : "Activate";

            statusButton.style.margin = "3px";
            statusButton.style.padding = "7px 10px";

            statusButton.addEventListener("click", () => {
                updateCouponStatus(
                    coupon._id,
                    !coupon.isActive,
                    statusButton
                );
            });

            // DELETE
            const deleteButton = document.createElement("button");

            deleteButton.textContent = "Delete";
            deleteButton.style.margin = "3px";
            deleteButton.style.padding = "7px 10px";
            deleteButton.style.background = "#dc3545";
            deleteButton.style.color = "#ffffff";
            deleteButton.style.border = "none";
            deleteButton.style.borderRadius = "4px";

            deleteButton.addEventListener("click", () => {
                deleteCoupon(
                    coupon._id,
                    coupon.code,
                    deleteButton
                );
            });

            actionCell.append(
                editButton,
                statusButton,
                deleteButton
            );

            row.appendChild(actionCell);

            couponsTableBody.appendChild(row);
        });
    }

    // =====================================
    // EDIT COUPON
    // =====================================

    function editCoupon(coupon) {
        editingCouponId = coupon._id;

        couponCodeInput.value = coupon.code || "";
        couponDiscountTypeInput.value = coupon.discountType;
        couponDiscountValueInput.value = coupon.discountValue;

        couponMinimumOrderInput.value =
            coupon.minimumOrderAmount ?? 0;

        couponMaximumDiscountInput.value =
            coupon.maximumDiscountAmount ?? "";

        couponUsageLimitInput.value =
            coupon.usageLimit ?? "";

        couponExpiryDateInput.value =
            formatDateForDateTimeInput(coupon.expiryDate);

        saveCouponButton.textContent = "Update Coupon";

        cancelEditButton.style.display = "inline-block";

        showCouponMessage(
            `Editing coupon ${coupon.code}. Make your changes and click Update Coupon.`,
            "#007bff"
        );

        couponForm.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    // =====================================
    // CREATE OR UPDATE COUPON
    // =====================================

    if (couponForm) {
        couponForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const code = couponCodeInput.value.trim().toUpperCase();

            const discountType = couponDiscountTypeInput.value;

            const discountValue =
                Number(couponDiscountValueInput.value);

            const minimumOrderAmount =
                Number(couponMinimumOrderInput.value || 0);

            const maximumDiscountAmount =
                couponMaximumDiscountInput.value.trim() === ""
                    ? null
                    : Number(couponMaximumDiscountInput.value);

            const usageLimit =
                couponUsageLimitInput.value.trim() === ""
                    ? null
                    : Number(couponUsageLimitInput.value);

            const expiryInput = couponExpiryDateInput.value.trim();

            let expiryDate = null;

            // CORRECT DATETIME-LOCAL HANDLING
            if (expiryInput) {
                const parsedDate = new Date(expiryInput);

                if (isNaN(parsedDate.getTime())) {
                    showCouponMessage(
                        "Please enter a valid expiry date and time.",
                        "red"
                    );

                    return;
                }

                expiryDate = parsedDate.toISOString();
            }

            if (!code) {
                showCouponMessage(
                    "Please enter a coupon code.",
                    "red"
                );

                return;
            }

            if (!["percentage", "fixed"].includes(discountType)) {
                showCouponMessage(
                    "Please select a valid discount type.",
                    "red"
                );

                return;
            }

            if (!Number.isFinite(discountValue) || discountValue <= 0) {
                showCouponMessage(
                    "Enter a valid discount value greater than zero.",
                    "red"
                );

                return;
            }

            if (discountType === "percentage" && discountValue > 100) {
                showCouponMessage(
                    "Percentage discount cannot exceed 100%.",
                    "red"
                );

                return;
            }

            if (
                !Number.isFinite(minimumOrderAmount) ||
                minimumOrderAmount < 0
            ) {
                showCouponMessage(
                    "Enter a valid minimum order amount.",
                    "red"
                );

                return;
            }

            if (
                maximumDiscountAmount !== null &&
                (
                    !Number.isFinite(maximumDiscountAmount) ||
                    maximumDiscountAmount < 0
                )
            ) {
                showCouponMessage(
                    "Enter a valid maximum discount amount.",
                    "red"
                );

                return;
            }

            if (
                usageLimit !== null &&
                (!Number.isSafeInteger(usageLimit) || usageLimit < 1)
            ) {
                showCouponMessage(
                    "Usage limit must be a positive whole number.",
                    "red"
                );

                return;
            }

            if (
                discountType === "fixed" &&
                maximumDiscountAmount !== null
            ) {
                showCouponMessage(
                    "Maximum discount is only needed for percentage coupons.",
                    "red"
                );

                return;
            }

            const couponData = {
                code,
                discountType,
                discountValue,
                minimumOrderAmount,
                maximumDiscountAmount,
                usageLimit,
                expiryDate
            };

            const isEditing = Boolean(editingCouponId);

            const requestURL = isEditing
                ? `${COUPONS_API_URL}/${editingCouponId}`
                : COUPONS_API_URL;

            const requestMethod = isEditing ? "PUT" : "POST";

            saveCouponButton.disabled = true;

            saveCouponButton.textContent = isEditing
                ? "Updating..."
                : "Saving...";

            showCouponMessage(
                isEditing ? "Updating coupon..." : "Creating coupon...",
                "#555"
            );

            try {
                const response = await fetch(requestURL, {
                    method: requestMethod,
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${couponAdminToken}`
                    },
                    body: JSON.stringify(couponData)
                });

                if (checkCouponAuthentication(response)) return;

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || "Unable to save coupon."
                    );
                }

                resetCouponForm(false);

                showCouponMessage(
                    data.message ||
                    (
                        isEditing
                            ? "Coupon updated successfully!"
                            : "Coupon created successfully!"
                    ),
                    "green"
                );

                await Promise.all([
                    loadCoupons(),
                    loadCouponAnalytics()
                ]);

            } catch (error) {
                console.error("Coupon saving error:", error);

                showCouponMessage(error.message, "red");

            } finally {
                saveCouponButton.disabled = false;

                saveCouponButton.textContent = editingCouponId
                    ? "Update Coupon"
                    : "Create Coupon";
            }
        });
    }

    // =====================================
    // ACTIVATE OR DEACTIVATE
    // =====================================

    async function updateCouponStatus(couponId, isActive, button) {
        const action = isActive ? "activate" : "deactivate";

        if (!confirm(`Are you sure you want to ${action} this coupon?`)) {
            return;
        }

        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = "Updating...";

        try {
            const response = await fetch(
                `${COUPONS_API_URL}/${couponId}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${couponAdminToken}`
                    },
                    body: JSON.stringify({ isActive })
                }
            );

            if (checkCouponAuthentication(response)) return;

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to update coupon."
                );
            }

            showCouponMessage(
                data.message || `Coupon ${action}d successfully!`,
                "green"
            );

            await Promise.all([
                loadCoupons(),
                loadCouponAnalytics()
            ]);

        } catch (error) {
            console.error("Coupon status update error:", error);

            showCouponMessage(error.message, "red");

            button.disabled = false;
            button.textContent = originalText;
        }
    }

    // =====================================
    // DELETE COUPON
    // =====================================

    async function deleteCoupon(couponId, couponCode, button) {
        if (
            !confirm(
                `Are you sure you want to delete coupon ${couponCode}?\n\nThis action cannot be undone.`
            )
        ) {
            return;
        }

        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = "Deleting...";

        try {
            const response = await fetch(
                `${COUPONS_API_URL}/${couponId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${couponAdminToken}`
                    }
                }
            );

            if (checkCouponAuthentication(response)) return;

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to delete coupon."
                );
            }

            showCouponMessage(
                data.message || "Coupon deleted successfully!",
                "green"
            );

            await Promise.all([
                loadCoupons(),
                loadCouponAnalytics()
            ]);

        } catch (error) {
            console.error("Coupon deletion error:", error);

            showCouponMessage(error.message, "red");

            button.disabled = false;
            button.textContent = originalText;
        }
    }

    // =====================================
    // START
    // =====================================

    if (couponAdminToken) {
        loadCoupons();
        loadCouponAnalytics();
    }

})();
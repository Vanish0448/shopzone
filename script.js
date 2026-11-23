// =====================================
// SHOPZONE API CONFIGURATION
// =====================================

const API_URL = "https://shopzone-sojz.onrender.com/api/orders";
const PRODUCTS_API_URL = "https://shopzone-sojz.onrender.com/api/products";
const TRACK_ORDER_API_URL = "https://shopzone-sojz.onrender.com/api/orders/track";
const COUPONS_API_URL = "https://shopzone-sojz.onrender.com/api/coupons";


// =====================================
// SHOPZONE PRODUCT DATA
// =====================================

let products = [];
let cart = [];
let orderHistory = [];


// =====================================
// COUPON DATA
// =====================================

let appliedCouponCode = "";
let appliedCouponDiscount = 0;


// =====================================
// HTML ELEMENTS
// =====================================

const productList = document.getElementById("product-list");
const cartItems = document.getElementById("cart-items");
const cartCount = document.getElementById("cart-count");
const cartTotal = document.getElementById("cart-total");

const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");

const clearCartButton = document.getElementById("clear-cart");
const checkoutButton = document.getElementById("checkout-button");

const checkoutSection = document.getElementById("checkout-section");
const checkoutForm = document.getElementById("checkout-form");
const checkoutSummary = document.getElementById("checkout-summary");
const checkoutTotal = document.getElementById("checkout-total");

const checkoutSubtotal = document.getElementById("checkout-subtotal");
const checkoutDiscount = document.getElementById("checkout-discount");
const checkoutDiscountRow = document.getElementById("checkout-discount-row");

const couponCodeInput = document.getElementById("coupon-code");
const applyCouponButton = document.getElementById("apply-coupon-button");
const couponMessage = document.getElementById("coupon-message");

const cancelCheckoutButton = document.getElementById("cancel-checkout");

const confirmationSection = document.getElementById("confirmation-section");
const orderNumber = document.getElementById("order-number");
const confirmationMessage = document.getElementById("confirmation-message");
const continueShoppingButton = document.getElementById("continue-shopping");

const orderHistoryList = document.getElementById("order-history-list");
const clearHistoryButton = document.getElementById("clear-history");


// =====================================
// CUSTOMER ORDER TRACKING ELEMENTS
// =====================================

const trackOrderForm = document.getElementById("track-order-form");
const trackOrderNumber = document.getElementById("track-order-number");
const trackOrderEmail = document.getElementById("track-order-email");
const trackOrderButton = document.getElementById("track-order-button");
const trackingResult = document.getElementById("tracking-result");


// =====================================
// PRODUCT REVIEW NAVIGATION ELEMENTS
// =====================================

const reviewsSection = document.getElementById("product-reviews");
const reviewsProductFilter = document.getElementById("reviews-product-filter");


// =====================================
// HELPER: ESCAPE HTML
// =====================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


// =====================================
// HELPER: FORMAT NAIRA
// =====================================

function formatNaira(amount) {
    return `₦${Number(amount || 0).toLocaleString("en-NG")}`;
}


// =====================================
// HELPER: DISPLAY PRODUCT RATINGS
// =====================================

function displayProductRating(product) {

    const rating = Number(product.averageRating || 0);
    const reviewCount = Number(product.numReviews || 0);

    const ratingText = reviewCount === 0
        ? "No reviews yet"
        : `
            <span class="product-rating-stars">
                ${"★".repeat(Math.round(rating))}${"☆".repeat(5 - Math.round(rating))}
            </span>

            <span class="product-rating-number">
                ${rating.toFixed(1)}/5
            </span>

            <span class="product-review-count">
                (${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})
            </span>
        `;

    return `
        <button
            type="button"
            class="product-rating product-rating-link ${reviewCount === 0 ? "no-reviews" : ""}"
            data-review-product-id="${escapeHTML(product.id)}"
            aria-label="View reviews for ${escapeHTML(product.name)}"
            title="Click to view ${escapeHTML(product.name)} reviews"
        >
            ${ratingText}
        </button>
    `;
}


// =====================================
// CLEAR OLD UNSAFE ORDER HISTORY CACHE
// =====================================

if (!localStorage.getItem("shopzone-history-migrated")) {

    localStorage.removeItem("shopzone-orders");

    localStorage.setItem(
        "shopzone-history-migrated",
        "true"
    );
}


// =====================================
// LOAD PRODUCTS FROM MONGODB
// =====================================

async function loadProducts() {

    productList.innerHTML = "<p>Loading products...</p>";

    try {

        const response = await fetch(PRODUCTS_API_URL);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load products.");
        }

        products = data.products.map(product => ({

            id: String(product._id),

            name: product.name,

            price: Number(product.price),

            category: product.category,

            image: product.image ||
                "https://placehold.co/300x200?text=ShopZone+Product",

            description: product.description || "",

            stock: Number(product.stock ?? 0),

            averageRating: Number(product.averageRating || 0),

            numReviews: Number(product.numReviews || 0)

        }));

        cart = loadCart();

        filterProducts();

        updateCart();

        console.log("Products loaded successfully:", products);

    } catch (error) {

        console.error("Product loading error:", error);

        productList.innerHTML = `
            <p>
                Unable to load products.
                Please make sure the ShopZone backend is running.
            </p>
        `;

        products = [];
        cart = [];

        updateCart();
    }
}


// =====================================
// LOAD SAVED CART
// =====================================

function loadCart() {

    try {

        const savedCart = JSON.parse(
            localStorage.getItem("shopzone-cart")
        );

        if (!Array.isArray(savedCart)) {
            return [];
        }

        return savedCart

            .filter(item =>
                item.id !== undefined &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0 &&
                item.quantity <= 99 &&
                products.some(product => product.id === String(item.id))
            )

            .map(item => {

                const product = products.find(
                    product => product.id === String(item.id)
                );

                return {
                    ...product,
                    quantity: Math.min(item.quantity, product.stock)
                };

            })

            .filter(item => item.quantity > 0);

    } catch (error) {

        return [];

    }
}


// =====================================
// LOAD LOCAL ORDER HISTORY
// =====================================

function loadOrderHistory() {

    try {

        const savedOrders = JSON.parse(
            localStorage.getItem("shopzone-orders")
        );

        if (!Array.isArray(savedOrders)) {
            return [];
        }

        return savedOrders;

    } catch (error) {

        return [];

    }
}


orderHistory = loadOrderHistory();


// =====================================
// SAVE CART
// =====================================

function saveCart() {

    localStorage.setItem(
        "shopzone-cart",

        JSON.stringify(
            cart.map(item => ({
                id: item.id,
                quantity: item.quantity
            }))
        )
    );
}


// =====================================
// SAVE ORDER HISTORY
// =====================================

function saveOrderHistory() {

    localStorage.setItem(
        "shopzone-orders",
        JSON.stringify(orderHistory)
    );
}


// =====================================
// COUPON: GET CART SUBTOTAL
// =====================================

function getCartSubtotal() {

    return cart.reduce(
        (total, item) => total + item.price * item.quantity,
        0
    );
}


// =====================================
// COUPON: RESET APPLIED COUPON
// =====================================

function resetAppliedCoupon(showMessage = false) {

    appliedCouponCode = "";
    appliedCouponDiscount = 0;

    if (couponCodeInput) {
        couponCodeInput.value = "";
    }

    if (couponMessage) {

        couponMessage.textContent = showMessage
            ? "Cart updated. Please apply your promo code again."
            : "";

        couponMessage.className = "";
    }

    updateCheckoutPriceSummary();
}


// =====================================
// COUPON: UPDATE CHECKOUT PRICE SUMMARY
// =====================================

function updateCheckoutPriceSummary() {

    const subtotal = getCartSubtotal();

    const validDiscount = Math.min(
        appliedCouponDiscount,
        subtotal
    );

    const finalTotal = Math.max(
        0,
        subtotal - validDiscount
    );

    if (checkoutSubtotal) {
        checkoutSubtotal.textContent = formatNaira(subtotal);
    }

    if (checkoutDiscount) {
        checkoutDiscount.textContent =
            `-${formatNaira(validDiscount)}`;
    }

    if (checkoutDiscountRow) {
        checkoutDiscountRow.hidden = validDiscount <= 0;
    }

    checkoutTotal.textContent = formatNaira(finalTotal);
}


// =====================================
// DISPLAY PRODUCTS
// =====================================

function displayProducts(productArray) {

    productList.innerHTML = "";

    if (productArray.length === 0) {

        productList.innerHTML = "<p>No products found.</p>";

        return;
    }

    productArray.forEach(product => {

        const productCard = document.createElement("div");

        productCard.className = "product-card";

        const stockMessage = product.stock > 0
            ? `Stock: ${product.stock}`
            : "Out of stock";

        const ratingHTML = displayProductRating(product);

        productCard.innerHTML = `

            <img
                src="${escapeHTML(product.image)}"
                alt="${escapeHTML(product.name)}"
            >

            <h3>${escapeHTML(product.name)}</h3>

            ${ratingHTML}

            <p>${formatNaira(product.price)}</p>

            <p>${stockMessage}</p>

            <button
                class="add-button"
                data-id="${escapeHTML(product.id)}"
                ${product.stock <= 0 ? "disabled" : ""}
            >
                ${product.stock > 0 ? "Add to Cart" : "Out of Stock"}
            </button>

        `;

        productList.appendChild(productCard);

    });
}


// =====================================
// ADD TO CART
// =====================================

function addToCart(productId) {

    const product = products.find(
        item => item.id === String(productId)
    );

    if (!product) return;

    if (product.stock <= 0) {

        alert("This product is out of stock.");

        return;
    }

    const existingItem = cart.find(
        item => item.id === product.id
    );

    if (existingItem) {

        if (
            existingItem.quantity >= 99 ||
            existingItem.quantity >= product.stock
        ) {

            alert("You cannot add more than the available stock.");

            return;
        }

        existingItem.quantity++;

    } else {

        cart.push({
            ...product,
            quantity: 1
        });

    }

    resetAppliedCoupon(true);

    saveCart();

    updateCart();

    displayCheckoutSummary();
}


// =====================================
// INCREASE QUANTITY
// =====================================

function increaseQuantity(productId) {

    const item = cart.find(
        product => product.id === String(productId)
    );

    if (!item) return;

    if (item.quantity >= item.stock || item.quantity >= 99) {

        alert("You have reached the available stock limit.");

        return;
    }

    item.quantity++;

    resetAppliedCoupon(true);

    saveCart();

    updateCart();

    displayCheckoutSummary();
}


// =====================================
// DECREASE QUANTITY
// =====================================

function decreaseQuantity(productId) {

    const item = cart.find(
        product => product.id === String(productId)
    );

    if (!item) return;

    if (item.quantity > 1) {

        item.quantity--;

    } else {

        cart = cart.filter(
            product => product.id !== String(productId)
        );

    }

    resetAppliedCoupon(true);

    saveCart();

    updateCart();

    displayCheckoutSummary();
}


// =====================================
// REMOVE PRODUCT
// =====================================

function removeFromCart(productId) {

    cart = cart.filter(
        item => item.id !== String(productId)
    );

    resetAppliedCoupon(true);

    saveCart();

    updateCart();

    displayCheckoutSummary();
}


// =====================================
// CLEAR CART
// =====================================

function clearCart() {

    cart = [];

    resetAppliedCoupon();

    saveCart();

    updateCart();

    checkoutSection.hidden = true;
}


// =====================================
// UPDATE CART DISPLAY
// =====================================

function updateCart() {

    cartItems.innerHTML = "";

    let totalQuantity = 0;
    let totalPrice = 0;

    if (cart.length === 0) {

        cartItems.innerHTML = "<p>Your cart is empty.</p>";

    }

    cart.forEach(item => {

        totalQuantity += item.quantity;

        totalPrice += item.price * item.quantity;

        const cartItem = document.createElement("div");

        cartItem.className = "cart-item";

        cartItem.innerHTML = `

            <div class="cart-item-info">

                <h3>${escapeHTML(item.name)}</h3>

                <p>${formatNaira(item.price)}</p>

                <p>Quantity: ${item.quantity}</p>

            </div>

            <div class="cart-actions">

                <button
                    class="quantity-button"
                    data-action="decrease"
                    data-id="${escapeHTML(item.id)}"
                >-</button>

                <span>${item.quantity}</span>

                <button
                    class="quantity-button"
                    data-action="increase"
                    data-id="${escapeHTML(item.id)}"
                >+</button>

                <button
                    class="remove-button"
                    data-action="remove"
                    data-id="${escapeHTML(item.id)}"
                >Remove</button>

            </div>

        `;

        cartItems.appendChild(cartItem);

    });

    cartCount.textContent = totalQuantity;

    cartTotal.textContent = formatNaira(totalPrice);

    checkoutButton.hidden = cart.length === 0;

    updateCheckoutPriceSummary();
}


// =====================================
// SEARCH AND CATEGORY FILTER
// =====================================

function filterProducts() {

    const searchTerm = searchInput.value.toLowerCase().trim();

    const selectedCategory = categoryFilter.value;

    const filteredProducts = products.filter(product => {

        const matchesSearch =
            product.name.toLowerCase().includes(searchTerm);

        const matchesCategory =
            selectedCategory === "all" ||
            product.category === selectedCategory;

        return matchesSearch && matchesCategory;

    });

    displayProducts(filteredProducts);
}


// =====================================
// DISPLAY CHECKOUT SUMMARY
// =====================================

function displayCheckoutSummary() {

    checkoutSummary.innerHTML = "";

    cart.forEach(item => {

        const itemTotal = item.price * item.quantity;

        const summaryItem = document.createElement("div");

        summaryItem.className = "summary-item";

        summaryItem.innerHTML = `

            <span>${escapeHTML(item.name)} x ${item.quantity}</span>

            <strong>${formatNaira(itemTotal)}</strong>

        `;

        checkoutSummary.appendChild(summaryItem);

    });

    updateCheckoutPriceSummary();
}


// =====================================
// APPLY COUPON
// =====================================

async function applyCoupon() {

    const code = couponCodeInput.value.trim().toUpperCase();

    const subtotal = getCartSubtotal();

    if (cart.length === 0 || subtotal <= 0) {

        couponMessage.textContent =
            "Please add products to your cart first.";

        couponMessage.className = "coupon-error";

        return;
    }

    if (!code) {

        couponMessage.textContent =
            "Please enter a promo code.";

        couponMessage.className = "coupon-error";

        return;
    }

    applyCouponButton.disabled = true;

    applyCouponButton.textContent = "Checking...";

    couponMessage.textContent = "Checking promo code...";

    couponMessage.className = "";

    try {

        const response = await fetch(
            `${COUPONS_API_URL}/validate`,

            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    code,
                    subtotal
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "This promo code could not be applied."
            );

        }

        appliedCouponCode = data.coupon.code;

        appliedCouponDiscount = Number(data.discountAmount);

        couponMessage.textContent =
            `Success! Coupon ${appliedCouponCode} applied. You saved ${formatNaira(appliedCouponDiscount)}.`;

        couponMessage.className = "coupon-success";

        updateCheckoutPriceSummary();

    } catch (error) {

        appliedCouponCode = "";

        appliedCouponDiscount = 0;

        couponMessage.textContent = error.message;

        couponMessage.className = "coupon-error";

        updateCheckoutPriceSummary();

    } finally {

        applyCouponButton.disabled = false;

        applyCouponButton.textContent = "Apply Coupon";

    }
}


// =====================================
// OPEN CHECKOUT
// =====================================

function openCheckout() {

    if (cart.length === 0) {

        alert("Please add a product to your cart first.");

        return;
    }

    displayCheckoutSummary();

    checkoutSection.hidden = false;

    confirmationSection.hidden = true;

    checkoutSection.scrollIntoView({
        behavior: "smooth"
    });
}


// =====================================
// PLACE ORDER AND SAVE TO MONGODB
// =====================================

checkoutForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    if (cart.length === 0) {

        alert("Your cart is empty.");

        checkoutSection.hidden = true;

        return;
    }

    const customerName =
        document.getElementById("customer-name").value.trim();

    const customerEmail =
        document.getElementById("customer-email").value.trim();

    const customerPhone =
        document.getElementById("customer-phone").value.trim();

    const deliveryAddress =
        document.getElementById("delivery-address").value.trim();

    if (
        !customerName ||
        !customerEmail ||
        !customerPhone ||
        !deliveryAddress
    ) {

        alert("Please complete all checkout fields.");

        return;
    }

    const newOrder = {

        orderNumber: "SZ-" + Date.now(),

        customerName,
        customerEmail,
        customerPhone,
        deliveryAddress,

        couponCode: appliedCouponCode,

        items: cart.map(item => ({

            productId: item.id,

            name: item.name,

            price: item.price,

            quantity: item.quantity

        }))

    };

    const submitButton = checkoutForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {

        submitButton.disabled = true;

        submitButton.textContent = "Processing Order...";

    }

    try {

        const response = await fetch(API_URL, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(newOrder)

        });

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Unable to save your order."
            );

        }

        const savedOrder = data.order;

        orderHistory.unshift({

            orderNumber: savedOrder.orderNumber,

            date: savedOrder.date ||
                savedOrder.createdAt ||
                new Date().toISOString(),

            items: savedOrder.items,

            subtotal: savedOrder.subtotal,

            couponCode: savedOrder.couponCode,

            discountAmount: savedOrder.discountAmount,

            total: savedOrder.total

        });

        saveOrderHistory();

        orderNumber.textContent = savedOrder.orderNumber;

        let confirmationText =
            `Thank you, ${customerName}! Your order total is ${formatNaira(savedOrder.total)}.`;

        if (savedOrder.discountAmount > 0) {

            confirmationText +=
                ` You saved ${formatNaira(savedOrder.discountAmount)} with promo code ${savedOrder.couponCode}.`;

        }

        confirmationText +=
            " Your order has been saved successfully. Product stock has been updated. This is a demonstration order; no payment has been collected.";

        confirmationMessage.textContent = confirmationText;

        cart = [];

        resetAppliedCoupon();

        saveCart();

        updateCart();

        checkoutForm.reset();

        checkoutSection.hidden = true;

        confirmationSection.hidden = false;

        displayOrderHistory();

        await loadProducts();

        confirmationSection.scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {

        console.error("Checkout error:", error);

        alert(
            error.message ||
            "Your order could not be saved. Please try again. Your cart has not been cleared."
        );

    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent = "Place Order";

        }

    }

});


// =====================================
// DISPLAY ORDER HISTORY
// =====================================

function displayOrderHistory() {

    orderHistoryList.innerHTML = "";

    if (orderHistory.length === 0) {

        orderHistoryList.innerHTML =
            '<p class="history-empty">You have not placed any orders on this browser yet.</p>';

        clearHistoryButton.hidden = true;

        return;
    }

    clearHistoryButton.hidden = true;

    orderHistory.forEach(order => {

        const orderCard = document.createElement("div");

        orderCard.className = "order-card";

        const orderDate = new Date(order.date);

        const formattedDate = orderDate.toLocaleString("en-NG", {

            dateStyle: "medium",

            timeStyle: "short"

        });

        const productListHTML = order.items.map(item => `

            <li>
                ${escapeHTML(item.name)} -
                ${item.quantity} x ${formatNaira(item.price)}
            </li>

        `).join("");

        orderCard.innerHTML = `

            <h3>Order ${escapeHTML(order.orderNumber)}</h3>

            <p><strong>Date:</strong> ${formattedDate}</p>

            <p><strong>Products:</strong></p>

            <ul class="order-products">
                ${productListHTML}
            </ul>

            ${order.couponCode ? `

                <p>
                    <strong>Promo Code:</strong>
                    ${escapeHTML(order.couponCode)}
                </p>

            ` : ""}

            ${Number(order.discountAmount) > 0 ? `

                <p>
                    <strong>Discount:</strong>
                    ${formatNaira(order.discountAmount)}
                </p>

            ` : ""}

            <p class="order-total">
                Total: ${formatNaira(order.total)}
            </p>

        `;

        orderHistoryList.appendChild(orderCard);

    });
}


// =====================================
// CLEAR ORDER HISTORY
// =====================================

function clearOrderHistory() {

    alert(
        "Order history is stored in your browser. Database deletion is not available from this page."
    );
}


// =====================================
// CUSTOMER ORDER TRACKING
// =====================================

function displayTrackingResult(order) {

    const orderDate = new Date(
        order.date || order.createdAt
    );

    const formattedDate = isNaN(orderDate.getTime())

        ? "Date unavailable"

        : orderDate.toLocaleString("en-NG", {

            dateStyle: "medium",

            timeStyle: "short"

        });

    const currentStatus = String(order.status || "Pending");

    const statusClass = currentStatus
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "");

    const statusSteps = [
        "Pending",
        "Processing",
        "Shipped",
        "Delivered"
    ];

    const normalizedStatus = currentStatus.toLowerCase();

    let timelineHTML = "";

    if (normalizedStatus === "cancelled") {

        timelineHTML = `

            <div class="tracking-timeline tracking-timeline-cancelled">

                <div class="timeline-cancelled-icon">
                    !
                </div>

                <div>

                    <h4>Order Cancelled</h4>

                    <p>
                        This order has been cancelled and will not proceed to delivery.
                    </p>

                </div>

            </div>

        `;

    } else {

        const currentStepIndex = statusSteps.findIndex(
            status => status.toLowerCase() === normalizedStatus
        );

        timelineHTML = `

            <div class="tracking-timeline">

                <h3>Order Progress</h3>

                <div class="timeline-steps">

                    ${statusSteps.map((status, index) => {

                        const isCompleted =
                            currentStepIndex >= 0 &&
                            index < currentStepIndex;

                        const isCurrent =
                            index === currentStepIndex;

                        const stepClass = [

                            "timeline-step",

                            isCompleted ? "completed" : "",

                            isCurrent ? "current" : ""

                        ].filter(Boolean).join(" ");

                        return `

                            <div class="${stepClass}">

                                <div class="timeline-marker">
                                    ${isCompleted ? "✓" : index + 1}
                                </div>

                                <div class="timeline-step-label">
                                    ${status}
                                </div>

                            </div>

                        `;

                    }).join("")}

                </div>

            </div>

        `;

    }

    const itemsHTML = (order.items || []).map(item => {

        const price = Number(item.price || 0);

        const quantity = Number(item.quantity || 0);

        const subtotal = price * quantity;

        return `

            <div class="tracking-item">

                <div class="tracking-item-info">

                    <h4>${escapeHTML(item.name)}</h4>

                    <p>
                        ${quantity} x ${formatNaira(price)}
                    </p>

                </div>

                <strong>
                    ${formatNaira(subtotal)}
                </strong>

            </div>

        `;

    }).join("");

    trackingResult.innerHTML = `

        <div class="tracking-order-card">

            <h3>Order Details</h3>

            <div class="tracking-detail">

                <span>Order Number:</span>

                <strong>
                    ${escapeHTML(order.orderNumber)}
                </strong>

            </div>

            <div class="tracking-detail">

                <span>Customer:</span>

                <strong>
                    ${escapeHTML(order.customerName)}
                </strong>

            </div>

            <div class="tracking-detail">

                <span>Order Date:</span>

                <strong>
                    ${escapeHTML(formattedDate)}
                </strong>

            </div>

            <div class="tracking-detail">

                <span>Order Status:</span>

                <strong class="tracking-status status-${statusClass}">
                    ${escapeHTML(currentStatus)}
                </strong>

            </div>

            ${timelineHTML}

            <h3 class="tracking-items-heading">
                Products Ordered
            </h3>

            <div class="tracking-items">
                ${itemsHTML || "<p>No products found.</p>"}
            </div>

            ${Number(order.subtotal) > 0 ? `

                <div class="tracking-detail">

                    <span>Subtotal:</span>

                    <strong>${formatNaira(order.subtotal)}</strong>

                </div>

            ` : ""}

            ${order.couponCode ? `

                <div class="tracking-detail">

                    <span>Promo Code:</span>

                    <strong>${escapeHTML(order.couponCode)}</strong>

                </div>

            ` : ""}

            ${Number(order.discountAmount) > 0 ? `

                <div class="tracking-detail">

                    <span>Discount:</span>

                    <strong>-${formatNaira(order.discountAmount)}</strong>

                </div>

            ` : ""}

            <div class="tracking-total">

                <span>Total Amount:</span>

                <strong>
                    ${formatNaira(order.total)}
                </strong>

            </div>

        </div>

    `;
}


// =====================================
// TRACK CUSTOMER ORDER
// =====================================

trackOrderForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const enteredOrderNumber =
        trackOrderNumber.value.trim();

    const enteredEmail =
        trackOrderEmail.value.trim();

    if (!enteredOrderNumber || !enteredEmail) {

        trackingResult.innerHTML = `

            <p class="tracking-error">
                Please enter your order number and email address.
            </p>

        `;

        return;
    }

    trackOrderButton.disabled = true;

    trackOrderButton.textContent = "Searching...";

    trackingResult.innerHTML = `

        <p class="tracking-loading">
            Searching for your order. Please wait...
        </p>

    `;

    try {

        const response = await fetch(TRACK_ORDER_API_URL, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                orderNumber: enteredOrderNumber,

                customerEmail: enteredEmail

            })

        });

        const data = await response.json();

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Order not found."
            );

        }

        displayTrackingResult(data.order);

    } catch (error) {

        console.error("Order tracking error:", error);

        trackingResult.innerHTML = `

            <div class="tracking-error">

                <p>${escapeHTML(error.message)}</p>

                <p>
                    Please check your order number and email address,
                    then try again.
                </p>

            </div>

        `;

    } finally {

        trackOrderButton.disabled = false;

        trackOrderButton.textContent = "Track My Order";

    }

});


// =====================================
// PRODUCT RATING CLICK NAVIGATION
// =====================================

productList.addEventListener("click", function(event) {

    const ratingButton = event.target.closest(
        ".product-rating-link"
    );

    if (!ratingButton) return;

    const productId = ratingButton.dataset.reviewProductId;

    if (!productId) return;

    if (!reviewsProductFilter || !reviewsSection) {

        console.error("Product review elements were not found.");

        return;
    }

    // SELECT THE CLICKED PRODUCT

    reviewsProductFilter.value = productId;

    // TELL reviews.js TO LOAD THE SELECTED PRODUCT'S REVIEWS

    reviewsProductFilter.dispatchEvent(
        new Event("change", { bubbles: true })
    );

    // SCROLL TO THE REVIEWS SECTION

    reviewsSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

});


// =====================================
// EVENT LISTENERS
// =====================================

productList.addEventListener("click", function(event) {

    if (event.target.classList.contains("add-button")) {

        const productId = event.target.dataset.id;

        addToCart(productId);

    }

});


cartItems.addEventListener("click", function(event) {

    const button = event.target.closest("button");

    if (!button) return;

    const productId = button.dataset.id;

    const action = button.dataset.action;

    if (action === "increase") {
        increaseQuantity(productId);
    }

    if (action === "decrease") {
        decreaseQuantity(productId);
    }

    if (action === "remove") {
        removeFromCart(productId);
    }

});


searchInput.addEventListener("input", filterProducts);

categoryFilter.addEventListener("change", filterProducts);

clearCartButton.addEventListener("click", clearCart);

checkoutButton.addEventListener("click", openCheckout);

applyCouponButton.addEventListener("click", applyCoupon);


couponCodeInput.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {

        event.preventDefault();

        applyCoupon();

    }

});


cancelCheckoutButton.addEventListener("click", function() {

    checkoutSection.hidden = true;

});


clearHistoryButton.addEventListener("click", clearOrderHistory);


continueShoppingButton.addEventListener("click", function() {

    confirmationSection.hidden = true;

    document.getElementById("products").scrollIntoView({
        behavior: "smooth"
    });

});


// =====================================
// START SHOPZONE
// =====================================

updateCart();

displayOrderHistory();

loadProducts();
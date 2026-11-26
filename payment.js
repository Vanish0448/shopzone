// =====================================
// SHOPZONE PAYSTACK PAYMENT INTEGRATION
// =====================================

// LIVE BACKEND PAYMENT API
// Paystack test keys remain on the backend.

const PAYMENT_API_URL =
    "https://shopzone-sojz.onrender.com/api/payments";


// =====================================
// HTML ELEMENTS
// =====================================

const paymentCheckoutForm =
    document.getElementById("checkout-form");

const paymentCheckoutSection =
    document.getElementById("checkout-section");

const paymentConfirmationSection =
    document.getElementById("confirmation-section");

const paymentOrderNumber =
    document.getElementById("order-number");

const paymentConfirmationMessage =
    document.getElementById("confirmation-message");

const paymentSubmitButton =
    paymentCheckoutForm.querySelector('button[type="submit"]');


// =====================================
// PAYMENT HELPER: DISPLAY MESSAGE
// =====================================

function showPaymentMessage(message, type = "error") {

    let messageElement = document.getElementById(
        "payment-message"
    );

    if (!messageElement) {

        messageElement = document.createElement("p");

        messageElement.id = "payment-message";

        messageElement.setAttribute("role", "alert");

        paymentCheckoutForm.insertBefore(
            messageElement,
            paymentSubmitButton
        );

    }

    messageElement.textContent = message;

    messageElement.className =
        type === "success"
            ? "coupon-success"
            : "coupon-error";
}


// =====================================
// PAYMENT HELPER: FORMAT NAIRA
// =====================================

function paymentFormatNaira(amount) {

    return `₦${Number(amount || 0).toLocaleString("en-NG")}`;

}


// =====================================
// PAYMENT HELPER: GET CART
// =====================================

function getPaymentCart() {

    try {

        const savedCart = JSON.parse(
            localStorage.getItem("shopzone-cart")
        );

        if (!Array.isArray(savedCart)) {
            return [];
        }

        return savedCart.filter(item =>

            item.id &&
            Number.isInteger(item.quantity) &&
            item.quantity >= 1 &&
            item.quantity <= 99

        );

    } catch (error) {

        return [];

    }
}


// =====================================
// PAYMENT HELPER: GET CUSTOMER DETAILS
// =====================================

function getPaymentCustomerDetails() {

    return {

        customerName:
            document.getElementById("customer-name").value.trim(),

        customerEmail:
            document.getElementById("customer-email").value.trim(),

        customerPhone:
            document.getElementById("customer-phone").value.trim(),

        deliveryAddress:
            document.getElementById("delivery-address").value.trim()

    };

}


// =====================================
// PAYMENT HELPER: GET APPLIED COUPON
// =====================================

function getPaymentCouponCode() {

    const couponMessage = document.getElementById(
        "coupon-message"
    );

    const couponInput = document.getElementById(
        "coupon-code"
    );

    if (
        couponMessage &&
        couponMessage.classList.contains("coupon-success")
    ) {

        return couponInput.value.trim().toUpperCase();

    }

    return "";

}


// =====================================
// INITIALIZE PAYSTACK PAYMENT
// =====================================

async function initializeShopZonePayment() {

    const cart = getPaymentCart();

    if (cart.length === 0) {

        showPaymentMessage(
            "Your cart is empty. Please add products before checkout."
        );

        return;

    }

    const customer = getPaymentCustomerDetails();

    if (
        !customer.customerName ||
        !customer.customerEmail ||
        !customer.customerPhone ||
        !customer.deliveryAddress
    ) {

        showPaymentMessage(
            "Please complete all checkout fields."
        );

        return;

    }

    const couponCode = getPaymentCouponCode();

    const requestData = {

        customerName: customer.customerName,

        customerEmail: customer.customerEmail,

        customerPhone: customer.customerPhone,

        deliveryAddress: customer.deliveryAddress,

        couponCode,

        items: cart.map(item => ({

            productId: item.id,

            quantity: item.quantity

        }))

    };

    paymentSubmitButton.disabled = true;

    paymentSubmitButton.textContent = "Connecting to Paystack...";

    showPaymentMessage(
        "Preparing your secure payment. Please wait...",
        "success"
    );

    try {

        const response = await fetch(
            `${PAYMENT_API_URL}/initialize`,
            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(requestData)

            }
        );

        const data = await response.json();

        if (
            !response.ok ||
            !data.success ||
            !data.authorizationUrl ||
            !data.reference
        ) {

            throw new Error(
                data.message ||
                "Unable to initialize your payment."
            );

        }

        // SAVE REFERENCE FOR PAYMENT RECOVERY

        localStorage.setItem(
            "shopzone-pending-payment",
            JSON.stringify({

                reference: data.reference,

                customerEmail: customer.customerEmail,

                startedAt: new Date().toISOString()

            })
        );

        // REDIRECT CUSTOMER TO PAYSTACK

        window.location.href = data.authorizationUrl;

    } catch (error) {

        console.error(
            "ShopZone payment initialization error:",
            error
        );

        showPaymentMessage(
            error.message ||
            "Payment could not be initialized. Please try again."
        );

        paymentSubmitButton.disabled = false;

        paymentSubmitButton.textContent = "Pay with Paystack";

    }

}


// =====================================
// CAPTURE CHECKOUT SUBMISSION
// =====================================

// This capture-phase listener prevents the old demonstration
// order handler in script.js from creating an unpaid order.

paymentCheckoutForm.addEventListener(
    "submit",

    function(event) {

        event.preventDefault();

        event.stopImmediatePropagation();

        initializeShopZonePayment();

    },

    true
);


// =====================================
// VERIFY PAYSTACK PAYMENT
// =====================================

async function verifyShopZonePayment(reference) {

    paymentCheckoutSection.hidden = true;

    paymentConfirmationSection.hidden = false;

    paymentConfirmationSection.scrollIntoView({
        behavior: "smooth"
    });

    paymentOrderNumber.textContent = "Verifying payment...";

    paymentConfirmationMessage.textContent =
        "Please wait while ShopZone securely verifies your payment with Paystack. Do not close this page.";

    try {

        const response = await fetch(
            `${PAYMENT_API_URL}/verify`,
            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    reference
                })

            }
        );

        const data = await response.json();

        if (!response.ok || !data.success || !data.order) {

            throw new Error(
                data.message ||
                "Payment verification was unsuccessful."
            );

        }

        const order = data.order;

        // SAVE ORDER TO LOCAL BROWSER HISTORY

        let orderHistory = [];

        try {

            const savedHistory = JSON.parse(
                localStorage.getItem("shopzone-orders")
            );

            if (Array.isArray(savedHistory)) {
                orderHistory = savedHistory;
            }

        } catch (error) {

            orderHistory = [];

        }

        // AVOID DUPLICATE HISTORY ENTRIES

        const alreadySaved = orderHistory.some(
            item => item.orderNumber === order.orderNumber
        );

        if (!alreadySaved) {

            orderHistory.unshift({

                orderNumber: order.orderNumber,

                date: order.date ||
                    order.createdAt ||
                    new Date().toISOString(),

                items: order.items,

                subtotal: order.subtotal,

                couponCode: order.couponCode || "",

                discountAmount: order.discountAmount || 0,

                total: order.total

            });

        }

        localStorage.setItem(
            "shopzone-orders",
            JSON.stringify(orderHistory)
        );

        // CLEAR CART AFTER VERIFIED PAYMENT

        localStorage.setItem(
            "shopzone-cart",
            JSON.stringify([])
        );

        localStorage.removeItem(
            "shopzone-pending-payment"
        );

        // DISPLAY SUCCESSFUL ORDER

        paymentOrderNumber.textContent = order.orderNumber;

        let message =
            `Thank you, ${order.customerName}! Your payment of ${paymentFormatNaira(order.total)} was successfully verified.`;

        if (Number(order.discountAmount) > 0) {

            message +=
                ` You saved ${paymentFormatNaira(order.discountAmount)} using promo code ${order.couponCode}.`;

        }

        message +=
            " Your order has been created successfully. ShopZone will process your order shortly.";

        paymentConfirmationMessage.textContent = message;

        // UPDATE CART DISPLAY

        const cartItemsElement = document.getElementById(
            "cart-items"
        );

        const cartCountElement = document.getElementById(
            "cart-count"
        );

        const cartTotalElement = document.getElementById(
            "cart-total"
        );

        const checkoutButton = document.getElementById(
            "checkout-button"
        );

        if (cartItemsElement) {
            cartItemsElement.innerHTML =
                "<p>Your cart is empty.</p>";
        }

        if (cartCountElement) {
            cartCountElement.textContent = "0";
        }

        if (cartTotalElement) {
            cartTotalElement.textContent = "₦0";
        }

        if (checkoutButton) {
            checkoutButton.hidden = true;
        }

        // RESET CHECKOUT FORM

        paymentCheckoutForm.reset();

        // REMOVE COUPON DISPLAY

        const couponMessage = document.getElementById(
            "coupon-message"
        );

        const couponCodeInput = document.getElementById(
            "coupon-code"
        );

        if (couponMessage) {

            couponMessage.textContent = "";

            couponMessage.className = "";

        }

        if (couponCodeInput) {
            couponCodeInput.value = "";
        }

        // SHOW UPDATED ORDER HISTORY

        const historyList = document.getElementById(
            "order-history-list"
        );

        if (historyList) {

            const historyCard = document.createElement("div");

            historyCard.className = "order-card";

            const orderDate = new Date(
                order.date || order.createdAt || Date.now()
            );

            historyCard.textContent =
                `Order ${order.orderNumber} | ${orderDate.toLocaleString("en-NG")} | Total: ${paymentFormatNaira(order.total)}`;

            historyList.prepend(historyCard);

        }

        paymentConfirmationSection.scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {

        console.error(
            "ShopZone payment verification error:",
            error
        );

        paymentOrderNumber.textContent =
            "Payment verification pending";

        paymentConfirmationMessage.textContent =
            error.message +
            " Your cart has not been cleared. Please do not pay again immediately. Contact ShopZone support if you have already been charged.";

        // KEEP THE PAYMENT REFERENCE FOR RECOVERY

        paymentCheckoutSection.hidden = false;

        paymentConfirmationSection.scrollIntoView({
            behavior: "smooth"
        });

    }

}


// =====================================
// HANDLE PAYSTACK CALLBACK
// =====================================

async function handleShopZonePaymentCallback() {

    const urlParams = new URLSearchParams(
        window.location.search
    );

    const paymentStatus = urlParams.get("payment");

    if (paymentStatus !== "callback") {
        return;
    }

    const reference =
        urlParams.get("reference") ||
        urlParams.get("trxref");

    if (!reference) {

        paymentConfirmationSection.hidden = false;

        paymentCheckoutSection.hidden = true;

        paymentOrderNumber.textContent =
            "Payment reference missing";

        paymentConfirmationMessage.textContent =
            "We could not find your payment reference. Please contact ShopZone support before attempting another payment.";

        return;

    }

    // VERIFY PAYMENT WITH SHOPZONE BACKEND

    await verifyShopZonePayment(reference);

}


// =====================================
// START PAYMENT CALLBACK CHECK
// =====================================

handleShopZonePaymentCallback();
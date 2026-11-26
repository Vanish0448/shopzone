// =====================================
// SHOPZONE CUSTOMER ACCOUNT
// =====================================

const CUSTOMER_API_URL =
    "https://shopzone-sojz.onrender.com/api/customers";

const CUSTOMER_TOKEN_KEY = "shopzone-customer-token";
const CUSTOMER_KEY = "shopzone-customer";


// =====================================
// HTML ELEMENTS
// =====================================

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginTab = document.getElementById("login-tab");
const registerTab = document.getElementById("register-tab");
const accountMessage = document.getElementById("account-message");
const loginButton = document.getElementById("login-button");
const registerButton = document.getElementById("register-button");
const accountWrapper = document.querySelector(".account-wrapper");


// =====================================
// DISPLAY ACCOUNT MESSAGE
// =====================================

function showAccountMessage(message, success = false) {

    accountMessage.textContent = message;

    accountMessage.style.color = success
        ? "#198754"
        : "#dc3545";

}


// =====================================
// CUSTOMER API REQUEST
// =====================================

async function customerRequest(endpoint, options = {}) {

    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);

    const response = await fetch(
        `${CUSTOMER_API_URL}${endpoint}`,
        {
            ...options,

            headers: {
                "Content-Type": "application/json",

                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {}),

                ...(options.headers || {})
            }
        }
    );

    const data = await response.json();

    if (!response.ok || data.success === false) {

        throw new Error(
            data.message ||
            "Something went wrong. Please try again."
        );

    }

    return data;

}


// =====================================
// SHOW LOGIN FORM
// =====================================

function showLoginForm() {

    loginForm.hidden = false;
    registerForm.hidden = true;

    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    showAccountMessage("");

}


// =====================================
// SHOW REGISTRATION FORM
// =====================================

function showRegisterForm() {

    loginForm.hidden = true;
    registerForm.hidden = false;

    loginTab.classList.remove("active");
    registerTab.classList.add("active");

    showAccountMessage("");

}


// =====================================
// ACCOUNT TAB EVENTS
// =====================================

loginTab.addEventListener("click", showLoginForm);
registerTab.addEventListener("click", showRegisterForm);


// =====================================
// SAVE CUSTOMER SESSION
// =====================================

function saveCustomerSession(data) {

    if (!data.token) {

        throw new Error(
            "The server did not return a login token."
        );

    }

    const customer =
        data.customer ||
        data.user ||
        data.profile ||
        {};

    localStorage.setItem(
        CUSTOMER_TOKEN_KEY,
        data.token
    );

    localStorage.setItem(
        CUSTOMER_KEY,
        JSON.stringify(customer)
    );

    return customer;

}


// =====================================
// FORMAT CURRENCY
// =====================================

function formatOrderCurrency(amount) {

    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 2
    }).format(Number(amount) || 0);

}


// =====================================
// FORMAT ORDER DATE
// =====================================

function formatOrderDate(dateValue) {

    if (!dateValue) {
        return "Date unavailable";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });

}


// =====================================
// SAFELY DISPLAY TEXT
// =====================================

function escapeOrderText(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]
    );

}


// =====================================
// DISPLAY CUSTOMER ORDER HISTORY
// =====================================

async function loadCustomerOrderHistory() {

    const historyContainer = document.getElementById(
        "customer-order-history"
    );

    if (!historyContainer) {
        return;
    }

    historyContainer.innerHTML = `
        <p>Loading your orders...</p>
    `;

    try {

        const data = await customerRequest("/orders");

        const orders = Array.isArray(data.orders)
            ? data.orders
            : [];

        if (orders.length === 0) {

            historyContainer.innerHTML = `
                <div style="
                    background:#f8f8f8;
                    padding:20px;
                    border-radius:8px;
                    text-align:center;
                ">
                    <p>You haven't placed any orders yet.</p>

                    <a href="index.html" style="
                        display:inline-block;
                        margin-top:12px;
                        color:#007bff;
                        text-decoration:none;
                    ">
                        Start Shopping
                    </a>
                </div>
            `;

            return;

        }


        historyContainer.innerHTML = orders.map(order => {

            const orderNumber = escapeOrderText(
                order.orderNumber || "Order"
            );

            const orderDate = escapeOrderText(
                formatOrderDate(
                    order.date || order.createdAt
                )
            );

            const orderStatus = escapeOrderText(
                order.status || "Pending"
            );

            const paymentStatus = escapeOrderText(
                order.paymentStatus || "Pending"
            );

            const total = formatOrderCurrency(order.total);

            const items = Array.isArray(order.items)
                ? order.items
                : [];

            const itemList = items.length > 0
                ? items.map(item => {

                    const itemName = escapeOrderText(
                        item.productName ||
                        item.name ||
                        item.title ||
                        "Product"
                    );

                    const quantity = Number(item.quantity) || 1;

                    return `
                        <li style="
                            margin-bottom:6px;
                        ">
                            ${itemName} × ${quantity}
                        </li>
                    `;

                }).join("")
                : "<li>Order items unavailable</li>";


            return `

                <div style="
                    border:1px solid #ddd;
                    border-radius:8px;
                    padding:18px;
                    margin-bottom:18px;
                    background:#fff;
                ">

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        flex-wrap:wrap;
                        gap:10px;
                    ">

                        <h4 style="margin:0;">
                            ${orderNumber}
                        </h4>

                        <strong>
                            ${total}
                        </strong>

                    </div>

                    <p style="
                        margin:12px 0;
                        color:#666;
                        font-size:14px;
                    ">
                        ${orderDate}
                    </p>

                    <div style="
                        background:#f8f8f8;
                        padding:12px;
                        border-radius:6px;
                    ">

                        <strong>Items</strong>

                        <ul style="
                            padding-left:20px;
                            margin:10px 0 0;
                        ">
                            ${itemList}
                        </ul>

                    </div>

                    <div style="
                        display:flex;
                        flex-wrap:wrap;
                        gap:20px;
                        margin-top:15px;
                        font-size:14px;
                    ">

                        <p style="margin:0;">
                            <strong>Order Status:</strong>
                            ${orderStatus}
                        </p>

                        <p style="margin:0;">
                            <strong>Payment:</strong>
                            ${paymentStatus}
                        </p>

                    </div>

                </div>

            `;

        }).join("");


    } catch (error) {

        historyContainer.innerHTML = `
            <p style="color:#dc3545;">
                Unable to load your orders.
                Please refresh the page and try again.
            </p>
        `;

        console.error(
            "Customer order history error:",
            error
        );

    }

}


// =====================================
// DISPLAY CUSTOMER ACCOUNT
// =====================================

function displayCustomerAccount(customer, welcomeMessage) {

    accountWrapper.innerHTML = `

        <h2>My ShopZone Account</h2>

        <p
            class="account-description"
            id="account-welcome-message"
        ></p>

        <div style="
            background:#f8f8f8;
            padding:25px;
            border-radius:8px;
            margin-top:20px;
        ">

            <h3 style="margin-bottom:15px;">
                Account Information
            </h3>

            <p style="margin-bottom:10px;">
                <strong>Name:</strong>
                <span id="account-customer-name"></span>
            </p>

            <p style="
                margin-bottom:10px;
                overflow-wrap:anywhere;
            ">
                <strong>Email:</strong>
                <span id="account-customer-email"></span>
            </p>

            <p style="margin-bottom:10px;">
                <strong>Phone:</strong>
                <span id="account-customer-phone"></span>
            </p>

        </div>


        <div style="margin-top:30px;">

            <h3 style="
                margin-bottom:18px;
            ">
                My Order History
            </h3>

            <div id="customer-order-history">

                <p>Loading your orders...</p>

            </div>

        </div>


        <button
            type="button"
            id="customer-logout-button"
            class="account-submit"
            style="
                background:#dc3545;
                width:100%;
                margin-top:20px;
            "
        >
            Log Out
        </button>

        <a href="index.html" class="account-back">
            ← Continue Shopping
        </a>

    `;


    // DISPLAY PERSONALIZED WELCOME MESSAGE

    document.getElementById(
        "account-welcome-message"
    ).textContent = welcomeMessage;


    // DISPLAY CUSTOMER INFORMATION

    document.getElementById(
        "account-customer-name"
    ).textContent = customer.name || "Customer";

    document.getElementById(
        "account-customer-email"
    ).textContent = customer.email || "";

    document.getElementById(
        "account-customer-phone"
    ).textContent = customer.phone || "";


    // LOGOUT BUTTON

    document.getElementById(
        "customer-logout-button"
    ).addEventListener(
        "click",
        logoutCustomer
    );


    // LOAD CUSTOMER ORDERS

    loadCustomerOrderHistory();

}


// =====================================
// CUSTOMER LOGIN
// =====================================

loginForm.addEventListener(
    "submit",

    async function(event) {

        event.preventDefault();

        const email = document.getElementById(
            "login-email"
        ).value.trim();

        const password = document.getElementById(
            "login-password"
        ).value;

        loginButton.disabled = true;
        loginButton.textContent = "Logging In...";

        showAccountMessage("");


        try {

            const data = await customerRequest(
                "/login",
                {
                    method: "POST",

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );

            const customer = saveCustomerSession(data);

            loginForm.reset();

            displayCustomerAccount(
                customer,
                `Welcome back, ${customer.name || "Customer"}!`
            );

        } catch (error) {

            showAccountMessage(error.message);

        } finally {

            loginButton.disabled = false;
            loginButton.textContent = "Log In";

        }

    }

);


// =====================================
// CUSTOMER REGISTRATION
// =====================================

registerForm.addEventListener(
    "submit",

    async function(event) {

        event.preventDefault();

        const name = document.getElementById(
            "register-name"
        ).value.trim();

        const email = document.getElementById(
            "register-email"
        ).value.trim();

        const phone = document.getElementById(
            "register-phone"
        ).value.trim();

        const password = document.getElementById(
            "register-password"
        ).value;

        const confirmPassword = document.getElementById(
            "register-confirm-password"
        ).value;


        // CHECK PASSWORD MATCH

        if (password !== confirmPassword) {

            showAccountMessage(
                "Your passwords do not match."
            );

            return;

        }


        // CHECK PASSWORD LENGTH

        if (password.length < 8) {

            showAccountMessage(
                "Your password must contain at least 8 characters."
            );

            return;

        }


        registerButton.disabled = true;
        registerButton.textContent = "Creating Account...";

        showAccountMessage("");


        try {

            const data = await customerRequest(
                "/register",
                {
                    method: "POST",

                    body: JSON.stringify({
                        name,
                        email,
                        phone,
                        password
                    })
                }
            );

            const customer = saveCustomerSession(data);

            registerForm.reset();

            displayCustomerAccount(
                customer,
                `Account created successfully! Welcome to ShopZone, ${customer.name || "Customer"}.`
            );

        } catch (error) {

            showAccountMessage(error.message);

        } finally {

            registerButton.disabled = false;
            registerButton.textContent = "Create Account";

        }

    }

);


// =====================================
// CUSTOMER LOGOUT
// =====================================

function logoutCustomer() {

    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_KEY);

    window.location.reload();

}


// =====================================
// CHECK EXISTING CUSTOMER SESSION
// =====================================

async function checkCustomerSession() {

    const token = localStorage.getItem(
        CUSTOMER_TOKEN_KEY
    );

    if (!token) {
        return;
    }


    try {

        const response = await fetch(
            `${CUSTOMER_API_URL}/me`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {

            throw new Error(
                "Your session has expired."
            );

        }

        const customer =
            data.customer ||
            data.user ||
            data.profile ||
            data;

        localStorage.setItem(
            CUSTOMER_KEY,
            JSON.stringify(customer)
        );

        displayCustomerAccount(
            customer,
            `Welcome back, ${customer.name || "Customer"}!`
        );

    } catch (error) {

        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_KEY);

        showLoginForm();

        showAccountMessage(
            "Your session has expired. Please log in again."
        );

    }

}


// =====================================
// START CUSTOMER ACCOUNT
// =====================================

showLoginForm();

checkCustomerSession();
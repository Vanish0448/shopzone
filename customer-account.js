// =====================================
// SHOPZONE CUSTOMER ACCOUNT
// =====================================

const CUSTOMER_API_URL = "https://shopzone-sojz.onrender.com/api/customers";

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const loginTab = document.getElementById("login-tab");
const registerTab = document.getElementById("register-tab");

const accountMessage = document.getElementById("account-message");

const loginButton = document.getElementById("login-button");
const registerButton = document.getElementById("register-button");

const accountWrapper = document.querySelector(".account-wrapper");

const CUSTOMER_TOKEN_KEY = "shopzone-customer-token";
const CUSTOMER_KEY = "shopzone-customer";

// =====================================
// MESSAGE DISPLAY
// =====================================

function showAccountMessage(message, success = false) {
    accountMessage.textContent = message;

    accountMessage.style.color = success
        ? "#198754"
        : "#dc3545";
}

// =====================================
// API REQUEST
// =====================================

async function customerRequest(endpoint, options = {}) {
    const response = await fetch(
        `${CUSTOMER_API_URL}${endpoint}`,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        }
    );

    const data = await response.json();

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message || "Something went wrong. Please try again."
        );
    }

    return data;
}

// =====================================
// SWITCH BETWEEN LOGIN AND REGISTER
// =====================================

function showLoginForm() {
    loginForm.hidden = false;
    registerForm.hidden = true;

    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    showAccountMessage("");
}

function showRegisterForm() {
    loginForm.hidden = true;
    registerForm.hidden = false;

    loginTab.classList.remove("active");
    registerTab.classList.add("active");

    showAccountMessage("");
}

loginTab.addEventListener("click", showLoginForm);
registerTab.addEventListener("click", showRegisterForm);

// =====================================
// SAVE CUSTOMER SESSION
// =====================================

function saveCustomerSession(data) {
    if (!data.token) {
        throw new Error("The server did not return a login token.");
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
// DISPLAY CUSTOMER ACCOUNT
// =====================================

function displayCustomerAccount(customer) {
    accountWrapper.innerHTML = `
        <h2>My ShopZone Account</h2>

        <p class="account-description">
            Welcome back!
        </p>

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

            <p style="margin-bottom:10px; overflow-wrap:anywhere;">
                <strong>Email:</strong>
                <span id="account-customer-email"></span>
            </p>

            <p style="margin-bottom:10px;">
                <strong>Phone:</strong>
                <span id="account-customer-phone"></span>
            </p>

        </div>

        <button
            type="button"
            id="customer-logout-button"
            class="account-submit"
            style="background:#dc3545; width:100%;"
        >
            Log Out
        </button>

        <a href="index.html" class="account-back">
            ← Continue Shopping
        </a>
    `;

    document.getElementById("account-customer-name").textContent =
        customer.name || "Customer";

    document.getElementById("account-customer-email").textContent =
        customer.email || "";

    document.getElementById("account-customer-phone").textContent =
        customer.phone || "";

    document.getElementById("customer-logout-button")
        .addEventListener("click", logoutCustomer);
}

// =====================================
// CUSTOMER LOGIN
// =====================================

loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("login-email")
        .value.trim();

    const password = document.getElementById("login-password")
        .value;

    loginButton.disabled = true;
    loginButton.textContent = "Logging In...";

    showAccountMessage("");

    try {
        const data = await customerRequest("/login", {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        });

        const customer = saveCustomerSession(data);

        loginForm.reset();

        displayCustomerAccount(customer);

    } catch (error) {
        showAccountMessage(error.message);

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Log In";
    }
});

// =====================================
// CUSTOMER REGISTRATION
// =====================================

registerForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const name = document.getElementById("register-name")
        .value.trim();

    const email = document.getElementById("register-email")
        .value.trim();

    const phone = document.getElementById("register-phone")
        .value.trim();

    const password = document.getElementById("register-password")
        .value;

    const confirmPassword = document.getElementById(
        "register-confirm-password"
    ).value;

    if (password !== confirmPassword) {
        showAccountMessage("Your passwords do not match.");
        return;
    }

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
        const data = await customerRequest("/register", {
            method: "POST",
            body: JSON.stringify({
                name,
                email,
                phone,
                password
            })
        });

        const customer = saveCustomerSession(data);

        registerForm.reset();

        displayCustomerAccount(customer);

    } catch (error) {
        showAccountMessage(error.message);

    } finally {
        registerButton.disabled = false;
        registerButton.textContent = "Create Account";
    }
});

// =====================================
// CUSTOMER LOGOUT
// =====================================

function logoutCustomer() {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_KEY);

    window.location.reload();
}

// =====================================
// CHECK EXISTING LOGIN SESSION
// =====================================

async function checkCustomerSession() {
    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);

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
            throw new Error("Your session has expired.");
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

        displayCustomerAccount(customer);

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
// =====================================
// SHOPZONE ADMIN CONFIGURATION
// =====================================

const ADMIN_API_URL = "http://localhost:5000/api/admin";


// =====================================
// HTML ELEMENTS
// =====================================

const loginForm = document.getElementById("admin-login-form");

const emailInput = document.getElementById("admin-email");

const passwordInput = document.getElementById("admin-password");

const loginButton = document.getElementById("login-button");

const loginMessage = document.getElementById("login-message");


// =====================================
// ADMIN LOGIN
// =====================================

loginForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const email = emailInput.value.trim();

    const password = passwordInput.value;

    if (!email || !password) {
        loginMessage.textContent = "Please enter your email and password.";
        loginMessage.style.color = "red";
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    loginMessage.textContent = "";

    try {

        const response = await fetch(`${ADMIN_API_URL}/login`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })

        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Login failed.");
        }

        // Save admin authentication token.
        localStorage.setItem("shopzone-admin-token", data.token);

        loginMessage.textContent = "Login successful! Redirecting...";
        loginMessage.style.color = "green";

        // Open the admin dashboard.
        setTimeout(() => {
            window.location.href = "admin-dashboard.html";
        }, 1000);

    } catch (error) {

        console.error("Admin login error:", error);

        loginMessage.textContent = error.message;
        loginMessage.style.color = "red";

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Login";

    }

});
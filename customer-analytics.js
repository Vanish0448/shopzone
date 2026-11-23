// =====================================
// SHOPZONE CUSTOMER ANALYTICS
// =====================================

const CUSTOMER_ANALYTICS_API_URL = "http://localhost:5000/api/orders";

const customerAnalyticsToken = localStorage.getItem("shopzone-admin-token");

const customerAnalyticsContainer = document.getElementById(
    "customer-analytics-content"
);

// =====================================
// CURRENCY FORMAT
// =====================================

function customerAnalyticsCurrency(amount) {
    return "\u20A6" + Number(amount || 0).toLocaleString("en-NG", {
        maximumFractionDigits: 0
    });
}

// =====================================
// LOAD CUSTOMER ANALYTICS
// =====================================

async function loadCustomerAnalytics() {
    try {
        if (!customerAnalyticsToken) {
            customerAnalyticsContainer.innerHTML =
                "<p>Please log in again to view customer analytics.</p>";
            return;
        }

        const response = await fetch(CUSTOMER_ANALYTICS_API_URL, {
            headers: {
                Authorization: `Bearer ${customerAnalyticsToken}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load customer analytics.");
        }

        const orders = (data.orders || []).filter(order => {
            return order.status !== "Cancelled";
        });

        calculateCustomerAnalytics(orders);

    } catch (error) {
        console.error("Customer analytics error:", error);

        customerAnalyticsContainer.innerHTML =
            "<p>Unable to load customer analytics. Please refresh the page.</p>";
    }
}

// =====================================
// CALCULATE CUSTOMER ANALYTICS
// =====================================

function calculateCustomerAnalytics(orders) {
    const customers = new Map();

    orders.forEach(order => {
        const email = String(order.customerEmail || "")
            .trim()
            .toLowerCase();

        if (!email) return;

        if (!customers.has(email)) {
            customers.set(email, {
                name: order.customerName || "Unknown Customer",
                email,
                orders: 0,
                spending: 0
            });
        }

        const customer = customers.get(email);

        customer.orders += 1;
        customer.spending += Number(order.total || 0);
    });

    const customerList = Array.from(customers.values());

    customerList.sort((a, b) => b.spending - a.spending);

    displayCustomerAnalytics(customerList);
}

// =====================================
// DISPLAY CUSTOMER ANALYTICS
// =====================================

function displayCustomerAnalytics(customers) {
    const totalCustomers = customers.length;

    const repeatCustomers = customers.filter(customer => {
        return customer.orders > 1;
    }).length;

    const totalSpending = customers.reduce((total, customer) => {
        return total + customer.spending;
    }, 0);

    const averageSpending = totalCustomers > 0
        ? totalSpending / totalCustomers
        : 0;

    const topCustomer = customers.length > 0
        ? customers[0]
        : null;

    const topFive = customers.slice(0, 5);

    customerAnalyticsContainer.innerHTML = `
        <div class="stats-container customer-analytics-stats">

            <div class="stat-card">
                <h3>Customers</h3>
                <p>${totalCustomers}</p>
            </div>

            <div class="stat-card">
                <h3>Repeat Customers</h3>
                <p>${repeatCustomers}</p>
            </div>

            <div class="stat-card">
                <h3>Average Customer Spending</h3>
                <p>${customerAnalyticsCurrency(averageSpending)}</p>
            </div>

            <div class="stat-card">
                <h3>Total Customer Spending</h3>
                <p>${customerAnalyticsCurrency(totalSpending)}</p>
            </div>

        </div>

        <div class="analytics-card customer-top-card">

            <h3>Top-Spending Customer</h3>

            ${
                topCustomer
                    ? `
                        <h2>${escapeCustomerHTML(topCustomer.name)}</h2>
                        <p>${escapeCustomerHTML(topCustomer.email)}</p>
                        <h3>${customerAnalyticsCurrency(topCustomer.spending)}</h3>
                        <p>${topCustomer.orders} order(s)</p>
                    `
                    : "<p>No customer records available.</p>"
            }

        </div>

        <div class="analytics-card customer-ranking-card">

            <h3>Top 5 Spending Customers</h3>

            <div class="table-container">

                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Customer</th>
                            <th>Email</th>
                            <th>Orders</th>
                            <th>Total Spent</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${
                            topFive.length > 0
                                ? topFive.map((customer, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${escapeCustomerHTML(customer.name)}</td>
                                        <td>${escapeCustomerHTML(customer.email)}</td>
                                        <td>${customer.orders}</td>
                                        <td>${customerAnalyticsCurrency(customer.spending)}</td>
                                    </tr>
                                `).join("")
                                : `
                                    <tr>
                                        <td colspan="5">No customers found.</td>
                                    </tr>
                                `
                        }
                    </tbody>
                </table>

            </div>

        </div>
    `;
}

// =====================================
// ESCAPE CUSTOMER DATA
// =====================================

function escapeCustomerHTML(value) {
    return String(value).replace(/[&<>"']/g, character => {
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
// START CUSTOMER ANALYTICS
// =====================================

loadCustomerAnalytics();
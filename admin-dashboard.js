// =====================================
// SHOPZONE ADMIN DASHBOARD
// =====================================

const ORDERS_API_URL = "http://localhost:5000/api/orders";
const PRODUCTS_API_URL = "http://localhost:5000/api/products";

const adminToken = localStorage.getItem("shopzone-admin-token");

if (!adminToken) {
    window.location.href = "admin.html";
}

// =====================================
// HTML ELEMENTS
// =====================================

const totalOrdersElement = document.getElementById("total-orders");
const totalSalesElement = document.getElementById("total-sales");
const totalCustomersElement = document.getElementById("total-customers");
const pendingOrdersElement = document.getElementById("pending-orders");

const stockAlertCountElement = document.getElementById("stock-alert-count");
const stockAlertSummary = document.getElementById("stock-alert-summary");
const lowStockAlertsBody = document.getElementById("low-stock-alerts-body");

const ordersTableBody = document.getElementById("orders-table-body");
const customersTableBody = document.getElementById("customers-table-body");
const productsTableBody = document.getElementById("products-table-body");

const orderSearchInput = document.getElementById("order-search");
const orderStatusFilter = document.getElementById("order-status-filter");

const logoutButton = document.getElementById("logout-button");

const productForm = document.getElementById("product-form");
const productIdInput = document.getElementById("product-id");
const productNameInput = document.getElementById("product-name");
const productPriceInput = document.getElementById("product-price");
const productCategoryInput = document.getElementById("product-category");
const productStockInput = document.getElementById("product-stock");
const productImageInput = document.getElementById("product-image");
const productDescriptionInput = document.getElementById("product-description");

const productFormTitle = document.getElementById("product-form-title");
const saveProductButton = document.getElementById("save-product-button");
const cancelEditButton = document.getElementById("cancel-edit-button");
const productMessage = document.getElementById("product-message");

const orderDetailsModal = document.getElementById("order-details-modal");
const orderDetailsContent = document.getElementById("order-details-content");
const closeOrderModalButton = document.getElementById("close-order-modal");

const customerDetailsModal = document.getElementById("customer-details-modal");
const customerDetailsContent = document.getElementById("customer-details-content");
const closeCustomerModalButton = document.getElementById("close-customer-modal");

// =====================================
// SETTINGS
// =====================================

const orderStatuses = [
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled"
];

const LOW_STOCK_LIMIT = 5;
const ORDERS_PER_PAGE = 10;

let allOrders = [];
let currentPage = 1;
let currentSort = "newest";
let orderSortSelect = null;
let ordersPagination = null;

// =====================================
// FORMAT CURRENCY
// =====================================

function formatCurrency(amount) {
    return `\u20A6${Number(amount || 0).toLocaleString("en-NG")}`;
}

// =====================================
// CREATE TABLE CELL
// =====================================

function createCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    return cell;
}

// =====================================
// AUTHENTICATION
// =====================================

function checkAuthentication(response) {
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("shopzone-admin-token");
        window.location.href = "admin.html";
        return true;
    }

    return false;
}

// =====================================
// ORDER DATE
// =====================================

function getOrderDate(order) {
    const date = new Date(order.date || order.createdAt);
    return isNaN(date.getTime()) ? 0 : date.getTime();
}

// =====================================
// CREATE ORDER SORTING
// =====================================

function createOrderSorting() {
    if (orderSortSelect || !orderStatusFilter) return;

    orderSortSelect = document.createElement("select");
    orderSortSelect.id = "order-sort";

    const options = [
        { value: "newest", text: "Newest First" },
        { value: "oldest", text: "Oldest First" },
        { value: "highest", text: "Highest Amount" },
        { value: "lowest", text: "Lowest Amount" }
    ];

    options.forEach(item => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.text;
        orderSortSelect.appendChild(option);
    });

    orderSortSelect.value = currentSort;

    const label = document.createElement("label");
    label.htmlFor = "order-sort";
    label.textContent = "Sort Orders: ";

    const container = document.createElement("div");

    container.style.display = "inline-flex";
    container.style.alignItems = "center";
    container.style.gap = "8px";
    container.style.margin = "10px";

    orderSortSelect.style.padding = "9px";
    orderSortSelect.style.borderRadius = "5px";

    container.append(label, orderSortSelect);

    orderStatusFilter.insertAdjacentElement("afterend", container);

    orderSortSelect.addEventListener("change", function() {
        currentSort = this.value;
        currentPage = 1;
        filterOrders();
    });
}

// =====================================
// CREATE PAGINATION
// =====================================

function createPaginationContainer() {
    if (ordersPagination || !ordersTableBody) return;

    ordersPagination = document.createElement("div");
    ordersPagination.id = "orders-pagination";

    ordersPagination.style.display = "flex";
    ordersPagination.style.flexWrap = "wrap";
    ordersPagination.style.justifyContent = "space-between";
    ordersPagination.style.alignItems = "center";
    ordersPagination.style.gap = "10px";
    ordersPagination.style.margin = "20px 0";

    const table = ordersTableBody.closest("table");
    const container = table ? table.closest(".table-container") : null;

    if (container) {
        container.insertAdjacentElement("afterend", ordersPagination);
    } else if (table) {
        table.insertAdjacentElement("afterend", ordersPagination);
    } else {
        ordersTableBody.parentElement.appendChild(ordersPagination);
    }
}

// =====================================
// LOAD DASHBOARD
// =====================================

async function loadDashboard() {
    try {
        ordersTableBody.innerHTML =
            '<tr><td colspan="6">Loading orders...</td></tr>';

        customersTableBody.innerHTML =
            '<tr><td colspan="6">Loading customers...</td></tr>';

        const response = await fetch(ORDERS_API_URL, {
            headers: {
                Authorization: `Bearer ${adminToken}`
            }
        });

        if (checkAuthentication(response)) return;

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load orders.");
        }

        allOrders = data.orders || [];

        displayStatistics(allOrders);

        createOrderSorting();
        createPaginationContainer();

        filterOrders();
        displayCustomers(allOrders);

    } catch (error) {
        console.error("Dashboard error:", error);

        ordersTableBody.innerHTML =
            '<tr><td colspan="6">Could not load orders.</td></tr>';

        customersTableBody.innerHTML =
            '<tr><td colspan="6">Could not load customers.</td></tr>';
    }
}

// =====================================
// DISPLAY DASHBOARD STATISTICS
// =====================================

function displayStatistics(orders) {
    const totalSales = orders.reduce(
        (sum, order) => sum + Number(order.total || 0), 0
    );

    const customers = new Set(
        orders.map(order => order.customerEmail?.trim().toLowerCase())
            .filter(Boolean)
    );

    const pending = orders.filter(
        order => (order.status || "Pending") === "Pending"
    ).length;

    totalOrdersElement.textContent = orders.length;
    totalSalesElement.textContent = formatCurrency(totalSales);
    totalCustomersElement.textContent = customers.size;
    pendingOrdersElement.textContent = pending;
}

// =====================================
// SORT ORDERS
// =====================================

function sortOrders(orders) {
    return [...orders].sort((a, b) => {
        switch (currentSort) {
            case "oldest":
                return getOrderDate(a) - getOrderDate(b);

            case "highest":
                return Number(b.total || 0) - Number(a.total || 0);

            case "lowest":
                return Number(a.total || 0) - Number(b.total || 0);

            default:
                return getOrderDate(b) - getOrderDate(a);
        }
    });
}

// =====================================
// SEARCH AND FILTER ORDERS
// =====================================

function filterOrders() {
    const searchTerm = orderSearchInput.value.trim().toLowerCase();
    const selectedStatus = orderStatusFilter.value;

    const filtered = allOrders.filter(order => {
        const number = String(order.orderNumber || "").toLowerCase();
        const name = String(order.customerName || "").toLowerCase();
        const status = order.status || "Pending";

        const matchesSearch =
            number.includes(searchTerm) || name.includes(searchTerm);

        const matchesStatus =
            selectedStatus === "all" || status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    displayRecentOrders(sortOrders(filtered));
}

// =====================================
// DISPLAY ORDERS
// =====================================

function displayRecentOrders(orders) {
    ordersTableBody.innerHTML = "";

    const totalPages = Math.max(
        1,
        Math.ceil(orders.length / ORDERS_PER_PAGE)
    );

    currentPage = Math.min(Math.max(currentPage, 1), totalPages);

    if (orders.length === 0) {
        ordersTableBody.innerHTML =
            '<tr><td colspan="6">No matching orders found.</td></tr>';

        updatePagination(0, 0);
        return;
    }

    const startIndex = (currentPage - 1) * ORDERS_PER_PAGE;

    const currentOrders = orders.slice(
        startIndex,
        startIndex + ORDERS_PER_PAGE
    );

    currentOrders.forEach(order => {
        const row = document.createElement("tr");

        const date = new Date(order.date || order.createdAt);

        const formattedDate = isNaN(date.getTime())
            ? "Date unavailable"
            : date.toLocaleDateString("en-NG");

        const statusCell = document.createElement("td");
        const statusSelect = document.createElement("select");

        statusSelect.className = "status-select";

        const currentStatus = order.status || "Pending";

        orderStatuses.forEach(status => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            option.selected = status === currentStatus;
            statusSelect.appendChild(option);
        });

        statusSelect.disabled = currentStatus === "Cancelled";
        statusCell.appendChild(statusSelect);

        const actionCell = document.createElement("td");

        const viewButton = document.createElement("button");
        viewButton.textContent = "View Details";
        viewButton.className = "view-order-button";
        viewButton.addEventListener("click", () => showOrderDetails(order));

        const invoiceButton = document.createElement("button");
        invoiceButton.textContent = "Generate Invoice";
        invoiceButton.className = "generate-invoice-button";
        invoiceButton.addEventListener("click", () => generateOrderInvoice(order));

        const updateButton = document.createElement("button");
        updateButton.textContent = currentStatus === "Cancelled"
            ? "Cancelled"
            : "Update";

        updateButton.className = "update-status-button";
        updateButton.disabled = currentStatus === "Cancelled";

        updateButton.addEventListener("click", () => {
            updateOrderStatus(order.orderNumber, statusSelect.value, updateButton);
        });

        actionCell.append(viewButton, invoiceButton, updateButton);

        row.append(
            createCell(order.orderNumber || "N/A"),
            createCell(order.customerName || "Unknown"),
            createCell(formatCurrency(order.total)),
            statusCell,
            actionCell,
            createCell(formattedDate)
        );

        ordersTableBody.appendChild(row);
    });

    updatePagination(orders.length, totalPages);
}

// =====================================
// UPDATE PAGINATION
// =====================================

function updatePagination(totalOrders, totalPages) {
    if (!ordersPagination) return;

    ordersPagination.innerHTML = "";

    const start = totalOrders === 0
        ? 0
        : (currentPage - 1) * ORDERS_PER_PAGE + 1;

    const end = Math.min(currentPage * ORDERS_PER_PAGE, totalOrders);

    const summaryContainer = document.createElement("div");

    summaryContainer.style.display = "flex";
    summaryContainer.style.flexDirection = "column";
    summaryContainer.style.gap = "6px";

    const summary = document.createElement("span");
    summary.textContent = `Showing ${start}-${end} of ${totalOrders} orders`;
    summary.style.fontWeight = "600";

    const pageIndicator = document.createElement("span");
    pageIndicator.textContent =
        `Page ${totalOrders === 0 ? 0 : currentPage} of ${totalPages}`;

    pageIndicator.style.color = "#666";
    pageIndicator.style.fontSize = "14px";

    summaryContainer.append(summary, pageIndicator);

    const buttons = document.createElement("div");

    buttons.style.display = "flex";
    buttons.style.flexWrap = "wrap";
    buttons.style.gap = "5px";

    function makeButton(label, disabled, action, active = false) {
        const button = document.createElement("button");

        button.textContent = label;
        button.disabled = disabled;

        button.style.padding = "8px 12px";
        button.style.border = "1px solid #ccc";
        button.style.borderRadius = "5px";
        button.style.cursor = disabled ? "not-allowed" : "pointer";

        if (active) {
            button.style.background = "#ff8c00";
            button.style.color = "white";
            button.style.borderColor = "#ff8c00";
            button.style.fontWeight = "bold";
        }

        if (disabled && !active) {
            button.style.opacity = "0.5";
        }

        button.addEventListener("click", action);
        buttons.appendChild(button);
    }

    makeButton("Previous", currentPage <= 1, () => {
        currentPage--;
        filterOrders();
    });

    for (let page = 1; page <= totalPages; page++) {
        makeButton(
            String(page),
            page === currentPage,
            () => {
                currentPage = page;
                filterOrders();
            },
            page === currentPage
        );
    }

    makeButton("Next", currentPage >= totalPages, () => {
        currentPage++;
        filterOrders();
    });

    ordersPagination.append(summaryContainer, buttons);
}

// =====================================
// SEARCH EVENTS
// =====================================

orderSearchInput.addEventListener("input", () => {
    currentPage = 1;
    filterOrders();
});

orderStatusFilter.addEventListener("change", () => {
    currentPage = 1;
    filterOrders();
});// =====================================
// ORDER DETAILS
// =====================================

function addOrderDetail(container, label, value) {
    const detail = document.createElement("div");
    detail.className = "order-detail-item";

    const title = document.createElement("strong");
    title.textContent = label;

    const content = document.createElement("span");
    content.textContent = value;

    detail.append(title, content);
    container.appendChild(detail);
}

function showOrderDetails(order) {
    orderDetailsContent.innerHTML = "";

    const heading = document.createElement("h3");
    heading.textContent = "Order Information";
    orderDetailsContent.appendChild(heading);

    const info = document.createElement("div");
    info.className = "order-info-grid";

    const date = new Date(order.date || order.createdAt);

    const formattedDate = isNaN(date.getTime())
        ? "Date unavailable"
        : date.toLocaleString("en-NG");

    addOrderDetail(info, "Order Number", order.orderNumber || "N/A");
    addOrderDetail(info, "Order Date", formattedDate);
    addOrderDetail(info, "Order Status", order.status || "Pending");

    orderDetailsContent.appendChild(info);

    const customerHeading = document.createElement("h3");
    customerHeading.textContent = "Customer Information";
    orderDetailsContent.appendChild(customerHeading);

    const customerInfo = document.createElement("div");
    customerInfo.className = "order-info-grid";

    addOrderDetail(customerInfo, "Customer Name", order.customerName || "Unknown");
    addOrderDetail(customerInfo, "Email Address", order.customerEmail || "Not provided");
    addOrderDetail(customerInfo, "Phone Number", order.customerPhone || "Not provided");

    orderDetailsContent.appendChild(customerInfo);

    const productsHeading = document.createElement("h3");
    productsHeading.textContent = "Purchased Products";
    orderDetailsContent.appendChild(productsHeading);

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const header = document.createElement("tr");

    ["Product", "Price", "Quantity", "Subtotal"].forEach(title => {
        const th = document.createElement("th");
        th.textContent = title;
        header.appendChild(th);
    });

    thead.appendChild(header);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const items = Array.isArray(order.items) ? order.items : [];

    if (items.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell("No product information available.");
        cell.colSpan = 4;
        row.appendChild(cell);
        tbody.appendChild(row);
    } else {
        items.forEach(item => {
            const price = Number(item.price || 0);
            const quantity = Number(item.quantity || 0);

            const row = document.createElement("tr");

            row.append(
                createCell(item.name || item.productName || "Unknown product"),
                createCell(formatCurrency(price)),
                createCell(quantity),
                createCell(formatCurrency(price * quantity))
            );

            tbody.appendChild(row);
        });
    }

    table.appendChild(tbody);
    orderDetailsContent.appendChild(table);

    const total = document.createElement("h3");
    total.textContent = "Order Total: " + formatCurrency(order.total);
    orderDetailsContent.appendChild(total);

    orderDetailsModal.hidden = false;
    document.body.classList.add("modal-open");
}

// =====================================
// CLOSE ORDER MODAL
// =====================================

function closeOrderDetails() {
    orderDetailsModal.hidden = true;

    if (customerDetailsModal.hidden) {
        document.body.classList.remove("modal-open");
    }
}

closeOrderModalButton.addEventListener("click", closeOrderDetails);

orderDetailsModal.addEventListener("click", event => {
    if (event.target === orderDetailsModal) {
        closeOrderDetails();
    }
});

// =====================================
// CUSTOMER DETAILS
// =====================================

function displayCustomers(orders) {
    customersTableBody.innerHTML = "";

    const customerMap = new Map();

    orders.forEach(order => {
        const email = order.customerEmail?.trim().toLowerCase();

        if (!email) return;

        if (!customerMap.has(email)) {
            customerMap.set(email, {
                name: order.customerName || "Unknown",
                email: order.customerEmail,
                phone: order.customerPhone || "Not provided",
                totalOrders: 0,
                totalSpent: 0,
                orders: []
            });
        }

        const customer = customerMap.get(email);

        customer.totalOrders++;
        customer.totalSpent += Number(order.total || 0);
        customer.orders.push(order);

        if (customer.phone === "Not provided" && order.customerPhone) {
            customer.phone = order.customerPhone;
        }

        if (customer.name === "Unknown" && order.customerName) {
            customer.name = order.customerName;
        }
    });

    if (customerMap.size === 0) {
        customersTableBody.innerHTML =
            '<tr><td colspan="6">No customers found.</td></tr>';
        return;
    }

    customerMap.forEach(customer => {
        const row = document.createElement("tr");

        const actionCell = document.createElement("td");

        const viewButton = document.createElement("button");
        viewButton.textContent = "View Details";
        viewButton.className = "view-order-button";

        viewButton.addEventListener("click", () => {
            showCustomerDetails(customer);
        });

        actionCell.appendChild(viewButton);

        row.append(
            createCell(customer.name),
            createCell(customer.email),
            createCell(customer.phone),
            createCell(customer.totalOrders),
            createCell(formatCurrency(customer.totalSpent)),
            actionCell
        );

        customersTableBody.appendChild(row);
    });
}

// =====================================
// SHOW CUSTOMER DETAILS
// =====================================

function showCustomerDetails(customer) {
    customerDetailsContent.innerHTML = "";

    const summaryHeading = document.createElement("h3");
    summaryHeading.textContent = "Customer Information";
    customerDetailsContent.appendChild(summaryHeading);

    const customerInfo = document.createElement("div");
    customerInfo.className = "order-info-grid";

    addOrderDetail(customerInfo, "Customer Name", customer.name);
    addOrderDetail(customerInfo, "Email Address", customer.email);
    addOrderDetail(customerInfo, "Phone Number", customer.phone);
    addOrderDetail(customerInfo, "Total Orders", customer.totalOrders);
    addOrderDetail(customerInfo, "Total Spent", formatCurrency(customer.totalSpent));

    customerDetailsContent.appendChild(customerInfo);

    const historyHeading = document.createElement("h3");
    historyHeading.textContent = "Complete Purchase History";
    historyHeading.style.marginTop = "25px";

    customerDetailsContent.appendChild(historyHeading);

    const sortedOrders = [...customer.orders].sort(
        (a, b) => getOrderDate(b) - getOrderDate(a)
    );

    if (sortedOrders.length === 0) {
        const message = document.createElement("p");
        message.textContent = "This customer has no purchase history.";
        customerDetailsContent.appendChild(message);
    } else {
        const tableContainer = document.createElement("div");
        tableContainer.className = "table-container";

        const table = document.createElement("table");

        const thead = document.createElement("thead");
        const header = document.createElement("tr");

        [
            "Order Number",
            "Date",
            "Products",
            "Status",
            "Order Total"
        ].forEach(title => {
            const th = document.createElement("th");
            th.textContent = title;
            header.appendChild(th);
        });

        thead.appendChild(header);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        sortedOrders.forEach(order => {
            const row = document.createElement("tr");

            const date = new Date(order.date || order.createdAt);

            const formattedDate = isNaN(date.getTime())
                ? "Date unavailable"
                : date.toLocaleDateString("en-NG");

            const items = Array.isArray(order.items) ? order.items : [];

            const productNames = items.length
                ? items.map(item => {
                    const name = item.name || item.productName || "Unknown product";
                    const quantity = Number(item.quantity || 0);
                    return `${name} (x${quantity})`;
                }).join(", ")
                : "No product information";

            row.append(
                createCell(order.orderNumber || "N/A"),
                createCell(formattedDate),
                createCell(productNames),
                createCell(order.status || "Pending"),
                createCell(formatCurrency(order.total))
            );

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);

        customerDetailsContent.appendChild(tableContainer);
    }

    customerDetailsModal.hidden = false;
    document.body.classList.add("modal-open");
}

// =====================================
// CLOSE CUSTOMER DETAILS MODAL
// =====================================

function closeCustomerDetails() {
    customerDetailsModal.hidden = true;

    if (orderDetailsModal.hidden) {
        document.body.classList.remove("modal-open");
    }
}

closeCustomerModalButton.addEventListener(
    "click",
    closeCustomerDetails
);

customerDetailsModal.addEventListener("click", event => {
    if (event.target === customerDetailsModal) {
        closeCustomerDetails();
    }
});

// =====================================
// CLOSE MODALS WITH ESCAPE
// =====================================

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        if (!orderDetailsModal.hidden) {
            closeOrderDetails();
        }

        if (!customerDetailsModal.hidden) {
            closeCustomerDetails();
        }
    }
});

// =====================================
// INVOICE GENERATION
// =====================================

function escapeInvoiceHTML(value) {
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

function generateOrderInvoice(order) {
    const invoiceWindow = window.open("", "_blank", "width=900,height=700");

    if (!invoiceWindow) {
        alert("Please allow pop-ups for ShopZone so the invoice can open.");
        return;
    }

    const date = new Date(order.date || order.createdAt);

    const formattedDate = isNaN(date.getTime())
        ? "Date unavailable"
        : date.toLocaleString("en-NG");

    const items = Array.isArray(order.items) ? order.items : [];

    const rows = items.map(item => {
        const name = escapeInvoiceHTML(item.name || item.productName || "Unknown product");
        const price = Number(item.price || 0);
        const quantity = Number(item.quantity || 0);

        return `
            <tr>
                <td>${name}</td>
                <td>${formatCurrency(price)}</td>
                <td>${quantity}</td>
                <td>${formatCurrency(price * quantity)}</td>
            </tr>
        `;
    }).join("");

    const invoiceHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>ShopZone Invoice</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    color: #333;
                }

                h1 {
                    color: #ff8c00;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                th, td {
                    border: 1px solid #ddd;
                    padding: 12px;
                    text-align: left;
                }

                th {
                    background: #f4f4f4;
                }

                .total {
                    text-align: right;
                    font-size: 22px;
                    font-weight: bold;
                }

                button {
                    padding: 12px 20px;
                    background: #ff8c00;
                    color: white;
                    border: none;
                    cursor: pointer;
                }

                @media print {
                    button {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <h1>SHOPZONE</h1>
            <h2>INVOICE</h2>

            <p><strong>Order:</strong> ${escapeInvoiceHTML(order.orderNumber || "N/A")}</p>
            <p><strong>Date:</strong> ${escapeInvoiceHTML(formattedDate)}</p>
            <p><strong>Status:</strong> ${escapeInvoiceHTML(order.status || "Pending")}</p>

            <h3>Customer Information</h3>
            <p>${escapeInvoiceHTML(order.customerName || "Unknown")}</p>
            <p>${escapeInvoiceHTML(order.customerEmail || "Email not provided")}</p>
            <p>${escapeInvoiceHTML(order.customerPhone || "Phone not provided")}</p>

            <h3>Order Items</h3>

            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Unit Price</th>
                        <th>Quantity</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="4">No product information available.</td></tr>'}
                </tbody>
            </table>

            <p class="total">Order Total: ${formatCurrency(order.total)}</p>

            <p>Thank you for shopping with ShopZone!</p>

            <button onclick="window.print()">Print / Save as PDF</button>
        </body>
        </html>
    `;

    invoiceWindow.document.open();
    invoiceWindow.document.write(invoiceHTML);
    invoiceWindow.document.close();
}// =====================================
// UPDATE ORDER STATUS
// =====================================

async function updateOrderStatus(orderNumber, status, button) {
    if (status === "Cancelled") {
        const confirmed = confirm(
            "Are you sure you want to cancel this order?\n\n" +
            "The purchased products will automatically be returned to stock."
        );

        if (!confirmed) return;
    }

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Updating...";

    try {
        const response = await fetch(
            `${ORDERS_API_URL}/${encodeURIComponent(orderNumber)}/status`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${adminToken}`
                },
                body: JSON.stringify({ status })
            }
        );

        if (checkAuthentication(response)) return;

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Status update failed.");
        }

        alert(data.message || "Order status updated successfully!");

        await loadDashboard();
        await loadProducts();

    } catch (error) {
        console.error("Status update error:", error);
        alert(error.message);

        button.disabled = false;
        button.textContent = originalText;
    }
}

// =====================================
// LOAD PRODUCTS
// =====================================

async function loadProducts() {
    try {
        productsTableBody.innerHTML =
            '<tr><td colspan="5">Loading products...</td></tr>';

        const response = await fetch(PRODUCTS_API_URL, {
            headers: {
                Authorization: `Bearer ${adminToken}`
            }
        });

        if (checkAuthentication(response)) return;

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load products.");
        }

        const products = data.products || [];

        displayProducts(products);
        displayStockSummary(products);
        displayStockAlerts(products);

    } catch (error) {
        console.error("Product loading error:", error);

        productsTableBody.innerHTML =
            `<tr><td colspan="5">Could not load products. ${error.message}</td></tr>`;

        if (stockAlertCountElement) {
            stockAlertCountElement.textContent = "—";
        }

        if (stockAlertSummary) {
            stockAlertSummary.textContent = "Unable to load stock alerts.";
        }

        if (lowStockAlertsBody) {
            lowStockAlertsBody.innerHTML =
                '<tr><td colspan="4">Could not load stock alerts.</td></tr>';
        }
    }
}

// =====================================
// STOCK SUMMARY
// =====================================

function displayStockSummary(products) {
    let summary = document.getElementById("stock-summary");

    if (!summary) {
        summary = document.createElement("div");
        summary.id = "stock-summary";
        summary.className = "stock-summary";

        const table = productsTableBody.closest("table");

        if (table) {
            table.before(summary);
        }
    }

    const outOfStock = products.filter(
        product => Number(product.stock) <= 0
    ).length;

    const lowStock = products.filter(
        product =>
            Number(product.stock) > 0 &&
            Number(product.stock) <= LOW_STOCK_LIMIT
    ).length;

    const inStock = products.filter(
        product => Number(product.stock) > LOW_STOCK_LIMIT
    ).length;

    summary.innerHTML = `
        <h3>Stock Overview</h3>

        <div class="stock-summary-items">
            <div class="stock-summary-card">
                <strong>${inStock}</strong>
                <span>In Stock</span>
            </div>

            <div class="stock-summary-card">
                <strong>${lowStock}</strong>
                <span>Low Stock</span>
            </div>

            <div class="stock-summary-card">
                <strong>${outOfStock}</strong>
                <span>Out of Stock</span>
            </div>
        </div>
    `;
}

// =====================================
// DISPLAY STOCK ALERTS
// =====================================

function displayStockAlerts(products) {
    if (!stockAlertCountElement || !stockAlertSummary || !lowStockAlertsBody) {
        console.warn("Stock alert HTML elements were not found.");
        return;
    }

    const lowStockProducts = products.filter(product => {
        const stock = Number(product.stock);
        return stock > 0 && stock <= LOW_STOCK_LIMIT;
    });

    const outOfStockProducts = products.filter(product => {
        return Number(product.stock) <= 0;
    });

    const alertProducts = [...outOfStockProducts, ...lowStockProducts];

    stockAlertCountElement.textContent = alertProducts.length;

    stockAlertSummary.innerHTML = "";

    const summaryContainer = document.createElement("div");
    summaryContainer.className = "stock-alert-summary-items";

    const outCard = document.createElement("div");
    outCard.className = "stock-alert-card out-of-stock-alert";

    const outNumber = document.createElement("strong");
    outNumber.textContent = outOfStockProducts.length;

    const outLabel = document.createElement("span");
    outLabel.textContent = "Out of Stock";

    outCard.append(outNumber, outLabel);

    const lowCard = document.createElement("div");
    lowCard.className = "stock-alert-card low-stock-alert";

    const lowNumber = document.createElement("strong");
    lowNumber.textContent = lowStockProducts.length;

    const lowLabel = document.createElement("span");
    lowLabel.textContent = "Low Stock";

    lowCard.append(lowNumber, lowLabel);

    summaryContainer.append(outCard, lowCard);
    stockAlertSummary.appendChild(summaryContainer);

    lowStockAlertsBody.innerHTML = "";

    if (alertProducts.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell("All products have sufficient stock.");
        cell.colSpan = 4;
        row.appendChild(cell);
        lowStockAlertsBody.appendChild(row);
        return;
    }

    alertProducts.sort((a, b) => {
        return Number(a.stock) - Number(b.stock);
    });

    alertProducts.forEach(product => {
        const row = document.createElement("tr");

        const stock = Number(product.stock);

        const alertCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className = "stock-alert-badge";

        if (stock <= 0) {
            badge.textContent = "OUT OF STOCK";
            badge.classList.add("out-of-stock");
        } else {
            badge.textContent = "LOW STOCK";
            badge.classList.add("low-stock");
        }

        alertCell.appendChild(badge);

        row.append(
            createCell(product.name || "Unnamed product"),
            createCell(product.category || "Uncategorized"),
            createCell(stock),
            alertCell
        );

        lowStockAlertsBody.appendChild(row);
    });
}

// =====================================
// DISPLAY PRODUCTS
// =====================================

function displayProducts(products) {
    productsTableBody.innerHTML = "";

    if (products.length === 0) {
        productsTableBody.innerHTML =
            '<tr><td colspan="5">No products found. Add your first product above.</td></tr>';
        return;
    }

    products.forEach(product => {
        const row = document.createElement("tr");

        const stockCell = document.createElement("td");
        const stock = Number(product.stock);

        const badge = document.createElement("span");
        badge.className = "stock-badge";

        if (stock <= 0) {
            badge.textContent = "Out of Stock (0)";
            badge.classList.add("out-of-stock");
        } else if (stock <= LOW_STOCK_LIMIT) {
            badge.textContent = `Low Stock (${stock})`;
            badge.classList.add("low-stock");
        } else {
            badge.textContent = `In Stock (${stock})`;
            badge.classList.add("in-stock");
        }

        stockCell.appendChild(badge);

        const actionCell = document.createElement("td");

        // EDIT BUTTON
        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.className = "edit-product-button";
        editButton.addEventListener("click", () => editProduct(product));

        // RESTOCK BUTTON
        const restockButton = document.createElement("button");
        restockButton.textContent = "Restock";
        restockButton.className = "restock-product-button";

        restockButton.style.background = "#198754";
        restockButton.style.color = "#ffffff";
        restockButton.style.border = "none";
        restockButton.style.padding = "8px 12px";
        restockButton.style.borderRadius = "5px";
        restockButton.style.cursor = "pointer";
        restockButton.style.margin = "3px";

        restockButton.addEventListener("click", () => {
            restockProduct(product, restockButton);
        });

        // DELETE BUTTON
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-product-button";

        deleteButton.addEventListener("click", () => {
            deleteProduct(product._id, product.name);
        });

        actionCell.append(editButton, restockButton, deleteButton);

        row.append(
            createCell(product.name),
            createCell(product.category),
            createCell(formatCurrency(product.price)),
            stockCell,
            actionCell
        );

        productsTableBody.appendChild(row);
    });
}// =====================================
// RESTOCK PRODUCT
// =====================================

async function restockProduct(product, button) {
    const quantityInput = prompt(
        `RESTOCK PRODUCT\n\n` +
        `Product: ${product.name}\n` +
        `Current Stock: ${product.stock}\n\n` +
        `Enter the quantity received:`
    );

    // Stop if the administrator cancels.
    if (quantityInput === null) {
        return;
    }

    const quantity = Number(quantityInput.trim());

    if (
        quantityInput.trim() === "" ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
    ) {
        alert("Please enter a valid positive whole number.");
        return;
    }

    const confirmed = confirm(
        `Confirm Restock\n\n` +
        `Product: ${product.name}\n` +
        `Current Stock: ${product.stock}\n` +
        `Quantity Received: ${quantity}\n` +
        `New Stock: ${Number(product.stock) + quantity}\n\n` +
        `Do you want to continue?`
    );

    if (!confirmed) {
        return;
    }

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Restocking...";

    try {
        const response = await fetch(
            `${PRODUCTS_API_URL}/${product._id}/restock`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    quantity: quantity
                })
            }
        );

        if (checkAuthentication(response)) return;

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to restock product.");
        }

        alert(
            `${data.message}\n\n` +
            `New Available Stock: ${data.product.stock}`
        );

        // Refresh Product Management, Stock Overview and Stock Alerts.
        await loadProducts();

    } catch (error) {
        console.error("Restocking product error:", error);
        alert(error.message);

        button.disabled = false;
        button.textContent = originalText;
    }
}

// =====================================
// ADD OR EDIT PRODUCT
// =====================================

productForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const productId = productIdInput.value;

    const productData = {
        name: productNameInput.value.trim(),
        price: Number(productPriceInput.value),
        category: productCategoryInput.value,
        image: productImageInput.value.trim(),
        description: productDescriptionInput.value.trim(),
        stock: Number(productStockInput.value)
    };

    if (
        !productData.name ||
        !productData.category ||
        !Number.isFinite(productData.price) ||
        productData.price < 0 ||
        !Number.isInteger(productData.stock) ||
        productData.stock < 0
    ) {
        showProductMessage("Please enter valid product details.", "red");
        return;
    }

    saveProductButton.disabled = true;
    saveProductButton.textContent = "Saving...";

    try {
        const url = productId
            ? `${PRODUCTS_API_URL}/${productId}`
            : PRODUCTS_API_URL;

        const response = await fetch(url, {
            method: productId ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify(productData)
        });

        if (checkAuthentication(response)) return;

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to save product.");
        }

        showProductMessage(data.message, "green");

        resetProductForm();
        await loadProducts();

    } catch (error) {
        console.error("Saving product error:", error);
        showProductMessage(error.message, "red");

    } finally {
        saveProductButton.disabled = false;
        saveProductButton.textContent = productIdInput.value
            ? "Update Product"
            : "Add Product";
    }
});

// =====================================
// EDIT PRODUCT
// =====================================

function editProduct(product) {
    productIdInput.value = product._id;
    productNameInput.value = product.name;
    productPriceInput.value = product.price;
    productCategoryInput.value = product.category;
    productStockInput.value = product.stock;
    productImageInput.value = product.image || "";
    productDescriptionInput.value = product.description || "";

    productFormTitle.textContent = "Edit Product";
    saveProductButton.textContent = "Update Product";
    cancelEditButton.hidden = false;

    document.getElementById("products").scrollIntoView({
        behavior: "smooth"
    });
}

// =====================================
// DELETE PRODUCT
// =====================================

async function deleteProduct(productId, productName) {
    const confirmed = confirm(
        `Are you sure you want to delete ${productName}?`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `${PRODUCTS_API_URL}/${productId}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${adminToken}`
                }
            }
        );

        if (checkAuthentication(response)) return;

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to delete product.");
        }

        alert("Product deleted successfully!");

        resetProductForm();
        await loadProducts();

    } catch (error) {
        console.error("Deleting product error:", error);
        alert(error.message);
    }
}

// =====================================
// RESET PRODUCT FORM
// =====================================

function resetProductForm() {
    productForm.reset();

    productIdInput.value = "";

    productFormTitle.textContent = "Add New Product";
    saveProductButton.textContent = "Add Product";

    cancelEditButton.hidden = true;
}

// =====================================
// CANCEL PRODUCT EDIT
// =====================================

cancelEditButton.addEventListener("click", function() {
    resetProductForm();
    showProductMessage("", "");
});

// =====================================
// PRODUCT MESSAGES
// =====================================

function showProductMessage(message, color) {
    productMessage.textContent = message;
    productMessage.style.color = color;
}

// =====================================
// ADMIN LOGOUT
// =====================================

logoutButton.addEventListener("click", function() {
    const confirmed = confirm("Are you sure you want to log out?");

    if (confirmed) {
        localStorage.removeItem("shopzone-admin-token");
        window.location.href = "admin.html";
    }
});

// =====================================
// START DASHBOARD
// =====================================

if (adminToken) {
    // Always start at the top when the dashboard is loaded or reloaded.
    window.scrollTo(0, 0);

    loadDashboard();
    loadProducts();
}
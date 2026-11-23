// =====================================
// SHOPZONE DASHBOARD ANALYTICS
// DATE FILTERING + PDF + EXCEL EXPORT
// =====================================

const ANALYTICS_API_URL = "https://shopzone-sojz.onrender.com/api/orders";

const analyticsToken = localStorage.getItem("shopzone-admin-token");

const revenueCanvas = document.getElementById("monthly-revenue-chart");
const productsCanvas = document.getElementById("best-selling-chart");
const performanceBody = document.getElementById("product-performance-body");

let analyticsOrders = [];
let currentDateRange = "all";
let currentFilteredOrders = [];
let currentProductData = [];
let currentRevenueData = [];

// =====================================
// CURRENCY FORMAT
// =====================================

function analyticsCurrency(amount) {
    return "\u20A6" + Number(amount || 0).toLocaleString("en-NG");
}

// =====================================
// LOAD EXTERNAL LIBRARY
// =====================================

function loadExternalLibrary(url) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(
            `script[src="${url}"]`
        );

        if (existing) {
            if (existing.dataset.loaded === "true") {
                resolve();
                return;
            }

            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }

        const script = document.createElement("script");

        script.src = url;

        script.onload = () => {
            script.dataset.loaded = "true";
            resolve();
        };

        script.onerror = reject;

        document.head.appendChild(script);
    });
}

// =====================================
// CREATE DATE FILTER AND EXPORT BUTTONS
// =====================================

function createAnalyticsDateFilter() {
    const analyticsSection = document.getElementById("analytics");

    if (!analyticsSection || document.getElementById("analytics-date-filter")) {
        return;
    }

    const heading = analyticsSection.querySelector(".section-heading");

    if (!heading) return;

    const container = document.createElement("div");

    container.id = "analytics-filter-container";

    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.gap = "12px";
    container.style.marginBottom = "20px";
    container.style.flexWrap = "wrap";

    const label = document.createElement("label");

    label.htmlFor = "analytics-date-filter";
    label.textContent = "Filter Sales:";
    label.style.fontWeight = "bold";

    const select = document.createElement("select");

    select.id = "analytics-date-filter";

    select.style.padding = "12px";
    select.style.border = "1px solid #ddd";
    select.style.borderRadius = "7px";
    select.style.background = "white";
    select.style.fontSize = "14px";
    select.style.cursor = "pointer";

    const options = [
        { value: "today", text: "Today" },
        { value: "7days", text: "Last 7 Days" },
        { value: "30days", text: "Last 30 Days" },
        { value: "year", text: "This Year" },
        { value: "all", text: "All Time" }
    ];

    options.forEach(option => {
        const element = document.createElement("option");

        element.value = option.value;
        element.textContent = option.text;

        select.appendChild(element);
    });

    select.value = currentDateRange;

    select.addEventListener("change", function() {
        currentDateRange = this.value;
        updateAnalytics();
    });

    // PDF BUTTON

    const pdfButton = document.createElement("button");

    pdfButton.textContent = "Export PDF";
    pdfButton.type = "button";

    styleExportButton(pdfButton, "#dc2626");

    pdfButton.addEventListener("click", exportAnalyticsPDF);

    // EXCEL BUTTON

    const excelButton = document.createElement("button");

    excelButton.textContent = "Export Excel";
    excelButton.type = "button";

    styleExportButton(excelButton, "#15803d");

    excelButton.addEventListener("click", exportAnalyticsExcel);

    container.append(
        label,
        select,
        pdfButton,
        excelButton
    );

    heading.insertAdjacentElement("afterend", container);
}

// =====================================
// STYLE EXPORT BUTTONS
// =====================================

function styleExportButton(button, background) {
    button.style.padding = "12px 18px";
    button.style.border = "none";
    button.style.borderRadius = "7px";
    button.style.background = background;
    button.style.color = "white";
    button.style.fontWeight = "bold";
    button.style.cursor = "pointer";
    button.style.fontSize = "14px";
}

// =====================================
// GET SELECTED DATE RANGE NAME
// =====================================

function getDateRangeName() {
    const names = {
        today: "Today",
        "7days": "Last 7 Days",
        "30days": "Last 30 Days",
        year: "This Year",
        all: "All Time"
    };

    return names[currentDateRange] || "All Time";
}

// =====================================
// GET ORDER DATE
// =====================================

function getAnalyticsOrderDate(order) {
    const value = order.date || order.createdAt;

    if (!value) return null;

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return null;
    }

    return date;
}

// =====================================
// FILTER ORDERS BY DATE
// =====================================

function filterAnalyticsOrders(orders) {
    const now = new Date();

    const startDate = new Date(now);

    startDate.setHours(0, 0, 0, 0);

    if (currentDateRange === "today") {
        // Today's orders
    }

    else if (currentDateRange === "7days") {
        startDate.setDate(startDate.getDate() - 6);
    }

    else if (currentDateRange === "30days") {
        startDate.setDate(startDate.getDate() - 29);
    }

    else if (currentDateRange === "year") {
        startDate.setMonth(0, 1);
    }

    else if (currentDateRange === "all") {
        return orders;
    }

    return orders.filter(order => {
        const orderDate = getAnalyticsOrderDate(order);

        return orderDate && orderDate >= startDate && orderDate <= now;
    });
}

// =====================================
// LOAD ANALYTICS
// =====================================

async function loadAnalytics() {
    try {
        if (!analyticsToken) {
            performanceBody.innerHTML =
                '<tr><td colspan="3">Please log in again to view analytics.</td></tr>';

            return;
        }

        performanceBody.innerHTML =
            '<tr><td colspan="3">Loading analytics...</td></tr>';

        const response = await fetch(ANALYTICS_API_URL, {
            headers: {
                Authorization: `Bearer ${analyticsToken}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            performanceBody.innerHTML =
                '<tr><td colspan="3">Your session has expired. Please log in again.</td></tr>';

            return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load analytics.");
        }

        analyticsOrders = (data.orders || []).filter(order => {
            return order.status !== "Cancelled";
        });

        createAnalyticsDateFilter();

        updateAnalytics();

    } catch (error) {
        console.error("Analytics loading error:", error);

        performanceBody.innerHTML =
            '<tr><td colspan="3">Unable to load sales analytics.</td></tr>';
    }
}

// =====================================
// UPDATE ALL ANALYTICS
// =====================================

function updateAnalytics() {
    const filteredOrders = filterAnalyticsOrders(analyticsOrders);

    currentFilteredOrders = filteredOrders;

    const monthlyData = calculateRevenueTrend(filteredOrders);

    const productData = calculateBestSellingProducts(filteredOrders);

    currentRevenueData = monthlyData;
    currentProductData = productData;

    drawRevenueChart(monthlyData);

    drawBestSellingChart(productData);

    displayProductPerformance(productData);
}

// =====================================
// CALCULATE REVENUE TREND
// =====================================

function calculateRevenueTrend(orders) {
    const results = [];

    const now = new Date();

    const dailyMode = ["today", "7days", "30days"].includes(currentDateRange);

    if (dailyMode) {
        const days = currentDateRange === "today" ? 1 :
            currentDateRange === "7days" ? 7 : 30;

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);

            date.setDate(date.getDate() - i);

            const revenue = orders.reduce((total, order) => {
                const orderDate = getAnalyticsOrderDate(order);

                if (!orderDate) return total;

                const sameDay =
                    orderDate.getFullYear() === date.getFullYear() &&
                    orderDate.getMonth() === date.getMonth() &&
                    orderDate.getDate() === date.getDate();

                return sameDay
                    ? total + Number(order.total || 0)
                    : total;
            }, 0);

            results.push({
                label: currentDateRange === "today"
                    ? "Today"
                    : date.toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short"
                    }),
                revenue
            });
        }
    }

    else {
        const months = currentDateRange === "year"
            ? now.getMonth() + 1
            : 12;

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(
                now.getFullYear(),
                now.getMonth() - i,
                1
            );

            const year = date.getFullYear();
            const month = date.getMonth();

            const revenue = orders.reduce((total, order) => {
                const orderDate = getAnalyticsOrderDate(order);

                if (!orderDate) return total;

                if (
                    orderDate.getFullYear() === year &&
                    orderDate.getMonth() === month
                ) {
                    return total + Number(order.total || 0);
                }

                return total;
            }, 0);

            results.push({
                label: date.toLocaleDateString("en-NG", {
                    month: "short"
                }),
                revenue
            });
        }
    }

    return results;
}

// =====================================
// CALCULATE BEST-SELLING PRODUCTS
// =====================================

function calculateBestSellingProducts(orders) {
    const products = new Map();

    orders.forEach(order => {
        const items = Array.isArray(order.items)
            ? order.items
            : [];

        items.forEach(item => {
            const name =
                item.name ||
                item.productName ||
                "Unknown Product";

            const quantity = Number(item.quantity || 0);
            const price = Number(item.price || 0);

            if (!products.has(name)) {
                products.set(name, {
                    name,
                    quantity: 0,
                    revenue: 0
                });
            }

            const product = products.get(name);

            product.quantity += quantity;
            product.revenue += price * quantity;
        });
    });

    return Array.from(products.values())
        .sort((a, b) => b.quantity - a.quantity);
}

// =====================================
// DRAW REVENUE CHART
// =====================================

function drawRevenueChart(data) {
    const canvas = revenueCanvas;

    if (!canvas) return;

    const context = canvas.getContext("2d");

    const width = canvas.clientWidth || 500;
    const height = 300;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    context.clearRect(0, 0, width, height);

    const padding = {
        top: 25,
        right: 20,
        bottom: 45,
        left: 65
    };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxRevenue = Math.max(
        1000,
        ...data.map(item => item.revenue)
    );

    context.strokeStyle = "#e5e7eb";
    context.lineWidth = 1;

    context.fillStyle = "#666";
    context.font = "11px Arial";
    context.textAlign = "right";

    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;

        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(width - padding.right, y);
        context.stroke();

        const value = maxRevenue * (1 - i / 4);

        context.fillText(
            "\u20A6" + Math.round(value).toLocaleString("en-NG"),
            padding.left - 8,
            y + 4
        );
    }

    const gap = data.length > 10 ? 5 : 12;

    const barWidth = Math.max(
        2,
        (chartWidth - gap * (data.length - 1)) / data.length
    );

    data.forEach((item, index) => {
        const barHeight = (item.revenue / maxRevenue) * chartHeight;

        const x = padding.left + index * (barWidth + gap);

        const y = padding.top + chartHeight - barHeight;

        context.fillStyle = "#ff8c00";

        context.fillRect(x, y, barWidth, barHeight);

        context.fillStyle = "#444";
        context.textAlign = "center";
        context.font = data.length > 10 ? "9px Arial" : "12px Arial";

        context.fillText(
            item.label,
            x + barWidth / 2,
            height - 15
        );
    });

    if (data.every(item => item.revenue === 0)) {
        context.fillStyle = "#777";
        context.textAlign = "center";
        context.font = "14px Arial";

        context.fillText(
            "No sales recorded in this period",
            width / 2,
            height / 2
        );
    }
}

// =====================================
// DRAW BEST-SELLING PRODUCTS CHART
// =====================================

function drawBestSellingChart(products) {
    const canvas = productsCanvas;

    if (!canvas) return;

    const context = canvas.getContext("2d");

    const width = canvas.clientWidth || 500;
    const height = 300;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    context.clearRect(0, 0, width, height);

    const topProducts = products.slice(0, 5);

    if (topProducts.length === 0) {
        context.fillStyle = "#777";
        context.textAlign = "center";
        context.font = "14px Arial";

        context.fillText(
            "No product sales recorded in this period",
            width / 2,
            height / 2
        );

        return;
    }

    const maxQuantity = Math.max(
        1,
        ...topProducts.map(product => product.quantity)
    );

    const left = 120;
    const right = 35;
    const top = 25;
    const rowHeight = 48;

    topProducts.forEach((product, index) => {
        const y = top + index * rowHeight;

        const availableWidth = width - left - right;

        const barWidth =
            (product.quantity / maxQuantity) * availableWidth;

        context.fillStyle = "#444";
        context.font = "12px Arial";
        context.textAlign = "right";

        let name = product.name;

        if (name.length > 16) {
            name = name.substring(0, 14) + "...";
        }

        context.fillText(name, left - 10, y + 17);

        context.fillStyle = "#2563eb";

        context.fillRect(left, y, barWidth, 22);

        context.fillStyle = "#333";
        context.textAlign = "left";
        context.font = "12px Arial";

        context.fillText(
            String(product.quantity),
            left + barWidth + 7,
            y + 16
        );
    });
}

// =====================================
// DISPLAY PRODUCT PERFORMANCE
// =====================================

function displayProductPerformance(products) {
    performanceBody.innerHTML = "";

    if (products.length === 0) {
        performanceBody.innerHTML =
            '<tr><td colspan="3">No product sales recorded in this period.</td></tr>';

        return;
    }

    products.forEach(product => {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = product.name;

        const quantityCell = document.createElement("td");
        quantityCell.textContent = product.quantity;

        const revenueCell = document.createElement("td");
        revenueCell.textContent = analyticsCurrency(product.revenue);

        row.append(
            nameCell,
            quantityCell,
            revenueCell
        );

        performanceBody.appendChild(row);
    });
}

// =====================================
// EXPORT ANALYTICS TO EXCEL
// =====================================

async function exportAnalyticsExcel() {
    try {
        await loadExternalLibrary(
            "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"
        );

        const productRows = currentProductData.map(product => ({
            "Product Name": product.name,
            "Quantity Sold": product.quantity,
            "Revenue (NGN)": product.revenue
        }));

        const revenueRows = currentRevenueData.map(item => ({
            "Period": item.label,
            "Revenue (NGN)": item.revenue
        }));

        const orderRows = currentFilteredOrders.map(order => ({
            "Order Number": order.orderNumber || "N/A",
            "Customer": order.customerName || "N/A",
            "Email": order.customerEmail || "N/A",
            "Status": order.status || "N/A",
            "Total (NGN)": Number(order.total || 0),
            "Date": getAnalyticsOrderDate(order)
                ? getAnalyticsOrderDate(order).toLocaleDateString("en-NG")
                : "N/A"
        }));

        const workbook = XLSX.utils.book_new();

        const productSheet = XLSX.utils.json_to_sheet(productRows);
        const revenueSheet = XLSX.utils.json_to_sheet(revenueRows);
        const orderSheet = XLSX.utils.json_to_sheet(orderRows);

        XLSX.utils.book_append_sheet(
            workbook,
            productSheet,
            "Product Performance"
        );

        XLSX.utils.book_append_sheet(
            workbook,
            revenueSheet,
            "Revenue Report"
        );

        XLSX.utils.book_append_sheet(
            workbook,
            orderSheet,
            "Orders"
        );

        const date = new Date().toISOString().slice(0, 10);

        XLSX.writeFile(
            workbook,
            `ShopZone-Analytics-${date}.xlsx`
        );

        alert("Excel report downloaded successfully!");

    } catch (error) {
        console.error("Excel export error:", error);

        alert("Unable to export Excel. Check your internet connection and try again.");
    }
}

// =====================================
// EXPORT ANALYTICS TO PDF
// =====================================

function exportAnalyticsPDF() {
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
        alert("Please allow pop-ups in your browser to export the PDF.");
        return;
    }

    const date = new Date().toLocaleDateString("en-NG");

    const productRows = currentProductData.map(product => `
        <tr>
            <td>${escapeHTML(product.name)}</td>
            <td>${product.quantity}</td>
            <td>${analyticsCurrency(product.revenue)}</td>
        </tr>
    `).join("");

    const revenueRows = currentRevenueData.map(item => `
        <tr>
            <td>${escapeHTML(item.label)}</td>
            <td>${analyticsCurrency(item.revenue)}</td>
        </tr>
    `).join("");

    const totalRevenue = currentFilteredOrders.reduce(
        (total, order) => total + Number(order.total || 0),
        0
    );

    const revenueChart = revenueCanvas
        ? revenueCanvas.toDataURL("image/png")
        : "";

    const productsChart = productsCanvas
        ? productsCanvas.toDataURL("image/png")
        : "";

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>ShopZone Analytics Report</title>

            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    color: #222;
                }

                h1 {
                    color: #ff8c00;
                    margin-bottom: 5px;
                }

                h2 {
                    margin-top: 30px;
                    border-bottom: 2px solid #ff8c00;
                    padding-bottom: 8px;
                }

                .summary {
                    display: flex;
                    gap: 20px;
                    margin: 25px 0;
                }

                .card {
                    border: 1px solid #ddd;
                    padding: 15px;
                    flex: 1;
                    border-radius: 6px;
                }

                .card strong {
                    display: block;
                    margin-bottom: 8px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }

                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: left;
                }

                th {
                    background: #f3f4f6;
                }

                img {
                    max-width: 100%;
                    margin-top: 15px;
                }

                .footer {
                    margin-top: 35px;
                    text-align: center;
                    color: #777;
                    font-size: 12px;
                }

                @media print {
                    body {
                        padding: 10px;
                    }

                    .summary {
                        display: flex;
                    }
                }
            </style>
        </head>

        <body>

            <h1>SHOPZONE</h1>
            <h3>Sales Analytics Report</h3>

            <p><strong>Date Generated:</strong> ${date}</p>
            <p><strong>Selected Period:</strong> ${getDateRangeName()}</p>

            <div class="summary">
                <div class="card">
                    <strong>Total Revenue</strong>
                    ${analyticsCurrency(totalRevenue)}
                </div>

                <div class="card">
                    <strong>Total Orders</strong>
                    ${currentFilteredOrders.length}
                </div>

                <div class="card">
                    <strong>Products Sold</strong>
                    ${currentProductData.reduce(
                        (total, product) => total + product.quantity,
                        0
                    )}
                </div>
            </div>

            <h2>Revenue Trend</h2>

            ${revenueChart
                ? `<img src="${revenueChart}" alt="Revenue chart">`
                : ""}

            <table>
                <thead>
                    <tr>
                        <th>Period</th>
                        <th>Revenue</th>
                    </tr>
                </thead>

                <tbody>
                    ${revenueRows}
                </tbody>
            </table>

            <h2>Best-Selling Products</h2>

            ${productsChart
                ? `<img src="${productsChart}" alt="Best-selling products chart">`
                : ""}

            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Quantity Sold</th>
                        <th>Revenue</th>
                    </tr>
                </thead>

                <tbody>
                    ${productRows}
                </tbody>
            </table>

            <div class="footer">
                ShopZone Sales Analytics Report
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 700);
                };
            <\/script>

        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}

// =====================================
// ESCAPE HTML
// =====================================

function escapeHTML(value) {
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
// RESPONSIVE CHARTS
// =====================================

let analyticsResizeTimer;

window.addEventListener("resize", function() {
    clearTimeout(analyticsResizeTimer);

    analyticsResizeTimer = setTimeout(() => {
        updateAnalytics();
    }, 300);
});

// =====================================
// START ANALYTICS
// =====================================

loadAnalytics();
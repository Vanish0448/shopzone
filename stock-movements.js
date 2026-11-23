// =====================================
// SHOPZONE STOCK MOVEMENT HISTORY
// =====================================

const STOCK_MOVEMENTS_API_URL =
    "https://shopzone-sojz.onrender.com/api/stock-movements";

const stockMovementsBody =
    document.getElementById("stock-movements-body");

const stockMovementToken =
    localStorage.getItem("shopzone-admin-token");

// =====================================
// FORMAT CURRENCY
// =====================================

function formatStockCurrency(amount) {
    return "\u20A6" + Number(amount || 0).toLocaleString("en-NG");
}

// =====================================
// FORMAT DATE AND TIME
// =====================================

function formatMovementDate(date) {
    if (!date) {
        return "Not available";
    }

    const movementDate = new Date(date);

    if (Number.isNaN(movementDate.getTime())) {
        return "Not available";
    }

    return movementDate.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

// =====================================
// ESCAPE HTML
// =====================================

function escapeMovementHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const characters = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return characters[character];
    });
}

// =====================================
// MOVEMENT TYPE LABEL
// =====================================

function getMovementLabel(type) {
    const labels = {
        RESTOCK: "Restock",
        SALE: "Sale",
        CANCELLATION_RESTOCK: "Cancellation Restock"
    };

    return labels[type] || type || "Unknown";
}

// =====================================
// LOAD STOCK MOVEMENT HISTORY
// =====================================

async function loadStockMovements() {
    if (!stockMovementsBody) {
        return;
    }

    if (!stockMovementToken) {
        stockMovementsBody.innerHTML = `
            <tr>
                <td colspan="7">
                    Please log in again to view stock movement history.
                </td>
            </tr>
        `;
        return;
    }

    stockMovementsBody.innerHTML = `
        <tr>
            <td colspan="7">Loading stock movement history...</td>
        </tr>
    `;

    try {
        const response = await fetch(STOCK_MOVEMENTS_API_URL, {
            headers: {
                Authorization: `Bearer ${stockMovementToken}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            stockMovementsBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        Your admin session has expired. Please log in again.
                    </td>
                </tr>
            `;
            return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to load stock movement history."
            );
        }

        displayStockMovements(data.movements || []);

    } catch (error) {
        console.error("Stock movement history error:", error);

        stockMovementsBody.innerHTML = `
            <tr>
                <td colspan="7">
                    Unable to load stock movement history.
                    Please refresh the page.
                </td>
            </tr>
        `;
    }
}

// =====================================
// DISPLAY STOCK MOVEMENT HISTORY
// =====================================

function displayStockMovements(movements) {
    if (!stockMovementsBody) {
        return;
    }

    if (!movements.length) {
        stockMovementsBody.innerHTML = `
            <tr>
                <td colspan="7">
                    No stock movement records found.
                </td>
            </tr>
        `;
        return;
    }

    stockMovementsBody.innerHTML = movements.map(movement => {

        const productName = escapeMovementHTML(
            movement.productName
        );

        const movementType = escapeMovementHTML(
            getMovementLabel(movement.movementType)
        );

        const quantity = Number(movement.quantity || 0);

        const previousStock = Number(
            movement.previousStock || 0
        );

        const newStock = Number(
            movement.newStock || 0
        );

        const orderNumber = escapeMovementHTML(
            movement.orderNumber || "N/A"
        );

        const date = escapeMovementHTML(
            formatMovementDate(movement.createdAt)
        );

        return `
            <tr>
                <td>${productName}</td>
                <td>${movementType}</td>
                <td>${quantity}</td>
                <td>${previousStock}</td>
                <td>${newStock}</td>
                <td>${orderNumber}</td>
                <td>${date}</td>
            </tr>
        `;

    }).join("");
}

// =====================================
// INITIALIZE
// =====================================

loadStockMovements();
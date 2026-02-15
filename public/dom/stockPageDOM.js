let currentStock = [];
let adjustmentList = [];
let currentPage = 1;
const rowsPerPage = 20;
const maxVisibleButtons = 12;
let adjustmentMode = false;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Table Data
    fetchAllStock();

    // 2. Initialize Pricing Synchronizers
    syncPricing('addCost', 'addMarkup', 'addPrice');
    syncPricing('editCost', 'editMarkup', 'editPrice');

    // 3. Attach Form Listeners
    setupFormListeners();
});

// --- 1. DATA FETCHING ---
async function fetchAllStock() {
    try {
        const response = await fetch('/api/all-inventory'); 
        const data = await response.json();
        currentStock = data.contents || [];
        currentPage = 1;
        renderPaginatedTable();
    } catch (err) {
        console.error("Failed to load inventory:", err);
    }
}

// --- 2. PRICING LOGIC ---
function syncPricing(costId, markupId, priceId) {
    const costInp = document.getElementById(costId);
    const markupInp = document.getElementById(markupId);
    const priceInp = document.getElementById(priceId);

    if (!costInp || !markupInp || !priceInp) return;

    const updatePrice = () => {
        const cost = parseFloat(costInp.value) || 0;
        const markup = parseFloat(markupInp.value) || 0;
        if (cost > 0) {
            priceInp.value = (cost + (cost * (markup / 100))).toFixed(2);
        }
    };

    const updateMarkup = () => {
        const cost = parseFloat(costInp.value) || 0;
        const price = parseFloat(priceInp.value) || 0;
        if (cost > 0 && price > 0) {
            markupInp.value = (((price - cost) / cost) * 100).toFixed(1);
        }
    };

    costInp.addEventListener('input', updatePrice);
    markupInp.addEventListener('input', updatePrice);
    priceInp.addEventListener('input', updateMarkup);
}

// --- 3. FORM LISTENERS ---
function setupFormListeners() {
    // SEARCH FORM
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const query = new URLSearchParams({
                itemName: document.getElementById('itemName').value,
                category: document.getElementById('category').value,
                minPrice: document.getElementById('minPrice').value,
                maxPrice: document.getElementById('maxPrice').value
            });

            try {
                const res = await fetch(`/api/searchItems?${query.toString()}`);
                const data = await res.json();
                populateSearchModal(data.contents || []);
            } catch (err) {
                console.error("Search failed:", err);
            }
        });
    }

    // ADD ITEM FORM
    const addForm = document.getElementById('addItemForm');
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const itemData = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/add-item', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemData)
                });
                if (response.ok) {
                    bootstrap.Modal.getInstance(document.getElementById('addItemModal')).hide();
                    e.target.reset();
                    fetchAllStock();
                }
            } catch (err) { console.error("Add error:", err); }
        });
    }

    // EDIT ITEM FORM
    const editForm = document.getElementById('editItemForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedData = {
                id: document.getElementById('editItemId').value,
                name: document.getElementById('editBrandName').value,
                category: document.getElementById('editCategory').value,
                price: document.getElementById('editPrice').value
            };

            try {
                const res = await fetch('/api/update-item', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
                if (res.ok) {
                    bootstrap.Modal.getInstance(document.getElementById('editItemModal')).hide();
                    fetchAllStock();
                }
            } catch (err) { console.error("Update error:", err); }
        });
    }
}

// --- 4. MODAL & TABLE HELPERS ---
function populateSearchModal(items) {
    const tbody = document.querySelector('#searchResultsTable tbody');
    tbody.innerHTML = '';
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No items found</td></tr>';
    } else {
        items.forEach((item, index) => {
            const row = tbody.insertRow();
        
            // 1. Set the structure for the whole row at once
            row.innerHTML = `
                <td>
                    <button class="btn btn-sm btn-primary action-btn" data-bs-dismiss="modal">
                        ${!adjustmentMode ? 'Edit <i class="fa-solid fa-edit"></i>' : 'Add <i class="fa-solid fa-plus"></i>'}
                    </button>
                </td>
                <td>${item.item_name}</td>
                <td>₦${item.unit_selling_price}</td>
                <td>${item.total_quantity_in_stock}</td>
                <td>${item.unit_name}</td>
            `;
        
            // 2. Now that the HTML exists in the DOM, find the button inside this specific row
            const btn = row.querySelector('.action-btn');
        
            // 3. Attach the listener to the actual button element
            if (!adjustmentMode) {
                btn.addEventListener('click', () => {
                    openEditModal(item.item_id);
                });
            } else {
                btn.addEventListener('click', () => {
                    // This now correctly passes the real 'item' object!
                    addToAdjustmentList(item);
                });
            }
        });
    }

    // FIXED: Target the MODAL ID, not the TABLE ID
    const modalElement = document.getElementById('searchResultModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

function openEditModal(productId) {
    const item = currentStock.find(i => i.id === productId);
    if (!item) return;

    const cost = parseFloat(item.last_cost_price) || 0;
    const price = parseFloat(item.unit_selling_price) || 0;
    const markup = cost > 0 ? (((price - cost) / cost) * 100) : 0;

    document.getElementById('editItemId').value = item.id;
    document.getElementById('editBrandName').value = item.name;
    document.getElementById('editGenericName').value = item.generic_name || '';
    document.getElementById('editCategory').value = item.category;
    document.getElementById('editUnit').value = item.unit;
    document.getElementById('editCost').value = cost.toFixed(2);
    document.getElementById('editPrice').value = price.toFixed(2);
    document.getElementById('editMarkup').value = markup.toFixed(1);
    document.getElementById('editReorder').value = item.reorder_level;
    document.getElementById('description').value = item.description;

    const modal = new bootstrap.Modal(document.getElementById('editItemModal'));
    modal.show();
}

// --- 5. PAGINATION LOGIC ---
function renderPaginatedTable() {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedItems = currentStock.slice(startIndex, startIndex + rowsPerPage);
    renderMainTable(paginatedItems);
    setupPaginationControls();
}

function renderMainTable(items) {
    const tbody = document.getElementById('itemsTableBody');
    tbody.innerHTML = '';
    items.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td><span class="badge bg-secondary">${item.category}</span></td>
            <td><span class="badge bg-secondary">${item.unit}</span></td>
            <td>₦${parseFloat(item.last_cost_price).toLocaleString()}</td>
            <td>₦${parseFloat(item.unit_selling_price).toLocaleString()}</td>
            <td class="${item.total_quantity_in_stock < 10 ? 'text-danger fw-bold' : ''}">${item.total_quantity_in_stock}</td>
            <td>${new Date(item.last_updated_date).toLocaleDateString()}</td>
            <td><button class="btn btn-sm btn-warning" onclick="openEditModal(${item.id})"><i class="fa-solid fa-edit"></i></button></td>
        `;
    });
    tbody.classList.add("custom-table-hover")
}

function setupPaginationControls() {
    const container = document.getElementById('paginationControls');
    container.innerHTML = '';
    const totalPages = Math.ceil(currentStock.length / rowsPerPage);
    if (totalPages <= 1) return;

    // Previous
    container.appendChild(createPageBtn('<i class="fa-solid fa-chevron-left"></i>', currentPage > 1, () => {
        currentPage--; renderPaginatedTable();
    }));

    // Sliding Window
    let start = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
    let end = Math.min(totalPages, start + maxVisibleButtons - 1);
    if (end === totalPages) start = Math.max(1, end - maxVisibleButtons + 1);

    for (let i = start; i <= end; i++) {
        const btn = createPageBtn(i, true, () => {
            currentPage = i; renderPaginatedTable();
        });
        if (i === currentPage) btn.classList.replace('btn-outline-primary', 'btn-primary');
        container.appendChild(btn);
    }

    // Next
    container.appendChild(createPageBtn('<i class="fa-solid fa-chevron-right"></i>', currentPage < totalPages, () => {
        currentPage++; renderPaginatedTable();
    }));
}

function createPageBtn(content, enabled, onClick) {
    const btn = document.createElement('button');
    btn.innerHTML = content;
    btn.className = 'btn btn-sm mx-1 btn-outline-primary';
    if (!enabled) { btn.classList.add('disabled'); btn.style.opacity = "0.5"; }
    else { btn.onclick = (e) => { e.preventDefault(); onClick(); window.scrollTo(0, 0); }; }
    return btn;
}

// Sidebar button click event listeners
// Adjustment Mode Toggle
document.getElementById('adjustmentModeBtn').addEventListener('click', () => {
    adjustmentMode = true;
    document.getElementById('stockDisplayTable').style.display = 'none';
    document.getElementById('adjustmentContainer').style.display = 'block'; // Show adjustment UI
});

// View Stock Mode Toggle
document.getElementById('allStocksBtn').addEventListener('click', () => {
    adjustmentMode = false;
    document.getElementById('stockDisplayTable').style.display = 'block';
    document.getElementById('adjustmentContainer').style.display = 'none'; // Hide adjustment UI
    fetchAllStock();
});

function addToAdjustmentList(item) {
    // Check if item is already in the list to prevent duplicates
    const exists = adjustmentList.find(i => i.item_id === item.item_id);
    if (exists) {
        alert("Item is already in the adjustment list.");
        return;
    }

    console.log("Adding to adjustment list:", item);

    // Add new adjustment object to the array
    adjustmentList.push({
        item_id: item.item_id,
        item_name: item.item_name,
        current_qty: item.total_quantity_in_stock,
        adjustment_qty: 0,
        cost_price: item.last_cost_price,
        unit_name: item.unit_name,
    });

    renderAdjustmentTable();
}

function renderAdjustmentTable() {
    const tbody = document.getElementById('adjustmentTableBody');
    tbody.innerHTML = '';

    adjustmentList.forEach((adj, index) => {
        const row = tbody.insertRow();
        const newQty = adj.current_qty + adj.adjustment_qty;

        row.innerHTML = `
            <td>${adj.item_name} <small class="text-muted">(${adj.unit_name})</small></td>
            <td>${adj.current_qty}</td>
            <td>
                <input type="number" class="form-control form-control-sm adj-input" 
                       data-index="${index}" value="${adj.adjustment_qty}">
            </td>
            <td class="fw-bold">${newQty}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="removeFromAdjustment(${index})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
    });

    // Sync input changes to the array and update New Stock display
    document.querySelectorAll('.adj-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.dataset.index;
            adjustmentList[idx].adjustment_qty = parseInt(e.target.value) || 0;
            
            // Optional: Re-render specific row or whole table to update "New Stock"
            const row = e.target.closest('tr');
            const newStockCell = row.cells[3];
            newStockCell.innerText = adjustmentList[idx].current_qty + adjustmentList[idx].adjustment_qty;
        });
    });
}

function removeFromAdjustment(index) {
    adjustmentList.splice(index, 1);
    renderAdjustmentTable();
}

// Submit Adjustments to server
// --- Validation and Save Logic ---
document.getElementById('saveAdjustmentsBtn').addEventListener('click', async () => {
    if (adjustmentList.length === 0) return alert("List is empty!");

    const rows = document.querySelectorAll('#adjustmentTableBody tr');
    let hasError = false;

    // Validate inputs
    adjustmentList.forEach((adj, index) => {
        const row = rows[index];
        // Reset highlight
        row.classList.remove('table-danger'); 

        if (adj.adjustment_qty === 0) {
            hasError = true;
            row.classList.add('table-danger'); // Highlight row red [Bootstrap class]
        }
    });

    if (hasError) {
        alert("Please provide a non-zero adjustment for the highlighted rows.");
        return;
    }

    if (!confirm("Proceed with stock adjustment?")) return;

    try {
        const response = await fetch('/api/process-adjustments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: adjustmentList })
        });

        if (response.ok) {
            alert("Adjustments saved!");
            adjustmentList = [];
            renderAdjustmentTable();
            fetchAllStock();
        }
    } catch (err) {
        console.error("Save failed:", err);
    }
});


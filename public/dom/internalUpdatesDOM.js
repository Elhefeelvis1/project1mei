// Initialize client-side state
let selectedItems = [];

// 1. Function to render search results in the Modal
function renderSearchResults(items) {
    const tbody = document.getElementById('searchResultsTable').querySelector('tbody');
    tbody.innerHTML = ''; 

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No items found.</td></tr>';
        return;
    }

    items.forEach(item => {
        const row = tbody.insertRow();
        
        const actionCell = row.insertCell();
        const addButton = document.createElement('button');
        addButton.className = 'btn btn-primary btn-sm';
        addButton.innerHTML = '<i class="fa-solid fa-plus"></i> Add';
        addButton.setAttribute('data-bs-dismiss', 'modal');
        addButton.onclick = () => addToSelectedItems(item);
        actionCell.appendChild(addButton);

        row.insertCell().textContent = item.item_name;
        row.insertCell().textContent = item.total_quantity_in_stock;
        row.insertCell().textContent = item.unit_name || 'N/A';
        row.insertCell().textContent = item.category_name || 'General';
    });
}

// 2. Add item to the list
function addToSelectedItems(item) {
    const exists = selectedItems.find(i => i.productId === item.item_id);
    if (exists) {
        displayMessage('failure', "Item already in list.");
        return;
    }

    selectedItems.push({
        productId: item.item_id,
        itemName: item.item_name,
        unitCost: parseFloat(item.last_cost_price || 0),
        unitPrice: parseFloat(item.unit_selling_price || 0),
        quantity: 1,
        unit: item.unit_name,
        expiryDate: item.expiry_date ? item.expiry_date.split('T')[0] : ''
    });
    renderSelectedItems();
}

// 3. Render the selected items table
function renderSelectedItems() {
    const tbody = document.getElementById('selectedItemsTable').querySelector('tbody');
    tbody.innerHTML = '';
    
    let totalCostAccumulator = 0;
    let totalPriceAccumulator = 0;

    if (selectedItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No items added yet.</td></tr>';
        updateTotals(0, 0, 0);
        return;
    }

    selectedItems.forEach((item, index) => {
        const row = tbody.insertRow();
        const lineTotalCost = item.quantity * item.unitCost;
        const lineTotalPrice = item.quantity * item.unitPrice;

        row.insertCell().textContent = index + 1;
        row.insertCell().textContent = item.itemName;

        // Quantity Input
        const qtyCell = row.insertCell();
        const qtyInp = document.createElement('input');
        qtyInp.type = 'number';
        qtyInp.className = 'form-control form-control-sm';
        qtyInp.value = item.quantity;
        qtyInp.onchange = (e) => {
            item.quantity = parseInt(e.target.value) || 1;
            renderSelectedItems();
        };
        qtyCell.appendChild(qtyInp);

        row.insertCell().textContent = item.unit;
        row.insertCell().textContent = item.unitCost.toFixed(2);
        row.insertCell().textContent = item.unitPrice.toFixed(2);
        row.insertCell().textContent = lineTotalCost.toFixed(2);
        row.insertCell().textContent = lineTotalPrice.toFixed(2);
        row.insertCell().textContent = item.expiryDate || 'N/A';

        // Remove Action
        const actionCell = row.insertCell();
        const rmBtn = document.createElement('button');
        rmBtn.className = 'btn btn-danger btn-sm';
        rmBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        rmBtn.onclick = () => {
            selectedItems.splice(index, 1);
            renderSelectedItems();
        };
        actionCell.appendChild(rmBtn);

        totalCostAccumulator += lineTotalCost;
        totalPriceAccumulator += lineTotalPrice;
    });

    updateTotals(selectedItems.length, totalCostAccumulator, totalPriceAccumulator);
}

function updateTotals(count, cost, price) {
    document.getElementById('totalItems').textContent = count;
    document.getElementById('totalCost').textContent = cost.toFixed(2);
    document.getElementById('totalPrice').textContent = price.toFixed(2);
}

function clearSelectedItems() {
    selectedItems = [];
    renderSelectedItems();
    displayMessage('success', 'List cleared');
}

// 4. Search Form Handler
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = new URLSearchParams({
        itemName: document.getElementById('itemName').value,
        category: document.getElementById('category').value,
        minPrice: document.getElementById('minPrice').value,
        maxPrice: document.getElementById('maxPrice').value
    });

    try {
        const res = await fetch(`/api/searchItems?${query.toString()}`);
        const data = await res.json();
        renderSearchResults(data.contents || []);
    } catch (err) {
        displayMessage('failure', 'Search failed');
    }
});

// 5. Global Form Submission Handler
document.querySelectorAll('.inventory-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (selectedItems.length === 0) {
            displayMessage('failure', 'Your list is empty.');
            return;
        }

        const submissionData = {
            items: selectedItems,
            supplierId: document.getElementById('supplierSelect').value,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            });

            const result = await response.json();

            if (response.ok) {
                displayMessage('success', result.message || 'Saved successfully');
                selectedItems = [];
                renderSelectedItems();
            } else {
                displayMessage('failure', result.message || 'Save failed');
            }
        } catch (err) {
            displayMessage('failure', 'Network error occurred.');
        }
    });
});

// Helper for Messages (Modal-based)
function displayMessage(type, msg) {
    const color = type === 'success' ? 'text-success' : 'text-danger';
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation';
    
    const modalHTML = `
        <div class="modal fade" id="msgModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-sm">
                <div class="modal-content">
                    <div class="modal-body text-center p-4">
                        <i class="fa-solid ${icon} ${color} fs-1 mb-3"></i>
                        <p class="fw-bold m-0">${msg}</p>
                    </div>
                </div>
            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const m = new bootstrap.Modal(document.getElementById('msgModal'));
    m.show();
    setTimeout(() => {
        m.hide();
        document.getElementById('msgModal').remove();
    }, 2500);
}

document.addEventListener('DOMContentLoaded', renderSelectedItems);
// Initialize client-side cart array
let selectedItems = [];
let grandTotal = 0;

// Function to render search results dynamically
function renderSearchResults(items) {
    const tbody = document.getElementById('searchResultsTable').querySelector('tbody');
    tbody.innerHTML = ''; // Clear previous results

    if (items.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.textContent = "No items found.";
        return;
    }

    items.forEach(item => {
        const row = tbody.insertRow();

        const quantityInStock = parseInt(item.total_quantity_in_stock);

        const actionCell = row.insertCell();
        const buttonDiv = document.createElement('div');
        buttonDiv.classList.add('d-flex', 'justify-content-center');

        const addButton = document.createElement('button');
        addButton.className = 'btn btn-primary btn-sm'; 
        addButton.setAttribute('data-bs-dismiss', 'modal');
        addButton.textContent = 'Add to List';
        addButton.addEventListener('click', () => addToSelectedItems(item));

        actionCell.appendChild(buttonDiv);
        buttonDiv.appendChild(addButton);

        row.insertCell().textContent = item.item_name;
        row.insertCell().textContent = quantityInStock;
        row.insertCell().textContent = item.unit_name;
        row.insertCell().textContent = item.category_name;
    });

    console.log(items)
}

// Function to add item to client-side cart and render cart table
function addToSelectedItems(itemToAdd) {
    // Check if item already in cart
    const existingItem = selectedItems.find(item => item.productId === itemToAdd.item_id);

    if (existingItem) {
        displayMessage('failure', "Item already in purchase list. You can adjust the details below.");
    } else {
        // Add new item to cart
        selectedItems.push({
            productId: itemToAdd.item_id,
            itemName: itemToAdd.item_name,
            sellPrice: parseFloat(itemToAdd.unit_selling_price),
            lastCostPrice: parseFloat(itemToAdd.last_cost_price), // Use last cost as default
            newCostPrice: parseFloat(itemToAdd.last_cost_price),
            expiryDate: '',
            quantity: 1, // Start with 1
            unit: itemToAdd.unit_name,
            category: itemToAdd.category_name
        });
    }
    renderSelectedItems(); // Re-render the cart table
}

function calculateUnitCost(totalCost, quantity) {
    if (quantity > 0) {
        return totalCost / quantity;
    }
    return 0;
}

function renderSelectedItems() {
    const tbody = document.getElementById('selectedItemsTable').querySelector('tbody');
    tbody.innerHTML = ''; 
    
    let grandTotal = 0; 

    if (selectedItems.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 10; // Assuming 10 columns now (Index, Name, Qty, Total Cost, Unit Cost, Last Cost, Sell Price, Expiry, Unit, Category, Actions)
        cell.textContent = "No items selected for purchase yet.";
        document.getElementById('grandTotal').textContent = '0.00';
        return;
    }

    selectedItems.forEach((item, index) => {
        const row = tbody.insertRow();
        row.classList.add('item-row'); 
        
        // Calculate Line Total for rendering inputs and grand total
        const lineTotal = item.quantity * item.newCostPrice;

        // 1. Index (#) Column
        row.insertCell().textContent = index + 1;

        // 2. Item Name
        row.insertCell().textContent = item.itemName;
    
        // 3. Quantity Input (Quantity Purchased)
        const quantityCell = row.insertCell();
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '1';
        quantityInput.value = item.quantity;
        quantityInput.className = 'form-control item-quantity'; 
        
        quantityInput.addEventListener('change', (e) => {
            const newQuantity = parseInt(e.target.value);
            if(newQuantity <= 0 || isNaN(newQuantity)){
                displayMessage('failure', "Quantity must be a positive number.");
                e.target.value = item.quantity;
            }else{
                item.quantity = newQuantity;
                renderSelectedItems(); 
            }
        });
        quantityCell.appendChild(quantityInput); 

        // 4. Total Cost Price Input (User enters the total line cost)
        const totalCostCell = row.insertCell();
        const totalCostInput = document.createElement('input');
        totalCostInput.type = 'number';
        totalCostInput.step = '0.01';
        totalCostInput.value = lineTotal.toFixed(2); 
        totalCostInput.className = 'form-control item-new-cost';

        totalCostInput.addEventListener('change', (e) => {
            const totalCost = parseFloat(e.target.value);
            if(totalCost <= 0 || isNaN(totalCost)){
                displayMessage('failure', "Total cost must be a positive number.");
                e.target.value = (item.newCostPrice * item.quantity).toFixed(2);
            }else{
                // FIX 1: Calculate the unit cost and store that in the item object
                item.newCostPrice = calculateUnitCost(totalCost, item.quantity); 
                renderSelectedItems(); 
            }
        });
        totalCostCell.appendChild(totalCostInput);

        // 5. Unit Cost Cell (calculated)
        const unitCostCell = row.insertCell();
        const unitCostDisplay = document.createElement('span'); // Use span instead of read-only input for simpler display
        // The item.newCostPrice already holds the unit cost (if Fix 1 is applied)
        unitCostDisplay.textContent = item.newCostPrice.toFixed(2); 
        unitCostCell.appendChild(unitCostDisplay);
        // Note: The previous logic of updating unitCostInput is removed since we use a span

        // 6. Last Cost Price (Reference)
        const lastCostCell = row.insertCell();
        lastCostCell.textContent = parseFloat(item.lastCostPrice).toFixed(2);

        // 7. New sell Price Input
        const sellPriceCell = row.insertCell();
        const sellPriceInput = document.createElement('input');
        sellPriceInput.type = 'number';
        sellPriceInput.step = '0.01';
        // Corrected: Item object should hold sellPrice, but ensure it's a number for .toFixed()
        sellPriceInput.value = parseFloat(item.sellPrice).toFixed(2); 
        sellPriceInput.addEventListener('change', (e) => {
            const newSellPrice = parseFloat(e.target.value);
            if(newSellPrice < 0 || isNaN(newSellPrice)){
                displayMessage('failure', "Selling price cannot be negative.");
                sellPriceInput.value = item.sellPrice.toFixed(2);
            }else{
                item.sellPrice = newSellPrice;
            }
        });
        sellPriceInput.className = 'form-control item-unit-cost';
        sellPriceCell.appendChild(sellPriceInput);
        
        // 8. Expiry Date Input
        const expiryCell = row.insertCell();
        const expiryInput = document.createElement('input');
        expiryInput.type = 'date';
        expiryInput.value = item.expiryDate;
        expiryInput.className = 'form-control item-expiry-date'; 
        
        expiryInput.addEventListener('change', (e) => {
            const newDate = e.target.value;
            const today = new Date().toISOString().split('T')[0];
            
            // FIX 2: Check against current date string
            if(newDate && newDate <= today){
                displayMessage('failure', "Expiry date must be a future date.");
                e.target.value = item.expiryDate; 
            }else{
                item.expiryDate = newDate;
            }
        });
        expiryCell.appendChild(expiryInput); 

        // 9. Unit Column
        row.insertCell().textContent = item.unit || '';
        
        // 10. Category Column
        row.insertCell().textContent = item.category || '';

        // 11. Actions Column (Remove Button)
        const actionCell = row.insertCell();
        actionCell.classList.add('text-center'); 
        
        const removeButton = document.createElement('button');
        removeButton.className = 'btn btn-danger btn-sm';
        removeButton.type = 'button'; 
        const icon = document.createElement('i');
        icon.classList.add('fa-solid', 'fa-trash'); 
        removeButton.appendChild(icon);
        removeButton.addEventListener('click', () => removeItemFromCart(index));
        actionCell.appendChild(removeButton);

        // Calculate and accumulate Grand Total
        grandTotal += lineTotal;
    });

    document.getElementById('grandTotal').textContent = grandTotal.toFixed(2);
}

// Function to remove item from client-side cart
function removeItemFromCart(index) {
    selectedItems.splice(index, 1);
    renderSelectedItems(); // Re-render the cart table
}

// Clear all items from table
function clearSelectedItems(){
    if(selectedItems.length > 0){
        selectedItems = [];

        displayMessage('success', 'List cleared');
        renderSelectedItems();
    }else{
        displayMessage('failure', `List is already empty`);
        renderSelectedItems();
    }
}

// Search Form Submission
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission (page reload)

    const itemName = document.getElementById('itemName').value;
    const category = document.getElementById('category').value;
    const minPrice = document.getElementById('minPrice').value;
    const maxPrice = document.getElementById('maxPrice').value;

    // Construct query parameters
    const queryParams = new URLSearchParams();
    if (itemName) queryParams.append('itemName', itemName);
    if (category) queryParams.append('category', category);
    if (minPrice) queryParams.append('minPrice', minPrice);
    if (maxPrice) queryParams.append('maxPrice', maxPrice);

    try {
        const response = await fetch(`/api/searchItems?${queryParams.toString()}`); // Use GET
        const data = await response.json();

        if (!response.ok) {
            console.error('Search error:', data.message);
            renderSearchResults([]); // Clear results or show error message
            return;
        }if (data.contents && data.contents.length > 0) {
            renderSearchResults(data.contents);
        } else {
            renderSearchResults([]);
        }

    } catch (error) {
        console.error('Network or parsing error:', error);
        displayMessage('failure', `An error occurred during search: ${error.message}`);
    }
});

// Assuming the form button ID is 'savePurchase'
document.getElementById('savePurchase').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    if (selectedItems.length === 0) {
        displayMessage('failure', 'Please select items to finalize purchase.');
        return;
    }

    // Validation: Check for required fields and positive values
    const validationFailed = selectedItems.some(item => 
        !item.expiryDate || item.quantity <= 0 || item.newCostPrice <= 0 || item.sellPrice <= 0
    );
    
    if(validationFailed) {
        displayMessage('failure', 'All items must have a quantity, a positive unit cost, a positive selling price, and a future expiry date.');
        return;
    }

    const purchaseData = {
        items: selectedItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            // newCostPrice holds the calculated UNIT COST (due to renderSelectedItems fix)
            unitCost: item.newCostPrice, 
            unitSellPrice: item.sellPrice, // Send the new proposed selling price
            expiryDate: item.expiryDate 
        })),
        // Add supplier info or invoice number here if needed
    };

    try {
        const response = await fetch('/api/process-purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(purchaseData)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Purchase failed:', data.message);
            displayMessage('failure', data.message);
        } else {
            // Success handling
            displayMessage('success', data.message + ` Purchase ID: ${data.purchaseId}`);
            selectedItems = []; 
            renderSelectedItems(); 
            // Trigger a search to update total stock view if necessary
            document.getElementById('searchForm').requestSubmit(); 
        }

    } catch (error) {
        console.error('Network or parsing error during purchase:', error);
        displayMessage('failure', `An unexpected error occurred during purchase: ${error.message}`);
    }
});

// Helper to display messages
function displayMessage(type, msg) {

    const modal = document.createElement('div');
    modal.className = 'modal fade'; // modal and fade for animation
    modal.id = 'dynamicAlertModal'; // Give it a unique ID
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-hidden', 'true');

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog modal-dialog-centered';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const body = document.createElement('div');
    body.className = 'modal-body';

    const divContain = document.createElement('div');
    divContain.className = 'd-flex align-items-center p-2'; 
    
    const colorClass = type === 'success' ? 'text-success' : 'text-danger';

    const icon = document.createElement('i');
    const iconClass = type === 'success' ? 'fa-check-circle' : 'fa-ban';
    icon.classList.add('fa-solid', iconClass, 'fs-4', 'me-3', colorClass);
    divContain.appendChild(icon);

    const message = document.createElement('span');
    message.textContent = msg;
    message.className = 'fw-bold';
    divContain.appendChild(message);

    body.appendChild(divContain);
    content.appendChild(body);
    dialog.appendChild(content);
    modal.appendChild(dialog);

    document.body.appendChild(modal); 

    // Use Bootstrap's JavaScript to show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    setTimeout(() => {
        bsModal.hide();
        // Listen for the 'hidden.bs.modal' event to clean up the DOM after it fully hides
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }, 5000);
}

// Initial render of selected items when page loads
document.addEventListener('DOMContentLoaded', renderSelectedItems);
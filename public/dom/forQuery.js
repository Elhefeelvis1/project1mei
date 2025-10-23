// Initialize client-side cart array
let selectedItems = [];
let totalCost = 0;

// Search Form Submission Handler
async function searchForm(event) {
    event.preventDefault(); // Prevent default form submission (page reload)

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
            console.log(data.contents);
            renderSearchResults(data.contents);
        } else {
            renderSearchResults([]);
        }

    } catch (error) {
        console.error('Network or parsing error:', error);
        displayMessage('failure', `An error occurred during search: ${error.message}`);
    }
}

// Save Return Handler
async function saveQuery(event) {
    event.preventDefault();

    let processRoute;
    
    if(event.target.action = "saveReturn"){
        processRoute = "process-return"
    }
    if (event.target.action = "saveDamaged"){
        processRoute = "process-damaged"
    }
    if (event.target.action = "saveOfficeUse"){
        processRoute = "process-officeUse"
    }
    if (event.target.action = "saveExpired"){
        processRoute = "process-expired"
    }


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

    const requestData = selectedItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.costPrice, 
            unitSellPrice: item.sellPrice,
            expiryDate: item.expiryDate 
        }));

    try {
        const response = await fetch(`/api/${processRoute}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Request Failed:', data.message);
            displayMessage('failure', data.message);
        } else {
            // Success handling
            displayMessage('success', data.message + ` Request ID: ${data.requestId}`);
            selectedItems = []; 
            renderSelectedItems(); 
        }

    } catch (error) {
        console.error('Network or parsing error during request:', error);
        displayMessage('failure', `An unexpected error occurred during request: ${error.message}`);
    }
}

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
        displayMessage('failure', "Item already selected. You can adjust the details below.");
    } else {
        // Add new item to cart
        selectedItems.push({
            productId: itemToAdd.item_id,
            itemName: itemToAdd.item_name,
            costPrice: itemToAdd.last_cost_price,
            sellPrice: itemToAdd.unit_selling_price,
            totalCost: '',
            totalPrice: '',
            quantity: 1, // Start with 1
            unit: itemToAdd.unit_name,
        });
    }
    renderSelectedItems(); // Re-render the cart table
}

// Function to render the selected items table
function renderSelectedItems() {
    const tbody = document.getElementById('selectedItemsTable').querySelector('tbody');
    tbody.innerHTML = ''; 

    if (selectedItems.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        // Updated colspan to 9 to cover all header columns
        cell.colSpan = 9; 
        cell.textContent = "No items selected yet.";
        return;
    }

    selectedItems.forEach((item, index) => {
        const row = tbody.insertRow();
        row.classList.add('item-row'); 

        // 1. Index (#) Column
        const indexCell = row.insertCell();
        indexCell.textContent = index + 1;
        indexCell.classList.add('text-center'); 

        // 2. Item Name
        row.insertCell().textContent = item.itemName;

        // 3. Quantity Input 
        const quantityCell = row.insertCell();
        
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '1';
        quantityInput.value = item.quantity;
        quantityInput.className = 'form-control item-quantity'; 
        
        quantityInput.addEventListener('change', (e) => {
            const newQuantity = parseInt(e.target.value);

            if(newQuantity < 0){
                displayMessage('failure', "Quantity of items can't be 0");
            }else if(newQuantity > item.stockQuantity){
                displayMessage('failure', "Not enough items in stock");
            }else{
                item.quantity = newQuantity;
                e.target.value = item.quantity;
                renderSelectedItems(); 
            }
        });
        
        quantityCell.appendChild(quantityInput);
        
        // 4. Unit Column (NEW)
        row.insertCell().textContent = item.unit || '';

        // 5. Price (item-price)
        const costCell = row.insertCell();
        costCell.classList.add('item-cost'); 
        costCell.textContent = item.costPrice;
        
        // 6. Price (item-price)
        const priceCell = row.insertCell();
        priceCell.classList.add('item-price'); 
        priceCell.textContent = item.sellPrice;

        // 7. Cost (Subtotal)
        const costTotal = item.quantity * item.costPrice;
        const costTotalCell = row.insertCell();
        costTotalCell.classList.add('item-totalCost'); 
        costTotalCell.textContent = costTotal.toFixed(2);
        totalCost += costTotal;

        // 8. Price (Subtotal)
        const priceTotal = item.quantity * item.costPrice;
        const priceTotalCell = row.insertCell();
        priceTotalCell.classList.add('item-totalPrice'); 
        priceTotalCell.textContent = priceTotal.toFixed(2);
        totalPrice += priceTotal;

        // 9. Actions Column
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
    });

    document.getElementById('totalCost').textContent = totalCost.toFixed(2);
    document.getElementById('totalPrice').textContent = totalPrice.toFixed(2);
    document.getElementById('totalItems').textContent = selectedItems.length;
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
document.getElementById('searchForm').addEventListener('submit', searchForm);

// On submit of Save Return Form
document.getElementById('saveReturn').addEventListener('submit', saveReturn);

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
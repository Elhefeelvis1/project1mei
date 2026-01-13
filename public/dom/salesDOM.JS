// Initialize client-side cart array
let selectedItems = [];
let grandTotal = 0;
let discount = 0;
let currentCustomerId = 0;

// Function to render search results dynamically
function renderSearchResults(items) {
    const tbody = document.getElementById('searchResultsTable').querySelector('tbody');
    tbody.innerHTML = ''; // Clear previous results

    if (items.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.textContent = "No items found.";
        return;
    }

    items.forEach(item => {
        const row = tbody.insertRow();

        // Use parseFloat for prices to ensure correct decimal handling, even if it's integer data in the DB
        const price = parseFloat(item.unit_selling_price).toFixed(2);
        const quantityInStock = parseInt(item.total_quantity_in_stock);

        const actionCell = row.insertCell();
        if (quantityInStock > 0) {
            const buttonDiv = document.createElement('div');
            buttonDiv.classList.add('d-flex', 'justify-content-center');

            const addButton = document.createElement('button');
            // Use Bootstrap class for styling
            addButton.className = 'btn btn-success btn-sm';
            addButton.setAttribute('data-bs-dismiss', 'modal');
            addButton.textContent = 'Add to Cart';
            addButton.addEventListener('click', () => addItemToCart(item));

            actionCell.appendChild(buttonDiv);
            buttonDiv.appendChild(addButton);
        } else {
            actionCell.textContent = 'Out of Stock';
            actionCell.style.color = 'red';
        }

        row.insertCell().textContent = item.item_name;
        row.insertCell().textContent = price;
        row.insertCell().textContent = quantityInStock;
        row.insertCell().textContent = item.unit_name;
        row.insertCell().textContent = item.category_name;
    });

    console.log(items)
}

// Function to add item to client-side cart and render cart table
function addItemToCart(itemToAdd) {
    // Check if item already in cart
    const existingItem = selectedItems.find(item => item.productId === itemToAdd.item_id);

    if (existingItem) {
        displayMessage('failure', "Item already in cart. You can adjust the quantity.");
    } else {
        // Add new item to cart
        selectedItems.push({
            productId: itemToAdd.item_id,
            itemName: itemToAdd.item_name,
            sellPrice: itemToAdd.unit_selling_price,
            quantity: 1, // Start with 1
            stockQuantity: itemToAdd.total_quantity_in_stock,
            unit: itemToAdd.unit_name,
            category: itemToAdd.category_name
        });
    }
    renderSelectedItems(); // Re-render the cart table
}

// Function to calculate grand total
// function calculateGrandTotal() {
//     let grandTotal = selectedItems.reduce((total, item) => total + (item.sellPrice * item.quantity), 0);
//     document.getElementById('grandTotal').textContent = grandTotal.toFixed(2);
// }

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
        document.getElementById('grandTotal').textContent = '0.00';
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
        
        // 3. Price (item-price)
        const priceCell = row.insertCell();
        priceCell.classList.add('item-price'); 
        priceCell.textContent = item.sellPrice;

        // 4. Quantity Input 
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

        // 5. Unit Column (NEW)
        row.insertCell().textContent = item.unit || '';
        
        // 6. Category Column (NEW)
        row.insertCell().textContent = item.category || '';

        // 7. Cost (Subtotal) (item-total)
        const subtotal = item.quantity * item.sellPrice;
        const subtotalCell = row.insertCell();
        subtotalCell.classList.add('item-total'); 
        subtotalCell.textContent = subtotal.toFixed(2);
        grandTotal += subtotal;

        // 8. Actions Column
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

    document.getElementById('grandTotal').textContent = grandTotal.toFixed(2);
}

// Function to remove item from client-side cart
function removeItemFromCart(index) {
    selectedItems.splice(index, 1);
    renderSelectedItems(); // Re-render the cart table
}

// Clear all items from table
function clearCart(){
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

        document.getElementById('itemName').value = ""
        document.getElementById('category').value = ""
        document.getElementById('minPrice').value = ""
        document.getElementById('maxPrice').value = ""

    } catch (error) {
        console.error('Network or parsing error:', error);
        displayMessage('failure', `An error occurred during search: ${error.message}`);
    }
});

// Search customers
document.getElementById('searchCustomerButton').addEventListener('click', async() => {
    const customerName = document.getElementById("customerNameInput").value;

    if (customerName){
        try {
            const response = await fetch(`/api/searchCustomers?customerName=${customerName}`); // Use GET
            const data = await response.json();

            if (!response.ok) {
                console.error('Search error:', data.message);
                displayMessage('failure', `Database error. ${data.message}`);
                return;
            }if (data.contents && data.contents.length > 0) {
                const tbody = document.getElementById('searchCustomerTable').querySelector('tbody');
                tbody.innerHTML = ''; // Clear previous results
            
                data.contents.forEach(customer => {
                    const row = tbody.insertRow();
            
                    const actionCell = row.insertCell();
                    if (customer.id > 0) {
                        const buttonDiv = document.createElement('div');
                        buttonDiv.classList.add('d-flex', 'justify-content-center');
            
                        const addButton = document.createElement('button');
                        // Use Bootstrap class for styling
                        addButton.className = 'btn btn-success btn-sm';
                        addButton.setAttribute('data-bs-dismiss', 'modal');
                        addButton.textContent = 'Select';
                        addButton.addEventListener('click', () => {
                            currentCustomerId = customer.id;
                            document.getElementById("customerNameInput").value = customer.name;
                        });
            
                        actionCell.appendChild(buttonDiv);
                        buttonDiv.appendChild(addButton);
                    } else if(customer.id === 0) {
                        actionCell.textContent = 'Default';
                        actionCell.style.color = 'red';
                    }
            
                    row.insertCell().textContent = customer.name;
                    row.insertCell().textContent = customer.phone_number;
                    row.insertCell().textContent = customer.email;
                });
            } else {
                console.error('User not found');
                displayMessage('failure', `There's no user with the name: ${customerName}`);
                return;
            }

        } catch (error) {
            console.error('Network or parsing error:', error);
            displayMessage('failure', `An error occurred during search: ${error.message}`);
        }
    }
})

// Discount Input Handling
document.querySelectorAll(".discountInput").forEach((input) => {
    input.addEventListener('input', (event) => {
        let inputDiscountValue = 0;

        // Calculate the monetary discount value based on the input field used
        if (event.target.name === "discountPercent") {
            const percentage = parseFloat(event.target.value) || 0;
            // Ensure percentage is positive
            if (percentage < 0) {
                event.target.value = 0;
                inputDiscountValue = 0;
            } else {
                inputDiscountValue = (percentage / 100) * grandTotal;
            }
        } else if (event.target.name === "discountValue") {
            const value = parseFloat(event.target.value) || 0;
            // Ensure value is positive
            if (value < 0) {
                event.target.value = 0;
                inputDiscountValue = 0;
            } else {
                inputDiscountValue = value;
            }
        }

        // Validation Checks
        if (grandTotal <= 0) {
            discount = 0;
            event.target.value = 0;
            displayMessage('failure', "Cannot apply discount to an empty sale.");
        } 
        else if (inputDiscountValue > grandTotal) {
            // Discount > 100% (Monetary discount is greater than the Grand Total)
            
            // Limit the displayed value to 100% to prevent negative final total
            discount = 0; 
            
            displayMessage('failure', `Transaction not possible! Discount amount: ${inputDiscountValue} exceeds the total sale price.`);
            // Reset the input field
            event.target.value = 0;
        } 
        else if (inputDiscountValue === grandTotal) {
            // Discount = 100%
            // Set discount to the grand total to ensure final amount is zero
            discount = grandTotal.toFixed(2); 
            
            displayMessage('success', "⚠️ Warning: The discount is 100%. The final sale total will be $0.00.");
        } 
        else {
            // Valid Discount
            discount = inputDiscountValue.toFixed(2);
        }

        // 3. Update the display element
        document.getElementById('discountAmount').textContent = discount;
    });
});

// Finalize Sale Button Click
document.getElementById('saveSales').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    const payRouteInput = document.getElementById('payRoute').value;
    const banksInput = parseInt(document.getElementById('banks').value);

    if (selectedItems.length === 0) {
        displayMessage('failure', 'Please select items to finalize sale.');
        return;
    }
    
    if (!payRouteInput) {
        displayMessage('failure', 'Please select a payment route to finalize sale.');
        return;
    }

    if (payRouteInput === "Transfer" || payRouteInput === "POS") {
        if (!banksInput) {
            displayMessage('failure', 'Please select a bank for the chosen payment route.');
            return;
        }
    }

    if (payRouteInput === "Credit") {
        if (!currentCustomerId) {
            displayMessage('failure', 'Please enter a customer name for credit sales.');
            return;
        }
    }

    const saleData = {
        items: selectedItems.map(item => ({
            productId: item.productId,
            itemName: item.itemName,
            quantity: item.quantity,
            sellPrice: item.sellPrice
        })),
        customerId: currentCustomerId,
        payRoute: payRouteInput,
        bank: banksInput,
        totalDiscount: discount
    };

    console.log(saleData);

    try {
        const response = await fetch('/api/process-sale', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(saleData)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Sale failed:', data.message);

            console.log('Sale failed:', data.message);
            displayMessage('failure', data.message);
        } else {
            displayMessage('success', data.message + ` Sale ID: ${data.contents.saleId}`);
            selectedItems = []; // Clear the client-side cart
            renderSelectedItems(); // Update the displayed cart
            discount = 0; // Reset discount
            document.querySelectorAll(".discountInput").forEach((input) => input.value = '');
            // Optionally re-search items to update stock quantities in search results
            document.getElementById('searchForm').requestSubmit();
        }

    } catch (error) {
        console.error('Network or parsing error during sale:', error);
        displayMessage('failure', `An unexpected error occurred during sale: ${error.message}`);
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

// Payment Route Change Handling
document.getElementById('payRoute').addEventListener('input', () => {
    if(document.getElementById('payRoute').value === 'Transfer' || document.getElementById('payRoute').value === 'POS'){
        document.getElementById('banksDiv').removeAttribute('hidden');
    }else{
        document.getElementById('banksDiv').setAttribute('hidden', "");
    }
})
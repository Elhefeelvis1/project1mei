// Select all rows that contain an item calculation
const itemRows = document.querySelectorAll('.item-row');

function calculateAllRows(){
    let total = 0;

    // Loop through each item row
    itemRows.forEach(row => {
        // Get references to the elements WITHIN THE CURRENT ROW
        const priceCell = row.querySelector('.item-price'); // This is your <td> with the price
        const quantityInput = row.querySelector('.item-quantity'); // This is the input for quantity
        const totalCell = row.querySelector('.item-total');     // This is the <td> to display the row total
        
        // Get the fixed cost from the <td>'s text content
        const cost = parseFloat(priceCell.textContent);
        
        // Get the editable quantity from the input's value
        const quantity = parseInt(quantityInput.value);

        // Check if inputs are valid numbers
        if (!isNaN(cost) && !isNaN(quantity)) {
            const rowTotal = cost * quantity;
            totalCell.textContent = rowTotal.toFixed(2); // Display with 2 decimal places
            total += rowTotal;
        } else {
            totalCell.textContent = 'Invalid input';
        }
    });
    console.log(total)

    total = 0;
}

calculateAllRows();
itemRows.forEach(row => {
    const quantityInput = row.querySelector('.item-quantity');
    if (quantityInput) {
        // Correct: Pass the function reference, not the result of calling it
        quantityInput.addEventListener('input', calculateAllRows);
    }
});
 
// Initialize client-side cart array
let selectedItems = []; // THIS IS NOW CLIENT-SIDE STATE!

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
        row.insertCell().textContent = item.item_name;
        row.insertCell().textContent = item.sell_price.toFixed(2);
        row.insertCell().textContent = item.quantity_in_stock; // total_quantity_in_stock
        row.insertCell().textContent = item.unit;
        row.insertCell().textContent = item.category;

        const actionCell = row.insertCell();
        if (item.quantity_in_stock > 0) {
            const addButton = document.createElement('button');
            addButton.textContent = 'Add to Cart';
            addButton.dataset.productId = item.product_id;
            addButton.dataset.itemName = item.item_name;
            addButton.dataset.sellPrice = item.sell_price;
            addButton.dataset.unit = item.unit;
            addButton.dataset.category = item.category;
            // Note: quantityInStock is not passed here as it's not needed for the cart item itself
            // The server will re-check stock at final sale.
            addButton.addEventListener('click', () => addItemToCart(item)); // Pass the whole item object
            actionCell.appendChild(addButton);
        } else {
            actionCell.textContent = 'Out of Stock';
            actionCell.style.color = 'red';
        }
    });
}

// Function to add item to client-side cart and render cart table
function addItemToCart(itemToAdd) {
    // Check if item already in cart
    const existingItem = selectedItems.find(item => item.productId === itemToAdd.product_id);

    if (existingItem) {
        existingItem.quantity += 1; // Increment quantity if already in cart
        // You might want to add a check here to ensure quantity doesn't exceed available stock
        // (though final check is on server during process-sale)
    } else {
        // Add new item to cart
        selectedItems.push({
            productId: itemToAdd.product_id,
            itemName: itemToAdd.item_name,
            sellPrice: itemToAdd.sell_price,
            quantity: 1, // Start with 1
            unit: itemToAdd.unit,
            category: itemToAdd.category
        });
    }
    renderSelectedItems(); // Re-render the cart table

    // No need for req.flash or redirect here, it's all client-side feedback now
}

// Function to calculate grand total
function calculateGrandTotal() {
    let grandTotal = selectedItems.reduce((total, item) => total + (item.sellPrice * item.quantity), 0);
    document.getElementById('grandTotal').textContent = grandTotal.toFixed(2);
}

// Function to render the selected items table
function renderSelectedItems() {
    const tbody = document.getElementById('selectedItemsTable').querySelector('tbody');
    tbody.innerHTML = ''; // Clear previous items

    let grandTotal = 0;

    if (selectedItems.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.textContent = "No items selected yet.";
        document.getElementById('grandTotal').textContent = '0.00';
        return;
    }

    selectedItems.forEach((item, index) => {
        const row = tbody.insertRow();
        row.insertCell().textContent = item.itemName;
        row.insertCell().textContent = item.sellPrice.toFixed(2);

        const quantityCell = row.insertCell();
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '1';
        quantityInput.value = item.quantity;
        quantityInput.style.width = '60px';
        quantityInput.addEventListener('change', (e) => {
            const newQuantity = parseInt(e.target.value);
            if (newQuantity > 0) {
                item.quantity = newQuantity;
            } else {
                item.quantity = 1; // Reset to 1 if invalid
                e.target.value = 1;
            }
            renderSelectedItems(); // Re-render to update subtotal and grand total
        });
        quantityCell.appendChild(quantityInput);

        const subtotal = item.quantity * item.sellPrice;
        row.insertCell().textContent = subtotal.toFixed(2);
        grandTotal += subtotal;

        const actionCell = row.insertCell();
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => removeItemFromCart(index));
        actionCell.appendChild(removeButton);
    });

    document.getElementById('grandTotal').textContent = grandTotal.toFixed(2);
}

// Function to remove item from client-side cart
function removeItemFromCart(index) {
    selectedItems.splice(index, 1); // Remove item at index
    renderSelectedItems(); // Re-render the cart table
}


// --- Event Listeners ---

// Search Form Submission
document.getElementById('searchForm').addEventListener('submit', async (e) => {
e.preventDefault(); // Prevent default form submission (page reload)

const itemName = document.getElementById('itemName').value;
const category = document.getElementById('categorySelect').value;
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
        // Display flash message equivalent
        displayMessage('failure', data.message);
        renderSearchResults([]); // Clear results or show error message
        return;
    }

    if (data.contents && data.contents.length > 0) {
        renderSearchResults(data.contents);
        displayMessage('success', data.message);
    } else {
        renderSearchResults([]);
        displayMessage('failure', data.message);
    }

} catch (error) {
    console.error('Network or parsing error:', error);
    displayMessage('failure', `An error occurred during search: ${error.message}`);
}
});

// Finalize Sale Button Click
document.getElementById('saveSales').addEventListener('submit', async (e) => {
e.preventDefault(); // Prevent default form submission (page reload)

if (selectedItems.length === 0) {
    displayMessage('failure', 'Please select items to finalize sale.');
    return;
}

const userId = window.userId;

console.log('User ID for sale:', userId);
// const customerNameInput = document.getElementById('customerName').value;
// customerName: (customerNameInput) ? customerNameInput : 'Walk-in Customer', // Optional customer name in saleData

const saleData = {
    userId: userId,
    items: selectedItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        sellPrice: item.sellPrice
    }))
};

try {
    const response = await fetch('/process-sale', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(saleData)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('Sale failed:', data.message);
        displayMessage('failure', data.message);
    } else {
        displayMessage('success', data.message + ` Sale ID: ${data.saleId}`);
        selectedItems = []; // Clear the client-side cart
        renderSelectedItems(); // Update the displayed cart
        // Optionally re-search items to update stock quantities in search results
        document.getElementById('searchForm').requestSubmit();
    }

} catch (error) {
    console.error('Network or parsing error during sale:', error);
    displayMessage('failure', `An unexpected error occurred during sale: ${error.message}`);
}
});

// Helper to display messages (mimics flash messages visually)
function displayMessage(type, msg) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${type}`;
    alertDiv.textContent = msg;
    document.body.insertBefore(alertDiv, document.body.firstChild); // Insert at top
    setTimeout(() => alertDiv.remove(), 5000); // Remove after 5 seconds
}

// Initial render of selected items when page loads
document.addEventListener('DOMContentLoaded', renderSelectedItems);
let currentItemId;
let currentItemName;

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
            addButton.addEventListener('click', () => addItem(item));

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
}

// Function to render the product data table
function renderProductData(itemData) {
    const tbody = document.getElementById('selectedItemsTable').querySelector('tbody');
    tbody.innerHTML = ''; 

    if (itemData.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        // Updated colspan to 7 to cover all header columns
        cell.colSpan = 7; 
        cell.textContent = "No items selected yet.";
        return;
    }

    itemData.forEach((item, index) => {
        const row = tbody.insertRow();
        row.classList.add('item-row'); 

        // 1. Index (#) Column
        const indexCell = row.insertCell();
        indexCell.textContent = index + 1;
        indexCell.classList.add('text-center'); 

        // 2. Transaction type
        row.insertCell().textContent = item.change_type;
        
        // 3. Quantity Change
        row.insertCell().textContent = item.quantity_change;

        // 4. Cost Impact
        row.insertCell().textContent = item.cost_impact;
        
        // 5.Change Date
        row.insertCell().textContent = item.change_date.slice(0, 10);

        // 6. Lot ID
        row.insertCell().textContent = item.lot_id;

        // 7. User Responsible
        row.insertCell().textContent = item.username;
    });
}

function addItem(item){
    currentItemId = item.item_id;
    currentItemName = item.item_name;

    document.getElementById("displayItem").textContent = item.item_name;
    document.getElementById("productId").value = currentItemId;
}

document.getElementById('searchForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const itemName = document.getElementById('itemName').value;
    const category = document.getElementById('category').value;

    // Construct query parameters
    const queryParams = new URLSearchParams();
    if (itemName) queryParams.append('itemName', itemName);
    if (category) queryParams.append('category', category);

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

    } catch (error) {
        console.error('Network or parsing error:', error);
        displayMessage('failure', `An error occurred during search: ${error.message}`);
    }
});

// Search Item
document.getElementById('checkData').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    const productId = parseInt(document.getElementById('productId').value);
    const startDate = document.getElementById('startDate').value;
    const stopDate = document.getElementById('stopDate').value;

    if (productId < 1) {
        displayMessage('failure', 'Please select items to finalize sale.');
        return;
    }

    // Construct query parameters
    const queryParams = new URLSearchParams();
    if (productId) queryParams.append('productId', productId);
    if (startDate) queryParams.append('startDate', startDate);
    if (stopDate) queryParams.append('stopDate', stopDate);

    try {
        const response = await fetch(`/api/track-product?${queryParams.toString()}`);

        const data = await response.json();

        console.log(data.contents)

        if (!response.ok) {
            console.error('Tracking failed:', data.message);

            console.log('Tracking failed:', data.message);
            displayMessage('failure', data.message);
        } else if(data.contents && data.contents.length === 0) {
            renderProductData([]);

            displayMessage('failure', data.message);
            console.log("Number 2");

            document.getElementById('showItemName').textContent = `Transaction data showing for ${currentItemName}`;
        
        }else{
            displayMessage('success', data.message);
            renderProductData(data.contents);
            console.log("Number 1");

            document.getElementById('showItemName').textContent = `Transaction data showing for ${currentItemName}`;
        }

    } catch (error) {
        console.error('Network or parsing error during tracking:', error);
        displayMessage('failure', `An unexpected error occurred during tracking: ${error.message}`);
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
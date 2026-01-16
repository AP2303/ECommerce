// Warehouse inventory page functionality
let currentProductId = null;

function updateStock(productId, productName) {
    currentProductId = productId;
    document.getElementById('productName').textContent = 'Product: ' + productName;
    document.getElementById('updateStockModal').style.display = 'flex';
}

function closeStockModal() {
    document.getElementById('updateStockModal').style.display = 'none';
    currentProductId = null;
}

async function submitStockUpdate() {
    const changeType = document.getElementById('changeType').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const reason = document.getElementById('reason').value;

    if (!quantity || quantity < 1) {
        alert('Please enter a valid quantity');
        return;
    }

    try {
        const response = await fetch('/warehouse/stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: currentProductId,
                quantity: quantity,
                changeType: changeType,
                reason: reason
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Stock updated successfully!');
            closeStockModal();
            window.location.reload();
        } else {
            alert(data.error || 'Failed to update stock');
        }
    } catch (error) {
        console.error(error);
        alert('An error occurred while updating stock');
    }
}

function applyFilters() {
    const status = document.getElementById('filterStatus').value;
    const category = document.getElementById('filterCategory').value;
    const search = document.getElementById('searchInput').value;

    let url = '/warehouse/inventory?';
    if (status !== 'all') url += `status=${status}&`;
    if (category !== 'all') url += `category=${category}&`;
    if (search) url += `search=${encodeURIComponent(search)}`;

    window.location.href = url;
}

// Attach event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Apply filters button
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }

    // Reset filters button
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            window.location.href = '/warehouse/inventory';
        });
    }

    // Update stock buttons (multiple buttons on page)
    const updateStockButtons = document.querySelectorAll('.update-stock-btn');
    updateStockButtons.forEach(button => {
        button.addEventListener('click', function() {
            const productId = this.getAttribute('data-product-id');
            const productName = this.getAttribute('data-product-name');
            updateStock(productId, productName);
        });
    });

    // Modal buttons
    const submitStockBtn = document.getElementById('submitStockBtn');
    if (submitStockBtn) {
        submitStockBtn.addEventListener('click', submitStockUpdate);
    }

    const cancelStockBtn = document.getElementById('cancelStockBtn');
    if (cancelStockBtn) {
        cancelStockBtn.addEventListener('click', closeStockModal);
    }
});


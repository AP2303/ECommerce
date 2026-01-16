// User Management functionality
let currentUserId = null;
let allRoles = [];

// Fetch all roles from server
async function fetchRoles() {
    try {
        const response = await fetch('/api/roles');
        if (response.ok) {
            allRoles = await response.json();
        }
    } catch (error) {
        console.error('Failed to fetch roles:', error);
    }
}

// Open edit role modal
function openEditRoleModal(userId, userName, currentRoleId) {
    currentUserId = userId;
    document.getElementById('userName').textContent = `Editing role for: ${userName}`;

    // Populate role select
    const roleSelect = document.getElementById('roleSelect');
    roleSelect.innerHTML = '<option value="">-- Select Role --</option>';

    allRoles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.id;
        option.textContent = role.name;
        if (role.id == currentRoleId) {
            option.selected = true;
        }
        roleSelect.appendChild(option);
    });

    document.getElementById('editRoleModal').style.display = 'flex';
}

// Close edit role modal
function closeEditRoleModal() {
    document.getElementById('editRoleModal').style.display = 'none';
    currentUserId = null;
}

// Save role changes
async function saveRoleChanges() {
    const roleId = document.getElementById('roleSelect').value;

    if (!roleId) {
        alert('Please select a role');
        return;
    }

    try {
        const response = await fetch(`/admin/users/${currentUserId}/update-role`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleId })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || 'Role updated successfully');
            closeEditRoleModal();
            window.location.reload();
        } else {
            alert(data.error || 'Failed to update role');
        }
    } catch (error) {
        console.error('Update role error:', error);
        alert('An error occurred while updating role');
    }
}

// Toggle user lock status
async function toggleUserLock(userId, button) {
    const action = button.classList.contains('btn-lock') ? 'lock' : 'unlock';

    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }

    try {
        const response = await fetch(`/admin/users/${userId}/lock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || `User ${action}ed successfully`);
            window.location.reload();
        } else {
            alert(data.error || `Failed to ${action} user`);
        }
    } catch (error) {
        console.error('Toggle lock error:', error);
        alert('An error occurred');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    // Fetch roles for the modal
    await fetchRoles();

    // Attach event listeners to edit role buttons
    const editButtons = document.querySelectorAll('.edit-role-btn');
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            const userName = this.getAttribute('data-user-name');
            const currentRole = this.getAttribute('data-current-role');
            openEditRoleModal(userId, userName, currentRole);
        });
    });

    // Attach event listeners to lock/unlock buttons
    const lockButtons = document.querySelectorAll('.toggle-lock-btn');
    lockButtons.forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            toggleUserLock(userId, this);
        });
    });

    // Modal buttons
    document.getElementById('saveRoleBtn').addEventListener('click', saveRoleChanges);
    document.getElementById('cancelRoleBtn').addEventListener('click', closeEditRoleModal);
});


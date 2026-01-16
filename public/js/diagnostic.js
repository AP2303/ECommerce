// Quick diagnostic script - Run this in browser console on welcome page

console.log('=== DIAGNOSTIC CHECK ===');

// Check 1: Page loaded correctly
console.log('1. Welcome page loaded:', window.location.pathname === '/');

// Check 2: Buttons exist
const loginBtn = document.querySelector('a[href="/login"]');
const registerBtn = document.querySelector('a[href="/register"]');
const dashboardBtn = document.querySelector('a[href*="dashboard"]');
const logoutBtn = document.querySelector('button[onclick="logout()"]');

console.log('2. Login button exists:', !!loginBtn);
console.log('   Register button exists:', !!registerBtn);
console.log('   Dashboard button exists:', !!dashboardBtn);
console.log('   Logout button exists:', !!logoutBtn);

// Check 3: Which buttons are visible
if (loginBtn && registerBtn) {
  console.log('3. Status: LOGGED OUT (showing login/register)');
} else if (dashboardBtn && logoutBtn) {
  console.log('3. Status: LOGGED IN (showing dashboard/logout)');
} else {
  console.log('3. Status: ERROR - unexpected button state');
}

// Check 4: Logout function exists
console.log('4. Logout function exists:', typeof logout === 'function');

// Check 5: Test login button click
if (loginBtn) {
  console.log('5. Login button href:', loginBtn.href);
  loginBtn.addEventListener('click', (e) => {
    console.log('   Login button clicked! Should go to /login');
  });
}

// Check 6: Test logout button click
if (logoutBtn) {
  console.log('6. Logout button exists - click to test');
}

console.log('=== END DIAGNOSTIC ===');
console.log('If you see errors above, copy them and share with me.');


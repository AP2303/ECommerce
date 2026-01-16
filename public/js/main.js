const backdrop = document.querySelector(".backdrop");
const sideDrawer = document.querySelector(".mobile-nav");
const menuToggle = document.querySelector("#side-menu-toggle");

function backdropClickHandler() {
  backdrop.style.display = "none";
  sideDrawer.classList.remove("open");
}

function menuToggleClickHandler() {
  backdrop.style.display = "block";
  sideDrawer.classList.add("open");
}

if (backdrop) backdrop.addEventListener("click", backdropClickHandler);
if (menuToggle) menuToggle.addEventListener("click", menuToggleClickHandler);

// Global logout function available everywhere
async function performLogout() {
  try {
    const response = await fetch('/logoutnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      // Redirect to welcome page
      window.location.href = '/';
    } else {
      console.error('Logout failed');
      // Force redirect anyway
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect anyway
    window.location.href = '/';
  }
}

// Attach logout to all logout buttons on page load
document.addEventListener('DOMContentLoaded', function() {
  const logoutButtons = document.querySelectorAll('#logoutBtn, #logout, [data-logout], button[onclick*="logout"]');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      performLogout();
    });
  });
});

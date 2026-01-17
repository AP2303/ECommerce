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

  // Image fallback handler for CSP (no inline onerror)
  const imgs = document.querySelectorAll('img.js-img-fallback');
  imgs.forEach(img => {
    const applyPlaceholder = () => {
      const placeholder = img.getAttribute('data-placeholder') || '/images/placeholder.svg';
      if (!img.src || img.src === '' || img.src === placeholder) return;
      try {
        // Avoid infinite loop
        if (!img.src.endsWith(placeholder)) {
          img.src = placeholder;
        }
      } catch (e) {
        img.src = placeholder;
      }
    };

    img.addEventListener('error', () => {
      applyPlaceholder();
    });

    // If image already finished loading but failed (naturalWidth === 0), apply placeholder immediately
    if (img.complete) {
      // give browser a tick for naturalWidth to update
      setTimeout(() => {
        if (!img.naturalWidth || img.naturalWidth === 0) applyPlaceholder();
      }, 20);
    } else {
      // as a safety net, check again shortly after DOMContentLoaded
      setTimeout(() => {
        if (!img.naturalWidth || img.naturalWidth === 0) applyPlaceholder();
      }, 2000);
    }
  });

  // Quick view modal handling
  const quickviewModal = document.getElementById('quickview-modal');
  const quickviewContent = document.getElementById('quickview-content');
  const quickviewClose = document.getElementById('quickview-close');

  function closeQuickview() {
    if (quickviewModal) quickviewModal.style.display = 'none';
    if (quickviewContent) quickviewContent.innerHTML = '';
  }
  if (quickviewClose) quickviewClose.addEventListener('click', closeQuickview);
  if (quickviewModal) quickviewModal.addEventListener('click', (e) => { if (e.target === quickviewModal) closeQuickview(); });

  document.addEventListener('click', async function(e) {
    const btn = e.target.closest && e.target.closest('.js-quickview');
    if (!btn) return;
    e.preventDefault();
    const productId = btn.getAttribute('data-productid');
    if (!productId) return;

    try {
      const res = await fetch('/products/' + productId);
      // the server renders HTML for product-detail; but we prefer JSON: try JSON endpoint if exists
      // If server returns HTML, fetch product data via existing API is not available; instead call a small endpoint
      const productRes = await fetch('/api/products/' + productId).catch(()=>null);
      if (productRes && productRes.ok) {
        const p = await productRes.json();
        quickviewContent.innerHTML = `<div style="display:flex;gap:18px;flex-wrap:wrap;"><div style="flex:0 0 260px;"><img src="${p.imageUrl || '/images/placeholder.svg'}" style="width:240px;height:320px;object-fit:cover;border-radius:6px;"/></div><div style="flex:1"><h2>${p.title}</h2><p style="font-weight:700;">$${p.price}</p><p>${p.description || ''}</p><form action="/cart" method="POST"><input type="hidden" name="productId" value="${p.id}"><button class="btn">Add to Cart</button></form></div></div>`;
        quickviewModal.style.display = 'flex';
        return;
      }

      // Fallback: open HTML detail and extract main parts (simple approach)
      const detailHtmlRes = await fetch('/products/' + productId);
      const text = await detailHtmlRes.text();
      // naive extraction: find <main> content between <main> and </main>
      const mainMatch = text.match(/<main[\s\S]*?>[\s\S]*?<\/main>/i);
      if (mainMatch) {
        quickviewContent.innerHTML = mainMatch[0];
      } else {
        quickviewContent.innerHTML = text;
      }
      quickviewModal.style.display = 'flex';
    } catch (err) {
      console.error('Quickview load failed', err);
    }
  });
});

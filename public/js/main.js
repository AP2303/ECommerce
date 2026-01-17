// Consolidated and cleaned main.js

const backdrop = document.querySelector('.backdrop');
const sideDrawer = document.querySelector('.mobile-nav');
const menuToggle = document.querySelector('#side-menu-toggle');

if (backdrop) backdrop.addEventListener('click', () => { backdrop.style.display = 'none'; sideDrawer.classList.remove('open'); });
if (menuToggle) menuToggle.addEventListener('click', () => { backdrop.style.display = 'block'; sideDrawer.classList.add('open'); });

async function performLogout() {
  try {
    const response = await fetch('/logoutnow', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    window.location.href = '/';
  } catch (e) {
    console.error('Logout error:', e);
    window.location.href = '/';
  }
}

// Toast helper
function showToast(message, duration = 2500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  Object.assign(toast.style, {
    background: 'rgba(0,0,0,0.8)', color: 'white', padding: '10px 14px', borderRadius: '8px', marginTop: '8px', pointerEvents: 'auto', fontSize: '14px'
  });
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.transition = 'opacity 0.3s'; toast.style.opacity = '0'; setTimeout(() => container.removeChild(toast), 300); }, duration);
}

// Quickview loader
async function openQuickView(productId) {
  if (!productId) return;
  try {
    const productRes = await fetch('/api/products/' + productId, { credentials: 'same-origin' }).catch(() => null);
    const quickviewModal = document.getElementById('quickview-modal');
    const quickviewContent = document.getElementById('quickview-content');
    if (!quickviewModal || !quickviewContent) return;
    if (productRes && productRes.ok) {
      const p = await productRes.json();
      quickviewContent.innerHTML = `
        <div style="display:flex;gap:18px;flex-wrap:wrap;">
          <div style="flex:0 0 260px;"><img src="${p.imageSrc || '/images/placeholder.svg'}" style="width:240px;height:320px;object-fit:cover;border-radius:6px;"/></div>
          <div style="flex:1">
            <h2>${p.title}</h2>
            <p style="font-weight:700;">$${p.price}</p>
            <p>${p.description || ''}</p>
            <form action="/cart" method="POST" class="js-add-to-cart" data-add-to-cart="1">
              <input type="hidden" name="productId" value="${p.id}">
              <button type="submit" class="btn">Add to Cart</button>
            </form>
          </div>
        </div>
      `;
      quickviewModal.style.display = 'flex';
      // Attach handlers inside modal
      quickviewContent.querySelectorAll('form.js-add-to-cart, form[data-add-to-cart]').forEach(attachAddToCartForm);
      return;
    }
    const detailHtmlRes = await fetch('/products/' + productId, { credentials: 'same-origin' });
    const text = await detailHtmlRes.text();
    const mainMatch = text.match(/<main[\s\S]*?>[\s\S]*?<\/main>/i);
    quickviewContent.innerHTML = mainMatch ? mainMatch[0] : text;
    quickviewModal.style.display = 'flex';
  } catch (err) {
    console.error('Quickview load failed', err);
    showToast('Failed to load product details');
  }
}

function attachQuickviewHandlers(root = document) {
  const buttons = (root.querySelectorAll && root.querySelectorAll('.js-quickview')) || [];
  buttons.forEach(btn => {
    if (btn._quickviewAttached) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const pid = btn.getAttribute('data-productid');
      openQuickView(pid);
    });
    btn._quickviewAttached = true;
  });
}

function attachAddToCartForm(form) {
  if (!form || form._addToCartAttached) return;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = {};
    for (const [k, v] of formData.entries()) payload[k] = v;
    try {
      const actionUrl = new URL(form.action || '/cart', window.location.href);
      const fetchUrl = actionUrl.pathname + (actionUrl.search || '');
      const res = await fetch(fetchUrl, {
        method: (form.method || 'POST').toUpperCase(),
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams(payload)
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) { showToast('Failed to add to cart'); return; }
      const data = await res.json();
      if (data && data.success) {
        showToast('Added to cart');
        const cc = document.getElementById('cart-count');
        if (cc && data.cartCount !== undefined) cc.innerText = data.cartCount;
        else if (cc) { const current = parseInt(cc.textContent || '0', 10) || 0; cc.textContent = current + 1; }
        const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('.btn');
        if (submitBtn) { const orig = submitBtn.innerHTML; submitBtn.innerHTML = 'Added ✓'; submitBtn.disabled = true; setTimeout(() => { submitBtn.innerHTML = orig; submitBtn.disabled = false; }, 1200); }
        setTimeout(() => { window.location.href = '/cart'; }, 800);
      }
    } catch (err) { console.error('Form submit error', err); showToast('Failed to add to cart'); }
  });
  form._addToCartAttached = true;
}

function attachAdminDeleteForm(form) {
  if (!form || form._adminDeleteAttached) return;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this product?')) return;
    const formData = new FormData(form);
    const payload = {};
    for (const [k, v] of formData.entries()) payload[k] = v;
    try {
      const actionUrl = new URL(form.action || window.location.href, window.location.href);
      const fetchUrl = actionUrl.pathname + (actionUrl.search || '');
      const res = await fetch(fetchUrl, { method: (form.method || 'POST').toUpperCase(), credentials: 'same-origin', headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: new URLSearchParams(payload) });
      if (!res.ok) { showToast('Failed to delete product'); return; }
      const data = await res.json();
      if (data && data.success) {
        showToast('Product deleted');
        const card = form.closest('.product-item'); if (card) card.parentNode.removeChild(card);
      } else { showToast('Failed to delete product'); }
    } catch (err) { console.error('Admin delete error', err); showToast('Failed to delete product'); }
  });
  form._adminDeleteAttached = true;
}

// DOM-ready initialization
document.addEventListener('DOMContentLoaded', function () {
  // Logout handlers
  document.querySelectorAll('#logoutBtn, #logout, [data-logout], button[onclick*="logout"]').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); performLogout(); }));

  // Attach quickview handlers and form handlers present on page
  attachQuickviewHandlers(document);
  document.querySelectorAll('form.js-add-to-cart, form[data-add-to-cart]').forEach(attachAddToCartForm);
  document.querySelectorAll('form.js-admin-delete, form[data-admin-delete]').forEach(attachAdminDeleteForm);

  // Image fallback attachments
  document.querySelectorAll('img.js-img-fallback').forEach(img => {
    const applyPlaceholder = () => { const placeholder = img.getAttribute('data-placeholder') || '/images/placeholder.svg'; if (!img.src || img.src === '' || img.src === placeholder) return; try { if (!img.src.endsWith(placeholder)) img.src = placeholder; } catch (e) { img.src = placeholder; } };
    img.addEventListener('error', applyPlaceholder);
    setTimeout(() => { if (img.complete && (!img.naturalWidth || img.naturalWidth === 0)) applyPlaceholder(); }, 20);
    setTimeout(() => { if (!img.naturalWidth || img.naturalWidth === 0) applyPlaceholder(); }, 2000);
  });

  // Quickview modal close handlers
  const quickviewModal = document.getElementById('quickview-modal');
  const quickviewClose = document.getElementById('quickview-close');
  if (quickviewClose) quickviewClose.addEventListener('click', () => { if (quickviewModal) quickviewModal.style.display = 'none'; const content = document.getElementById('quickview-content'); if (content) content.innerHTML = ''; });
  if (quickviewModal) quickviewModal.addEventListener('click', (e) => { if (e.target === quickviewModal) { quickviewModal.style.display = 'none'; const content = document.getElementById('quickview-content'); if (content) content.innerHTML = ''; } });

  // MutationObserver for dynamic content
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            node.querySelectorAll && node.querySelectorAll('form.js-add-to-cart, form[data-add-to-cart]').forEach(attachAddToCartForm);
            node.querySelectorAll && node.querySelectorAll('form.js-admin-delete, form[data-admin-delete]').forEach(attachAdminDeleteForm);
            attachQuickviewHandlers(node);
          }
        });
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

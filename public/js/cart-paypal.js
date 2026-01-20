// PayPal Buttons - render on user click to ensure popups are allowed
document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('paypal-button-container');
  const payBtn = document.getElementById('cart-paypal-btn');

  function getDisplayedTotal() {
    try {
      const nodes = Array.from(document.querySelectorAll('div'));
      for (const n of nodes) {
        const txt = (n.textContent || '').trim();
        if (txt.indexOf('Total:') === 0) {
          const m = txt.match(/Total:\s*[$£]?([0-9.,]+)/);
          if (m && m[1]) return m[1].replace(/,/g, '');
        }
      }
      return null;
    } catch (e) {
      console.warn('getDisplayedTotal failed', e);
      return null;
    }
  }

  async function fetchAmountFromServer() {
    try {
      const resp = await fetch('/create-order-for-payment', { method: 'POST', credentials: 'same-origin' });
      if (!resp.ok) {
        const txt = await resp.text();
        console.warn('/create-order-for-payment failed', resp.status, txt);
        return null;
      }
      const json = await resp.json();
      if (json && json.totalAmount) return json.totalAmount;
      return null;
    } catch (err) {
      console.warn('fetchAmountFromServer error', err);
      return null;
    }
  }

  if (typeof window.paypal === 'undefined') {
    console.warn('PayPal SDK not loaded');
    if (payBtn) payBtn.style.display = 'none';
    return;
  }

  if (!container) {
    console.warn('PayPal button container not found');
    return;
  }

  if (!payBtn) {
    console.warn('Pay with PayPal button not found - rendering inline buttons');
    // If there's no explicit trigger button, render immediately (best-effort)
    renderButtons(getDisplayedTotal());
    return;
  }

  // Render buttons when user clicks the visible 'Pay with PayPal' button to ensure a user gesture
  payBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    payBtn.disabled = true;
    payBtn.innerText = 'Preparing...';

    // Determine amount from server (preferred) or DOM fallback
    let amount = await fetchAmountFromServer();
    if (!amount) amount = getDisplayedTotal();
    if (!amount) {
      alert('Cannot determine order amount');
      payBtn.disabled = false;
      payBtn.innerText = 'Pay with PayPal';
      return;
    }

    // show container and hide trigger button
    container.style.display = 'block';
    payBtn.style.display = 'none';

    // Render PayPal Buttons inline; the SDK will open a popup in response to the user's click
    try {
      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 45 },
        createOrder: function(data, actions) {
          // Create order on server and return the order ID
          return fetch('/payment/create-paypal-order', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount, currency: 'GBP' })
          }).then(function(res) {
            if (!res.ok) return res.text().then(t => { throw new Error('Server failed: ' + t); });
            return res.json();
          }).then(function(json) {
            if (!json || !json.paypalOrder || !json.paypalOrder.id) throw new Error('Invalid server response');
            console.log('PayPal order created:', json.paypalOrder.id);
            return json.paypalOrder.id;
          }).catch(function(err) {
            console.error('createOrder error:', err);
            alert('Failed to create PayPal order: ' + (err && err.message));
            throw err;
          });
        },
        onApprove: function(data, actions) {
          container.innerHTML = '<div style="text-align:center;padding:20px;">Processing payment...</div>';
          return actions.order.capture().then(function(details) {
            console.log('Payment captured:', details);
            return fetch('/payment/execute', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: data.orderID, details })
            }).then(async function(resp) {
              if (!resp.ok) {
                const txt = await resp.text();
                console.error('/payment/execute failed', resp.status, txt);
                alert('Payment completed but server failed to record it. Contact support.');
                return;
              }
              window.location.href = '/orders';
            }).catch(function(err) {
              console.error('Failed to call /payment/execute', err);
              alert('Payment completed but server failed to record it. Contact support.');
            });
          }).catch(function(err) {
            console.error('actions.order.capture failed', err);
            alert('Failed to capture PayPal order.');
            window.location.reload();
          });
        },
        onError: function(err) {
          console.error('PayPal Buttons onError', err);
          alert('PayPal error occurred. Please try again.');
          window.location.reload();
        },
        onCancel: function(data) {
          console.log('Payment cancelled by user', data);
          // restore UI
          container.style.display = 'none';
          payBtn.style.display = 'inline-block';
          payBtn.disabled = false;
          payBtn.innerText = 'Pay with PayPal';
        }
      }).render(container).then(function() {
        console.log('PayPal buttons rendered successfully');
      }).catch(function(err) {
        console.error('Failed to render PayPal buttons', err);
        alert('Failed to load PayPal buttons. Please refresh the page.');
        // restore UI
        container.style.display = 'none';
        payBtn.style.display = 'inline-block';
        payBtn.disabled = false;
        payBtn.innerText = 'Pay with PayPal';
      });
    } catch (err) {
      console.error('Unexpected error rendering PayPal buttons', err);
      alert('Unexpected error rendering PayPal buttons.');
      payBtn.disabled = false;
      payBtn.innerText = 'Pay with PayPal';
    }
  });

});

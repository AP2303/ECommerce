// Inline-only PayPal Buttons flow (no popup fallback)
document.addEventListener('DOMContentLoaded', function() {
  const payBtn = document.getElementById('cart-paypal-btn');
  const container = document.getElementById('paypal-button-container');

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
      // Expecting { totalAmount: '11.50', orderId: '...' } or similar
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

  // Render buttons when user clicks Pay with PayPal (keeps UI like before)
  if (payBtn && container) {
    payBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      payBtn.disabled = true;
      payBtn.innerText = 'Preparing...';

      // determine amount: prefer server-calculated amount, fallback to displayed total
      let amount = await fetchAmountFromServer();
      if (!amount) {
        amount = getDisplayedTotal();
      }
      if (!amount) {
        alert('Cannot determine order amount');
        payBtn.disabled = false;
        payBtn.innerText = 'Pay with PayPal';
        return;
      }

      // show container and hide button
      container.style.display = 'block';
      payBtn.style.display = 'none';

      // Render PayPal Buttons inline, creating the order here via actions.order.create
      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
        createOrder: function(data, actions) {
          return actions.order.create({
            purchase_units: [{ amount: { value: amount, currency_code: 'GBP' } }]
          });
        },
        onApprove: function(data, actions) {
          return actions.order.capture().then(function(details) {
            // Notify server to persist payment and create order
            fetch('/payment/execute', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paypalOrderId: data.orderID, details })
            }).then(async function(resp) {
              if (!resp.ok) {
                const txt = await resp.text();
                console.error('/payment/execute failed', resp.status, txt);
                alert('Payment completed but server failed to record it. Contact support.');
                return;
              }
              // Success - redirect to orders page
              window.location.href = '/orders';
            }).catch(function(err) {
              console.error('Failed to call /payment/execute', err);
              alert('Payment completed but server failed to record it. Contact support.');
            });
          }).catch(function(err) {
            console.error('actions.order.capture failed', err);
            alert('Failed to capture PayPal order.');
          });
        },
        onError: function(err) {
          console.error('PayPal Buttons onError', err);
          alert('PayPal error occurred');
          // restore UI
          container.style.display = 'none';
          payBtn.style.display = 'inline-block';
          payBtn.disabled = false;
          payBtn.innerText = 'Pay with PayPal';
        }
      }).render(container);

    });
  }

});

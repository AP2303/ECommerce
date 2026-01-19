// PayPal Buttons - Render immediately on page load
document.addEventListener('DOMContentLoaded', function() {
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

  if (typeof window.paypal === 'undefined') {
    console.warn('PayPal SDK not loaded');
    return;
  }

  if (!container) {
    console.warn('PayPal button container not found');
    return;
  }

  // Get amount immediately
  const amount = getDisplayedTotal();
  if (!amount) {
    console.error('Cannot determine cart amount');
    return;
  }

  console.log('Rendering PayPal buttons for amount:', amount);

  // Render PayPal Buttons immediately (ensures popup opens directly from user click)
  window.paypal.Buttons({
    style: {
      layout: 'vertical',
      color: 'gold',
      shape: 'rect',
      label: 'paypal',
      height: 45
    },

    // Create order on server - this runs when user clicks PayPal button
    createOrder: async function(data, actions) {
      try {
        console.log('Creating PayPal order for amount:', amount);

        const response = await fetch('/payment/create-paypal-order', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amount, currency: 'GBP' })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to create PayPal order:', response.status, errorText);
          throw new Error('Failed to create PayPal order');
        }

        const orderData = await response.json();

        // Validate response format
        if (!orderData || !orderData.paypalOrder || !orderData.paypalOrder.id) {
          console.error('Invalid response from /payment/create-paypal-order:', orderData);
          throw new Error('Invalid server response');
        }

        console.log('PayPal order created:', orderData.paypalOrder.id);
        return orderData.paypalOrder.id;
      } catch (error) {
        console.error('createOrder error:', error);
        alert('Failed to create PayPal order: ' + error.message);
        throw error;
      }
    },

    // Handle successful payment
    onApprove: function(data, actions) {
      // Show loading state
      container.innerHTML = '<div style="text-align:center;padding:20px;">Processing payment...</div>';

      return actions.order.capture().then(function(details) {
        console.log('Payment captured:', details);

        // Notify server to persist payment and update order
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
          // Success - redirect to orders page
          window.location.href = '/orders';
        }).catch(function(err) {
          console.error('Failed to call /payment/execute', err);
          alert('Payment completed but server failed to record it. Contact support.');
        });
      }).catch(function(err) {
        console.error('actions.order.capture failed', err);
        alert('Failed to capture PayPal order.');
        // Reload page to reset state
        window.location.reload();
      });
    },

    // Handle errors
    onError: function(err) {
      console.error('PayPal Buttons onError', err);
      alert('PayPal error occurred. Please try again.');
      // Reload page to reset state
      window.location.reload();
    },

    // Handle cancellation
    onCancel: function(data) {
      console.log('Payment cancelled by user', data);
      // Just log, user can try again
    }

  }).render(container).then(function() {
    console.log('PayPal buttons rendered successfully');
    container.style.display = 'block';
  }).catch(function(err) {
    console.error('Failed to render PayPal buttons', err);
    container.innerHTML = '<div style="color:red;padding:20px;">Failed to load PayPal buttons. Please refresh the page.</div>';
  });

});

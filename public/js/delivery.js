document.addEventListener('DOMContentLoaded', () => {
  const deliverForm = document.querySelector('form[action$="/deliver"]');
  if (!deliverForm) return;

  deliverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirm('Mark this shipment as delivered?')) return;

    const action = deliverForm.getAttribute('action');
    try {
      const resp = await fetch(action, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (resp.ok) {
        alert('Shipment marked delivered.');
        window.location.href = '/delivery/dashboard';
      } else {
        const json = await resp.json().catch(() => ({}));
        alert('Failed to mark delivered: ' + (json.error || resp.statusText));
      }
    } catch (err) {
      console.error('deliver error', err);
      alert('Network error marking delivered');
    }
  });
});

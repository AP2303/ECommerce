const paypal = require('@paypal/checkout-server-sdk');

function createPayPalClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
  const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();

  if (!clientId || !clientSecret) {
    console.warn('PayPal credentials not set (PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET). PayPal calls will fail.');
  }

  let environment;
  if (mode === 'live' || mode === 'production') {
    environment = new paypal.core.LiveEnvironment(clientId, clientSecret);
  } else {
    environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }

  return new paypal.core.PayPalHttpClient(environment);
}

module.exports = {
  getClient: createPayPalClient
};

// Login page functionality
const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const message = document.getElementById("message");

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    message.textContent = '';

    if (!email || !password) {
      message.textContent = 'Please enter email and password.';
      return;
    }

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        // Login succeeded - get redirect URL from response
        const data = await res.json();
        window.location.href = data.redirectUrl || '/customer/dashboard';
        return;
      }

      // Try parse JSON error
      let payload;
      try {
        payload = await res.json();
      } catch(e) {
        payload = null;
      }

      if (payload && payload.error) {
        message.textContent = payload.error;
      } else {
        message.textContent = 'Login failed. Please check credentials.';
      }
    } catch (err) {
      console.error(err);
      message.textContent = 'An error occurred. Please try again.';
    }
  });
}


// Registration page functionality
const form = document.getElementById('registerForm');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const registerBtn = document.getElementById('registerBtn');
const message = document.getElementById('message');
const passwordStrength = document.getElementById('passwordStrength');

// Password strength indicator
if (passwordInput) {
  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    if (password.length === 0) {
      passwordStrength.textContent = '';
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) {
      passwordStrength.textContent = 'Weak password';
      passwordStrength.className = 'password-strength strength-weak';
    } else if (strength <= 3) {
      passwordStrength.textContent = 'Medium strength';
      passwordStrength.className = 'password-strength strength-medium';
    } else {
      passwordStrength.textContent = 'Strong password';
      passwordStrength.className = 'password-strength strength-strong';
    }
  });
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    message.textContent = '';
    message.className = '';

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      message.textContent = 'All fields are required.';
      message.className = 'error';
      return;
    }

    if (password.length < 8) {
      message.textContent = 'Password must be at least 8 characters long.';
      message.className = 'error';
      return;
    }

    if (password !== confirmPassword) {
      message.textContent = 'Passwords do not match.';
      message.className = 'error';
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating account...';

    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirmPassword })
      });

      const data = await res.json();

      if (res.ok) {
        message.textContent = data.message || 'Registration successful! Redirecting to login...';
        message.className = 'success';
        form.reset();

        // Redirect to login after 2 seconds
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        message.textContent = data.error || 'Registration failed. Please try again.';
        message.className = 'error';
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register';
      }
    } catch (err) {
      console.error(err);
      message.textContent = 'An error occurred. Please try again.';
      message.className = 'error';
      registerBtn.disabled = false;
      registerBtn.textContent = 'Register';
    }
  });
}


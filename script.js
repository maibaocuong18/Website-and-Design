document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimation();
  initFormValidation();
  initCartActions();
  initProfileView();
});

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

function getApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (window.location.protocol === 'file:') {
    return `http://127.0.0.1:3000${normalizedPath}`;
  }

  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalHost) {
    return `${API_BASE}${normalizedPath}`;
  }

  return `http://127.0.0.1:3000${normalizedPath}`;
}

function initScrollAnimation() {
  const items = document.querySelectorAll('.slide-up');
  if (!items.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  items.forEach((item) => observer.observe(item));
}

function initFormValidation() {
  const forms = document.querySelectorAll('.needs-validation');
  forms.forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const mode = form.dataset.authMode || 'general';

      const formMessage = form.querySelector('[data-form-message]');
      clearMessage(formMessage);

      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        showMessage(formMessage, 'Please complete all required fields correctly.', 'error');
        return;
      }

      const emailInput = form.querySelector('input[type="email"]');
      if (emailInput && !isValidEmail(emailInput.value)) {
        setInputError(emailInput, 'Please enter a valid email address.');
        form.classList.add('was-validated');
        showMessage(formMessage, 'Email format is invalid.', 'error');
        return;
      }

      const passwordInput = form.querySelector('#password');
      const confirmPasswordInput = form.querySelector('#confirmPassword');

      if (mode === 'register' && passwordInput) {
        const check = validatePasswordStrength(passwordInput.value);
        if (!check.valid) {
          setInputError(passwordInput, check.message);
          form.classList.add('was-validated');
          showMessage(formMessage, check.message, 'error');
          return;
        }
      }

      if (mode === 'register' && passwordInput && confirmPasswordInput && passwordInput.value !== confirmPasswordInput.value) {
        setInputError(confirmPasswordInput, 'Passwords do not match.');
        form.classList.add('was-validated');
        showMessage(formMessage, 'Passwords do not match.', 'error');
        return;
      }

      if (mode === 'register') {
        const outcome = await handleRegister(form);
        if (!outcome.ok) {
          showMessage(formMessage, outcome.message, 'error');
          return;
        }

        form.classList.remove('was-validated');
        form.reset();
        showMessage(formMessage, 'Registration successful. Redirecting to login...', 'success');

        window.setTimeout(() => {
          window.location.href = 'login.html';
        }, 700);
        return;
      }

      if (mode === 'login') {
        const outcome = await handleLogin(form);
        if (!outcome.ok) {
          showMessage(formMessage, outcome.message, 'error');
          return;
        }

        showMessage(formMessage, 'Login successful. Redirecting to profile...', 'success');
        window.setTimeout(() => {
          window.location.href = 'profile.html';
        }, 700);
        return;
      }

      if (mode === 'contact') {
        const outcome = await handleContact(form);
        if (!outcome.ok) {
          showMessage(formMessage, outcome.message, 'error');
          return;
        }

        form.classList.remove('was-validated');
        form.reset();
        showMessage(formMessage, outcomeMessageForMode(mode) || form.dataset.successMessage || 'Form submitted successfully.', 'success');
      }
    });

    form.querySelectorAll('input, textarea').forEach((input) => {
      input.addEventListener('input', () => {
        input.setCustomValidity('');
      });
    });
  });
}

function outcomeMessageForMode(mode) {
  if (mode === 'register') {
    return 'Registration successful.';
  }
  if (mode === 'contact') {
    return "Thanks for reaching out. We'll get back to you shortly.";
  }
  return '';
}

async function handleRegister(form) {
  const fullName = form.querySelector('#fullName')?.value.trim() || '';
  const email = form.querySelector('#registerEmail')?.value.trim().toLowerCase() || '';
  const password = form.querySelector('#password')?.value || '';

  try {
    const response = await postJson('/api/auth/register', { fullName, email, password });
    return { ok: Boolean(response?.ok), message: response?.message || 'Registration successful.' };
  } catch {
    // Fallback for file-based preview when backend is not running.
  }

  const users = getStoredUsers();
  const exists = users.some((u) => u.email === email);
  if (exists) {
    return { ok: false, message: 'This email is already registered. Please login.' };
  }

  users.push({ fullName, email, password });
  localStorage.setItem('noirUsers', JSON.stringify(users));
  return { ok: true, message: 'Registration successful.' };
}

async function handleLogin(form) {
  const email = form.querySelector('#loginEmail')?.value.trim().toLowerCase() || '';
  const password = form.querySelector('#password')?.value || '';

  try {
    const response = await postJson('/api/auth/login', { email, password });
    if (!response?.ok || !response?.user) {
      return { ok: false, message: response?.message || 'Invalid email or password.' };
    }

    localStorage.setItem(
      'noirCurrentUser',
      JSON.stringify({ fullName: response.user.fullName, email: response.user.email })
    );
    return { ok: true, message: response.message || 'Login successful.' };
  } catch {
    // Fallback for file-based preview when backend is not running.
  }

  const users = getStoredUsers();
  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    return { ok: false, message: 'Invalid email or password.' };
  }

  localStorage.setItem('noirCurrentUser', JSON.stringify({ fullName: user.fullName, email: user.email }));
  return { ok: true, message: 'Login successful.' };
}

async function handleContact(form) {
  const fullName = form.querySelector('#contactName')?.value.trim() || '';
  const email = form.querySelector('#contactEmail')?.value.trim().toLowerCase() || '';
  const subject = form.querySelector('#contactSubject')?.value.trim() || '';
  const message = form.querySelector('#contactMessage')?.value.trim() || '';

  try {
    const response = await postJson('/api/contact', { fullName, email, subject, message });
    return {
      ok: Boolean(response?.ok),
      message: response?.message || "Thanks for reaching out. We'll get back to you shortly."
    };
  } catch {
    return {
      ok: true,
      message: "Thanks for reaching out. We'll get back to you shortly."
    };
  }
}

async function postJson(path, payload) {
  const response = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new Error(body?.message || 'Request failed.');
  }

  return body;
}

function getStoredUsers() {
  try {
    const raw = localStorage.getItem('noirUsers');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function initProfileView() {
  const nameEl = document.querySelector('[data-profile-name]');
  const emailEl = document.querySelector('[data-profile-email]');
  if (!nameEl || !emailEl) {
    return;
  }

  try {
    const raw = localStorage.getItem('noirCurrentUser');
    if (!raw) {
      return;
    }
    const currentUser = JSON.parse(raw);
    if (currentUser?.fullName) {
      nameEl.textContent = currentUser.fullName;
    }
    if (currentUser?.email) {
      emailEl.value = currentUser.email;
    }
  } catch {
    // Keep default profile placeholders if storage is unavailable.
  }
}

function initCartActions() {
  const cartRows = document.querySelectorAll('[data-cart-row]');
  if (!cartRows.length) {
    return;
  }

  const subtotalEl = document.querySelector('[data-subtotal]');
  const totalEl = document.querySelector('[data-total]');

  cartRows.forEach((row) => {
    const qtyInput = row.querySelector('[data-qty]');
    const removeBtn = row.querySelector('[data-remove]');

    qtyInput?.addEventListener('input', () => updateCartTotals(subtotalEl, totalEl));
    removeBtn?.addEventListener('click', () => {
      row.remove();
      updateCartTotals(subtotalEl, totalEl);
      renderEmptyCartState();
    });
  });

  updateCartTotals(subtotalEl, totalEl);
}

function updateCartTotals(subtotalEl, totalEl) {
  const rows = document.querySelectorAll('[data-cart-row]');
  let subtotal = 0;

  rows.forEach((row) => {
    const price = Number(row.dataset.price || 0);
    const qtyInput = row.querySelector('[data-qty]');
    const lineTotalEl = row.querySelector('[data-line-total]');
    const qty = Math.max(1, Number(qtyInput?.value || 1));

    if (qtyInput) {
      qtyInput.value = String(qty);
    }

    const lineTotal = price * qty;
    subtotal += lineTotal;

    if (lineTotalEl) {
      lineTotalEl.textContent = formatUsd(lineTotal);
    }
  });

  if (subtotalEl) {
    subtotalEl.textContent = formatUsd(subtotal);
  }
  if (totalEl) {
    totalEl.textContent = formatUsd(subtotal);
  }
}

function renderEmptyCartState() {
  const rows = document.querySelectorAll('[data-cart-row]');
  const body = document.querySelector('[data-cart-body]');

  if (rows.length || !body || document.querySelector('[data-empty-row]')) {
    return;
  }

  const tr = document.createElement('tr');
  tr.setAttribute('data-empty-row', 'true');
  tr.innerHTML = '<td colspan="5" class="text-center py-4">Your cart is empty.</td>';
  body.appendChild(tr);
}

function validatePasswordStrength(password) {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must include at least one number.' };
  }
  return { valid: true, message: '' };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setInputError(input, message) {
  input.setCustomValidity(message);
  input.reportValidity();
}

function showMessage(el, message, type) {
  if (!el) {
    return;
  }
  el.textContent = message;
  el.classList.remove('error', 'success');
  el.classList.add(type);
}

function clearMessage(el) {
  if (!el) {
    return;
  }
  el.textContent = '';
  el.classList.remove('error', 'success');
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

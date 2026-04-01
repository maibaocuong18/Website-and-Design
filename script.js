document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimation();
  initFormValidation();
  initCartActions();
  initProfileView();
});

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
    form.addEventListener('submit', (event) => {
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
        const outcome = handleRegister(form);
        if (!outcome.ok) {
          showMessage(formMessage, outcome.message, 'error');
          return;
        }
        form.classList.remove('was-validated');
        form.reset();
      }

      if (mode === 'login') {
        const outcome = handleLogin(form);
        if (!outcome.ok) {
          showMessage(formMessage, outcome.message, 'error');
          return;
        }
      }

      form.classList.add('was-validated');
      const successText = mode === 'login'
        ? 'Login successful. Redirecting to profile...'
        : form.dataset.successMessage || 'Form submitted successfully.';
      showMessage(formMessage, successText, 'success');

      if (mode === 'login') {
        window.setTimeout(() => {
          window.location.href = 'profile.html';
        }, 700);
      }
    });

    form.querySelectorAll('input, textarea').forEach((input) => {
      input.addEventListener('input', () => {
        input.setCustomValidity('');
      });
    });
  });
}

function handleRegister(form) {
  const fullName = form.querySelector('#fullName')?.value.trim() || '';
  const email = form.querySelector('#registerEmail')?.value.trim().toLowerCase() || '';
  const password = form.querySelector('#password')?.value || '';

  const users = getStoredUsers();
  const exists = users.some((u) => u.email === email);
  if (exists) {
    return { ok: false, message: 'This email is already registered. Please login.' };
  }

  users.push({ fullName, email, password });
  localStorage.setItem('noirUsers', JSON.stringify(users));
  return { ok: true, message: 'Registration successful.' };
}

function handleLogin(form) {
  const email = form.querySelector('#loginEmail')?.value.trim().toLowerCase() || '';
  const password = form.querySelector('#password')?.value || '';
  const users = getStoredUsers();
  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    return { ok: false, message: 'Invalid email or password.' };
  }

  localStorage.setItem('noirCurrentUser', JSON.stringify({ fullName: user.fullName, email: user.email }));
  return { ok: true, message: 'Login successful.' };
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

document.addEventListener('DOMContentLoaded', () => {
  initAuthNavigation();
  initScrollAnimation();
  initPasswordToggles();
  initAddToCartButtons();
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

function initAuthNavigation() {
  const currentUser = getCurrentUser();
  const nav = document.querySelector('.navbar-nav');
  const loginLink = document.querySelector('.navbar-nav .nav-link[href="login.html"]');
  const registerLink = document.querySelector('.navbar-nav .nav-link[href="register.html"]');
  const profileLink = document.querySelector('.navbar-nav .nav-link[href="profile.html"]');
  const cartLink = document.querySelector('.navbar-nav .nav-link[href="cart.html"]');

  if (!nav) {
    return;
  }

  if (!currentUser?.email) {
    setNavLinkDisabledState(loginLink, false);
    setNavLinkDisabledState(registerLink, false);
    setNavLinkDisabledState(profileLink, true);
    setNavLinkDisabledState(cartLink, true);
    return;
  }

  [loginLink, registerLink].forEach((link) => {
    setNavLinkDisabledState(link, true);
  });

  [profileLink, cartLink].forEach((link) => {
    setNavLinkDisabledState(link, false);
  });

  if (document.querySelector('[data-logout-link]')) {
    return;
  }

  const item = document.createElement('li');
  item.className = 'nav-item';
  item.innerHTML = '<a class="nav-link" href="#" data-logout-link>Logout</a>';
  nav.appendChild(item);

  const logoutLink = item.querySelector('[data-logout-link]');
  logoutLink?.addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('noirCurrentUser');
    window.location.href = 'index.html';
  });
}

function setNavLinkDisabledState(link, disabled) {
  if (!link) {
    return;
  }

  if (disabled) {
    link.classList.add('nav-link-muted');
    link.setAttribute('aria-disabled', 'true');
    link.tabIndex = -1;
  } else {
    link.classList.remove('nav-link-muted');
    link.removeAttribute('aria-disabled');
    link.tabIndex = 0;
  }

  if (link.dataset.navGuardBound === 'true') {
    link.dataset.navDisabled = disabled ? 'true' : 'false';
    return;
  }

  link.dataset.navDisabled = disabled ? 'true' : 'false';
  link.dataset.navGuardBound = 'true';
  link.addEventListener('click', (event) => {
    if (link.dataset.navDisabled === 'true') {
      event.preventDefault();
    }
  });
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

        const redirectTo = outcome.redirectTo || 'index.html';
        const isProfileSetup = redirectTo.startsWith('profile.html');
        showMessage(
          formMessage,
          isProfileSetup
            ? 'Login successful. Redirecting to complete your profile...'
            : 'Login successful. Redirecting to home...',
          'success'
        );
        window.setTimeout(() => {
          window.location.href = redirectTo;
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

function initPasswordToggles() {
  const toggleButtons = document.querySelectorAll('[data-password-toggle]');

  toggleButtons.forEach((button) => {
    syncPasswordToggleState(button);

    button.addEventListener('click', () => {
      const targetId = button.dataset.target;
      if (!targetId) {
        return;
      }

      const input = document.getElementById(targetId);
      if (!input) {
        return;
      }

      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      syncPasswordToggleState(button, input);
    });
  });
}

function syncPasswordToggleState(button, input) {
  const resolvedInput = input || document.getElementById(button.dataset.target || '');
  if (!resolvedInput) {
    return;
  }

  const isPasswordHidden = resolvedInput.type === 'password';
  button.classList.toggle('is-visible', !isPasswordHidden);
  button.setAttribute('aria-label', isPasswordHidden ? 'Show password' : 'Hide password');
  button.setAttribute('title', isPasswordHidden ? 'Show password' : 'Hide password');
}

function initAddToCartButtons() {
  const buttons = document.querySelectorAll('[data-add-to-cart]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const currentUser = getCurrentUser();
      if (!currentUser?.email) {
        window.alert('Please login to add items to your cart.');
        window.location.href = 'login.html';
        return;
      }

      const item = {
        id: button.dataset.productId || '',
        name: button.dataset.productName || 'Product',
        price: Number(button.dataset.productPrice || 0),
        qty: 1
      };

      addItemToCart(currentUser.email, item);
      const originalText = button.textContent;
      button.textContent = 'Added';
      button.disabled = true;

      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 900);
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

  users.push({
    fullName,
    email,
    password,
    profile: {
      fullName,
      phone: '',
      address: ''
    }
  });
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

    const profile = normalizeProfileData(response.user);
    const redirectTo = isProfileComplete(profile) ? 'index.html' : 'profile.html?edit=1';

    localStorage.setItem(
      'noirCurrentUser',
      JSON.stringify({
        fullName: profile.fullName,
        email: response.user.email,
        profile
      })
    );
    return { ok: true, message: response.message || 'Login successful.', redirectTo };
  } catch {
    // Fallback for file-based preview when backend is not running.
  }

  const users = getStoredUsers();
  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    return { ok: false, message: 'Invalid email or password.' };
  }

  const profile = normalizeProfileData(user);
  const redirectTo = isProfileComplete(profile) ? 'index.html' : 'profile.html?edit=1';

  localStorage.setItem(
    'noirCurrentUser',
    JSON.stringify({
      fullName: profile.fullName,
      email: user.email,
      profile
    })
  );
  return { ok: true, message: 'Login successful.', redirectTo };
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
  const guestView = document.querySelector('[data-profile-guest]');
  const profileShell = document.querySelector('[data-profile-shell]');
  const nameEl = document.querySelector('[data-profile-name]');
  const form = document.querySelector('[data-profile-form]');
  const fullNameInput = document.querySelector('[data-profile-fullname]');
  const emailInput = document.querySelector('[data-profile-email]');
  const phoneInput = document.querySelector('[data-profile-phone]');
  const addressInput = document.querySelector('[data-profile-address]');
  const noteEl = document.querySelector('[data-profile-note]');
  const messageEl = document.querySelector('[data-profile-message]');
  const saveButton = document.querySelector('[data-profile-save]');
  const editButtons = document.querySelectorAll('[data-edit-toggle]');

  if (!nameEl || !form || !fullNameInput || !emailInput || !phoneInput || !addressInput || !saveButton) {
    return;
  }

  const currentUser = getCurrentUser();
  if (!currentUser?.email) {
    if (guestView) {
      guestView.hidden = false;
    }
    if (profileShell) {
      profileShell.hidden = true;
    }
    return;
  }

  if (guestView) {
    guestView.hidden = true;
  }
  if (profileShell) {
    profileShell.hidden = false;
  }

  const users = getStoredUsers();
  const matchedUser = users.find((user) => user.email === currentUser.email) || currentUser;
  const profile = normalizeProfileData(matchedUser);

  fullNameInput.value = profile.fullName;
  emailInput.value = currentUser.email;
  phoneInput.value = profile.phone;
  addressInput.value = profile.address;
  nameEl.textContent = profile.fullName || currentUser.fullName || 'Noir Member';

  const shouldStartInEdit = isProfileSetupRequested() || !isProfileComplete(profile);
  setProfileEditMode({
    isEditing: shouldStartInEdit,
    noteEl,
    saveButton,
    editButtons,
    fullNameInput,
    phoneInput,
    addressInput
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearMessage(messageEl);

    const updatedProfile = {
      fullName: fullNameInput.value.trim(),
      phone: phoneInput.value.trim(),
      address: addressInput.value.trim()
    };

    if (!isProfileComplete(updatedProfile)) {
      showMessage(messageEl, 'Please fill in name, phone, and address.', 'error');
      return;
    }

    saveProfileByEmail(currentUser.email, updatedProfile);
    nameEl.textContent = updatedProfile.fullName;
    showMessage(messageEl, 'Profile saved. Redirecting to home...', 'success');

    window.setTimeout(() => {
      window.location.href = 'index.html';
    }, 700);
  });

  editButtons.forEach((button) => {
    button.addEventListener('click', () => {
      clearMessage(messageEl);
      setProfileEditMode({
        isEditing: true,
        noteEl,
        saveButton,
        editButtons,
        fullNameInput,
        phoneInput,
        addressInput
      });
    });
  });
}

function setProfileEditMode({ isEditing, noteEl, saveButton, editButtons, fullNameInput, phoneInput, addressInput }) {
  [fullNameInput, phoneInput, addressInput].forEach((input) => {
    input.readOnly = !isEditing;
  });

  if (noteEl) {
    noteEl.hidden = !isEditing;
  }

  saveButton.hidden = !isEditing;
  editButtons.forEach((button) => {
    button.hidden = isEditing;
  });
}

function isProfileSetupRequested() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('edit') === '1';
  } catch {
    return false;
  }
}

function normalizeProfileData(user) {
  const profile = user?.profile || {};

  return {
    fullName: String(profile.fullName || user?.fullName || '').trim(),
    phone: String(profile.phone || user?.phone || '').trim(),
    address: String(profile.address || user?.address || '').trim()
  };
}

function isProfileComplete(profile) {
  return Boolean(profile?.fullName && profile?.phone && profile?.address);
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('noirCurrentUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveProfileByEmail(email, profile) {
  const users = getStoredUsers();
  const userIndex = users.findIndex((user) => user.email === email);

  if (userIndex >= 0) {
    users[userIndex] = {
      ...users[userIndex],
      fullName: profile.fullName,
      profile: {
        ...users[userIndex].profile,
        ...profile
      }
    };
    localStorage.setItem('noirUsers', JSON.stringify(users));
  }

  const currentUser = getCurrentUser() || {};
  localStorage.setItem(
    'noirCurrentUser',
    JSON.stringify({
      ...currentUser,
      fullName: profile.fullName,
      email,
      profile: {
        ...(currentUser.profile || {}),
        ...profile
      }
    })
  );
}

function initCartActions() {
  const body = document.querySelector('[data-cart-body]');
  const subtotalEl = document.querySelector('[data-subtotal]');
  const totalEl = document.querySelector('[data-total]');
  const checkoutButton = document.querySelector('[data-checkout-button]');

  if (!body || !subtotalEl || !totalEl) {
    return;
  }

  const currentUser = getCurrentUser();

  if (!currentUser?.email) {
    renderCartMessage(body, 'Please login to view your cart.');
    if (checkoutButton) {
      checkoutButton.disabled = true;
    }
    updateCartTotals(subtotalEl, totalEl);
    return;
  }

  const items = getStoredCart(currentUser.email);

  if (!items.length) {
    renderCartMessage(body, 'Your cart is empty.');
    if (checkoutButton) {
      checkoutButton.disabled = true;
    }
    updateCartTotals(subtotalEl, totalEl);
    return;
  }

  renderCartItems(body, items);

  if (checkoutButton) {
    checkoutButton.disabled = false;
  }

  const cartRows = body.querySelectorAll('[data-cart-row]');
  cartRows.forEach((row) => {
    const qtyInput = row.querySelector('[data-qty]');
    const removeBtn = row.querySelector('[data-remove]');

    qtyInput?.addEventListener('input', () => {
      const qty = Math.max(1, Number(qtyInput.value || 1));
      qtyInput.value = String(qty);
      updateCartItemQty(currentUser.email, row.dataset.cartId || '', qty);
      updateCartTotals(subtotalEl, totalEl);
    });

    removeBtn?.addEventListener('click', () => {
      removeCartItem(currentUser.email, row.dataset.cartId || '');
      row.remove();
      updateCartTotals(subtotalEl, totalEl);
      renderEmptyCartState();
      if (!document.querySelector('[data-cart-row]') && checkoutButton) {
        checkoutButton.disabled = true;
      }
    });
  });

  updateCartTotals(subtotalEl, totalEl);
}

function getCartStorageKey(email) {
  return `noirCart:${email}`;
}

function getStoredCart(email) {
  if (!email) {
    return [];
  }

  try {
    const raw = localStorage.getItem(getCartStorageKey(email));
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items)
      ? items.map((item) => ({
          id: String(item.id || '').trim(),
          name: String(item.name || 'Product').trim(),
          price: Number(item.price || 0),
          qty: Math.max(1, Number(item.qty || 1))
        }))
      : [];
  } catch {
    return [];
  }
}

function saveStoredCart(email, items) {
  if (!email) {
    return;
  }

  localStorage.setItem(getCartStorageKey(email), JSON.stringify(items));
}

function addItemToCart(email, item) {
  const items = getStoredCart(email);
  const existingItem = items.find((entry) => entry.id === item.id);

  if (existingItem) {
    existingItem.qty += 1;
  } else {
    items.push(item);
  }

  saveStoredCart(email, items);
}

function updateCartItemQty(email, itemId, qty) {
  const items = getStoredCart(email).map((item) => {
    if (item.id === itemId) {
      return { ...item, qty };
    }
    return item;
  });

  saveStoredCart(email, items);
}

function removeCartItem(email, itemId) {
  const items = getStoredCart(email).filter((item) => item.id !== itemId);
  saveStoredCart(email, items);
}

function renderCartItems(body, items) {
  body.innerHTML = items
    .map(
      (item) => `
        <tr data-cart-row data-cart-id="${escapeHtml(item.id)}" data-price="${item.price}">
          <td>${escapeHtml(item.name)}</td>
          <td>${formatUsd(item.price)}</td>
          <td><input type="number" class="form-control rounded-0" data-qty value="${item.qty}" min="1" style="max-width: 90px;" /></td>
          <td data-line-total>${formatUsd(item.price * item.qty)}</td>
          <td><button class="btn btn-sm btn-outline-noir" type="button" data-remove>Remove</button></td>
        </tr>`
    )
    .join('');
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
  const body = document.querySelector('[data-cart-body]');
  const rows = document.querySelectorAll('[data-cart-row]');

  if (rows.length || !body) {
    return;
  }

  renderCartMessage(body, 'Your cart is empty.');
}

function renderCartMessage(body, message) {
  if (!body) {
    return;
  }

  body.innerHTML = '';

  const tr = document.createElement('tr');
  tr.setAttribute('data-empty-row', 'true');
  tr.innerHTML = `<td colspan="5" class="text-center py-4">${message}</td>`;
  body.appendChild(tr);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

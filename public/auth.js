// Shared Auth Logic
document.addEventListener('DOMContentLoaded', () => {
  // Check if token exists
  const token = localStorage.getItem('fastaid_token');
  const isLanding = window.location.pathname === '/' || window.location.pathname === '/index.html';
  
  if (!token && !isLanding) {
    // If we are on a protected page without a token, redirect to landing
    window.location.href = '/';
  }

  // Inject Logout Button if not on landing page
  if (token && !isLanding) {
    injectLogoutButton();
  }
});

function injectLogoutButton() {
  const btn = document.createElement('button');
  btn.textContent = 'Logout';
  btn.style.position = 'fixed';
  btn.style.bottom = '20px';
  btn.style.right = '20px';
  btn.style.zIndex = '9999';
  btn.style.padding = '8px 16px';
  btn.style.background = 'var(--danger, #ef4444)';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.borderRadius = '8px';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  
  btn.addEventListener('click', () => {
    localStorage.removeItem('fastaid_token');
    localStorage.removeItem('fastaid_user');
    window.location.href = '/';
  });
  
  document.body.appendChild(btn);
}

function getAuthHeaders() {
  const token = localStorage.getItem('fastaid_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Ensure it's globally available
window.showLoginModal = showLoginModal;

function showLoginModal(isLanding = false) {
  if (document.getElementById('authOverlay')) return; // already open

  const html = `
    <div id="authOverlay" class="login-overlay">
      <div class="glass-panel login-modal">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="margin:0;">Secure Access</h2>
          ${isLanding ? '<button id="closeAuthBtn" style="background:transparent; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>' : ''}
        </div>
        
        <div class="auth-tabs">
          <button class="auth-tab active" id="tabLogin">Sign In</button>
          <button class="auth-tab" id="tabRegister">Register</button>
        </div>

        <div id="authError" class="login-error"></div>
        
        <!-- Login Form -->
        <form id="loginForm">
          <input type="text" id="loginPhone" class="form-input" placeholder="Phone Number or Email" required />
          <input type="password" id="loginPassword" class="form-input" placeholder="Password" required />
          <button type="submit" class="btn-primary" style="width: 100%;">Sign In</button>
        </form>

        <!-- Register Form -->
        <form id="registerForm" style="display: none;">
          <input type="text" id="regName" class="form-input" placeholder="Full Name" required />
          <input type="tel" id="regPhone" class="form-input" placeholder="Phone Number (e.g. 017...)" required />
          <input type="email" id="regEmail" class="form-input" placeholder="Email Address" required />
          <input type="password" id="regPassword" class="form-input" placeholder="Create Password" required />
          <select id="regRole" class="form-input" required style="appearance: none;">
            <option value="" disabled selected>Select Role</option>
            <option value="Victim">Victim</option>
            <option value="Volunteer">Volunteer</option>
          </select>
          <button type="submit" class="btn-primary" style="width: 100%;">Create Account</button>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const errorEl = document.getElementById('authError');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const demoHint = document.getElementById('demoHint');

  if (isLanding) {
    document.getElementById('closeAuthBtn').addEventListener('click', () => {
      document.getElementById('authOverlay').remove();
    });
  }

  // Tab switching logic
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    demoHint.style.display = 'block';
    errorEl.style.display = 'none';
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
    demoHint.style.display = 'none';
    errorEl.style.display = 'none';
  });

  // Handle Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('fastaid_token', data.token);
        localStorage.setItem('fastaid_user', JSON.stringify(data.user));
        document.getElementById('authOverlay').remove();
        window.dispatchEvent(new Event('authReady'));
        // Automatically redirect to portal
        redirectToPortal();
      } else {
        errorEl.textContent = data.error || 'Login failed';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = 'Network error';
      errorEl.style.display = 'block';
    }
  });

  // Handle Register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const role = document.getElementById('regRole').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, password, role })
      });
      const data = await res.json();

      if (res.ok) {
        // Automatically log them in after registration
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password })
        });
        const loginData = await loginRes.json();
        
        if (loginRes.ok) {
          localStorage.setItem('fastaid_token', loginData.token);
          localStorage.setItem('fastaid_user', JSON.stringify(loginData.user));
          document.getElementById('authOverlay').remove();
          window.dispatchEvent(new Event('authReady'));
          // Automatically redirect to portal
          redirectToPortal();
        }
      } else {
        errorEl.textContent = data.error || 'Registration failed';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = 'Network error';
      errorEl.style.display = 'block';
    }
  });
}

function redirectToPortal() {
  const userStr = localStorage.getItem('fastaid_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.role === 'Victim' && window.location.pathname !== '/victim-mobile/') window.location.href = '/victim-mobile/';
      if (user.role === 'Volunteer' && window.location.pathname !== '/volunteer-phone/') window.location.href = '/volunteer-phone/';
      if (user.role === 'Admin' && window.location.pathname !== '/admin-dashboard/') window.location.href = '/admin-dashboard/';
    } catch(e) {}
  }
}

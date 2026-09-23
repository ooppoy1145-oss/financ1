/* ============================================
   Finance System — Authentication Module
   Login / Logout / Session / Route Guard
   ============================================ */

const Auth = {
  /* ─── Login ─── */
  login(email, password) {
    email = email.toLowerCase().trim();

    // Check admin
    const admin = FinanceDB.getAdmin();
    if (email === admin.email && password === admin.password) {
      const session = {
        type: 'admin',
        email: admin.email,
        name: admin.name,
        loginAt: new Date().toISOString()
      };
      FinanceDB.setSession(session);
      return { success: true, type: 'admin', user: session };
    }

    // Check customer
    const customer = FinanceDB.getCustomerByEmail(email);
    if (customer && customer.password === password) {
      const session = {
        type: 'customer',
        id: customer.id,
        email: customer.email,
        name: customer.name,
        profileImage: customer.profileImage,
        loginAt: new Date().toISOString()
      };
      FinanceDB.setSession(session);
      return { success: true, type: 'customer', user: session };
    }

    return { success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  },

  /* ─── LINE Login (App Redirect & Demo) ─── */
  redirectToLineApp() {
    const settings = FinanceDB.getSettings();
    const channelId = settings.lineChannelId ? settings.lineChannelId.trim() : '';
    const redirectUri = settings.lineCallbackUrl || (window.location.origin + window.location.pathname);
    const state = 'finance_line_' + Date.now();

    if (!channelId) {
      showToast('กรุณาตั้งค่า LINE Channel ID ในหน้าแอดมินก่อนใช้งาน', 'warning');
      return false;
    }

    // LINE Login OAuth 2.1 URL (On mobile devices, this Universal Link opens LINE App directly!)
    const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${encodeURIComponent(channelId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=profile%20openid%20email&bot_prompt=normal`;

    sessionStorage.setItem('line_oauth_state', state);
    window.location.href = lineAuthUrl;
    return true;
  },

  handleLineCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state) {
      showToast('เชื่อมต่อกับแอป LINE สำเร็จ!', 'success');
      const customers = FinanceDB.getCustomers();
      if (customers.length > 0) {
        this.loginWithLine(customers[0].id);
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => window.location.href = 'dashboard.html', 600);
        return true;
      }
    }
    return false;
  },

  loginWithLine(customerId) {
    const customers = FinanceDB.getCustomers();
    const customer = customerId 
      ? FinanceDB.getCustomer(customerId) 
      : (customers.length > 0 ? customers[0] : null);

    if (!customer) {
      return { 
        success: false, 
        message: 'ไม่พบบัญชีลูกค้าสำหรับเข้าสู่ระบบผ่าน LINE' 
      };
    }

    const session = {
      type: 'customer',
      id: customer.id,
      email: customer.email,
      name: customer.name,
      profileImage: customer.profileImage,
      loginVia: 'line',
      loginAt: new Date().toISOString()
    };
    FinanceDB.setSession(session);
    return { success: true, type: 'customer', user: session };
  },

  /* ─── Logout ─── */
  logout() {
    FinanceDB.clearSession();
    window.location.href = 'index.html';
  },

  /* ─── Check Session ─── */
  isLoggedIn() {
    return FinanceDB.getSession() !== null;
  },

  getSession() {
    return FinanceDB.getSession();
  },

  isAdmin() {
    const session = this.getSession();
    return session && session.type === 'admin';
  },

  isCustomer() {
    const session = this.getSession();
    return session && session.type === 'customer';
  },

  /* ─── Route Guards ─── */
  requireAuth(redirectTo = 'index.html') {
    if (!this.isLoggedIn()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  },

  requireAdmin(redirectTo = 'index.html') {
    if (!this.isAdmin()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  },

  requireCustomer(redirectTo = 'index.html') {
    if (!this.isCustomer()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }
};

/* ─── Toast Helper ─── */
function showToast(message, type = 'info', duration = 3000) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Show
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  });

  // Hide
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

/* ─── Default Avatar SVG ─── */
function getDefaultAvatar(name) {
  const initials = name ? name.charAt(0) : '?';
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#D4A847"/>
          <stop offset="100%" style="stop-color:#F0C75E"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="50" fill="url(#g)"/>
      <text x="50" y="55" font-family="Prompt, sans-serif" font-size="40" font-weight="600" fill="#1a1a2e" text-anchor="middle" dominant-baseline="middle">${initials}</text>
    </svg>
  `)}`;
}

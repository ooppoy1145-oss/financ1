/* ============================================
   Finance System — Admin Page Logic
   ============================================ */

let editingCustomerId = null;
let editingContractId = null;
let searchQuery = '';
let currentSummaryTab = 'daily'; // 'daily' | 'weekly' | 'monthly'

function checkAdminAccess() {
  const isAuth = Auth.isAdmin();
  const gatewayEl = document.getElementById('adminLoginGateway');
  const workspaceEl = document.getElementById('adminWorkspace');

  if (!isAuth) {
    if (gatewayEl) gatewayEl.style.display = 'flex';
    if (workspaceEl) workspaceEl.style.display = 'none';
    setupAdminGatewayForm();
    return false;
  } else {
    if (gatewayEl) gatewayEl.style.display = 'none';
    if (workspaceEl) workspaceEl.style.display = 'block';
    return true;
  }
}

function setupAdminGatewayForm() {
  const form = document.getElementById('adminGatewayForm');
  if (!form || form._isSetup) return;
  form._isSetup = true;

  const toggleBtn = document.getElementById('toggleAdminGatewayPass');
  const passInput = document.getElementById('adminPasswordInput');
  if (toggleBtn && passInput) {
    toggleBtn.onclick = () => {
      const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passInput.setAttribute('type', type);
      toggleBtn.textContent = type === 'password' ? '👁️' : '🙈';
    };
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmailInput').value.trim();
    const password = document.getElementById('adminPasswordInput').value;
    const errorBox = document.getElementById('adminLoginError');
    const errorText = document.getElementById('adminLoginErrorText');
    const submitBtn = document.getElementById('adminGatewaySubmitBtn');

    if (errorBox) errorBox.style.display = 'none';
    if (submitBtn) submitBtn.classList.add('loading');

    setTimeout(async () => {
      const result = Auth.login(email, password);
      if (result.success && result.type === 'admin') {
        showToast('เข้าสู่ระบบหลังบ้านแอดมินสำเร็จ!', 'success');
        if (submitBtn) submitBtn.classList.remove('loading');
        // Fetch latest cloud data immediately
        await FinanceDB.fetchFromCloud();
        initAdminWorkspace();
      } else {
        if (submitBtn) submitBtn.classList.remove('loading');
        if (errorBox) {
          errorText.textContent = result.message || 'อีเมลหรือรหัสผ่านแอดมินไม่ถูกต้อง';
          errorBox.style.display = 'flex';
        }
      }
    }, 400);
  };
}

function quickFillAdmin() {
  const emailInput = document.getElementById('adminEmailInput');
  const passInput = document.getElementById('adminPasswordInput');
  if (emailInput) emailInput.value = 'admin@finance.com';
  if (passInput) passInput.value = 'admin123';
  const form = document.getElementById('adminGatewayForm');
  if (form) {
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  }
}

function handleAdminLogout() {
  FinanceDB.clearSession();
  checkAdminAccess();
  showToast('ออกจากระบบหลังบ้านแอดมินเรียบร้อย', 'info');
}

function initAdmin() {
  // If not logged in, show dedicated Admin Gateway right here on admin.html
  if (!checkAdminAccess()) {
    return;
  }

  initAdminWorkspace();
}

function initAdminWorkspace() {
  checkAdminAccess();
  renderAdminHeader();
  updateSyncBanner();
  renderStats();
  renderToolbar();
  renderCustomerList();

  // Multi-Device Cloud Sync Listener
  if (!window._adminSyncListenerAttached) {
    window._adminSyncListenerAttached = true;
    FinanceDB.onSync((event) => {
      updateSyncBanner();
      renderStats();
      renderCustomerList();
      // Auto-update dashboard if open
      const summaryModal = document.getElementById('summaryDashboardModal');
      if (summaryModal && summaryModal.classList.contains('active')) {
        renderSummaryDashboardContent(currentSummaryTab);
      }
      if (event && event.type === 'cloud_pulled' && !event.isInitial) {
        showToast('⚡ ซิงค์ข้อมูลล่าสุดจากเครื่องอื่นเรียบร้อยแล้ว', 'info');
      }
    });
  }
}

/* ─── Live Sync Status Banner (Multi-Device) ─── */
function updateSyncBanner() {
  const bannerEl = document.getElementById('adminSyncStatus');
  if (!bannerEl) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const settings = FinanceDB.getSettings();
  const isCloud = settings.cloudSyncEnabled && (settings.cloudSyncUrl || FinanceDB.DEFAULT_CLOUD_URL);

  bannerEl.innerHTML = `
    <div class="admin-sync-banner">
      <div class="sync-status-indicator">
        <span class="sync-dot"></span>
        <span>
          <strong>ระบบซิงค์ข้อมูลเรียลไทม์:</strong> เชื่อมต่อแล้ว ข้อมูลตรงกันทุกเครื่อง/หน้าจอ 
          <span style="opacity:0.75;font-size:0.72rem;">(อัพเดทล่าสุด ${timeStr}${isCloud ? ' • Cloud Sync อัตโนมัติ' : ' • Live Sync'})</span>
        </span>
      </div>
      <div class="sync-actions">
        <button class="sync-refresh-btn" onclick="openSyncTransferModal()" title="ส่งข้อมูลไปมือถือ / ซิงค์ข้ามเครื่อง">
          📲 ซิงค์ข้ามเครื่อง
        </button>
        <button class="sync-refresh-btn" onclick="triggerManualSync()" title="กดเพื่อดึงข้อมูลล่าสุดจากคลาวด์ทันที">
          🔄 ซิงค์ทันที
        </button>
      </div>
    </div>
  `;
}

async function triggerManualSync() {
  const bannerEl = document.getElementById('adminSyncStatus');
  if (bannerEl) {
    const dot = bannerEl.querySelector('.sync-dot');
    if (dot) dot.classList.add('syncing');
  }

  showToast('กำลังซิงค์ข้อมูลล่าสุดจากคลาวด์...', 'info');
  await FinanceDB.fetchFromCloud();
  FinanceDB.notifyListeners({ type: 'manual_sync', timestamp: Date.now() });

  renderStats();
  renderCustomerList();
  updateSyncBanner();
  showToast('ซิงค์ข้อมูลเรียบร้อยแล้ว! ทุกเครื่องเห็นตรงกัน', 'success');
}

/* ─── Header ─── */
function renderAdminHeader() {
  document.getElementById('adminHeader').innerHTML = `
    <div class="admin-header-inner container-wide">
      <div class="admin-brand">
        <div class="logo">💰</div>
        <div>
          <h1>Finance Pro</h1>
          <span>ระบบจัดการหลังบ้าน (แอดมิน)</span>
        </div>
      </div>
      <div class="admin-actions">
        <a href="index.html" class="btn btn-secondary btn-sm" target="_blank" title="เปิดดูหน้าบ้านลูกค้า" style="text-decoration:none;">
          🌐 ดูหน้าบ้านลูกค้า
        </a>
        <button class="btn btn-secondary btn-sm" onclick="openSyncTransferModal()" title="ส่งข้อมูลไปมือถือ / ซิงค์ข้ามเครื่อง" style="background:rgba(217,119,6,0.15);color:var(--accent-light);border-color:var(--accent);">
          📲 ซิงค์ไปมือถือ
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openSummaryDashboardModal()" title="แดชบอร์ดสรุปยอด รายวัน/อาทิตย์/เดือน">
          📊 แดชบอร์ดสรุป
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openSettingsModal()" title="ตั้งค่าข้อมูลติดต่อ, QR ร้าน & Bank API">
          ⚙️ ตั้งค่าระบบ
        </button>
        <button class="btn btn-secondary btn-sm" onclick="handleAdminLogout()" title="ออกจากระบบแอดมิน">
          🚪 ออกจากระบบ
        </button>
      </div>
    </div>
  `;
}

/* ─── Stats ─── */
function renderStats() {
  const customers = FinanceDB.getCustomers();
  let totalContracts = 0;
  let totalRemaining = 0;
  let totalPaid = 0;

  customers.forEach(c => {
    const contracts = c.contracts || [];
    totalContracts += contracts.length;
    contracts.forEach(con => {
      const stats = FinanceDB.getContractStats(con);
      if (stats) {
        totalRemaining += stats.remainingAmount;
        totalPaid += stats.totalPaid;
      }
    });
  });

  document.getElementById('adminStats').innerHTML = `
    <div class="admin-stat-card glass-card-static gold">
      <div class="stat-value">${customers.length}</div>
      <div class="stat-label">👥 ลูกค้าทั้งหมด</div>
    </div>
    <div class="admin-stat-card glass-card-static blue">
      <div class="stat-value">${totalContracts}</div>
      <div class="stat-label">📋 สัญญาทั้งหมด</div>
    </div>
    <div class="admin-stat-card glass-card-static gold">
      <div class="stat-value">${FinanceDB.formatCurrency(totalRemaining)} ฿</div>
      <div class="stat-label">⏳ ยอดคงเหลือรวมในระบบ</div>
    </div>
    <div class="admin-stat-card glass-card-static green">
      <div class="stat-value">${FinanceDB.formatCurrency(totalPaid)} ฿</div>
      <div class="stat-label">✅ ยอดที่ชำระแล้วทั้งหมด</div>
    </div>
  `;
}

/* ─── Toolbar ─── */
function renderToolbar() {
  document.getElementById('adminToolbar').innerHTML = `
    <div class="admin-search">
      <span class="search-icon">🔍</span>
      <input type="text" placeholder="ค้นหาชื่อ, อีเมล หรือเบอร์โทร..." id="searchInput" value="${searchQuery}" oninput="onSearch(this.value)">
    </div>
    <button class="btn btn-secondary admin-add-btn btn-sm" onclick="openSummaryDashboardModal()" style="display:inline-flex;align-items:center;gap:6px;">
      📊 แดชบอร์ดสรุปยอด
    </button>
    <button class="btn btn-primary admin-add-btn btn-sm" onclick="openAddCustomerModal()">
      ➕ เพิ่มลูกค้าใหม่
    </button>
  `;
}

/* ─── Customer List ─── */
function renderCustomerList() {
  const customers = FinanceDB.getCustomers();
  const listEl = document.getElementById('customerList');

  const filtered = searchQuery
    ? customers.filter(c => 
        (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.phone && c.phone.includes(searchQuery))
      )
    : customers;

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">👥</div>
        <p>${searchQuery ? 'ไม่พบลูกค้าที่ค้นหา' : 'ยังไม่มีลูกค้า กดปุ่ม "เพิ่มลูกค้าใหม่" เพื่อเริ่มต้น'}</p>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(customer => {
    const summary = FinanceDB.getCustomerSummary(customer.id);
    const profileImg = customer.profileImage || getDefaultAvatar(customer.name);

    html += `
      <div class="customer-card glass-card-static" onclick="openEditCustomerModal('${customer.id}')">
        <div class="customer-card-header">
          <img src="${profileImg}" alt="${customer.name}" class="customer-card-avatar">
          <div class="customer-card-info">
            <h3>${customer.name}</h3>
            <p>📧 ${customer.email} ${customer.phone ? ' | 📱 ' + customer.phone : ''}</p>
          </div>
          <div class="customer-card-actions" onclick="event.stopPropagation()">
            <button class="btn btn-secondary btn-sm" onclick="openEditCustomerModal('${customer.id}')" title="แก้ไขข้อมูล">✏️ แก้ไข</button>
            <button class="btn btn-secondary btn-sm delete" onclick="deleteCustomerConfirm('${customer.id}', '${customer.name}')" title="ลบลูกค้า">🗑️ ลบ</button>
          </div>
        </div>
        <div class="customer-card-details">
          <div class="customer-card-detail">
            <span class="detail-label">สัญญาปัจจุบัน</span>
            <span class="detail-value">${summary ? summary.totalContracts : 0} รายการ</span>
          </div>
          <div class="customer-card-detail">
            <span class="detail-label">ยอดคงเหลือรวม</span>
            <span class="detail-value gold">${summary ? FinanceDB.formatCurrency(summary.totalRemaining) : 0} ฿</span>
          </div>
          <div class="customer-card-detail">
            <span class="detail-label">ชำระแล้ว</span>
            <span class="detail-value green">${summary ? FinanceDB.formatCurrency(summary.totalPaid) : 0} ฿</span>
          </div>
          <div class="customer-card-detail">
            <span class="detail-label">ปิดสัญญาแล้ว</span>
            <span class="detail-value">${summary ? summary.completedContracts : 0} ครั้ง</span>
          </div>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
}

function onSearch(query) {
  searchQuery = query;
  renderCustomerList();
}

/* ─── Add Customer Modal ─── */
function openAddCustomerModal() {
  editingCustomerId = null;
  openCustomerModal('เพิ่มลูกค้าใหม่', {
    name: '',
    email: '',
    password: '',
    phone: '',
    profileImage: '',
    closedContractsCount: 0
  });
}

/* ─── Edit Customer Modal ─── */
function openEditCustomerModal(customerId) {
  editingCustomerId = customerId;
  const customer = FinanceDB.getCustomer(customerId);
  if (!customer) return;

  openCustomerModal('แก้ไขข้อมูลลูกค้า: ' + customer.name, customer);
}

/* ─── Customer Modal ─── */
function openCustomerModal(title, data) {
  const modal = document.getElementById('customerModal');
  const profileImg = data.profileImage || getDefaultAvatar(data.name || '?');

  modal.querySelector('.modal-title').textContent = title;
  modal.querySelector('.modal-body').innerHTML = `
    <!-- รูปโปรไฟล์ลูกค้า (ตรงกับ 1. หน้าหลัก) -->
    <div class="profile-upload">
      <img src="${profileImg}" id="profilePreview" class="profile-preview" alt="Profile">
      <div>
        <div class="profile-upload-btn btn btn-secondary btn-sm" style="width:auto;padding:8px 16px;">
          📷 เลือกรูปโปรไฟล์
          <input type="file" accept="image/*" onchange="handleProfileImage(this)">
        </div>
        <input type="hidden" id="profileImageData" value="${data.profileImage || ''}">
        <p style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">รองรับรูปภาพ JPG, PNG (ไม่เกิน 2MB)</p>
      </div>
    </div>

    <!-- ข้อมูลลูกค้า -->
    <div class="form-group">
      <label class="form-label">ชื่อ-นามสกุลลูกค้า (ตรงกับหน้าหลัก) *</label>
      <input type="text" class="form-input" id="custName" value="${data.name || ''}" required placeholder="เช่น สมชาย ใจดี">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">อีเมล (สำหรับ Login) *</label>
        <input type="email" class="form-input" id="custEmail" value="${data.email || ''}" required placeholder="somchai@mail.com">
      </div>
      <div class="form-group">
        <label class="form-label">รหัสผ่าน (แอดมินตั้งให้) *</label>
        <input type="text" class="form-input" id="custPassword" value="${data.password || ''}" required placeholder="ตั้งรหัสผ่าน">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">เบอร์โทรศัพท์</label>
        <input type="tel" class="form-input" id="custPhone" value="${data.phone || ''}" placeholder="08X-XXX-XXXX">
      </div>
      <!-- 2.3 ช่องแสดงสัญญาที่ลูกค้าปิดไปแล้วกี่ครั้ง -->
      <div class="form-group">
        <label class="form-label">สัญญาที่ปิดไปแล้ว (ครั้ง)</label>
        <input type="number" class="form-input" id="custClosedContracts" value="${data.closedContractsCount !== undefined ? data.closedContractsCount : 0}" min="0" placeholder="0">
      </div>
    </div>

    ${editingCustomerId ? renderContractManagement(data) : renderNewContractForm()}

    <!-- Submit Buttons -->
    <div style="margin-top:24px;display:flex;gap:12px;">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:1;">ยกเลิก</button>
      <button class="btn btn-primary" onclick="saveCustomer()" style="flex:1;">💾 บันทึกข้อมูลลูกค้า</button>
    </div>
  `;

  modal.classList.add('active');
  setTimeout(() => {
    modal.querySelector('.modal-content').style.transform = 'translateY(0)';
  }, 10);
}

/* ─── New Contract Form (for new customer) ─── */
function renderNewContractForm() {
  const today = new Date().toISOString().split('T')[0];
  return `
    <div class="contract-management">
      <h4>📄 ข้อมูลสัญญาแรก (สามารถเพิ่มได้ทันที)</h4>
      
      <!-- 2.6 ชื่อที่ลูกค้ากำลังผ่อนคืออะไร เช่น กู้ ผ่อนทอง -->
      <div class="form-group">
        <label class="form-label">ชื่อสัญญา / สิ่งที่ผ่อน (เช่น ผ่อนทอง 2 บาท, สินเชื่อส่วนบุคคล) *</label>
        <input type="text" class="form-input" id="conName" placeholder="เช่น ผ่อนทอง 2 บาท, สินเชื่อกู้เงิน">
      </div>

      <!-- 4. ตัวเลือกรอบการผ่อน (รายวัน, ราย 5 วัน, รายเดือน) -->
      <div class="form-group">
        <label class="form-label">รอบความถี่ในการผ่อนชำระ *</label>
        <div class="frequency-chips">
          <div class="frequency-chip" id="chip_con_daily" onclick="selectFormFrequency('daily', 'con')">☀️ ผ่อนรายวัน</div>
          <div class="frequency-chip" id="chip_con_every_5_days" onclick="selectFormFrequency('every_5_days', 'con')">🗓️ ผ่อนราย 5 วัน</div>
          <div class="frequency-chip active" id="chip_con_monthly" onclick="selectFormFrequency('monthly', 'con')">📅 ผ่อนรายเดือน</div>
        </div>
        <input type="hidden" id="conPaymentFrequency" value="monthly">
      </div>

      <!-- กำหนดวันจ่ายในแต่ละเดือน (เฉพาะรายเดือน) -->
      <div class="form-group" id="conDueDayGroup">
        <label class="form-label">กำหนดวันจ่ายของทุกเดือน (เช่น วันที่ 1, 5, 15, 28) 📅</label>
        <input type="number" class="form-input" id="conDueDay" min="1" max="31" value="1" placeholder="เช่น 1 หรือ 15 หรือ 28">
        <small style="color:var(--text-muted);font-size:0.72rem;">ระบุวันที่ 1 - 31 ที่ลูกค้าต้องชำระในแต่ละเดือน</small>
      </div>

      <!-- 2.1 ยอดรวมทั้งหมด & จำนวนงวด -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">ยอดรวมทั้งหมด (บาท) *</label>
          <input type="number" class="form-input" id="conTotalAmount" placeholder="เช่น 60000" oninput="autoCalculateInstallment()">
        </div>
        <div class="form-group">
          <label class="form-label">จำนวนงวดทั้งหมด *</label>
          <input type="number" class="form-input" id="conTotalInstallments" placeholder="เช่น 12" oninput="autoCalculateInstallment()">
        </div>
      </div>

      <div class="form-row">
        <!-- 6.2 ยอดงวดที่ต้องชำระ -->
        <div class="form-group">
          <label class="form-label">ยอดต่องวด (บาท) *</label>
          <input type="number" class="form-input" id="conInstallmentAmount" placeholder="เช่น 5000">
        </div>
        <!-- 2.2 สัญญากี่ ปี/เดือน -->
        <div class="form-group">
          <label class="form-label">ระยะสัญญา (เดือน)</label>
          <input type="number" class="form-input" id="conDurationMonths" placeholder="เช่น 12">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">วันเริ่มสัญญา *</label>
          <input type="date" class="form-input" id="conStartDate" value="${today}">
        </div>
        <!-- 2.5.2 & 3. ผ่อนแล้วกี่งวด -->
        <div class="form-group">
          <label class="form-label">ผ่อนไปแล้วกี่งวด (งวดที่ชำระแล้ว)</label>
          <input type="number" class="form-input" id="conPaidCount" value="0" min="0" placeholder="0">
        </div>
      </div>
    </div>
  `;
}

function selectFormFrequency(freq, prefix) {
  const hiddenInput = document.getElementById(prefix === 'con' ? 'conPaymentFrequency' : 'modalConPaymentFrequency');
  if (hiddenInput) hiddenInput.value = freq;

  const dailyChip = document.getElementById(`chip_${prefix}_daily`);
  const fiveDaysChip = document.getElementById(`chip_${prefix}_every_5_days`);
  const monthlyChip = document.getElementById(`chip_${prefix}_monthly`);
  const dueDayGroup = document.getElementById(prefix === 'con' ? 'conDueDayGroup' : 'modalConDueDayGroup');

  if (dailyChip) dailyChip.classList.toggle('active', freq === 'daily');
  if (fiveDaysChip) fiveDaysChip.classList.toggle('active', freq === 'every_5_days');
  if (monthlyChip) monthlyChip.classList.toggle('active', freq === 'monthly');

  if (dueDayGroup) {
    dueDayGroup.style.display = freq === 'monthly' ? 'block' : 'none';
  }
}

function autoCalculateInstallment() {
  const total = parseFloat(document.getElementById('conTotalAmount')?.value);
  const installments = parseInt(document.getElementById('conTotalInstallments')?.value);
  const installmentAmountInput = document.getElementById('conInstallmentAmount');
  const durationInput = document.getElementById('conDurationMonths');

  if (total && installments && installments > 0) {
    if (installmentAmountInput && !installmentAmountInput.value) {
      installmentAmountInput.value = Math.round(total / installments);
    }
    if (durationInput && !durationInput.value) {
      durationInput.value = installments;
    }
  }
}

/* ─── Contract Management (for existing customer) ─── */
function renderContractManagement(customer) {
  const contracts = customer.contracts || [];

  let html = `
    <div class="contract-management">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h4 style="margin:0;">📄 สัญญาทั้งหมด (${contracts.length} รายการ)</h4>
        <button class="btn btn-primary btn-sm" onclick="openAddContractModal()" style="width:auto;padding:6px 14px;font-size:0.78rem;">
          ➕ เพิ่มสัญญาใหม่
        </button>
      </div>
  `;

  if (contracts.length === 0) {
    html += '<p style="font-size:0.85rem;color:var(--text-muted);text-align:center;padding:16px;">ยังไม่มีสัญญา กดปุ่ม "เพิ่มสัญญาใหม่" เพื่อสร้างสัญญา</p>';
  }

  contracts.forEach((contract, cIdx) => {
    const stats = FinanceDB.getContractStats(contract);
    html += `
      <div class="contract-mini-card">
        <div class="contract-mini-header">
          <h5>${contract.name} ${stats && stats.isCompleted ? '✅ (ปิดสัญญาแล้ว)' : ''}</h5>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openEditContractModal('${contract.id}')" style="width:auto;padding:5px 10px;font-size:0.75rem;" title="แก้ไขสัญญา">✏️</button>
            <button class="btn btn-secondary btn-sm delete" onclick="event.stopPropagation();deleteContractConfirm('${contract.id}', '${contract.name}')" style="width:auto;padding:5px 10px;font-size:0.75rem;" title="ลบสัญญา">🗑️</button>
          </div>
        </div>
        <div class="contract-mini-stats">
          <span class="contract-mini-stat">ยอดรวม: <strong>${FinanceDB.formatCurrency(contract.totalAmount)} ฿</strong></span>
          <span class="contract-mini-stat">ผ่อนแล้ว: <strong>${stats ? stats.paidCount : 0}/${stats ? stats.totalInstallments : 0} งวด</strong></span>
          <span class="contract-mini-stat">ยอดคงเหลือ: <strong>${stats ? FinanceDB.formatCurrency(stats.remainingAmount) : 0} ฿</strong></span>
          <span class="contract-mini-stat">ระยะเวลา: <strong>${FinanceDB.formatDuration(contract.durationMonths)}</strong></span>
        </div>
        
        <!-- รายการงวด และเปลี่ยนสถานะงวดแต่ละงวด -->
        <div class="installment-manage-list" style="margin-top:12px;">
          <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;">
            จัดการสถานะแต่ละงวด (รอชำระ / ชำระแล้ว):
          </div>
          ${contract.installments.map(inst => `
            <div class="installment-manage-item">
              <span class="inst-num">#${inst.number}</span>
              <div class="inst-info">
                <span class="inst-date">📅 ${FinanceDB.formatDate(inst.dueDate)}</span>
                <span class="inst-amt">ยอด: ${FinanceDB.formatCurrency(inst.amount)} ฿</span>
              </div>
              <select onchange="changeInstallmentStatus('${contract.id}', ${inst.number}, this.value)" style="padding:4px 8px;font-size:0.8rem;border-radius:var(--radius-sm);background:var(--bg-dark);color:${inst.status === 'paid' ? 'var(--success)' : 'var(--text-muted)'};border:1px solid ${inst.status === 'paid' ? 'var(--success)' : 'var(--glass-border)'};">
                <option value="pending" ${inst.status === 'pending' ? 'selected' : ''}>— รอชำระ</option>
                <option value="paid" ${inst.status === 'paid' ? 'selected' : ''}>✅ ชำระแล้ว (สมบูรณ์)</option>
              </select>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

/* ─── Profile Image Handler ─── */
function handleProfileImage(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('รูปภาพต้องมีขนาดไม่เกิน 2MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('profilePreview').src = e.target.result;
    document.getElementById('profileImageData').value = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ─── Save Customer ─── */
function saveCustomer() {
  const name = document.getElementById('custName').value.trim();
  const email = document.getElementById('custEmail').value.trim();
  const password = document.getElementById('custPassword').value;
  const phone = document.getElementById('custPhone').value.trim();
  const profileImage = document.getElementById('profileImageData').value;
  const closedContractsCount = parseInt(document.getElementById('custClosedContracts')?.value) || 0;

  if (!name || !email || !password) {
    showToast('กรุณากรอกชื่อ อีเมล และรหัสผ่าน', 'error');
    return;
  }

  // Check email duplicate
  const existingByEmail = FinanceDB.getCustomerByEmail(email);
  if (existingByEmail && existingByEmail.id !== editingCustomerId) {
    showToast('อีเมลนี้ถูกใช้งานแล้วในระบบ', 'error');
    return;
  }

  const customerData = { name, email, password, phone, profileImage, closedContractsCount };

  if (editingCustomerId) {
    // Update existing customer
    FinanceDB.updateCustomer(editingCustomerId, customerData);
    showToast('บันทึกข้อมูลลูกค้าสำเร็จ!', 'success');
  } else {
    // Add new customer
    const newCustomer = FinanceDB.addCustomer(customerData);

    // Check if contract data is filled
    const conName = document.getElementById('conName')?.value.trim();
    const conTotalAmount = parseFloat(document.getElementById('conTotalAmount')?.value);
    const conTotalInstallments = parseInt(document.getElementById('conTotalInstallments')?.value);
    const conInstallmentAmount = parseFloat(document.getElementById('conInstallmentAmount')?.value);
    const conDurationMonths = parseInt(document.getElementById('conDurationMonths')?.value);
    const conStartDate = document.getElementById('conStartDate')?.value;
    const conPaidCount = parseInt(document.getElementById('conPaidCount')?.value) || 0;
    const conPaymentFrequency = document.getElementById('conPaymentFrequency')?.value || 'monthly';
    const conDueDay = parseInt(document.getElementById('conDueDay')?.value) || 1;

    if (conName && conTotalAmount && conTotalInstallments && conInstallmentAmount && conStartDate) {
      FinanceDB.addContract(newCustomer.id, {
        name: conName,
        totalAmount: conTotalAmount,
        totalInstallments: conTotalInstallments,
        installmentAmount: conInstallmentAmount,
        durationMonths: conDurationMonths || conTotalInstallments,
        startDate: conStartDate,
        paymentFrequency: conPaymentFrequency,
        dueDay: conDueDay,
        paidCount: conPaidCount
      });
    }

    showToast('เพิ่มลูกค้าและสัญญาใหม่สำเร็จ!', 'success');
  }

  closeModal();
  renderStats();
  renderCustomerList();
}

/* ─── Delete Customer ─── */
function deleteCustomerConfirm(customerId, name) {
  if (confirm(`ต้องการลบลูกค้า "${name}" ใช่หรือไม่?\nข้อมูลสัญญาและการชำระเงินทั้งหมดจะถูกลบถาวร`)) {
    FinanceDB.deleteCustomer(customerId);
    showToast('ลบข้อมูลลูกค้าสำเร็จ', 'success');
    renderStats();
    renderCustomerList();
  }
}

/* ─── Add Contract Modal (for existing customer) ─── */
function openAddContractModal() {
  closeModal();

  setTimeout(() => {
    const modal = document.getElementById('contractModal');
    editingContractId = null;
    const today = new Date().toISOString().split('T')[0];

    modal.querySelector('.modal-title').textContent = 'เพิ่มสัญญาใหม่';
    modal.querySelector('.modal-body').innerHTML = `
      <div class="form-group">
        <label class="form-label">ชื่อสัญญา / สิ่งที่ผ่อน (เช่น ผ่อนทอง 2 บาท) *</label>
        <input type="text" class="form-input" id="modalConName" placeholder="เช่น ผ่อนทอง 2 บาท, สินเชื่อส่วนบุคคล" required>
      </div>

      <!-- 4. ตัวเลือกรอบการผ่อน -->
      <div class="form-group">
        <label class="form-label">รอบความถี่ในการผ่อนชำระ *</label>
        <div class="frequency-chips">
          <div class="frequency-chip" id="chip_modal_daily" onclick="selectFormFrequency('daily', 'modal')">☀️ ผ่อนรายวัน</div>
          <div class="frequency-chip" id="chip_modal_every_5_days" onclick="selectFormFrequency('every_5_days', 'modal')">🗓️ ผ่อนราย 5 วัน</div>
          <div class="frequency-chip active" id="chip_modal_monthly" onclick="selectFormFrequency('monthly', 'modal')">📅 ผ่อนรายเดือน</div>
        </div>
        <input type="hidden" id="modalConPaymentFrequency" value="monthly">
      </div>

      <!-- กำหนดวันจ่ายในแต่ละเดือน -->
      <div class="form-group" id="modalConDueDayGroup">
        <label class="form-label">กำหนดวันจ่ายของทุกเดือน (เช่น วันที่ 1, 5, 15, 28) 📅</label>
        <input type="number" class="form-input" id="modalConDueDay" min="1" max="31" value="1" placeholder="1">
        <small style="color:var(--text-muted);font-size:0.72rem;">ระบุวันที่ 1 - 31 ที่ลูกค้าต้องชำระในแต่ละเดือน</small>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">ยอดรวมทั้งหมด (บาท) *</label>
          <input type="number" class="form-input" id="modalConTotal" placeholder="60000" required oninput="autoCalculateModalInstallment()">
        </div>
        <div class="form-group">
          <label class="form-label">จำนวนงวดทั้งหมด *</label>
          <input type="number" class="form-input" id="modalConInstallments" placeholder="12" required oninput="autoCalculateModalInstallment()">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">ยอดต่องวด (บาท) *</label>
          <input type="number" class="form-input" id="modalConPerInstallment" placeholder="5000" required>
        </div>
        <div class="form-group">
          <label class="form-label">ระยะสัญญา (เดือน)</label>
          <input type="number" class="form-input" id="modalConDuration" placeholder="12">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">วันเริ่มสัญญา *</label>
          <input type="date" class="form-input" id="modalConStartDate" value="${today}" required>
        </div>
        <div class="form-group">
          <label class="form-label">ผ่อนไปแล้วกี่งวด</label>
          <input type="number" class="form-input" id="modalConPaidCount" value="0" min="0" placeholder="0">
        </div>
      </div>

      <div style="margin-top:24px;display:flex;gap:12px;">
        <button class="btn btn-secondary" onclick="closeContractModal();openEditCustomerModal('${editingCustomerId}');" style="flex:1;">ยกเลิก</button>
        <button class="btn btn-primary" onclick="saveContract()" style="flex:1;">💾 บันทึกสัญญา</button>
      </div>
    `;

    modal.classList.add('active');
  }, 300);
}

function autoCalculateModalInstallment() {
  const total = parseFloat(document.getElementById('modalConTotal')?.value);
  const installments = parseInt(document.getElementById('modalConInstallments')?.value);
  const perInstallment = document.getElementById('modalConPerInstallment');
  const duration = document.getElementById('modalConDuration');

  if (total && installments && installments > 0) {
    if (perInstallment && !perInstallment.value) perInstallment.value = Math.round(total / installments);
    if (duration && !duration.value) duration.value = installments;
  }
}

/* ─── Edit Contract Modal ─── */
function openEditContractModal(contractId) {
  const customer = FinanceDB.getCustomer(editingCustomerId);
  if (!customer) return;

  const contract = (customer.contracts || []).find(c => c.id === contractId);
  if (!contract) return;

  closeModal();
  editingContractId = contractId;

  const freq = contract.paymentFrequency || 'monthly';
  const dueDay = contract.dueDay || 1;

  setTimeout(() => {
    const modal = document.getElementById('contractModal');

    modal.querySelector('.modal-title').textContent = 'แก้ไขสัญญา: ' + contract.name;
    modal.querySelector('.modal-body').innerHTML = `
      <div class="form-group">
        <label class="form-label">ชื่อสัญญา / สิ่งที่ผ่อน *</label>
        <input type="text" class="form-input" id="modalConName" value="${contract.name}" required>
      </div>

      <!-- 4. ตัวเลือกรอบการผ่อน -->
      <div class="form-group">
        <label class="form-label">รอบความถี่ในการผ่อนชำระ *</label>
        <div class="frequency-chips">
          <div class="frequency-chip ${freq === 'daily' ? 'active' : ''}" id="chip_modal_daily" onclick="selectFormFrequency('daily', 'modal')">☀️ ผ่อนรายวัน</div>
          <div class="frequency-chip ${freq === 'every_5_days' ? 'active' : ''}" id="chip_modal_every_5_days" onclick="selectFormFrequency('every_5_days', 'modal')">🗓️ ผ่อนราย 5 วัน</div>
          <div class="frequency-chip ${freq === 'monthly' ? 'active' : ''}" id="chip_modal_monthly" onclick="selectFormFrequency('monthly', 'modal')">📅 ผ่อนรายเดือน</div>
        </div>
        <input type="hidden" id="modalConPaymentFrequency" value="${freq}">
      </div>

      <!-- กำหนดวันจ่ายในแต่ละเดือน -->
      <div class="form-group" id="modalConDueDayGroup" style="display:${freq === 'monthly' ? 'block' : 'none'};">
        <label class="form-label">กำหนดวันจ่ายของทุกเดือน (เช่น วันที่ 1, 5, 15, 28) 📅</label>
        <input type="number" class="form-input" id="modalConDueDay" min="1" max="31" value="${dueDay}">
        <small style="color:var(--text-muted);font-size:0.72rem;">ระบุวันที่ 1 - 31 ที่ลูกค้าต้องชำระในแต่ละเดือน</small>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">ยอดรวมทั้งหมด (บาท) *</label>
          <input type="number" class="form-input" id="modalConTotal" value="${contract.totalAmount}" required>
        </div>
        <div class="form-group">
          <label class="form-label">จำนวนงวดทั้งหมด *</label>
          <input type="number" class="form-input" id="modalConInstallments" value="${contract.totalInstallments}" required>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">ยอดต่องวด (บาท) *</label>
          <input type="number" class="form-input" id="modalConPerInstallment" value="${contract.installmentAmount}" required>
        </div>
        <div class="form-group">
          <label class="form-label">ระยะสัญญา (เดือน)</label>
          <input type="number" class="form-input" id="modalConDuration" value="${contract.durationMonths || contract.totalInstallments}">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">วันเริ่มสัญญา *</label>
        <input type="date" class="form-input" id="modalConStartDate" value="${contract.startDate}" required>
      </div>

      <div style="margin-top:24px;display:flex;gap:12px;">
        <button class="btn btn-secondary" onclick="closeContractModal();openEditCustomerModal('${editingCustomerId}');" style="flex:1;">ยกเลิก</button>
        <button class="btn btn-primary" onclick="saveContract()" style="flex:1;">💾 บันทึกการแก้ไข</button>
      </div>
    `;

    modal.classList.add('active');
  }, 300);
}

/* ─── Save Contract ─── */
function saveContract() {
  const name = document.getElementById('modalConName').value.trim();
  const totalAmount = parseFloat(document.getElementById('modalConTotal').value);
  const totalInstallments = parseInt(document.getElementById('modalConInstallments').value);
  const installmentAmount = parseFloat(document.getElementById('modalConPerInstallment').value);
  const durationMonths = parseInt(document.getElementById('modalConDuration').value) || totalInstallments;
  const startDate = document.getElementById('modalConStartDate').value;
  const paidCount = parseInt(document.getElementById('modalConPaidCount')?.value) || 0;
  const paymentFrequency = document.getElementById('modalConPaymentFrequency')?.value || 'monthly';
  const dueDay = parseInt(document.getElementById('modalConDueDay')?.value) || 1;

  if (!name || !totalAmount || !totalInstallments || !installmentAmount || !startDate) {
    showToast('กรุณากรอกข้อมูลสัญญาให้ครบถ้วน', 'error');
    return;
  }

  const contractData = {
    name,
    totalAmount,
    totalInstallments,
    installmentAmount,
    durationMonths,
    startDate,
    paymentFrequency,
    dueDay,
    paidCount
  };

  if (editingContractId) {
    // Preserve existing installments status if total installments & frequency unchanged
    const customer = FinanceDB.getCustomer(editingCustomerId);
    const existing = (customer.contracts || []).find(c => c.id === editingContractId);
    if (existing && existing.totalInstallments === totalInstallments && existing.paymentFrequency === paymentFrequency && existing.dueDay === dueDay) {
      contractData.installments = existing.installments.map(inst => ({
        ...inst,
        amount: installmentAmount
      }));
    } else {
      contractData.installments = FinanceDB.generateInstallments(contractData);
    }
    FinanceDB.updateContract(editingCustomerId, editingContractId, contractData);
    showToast('แก้ไขสัญญาสำเร็จ', 'success');
  } else {
    FinanceDB.addContract(editingCustomerId, contractData);
    showToast('เพิ่มสัญญาสำเร็จ', 'success');
  }

  closeContractModal();
  renderStats();
  renderCustomerList();

  setTimeout(() => {
    openEditCustomerModal(editingCustomerId);
  }, 300);
}

/* ─── Delete Contract ─── */
function deleteContractConfirm(contractId, name) {
  if (confirm(`ต้องการลบสัญญา "${name}" ใช่หรือไม่?`)) {
    FinanceDB.deleteContract(editingCustomerId, contractId);
    showToast('ลบสัญญาสำเร็จ', 'success');
    renderStats();
    renderCustomerList();

    closeModal();
    setTimeout(() => openEditCustomerModal(editingCustomerId), 300);
  }
}

/* ─── Change Installment Status ─── */
function changeInstallmentStatus(contractId, installmentNumber, status) {
  FinanceDB.setInstallmentStatus(editingCustomerId, contractId, installmentNumber, status);
  showToast(`อัพเดทงวดที่ ${installmentNumber} เป็น ${status === 'paid' ? 'ชำระแล้ว' : 'รอชำระ'} สำเร็จ`, 'success');
  renderStats();
  renderCustomerList();
}

/* ─── Settings Modal (ข้อมูลติดต่อ, QR ร้าน, Bank API & Cloud Sync) ─── */
function openSettingsModal() {
  const settings = FinanceDB.getSettings();
  const modal = document.getElementById('settingsModal');
  const body = document.getElementById('settingsModalBody');

  const shopQrImg = settings.shopQrImage || '';
  const bankConfig = settings.bankApiConfig || {};

  body.innerHTML = `
    <!-- 1. ข้อมูลร้านค้า / บริษัท -->
    <div class="settings-section">
      <div class="settings-section-title">🏪 ข้อมูลผู้ให้บริการ / บริษัท</div>
      <div class="form-group">
        <label class="form-label">ชื่อผู้ให้บริการ / ร้านค้า</label>
        <input type="text" class="form-input" id="setCompanyName" value="${settings.companyName || 'Finance Pro'}">
      </div>
    </div>

    <!-- 2. รูป QR Code ร้านค้า (สำหรับลูกค้าสแกนจ่ายโดยตรง) -->
    <div class="settings-section">
      <div class="settings-section-title">🖼️ รูป QR Code ร้านค้า (สำหรับลูกค้าสแกนจ่ายโดยตรง)</div>
      <div class="qr-upload-box">
        <div class="qr-preview-container" id="shopQrPreviewBox">
          ${shopQrImg 
            ? `<img src="${shopQrImg}" id="shopQrPreviewImg" alt="QR ร้าน">` 
            : `<div class="qr-placeholder" id="shopQrPlaceholder">ยังไม่มีรูป QR ร้าน<br><small>(จะใช้ QR พร้อมเพย์มาตรฐาน)</small></div>`
          }
        </div>
        <div class="qr-upload-controls">
          <input type="hidden" id="shopQrImageData" value="${shopQrImg}">
          <div class="btn-upload-qr btn btn-secondary btn-sm" style="margin-bottom:8px;">
            📷 เลือกรูป QR Code ร้าน
            <input type="file" accept="image/*" onchange="handleShopQrUpload(this)">
          </div>
          ${shopQrImg ? `
            <button type="button" class="btn btn-secondary btn-sm" onclick="clearShopQrImage()" style="display:block;color:var(--error);border-color:rgba(239,68,68,0.3);">
              🗑️ ลบรูป QR (ใช้พร้อมเพย์มาตรฐาน)
            </button>
          ` : ''}
          <p style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;">
            อัพโหลดรูป QR ร้านค้าของคุณเอง รูปนี้จะไปแสดงในหน้าชำระเงินของลูกค้าให้สแกนได้ทันที
          </p>
        </div>
      </div>
    </div>

    <!-- 3. ระบบตรวจสลิปอัตโนมัติ (Bank API Architecture) -->
    <div class="settings-section">
      <div class="settings-section-title">🏦 ระบบตรวจสลิปโอนเงินอัตโนมัติ (Bank API)</div>
      <div class="form-group">
        <label class="form-label">ผู้ให้บริการตรวจสอบสลิป (Provider)</label>
        <select class="form-input" id="setBankProvider">
          <option value="mock" ${bankConfig.provider === 'mock' || !bankConfig.provider ? 'selected' : ''}>🧪 Mock Mode (จำลองทดสอบสลิปผ่านได้ทันที)</option>
          <option value="slipok" ${bankConfig.provider === 'slipok' ? 'selected' : ''}>⚡ SlipOK API (ตรวจสอบผ่าน SlipOK Gateway)</option>
          <option value="easyslip" ${bankConfig.provider === 'easyslip' ? 'selected' : ''}>🚀 EasySlip API (ระบบตรวจสลิปอัตโนมัติ)</option>
          <option value="bank_direct" ${bankConfig.provider === 'bank_direct' ? 'selected' : ''}>🏢 ธนาคารโดยตรง (Direct Open Banking API)</option>
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">API Key / Secret Token</label>
          <input type="password" class="form-input" id="setBankApiKey" value="${bankConfig.apiKey || ''}" placeholder="ใส่ API Key จากผู้ให้บริการ">
        </div>
        <div class="form-group">
          <label class="form-label">Branch ID / Merchant ID</label>
          <input type="text" class="form-input" id="setBankBranchId" value="${bankConfig.branchId || ''}" placeholder="เช่น สาขาหรือรหัสร้านค้า">
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-top:4px;">
        <input type="checkbox" id="setBankAutoApprove" ${bankConfig.autoApprove ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
        <label for="setBankAutoApprove" style="font-size:0.84rem;cursor:pointer;color:var(--text-secondary);">
          ✅ ตรวจสลิปถูกต้องแล้ว ปรับสถานะเป็น "จ่ายแล้ว" ทันทีอัตโนมัติ
        </label>
      </div>
    </div>

    <!-- 4. ข้อมูลติดต่อ & LINE Official & LINE Login Redirect -->
    <div class="settings-section">
      <div class="settings-section-title">📞 ข้อมูลติดต่อ & LINE Official</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">เบอร์โทรศัพท์เจ้าหน้าที่</label>
          <input type="tel" class="form-input" id="setContactPhone" value="${settings.contactPhone || '02-123-4567'}">
        </div>
        <div class="form-group">
          <label class="form-label">LINE Official ID (สำหรับปุ่มติดต่อ)</label>
          <input type="text" class="form-input" id="setContactLine" value="${settings.contactLine || '@financepro'}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">LINE Login Channel ID (สำหรับเด้งเข้าแอป LINE)</label>
          <input type="text" class="form-input" id="setLineChannelId" value="${settings.lineChannelId || ''}" placeholder="เช่น 2001234567">
        </div>
        <div class="form-group">
          <label class="form-label">LINE Callback URL</label>
          <input type="text" class="form-input" id="setLineCallbackUrl" value="${settings.lineCallbackUrl || window.location.origin + window.location.pathname.replace('admin.html', 'index.html')}" placeholder="URL หน้า Login">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">อีเมลติดต่อร้าน</label>
        <input type="email" class="form-input" id="setContactEmail" value="${settings.contactEmail || 'contact@financepro.com'}">
      </div>
    </div>

    <!-- 5. พร้อมเพย์มาตรฐาน -->
    <div class="settings-section">
      <div class="settings-section-title">📱 ข้อมูลพร้อมเพย์ (บัญชีรับเงิน)</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">หมายเลขพร้อมเพย์ (เบอร์โทร/เลขบัตร)</label>
          <input type="text" class="form-input" id="setPromptpayId" value="${settings.promptpayId || '0812345678'}">
        </div>
        <div class="form-group">
          <label class="form-label">ชื่อบัญชีรับเงิน</label>
          <input type="text" class="form-input" id="setPromptpayName" value="${settings.promptpayName || 'บริษัท ไฟแนนซ์โปร จำกัด'}">
        </div>
      </div>
    </div>

    <!-- 6. เชื่อมต่อระบบซิงค์หลายเครื่อง (Cloud Live Sync) -->
    <div class="settings-section">
      <div class="settings-section-title">🔄 การซิงค์ข้อมูลหลายเครื่องพร้อมกัน (Multi-Device Live Sync)</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;">
        💡 ระบบเชื่อมต่อ <strong>BroadcastChannel</strong> ซิงค์ข้อมูลแท็บ/หน้าต่างเดียวกันอัตโนมัติแบบเรียลไทม์อยู่แล้ว หากต้องการใช้ต่างอุปกรณ์ (เช่น มือถือ + คอมพิวเตอร์) สามารถระบุ Cloud Sync Endpoint ด้านล่างนี้
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <input type="checkbox" id="setCloudSyncEnabled" ${settings.cloudSyncEnabled ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
        <label for="setCloudSyncEnabled" style="font-size:0.84rem;cursor:pointer;color:var(--text-secondary);">
          เปิดใช้งาน Cloud Sync ข้ามอุปกรณ์ (Cross-Device)
        </label>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cloud Sync URL (REST / Firebase / JSONBin)</label>
          <input type="url" class="form-input" id="setCloudSyncUrl" value="${settings.cloudSyncUrl || ''}" placeholder="https://api.jsonbin.io/v3/b/... หรือ https://...firebaseio.com/finance.json">
        </div>
        <div class="form-group">
          <label class="form-label">Cloud Sync API Key (ถ้ามี)</label>
          <input type="password" class="form-input" id="setCloudSyncApiKey" value="${settings.cloudSyncApiKey || ''}" placeholder="Secret Key">
        </div>
      </div>
    </div>

    <div style="margin-top:24px;display:flex;gap:12px;">
      <button class="btn btn-secondary" onclick="closeSettingsModal()" style="flex:1;">ยกเลิก</button>
      <button class="btn btn-primary" onclick="saveSettings()" style="flex:1;">💾 บันทึกการตั้งค่า</button>
    </div>
  `;

  modal.classList.add('active');
  setTimeout(() => {
    modal.querySelector('.modal-content').style.transform = 'translateY(0)';
  }, 10);
}

function handleShopQrUpload(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 3 * 1024 * 1024) {
    showToast('รูปภาพต้องมีขนาดไม่เกิน 3MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    document.getElementById('shopQrImageData').value = dataUrl;
    const previewBox = document.getElementById('shopQrPreviewBox');
    if (previewBox) {
      previewBox.innerHTML = `<img src="${dataUrl}" id="shopQrPreviewImg" alt="QR ร้าน">`;
    }
    showToast('เลือกรูป QR ร้านค้าเรียบร้อยแล้ว', 'info');
  };
  reader.readAsDataURL(file);
}

function clearShopQrImage() {
  document.getElementById('shopQrImageData').value = '';
  const previewBox = document.getElementById('shopQrPreviewBox');
  if (previewBox) {
    previewBox.innerHTML = `<div class="qr-placeholder" id="shopQrPlaceholder">ยังไม่มีรูป QR ร้าน<br><small>(จะใช้ QR พร้อมเพย์มาตรฐาน)</small></div>`;
  }
  showToast('ลบรูป QR ร้านแล้ว จะกลับไปใช้ QR พร้อมเพย์มาตรฐาน', 'info');
}

function saveSettings() {
  const companyName = document.getElementById('setCompanyName').value.trim();
  const contactPhone = document.getElementById('setContactPhone').value.trim();
  const contactLine = document.getElementById('setContactLine').value.trim();
  const contactEmail = document.getElementById('setContactEmail').value.trim();
  const lineChannelId = document.getElementById('setLineChannelId').value.trim();
  const lineCallbackUrl = document.getElementById('setLineCallbackUrl').value.trim();
  const promptpayId = document.getElementById('setPromptpayId').value.trim();
  const promptpayName = document.getElementById('setPromptpayName').value.trim();
  const shopQrImage = document.getElementById('shopQrImageData').value;

  const bankProvider = document.getElementById('setBankProvider').value;
  const bankApiKey = document.getElementById('setBankApiKey').value.trim();
  const bankBranchId = document.getElementById('setBankBranchId').value.trim();
  const bankAutoApprove = document.getElementById('setBankAutoApprove').checked;

  const cloudSyncEnabled = document.getElementById('setCloudSyncEnabled').checked;
  const cloudSyncUrl = document.getElementById('setCloudSyncUrl').value.trim();
  const cloudSyncApiKey = document.getElementById('setCloudSyncApiKey').value.trim();

  FinanceDB.updateSettings({
    companyName,
    contactPhone,
    contactLine,
    contactEmail,
    lineChannelId,
    lineCallbackUrl,
    promptpayId,
    promptpayName,
    shopQrImage,
    bankApiConfig: {
      provider: bankProvider,
      apiKey: bankApiKey,
      branchId: bankBranchId,
      autoApprove: bankAutoApprove
    },
    cloudSyncEnabled,
    cloudSyncUrl,
    cloudSyncApiKey
  });

  showToast('บันทึกการตั้งค่าระบบเรียบร้อย!', 'success');
  closeSettingsModal();
  updateSyncBanner();
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  modal.classList.remove('active');
}

/* ─── 3. แดชบอร์ดสรุปยอด (รายวัน, รายอาทิตย์, รายเดือน) ─── */
function openSummaryDashboardModal(tab = 'daily') {
  currentSummaryTab = tab;
  const modal = document.getElementById('summaryDashboardModal');
  renderSummaryDashboardContent(tab);

  modal.classList.add('active');
  setTimeout(() => {
    modal.querySelector('.modal-content').style.transform = 'translateY(0)';
  }, 10);
}

function closeSummaryDashboardModal() {
  const modal = document.getElementById('summaryDashboardModal');
  modal.classList.remove('active');
}

function switchSummaryTab(tab) {
  currentSummaryTab = tab;
  renderSummaryDashboardContent(tab);
}

function renderSummaryDashboardContent(tab) {
  const body = document.getElementById('summaryDashboardBody');
  if (!body) return;

  const customers = FinanceDB.getCustomers();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Calculate End Date based on tab
  let filterTitle = '';
  let weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  let monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  let monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  if (tab === 'daily') {
    filterTitle = `สรุปยอดประจำวัน (${FinanceDB.formatDateLong(todayStr)})`;
  } else if (tab === 'weekly') {
    filterTitle = `สรุปยอดรอบ 7 วัน (${FinanceDB.formatDate(todayStr)} - ${FinanceDB.formatDate(weekEnd.toISOString().split('T')[0])})`;
  } else {
    filterTitle = `สรุปยอดประจำเดือน (${today.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })})`;
  }

  // Filter installments
  const matchingItems = [];

  customers.forEach(cust => {
    (cust.contracts || []).forEach(con => {
      (con.installments || []).forEach(inst => {
        const instDate = new Date(inst.dueDate);
        instDate.setHours(0, 0, 0, 0);

        let isMatch = false;
        if (tab === 'daily') {
          // Exactly today OR overdue pending
          isMatch = (inst.dueDate === todayStr) || (inst.status === 'pending' && instDate <= today);
        } else if (tab === 'weekly') {
          // Within 7 days OR overdue pending
          isMatch = (instDate >= today && instDate <= weekEnd) || (inst.status === 'pending' && instDate < today);
        } else if (tab === 'monthly') {
          // Within this month OR overdue pending
          isMatch = (instDate >= monthStart && instDate <= monthEnd) || (inst.status === 'pending' && instDate < today);
        }

        if (isMatch) {
          matchingItems.push({
            customer: cust,
            contract: con,
            installment: inst,
            frequency: con.paymentFrequency || 'monthly'
          });
        }
      });
    });
  });

  // Calculate Metrics
  let totalDue = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let paidCount = 0;
  let pendingCount = 0;

  matchingItems.forEach(item => {
    const amt = item.installment.amount || 0;
    totalDue += amt;
    if (item.installment.status === 'paid') {
      totalPaid += amt;
      paidCount++;
    } else {
      totalPending += amt;
      pendingCount++;
    }
  });

  // Group by Frequency Category
  const dailyGroup = matchingItems.filter(i => i.frequency === 'daily');
  const fiveDaysGroup = matchingItems.filter(i => i.frequency === 'every_5_days');
  const monthlyGroup = matchingItems.filter(i => i.frequency === 'monthly' || !i.frequency);

  body.innerHTML = `
    <!-- 3.1 ปุ่ม 3 หัวข้อ: รายวัน, รายอาทิตย์, รายเดือน -->
    <div class="dashboard-tabs">
      <button class="dashboard-tab-btn ${tab === 'daily' ? 'active' : ''}" onclick="switchSummaryTab('daily')">
        ☀️ สรุปรายวัน (วันนี้)
      </button>
      <button class="dashboard-tab-btn ${tab === 'weekly' ? 'active' : ''}" onclick="switchSummaryTab('weekly')">
        🗓️ สรุปรายอาทิตย์ (7 วัน)
      </button>
      <button class="dashboard-tab-btn ${tab === 'monthly' ? 'active' : ''}" onclick="switchSummaryTab('monthly')">
        📅 สรุปรายเดือน
      </button>
    </div>

    <!-- Metric Cards -->
    <div class="dashboard-metrics-grid">
      <div class="dashboard-metric-card gold">
        <div class="metric-label">💰 ยอดที่ต้องเก็บรอบนี้</div>
        <div class="metric-val">${FinanceDB.formatCurrency(totalDue)} ฿</div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">ทั้งหมด ${matchingItems.length} งวด</div>
      </div>
      <div class="dashboard-metric-card green">
        <div class="metric-label">✅ ยอดเก็บได้แล้ว (จ่ายแล้ว)</div>
        <div class="metric-val">${FinanceDB.formatCurrency(totalPaid)} ฿</div>
        <div style="font-size:0.7rem;color:var(--success);margin-top:2px;">ชำระแล้ว ${paidCount} รายการ</div>
      </div>
      <div class="dashboard-metric-card red">
        <div class="metric-label">⏳ ยอดค้างชำระ (ยังไม่จ่าย)</div>
        <div class="metric-val">${FinanceDB.formatCurrency(totalPending)} ฿</div>
        <div style="font-size:0.7rem;color:var(--warning);margin-top:2px;">รอชำระ ${pendingCount} รายการ</div>
      </div>
    </div>

    <!-- 3.2 & 4. แสดงรายชื่อลูกค้าแยกตามหมวดหมู่: รายวัน, ราย 5 วัน, รายเดือน -->
    <div style="margin-bottom:12px;font-size:0.85rem;font-weight:600;color:var(--text-secondary);">
      📋 รายชื่อลูกค้าที่ครบกำหนดในรอบนี้ (คลิกเพื่อดู/เปลี่ยนสถานะการจ่ายเงิน)
    </div>

    <!-- Category 1: ☀️ รายวัน -->
    ${renderDueCategoryGroup('☀️ ลูกค้าผ่อนรายวัน (Daily)', dailyGroup)}

    <!-- Category 2: 🗓️ ราย 5 วัน -->
    ${renderDueCategoryGroup('🗓️ ลูกค้าผ่อนราย 5 วัน (Every 5 Days)', fiveDaysGroup)}

    <!-- Category 3: 📅 รายเดือน -->
    ${renderDueCategoryGroup('📅 ลูกค้าผ่อนรายเดือน (Monthly)', monthlyGroup)}
  `;
}

function renderDueCategoryGroup(title, items) {
  let contentHtml = '';

  if (items.length === 0) {
    contentHtml = `
      <div style="padding:14px;text-align:center;font-size:0.8rem;color:var(--text-muted);">
        ไม่มีรายการครบกำหนดในหมวดหมู่นี้
      </div>
    `;
  } else {
    contentHtml = `
      <div class="due-customers-list">
        ${items.map(item => {
          const cust = item.customer;
          const con = item.contract;
          const inst = item.installment;
          const isPaid = inst.status === 'paid';
          const avatar = cust.profileImage || getDefaultAvatar(cust.name);

          return `
            <div class="due-customer-item" onclick="openQuickStatusModal('${cust.id}', '${con.id}', ${inst.number})">
              <div class="due-customer-info">
                <img src="${avatar}" alt="${cust.name}" class="due-customer-avatar">
                <div class="due-customer-meta">
                  <div class="due-customer-name">${cust.name}</div>
                  <div class="due-customer-sub">
                    <span>📄 ${con.name}</span>
                    <span>• งวด #${inst.number}</span>
                    <span>• กำหนด ${FinanceDB.formatDate(inst.dueDate)}</span>
                  </div>
                </div>
              </div>
              <div class="due-customer-amount">
                <div class="due-amount-value">${FinanceDB.formatCurrency(inst.amount)} ฿</div>
                <div style="margin-top:4px;">
                  <span class="status-badge ${isPaid ? 'paid' : 'pending'}">
                    ${isPaid ? '✅ จ่ายแล้ว' : '⏳ ยังไม่จ่าย'}
                  </span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  return `
    <div class="due-category-group">
      <div class="due-category-header">
        <div class="due-category-title">${title}</div>
        <span class="due-category-count">${items.length} รายการ</span>
      </div>
      ${contentHtml}
    </div>
  `;
}

/* ─── 3.3 Customer Quick Status Modal (ดูสถานะว่าลูกค้าจ่ายมาแล้วหรือยัง) ─── */
function openQuickStatusModal(customerId, contractId, installmentNumber) {
  const customer = FinanceDB.getCustomer(customerId);
  if (!customer) return;

  const contract = (customer.contracts || []).find(c => c.id === contractId);
  if (!contract) return;

  const inst = (contract.installments || []).find(i => i.number === installmentNumber);
  if (!inst) return;

  const isPaid = inst.status === 'paid';
  const avatar = customer.profileImage || getDefaultAvatar(customer.name);
  const modal = document.getElementById('customerQuickStatusModal');
  const body = document.getElementById('quickStatusBody');

  body.innerHTML = `
    <div class="quick-status-card">
      <div class="quick-status-header">
        <img src="${avatar}" alt="${customer.name}" class="quick-status-avatar">
        <div>
          <h4 style="margin:0;font-size:1.05rem;">${customer.name}</h4>
          <p style="margin:2px 0 0;font-size:0.78rem;color:var(--text-muted);">
            📱 ${customer.phone || '-'} | 📧 ${customer.email}
          </p>
        </div>
      </div>

      <div class="quick-status-details-grid">
        <div>
          <div style="font-size:0.7rem;color:var(--text-muted);">สัญญา</div>
          <strong style="font-size:0.85rem;">${contract.name}</strong>
        </div>
        <div>
          <div style="font-size:0.7rem;color:var(--text-muted);">รูปแบบการผ่อน</div>
          <strong style="font-size:0.85rem;color:var(--accent-light);">
            ${FinanceDB.formatFrequency(contract.paymentFrequency, contract.dueDay)}
          </strong>
        </div>
        <div>
          <div style="font-size:0.7rem;color:var(--text-muted);">งวดที่ / กำหนดชำระ</div>
          <strong style="font-size:0.85rem;">งวด #${inst.number} (${FinanceDB.formatDate(inst.dueDate)})</strong>
        </div>
        <div>
          <div style="font-size:0.7rem;color:var(--text-muted);">ยอดค่างวด</div>
          <strong style="font-size:0.95rem;color:var(--accent-light);">${FinanceDB.formatCurrency(inst.amount)} ฿</strong>
        </div>
      </div>

      <div style="margin-top:14px;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.82rem;color:var(--text-secondary);">สถานะปัจจุบัน:</span>
        <span class="status-badge ${isPaid ? 'paid' : 'pending'}" style="font-size:0.82rem;padding:4px 10px;">
          ${isPaid ? '✅ จ่ายแล้ว (สมบูรณ์)' : '⏳ ยังไม่จ่าย (รอชำระ)'}
        </span>
      </div>
      ${isPaid && inst.paidDate ? `
        <div style="font-size:0.72rem;color:var(--text-muted);text-align:right;margin-top:4px;">
          วันที่บันทึกชำระ: ${FinanceDB.formatDateLong(inst.paidDate)}
        </div>
      ` : ''}
    </div>

    <!-- Action Button to Toggle Status directly -->
    <div class="quick-status-actions">
      ${isPaid ? `
        <button class="toggle-status-btn to-pending" onclick="setQuickStatus('${customerId}', '${contractId}', ${inst.number}, 'pending')">
          ⏳ เปลี่ยนสถานะเป็น: ยังไม่จ่าย
        </button>
      ` : `
        <button class="toggle-status-btn to-paid" onclick="setQuickStatus('${customerId}', '${contractId}', ${inst.number}, 'paid')">
          ✅ ยืนยันการชำระ: จ่ายแล้ว
        </button>
      `}
    </div>
  `;

  modal.classList.add('active');
  setTimeout(() => {
    modal.querySelector('.modal-content').style.transform = 'translateY(0)';
  }, 10);
}

function setQuickStatus(customerId, contractId, installmentNumber, newStatus) {
  FinanceDB.setInstallmentStatus(customerId, contractId, installmentNumber, newStatus);
  showToast(`อัพเดทงวดที่ ${installmentNumber} เป็น ${newStatus === 'paid' ? 'ชำระแล้ว' : 'ยังไม่ชำระ'} สำเร็จ`, 'success');

  closeQuickStatusModal();

  // Refresh dashboard and admin stats
  renderStats();
  renderCustomerList();
  if (document.getElementById('summaryDashboardModal').classList.contains('active')) {
    renderSummaryDashboardContent(currentSummaryTab);
  }
}

function closeQuickStatusModal() {
  const modal = document.getElementById('customerQuickStatusModal');
  modal.classList.remove('active');
}

/* ─── 7. Sync & Transfer Modal (ส่งข้อมูลไปมือถือ & ซิงค์ข้ามเครื่อง) ─── */
function openSyncTransferModal() {
  const modal = document.getElementById('syncTransferModal');
  const body = document.getElementById('syncTransferBody');
  const settings = FinanceDB.getSettings();
  const customers = FinanceDB.getCustomers();

  body.innerHTML = `
    <!-- สถานะการซิงค์แบบสด -->
    <div style="font-size:0.84rem;color:#86efac;margin-bottom:16px;line-height:1.6;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:var(--radius-sm);padding:14px;">
      <div style="display:flex;align-items:center;gap:8px;font-size:0.95rem;font-weight:700;color:var(--success);margin-bottom:4px;">
        <span class="sync-dot" style="display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:50%;box-shadow:0 0 8px #22c55e;"></span>
        ระบบซิงค์ข้อมูลผ่านคลาวด์เปิดทำงานแล้ว (Multi-Device Active)
      </div>
      <p style="color:var(--text-secondary);font-size:0.8rem;margin-top:4px;">
        พนักงานแอดมินทุกคนไม่ว่าจะเข้าจากคอมพิวเตอร์เครื่องใด หรือเปิดผ่านมือถือ <strong>จะเห็นข้อมูลลูกค้าและสัญญาล่าสุดตรงกันทั้งหมดทันที</strong> เมื่อมีการเพิ่มหรือแก้ไขข้อมูล
      </p>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="triggerManualSync()" style="font-size:0.78rem;">
          🔄 กดซิงค์ดึงข้อมูลล่าสุดเดี๋ยวนี้
        </button>
        <button class="btn btn-secondary btn-sm" onclick="testCloudConnection()" style="font-size:0.78rem;">
          ⚡ ทดสอบเชื่อมต่อคลาวด์ (Ping Test)
        </button>
      </div>
    </div>

    <!-- ส่วนตั้งค่า Cloud Sync URL / Firebase -->
    <div class="settings-section">
      <div class="settings-section-title">☁️ ที่อยู่ฐานข้อมูลคลาวด์กลาง (Cloud Sync URL)</div>
      <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px;">
        ปัจจุบันเชื่อมต่อกับคลาวด์กลางของระบบแล้ว หากบริษัทต้องการใช้ Firebase Realtime Database ของตนเอง สามารถใส่ URL แล้วกดบันทึกได้เลย
      </p>
      <div class="form-group">
        <label class="form-label">Cloud Sync URL (สำหรับเชื่อมทุกเครื่องเข้าด้วยกัน)</label>
        <input type="url" class="form-input" id="modalCloudSyncUrl" value="${settings.cloudSyncUrl || FinanceDB.DEFAULT_CLOUD_URL}">
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="saveCloudSyncFromModal()" style="flex:1;">
          💾 บันทึกที่อยู่คลาวด์
        </button>
        <button class="btn btn-secondary btn-sm" onclick="resetToDefaultCloud()" style="font-size:0.78rem;">
          🔄 รีเซ็ตเป็นคลาวด์เริ่มต้น
        </button>
      </div>
    </div>

    <!-- สำรองข้อมูล / โอนย้ายแบบไฟล์ -->
    <div class="settings-section">
      <div class="settings-section-title">📁 สำรองข้อมูล & กู้คืนข้อมูล (Backup & Restore)</div>
      <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px;">
        ดาวน์โหลดไฟล์ข้อมูลลูกค้าและสัญญาเก็บไว้ในเครื่องเพื่อความปลอดภัย หรือนำเข้าข้อมูล
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="downloadBackupFile()" style="flex:1;">
          💾 ดาวน์โหลดไฟล์สำรอง (.json)
        </button>
        <div class="btn btn-secondary btn-sm" style="flex:1;position:relative;overflow:hidden;text-align:center;">
          📂 นำเข้าไฟล์สำรอง (.json)
          <input type="file" accept=".json" onchange="uploadRestoreFile(this)" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;">
        </div>
        <button class="btn btn-secondary btn-sm" onclick="copySyncCode()" style="flex:1;">
          📋 คัดลอก Sync Code ส่ง LINE
        </button>
      </div>
    </div>

    <div style="text-align:right;margin-top:16px;">
      <button class="btn btn-secondary btn-sm" onclick="closeSyncTransferModal()">ปิดหน้าต่าง</button>
    </div>
  `;

  modal.classList.add('active');
  setTimeout(() => {
    modal.querySelector('.modal-content').style.transform = 'translateY(0)';
  }, 10);
}

async function testCloudConnection() {
  showToast('กำลังทดสอบเชื่อมต่อฐานข้อมูลคลาวด์...', 'info');
  const success = await FinanceDB.fetchFromCloud();
  if (success) {
    showToast('🟢 เชื่อมต่อคลาวด์สำเร็จ! ข้อมูลตรงกันทุกเครื่อง', 'success');
  } else {
    showToast('⚠️ ไม่สามารถเชื่อมต่อคลาวด์ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือ URL', 'error');
  }
}

function resetToDefaultCloud() {
  const input = document.getElementById('modalCloudSyncUrl');
  if (input) input.value = FinanceDB.DEFAULT_CLOUD_URL;
  FinanceDB.updateSettings({ cloudSyncUrl: FinanceDB.DEFAULT_CLOUD_URL, cloudSyncEnabled: true });
  FinanceDB.fetchFromCloud();
  showToast('รีเซ็ตเป็นคลาวด์เริ่มต้นเรียบร้อยแล้ว', 'success');
  updateSyncBanner();
}

function closeSyncTransferModal() {
  const modal = document.getElementById('syncTransferModal');
  modal.classList.remove('active');
}

function copySyncCode() {
  const code = FinanceDB.getSyncCode();
  if (!code) {
    showToast('ไม่สามารถสร้างรหัสข้อมูลได้', 'error');
    return;
  }

  navigator.clipboard.writeText(code).then(() => {
    showToast('คัดลอกรหัสข้อมูลเรียบร้อย! นำไปส่งใน LINE แล้วเปิดวางในมือถือได้เลย', 'success');
  }).catch(() => {
    // Fallback: prompt copy
    prompt('คัดลอกรหัสข้อมูลด้านล่างนี้ไปวางในมือถือ:', code);
  });
}

function applySyncCode() {
  const textarea = document.getElementById('transferSyncCodeInput');
  const code = textarea ? textarea.value.trim() : '';

  if (!code) {
    showToast('กรุณาวางรหัสข้อมูลก่อนกดนำเข้า', 'error');
    return;
  }

  const success = FinanceDB.importFromSyncCode(code);
  if (success) {
    showToast('นำเข้าข้อมูลสำเร็จ! ข้อมูลตรงกับคอมพิวเตอร์เรียบร้อยแล้ว', 'success');
    renderStats();
    renderCustomerList();
    closeSyncTransferModal();
  } else {
    showToast('รหัสข้อมูลไม่ถูกต้อง กรุณาตรวจสอบใหม่อีกครั้ง', 'error');
  }
}

function downloadBackupFile() {
  const data = FinanceDB.exportFullData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('ดาวน์โหลดไฟล์ข้อมูลเรียบร้อยแล้ว', 'success');
}

function uploadRestoreFile(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const success = FinanceDB.importFullData(parsed);
      if (success) {
        showToast('กู้คืนข้อมูลสำเร็จเรียบร้อย!', 'success');
        renderStats();
        renderCustomerList();
        closeSyncTransferModal();
      } else {
        showToast('รูปแบบไฟล์ไม่ถูกต้อง', 'error');
      }
    } catch (err) {
      showToast('ไม่สามารถอ่านไฟล์ JSON ได้', 'error');
    }
  };
  reader.readAsText(file);
}

function saveCloudSyncFromModal() {
  const urlInput = document.getElementById('modalCloudSyncUrl');
  const url = urlInput ? urlInput.value.trim() : '';

  if (!url) {
    FinanceDB.updateSettings({ cloudSyncEnabled: false, cloudSyncUrl: '' });
    showToast('ปิดการเชื่อมต่อ Cloud Sync แล้ว', 'info');
    closeSyncTransferModal();
    updateSyncBanner();
    return;
  }

  FinanceDB.updateSettings({
    cloudSyncEnabled: true,
    cloudSyncUrl: url
  });

  FinanceDB.checkCloudSync();
  showToast('บันทึกและเปิดใช้งาน Cloud Sync เรียบร้อย!', 'success');
  closeSyncTransferModal();
  updateSyncBanner();
}

/* ─── Modal Controls ─── */
function closeModal() {
  const modal = document.getElementById('customerModal');
  modal.classList.remove('active');
}

function closeContractModal() {
  const modal = document.getElementById('contractModal');
  modal.classList.remove('active');
  editingContractId = null;
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal();
    closeContractModal();
    closeSettingsModal();
    closeSummaryDashboardModal();
    closeQuickStatusModal();
    closeSyncTransferModal();
  }
});

document.addEventListener('DOMContentLoaded', initAdmin);



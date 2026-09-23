/* ============================================
   Finance System — Admin Page Logic
   ============================================ */

let editingCustomerId = null;
let editingContractId = null;
let searchQuery = '';

function initAdmin() {
  if (!Auth.requireAdmin()) return;

  renderAdminHeader();
  renderStats();
  renderToolbar();
  renderCustomerList();
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
        <button class="btn btn-secondary btn-sm" onclick="openSettingsModal()" title="ตั้งค่าข้อมูลติดต่อ & พร้อมเพย์">
          ⚙️ ข้อมูลติดต่อ/พร้อมเพย์
        </button>
        <button class="btn btn-secondary btn-sm" onclick="Auth.logout()" title="ออกจากระบบ">
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
          <label class="form-label">ระยะสัญญา (เดือน) *</label>
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

    if (conName && conTotalAmount && conTotalInstallments && conInstallmentAmount && conStartDate) {
      FinanceDB.addContract(newCustomer.id, {
        name: conName,
        totalAmount: conTotalAmount,
        totalInstallments: conTotalInstallments,
        installmentAmount: conInstallmentAmount,
        durationMonths: conDurationMonths || conTotalInstallments,
        startDate: conStartDate,
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
          <label class="form-label">ระยะสัญญา (เดือน) *</label>
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

  setTimeout(() => {
    const modal = document.getElementById('contractModal');
    const stats = FinanceDB.getContractStats(contract);

    modal.querySelector('.modal-title').textContent = 'แก้ไขสัญญา: ' + contract.name;
    modal.querySelector('.modal-body').innerHTML = `
      <div class="form-group">
        <label class="form-label">ชื่อสัญญา / สิ่งที่ผ่อน *</label>
        <input type="text" class="form-input" id="modalConName" value="${contract.name}" required>
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
          <label class="form-label">ระยะสัญญา (เดือน) *</label>
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
    paidCount
  };

  if (editingContractId) {
    // Preserve existing installments status if total installments unchanged
    const customer = FinanceDB.getCustomer(editingCustomerId);
    const existing = (customer.contracts || []).find(c => c.id === editingContractId);
    if (existing && existing.totalInstallments === totalInstallments) {
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

/* ─── Settings Modal (ข้อมูลติดต่อ & พร้อมเพย์) ─── */
function openSettingsModal() {
  const settings = FinanceDB.getSettings();
  const modal = document.getElementById('settingsModal');
  const body = document.getElementById('settingsModalBody');

  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">ชื่อผู้ให้บริการ / บริษัท</label>
      <input type="text" class="form-input" id="setCompanyName" value="${settings.companyName || 'Finance Pro'}">
    </div>

    <!-- ข้อมูลติดต่อ (ตรงกับ 2.8 ในหน้าลูกค้า) -->
    <h4 style="margin:16px 0 8px;color:var(--accent-light);">📞 ข้อมูลติดต่อเจ้าหน้าที่ (แสดงในหน้าลูกค้า)</h4>
    <div class="form-group">
      <label class="form-label">เบอร์โทรศัพท์เจ้าหน้าที่</label>
      <input type="tel" class="form-input" id="setContactPhone" value="${settings.contactPhone || '02-123-4567'}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">LINE Official ID</label>
        <input type="text" class="form-input" id="setContactLine" value="${settings.contactLine || '@financepro'}">
      </div>
      <div class="form-group">
        <label class="form-label">อีเมลติดต่อ</label>
        <input type="email" class="form-input" id="setContactEmail" value="${settings.contactEmail || 'contact@financepro.com'}">
      </div>
    </div>

    <!-- พร้อมเพย์ (ตรงกับหน้าชำระเงิน QR Code) -->
    <h4 style="margin:16px 0 8px;color:var(--accent-light);">📱 ข้อมูลบัญชีรับเงิน / พร้อมเพย์ (สำหรับ QR Code)</h4>
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

function saveSettings() {
  const companyName = document.getElementById('setCompanyName').value.trim();
  const contactPhone = document.getElementById('setContactPhone').value.trim();
  const contactLine = document.getElementById('setContactLine').value.trim();
  const contactEmail = document.getElementById('setContactEmail').value.trim();
  const promptpayId = document.getElementById('setPromptpayId').value.trim();
  const promptpayName = document.getElementById('setPromptpayName').value.trim();

  FinanceDB.updateSettings({
    companyName,
    contactPhone,
    contactLine,
    contactEmail,
    promptpayId,
    promptpayName
  });

  showToast('บันทึกการตั้งค่าระบบเรียบร้อย!', 'success');
  closeSettingsModal();
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  modal.classList.remove('active');
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
  }
});

document.addEventListener('DOMContentLoaded', initAdmin);

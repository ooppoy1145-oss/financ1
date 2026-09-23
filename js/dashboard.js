/* ============================================
   Finance System — Customer Dashboard Logic
   ============================================ */

let currentContractIndex = 0;

function initDashboard() {
  // Require customer login
  if (!Auth.requireCustomer()) return;

  const session = Auth.getSession();
  const customer = FinanceDB.getCustomer(session.id);

  if (!customer) {
    Auth.logout();
    return;
  }

  renderHeader(customer);
  renderSummary(customer);
  renderContracts(customer);
  renderContact();
}

/* ─── Header ─── */
function renderHeader(customer) {
  const headerEl = document.getElementById('dashHeader');
  const profileImg = customer.profileImage || getDefaultAvatar(customer.name);

  headerEl.innerHTML = `
    <div class="dash-header-inner container">
      <div class="dash-profile">
        <img src="${profileImg}" alt="${customer.name}" class="dash-profile-img">
        <div class="dash-profile-info">
          <h2>${customer.name}</h2>
          <p>ยินดีต้อนรับกลับมา 👋</p>
        </div>
      </div>
      <button class="dash-logout" onclick="Auth.logout()" title="ออกจากระบบ">🚪</button>
    </div>
  `;
}

/* ─── Summary Card (กรอบใต้ชื่อ) ─── */
function renderSummary(customer) {
  const summaryEl = document.getElementById('dashSummary');
  const summary = FinanceDB.getCustomerSummary(customer.id);

  if (!summary) return;

  summaryEl.innerHTML = `
    <div class="summary-card glass-card-static animate-fade-in-up stagger-1">
      <!-- 2.1 ยอดคงเหลือรวม คือ ยอดทั้งหมดที่ลูกค้าต้องผ่อน (ลดลงเมื่อจ่าย) -->
      <div class="summary-balance">
        <div class="label">ยอดคงเหลือรวมทั้งหมดที่ต้องผ่อน</div>
        <div class="amount">${FinanceDB.formatCurrency(summary.totalRemaining)}<span class="currency"> บาท</span></div>
        <div class="balance-hint">💡 เมื่อชำระเงินแล้ว ยอดคงเหลือจะลดลงทันที</div>
      </div>

      <!-- 4. หลอดแสดงความคืบหน้าการผ่อนรวม -->
      <div class="progress-section summary-progress">
        <div class="progress-header">
          <span class="progress-label">📊 ความคืบหน้าการผ่อนรวม</span>
          <span class="progress-percent">${summary.progressPercent}% (${summary.paidInstallmentsCount}/${summary.totalInstallments} งวด)</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${summary.progressPercent}%"></div>
        </div>
      </div>

      <!-- Grid ช่องแสดงข้อมูลในกรอบ -->
      <div class="summary-grid">
        <!-- 2.2 มีช่องแสดงสัญญากี่ ปี/เดือน -->
        <div class="summary-item">
          <div class="item-value gold">${summary.contractDurationText}</div>
          <div class="item-label">📅 ระยะสัญญา (ปี/เดือน)</div>
        </div>

        <!-- 2.3 ช่องแสดงสัญญาที่ลูกค้าปิดไปแล้วกี่ครั้ง -->
        <div class="summary-item success">
          <div class="item-value">${summary.completedContracts}</div>
          <div class="item-label">🏆 ปิดสัญญาแล้ว (ครั้ง)</div>
        </div>

        <!-- 2.5.1 ในกรอบ แสดง ตอนนี้มีกี่สัญญา -->
        <div class="summary-item accent">
          <div class="item-value">${summary.totalContracts}</div>
          <div class="item-label">📋 ตอนนี้มีกี่สัญญา (กำลังผ่อน ${summary.activeContracts})</div>
        </div>

        <!-- 2.5.2 & 3. ผ่อนแล้วกี่งวด / สัญญาที่ลูกค้าจ่ายไปแล้วกี่งวด -->
        <div class="summary-item">
          <div class="item-value">${summary.paidInstallmentsCount} / ${summary.totalInstallments}</div>
          <div class="item-label">🔢 ผ่อนแล้วกี่งวด</div>
        </div>

        <!-- 2.9 แสดงชำระแล้วทั้งหมดกี่บาท -->
        <div class="summary-item success">
          <div class="item-value">${FinanceDB.formatCurrency(summary.totalPaid)}</div>
          <div class="item-label">💰 ชำระแล้วทั้งหมด (บาท)</div>
        </div>
      </div>

      <!-- 2.4 & 2.5 มีช่องแสดงที่ลูกค้าจะต้องจ่ายงวดถัดไป + ปุ่มชำระเงินตอนนี้ -->
      ${summary.nextPayment ? `
        <div class="summary-next-box animate-fade-in-up stagger-2">
          <div class="next-box-header">
            <span class="next-box-tag">📅 งวดถัดไปที่ต้องชำระ</span>
            <span class="next-contract-badge">📄 ${summary.nextPayment.contractName} (งวดที่ ${summary.nextPayment.number})</span>
          </div>
          <div class="next-box-body">
            <div class="next-box-col">
              <span class="col-label">วันครบกำหนด</span>
              <span class="col-val">${FinanceDB.formatDateLong(summary.nextPayment.dueDate)}</span>
            </div>
            <div class="next-box-col">
              <span class="col-label">ยอดที่ต้องชำระ</span>
              <span class="col-val accent-val">${FinanceDB.formatCurrency(summary.nextPayment.amount)} บาท</span>
            </div>
          </div>
          <button class="btn btn-primary next-pay-btn" onclick="goToPayment('${summary.nextPayment.contractId}', ${summary.nextPayment.number})">
            💳 ชำระเงินตอนนี้
          </button>
        </div>
      ` : `
        <div class="summary-completed-box">
          <div class="icon">🎉</div>
          <div>
            <strong>ชำระครบถ้วนแล้ว</strong>
            <p>ไม่มีงวดค้างชำระในระบบขณะนี้</p>
          </div>
        </div>
      `}
    </div>
  `;

  // Clear separate next payment container if present
  const nextEl = document.getElementById('dashNextPayment');
  if (nextEl) nextEl.innerHTML = '';
}

/* ─── 2.6 ใต้กรอบแสดงชื่อที่ลูกค้ากำลังผ่อนคืออะไร เช่น กู้ ผ่อนทอง ─── */
function renderContracts(customer) {
  const contractsEl = document.getElementById('dashContracts');
  const contracts = customer.contracts || [];

  if (contracts.length === 0) {
    contractsEl.innerHTML = `
      <div class="no-contracts glass-card-static">
        <div class="icon">📋</div>
        <h3>ยังไม่มีสัญญาในระบบ</h3>
        <p>ข้อมูลสัญญาจะแสดงเมื่อแอดมินเพิ่มข้อมูลให้</p>
      </div>
    `;
    return;
  }

  // Safety check on index
  if (currentContractIndex >= contracts.length) {
    currentContractIndex = 0;
  }

  // Contract selector tabs
  let tabsHTML = `
    <div class="contracts-section-header">
      <h3>🏷️ สิ่งที่กำลังผ่อน / สัญญาของคุณ</h3>
    </div>
    <div class="contract-tabs animate-fade-in-up stagger-3">
  `;
  contracts.forEach((contract, index) => {
    const stats = FinanceDB.getContractStats(contract);
    const isCompleted = stats && stats.isCompleted;
    tabsHTML += `
      <button class="contract-tab ${index === currentContractIndex ? 'active' : ''}" 
              onclick="switchContract(${index})">
        ${isCompleted ? '✅' : '🏷️'} ${contract.name}
      </button>
    `;
  });
  tabsHTML += '</div>';

  // Render selected contract details
  const contract = contracts[currentContractIndex];
  const stats = FinanceDB.getContractStats(contract);
  const contractHTML = renderContractDetail(contract, stats);

  contractsEl.innerHTML = tabsHTML + contractHTML;
}

function renderContractDetail(contract, stats) {
  if (!stats) return '';

  const installmentsHTML = renderInstallments(contract, stats);
  const historyHTML = renderPaymentHistory(contract);

  return `
    <div class="contract-card glass-card-static animate-fade-in-up stagger-4">
      <div class="contract-header">
        <div>
          <div class="contract-name">
            📄 ${contract.name}
          </div>
          <div style="font-size:0.75rem;color:var(--accent-light);margin-top:3px;display:flex;align-items:center;gap:4px;">
            ${FinanceDB.formatFrequency(contract.paymentFrequency, contract.dueDay)}
          </div>
        </div>
        ${stats.isCompleted 
          ? '<span class="badge badge-success">✅ ปิดสัญญาแล้ว</span>'
          : '<span class="badge badge-accent">กำลังผ่อน</span>'
        }
      </div>

      <div class="contract-stats">
        <div class="contract-stat">
          <span class="stat-value">${FinanceDB.formatDuration(contract.durationMonths)}</span>
          <span class="stat-label">ระยะสัญญา</span>
        </div>
        <div class="contract-stat">
          <span class="stat-value">${stats.paidCount}/${stats.totalInstallments}</span>
          <span class="stat-label">ผ่อนแล้ว/ทั้งหมด</span>
        </div>
        <div class="contract-stat">
          <span class="stat-value">${FinanceDB.formatCurrency(contract.installmentAmount)} ฿</span>
          <span class="stat-label">ยอดต่องวด</span>
        </div>
        <div class="contract-stat">
          <span class="stat-value">${FinanceDB.formatCurrency(contract.totalAmount)} ฿</span>
          <span class="stat-label">ยอดรวมสัญญา</span>
        </div>
      </div>

      <!-- 4. หลอดแสดงความคืบหน้าของสัญญานี้ -->
      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-label">ความคืบหน้าของสัญญา</span>
          <span class="progress-percent">${stats.progressPercent}%</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${stats.progressPercent}%"></div>
        </div>
      </div>

      <!-- 2.9 แสดงชำระแล้วทั้งหมดกี่บาทของสัญญานี้ -->
      <div class="paid-summary">
        <span class="paid-label">✅ ชำระแล้วทั้งหมด</span>
        <span class="paid-amount">${FinanceDB.formatCurrency(stats.totalPaid)} บาท</span>
      </div>

      <!-- 2.1.1 ยอดคงเหลือของสัญญา -->
      <div class="remaining-summary">
        <span class="remaining-label">⏳ ยอดคงเหลือของสัญญา</span>
        <span class="remaining-amount">${FinanceDB.formatCurrency(stats.remainingAmount)} บาท</span>
      </div>

      <!-- 5. แสดงงวดถัดไป วันที่เท่าไหร่ มีปุ่มชำระตอนนี้ -->
      ${stats.nextInstallment ? `
        <div class="next-installment-box">
          <div class="next-inst-info">
            <span class="next-inst-title">งวดถัดไป: งวดที่ ${stats.nextInstallment.number}</span>
            <span class="next-inst-date">กำหนดชำระ: ${FinanceDB.formatDateLong(stats.nextInstallment.dueDate)}</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="goToPayment('${contract.id}', ${stats.nextInstallment.number})">
            💳 ชำระงวดที่ ${stats.nextInstallment.number} (${FinanceDB.formatCurrency(stats.nextInstallment.amount)} ฿)
          </button>
        </div>
      ` : ''}
    </div>

    <!-- 6. ลงมาด้านล่างแสดงงวดทั้งหมดกี่งวด -->
    ${installmentsHTML}

    <!-- 2.7 แสดงประวัติชำระ -->
    ${historyHTML}
  `;
}

/* ─── 6. ลงมาด้านล่างแสดงงวดทั้งหมดกี่งวด ─── */
function renderInstallments(contract, stats) {
  if (!contract.installments || contract.installments.length === 0) return '';

  let html = `
    <div class="installment-section animate-fade-in-up stagger-5">
      <div class="section-header-row">
        <h3 class="section-title">📋 งวดทั้งหมด (${stats.totalInstallments} งวด)</h3>
        <span class="inst-legend">
          <span class="legend-dot green"></span> ชำระแล้ว (${stats.paidCount})
          <span class="legend-dot gray"></span> รอชำระ (${stats.pendingCount})
        </span>
      </div>
  `;

  const totalAmount = parseFloat(contract.totalAmount);

  contract.installments.forEach((inst, idx) => {
    const isPaid = inst.status === 'paid';
    const isNext = !isPaid && stats.nextInstallment && inst.number === stats.nextInstallment.number;
    const itemClass = isPaid ? 'paid' : (isNext ? 'next' : '');

    // 6.3 คำนวณยอดคงเหลือของสัญญาหลังจ่ายงวดนั้นอย่างถูกต้อง
    // ตัวอย่าง: ยอดรวม 60,000 งวดละ 5,000 -> งวด 1 เหลือ 55,000, งวด 2 เหลือ 50,000 ... งวด 12 เหลือ 0
    let cumulativePaidToThis = 0;
    for (let j = 0; j <= idx; j++) {
      cumulativePaidToThis += contract.installments[j].amount;
    }
    const remainingAfterThis = Math.max(0, totalAmount - cumulativePaidToThis);

    html += `
      <div class="installment-item ${itemClass}">
        <div class="installment-number">${inst.number}</div>
        <div class="installment-info">
          <div class="installment-date">📅 วันครบกำหนด: ${FinanceDB.formatDate(inst.dueDate)}</div>
          <!-- 6.2 บอกยอดงวดที่ต้องชำระ -->
          <div class="installment-amount">ยอดที่ต้องชำระ: <strong>${FinanceDB.formatCurrency(inst.amount)}</strong> บาท</div>
          <!-- 6.3 บอกยอดคงเหลือ -->
          <div class="installment-remaining">ยอดคงเหลือ: <strong>${FinanceDB.formatCurrency(remainingAfterThis)}</strong> บาท</div>
        </div>
        <!-- 6.1 งวดไหนที่ชำระแล้วจะขึ้นสีเขียวว่า ชำระแล้ว & 6.4 บอกสถานะ จ่ายแล้วจะขึ้นสมบูรณ์ หากยังจะขึ้น - -->
        <div class="installment-status">
          ${isPaid 
            ? `
              <div class="status-pill status-paid">
                <span class="badge badge-success">✅ ชำระแล้ว</span>
                <span class="status-subtext green">สมบูรณ์</span>
              </div>
            `
            : (isNext 
              ? `
                <div class="status-pill status-next">
                  <button class="btn btn-primary btn-xs" onclick="goToPayment('${contract.id}', ${inst.number})">
                    💳 ชำระ
                  </button>
                  <span class="status-subtext text-muted">—</span>
                </div>
              `
              : `
                <div class="status-pill status-pending">
                  <span class="status-dash">—</span>
                </div>
              `)
          }
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

/* ─── 2.7 แสดงประวัติชำระ ─── */
function renderPaymentHistory(contract) {
  if (!contract.installments) return '';

  const paidInstallments = contract.installments
    .filter(i => i.status === 'paid')
    .sort((a, b) => new Date(b.paidDate || b.dueDate) - new Date(a.paidDate || a.dueDate));

  if (paidInstallments.length === 0) return '';

  let html = `
    <div class="history-section animate-fade-in-up stagger-6">
      <h3 class="section-title">🕐 ประวัติการชำระเงิน</h3>
  `;

  paidInstallments.forEach(inst => {
    html += `
      <div class="history-item">
        <div class="history-icon">✅</div>
        <div class="history-info">
          <div class="title">ชำระงวดที่ ${inst.number} — ${contract.name}</div>
          <div class="date">วันที่ชำระ: ${FinanceDB.formatDate(inst.paidDate || inst.dueDate)}</div>
        </div>
        <div class="history-amount">+${FinanceDB.formatCurrency(inst.amount)} ฿</div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

/* ─── 2.8 ติดต่อเจ้าหน้าที่ ─── */
function renderContact() {
  const contactEl = document.getElementById('dashContact');
  const settings = FinanceDB.getSettings();

  contactEl.innerHTML = `
    <div class="contact-section animate-fade-in-up stagger-7">
      <h3 class="section-title">📞 ติดต่อเจ้าหน้าที่</h3>
      <div class="contact-card glass-card-static">
        <a href="tel:${settings.contactPhone || '021234567'}" class="contact-item">
          <div class="contact-icon">📱</div>
          <div class="contact-info">
            <div class="label">เบอร์โทรศัพท์</div>
            <div class="value">${settings.contactPhone || '-'}</div>
          </div>
          <span class="contact-action-btn">โทรออก</span>
        </a>
        <a href="https://line.me" target="_blank" rel="noopener" class="contact-item">
          <div class="contact-icon">💬</div>
          <div class="contact-info">
            <div class="label">LINE Official</div>
            <div class="value">${settings.contactLine || '-'}</div>
          </div>
          <span class="contact-action-btn">แอดไลน์</span>
        </a>
        <a href="mailto:${settings.contactEmail || 'contact@financepro.com'}" class="contact-item">
          <div class="contact-icon">📧</div>
          <div class="contact-info">
            <div class="label">อีเมล</div>
            <div class="value">${settings.contactEmail || '-'}</div>
          </div>
          <span class="contact-action-btn">ส่งอีเมล</span>
        </a>
      </div>
    </div>
  `;
}

/* ─── Actions ─── */
function switchContract(index) {
  currentContractIndex = index;
  const session = Auth.getSession();
  const customer = FinanceDB.getCustomer(session.id);
  if (customer) renderContracts(customer);
}

function goToPayment(contractId, installmentNumber) {
  window.location.href = `payment.html?contract=${contractId}&installment=${installmentNumber}`;
}

// Initialize
document.addEventListener('DOMContentLoaded', initDashboard);

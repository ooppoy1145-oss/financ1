/* ============================================
   Finance System — Payment Page Logic
   ============================================ */

function initPayment() {
  if (!Auth.requireCustomer()) return;

  const session = Auth.getSession();
  const customer = FinanceDB.getCustomer(session.id);
  if (!customer) {
    Auth.logout();
    return;
  }

  // Get URL params
  const params = new URLSearchParams(window.location.search);
  const contractId = params.get('contract');
  const installmentNumber = parseInt(params.get('installment'));

  if (!contractId || !installmentNumber) {
    window.location.href = 'dashboard.html';
    return;
  }

  const contract = (customer.contracts || []).find(c => c.id === contractId);
  if (!contract) {
    showToast('ไม่พบสัญญานี้', 'error');
    setTimeout(() => window.location.href = 'dashboard.html', 1500);
    return;
  }

  const installment = contract.installments.find(i => i.number === installmentNumber);
  if (!installment) {
    showToast('ไม่พบงวดนี้', 'error');
    setTimeout(() => window.location.href = 'dashboard.html', 1500);
    return;
  }

  if (installment.status === 'paid') {
    showToast('งวดนี้ชำระแล้ว', 'info');
    setTimeout(() => window.location.href = 'dashboard.html', 1500);
    return;
  }

  renderPaymentPage(customer, contract, installment);
}

function renderPaymentPage(customer, contract, installment) {
  const settings = FinanceDB.getSettings();
  const stats = FinanceDB.getContractStats(contract);
  const currentRemaining = stats ? stats.remainingAmount : parseFloat(contract.totalAmount);
  const remainingAfterPayment = Math.max(0, currentRemaining - installment.amount);

  // Payment info
  document.getElementById('paymentInfo').innerHTML = `
    <div class="payment-info-card glass-card-static animate-fade-in-up stagger-1">
      <div class="payment-contract-name">📄 ${contract.name}</div>
      <div class="payment-installment-number">งวดที่ ${installment.number} / ${contract.installments.length}</div>
      <div class="payment-amount-display">
        <div class="label">ยอดที่ต้องชำระ</div>
        <div class="amount">${FinanceDB.formatCurrency(installment.amount)}<span class="currency"> บาท</span></div>
      </div>
      <div class="payment-due-date">
        📅 วันครบกำหนด: <strong>${FinanceDB.formatDateLong(installment.dueDate)}</strong>
      </div>
      <div class="payment-remaining-preview" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--glass-border);display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-secondary);">
        <span>ยอดคงเหลือหลังชำระงวดนี้:</span>
        <strong style="color:var(--accent-light);">${FinanceDB.formatCurrency(remainingAfterPayment)} บาท</strong>
      </div>
    </div>
  `;

  // QR Code
  document.getElementById('qrSection').innerHTML = `
    <div class="qr-section glass-card-static animate-fade-in-up stagger-2">
      <h3>📱 สแกน QR Code เพื่อชำระเงิน</h3>
      <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;">รองรับทุกแอปธนาคาร (PromptPay)</p>
      <div class="qr-wrapper">
        <canvas id="qrCanvas" class="qr-code" width="220" height="220"></canvas>
      </div>
      <div class="qr-promptpay-info">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">
          <span>พร้อมเพย์: <strong>${settings.promptpayId || '0812345678'}</strong></span>
          <button class="btn btn-secondary btn-xs" onclick="copyPromptpay('${settings.promptpayId || '0812345678'}')" title="คัดลอกหมายเลข">
            📋 คัดลอก
          </button>
        </div>
        <p>ชื่อบัญชี: <strong>${settings.promptpayName || 'บริษัท ไฟแนนซ์โปร จำกัด'}</strong></p>
      </div>
    </div>
  `;

  // Generate QR code visual
  generateQRCode(settings.promptpayId || '0812345678', installment.amount);

  // Confirm section
  document.getElementById('confirmSection').innerHTML = `
    <div class="confirm-section animate-fade-in-up stagger-3">
      <p class="confirm-note">
        หลังจากชำระเงินผ่านแอปธนาคารแล้ว<br>
        กรุณากดปุ่ม <strong>"ยืนยันการชำระเงิน"</strong> ด้านล่าง<br>
        <span style="font-size:0.75rem;color:var(--text-muted);">ระบบจะอัพเดทสถานะเป็น "สมบูรณ์" และลดยอดคงเหลือให้อัตโนมัติ</span>
      </p>
      <button class="btn btn-success btn-lg" onclick="confirmPayment('${customer.id}', '${contract.id}', ${installment.number})">
        ✅ ยืนยันการชำระเงิน
      </button>
    </div>
  `;
}

function copyPromptpay(id) {
  navigator.clipboard.writeText(id).then(() => {
    showToast('คัดลอกหมายเลขพร้อมเพย์แล้ว: ' + id, 'success');
  }).catch(() => {
    showToast('หมายเลขพร้อมเพย์: ' + id, 'info');
  });
}

function generateQRCode(promptpayId, amount) {
  const canvas = document.getElementById('qrCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const size = 220;
  const moduleSize = 6;
  const modules = Math.floor(size / moduleSize);

  // Generate a visually realistic QR pattern
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#1a1a2e';

  // Draw finder patterns (3 corners)
  drawFinderPattern(ctx, 2, 2, moduleSize);
  drawFinderPattern(ctx, modules - 9, 2, moduleSize);
  drawFinderPattern(ctx, 2, modules - 9, moduleSize);

  // Draw timing patterns
  for (let i = 8; i < modules - 8; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(i * moduleSize, 6 * moduleSize, moduleSize, moduleSize);
      ctx.fillRect(6 * moduleSize, i * moduleSize, moduleSize, moduleSize);
    }
  }

  // Draw data area (pseudo-random based on promptpay data)
  const seed = hashString(promptpayId + amount);
  let rng = seed;

  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      // Skip finder patterns and timing
      if (isFinderArea(x, y, modules)) continue;
      if ((x === 6 || y === 6) && x < modules - 8 && y < modules - 8) continue;

      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      if (rng % 3 < 2) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
      }
    }
  }

  // Draw PromptPay logo in center
  const centerSize = 36;
  const centerX = (size - centerSize) / 2;
  const centerY = (size - centerSize) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(centerX - 4, centerY - 4, centerSize + 8, centerSize + 8);

  // Blue PromptPay-like symbol
  ctx.fillStyle = '#005BAA';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, centerSize / 2 - 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PP', size / 2, size / 2);
}

function drawFinderPattern(ctx, x, y, moduleSize) {
  // Outer
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x * moduleSize, y * moduleSize, 7 * moduleSize, 7 * moduleSize);
  // Inner white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect((x + 1) * moduleSize, (y + 1) * moduleSize, 5 * moduleSize, 5 * moduleSize);
  // Center
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect((x + 2) * moduleSize, (y + 2) * moduleSize, 3 * moduleSize, 3 * moduleSize);
}

function isFinderArea(x, y, modules) {
  // Top-left
  if (x < 9 && y < 9) return true;
  // Top-right
  if (x > modules - 10 && y < 9) return true;
  // Bottom-left
  if (x < 9 && y > modules - 10) return true;
  return false;
}

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function confirmPayment(customerId, contractId, installmentNumber) {
  const success = FinanceDB.payInstallment(customerId, contractId, installmentNumber);

  if (success) {
    // Show success overlay
    const overlay = document.getElementById('successOverlay');
    overlay.classList.add('show');

    // Redirect after delay
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 2500);
  } else {
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initPayment);

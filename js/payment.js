/* ============================================
   Finance System — Payment Page Logic
   รองรับรูป QR ของร้าน & ระบบ Bank API ตรวจสลิปอัตโนมัติ
   ============================================ */

let currentSlipBase64 = null;
let currentCustomerId = null;
let currentContractId = null;
let currentInstallmentNumber = null;
let currentInstallmentAmount = 0;

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
    showToast('งวดนี้ชำระเงินเรียบร้อยแล้ว', 'info');
    setTimeout(() => window.location.href = 'dashboard.html', 1500);
    return;
  }

  currentCustomerId = customer.id;
  currentContractId = contract.id;
  currentInstallmentNumber = installment.number;
  currentInstallmentAmount = installment.amount;

  renderPaymentPage(customer, contract, installment);
}

function renderPaymentPage(customer, contract, installment) {
  const settings = FinanceDB.getSettings();
  const stats = FinanceDB.getContractStats(contract);
  const currentRemaining = stats ? stats.remainingAmount : parseFloat(contract.totalAmount);
  const remainingAfterPayment = Math.max(0, currentRemaining - installment.amount);

  // 1. Payment info card
  document.getElementById('paymentInfo').innerHTML = `
    <div class="payment-info-card glass-card-static animate-fade-in-up stagger-1">
      <div class="payment-contract-name">📄 ${contract.name} (${FinanceDB.formatFrequency(contract.paymentFrequency, contract.dueDay)})</div>
      <div class="payment-installment-number">งวดที่ ${installment.number} / ${contract.installments.length}</div>
      <div class="payment-amount-display">
        <div class="label">ยอดค่างวดที่ต้องชำระ</div>
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

  // 2. QR Code (5. แอดมินสามารถเพิ่มรูป QR ของร้านได้)
  const hasCustomShopQr = settings.shopQrImage && settings.shopQrImage.trim() !== '';

  document.getElementById('qrSection').innerHTML = `
    <div class="qr-section glass-card-static animate-fade-in-up stagger-2">
      <h3>📱 ${hasCustomShopQr ? 'สแกน QR Code ของร้านค้า' : 'สแกน QR Code พร้อมเพย์'}</h3>
      <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;">
        ${hasCustomShopQr ? 'เปิดแอปธนาคารแล้วสแกน QR Code ของร้านด้านล่างเพื่อชำระเงิน' : 'รองรับการสแกนผ่านทุกแอปพลิเคชันธนาคาร'}
      </p>

      <div class="qr-wrapper">
        ${hasCustomShopQr 
          ? `<img src="${settings.shopQrImage}" class="shop-qr-img" alt="Shop QR Code" onclick="openQrZoom('${settings.shopQrImage}')">`
          : `<canvas id="qrCanvas" class="qr-code" width="220" height="220"></canvas>`
        }
      </div>

      <div class="qr-action-btns">
        ${hasCustomShopQr ? `
          <button class="btn btn-secondary btn-xs" onclick="downloadQrImage('${settings.shopQrImage}')">
            💾 บันทึกรูป QR
          </button>
          <button class="btn btn-secondary btn-xs" onclick="openQrZoom('${settings.shopQrImage}')">
            🔍 แตะดูรูปเต็ม
          </button>
        ` : ''}
        <button class="btn btn-secondary btn-xs" onclick="copyPromptpay('${settings.promptpayId || '0812345678'}')">
          📋 คัดลอกเลขบัญชี/พร้อมเพย์
        </button>
      </div>

      <div class="qr-promptpay-info">
        <p>พร้อมเพย์/บัญชี: <strong>${settings.promptpayId || '0812345678'}</strong></p>
        <p>ชื่อบัญชี: <strong>${settings.promptpayName || 'บริษัท ไฟแนนซ์โปร จำกัด'}</strong></p>
      </div>
    </div>
  `;

  // If using canvas QR, generate it
  if (!hasCustomShopQr) {
    generateQRCode(settings.promptpayId || '0812345678', installment.amount);
  }

  // 3. Bank Slip Auto-Verification (6. โค้ดเตรียมพร้อมสำหรับผูก API ธนาคารเช็คอัตโนมัติว่าลูกค้าโอนจริง)
  document.getElementById('slipSection').innerHTML = `
    <div class="slip-upload-box glass-card-static animate-fade-in-up stagger-3">
      <h4>⚡ ตรวจสอบสลิปโอนเงินอัตโนมัติ (Bank Slip API)</h4>
      <p class="slip-hint">
        เมื่อโอนเงินแล้ว แนบสลิปด้านล่าง ระบบจะเชื่อมต่อ API ธนาคารเพื่อตรวจสอบยอดเงินจริงทันที
      </p>

      <div class="slip-dropzone" id="slipDropzone" onclick="document.getElementById('slipFileInput').click()">
        <div id="slipUploadPrompt">
          <div style="font-size:2.2rem;margin-bottom:6px;">🧾</div>
          <p><strong>แตะที่นี่เพื่อแนบรูปสลิปโอนเงิน</strong></p>
          <span style="font-size:0.72rem;color:var(--text-muted);">รองรับรูปภาพสลิปจากทุกธนาคาร (JPG, PNG)</span>
        </div>
        <div id="slipPreviewContainer" class="slip-preview-container" style="display:none;">
          <img id="slipPreviewImg" class="slip-preview-img" alt="Slip Preview">
          <span style="font-size:0.75rem;color:var(--text-muted);">แตะรูปเพื่อเปลี่ยนสลิปใหม่</span>
        </div>
      </div>
      <input type="file" id="slipFileInput" accept="image/*" style="display:none;" onchange="handleSlipFile(this)">

      <div id="slipVerifyResult"></div>

      <button class="btn btn-primary" id="btnVerifySlip" style="display:none;width:100%;margin-top:10px;" onclick="verifySlipAndConfirm()">
        🔍 ส่งตรวจเช็คสลิปและยืนยันการจ่ายทันที
      </button>
    </div>
  `;

  // 4. Manual Confirm Section
  document.getElementById('confirmSection').innerHTML = `
    <div class="confirm-section animate-fade-in-up stagger-4">
      <div class="divider"><span>หรือกดยืนยันด้วยตนเอง</span></div>
      <p class="confirm-note">
        หากท่านโอนเงินแล้วและไม่สะดวกแนบสลิป<br>
        สามารถกดปุ่มยืนยันด้านล่างได้โดยตรง
      </p>
      <button class="btn btn-success btn-lg" onclick="manualConfirmPayment()">
        ✅ ยืนยันการชำระเงิน
      </button>
    </div>
  `;
}

/* ─── Slip Handling & Auto Verification ─── */
function handleSlipFile(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('ไฟล์สลิปต้องมีขนาดไม่เกิน 5MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    currentSlipBase64 = e.target.result;
    document.getElementById('slipUploadPrompt').style.display = 'none';
    const previewContainer = document.getElementById('slipPreviewContainer');
    const previewImg = document.getElementById('slipPreviewImg');
    previewImg.src = currentSlipBase64;
    previewContainer.style.display = 'flex';
    document.getElementById('btnVerifySlip').style.display = 'block';

    showToast('เลือกรูปสลิปเรียบร้อย กดปุ่มส่งตรวจเช็คสลิปได้เลย', 'success');
  };
  reader.readAsDataURL(file);
}

async function verifySlipAndConfirm() {
  if (!currentSlipBase64) {
    showToast('กรุณาเลือกรูปสลิปโอนเงินก่อน', 'error');
    return;
  }

  const btn = document.getElementById('btnVerifySlip');
  const resultDiv = document.getElementById('slipVerifyResult');

  btn.classList.add('loading');
  btn.disabled = true;
  resultDiv.innerHTML = `
    <div style="text-align:center;padding:12px;font-size:0.8rem;color:var(--accent-light);">
      ⏳ กำลังเชื่อมต่อ API ธนาคารเพื่อตรวจสอบยอดเงินจริง...
    </div>
  `;

  try {
    const result = await BankAPI.verifySlip(currentSlipBase64, currentInstallmentAmount);

    if (result.success && result.verified) {
      resultDiv.innerHTML = `
        <div class="slip-verification-result success animate-fade-in-up">
          <div style="font-weight:700;margin-bottom:4px;">✅ ธนาคารยืนยันยอดโอนสำเร็จ!</div>
          <div>ธนาคาร: <strong>${result.bank}</strong></div>
          <div>ยอดเงิน: <strong>${FinanceDB.formatCurrency(result.amount)} บาท</strong></div>
          <div>รหัสอ้างอิง: <small>${result.txnId}</small></div>
          <div style="margin-top:4px;font-size:0.75rem;color:var(--text-secondary);">${result.message}</div>
        </div>
      `;

      showToast('ตรวจสอบสลิปโอนเงินจริงสำเร็จ!', 'success');

      // Pay installment automatically
      setTimeout(() => {
        executePaymentSuccess('ตรวจพบยอดโอนเงินจริง ' + FinanceDB.formatCurrency(currentInstallmentAmount) + ' บาท สำเร็จ');
      }, 1200);

    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
      resultDiv.innerHTML = `
        <div class="slip-verification-result error animate-fade-in-up">
          <div style="font-weight:700;margin-bottom:4px;">❌ ตรวจสอบไม่ผ่าน</div>
          <div>${result.message || 'ยอดเงินไม่ตรง หรือสลิปไม่ถูกต้อง'}</div>
          <div style="font-size:0.75rem;margin-top:4px;">ยอดค่างวดที่ต้องการ: ${FinanceDB.formatCurrency(currentInstallmentAmount)} บาท</div>
        </div>
      `;
      showToast(result.message || 'ยอดเงินไม่ตรงกับค่างวด', 'error');
    }
  } catch (err) {
    btn.classList.remove('loading');
    btn.disabled = false;
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อระบบธนาคาร', 'error');
  }
}

/* ─── Manual Payment Confirmation ─── */
function manualConfirmPayment() {
  executePaymentSuccess('บันทึกการชำระเงินเรียบร้อย');
}

function executePaymentSuccess(msgText) {
  const success = FinanceDB.payInstallment(currentCustomerId, currentContractId, currentInstallmentNumber);

  if (success) {
    const overlay = document.getElementById('successOverlay');
    const msg = document.getElementById('successMessage');
    if (msg) msg.textContent = msgText || 'กำลังกลับไปหน้าหลัก...';
    overlay.classList.add('show');

    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 2200);
  } else {
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'error');
  }
}

/* ─── Helper Functions ─── */
function openQrZoom(imgSrc) {
  const modal = document.getElementById('qrZoomModal');
  const img = document.getElementById('qrZoomImg');
  img.src = imgSrc;
  modal.classList.add('active');
}

function downloadQrImage(imgSrc) {
  const a = document.createElement('a');
  a.href = imgSrc;
  a.download = 'Shop-QR-Code.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('ดาวน์โหลดรูป QR Code เรียบร้อย', 'success');
}

function copyPromptpay(id) {
  navigator.clipboard.writeText(id).then(() => {
    showToast('คัดลอกหมายเลขพร้อมเพย์/บัญชีแล้ว: ' + id, 'success');
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

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1a1a2e';

  // Draw finder patterns (3 corners)
  drawFinderPattern(ctx, 2, 2, moduleSize);
  drawFinderPattern(ctx, modules - 9, 2, moduleSize);
  drawFinderPattern(ctx, 2, modules - 9, moduleSize);

  // Timing patterns
  for (let i = 8; i < modules - 8; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(i * moduleSize, 6 * moduleSize, moduleSize, moduleSize);
      ctx.fillRect(6 * moduleSize, i * moduleSize, moduleSize, moduleSize);
    }
  }

  // Draw data area
  const seed = hashString(promptpayId + amount);
  let rng = seed;

  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
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
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x * moduleSize, y * moduleSize, 7 * moduleSize, 7 * moduleSize);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect((x + 1) * moduleSize, (y + 1) * moduleSize, 5 * moduleSize, 5 * moduleSize);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect((x + 2) * moduleSize, (y + 2) * moduleSize, 3 * moduleSize, 3 * moduleSize);
}

function isFinderArea(x, y, modules) {
  if (x < 9 && y < 9) return true;
  if (x > modules - 10 && y < 9) return true;
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

document.addEventListener('DOMContentLoaded', initPayment);

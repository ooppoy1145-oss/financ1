/* ============================================
   Finance System — Data Management Layer
   localStorage + Real-time Multi-Device Sync
   ============================================ */

const FinanceDB = {
  KEYS: {
    ADMIN: 'finance_admin',
    CUSTOMERS: 'finance_customers',
    SETTINGS: 'finance_settings',
    SESSION: 'finance_session'
  },

  /* ─── Real-Time Sync & Multi-Device State ─── */
  _syncListeners: [],
  _broadcastChannel: null,
  _syncPollingTimer: null,

  /* ─── Initialize ─── */
  init() {
    // Default admin account
    if (!localStorage.getItem(this.KEYS.ADMIN)) {
      localStorage.setItem(this.KEYS.ADMIN, JSON.stringify({
        email: 'admin@finance.com',
        password: 'admin123',
        name: 'ผู้ดูแลระบบ'
      }));
    }

    // Default settings
    if (!localStorage.getItem(this.KEYS.SETTINGS)) {
      localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify({
        companyName: 'Finance Pro',
        contactPhone: '02-123-4567',
        contactLine: '@financepro',
        contactEmail: 'contact@financepro.com',
        promptpayId: '0812345678',
        promptpayName: 'บริษัท ไฟแนนซ์โปร จำกัด',
        shopQrImage: '', // Custom Shop QR (Base64)
        lineChannelId: '', // LINE Login Channel ID
        lineCallbackUrl: '',
        bankApiProvider: 'slipok', // 'slipok' | 'easyslip' | 'direct' | 'mock'
        bankApiKey: '',
        bankApiSecret: '',
        cloudSyncEnabled: false,
        cloudSyncUrl: '',
        cloudSyncApiKey: ''
      }));
    }

    // Initialize customers array
    if (!localStorage.getItem(this.KEYS.CUSTOMERS)) {
      localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify([]));
      this.seedDemoData();
    }

    // Start multi-device / multi-tab sync
    this.initSync();
  },

  /* ─── Real-Time Sync & Multi-Device Engine ─── */
  initSync() {
    // 1. BroadcastChannel for cross-tab & cross-window real-time sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this._broadcastChannel = new BroadcastChannel('finance_pro_sync');
        this._broadcastChannel.onmessage = (event) => {
          this.handleIncomingSync(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    // 2. Storage event listener for window-to-window sync
    window.addEventListener('storage', (e) => {
      if (e.key === this.KEYS.CUSTOMERS || e.key === this.KEYS.SETTINGS) {
        this.notifyListeners({ type: 'storage_change', key: e.key, timestamp: Date.now() });
      }
    });

    // 3. Cloud sync polling if configured
    this.checkCloudSync();
  },

  onSync(callback) {
    if (typeof callback === 'function') {
      this._syncListeners.push(callback);
    }
  },

  notifyListeners(data) {
    this._syncListeners.forEach(cb => {
      try { cb(data); } catch (err) { console.error('Sync listener error:', err); }
    });
  },

  notifyChange(action, data) {
    const payload = { action, data, timestamp: Date.now() };

    // Broadcast to other tabs/windows
    if (this._broadcastChannel) {
      try {
        this._broadcastChannel.postMessage(payload);
      } catch (e) {}
    }

    this.notifyListeners(payload);

    // Push to cloud if enabled
    this.pushToCloud(payload);
  },

  handleIncomingSync(message) {
    this.notifyListeners(message);
  },

  /* ─── Cloud Sync (Firebase Realtime DB / REST API) ─── */
  formatCloudUrl(url) {
    if (!url) return '';
    let trimmed = url.trim();
    // Auto format Firebase Realtime DB URL
    if (trimmed.includes('firebaseio.com') && !trimmed.endsWith('.json')) {
      trimmed = trimmed.replace(/\/?$/, '/finance.json');
    }
    return trimmed;
  },

  async pushToCloud(change) {
    const settings = this.getSettings();
    if (!settings.cloudSyncEnabled || !settings.cloudSyncUrl) return;

    const url = this.formatCloudUrl(settings.cloudSyncUrl);

    try {
      const payload = {
        customers: this.getCustomers(),
        settings: this.getSettings(),
        lastUpdated: new Date().toISOString(),
        lastChange: change
      };

      await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.cloudSyncApiKey ? { 'Authorization': `Bearer ${settings.cloudSyncApiKey}` } : {})
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Cloud sync push failed:', err);
    }
  },

  async fetchFromCloud() {
    const settings = this.getSettings();
    if (!settings.cloudSyncEnabled || !settings.cloudSyncUrl) return false;

    const url = this.formatCloudUrl(settings.cloudSyncUrl);

    try {
      const res = await fetch(url, {
        headers: {
          ...(settings.cloudSyncApiKey ? { 'Authorization': `Bearer ${settings.cloudSyncApiKey}` } : {})
        }
      });
      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData && cloudData.customers) {
          localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(cloudData.customers));
          if (cloudData.settings) {
            // Keep local cloud connection active
            const mergedSettings = {
              ...cloudData.settings,
              cloudSyncEnabled: settings.cloudSyncEnabled,
              cloudSyncUrl: settings.cloudSyncUrl,
              cloudSyncApiKey: settings.cloudSyncApiKey
            };
            localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(mergedSettings));
          }
          this.notifyListeners({ type: 'cloud_pulled', timestamp: Date.now() });
          return true;
        }
      }
    } catch (err) {
      console.warn('Cloud sync fetch failed:', err);
    }
    return false;
  },

  checkCloudSync() {
    const settings = this.getSettings();
    if (settings.cloudSyncEnabled && settings.cloudSyncUrl) {
      this.fetchFromCloud();
      if (!this._syncPollingTimer) {
        // Poll every 5 seconds for fast cross-device sync
        this._syncPollingTimer = setInterval(() => {
          this.fetchFromCloud();
        }, 5000);
      }
    }
  },

  /* ─── Export / Import / Cross-Device Transfer ─── */
  exportFullData() {
    return {
      customers: this.getCustomers(),
      settings: this.getSettings(),
      admin: this.getAdmin(),
      exportDate: new Date().toISOString(),
      app: 'FinancePro',
      version: '2.0'
    };
  },

  importFullData(dataObj) {
    if (!dataObj || !Array.isArray(dataObj.customers)) return false;

    localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(dataObj.customers));
    if (dataObj.settings) {
      localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(dataObj.settings));
    }
    if (dataObj.admin) {
      localStorage.setItem(this.KEYS.ADMIN, JSON.stringify(dataObj.admin));
    }
    this.notifyChange('importedData', { timestamp: Date.now() });
    return true;
  },

  getSyncCode() {
    const data = this.exportFullData();
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    } catch (e) {
      return JSON.stringify(data);
    }
  },

  importFromSyncCode(codeStr) {
    if (!codeStr) return false;
    try {
      let parsed = null;
      codeStr = codeStr.trim();
      if (codeStr.startsWith('{')) {
        parsed = JSON.parse(codeStr);
      } else {
        const jsonStr = decodeURIComponent(escape(atob(codeStr)));
        parsed = JSON.parse(jsonStr);
      }
      return this.importFullData(parsed);
    } catch (e) {
      console.error('Failed to parse sync code:', e);
      return false;
    }
  },

  /* ─── Admin ─── */
  getAdmin() {
    return JSON.parse(localStorage.getItem(this.KEYS.ADMIN) || '{}');
  },

  updateAdmin(data) {
    const admin = this.getAdmin();
    const updated = { ...admin, ...data };
    localStorage.setItem(this.KEYS.ADMIN, JSON.stringify(updated));
    this.notifyChange('updateAdmin', updated);
    return updated;
  },

  /* ─── Settings ─── */
  getSettings() {
    return JSON.parse(localStorage.getItem(this.KEYS.SETTINGS) || '{}');
  },

  updateSettings(data) {
    const settings = this.getSettings();
    const updated = { ...settings, ...data };
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(updated));
    this.notifyChange('updateSettings', updated);
    return updated;
  },

  /* ─── Customers CRUD ─── */
  getCustomers() {
    return JSON.parse(localStorage.getItem(this.KEYS.CUSTOMERS) || '[]');
  },

  getCustomer(id) {
    return this.getCustomers().find(c => c.id === id) || null;
  },

  getCustomerByEmail(email) {
    return this.getCustomers().find(c => c.email === email.toLowerCase()) || null;
  },

  addCustomer(customerData) {
    const customers = this.getCustomers();
    const customer = {
      id: 'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      ...customerData,
      email: customerData.email.toLowerCase()
    };
    customers.push(customer);
    localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(customers));
    this.notifyChange('addCustomer', customer);
    return customer;
  },

  updateCustomer(id, data) {
    const customers = this.getCustomers();
    const index = customers.findIndex(c => c.id === id);
    if (index === -1) return null;

    if (data.email) data.email = data.email.toLowerCase();
    customers[index] = { ...customers[index], ...data };
    localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(customers));
    this.notifyChange('updateCustomer', customers[index]);
    return customers[index];
  },

  deleteCustomer(id) {
    const customers = this.getCustomers().filter(c => c.id !== id);
    localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(customers));
    this.notifyChange('deleteCustomer', id);
  },

  /* ─── Contracts ─── */
  getContracts(customerId) {
    const customer = this.getCustomer(customerId);
    return customer ? (customer.contracts || []) : [];
  },

  addContract(customerId, contractData) {
    const customer = this.getCustomer(customerId);
    if (!customer) return null;

    if (!customer.contracts) customer.contracts = [];

    const contract = {
      id: 'con_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      ...contractData,
      paymentFrequency: contractData.paymentFrequency || 'monthly',
      dueDay: contractData.dueDay ? parseInt(contractData.dueDay) : null,
      installments: this.generateInstallments(contractData)
    };

    customer.contracts.push(contract);
    this.updateCustomer(customerId, { contracts: customer.contracts });
    this.notifyChange('addContract', { customerId, contract });
    return contract;
  },

  updateContract(customerId, contractId, data) {
    const customer = this.getCustomer(customerId);
    if (!customer || !customer.contracts) return null;

    const index = customer.contracts.findIndex(c => c.id === contractId);
    if (index === -1) return null;

    customer.contracts[index] = { ...customer.contracts[index], ...data };
    this.updateCustomer(customerId, { contracts: customer.contracts });
    this.notifyChange('updateContract', { customerId, contractId, data });
    return customer.contracts[index];
  },

  deleteContract(customerId, contractId) {
    const customer = this.getCustomer(customerId);
    if (!customer || !customer.contracts) return;

    customer.contracts = customer.contracts.filter(c => c.id !== contractId);
    this.updateCustomer(customerId, { contracts: customer.contracts });
    this.notifyChange('deleteContract', { customerId, contractId });
  },

  /* ─── Installments Generation (รองรับ รายวัน, ราย 5 วัน, รายเดือน) ─── */
  generateInstallments(contractData) {
    const { 
      totalInstallments, 
      installmentAmount, 
      startDate, 
      paidCount,
      paymentFrequency = 'monthly', // 'daily' | 'every_5_days' | 'monthly'
      dueDay
    } = contractData;

    const installments = [];
    const start = new Date(startDate);
    const pCount = parseInt(paidCount) || 0;
    const count = parseInt(totalInstallments) || 1;

    for (let i = 0; i < count; i++) {
      let dueDate = new Date(start);

      if (paymentFrequency === 'daily') {
        // 4.1 รายวัน: จ่ายทุกวัน (+1 วันต่องวด)
        dueDate.setDate(dueDate.getDate() + i + 1);
      } else if (paymentFrequency === 'every_5_days') {
        // 4.2 ราย 5 วัน: จ่ายทุกๆ 5 วัน (+5 วันต่องวด)
        dueDate.setDate(dueDate.getDate() + ((i + 1) * 5));
      } else {
        // 4.3 & 4.5 รายเดือน: จ่าย 1 ครั้ง/เดือน และกำหนดวันจ่ายในเดือนได้
        dueDate.setMonth(start.getMonth() + i + 1);
        if (dueDay && parseInt(dueDay) >= 1 && parseInt(dueDay) <= 31) {
          const maxDays = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
          dueDate.setDate(Math.min(parseInt(dueDay), maxDays));
        }
      }

      const isPaid = i < pCount;
      installments.push({
        number: i + 1,
        dueDate: dueDate.toISOString().split('T')[0],
        amount: parseFloat(installmentAmount),
        status: isPaid ? 'paid' : 'pending', // 'pending' | 'paid'
        paidDate: isPaid ? dueDate.toISOString().split('T')[0] : null
      });
    }

    return installments;
  },

  payInstallment(customerId, contractId, installmentNumber) {
    const customer = this.getCustomer(customerId);
    if (!customer || !customer.contracts) return false;

    const contract = customer.contracts.find(c => c.id === contractId);
    if (!contract) return false;

    const installment = contract.installments.find(i => i.number === installmentNumber);
    if (!installment || installment.status === 'paid') return false;

    installment.status = 'paid';
    installment.paidDate = new Date().toISOString().split('T')[0];

    this.updateCustomer(customerId, { contracts: customer.contracts });
    this.notifyChange('payInstallment', { customerId, contractId, installmentNumber });
    return true;
  },

  setInstallmentStatus(customerId, contractId, installmentNumber, status) {
    const customer = this.getCustomer(customerId);
    if (!customer || !customer.contracts) return false;

    const contract = customer.contracts.find(c => c.id === contractId);
    if (!contract) return false;

    const installment = contract.installments.find(i => i.number === installmentNumber);
    if (!installment) return false;

    installment.status = status;
    if (status === 'paid') {
      installment.paidDate = installment.paidDate || new Date().toISOString().split('T')[0];
    } else {
      installment.paidDate = null;
    }

    this.updateCustomer(customerId, { contracts: customer.contracts });
    this.notifyChange('setInstallmentStatus', { customerId, contractId, installmentNumber, status });
    return true;
  },

  /* ─── Helper: Calculate Contract Stats ─── */
  getContractStats(contract) {
    if (!contract || !contract.installments) return null;

    const totalInstallments = contract.installments.length;
    const paidInstallments = contract.installments.filter(i => i.status === 'paid');
    const pendingInstallments = contract.installments.filter(i => i.status === 'pending');

    const totalAmount = parseFloat(contract.totalAmount);
    const totalPaid = paidInstallments.reduce((sum, i) => sum + i.amount, 0);
    const remainingAmount = Math.max(0, totalAmount - totalPaid);

    const nextInstallment = pendingInstallments.length > 0 
      ? pendingInstallments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0]
      : null;

    const progressPercent = totalInstallments > 0 
      ? Math.round((paidInstallments.length / totalInstallments) * 100) 
      : 0;

    return {
      totalInstallments,
      paidCount: paidInstallments.length,
      pendingCount: pendingInstallments.length,
      totalAmount,
      totalPaid,
      remainingAmount,
      nextInstallment,
      progressPercent,
      isCompleted: pendingInstallments.length === 0
    };
  },

  /* ─── Helper: Get Customer Summary ─── */
  getCustomerSummary(customerId) {
    const customer = this.getCustomer(customerId);
    if (!customer) return null;

    const contracts = customer.contracts || [];
    const activeContracts = contracts.filter(c => {
      const stats = this.getContractStats(c);
      return stats && !stats.isCompleted;
    });
    const completedContracts = contracts.filter(c => {
      const stats = this.getContractStats(c);
      return stats && stats.isCompleted;
    });

    let totalAmount = 0;
    let totalRemaining = 0;
    let totalPaid = 0;
    let totalInstallments = 0;
    let paidInstallmentsCount = 0;
    let nextPayment = null;

    contracts.forEach(c => {
      const stats = this.getContractStats(c);
      if (stats) {
        totalAmount += stats.totalAmount;
        totalRemaining += stats.remainingAmount;
        totalPaid += stats.totalPaid;
        totalInstallments += stats.totalInstallments;
        paidInstallmentsCount += stats.paidCount;

        if (stats.nextInstallment) {
          if (!nextPayment || new Date(stats.nextInstallment.dueDate) < new Date(nextPayment.dueDate)) {
            nextPayment = {
              ...stats.nextInstallment,
              contractId: c.id,
              contractName: c.name,
              frequency: c.paymentFrequency || 'monthly'
            };
          }
        }
      }
    });

    const manualClosed = parseInt(customer.closedContractsCount) || 0;
    const totalClosed = manualClosed + completedContracts.length;
    const progressPercent = totalInstallments > 0 
      ? Math.round((paidInstallmentsCount / totalInstallments) * 100) 
      : 0;

    // Duration summary text
    let contractDurationText = '-';
    if (contracts.length === 1 && contracts[0].durationMonths) {
      contractDurationText = this.formatDuration(contracts[0].durationMonths);
    } else if (contracts.length > 1) {
      const minMonths = Math.min(...contracts.map(c => c.durationMonths || 12));
      const maxMonths = Math.max(...contracts.map(c => c.durationMonths || 12));
      if (minMonths === maxMonths) {
        contractDurationText = this.formatDuration(minMonths);
      } else {
        contractDurationText = `${this.formatDuration(minMonths)} - ${this.formatDuration(maxMonths)}`;
      }
    }

    return {
      customer,
      totalContracts: contracts.length,
      activeContracts: activeContracts.length,
      completedContracts: totalClosed,
      totalAmount,
      totalRemaining,
      totalPaid,
      totalInstallments,
      paidInstallmentsCount,
      progressPercent,
      contractDurationText,
      nextPayment
    };
  },

  /* ─── Session ─── */
  setSession(userData) {
    sessionStorage.setItem(this.KEYS.SESSION, JSON.stringify(userData));
  },

  getSession() {
    return JSON.parse(sessionStorage.getItem(this.KEYS.SESSION) || 'null');
  },

  clearSession() {
    sessionStorage.removeItem(this.KEYS.SESSION);
  },

  /* ─── Seed Demo Data ─── */
  seedDemoData() {
    // Demo Customer 1 (รายเดือน)
    const cust1 = this.addCustomer({
      name: 'สมชาย ใจดี',
      email: 'somchai@test.com',
      password: '1234',
      profileImage: '',
      phone: '081-234-5678',
      closedContractsCount: 1
    });

    if (cust1) {
      // Contract 1: ผ่อนทอง 2 บาท (รายเดือน จ่ายทุกวันที่ 1)
      const contract1Data = {
        name: 'ผ่อนทอง 2 บาท',
        totalAmount: 60000,
        installmentAmount: 5000,
        totalInstallments: 12,
        durationMonths: 12,
        startDate: '2026-03-01',
        paymentFrequency: 'monthly',
        dueDay: 1,
        paidCount: 4
      };

      this.addContract(cust1.id, contract1Data);

      // Contract 2: สินเชื่อส่วนบุคคล (รายเดือน จ่ายทุกวันที่ 15)
      const contract2Data = {
        name: 'สินเชื่อส่วนบุคคล',
        totalAmount: 120000,
        installmentAmount: 5000,
        totalInstallments: 24,
        durationMonths: 24,
        startDate: '2026-01-15',
        paymentFrequency: 'monthly',
        dueDay: 15,
        paidCount: 6
      };

      this.addContract(cust1.id, contract2Data);
    }

    // Demo Customer 2 (ราย 5 วัน)
    const cust2 = this.addCustomer({
      name: 'สมหญิง รักดี',
      email: 'somying@test.com',
      password: '1234',
      profileImage: '',
      phone: '089-876-5432',
      closedContractsCount: 0
    });

    if (cust2) {
      const contractData = {
        name: 'ผ่อนมือถือ iPhone 16 Pro',
        totalAmount: 45000,
        installmentAmount: 3750,
        totalInstallments: 12,
        durationMonths: 12,
        startDate: '2026-06-01',
        paymentFrequency: 'every_5_days',
        dueDay: null,
        paidCount: 2
      };

      this.addContract(cust2.id, contractData);
    }

    // Demo Customer 3 (รายวัน)
    const cust3 = this.addCustomer({
      name: 'ประสิทธิ์ ขยันยิ่ง',
      email: 'prasit@test.com',
      password: '1234',
      profileImage: '',
      phone: '082-999-8877',
      closedContractsCount: 0
    });

    if (cust3) {
      const contractData = {
        name: 'เงินด่วนรายวันเพื่อการค้า',
        totalAmount: 10000,
        installmentAmount: 500,
        totalInstallments: 20,
        durationMonths: 1,
        startDate: new Date().toISOString().split('T')[0],
        paymentFrequency: 'daily',
        dueDay: null,
        paidCount: 4
      };

      this.addContract(cust3.id, contractData);
    }
  },

  /* ─── Format Helpers ─── */
  formatCurrency(amount) {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount || 0);
  },

  formatDuration(months) {
    if (!months) return '-';
    months = parseInt(months);
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    if (years > 0 && remMonths > 0) {
      return `${years} ปี ${remMonths} เดือน`;
    } else if (years > 0) {
      return `${years} ปี`;
    } else {
      return `${months} เดือน`;
    }
  },

  formatFrequency(frequency, dueDay) {
    if (frequency === 'daily') {
      return '☀️ ผ่อนรายวัน (จ่ายทุกวัน)';
    } else if (frequency === 'every_5_days') {
      return '🗓️ ผ่อนราย 5 วัน (จ่ายทุกๆ 5 วัน)';
    } else {
      return '📅 ผ่อนรายเดือน' + (dueDay ? ` (ทุกวันที่ ${dueDay})` : ' (เดือนละครั้ง)');
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatDateLong(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
};

// Initialize on load
FinanceDB.init();

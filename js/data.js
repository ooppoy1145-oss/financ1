/* ============================================
   Finance System — Data Management Layer
   localStorage CRUD for Customers & Contracts
   ============================================ */

const FinanceDB = {
  KEYS: {
    ADMIN: 'finance_admin',
    CUSTOMERS: 'finance_customers',
    SETTINGS: 'finance_settings',
    SESSION: 'finance_session'
  },

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
        promptpayName: 'บริษัท ไฟแนนซ์โปร จำกัด'
      }));
    }

    // Initialize customers array
    if (!localStorage.getItem(this.KEYS.CUSTOMERS)) {
      localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify([]));
      this.seedDemoData();
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
    return customer;
  },

  updateCustomer(id, data) {
    const customers = this.getCustomers();
    const index = customers.findIndex(c => c.id === id);
    if (index === -1) return null;

    if (data.email) data.email = data.email.toLowerCase();
    customers[index] = { ...customers[index], ...data };
    localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(customers));
    return customers[index];
  },

  deleteCustomer(id) {
    const customers = this.getCustomers().filter(c => c.id !== id);
    localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(customers));
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
      installments: this.generateInstallments(contractData)
    };

    customer.contracts.push(contract);
    this.updateCustomer(customerId, { contracts: customer.contracts });
    return contract;
  },

  updateContract(customerId, contractId, data) {
    const customer = this.getCustomer(customerId);
    if (!customer || !customer.contracts) return null;

    const index = customer.contracts.findIndex(c => c.id === contractId);
    if (index === -1) return null;

    customer.contracts[index] = { ...customer.contracts[index], ...data };
    this.updateCustomer(customerId, { contracts: customer.contracts });
    return customer.contracts[index];
  },

  deleteContract(customerId, contractId) {
    const customer = this.getCustomer(customerId);
    if (!customer || !customer.contracts) return;

    customer.contracts = customer.contracts.filter(c => c.id !== contractId);
    this.updateCustomer(customerId, { contracts: customer.contracts });
  },

  /* ─── Installments ─── */
  generateInstallments(contractData) {
    const { totalInstallments, installmentAmount, startDate, paidCount } = contractData;
    const installments = [];
    const start = new Date(startDate);
    const pCount = parseInt(paidCount) || 0;

    for (let i = 0; i < totalInstallments; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + i + 1);

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
              contractName: c.name
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
    // Demo Customer 1
    const cust1 = this.addCustomer({
      name: 'สมชาย ใจดี',
      email: 'somchai@test.com',
      password: '1234',
      profileImage: '',
      phone: '081-234-5678',
      closedContractsCount: 1
    });

    if (cust1) {
      // Contract 1: ผ่อนทอง
      const contract1Data = {
        name: 'ผ่อนทอง 2 บาท',
        totalAmount: 60000,
        installmentAmount: 5000,
        totalInstallments: 12,
        durationMonths: 12,
        startDate: '2026-03-01'
      };

      const contract1 = this.addContract(cust1.id, contract1Data);

      // Mark first 4 installments as paid
      if (contract1) {
        for (let i = 1; i <= 4; i++) {
          this.payInstallment(cust1.id, contract1.id, i);
        }
      }

      // Contract 2: กู้เงิน
      const contract2Data = {
        name: 'สินเชื่อส่วนบุคคล',
        totalAmount: 120000,
        installmentAmount: 5000,
        totalInstallments: 24,
        durationMonths: 24,
        startDate: '2026-01-15'
      };

      const contract2 = this.addContract(cust1.id, contract2Data);
      if (contract2) {
        for (let i = 1; i <= 6; i++) {
          this.payInstallment(cust1.id, contract2.id, i);
        }
      }
    }

    // Demo Customer 2
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
        startDate: '2026-06-01'
      };

      const contract = this.addContract(cust2.id, contractData);
      if (contract) {
        for (let i = 1; i <= 2; i++) {
          this.payInstallment(cust2.id, contract.id, i);
        }
      }
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

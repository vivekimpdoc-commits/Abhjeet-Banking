// LocalStorage Mock Backend for GitHub Pages Compatibility
const mockDB = {
    get(key) {
        return JSON.parse(localStorage.getItem(key)) || null;
    },
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },
    init() {
        if (!this.get('users')) this.set('users', []);
        if (!this.get('kycRequests')) this.set('kycRequests', []);
        if (!this.get('transactions')) this.set('transactions', []);
        if (!this.get('beneficiaries')) this.set('beneficiaries', []);
    }
};
mockDB.init();

const API_URL = 'http://localhost:5000/api';
// Set to true to force Mock API mode (perfect for GitHub Pages)
const USE_MOCK_API = true; 

const app = {
    state: {
        user: null,
        isLogin: true,
        currentView: 'auth', // auth, user, admin
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM() {
        this.dom = {
            authSection: document.getElementById('auth-section'),
            userDashboard: document.getElementById('user-dashboard'),
            adminDashboard: document.getElementById('admin-dashboard'),
            
            navUserBtn: document.getElementById('nav-user-btn'),
            navAdminBtn: document.getElementById('nav-admin-btn'),
            logoutBtn: document.getElementById('logout-btn'),

            authForm: document.getElementById('auth-form'),
            authTitle: document.getElementById('auth-title'),
            authName: document.getElementById('auth-name'),
            authEmail: document.getElementById('auth-email'),
            authPassword: document.getElementById('auth-password'),
            switchBtn: document.getElementById('switch-to-signup'),

            userNameDisplay: document.getElementById('user-name-display'),
            userBalanceDisplay: document.getElementById('user-balance-display'),
            kycStatusBadge: document.getElementById('kyc-status-badge'),
            transactionsTableBody: document.querySelector('#transactions-table tbody'),

            kycForm: document.getElementById('kyc-form'),
            beneficiaryForm: document.getElementById('beneficiary-form'),
            paymentForm: document.getElementById('payment-form'),
            uploadForm: document.getElementById('upload-form'),

            kycTableBody: document.querySelector('#kyc-table tbody'),
            fraudTableBody: document.querySelector('#fraud-table tbody'),
            statPendingKyc: document.getElementById('stat-pending-kyc'),
            statSuspicious: document.getElementById('stat-suspicious'),
            statLimit: document.getElementById('stat-limit')
        };
    },

    bindEvents() {
        this.dom.switchBtn.addEventListener('click', () => this.toggleAuthMode());
        this.dom.authForm.addEventListener('submit', (e) => this.handleAuth(e));
        
        this.dom.navUserBtn.addEventListener('click', () => this.switchView(this.state.user ? 'user' : 'auth'));
        this.dom.navAdminBtn.addEventListener('click', () => this.switchView('admin'));
        this.dom.logoutBtn.addEventListener('click', () => this.logout());

        this.dom.kycForm.addEventListener('submit', (e) => this.handleKyc(e));
        this.dom.beneficiaryForm.addEventListener('submit', (e) => this.handleBeneficiary(e));
        this.dom.paymentForm.addEventListener('submit', (e) => this.handlePayment(e));
        this.dom.uploadForm.addEventListener('submit', (e) => this.handleUpload(e));
    },

    toggleAuthMode() {
        this.state.isLogin = !this.state.isLogin;
        this.dom.authTitle.textContent = this.state.isLogin ? 'Welcome Back' : 'Create Account';
        this.dom.authName.classList.toggle('hidden', this.state.isLogin);
        this.dom.authName.required = !this.state.isLogin;
        this.dom.switchBtn.textContent = this.state.isLogin ? 'Sign Up' : 'Login';
        this.dom.authForm.querySelector('button').textContent = this.state.isLogin ? 'Login' : 'Sign Up';
    },

    switchView(view) {
        this.dom.authSection.classList.add('hidden');
        this.dom.userDashboard.classList.add('hidden');
        this.dom.adminDashboard.classList.add('hidden');

        this.dom.navUserBtn.classList.remove('active');
        this.dom.navAdminBtn.classList.remove('active');

        if (view === 'auth' || view === 'user') {
            this.dom.navUserBtn.classList.add('active');
            if (this.state.user) {
                this.dom.userDashboard.classList.remove('hidden');
                this.loadUserData();
            } else {
                this.dom.authSection.classList.remove('hidden');
            }
        } else if (view === 'admin') {
            this.dom.navAdminBtn.classList.add('active');
            this.dom.adminDashboard.classList.remove('hidden');
            this.loadAdminData();
        }

        this.dom.logoutBtn.classList.toggle('hidden', !this.state.user && view !== 'admin');
    },

    async handleAuth(e) {
        e.preventDefault();
        const endpoint = this.state.isLogin ? '/auth/login' : '/auth/signup';
        const payload = {
            email: this.dom.authEmail.value,
            password: this.dom.authPassword.value
        };
        if (!this.state.isLogin) {
            payload.name = this.dom.authName.value;
        }

        try {
            const data = await this.mockApiCall(endpoint, payload);
            if (data.user) {
                this.state.user = data.user;
                this.switchView('user');
                alert(data.message);
            } else {
                alert(data.message);
            }
        } catch (err) {
            console.error(err);
            alert('Invalid credentials or error');
        }
    },

    logout() {
        this.state.user = null;
        this.switchView('auth');
    },

    async loadUserData() {
        if (!this.state.user) return;
        
        // Refresh user from DB
        const users = mockDB.get('users');
        this.state.user = users.find(u => u.id === this.state.user.id);

        this.dom.userNameDisplay.textContent = this.state.user.name;
        this.dom.userBalanceDisplay.textContent = `₹${this.state.user.balance.toLocaleString()}`;
        this.dom.kycStatusBadge.textContent = `KYC ${this.state.user.kycStatus}`;
        
        if (this.state.user.kycStatus === 'approved') {
            this.dom.kycStatusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            this.dom.kycStatusBadge.style.color = '#10b981';
        }

        try {
            const data = await this.mockApiCall('/user/transactions', { userId: this.state.user.id });
            this.renderTransactions(data.transactions);
        } catch (err) {
            console.error(err);
        }
    },

    renderTransactions(txns) {
        this.dom.transactionsTableBody.innerHTML = txns.map(t => `
            <tr>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td>${t.type}</td>
                <td>₹${t.amount.toLocaleString()}</td>
                <td style="color: var(--success)">${t.status}</td>
            </tr>
        `).join('');
    },

    showModal(id) {
        document.getElementById(id).classList.remove('hidden');
    },

    hideModal(id) {
        document.getElementById(id).classList.add('hidden');
    },

    async handleKyc(e) {
        e.preventDefault();
        const payload = {
            userId: this.state.user.id,
            panNumber: document.getElementById('kyc-pan').value,
            documentProof: 'dummy_doc.pdf'
        };
        await this.mockApiCall('/user/kyc', payload);
        this.hideModal('kyc-modal');
        this.state.user.kycStatus = 'pending';
        this.loadUserData();
        alert('KYC Request Submitted');
    },

    async handleBeneficiary(e) {
        e.preventDefault();
        const payload = {
            userId: this.state.user.id,
            name: document.getElementById('ben-name').value,
            accountNumber: document.getElementById('ben-acc').value,
            ifsc: document.getElementById('ben-ifsc').value
        };
        await this.mockApiCall('/user/beneficiary', payload);
        this.hideModal('beneficiary-modal');
        alert('Beneficiary Added');
    },

    async handlePayment(e) {
        e.preventDefault();
        const payload = {
            userId: this.state.user.id,
            amount: Number(document.getElementById('pay-amount').value),
            cardNumber: document.getElementById('pay-card').value
        };
        const res = await this.mockApiCall('/user/card-payment', payload);
        if (res.transaction) {
            this.loadUserData();
            alert('Payment Successful');
        } else {
            alert(res.message);
        }
        this.hideModal('payment-modal');
    },

    async handleUpload(e) {
        e.preventDefault();
        await this.mockApiCall('/user/upload-proof', {});
        this.hideModal('upload-modal');
        alert('Document Uploaded');
    },

    async loadAdminData() {
        try {
            const kycData = await this.mockApiCall('/admin/kyc-requests');
            const fraudData = await this.mockApiCall('/admin/suspicious-activity');

            const pendingKyc = kycData.kycRequests.filter(r => r.status === 'pending');
            this.dom.statPendingKyc.textContent = pendingKyc.length;
            this.dom.statSuspicious.textContent = fraudData.suspiciousTransactions.length;

            this.dom.kycTableBody.innerHTML = kycData.kycRequests.map(r => `
                <tr>
                    <td>${r.userId}</td>
                    <td>${r.panNumber}</td>
                    <td>${r.status}</td>
                    <td>
                        ${r.status === 'pending' ? `
                            <button onclick="app.approveKyc(${r.id}, 'approved')" style="background:var(--success); color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Approve</button>
                            <button onclick="app.approveKyc(${r.id}, 'rejected')" style="background:var(--danger); color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Reject</button>
                        ` : '-'}
                    </td>
                </tr>
            `).join('');

            this.dom.fraudTableBody.innerHTML = fraudData.suspiciousTransactions.map(t => `
                <tr>
                    <td>#${t.id}</td>
                    <td>${t.userId}</td>
                    <td style="color: var(--danger)">₹${t.amount.toLocaleString()}</td>
                    <td>${new Date(t.date).toLocaleDateString()}</td>
                </tr>
            `).join('');

        } catch (err) {
            console.error(err);
        }
    },

    async approveKyc(id, status) {
        await this.mockApiCall('/admin/kyc-approve', { requestId: id, status });
        this.loadAdminData();
    },

    // Mock API System for GitHub Pages
    async mockApiCall(endpoint, data = {}) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                let users = mockDB.get('users');
                let kycReqs = mockDB.get('kycRequests');
                let txns = mockDB.get('transactions');
                let bens = mockDB.get('beneficiaries');

                if (endpoint === '/auth/signup') {
                    const user = { id: Date.now(), ...data, kycStatus: 'pending', role: 'user', balance: 100000 };
                    users.push(user);
                    mockDB.set('users', users);
                    resolve({ message: 'User created', user });
                }
                else if (endpoint === '/auth/login') {
                    const user = users.find(u => u.email === data.email && u.password === data.password);
                    if (user) resolve({ message: 'Login successful', user });
                    else reject({ message: 'Invalid credentials' });
                }
                else if (endpoint === '/user/kyc') {
                    const req = { id: Date.now(), ...data, status: 'pending' };
                    kycReqs.push(req);
                    mockDB.set('kycRequests', kycReqs);
                    resolve({ message: 'KYC submitted', request: req });
                }
                else if (endpoint === '/user/beneficiary') {
                    const b = { id: Date.now(), ...data };
                    bens.push(b);
                    mockDB.set('beneficiaries', bens);
                    resolve({ message: 'Beneficiary added', beneficiary: b });
                }
                else if (endpoint === '/user/card-payment') {
                    const userIndex = users.findIndex(u => u.id === data.userId);
                    if (userIndex > -1 && users[userIndex].balance >= data.amount) {
                        users[userIndex].balance -= data.amount;
                        mockDB.set('users', users);
                        const tx = { id: Date.now(), userId: data.userId, type: 'Card Payment', amount: data.amount, status: 'Completed', date: new Date() };
                        txns.push(tx);
                        mockDB.set('transactions', txns);
                        resolve({ message: 'Payment successful', transaction: tx });
                    } else {
                        resolve({ message: 'Insufficient balance' });
                    }
                }
                else if (endpoint === '/user/upload-proof') {
                    resolve({ message: 'Document uploaded' });
                }
                else if (endpoint === '/user/transactions') {
                    const userTx = txns.filter(t => t.userId === data.userId);
                    resolve({ transactions: userTx });
                }
                else if (endpoint === '/admin/kyc-requests') {
                    resolve({ kycRequests: kycReqs });
                }
                else if (endpoint === '/admin/suspicious-activity') {
                    const suspicious = txns.filter(t => t.amount > 50000);
                    resolve({ suspiciousTransactions: suspicious });
                }
                else if (endpoint === '/admin/kyc-approve') {
                    const reqIndex = kycReqs.findIndex(r => r.id === data.requestId);
                    if (reqIndex > -1) {
                        kycReqs[reqIndex].status = data.status;
                        mockDB.set('kycRequests', kycReqs);
                        
                        const uIndex = users.findIndex(u => u.id === kycReqs[reqIndex].userId);
                        if (uIndex > -1) {
                            users[uIndex].kycStatus = data.status;
                            mockDB.set('users', users);
                        }
                        resolve({ message: `KYC ${data.status}` });
                    }
                }
            }, 300); // Simulate network delay
        });
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());

// ============================================================
//  NeoBank - app.js
//  Supports:
//    1. Demo/Mock mode (no Supabase needed) — works on GitHub Pages
//    2. Live mode — replace SUPABASE_URL & SUPABASE_ANON_KEY below
// ============================================================

const SUPABASE_URL = '';        // e.g. 'https://xxxx.supabase.co'
const SUPABASE_ANON_KEY = '';   // e.g. 'eyJhbGci...'

// ---- Mock Database (localStorage backed) -------------------
const mock = {
    _save() {
        localStorage.setItem('neobank_db', JSON.stringify({
            users: this.users,
            kycRequests: this.kycRequests,
            transactions: this.transactions,
            beneficiaries: this.beneficiaries
        }));
    },
    _load() {
        const raw = localStorage.getItem('neobank_db');
        if (raw) {
            const d = JSON.parse(raw);
            this.users         = d.users         || [];
            this.kycRequests   = d.kycRequests   || [];
            this.transactions  = d.transactions  || [];
            this.beneficiaries = d.beneficiaries || [];
        }
        // Seed a demo admin account if DB is empty
        if (this.users.length === 0) {
            this.users.push({
                id: 1, name: 'Admin User', email: 'admin@neobank.com',
                password: 'admin123', kyc_status: 'approved', role: 'admin', balance: 500000,
                created_at: new Date().toISOString()
            });
            this.users.push({
                id: 2, name: 'Demo User', email: 'user@neobank.com',
                password: 'user123', kyc_status: 'pending', role: 'user', balance: 100000,
                created_at: new Date().toISOString()
            });
            this.transactions.push({
                id: 101, user_id: 2, type: 'Card Payment', amount: 2500,
                status: 'Completed', created_at: new Date(Date.now() - 86400000).toISOString()
            });
            this._save();
        }
    },
    users: [], kycRequests: [], transactions: [], beneficiaries: [],

    // Mimic Supabase query API
    from(table) {
        const tbl = table === 'users' ? this.users :
                    table === 'kyc_requests' ? this.kycRequests :
                    table === 'transactions' ? this.transactions :
                    table === 'beneficiaries' ? this.beneficiaries : [];
        return new MockQuery(tbl, table, this);
    }
};

class MockQuery {
    constructor(tbl, tableName, db) {
        this._tbl = tbl;
        this._tableName = tableName;
        this._db = db;
        this._filters = [];
        this._insertData = null;
        this._updateData = null;
        this._orderField = null;
        this._orderAsc = true;
        this._gtField = null;
        this._gtVal = null;
        this._single = false;
    }
    select() { return this; }
    eq(field, val) { this._filters.push({ field, val, op: 'eq' }); return this; }
    gt(field, val) { this._gtField = field; this._gtVal = val; return this; }
    order(field, { ascending = true } = {}) { this._orderField = field; this._orderAsc = ascending; return this; }
    single() { this._single = true; return this; }

    insert(rows) {
        this._insertData = rows;
        return this;
    }
    update(data) {
        this._updateData = data;
        return this;
    }

    // Await resolution
    then(resolve) {
        let result = [...this._tbl];

        if (this._insertData) {
            const inserted = this._insertData.map(row => ({
                ...row,
                id: Date.now() + Math.floor(Math.random() * 1000),
                created_at: new Date().toISOString()
            }));
            this._tbl.push(...inserted);
            this._db._save();
            return resolve({ data: inserted, error: null });
        }

        if (this._updateData) {
            result.forEach(item => {
                const match = this._filters.every(f => String(item[f.field]) === String(f.val));
                if (match) Object.assign(item, this._updateData);
            });
            this._db._save();
            return resolve({ data: result, error: null });
        }

        // Apply filters
        this._filters.forEach(f => {
            result = result.filter(item => String(item[f.field]) === String(f.val));
        });
        if (this._gtField) {
            result = result.filter(item => item[this._gtField] > this._gtVal);
        }
        if (this._orderField) {
            result.sort((a, b) => {
                const av = a[this._orderField], bv = b[this._orderField];
                return this._orderAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
            });
        }

        if (this._single) {
            return resolve({ data: result[0] || null, error: null });
        }
        return resolve({ data: result, error: null });
    }
}

// ---- Supabase or Mock Client --------------------------------
let supabaseClient;
const USE_SUPABASE = SUPABASE_URL && SUPABASE_ANON_KEY;

if (USE_SUPABASE) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    mock._load();
    supabaseClient = { from: (t) => mock.from(t) };
}

// ============================================================
//  App Object
// ============================================================
const app = {
    state: {
        user: null,
        isLogin: true,
        currentView: 'auth',
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.showDemoBanner();
    },

    showDemoBanner() {
        if (!USE_SUPABASE) {
            const banner = document.createElement('div');
            banner.id = 'demo-banner';
            banner.innerHTML = `
                <span>🚀 <strong>Demo Mode</strong> — Running with local mock data. 
                Login: <code>user@neobank.com</code> / <code>user123</code> &nbsp;|&nbsp; 
                Admin: <code>admin@neobank.com</code> / <code>admin123</code></span>
                <button onclick="document.getElementById('demo-banner').style.display='none'">✕</button>
            `;
            document.body.prepend(banner);
        }
    },

    cacheDOM() {
        this.dom = {
            authSection:            document.getElementById('auth-section'),
            userDashboard:          document.getElementById('user-dashboard'),
            adminDashboard:         document.getElementById('admin-dashboard'),
            navUserBtn:             document.getElementById('nav-user-btn'),
            navAdminBtn:            document.getElementById('nav-admin-btn'),
            logoutBtn:              document.getElementById('logout-btn'),
            authForm:               document.getElementById('auth-form'),
            authTitle:              document.getElementById('auth-title'),
            authName:               document.getElementById('auth-name'),
            authEmail:              document.getElementById('auth-email'),
            authPassword:           document.getElementById('auth-password'),
            switchBtn:              document.getElementById('switch-to-signup'),
            userNameDisplay:        document.getElementById('user-name-display'),
            userBalanceDisplay:     document.getElementById('user-balance-display'),
            kycStatusBadge:         document.getElementById('kyc-status-badge'),
            transactionsTableBody:  document.querySelector('#transactions-table tbody'),
            kycForm:                document.getElementById('kyc-form'),
            beneficiaryForm:        document.getElementById('beneficiary-form'),
            paymentForm:            document.getElementById('payment-form'),
            uploadForm:             document.getElementById('upload-form'),
            kycTableBody:           document.querySelector('#kyc-table tbody'),
            fraudTableBody:         document.querySelector('#fraud-table tbody'),
            statPendingKyc:         document.getElementById('stat-pending-kyc'),
            statSuspicious:         document.getElementById('stat-suspicious'),
            statLimit:              document.getElementById('stat-limit')
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
        this.dom.authTitle.textContent   = this.state.isLogin ? 'Welcome Back' : 'Create Account';
        this.dom.authName.classList.toggle('hidden', this.state.isLogin);
        this.dom.authName.required       = !this.state.isLogin;
        this.dom.switchBtn.textContent   = this.state.isLogin ? 'Sign Up' : 'Login';
        this.dom.authForm.querySelector('button[type="submit"]').textContent = this.state.isLogin ? 'Login' : 'Sign Up';
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

    showToast(message, type = 'success') {
        const old = document.getElementById('toast');
        if (old) old.remove();
        const toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
    },

    async handleAuth(e) {
        e.preventDefault();
        const identifier = this.dom.authEmail.value.trim();
        const password   = this.dom.authPassword.value.trim();

        try {
            if (this.state.isLogin) {
                const { data: users, error } = await supabaseClient
                    .from('users')
                    .select('*')
                    .eq('email', identifier)
                    .eq('password', password);

                if (error) throw error;

                if (users && users.length > 0) {
                    this.state.user = users[0];
                    // Admin check
                    if (this.state.user.role === 'admin') {
                        this.switchView('admin');
                    } else {
                        this.switchView('user');
                    }
                    this.showToast('Login successful! Welcome back 👋');
                } else {
                    this.showToast('Invalid email or password.', 'error');
                }
            } else {
                const name = this.dom.authName.value.trim();
                const { data, error } = await supabaseClient
                    .from('users')
                    .insert([{ name, email: identifier, password, kyc_status: 'pending', role: 'user', balance: 100000 }]);

                if (error) throw error;

                this.state.user = data[0];
                this.switchView('user');
                this.showToast('Account created successfully! 🎉');
            }
        } catch (err) {
            console.error(err);
            this.showToast('Error: ' + err.message, 'error');
        }
    },

    logout() {
        this.state.user = null;
        this.dom.authEmail.value    = '';
        this.dom.authPassword.value = '';
        this.switchView('auth');
        this.showToast('Logged out successfully.');
    },

    async loadUserData() {
        if (!this.state.user) return;
        try {
            const { data: userData } = await supabaseClient
                .from('users').select('*').eq('id', this.state.user.id).single();
            if (userData) this.state.user = userData;

            this.dom.userNameDisplay.textContent    = this.state.user.name;
            this.dom.userBalanceDisplay.textContent = `₹${Number(this.state.user.balance).toLocaleString('en-IN')}`;
            this.dom.kycStatusBadge.textContent     = `KYC ${this.state.user.kyc_status}`;

            if (this.state.user.kyc_status === 'approved') {
                this.dom.kycStatusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                this.dom.kycStatusBadge.style.color           = '#10b981';
            } else {
                this.dom.kycStatusBadge.style.backgroundColor = '';
                this.dom.kycStatusBadge.style.color           = '';
            }

            const { data: txns } = await supabaseClient
                .from('transactions').select('*').eq('user_id', this.state.user.id)
                .order('created_at', { ascending: false });

            this.renderTransactions(txns || []);
        } catch (err) { console.error(err); }
    },

    renderTransactions(txns) {
        if (txns.length === 0) {
            this.dom.transactionsTableBody.innerHTML =
                '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No transactions yet</td></tr>';
            return;
        }
        this.dom.transactionsTableBody.innerHTML = txns.map(t => `
            <tr>
                <td>${new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                <td>${t.type}</td>
                <td>₹${Number(t.amount).toLocaleString('en-IN')}</td>
                <td style="color: var(--success)">${t.status}</td>
            </tr>
        `).join('');
    },

    showModal(id)  { document.getElementById(id).classList.remove('hidden'); },
    hideModal(id)  { document.getElementById(id).classList.add('hidden'); },

    async handleKyc(e) {
        e.preventDefault();
        const panNumber = document.getElementById('kyc-pan').value;
        const { error } = await supabaseClient
            .from('kyc_requests')
            .insert([{ user_id: this.state.user.id, pan_number: panNumber, status: 'pending' }]);

        if (!error) {
            this.hideModal('kyc-modal');
            document.getElementById('kyc-pan').value = '';
            this.showToast('KYC Request Submitted ✓');
            this.loadUserData();
        }
    },

    async handleBeneficiary(e) {
        e.preventDefault();
        const payload = {
            user_id: this.state.user.id,
            name:           document.getElementById('ben-name').value,
            account_number: document.getElementById('ben-acc').value,
            ifsc:           document.getElementById('ben-ifsc').value
        };
        const { error } = await supabaseClient.from('beneficiaries').insert([payload]);
        if (!error) {
            this.hideModal('beneficiary-modal');
            document.getElementById('beneficiary-form').reset();
            this.showToast('Beneficiary Added ✓');
        }
    },

    async handlePayment(e) {
        e.preventDefault();
        const amount = Number(document.getElementById('pay-amount').value);

        if (isNaN(amount) || amount <= 0) {
            this.showToast('Please enter a valid amount.', 'error'); return;
        }
        if (this.state.user.balance < amount) {
            this.showToast('Insufficient balance!', 'error'); return;
        }

        const newBalance = this.state.user.balance - amount;
        const { error: updateError } = await supabaseClient
            .from('users').update({ balance: newBalance }).eq('id', this.state.user.id);

        if (!updateError) {
            await supabaseClient.from('transactions').insert([{
                user_id: this.state.user.id,
                type: 'Card Payment', amount, status: 'Completed'
            }]);
            this.hideModal('payment-modal');
            document.getElementById('payment-form').reset();
            this.showToast('Payment Successful ✓');
            this.loadUserData();
        }
    },

    async handleUpload(e) {
        e.preventDefault();
        this.hideModal('upload-modal');
        document.getElementById('upload-form').reset();
        this.showToast('Document Uploaded ✓');
    },

    // ---- Admin ----
    async loadAdminData() {
        try {
            const { data: kycData }   = await supabaseClient.from('kyc_requests').select('*');
            const { data: fraudData } = await supabaseClient.from('transactions').select('*').gt('amount', 50000);

            const pendingKyc = kycData ? kycData.filter(r => r.status === 'pending') : [];
            this.dom.statPendingKyc.textContent = pendingKyc.length;
            this.dom.statSuspicious.textContent  = fraudData ? fraudData.length : 0;

            if (kycData && kycData.length > 0) {
                this.dom.kycTableBody.innerHTML = kycData.map(r => `
                    <tr>
                        <td>${r.user_id}</td>
                        <td>${r.pan_number}</td>
                        <td>${r.status}</td>
                        <td>
                            ${r.status === 'pending' ? `
                                <button onclick="app.approveKyc(${r.id}, ${r.user_id}, 'approved')"
                                    style="background:var(--success);color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;margin-right:4px">Approve</button>
                                <button onclick="app.approveKyc(${r.id}, ${r.user_id}, 'rejected')"
                                    style="background:var(--danger);color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer">Reject</button>
                            ` : `<span style="color:var(--text-muted)">${r.status}</span>`}
                        </td>
                    </tr>
                `).join('');
            } else {
                this.dom.kycTableBody.innerHTML =
                    '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No KYC requests</td></tr>';
            }

            if (fraudData && fraudData.length > 0) {
                this.dom.fraudTableBody.innerHTML = fraudData.map(t => `
                    <tr>
                        <td>#${t.id}</td>
                        <td>${t.user_id}</td>
                        <td style="color:var(--danger)">₹${Number(t.amount).toLocaleString('en-IN')}</td>
                        <td>${new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                `).join('');
            } else {
                this.dom.fraudTableBody.innerHTML =
                    '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No suspicious activity</td></tr>';
            }
        } catch (err) { console.error(err); }
    },

    async approveKyc(reqId, userId, status) {
        await supabaseClient.from('kyc_requests').update({ status }).eq('id', reqId);
        await supabaseClient.from('users').update({ kyc_status: status }).eq('id', userId);
        this.showToast(`KYC ${status} successfully ✓`);
        this.loadAdminData();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());

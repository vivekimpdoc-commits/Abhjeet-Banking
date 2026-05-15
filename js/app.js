// ================================================================
//  NeoBank — app.js  (Demo Mode: works 100% on GitHub Pages)
//  Data stored in localStorage. No backend or Supabase needed.
//  To use real Supabase: fill SUPABASE_URL + SUPABASE_ANON_KEY
// ================================================================

const SUPABASE_URL     = '';   // e.g. 'https://xyz.supabase.co'
const SUPABASE_ANON_KEY = '';  // e.g. 'eyJhbGci...'
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// ──────────────────────────────────────────────────────────────
//  LOCAL STORAGE DATABASE
// ──────────────────────────────────────────────────────────────
const DB = {
    _key: 'neobank_v1',

    load() {
        try {
            const raw = localStorage.getItem(this._key);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return null;
    },

    save(data) {
        localStorage.setItem(this._key, JSON.stringify(data));
    },

    init() {
        let data = this.load();
        if (!data || !data.users || data.users.length === 0) {
            data = {
                users: [
                    {
                        id: 1, name: 'Admin User', email: 'admin@neobank.com',
                        password: 'admin123', kyc_status: 'approved',
                        role: 'admin', balance: 500000,
                        created_at: new Date().toISOString()
                    },
                    {
                        id: 2, name: 'Demo User', email: 'user@neobank.com',
                        password: 'user123', kyc_status: 'pending',
                        role: 'user', balance: 100000,
                        created_at: new Date().toISOString()
                    }
                ],
                kyc_requests: [],
                transactions: [
                    {
                        id: 101, user_id: 2, type: 'Card Payment', amount: 2500,
                        status: 'Completed',
                        created_at: new Date(Date.now() - 86400000).toISOString()
                    },
                    {
                        id: 102, user_id: 2, type: 'Card Payment', amount: 15000,
                        status: 'Completed',
                        created_at: new Date(Date.now() - 172800000).toISOString()
                    }
                ],
                beneficiaries: []
            };
            this.save(data);
        }
        return data;
    },

    // ── CRUD helpers ──────────────────────────────────────────
    getAll(table) {
        return this.load()[table] || [];
    },

    findWhere(table, filters = {}) {
        return this.getAll(table).filter(row =>
            Object.keys(filters).every(k => String(row[k]) === String(filters[k]))
        );
    },

    findOne(table, filters = {}) {
        return this.findWhere(table, filters)[0] || null;
    },

    insert(table, row) {
        const data = this.load();
        const newRow = {
            ...row,
            id: Date.now() + Math.floor(Math.random() * 9999),
            created_at: new Date().toISOString()
        };
        data[table] = data[table] || [];
        data[table].push(newRow);
        this.save(data);
        return newRow;
    },

    updateWhere(table, filters = {}, updates = {}) {
        const data = this.load();
        (data[table] || []).forEach(row => {
            const match = Object.keys(filters).every(k => String(row[k]) === String(filters[k]));
            if (match) Object.assign(row, updates);
        });
        this.save(data);
    }
};

// ──────────────────────────────────────────────────────────────
//  Supabase wrapper (only used when credentials are provided)
// ──────────────────────────────────────────────────────────────
let supabase = null;
if (USE_SUPABASE && window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Unified query helper — returns a Promise always
function query(table, action, payload = {}) {
    if (USE_SUPABASE && supabase) {
        // Real Supabase
        const ref = supabase.from(table);
        if (action === 'select') {
            let q = ref.select('*');
            if (payload.eq) q = q.eq(payload.eq[0], payload.eq[1]);
            if (payload.eq2) q = q.eq(payload.eq2[0], payload.eq2[1]);
            if (payload.gt) q = q.gt(payload.gt[0], payload.gt[1]);
            if (payload.order) q = q.order(payload.order[0], { ascending: payload.order[1] });
            if (payload.single) q = q.single();
            return q.then(({ data, error }) => ({ data, error }));
        }
        if (action === 'insert') {
            return ref.insert([payload.row]).select()
                .then(({ data, error }) => ({ data, error }));
        }
        if (action === 'update') {
            let q = ref.update(payload.updates);
            if (payload.eq) q = q.eq(payload.eq[0], payload.eq[1]);
            return q.then(({ data, error }) => ({ data, error }));
        }
    }

    // Mock / localStorage mode
    return new Promise(resolve => {
        try {
            if (action === 'select') {
                const filters = {};
                if (payload.eq)  filters[payload.eq[0]]  = payload.eq[1];
                if (payload.eq2) filters[payload.eq2[0]] = payload.eq2[1];

                let rows = (Object.keys(filters).length > 0)
                    ? DB.findWhere(table, filters)
                    : DB.getAll(table);

                if (payload.gt) {
                    rows = rows.filter(r => r[payload.gt[0]] > payload.gt[1]);
                }
                if (payload.order) {
                    const [field, asc] = payload.order;
                    rows.sort((a, b) => asc
                        ? (a[field] > b[field] ? 1 : -1)
                        : (a[field] < b[field] ? 1 : -1)
                    );
                }
                if (payload.single) {
                    resolve({ data: rows[0] || null, error: null });
                } else {
                    resolve({ data: rows, error: null });
                }
            } else if (action === 'insert') {
                const inserted = DB.insert(table, payload.row);
                resolve({ data: [inserted], error: null });
            } else if (action === 'update') {
                const filters = {};
                if (payload.eq) filters[payload.eq[0]] = payload.eq[1];
                DB.updateWhere(table, filters, payload.updates);
                resolve({ data: [], error: null });
            }
        } catch (err) {
            resolve({ data: null, error: { message: err.message } });
        }
    });
}

// ──────────────────────────────────────────────────────────────
//  APP
// ──────────────────────────────────────────────────────────────
const app = {
    state: { user: null, isLogin: true },

    init() {
        DB.init();
        this.cacheDOM();
        this.bindEvents();
        this.showDemoBanner();
    },

    showDemoBanner() {
        if (!USE_SUPABASE) {
            const banner = document.createElement('div');
            banner.id = 'demo-banner';
            banner.innerHTML = `
                <span>🚀 <strong>Demo Mode</strong> — 
                User: <code>user@neobank.com</code> / <code>user123</code> &nbsp;|&nbsp; 
                Admin: <code>admin@neobank.com</code> / <code>admin123</code></span>
                <button id="close-banner">✕</button>`;
            document.body.prepend(banner);
            document.getElementById('close-banner').onclick = () => banner.remove();
        }
    },

    cacheDOM() {
        this.dom = {
            authSection:           document.getElementById('auth-section'),
            userDashboard:         document.getElementById('user-dashboard'),
            adminDashboard:        document.getElementById('admin-dashboard'),
            navUserBtn:            document.getElementById('nav-user-btn'),
            navAdminBtn:           document.getElementById('nav-admin-btn'),
            logoutBtn:             document.getElementById('logout-btn'),
            authForm:              document.getElementById('auth-form'),
            authTitle:             document.getElementById('auth-title'),
            authName:              document.getElementById('auth-name'),
            authEmail:             document.getElementById('auth-email'),
            authPassword:          document.getElementById('auth-password'),
            switchBtn:             document.getElementById('switch-to-signup'),
            userNameDisplay:       document.getElementById('user-name-display'),
            userBalanceDisplay:    document.getElementById('user-balance-display'),
            kycStatusBadge:        document.getElementById('kyc-status-badge'),
            txTableBody:           document.querySelector('#transactions-table tbody'),
            kycForm:               document.getElementById('kyc-form'),
            beneficiaryForm:       document.getElementById('beneficiary-form'),
            paymentForm:           document.getElementById('payment-form'),
            uploadForm:            document.getElementById('upload-form'),
            kycTableBody:          document.querySelector('#kyc-table tbody'),
            fraudTableBody:        document.querySelector('#fraud-table tbody'),
            statPendingKyc:        document.getElementById('stat-pending-kyc'),
            statSuspicious:        document.getElementById('stat-suspicious'),
            statLimit:             document.getElementById('stat-limit')
        };
    },

    bindEvents() {
        this.dom.switchBtn.addEventListener('click', () => this.toggleAuthMode());
        this.dom.authForm.addEventListener('submit', e => this.handleAuth(e));
        this.dom.navUserBtn.addEventListener('click', () => this.switchView(this.state.user ? 'user' : 'auth'));
        this.dom.navAdminBtn.addEventListener('click', () => this.switchView('admin'));
        this.dom.logoutBtn.addEventListener('click', () => this.logout());
        this.dom.kycForm.addEventListener('submit', e => this.handleKyc(e));
        this.dom.beneficiaryForm.addEventListener('submit', e => this.handleBeneficiary(e));
        this.dom.paymentForm.addEventListener('submit', e => this.handlePayment(e));
        this.dom.uploadForm.addEventListener('submit', e => this.handleUpload(e));
    },

    toggleAuthMode() {
        this.state.isLogin = !this.state.isLogin;
        const isLogin = this.state.isLogin;
        this.dom.authTitle.textContent = isLogin ? 'Welcome Back' : 'Create Account';
        this.dom.authName.classList.toggle('hidden', isLogin);
        this.dom.authName.required = !isLogin;
        this.dom.switchBtn.textContent = isLogin ? 'Sign Up' : 'Login';
        this.dom.authForm.querySelector('button[type="submit"]').textContent = isLogin ? 'Login' : 'Sign Up';
    },

    switchView(view) {
        ['authSection', 'userDashboard', 'adminDashboard'].forEach(s => {
            this.dom[s].classList.add('hidden');
        });
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

    toast(msg, type = 'success') {
        const old = document.getElementById('_toast');
        if (old) old.remove();
        const t = document.createElement('div');
        t.id = '_toast';
        t.className = `toast toast-${type}`;
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 400);
        }, 3000);
    },

    // ── AUTH ────────────────────────────────────────────────
    async handleAuth(e) {
        e.preventDefault();
        const email    = this.dom.authEmail.value.trim();
        const password = this.dom.authPassword.value.trim();

        if (!email || !password) { this.toast('Please fill all fields', 'error'); return; }

        const btn = this.dom.authForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Please wait…';

        try {
            if (this.state.isLogin) {
                // LOGIN
                const { data, error } = await query('users', 'select', {
                    eq: ['email', email], eq2: ['password', password]
                });
                if (error) throw error;

                if (data && data.length > 0) {
                    this.state.user = data[0];
                    this.toast('Login successful! Welcome 👋');
                    this.switchView(this.state.user.role === 'admin' ? 'admin' : 'user');
                } else {
                    this.toast('Invalid email or password', 'error');
                }
            } else {
                // SIGNUP
                const name = this.dom.authName.value.trim();
                if (!name) { this.toast('Please enter your name', 'error'); return; }

                const { data, error } = await query('users', 'insert', {
                    row: { name, email, password, kyc_status: 'pending', role: 'user', balance: 100000 }
                });
                if (error) throw error;

                this.state.user = data[0];
                this.toast('Account created! Welcome 🎉');
                this.switchView('user');
            }
        } catch (err) {
            console.error(err);
            this.toast('Error: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = this.state.isLogin ? 'Login' : 'Sign Up';
        }
    },

    logout() {
        this.state.user = null;
        this.dom.authEmail.value    = '';
        this.dom.authPassword.value = '';
        this.switchView('auth');
        this.toast('Logged out successfully');
    },

    // ── USER DASHBOARD ──────────────────────────────────────
    async loadUserData() {
        if (!this.state.user) return;
        try {
            const { data: u } = await query('users', 'select', {
                eq: ['id', this.state.user.id], single: true
            });
            if (u) this.state.user = u;

            this.dom.userNameDisplay.textContent    = this.state.user.name;
            this.dom.userBalanceDisplay.textContent = '₹' + Number(this.state.user.balance).toLocaleString('en-IN');
            this.dom.kycStatusBadge.textContent     = 'KYC ' + this.state.user.kyc_status;
            this.dom.kycStatusBadge.style.backgroundColor =
                this.state.user.kyc_status === 'approved' ? 'rgba(16,185,129,0.2)' : '';
            this.dom.kycStatusBadge.style.color =
                this.state.user.kyc_status === 'approved' ? '#10b981' : '';

            const { data: txns } = await query('transactions', 'select', {
                eq: ['user_id', this.state.user.id],
                order: ['created_at', false]
            });
            this.renderTxns(txns || []);
        } catch (err) { console.error(err); }
    },

    renderTxns(txns) {
        if (!txns.length) {
            this.dom.txTableBody.innerHTML =
                '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">No transactions yet</td></tr>';
            return;
        }
        this.dom.txTableBody.innerHTML = txns.map(t => `
            <tr>
                <td>${new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                <td>${t.type}</td>
                <td>₹${Number(t.amount).toLocaleString('en-IN')}</td>
                <td style="color:var(--success)">${t.status}</td>
            </tr>`).join('');
    },

    showModal(id)  { document.getElementById(id).classList.remove('hidden'); },
    hideModal(id)  { document.getElementById(id).classList.add('hidden'); },

    async handleKyc(e) {
        e.preventDefault();
        const pan = document.getElementById('kyc-pan').value.trim().toUpperCase();
        if (!pan) { this.toast('Enter PAN number', 'error'); return; }

        await query('kyc_requests', 'insert', {
            row: { user_id: this.state.user.id, pan_number: pan, status: 'pending' }
        });
        this.hideModal('kyc-modal');
        this.dom.kycForm.reset();
        this.toast('KYC request submitted ✓');
        this.loadUserData();
    },

    async handleBeneficiary(e) {
        e.preventDefault();
        await query('beneficiaries', 'insert', {
            row: {
                user_id: this.state.user.id,
                name:           document.getElementById('ben-name').value,
                account_number: document.getElementById('ben-acc').value,
                ifsc:           document.getElementById('ben-ifsc').value
            }
        });
        this.hideModal('beneficiary-modal');
        this.dom.beneficiaryForm.reset();
        this.toast('Beneficiary added ✓');
    },

    async handlePayment(e) {
        e.preventDefault();
        const amount = Number(document.getElementById('pay-amount').value);
        if (!amount || amount <= 0) { this.toast('Enter valid amount', 'error'); return; }
        if (amount > this.state.user.balance) { this.toast('Insufficient balance!', 'error'); return; }

        const newBalance = this.state.user.balance - amount;
        await query('users', 'update', {
            updates: { balance: newBalance },
            eq: ['id', this.state.user.id]
        });
        await query('transactions', 'insert', {
            row: { user_id: this.state.user.id, type: 'Card Payment', amount, status: 'Completed' }
        });
        this.hideModal('payment-modal');
        this.dom.paymentForm.reset();
        this.toast('Payment of ₹' + amount.toLocaleString('en-IN') + ' successful ✓');
        this.loadUserData();
    },

    async handleUpload(e) {
        e.preventDefault();
        this.hideModal('upload-modal');
        this.dom.uploadForm.reset();
        this.toast('Document uploaded ✓');
    },

    // ── ADMIN DASHBOARD ─────────────────────────────────────
    async loadAdminData() {
        try {
            const { data: kycData }   = await query('kyc_requests', 'select', {});
            const { data: fraudData } = await query('transactions',  'select', { gt: ['amount', 50000] });

            const pending = (kycData || []).filter(r => r.status === 'pending');
            this.dom.statPendingKyc.textContent = pending.length;
            this.dom.statSuspicious.textContent  = (fraudData || []).length;

            // KYC table
            if (!kycData || kycData.length === 0) {
                this.dom.kycTableBody.innerHTML =
                    '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">No KYC requests</td></tr>';
            } else {
                this.dom.kycTableBody.innerHTML = kycData.map(r => `
                    <tr>
                        <td>${r.user_id}</td>
                        <td>${r.pan_number}</td>
                        <td><span style="color:${r.status==='approved'?'var(--success)':r.status==='rejected'?'var(--danger)':'var(--warning)'}">${r.status}</span></td>
                        <td>${r.status === 'pending' ? `
                            <button onclick="app.approveKyc(${r.id},${r.user_id},'approved')"
                                style="background:var(--success);color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;margin-right:4px">Approve</button>
                            <button onclick="app.approveKyc(${r.id},${r.user_id},'rejected')"
                                style="background:var(--danger);color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer">Reject</button>
                        ` : '—'}</td>
                    </tr>`).join('');
            }

            // Fraud table
            if (!fraudData || fraudData.length === 0) {
                this.dom.fraudTableBody.innerHTML =
                    '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">No suspicious transactions</td></tr>';
            } else {
                this.dom.fraudTableBody.innerHTML = fraudData.map(t => `
                    <tr>
                        <td>#${t.id}</td>
                        <td>${t.user_id}</td>
                        <td style="color:var(--danger)">₹${Number(t.amount).toLocaleString('en-IN')}</td>
                        <td>${new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>`).join('');
            }
        } catch (err) { console.error(err); }
    },

    async approveKyc(reqId, userId, status) {
        await query('kyc_requests', 'update', {
            updates: { status },
            eq: ['id', reqId]
        });
        await query('users', 'update', {
            updates: { kyc_status: status },
            eq: ['id', userId]
        });
        this.toast(`KYC ${status} ✓`);
        this.loadAdminData();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());

// Initialize Supabase (User needs to replace these with their own project details)
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

// Create Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = {
    state: {
        user: null,
        isLogin: true,
        currentView: 'auth',
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
        const identifier = this.dom.authEmail.value;
        const password = this.dom.authPassword.value;

        try {
            if (this.state.isLogin) {
                // Login Flow
                const { data: users, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', identifier)
                    .eq('password', password);

                if (error) throw error;
                if (users.length > 0) {
                    this.state.user = users[0];
                    this.switchView('user');
                    alert('Login successful');
                } else {
                    alert('Invalid credentials');
                }
            } else {
                // Signup Flow
                const name = this.dom.authName.value;
                const { data, error } = await supabase
                    .from('users')
                    .insert([
                        { name: name, email: identifier, password: password, kyc_status: 'pending', role: 'user', balance: 100000 }
                    ])
                    .select();

                if (error) throw error;
                this.state.user = data[0];
                this.switchView('user');
                alert('User created successfully');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred: ' + err.message);
        }
    },

    logout() {
        this.state.user = null;
        this.switchView('auth');
    },

    async loadUserData() {
        if (!this.state.user) return;
        
        try {
            // Refresh user balance & status from Supabase
            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('id', this.state.user.id)
                .single();
            
            if (userData) this.state.user = userData;

            this.dom.userNameDisplay.textContent = this.state.user.name;
            this.dom.userBalanceDisplay.textContent = `₹${this.state.user.balance.toLocaleString()}`;
            this.dom.kycStatusBadge.textContent = `KYC ${this.state.user.kyc_status}`;
            
            if (this.state.user.kyc_status === 'approved') {
                this.dom.kycStatusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                this.dom.kycStatusBadge.style.color = '#10b981';
            }

            // Fetch Transactions
            const { data: txns } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', this.state.user.id)
                .order('created_at', { ascending: false });

            if (txns) this.renderTransactions(txns);
        } catch (err) {
            console.error(err);
        }
    },

    renderTransactions(txns) {
        this.dom.transactionsTableBody.innerHTML = txns.map(t => `
            <tr>
                <td>${new Date(t.created_at).toLocaleDateString()}</td>
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
        const panNumber = document.getElementById('kyc-pan').value;
        
        const { error } = await supabase
            .from('kyc_requests')
            .insert([{ user_id: this.state.user.id, pan_number: panNumber, status: 'pending' }]);

        if (!error) {
            this.hideModal('kyc-modal');
            alert('KYC Request Submitted');
            this.loadUserData();
        }
    },

    async handleBeneficiary(e) {
        e.preventDefault();
        const payload = {
            user_id: this.state.user.id,
            name: document.getElementById('ben-name').value,
            account_number: document.getElementById('ben-acc').value,
            ifsc: document.getElementById('ben-ifsc').value
        };

        const { error } = await supabase.from('beneficiaries').insert([payload]);
        if (!error) {
            this.hideModal('beneficiary-modal');
            alert('Beneficiary Added');
        }
    },

    async handlePayment(e) {
        e.preventDefault();
        const amount = Number(document.getElementById('pay-amount').value);
        
        if (this.state.user.balance < amount) {
            alert('Insufficient balance');
            return;
        }

        const newBalance = this.state.user.balance - amount;

        // Update balance
        const { error: updateError } = await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('id', this.state.user.id);

        if (!updateError) {
            // Record Transaction
            await supabase.from('transactions').insert([{
                user_id: this.state.user.id,
                type: 'Card Payment',
                amount: amount,
                status: 'Completed'
            }]);

            this.hideModal('payment-modal');
            alert('Payment Successful');
            this.loadUserData();
        }
    },

    async handleUpload(e) {
        e.preventDefault();
        this.hideModal('upload-modal');
        alert('Document Uploaded (Supabase Storage integration required)');
    },

    // Admin Functions
    async loadAdminData() {
        try {
            const { data: kycData } = await supabase.from('kyc_requests').select('*');
            const { data: fraudData } = await supabase.from('transactions').select('*').gt('amount', 50000);

            const pendingKyc = kycData ? kycData.filter(r => r.status === 'pending') : [];
            this.dom.statPendingKyc.textContent = pendingKyc.length;
            this.dom.statSuspicious.textContent = fraudData ? fraudData.length : 0;

            if (kycData) {
                this.dom.kycTableBody.innerHTML = kycData.map(r => `
                    <tr>
                        <td>${r.user_id}</td>
                        <td>${r.pan_number}</td>
                        <td>${r.status}</td>
                        <td>
                            ${r.status === 'pending' ? `
                                <button onclick="app.approveKyc(${r.id}, ${r.user_id}, 'approved')" style="background:var(--success); color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Approve</button>
                                <button onclick="app.approveKyc(${r.id}, ${r.user_id}, 'rejected')" style="background:var(--danger); color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Reject</button>
                            ` : '-'}
                        </td>
                    </tr>
                `).join('');
            }

            if (fraudData) {
                this.dom.fraudTableBody.innerHTML = fraudData.map(t => `
                    <tr>
                        <td>#${t.id}</td>
                        <td>${t.user_id}</td>
                        <td style="color: var(--danger)">₹${t.amount.toLocaleString()}</td>
                        <td>${new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            console.error(err);
        }
    },

    async approveKyc(reqId, userId, status) {
        // Update Request
        await supabase.from('kyc_requests').update({ status: status }).eq('id', reqId);
        // Update User
        await supabase.from('users').update({ kyc_status: status }).eq('id', userId);
        
        alert(`KYC ${status}`);
        this.loadAdminData();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());

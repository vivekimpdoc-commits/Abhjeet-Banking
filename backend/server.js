const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Dummy Database
const db = {
    users: [],
    kycRequests: [],
    transactions: [],
    beneficiaries: []
};

// --- USER ROUTES ---

// 1. Signup / Login
app.post('/api/auth/signup', (req, res) => {
    const { name, email, password } = req.body;
    const user = { id: Date.now(), name, email, password, kycStatus: 'pending', role: 'user', balance: 10000 };
    db.users.push(user);
    res.status(201).json({ message: 'User created successfully', user });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email && u.password === password);
    if (user) {
        res.json({ message: 'Login successful', user });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// 2. PAN Verification & KYC
app.post('/api/user/kyc', (req, res) => {
    const { userId, panNumber, documentProof } = req.body;
    const request = { id: Date.now(), userId, panNumber, documentProof, status: 'pending' };
    db.kycRequests.push(request);
    res.json({ message: 'KYC request submitted', request });
});

// 3. Beneficiary Add
app.post('/api/user/beneficiary', (req, res) => {
    const { userId, name, accountNumber, ifsc } = req.body;
    const beneficiary = { id: Date.now(), userId, name, accountNumber, ifsc };
    db.beneficiaries.push(beneficiary);
    res.json({ message: 'Beneficiary added', beneficiary });
});

// 4. Upload Invoice / Rent Proof (Mocked)
app.post('/api/user/upload-proof', (req, res) => {
    // In a real app, use multer for file upload
    res.json({ message: 'Document uploaded successfully' });
});

// 5. Card Payment
app.post('/api/user/card-payment', (req, res) => {
    const { userId, amount, cardNumber } = req.body;
    const user = db.users.find(u => u.id === userId);
    if (!user || user.balance < amount) {
        return res.status(400).json({ message: 'Insufficient balance or user not found' });
    }
    user.balance -= amount;
    const tx = { id: Date.now(), userId, type: 'Card Payment', amount, status: 'Completed', date: new Date() };
    db.transactions.push(tx);
    res.json({ message: 'Payment successful', transaction: tx });
});

// 6. Transfer Tracking & 7. Transaction History
app.get('/api/user/transactions/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const userTx = db.transactions.filter(t => t.userId === userId);
    res.json({ transactions: userTx });
});


// --- ADMIN ROUTES ---

// 1. KYC Approval
app.get('/api/admin/kyc-requests', (req, res) => {
    res.json({ kycRequests: db.kycRequests });
});

app.post('/api/admin/kyc-approve', (req, res) => {
    const { requestId, status } = req.body; // status: 'approved' | 'rejected'
    const request = db.kycRequests.find(r => r.id === requestId);
    if (request) {
        request.status = status;
        const user = db.users.find(u => u.id === request.userId);
        if (user) user.kycStatus = status;
        res.json({ message: `KYC ${status}` });
    } else {
        res.status(404).json({ message: 'Request not found' });
    }
});

// 2. Fraud Monitoring & 4. Suspicious Activity Alerts
app.get('/api/admin/suspicious-activity', (req, res) => {
    // Mock logic for suspicious activity: transactions > 50000
    const suspicious = db.transactions.filter(t => t.amount > 50000);
    res.json({ suspiciousTransactions: suspicious });
});

// 3. Settlement Management
app.get('/api/admin/settlements', (req, res) => {
    res.json({ message: 'Settlement dashboard data' });
});

// 5. Transaction Limits
let transactionLimit = 100000;
app.post('/api/admin/set-limit', (req, res) => {
    const { limit } = req.body;
    transactionLimit = limit;
    res.json({ message: 'Transaction limit updated', limit: transactionLimit });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

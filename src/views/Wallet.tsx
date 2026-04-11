import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, addDoc, serverTimestamp, doc, getDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Transaction, PaymentMethod, SiteSettings } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { ArrowDown, ArrowUp, Trophy, Gift, Plus, LogOut, QrCode, Info, CheckCircle, X, ChevronRight, CreditCard, Eye, AlertTriangle } from 'lucide-react';

const Wallet: React.FC = () => {
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw' | 'transactions'>('overview');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const [loading, setLoading] = useState(true);

    // Deposit State
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [senderNumber, setSenderNumber] = useState('');
    const [transactionCode, setTransactionCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Withdrawal State
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawMethod, setWithdrawMethod] = useState('');
    const [accountDetails, setAccountDetails] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                // Fetch transactions
                const txSnap = await getDocs(query(
                    collection(db, 'transactions'),
                    where('userId', '==', user.uid),
                    orderBy('timestamp', 'desc')
                ));
                setTransactions(txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));

                // Fetch payment methods
                const paySnap = await getDocs(query(
                    collection(db, 'paymentMethods'),
                    where('isActive', '==', true)
                ));
                setPaymentMethods(paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));

                // Fetch Site Settings
                const settingsSnap = await getDoc(doc(db, 'settings', 'site'));
                if (settingsSnap.exists()) {
                    setSettings(settingsSnap.data() as SiteSettings);
                }
            } catch (error) {
                console.error("Error fetching wallet data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const handleDepositSubmit = async () => {
        if (!user || !selectedMethod || !depositAmount || !senderNumber || !transactionCode) {
            return showToast('Please fill all fields', 'error');
        }

        const amount = parseFloat(depositAmount);
        if (isNaN(amount) || amount <= 0) return showToast('Invalid amount', 'error');

        setIsSubmitting(true);
        try {
            // 2. Create Transaction
            await addDoc(collection(db, 'transactions'), {
                userId: user.uid,
                username: profile?.username || 'Unknown',
                userEmail: user.email || '',
                type: 'deposit',
                amount: amount,
                method: selectedMethod.name,
                status: 'pending',
                timestamp: serverTimestamp(),
                accountDetails: `Sender Number: ${senderNumber}\nTransaction Code/Name: ${transactionCode}`,
                refId: `DEP-${Date.now()}`
            });

            showToast('Deposit request submitted! Please wait for admin approval.', 'success');
            setActiveTab('transactions');
            // Reset form
            setSelectedMethod(null);
            setDepositAmount('');
            setSenderNumber('');
            setTransactionCode('');
        } catch (error) {
            console.error("Error submitting deposit:", error);
            showToast('Failed to submit deposit request', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleWithdrawSubmit = async () => {
        if (!user || !withdrawAmount || !withdrawMethod || !accountDetails) {
            return showToast('Please fill all fields', 'error');
        }

        const amount = parseFloat(withdrawAmount);
        if (isNaN(amount) || amount <= 0) return showToast('Invalid amount', 'error');
        if (settings?.minWithdrawal && amount < settings.minWithdrawal) {
            return showToast(`Minimum withdrawal amount is ${formatCurrency(settings.minWithdrawal)}`, 'error');
        }
        if (amount > (profile?.balance || 0)) return showToast('Insufficient balance', 'error');

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            
            // 1. Create Transaction
            const txRef = doc(collection(db, 'transactions'));
            batch.set(txRef, {
                userId: user.uid,
                username: profile?.username || 'Unknown',
                userEmail: user.email || '',
                type: 'withdrawal',
                amount: -amount,
                method: withdrawMethod,
                status: 'pending',
                timestamp: serverTimestamp(),
                accountDetails: accountDetails,
                refId: `WIT-${Date.now()}`
            });

            // 2. Deduct Balance
            const userRef = doc(db, 'users', user.uid);
            batch.update(userRef, {
                balance: increment(-amount)
            });

            await batch.commit();

            showToast('Withdrawal request submitted! Please wait for admin approval.', 'success');
            setActiveTab('transactions');
            // Reset form
            setWithdrawAmount('');
            setWithdrawMethod('');
            setAccountDetails('');
        } catch (error) {
            console.error("Error submitting withdrawal:", error);
            showToast('Failed to submit withdrawal request', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Wallet...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto animate-fade-in pb-10">
            {/* Site Notice */}
            {settings?.showNotice && settings.siteNotice && (
                <div className="mb-6 bg-brand-900/20 border border-brand-500/30 p-4 rounded-xl flex gap-3 items-start animate-pulse">
                    <AlertTriangle className="text-brand-400 shrink-0 w-5 h-5 mt-0.5" />
                    <div className="text-xs text-brand-200 leading-relaxed font-bold uppercase">
                        <span className="block text-brand-400 mb-1">IMPORTANT NOTICE</span>
                        {settings.siteNotice}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-800 mb-6 overflow-x-auto custom-scrollbar">
                {(['overview', 'transactions'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 font-bold text-sm transition whitespace-nowrap uppercase tracking-widest ${activeTab === tab ? 'text-brand-400 border-b-2 border-brand-500' : 'text-gray-500 hover:text-white'}`}
                    >
                        {tab === 'transactions' ? 'Transactions' : tab.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8 rounded-2xl border border-gray-700 shadow-2xl relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-500 rounded-full filter blur-[80px] opacity-10"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Current Balance</p>
                                    <h1 className="text-5xl font-black text-white tracking-tighter">{formatCurrency(profile?.balance || 0)}</h1>
                                </div>
                                <div className="bg-brand-500/10 p-3 rounded-xl border border-brand-500/20">
                                    <CreditCard className="text-brand-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setActiveTab('deposit')} className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-bold transition shadow-lg uppercase text-sm tracking-widest">
                                    <Plus className="w-4 h-4" /> Deposit
                                </button>
                                <button onClick={() => setActiveTab('withdraw')} className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-bold transition shadow-lg uppercase text-sm tracking-widest border border-gray-700">
                                    <LogOut className="w-4 h-4" /> Withdraw
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card p-6 rounded-2xl border border-gray-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-white uppercase tracking-wider">Recent Activity</h3>
                            <button onClick={() => setActiveTab('transactions')} className="text-brand-400 text-xs font-bold hover:underline">View All</button>
                        </div>
                        <div className="space-y-4">
                            {transactions.slice(0, 3).map(t => (
                                <div key={t.id} className="flex justify-between items-center p-4 bg-surface rounded-xl border border-gray-700/50 hover:border-gray-600 transition">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${t.type === 'deposit' ? 'bg-green-900/20 border-green-500/30 text-green-400' : t.type === 'withdrawal' ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'}`}>
                                            {t.type === 'deposit' ? <ArrowDown className="w-5 h-5" /> : t.type === 'withdrawal' ? <ArrowUp className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white capitalize">{t.type}</div>
                                            <div className="text-[10px] text-gray-500">{formatDate(t.timestamp)}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-mono font-bold ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {t.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(t.amount))}
                                        </div>
                                        <div className={`text-[10px] uppercase font-bold ${t.status === 'success' ? 'text-green-500' : t.status === 'pending' ? 'text-yellow-500' : 'text-red-500'}`}>
                                            {t.status}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {transactions.length === 0 && <p className="text-center text-gray-600 text-sm py-4">No recent activity.</p>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'deposit' && (
                <div className="space-y-6">
                    {!selectedMethod ? (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-white mb-4">Select Deposit Method</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {paymentMethods.map(pm => (
                                    <button 
                                        key={pm.id} 
                                        onClick={() => setSelectedMethod(pm)}
                                        className="flex items-center justify-between p-4 bg-card rounded-xl border border-gray-800 hover:border-brand-500 transition group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-dark rounded-lg flex items-center justify-center border border-gray-700">
                                                <img src={pm.qrUrl || undefined} className="w-8 h-8 object-contain" alt={pm.name} />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-bold text-white group-hover:text-brand-400 transition">{pm.name}</div>
                                                <div className="text-xs text-gray-500 uppercase font-bold">{pm.type}</div>
                                            </div>
                                        </div>
                                        <ChevronRight className="text-gray-600 group-hover:text-brand-500 transition" />
                                    </button>
                                ))}
                                {paymentMethods.length === 0 && (
                                    <div className="text-center py-10 bg-card rounded-xl border border-gray-800">
                                        <Info className="mx-auto text-gray-600 mb-2" />
                                        <p className="text-gray-500 text-sm">No deposit methods available at the moment.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card p-6 rounded-2xl border border-gray-800 space-y-6">
                            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                                <button onClick={() => setSelectedMethod(null)} className="text-gray-500 hover:text-white text-sm flex items-center gap-1">
                                    <X className="w-4 h-4" /> Back
                                </button>
                                <h3 className="font-bold text-white uppercase tracking-widest">{selectedMethod.name}</h3>
                                <div className="w-10"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-2xl shadow-inner flex items-center justify-center aspect-square">
                                        <img src={selectedMethod.qrUrl || undefined} className="w-full h-full object-contain" alt="QR Code" />
                                    </div>
                                    <div className="bg-dark p-4 rounded-xl border border-gray-800">
                                        <div className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1">
                                            <Info className="w-3 h-3" /> Instructions
                                        </div>
                                        <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                                            {selectedMethod.instructions}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Deposit Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rs.</span>
                                            <input 
                                                type="number" 
                                                value={depositAmount}
                                                onChange={(e) => setDepositAmount(e.target.value)}
                                                className="w-full bg-dark border border-gray-700 rounded-xl p-4 pl-12 text-white focus:border-brand-500 outline-none font-bold"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Sender Number</label>
                                        <input 
                                            type="text" 
                                            value={senderNumber}
                                            onChange={(e) => setSenderNumber(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none font-bold"
                                            placeholder="e.g. 98XXXXXXXX"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Transaction Code or Name</label>
                                        <input 
                                            type="text" 
                                            value={transactionCode}
                                            onChange={(e) => setTransactionCode(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none font-bold"
                                            placeholder="e.g. TXN123456 or John Doe"
                                        />
                                    </div>

                                    <button 
                                        onClick={handleDepositSubmit}
                                        disabled={isSubmitting}
                                        className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 text-white py-4 rounded-xl font-bold transition shadow-lg uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-5 h-5" /> Submit Deposit
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'withdraw' && (
                <div className="bg-card p-8 rounded-2xl border border-gray-800 space-y-8">
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-bold text-white uppercase tracking-widest">Withdraw Funds</h3>
                        <p className="text-gray-500 text-sm">Available Balance: <span className="text-brand-400 font-bold">{formatCurrency(profile?.balance || 0)}</span></p>
                    </div>

                    <div className="space-y-6 max-w-md mx-auto">
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Amount to Withdraw</label>
                            <input 
                                type="number" 
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none font-bold text-xl text-center"
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Withdrawal Method</label>
                            <select 
                                value={withdrawMethod}
                                onChange={(e) => setWithdrawMethod(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none font-bold"
                            >
                                <option value="">Select Method</option>
                                <option value="eSewa">eSewa</option>
                                <option value="Khalti">Khalti</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Account Details (Name, ID/Number)</label>
                            <textarea 
                                value={accountDetails}
                                onChange={(e) => setAccountDetails(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none h-32 text-sm"
                                placeholder="e.g. Name: John Doe&#10;eSewa ID: 98XXXXXXXX"
                            />
                        </div>

                        <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-xl flex gap-3">
                            <Info className="text-yellow-500 shrink-0 w-5 h-5" />
                            <p className="text-[10px] text-yellow-200 leading-relaxed uppercase font-bold">
                                Withdrawal requests are processed within 24-48 hours. Ensure your account details are correct to avoid rejection.
                            </p>
                        </div>

                        <button 
                            onClick={handleWithdrawSubmit}
                            disabled={isSubmitting}
                            className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 text-white py-4 rounded-xl font-bold transition shadow-lg uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <LogOut className="w-5 h-5" /> Request Withdrawal
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'transactions' && (
                <div className="space-y-4">
                    <h3 className="font-bold text-white uppercase tracking-wider mb-6 pl-1">
                        Transaction History
                    </h3>
                    <div className="space-y-3">
                        {transactions.length > 0 ? (
                            [...transactions]
                                .sort((a, b) => {
                                    if (a.status === 'pending' && b.status !== 'pending') return -1;
                                    if (a.status !== 'pending' && b.status === 'pending') return 1;
                                    return 0; // Keep original order (timestamp desc) for same status
                                })
                                .map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => setSelectedTransaction(t)}
                                    className="bg-card p-5 rounded-2xl border border-gray-800 hover:border-brand-500/50 transition cursor-pointer group relative overflow-hidden"
                                >
                                    {t.status === 'pending' && (
                                        <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
                                    )}
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${t.type === 'deposit' ? 'bg-green-900/20 border-green-500/30 text-green-400' : t.type === 'withdrawal' ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'}`}>
                                                {t.type === 'deposit' ? <ArrowDown className="w-6 h-6" /> : t.type === 'withdrawal' ? <ArrowUp className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white capitalize flex items-center gap-2">
                                                    {t.type.replace('_', ' ')}
                                                    {t.status === 'pending' && (
                                                        <span className="text-[8px] bg-yellow-500/10 px-2 py-0.5 rounded text-yellow-500 border border-yellow-500/20 uppercase font-black">Pending</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">{formatDate(t.timestamp)} • {t.method || 'System'}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-lg font-mono font-bold ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {t.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(t.amount))}
                                            </div>
                                            <div className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full inline-block mt-1 ${t.status === 'success' ? 'bg-green-900/20 text-green-500 border border-green-500/30' : t.status === 'pending' ? 'bg-yellow-900/20 text-yellow-500 border border-yellow-500/30' : 'bg-red-900/20 text-red-500 border border-red-500/30'}`}>
                                                {t.status}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex justify-end">
                                        <span className="text-[10px] text-brand-400 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition">Click for details</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-card rounded-2xl border border-gray-800">
                                <Trophy className="mx-auto text-gray-700 w-12 h-12 mb-4" />
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No transactions found</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Transaction Details Modal */}
            {selectedTransaction && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-scale-in">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gradient-to-r from-gray-900 to-black">
                            <h3 className="font-black text-white uppercase tracking-widest">Transaction Details</h3>
                            <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-gray-800 rounded-full transition">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center border-2 mb-2 ${selectedTransaction.type === 'deposit' ? 'bg-green-900/20 border-green-500/30 text-green-400' : selectedTransaction.type === 'withdrawal' ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'}`}>
                                    {selectedTransaction.type === 'deposit' ? <ArrowDown className="w-8 h-8" /> : selectedTransaction.type === 'withdrawal' ? <ArrowUp className="w-8 h-8" /> : <Trophy className="w-8 h-8" />}
                                </div>
                                <h2 className={`text-3xl font-mono font-black ${selectedTransaction.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {selectedTransaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(selectedTransaction.amount))}
                                </h2>
                                <div className={`text-xs uppercase font-black px-3 py-1 rounded-full border ${selectedTransaction.status === 'success' ? 'bg-green-900/20 text-green-500 border-green-500/30' : selectedTransaction.status === 'pending' ? 'bg-yellow-900/20 text-yellow-500 border-yellow-500/30' : 'bg-red-900/20 text-red-500 border-red-500/30'}`}>
                                    {selectedTransaction.status}
                                </div>
                            </div>

                            <div className="space-y-4 bg-black/40 p-6 rounded-2xl border border-gray-800">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500 font-bold uppercase">Type</span>
                                    <span className="text-white font-black uppercase tracking-wider">{selectedTransaction.type}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500 font-bold uppercase">Method</span>
                                    <span className="text-white font-black uppercase tracking-wider">{selectedTransaction.method}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500 font-bold uppercase">Date</span>
                                    <span className="text-white font-black">{formatDate(selectedTransaction.timestamp)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500 font-bold uppercase">Reference ID</span>
                                    <span className="text-white font-mono">{selectedTransaction.refId}</span>
                                </div>
                                {selectedTransaction.confirmedByUsername && (
                                    <div className="flex justify-between text-xs pt-2 border-t border-gray-800">
                                        <span className="text-brand-400 font-bold uppercase">Confirmed By</span>
                                        <span className="text-brand-400 font-black uppercase tracking-wider">{selectedTransaction.confirmedByUsername}</span>
                                    </div>
                                )}
                            </div>

                            {selectedTransaction.accountDetails && (
                                <div className="space-y-2">
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Account Details / Info</p>
                                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 text-xs text-gray-300 whitespace-pre-wrap font-medium leading-relaxed">
                                        {selectedTransaction.accountDetails}
                                    </div>
                                </div>
                            )}

                            {selectedTransaction.status === 'rejected' && selectedTransaction.rejectionReason && (
                                <div className="space-y-2">
                                    <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">Rejection Reason</p>
                                    <div className="bg-red-900/10 p-4 rounded-xl border border-red-500/20 text-xs text-red-300 font-medium leading-relaxed">
                                        {selectedTransaction.rejectionReason}
                                    </div>
                                </div>
                            )}

                            {selectedTransaction.proofUrl && (
                                <a 
                                    href={selectedTransaction.proofUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-black transition uppercase text-xs tracking-widest border border-gray-700"
                                >
                                    <Eye className="w-4 h-4" /> View Payment Proof
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Wallet;

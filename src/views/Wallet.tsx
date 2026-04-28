import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc, increment, addDoc, serverTimestamp, writeBatch, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, PromoCode } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Plus, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, Wallet as WalletIcon, Gift, AlertTriangle, X, DollarSign, ShieldCheck, Download, PiggyBank, TrendingUp, TrendingDown, ChevronRight, BarChart2 } from 'lucide-react';
import WalletModal from '../components/WalletModal';
import { useNotification } from '../context/NotificationContext';
import { useInView } from '../hooks/useInView';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

const Wallet: React.FC = () => {
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | null>(null);
    const [fallbackMode, setFallbackMode] = useState(false);
    
    // Promo Code State
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);

    // Dispute State
    const [disputeModalOpen, setDisputeModalOpen] = useState(false);
    const [selectedTxForDispute, setSelectedTxForDispute] = useState<Transaction | null>(null);
    const [disputeReason, setDisputeReason] = useState('');
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    // Chart visibility
    const { ref: chartRef, isInView: isChartInView } = useInView({ threshold: 0.1 });

    useEffect(() => {
        if (user) {
            fetchTransactions();
        }
    }, [user]);

    const fetchTransactions = async (isLoadMore = false) => {
        if (!user) return;
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);
        
        try {
            let snap;
            
            if (fallbackMode) {
                // Fallback: fetch all and slice
                const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
                snap = await getDocs(q);
                let txs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
                txs.sort((a,b) => {
                    const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                    const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                    return bTime - aTime;
                });
                
                const startIndex = isLoadMore ? transactions.length : 0;
                const endIndex = startIndex + (isLoadMore ? 10 : 5);
                const nextBatch = txs.slice(startIndex, endIndex);
                
                if (isLoadMore) {
                    setTransactions(prev => [...prev, ...nextBatch]);
                } else {
                    setTransactions(nextBatch);
                }
                setHasMore(endIndex < txs.length);
            } else {
                try {
                    let q;
                    if (isLoadMore && lastDoc) {
                        q = query(
                            collection(db, 'transactions'),
                            where('userId', '==', user.uid),
                            orderBy('timestamp', 'desc'),
                            startAfter(lastDoc),
                            limit(10)
                        );
                    } else {
                        q = query(
                            collection(db, 'transactions'),
                            where('userId', '==', user.uid),
                            orderBy('timestamp', 'desc'),
                            limit(5)
                        );
                    }
                    snap = await getDocs(q);
                    const txs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
                    
                    if (isLoadMore) {
                        setTransactions(prev => [...prev, ...txs]);
                    } else {
                        setTransactions(txs);
                    }
                    
                    if (snap.docs.length > 0) {
                        setLastDoc(snap.docs[snap.docs.length - 1]);
                    }
                    setHasMore(snap.docs.length === (isLoadMore ? 10 : 5));

                } catch (err: any) {
                    if (err.message && err.message.includes('index')) {
                        console.warn("Missing index, switching to fallback mode (client-side pagination)");
                        setFallbackMode(true);
                        // Rerun fetch in fallback mode
                        const fallbackQ = query(collection(db, 'transactions'), where('userId', '==', user.uid));
                        snap = await getDocs(fallbackQ);
                        let fallbackTxs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
                        fallbackTxs.sort((a,b) => {
                            const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                            const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                            return bTime - aTime;
                        });
                        setTransactions(fallbackTxs.slice(0, 5));
                        setHasMore(fallbackTxs.length > 5);
                    } else {
                        throw err;
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching transactions:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Derived Analytics from fetched transactions (Firebase cost optimization: derived locally)
    const analytics = useMemo(() => {
        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let thisMonthEarnings = 0;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        transactions.forEach(tx => {
            if (tx.status === 'success' || tx.status === 'completed') {
                if (tx.type === 'deposit') {
                    totalDeposits += tx.amount;
                } else if (tx.type === 'withdrawal' || tx.type === 'withdraw') {
                    totalWithdrawals += tx.amount;
                } else if (tx.type === 'prize' || tx.type === 'promo') {
                    // Count prize/promo as earnings
                    const txTime = tx.timestamp?.toMillis ? tx.timestamp.toMillis() : 0;
                    if (txTime >= startOfMonth) {
                        thisMonthEarnings += tx.amount;
                    }
                }
            }
        });

        // Generate chart data matching recharts format
        const chartData = [...transactions].reverse().map(tx => ({
            name: formatDate(tx.timestamp).split(',')[0], // Short date
            amount: tx.amount,
            type: tx.type,
            status: tx.status
        })).filter(tx => tx.status === 'success' || tx.status === 'completed').slice(-15); // Last 15 successful txs

        return { totalDeposits, totalWithdrawals, thisMonthEarnings, chartData };
    }, [transactions]);

    const handleRedeemPromo = async () => {
        if (!promoCode.trim() || !user) return;
        setIsRedeeming(true);
        try {
            const q = query(collection(db, 'promocodes'), where('code', '==', promoCode.trim().toUpperCase()));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                showToast('Invalid promo code', 'error');
                setIsRedeeming(false);
                return;
            }

            const promoDoc = snap.docs[0];
            const promoData = promoDoc.data() as PromoCode;

            if (!promoData.isActive) {
                showToast('This promo code is no longer active', 'error');
                setIsRedeeming(false);
                return;
            }

            if (promoData.currentUses >= promoData.maxUses) {
                showToast('This promo code has reached its maximum uses', 'error');
                setIsRedeeming(false);
                return;
            }

            const txQuery = query(
                collection(db, 'transactions'),
                where('userId', '==', user.uid),
                where('type', '==', 'promo'),
                where('method', '==', `PROMO:${promoData.code}`)
            );
            const txSnap = await getDocs(txQuery);
            if (!txSnap.empty) {
                showToast('You have already used this promo code', 'error');
                setIsRedeeming(false);
                return;
            }

            const batch = writeBatch(db);
            const userRef = doc(db, 'users', user.uid);
            batch.update(userRef, {
                balance: increment(promoData.amount)
            });

            batch.update(promoDoc.ref, {
                currentUses: increment(1)
            });

            const newTxRef = doc(collection(db, 'transactions'));
            batch.set(newTxRef, {
                userId: user.uid,
                username: profile?.username || 'Unknown',
                userEmail: user.email || '',
                type: 'promo',
                amount: promoData.amount,
                method: `PROMO:${promoData.code}`,
                status: 'completed',
                timestamp: serverTimestamp(),
                accountDetails: 'Promo Code Redemption',
                refId: `PRM-${Date.now()}`
            });

            await batch.commit();
            showToast(`Successfully redeemed ${formatCurrency(promoData.amount)}!`, 'success');
            setPromoCode('');
            setIsPromoModalOpen(false);
            
            // Re-fetch transactions
            setLastDoc(null);
            fetchTransactions();
        } catch (error) {
            console.error("Error redeeming promo code:", error);
            showToast('Failed to redeem promo code', 'error');
        } finally {
            setIsRedeeming(false);
        }
    };

    const handleReportDispute = async () => {
        if (!selectedTxForDispute || !disputeReason.trim() || !user) return;
        setIsSubmittingDispute(true);
        try {
            await addDoc(collection(db, 'disputes'), {
                transactionId: selectedTxForDispute.id,
                userId: user.uid,
                username: profile?.username || 'Unknown',
                userEmail: user.email || '',
                amount: selectedTxForDispute.amount,
                type: selectedTxForDispute.type,
                reason: disputeReason,
                status: 'open',
                createdAt: serverTimestamp()
            });
            showToast('Dispute reported successfully. Our team will review it.', 'success');
            setDisputeModalOpen(false);
            setDisputeReason('');
            setSelectedTxForDispute(null);
        } catch (error) {
            console.error("Error reporting dispute:", error);
            showToast('Failed to report dispute', 'error');
        } finally {
            setIsSubmittingDispute(false);
        }
    };

    if (!user || !profile) return null;

    const isOrg = profile.role === 'organizer' || profile.role === 'admin';

    // Premium UI Render
    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20 px-4 xl:px-0">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <WalletIcon className="w-8 h-8 text-brand-500" /> My Wallet
                    </h1>
                    <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest flex items-center gap-2">
                        Manage your funds securely
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                    </p>
                </div>
                <div className="flex bg-dark-900 border border-gray-800 rounded-full pl-3 pr-4 py-1 items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-green-500 uppercase tracking-widest">Verified Secure</span>
                </div>
            </div>

            {/* Premium Balance Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="col-span-1 lg:col-span-2 bg-gradient-to-br from-brand-900/40 via-dark-800 to-black rounded-3xl p-8 border border-gray-800 shadow-2xl relative overflow-hidden group hover:border-brand-500/30 transition-colors duration-500">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none transition-transform duration-700 group-hover:scale-110"></div>
                    
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Total Balance</h2>
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-dark-900 px-3 py-1 rounded-full border border-gray-800">
                                    Last Updated: Just Now
                                </span>
                            </div>
                            <p className="text-6xl sm:text-7xl font-black text-white tracking-tighter">
                                {formatCurrency(profile.balance || 0)}
                            </p>
                        </div>
                        
                        {isOrg && (
                            <div className="grid grid-cols-2 gap-6 mt-8 p-6 bg-black/40 rounded-2xl border border-gray-800/50 backdrop-blur-sm">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <DollarSign className="w-4 h-4 text-green-500" />
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Org Wallet</h3>
                                    </div>
                                    <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(profile.orgWalletBalance || 0)}</p>
                                </div>
                                <div className="border-l border-gray-800/50 pl-6">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-4 h-4 text-yellow-500" />
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pending</h3>
                                    </div>
                                    <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(profile.orgPendingEarnings || 0)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions Stack */}
                <div className="col-span-1 flex flex-col gap-4">
                    <button 
                        onClick={() => setActiveModal('deposit')}
                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white p-6 rounded-3xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-brand-500/20 flex flex-col items-center justify-center gap-3 hover:-translate-y-1"
                    >
                        <ArrowDownRight className="w-8 h-8" />
                        Add Money
                    </button>
                    <div className="flex-1 flex gap-4">
                        <button 
                            onClick={() => setActiveModal('withdraw')}
                            className="flex-1 bg-dark-800 hover:bg-dark-700 text-white p-6 rounded-3xl font-black uppercase tracking-widest text-xs transition-all border border-gray-800 flex flex-col items-center justify-center gap-2 hover:-translate-y-1"
                        >
                            <ArrowUpRight className="w-6 h-6 text-red-400" />
                            Withdraw
                        </button>
                        <button 
                            onClick={() => setIsPromoModalOpen(true)}
                            className="flex-1 bg-dark-800 hover:bg-dark-700 text-white p-6 rounded-3xl font-black uppercase tracking-widest text-xs transition-all border border-gray-800 flex flex-col items-center justify-center gap-2 hover:-translate-y-1"
                        >
                            <Gift className="w-6 h-6 text-brand-400" />
                            Redeem
                        </button>
                    </div>
                </div>
            </div>

            {/* Financial Insights Row (Derived from local data) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-dark-900 border border-gray-800 rounded-3xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1 items-center flex gap-1"><ArrowDownRight size={14} className="text-green-500"/> Recent Deposits</p>
                        <p className="text-2xl font-black text-white">{formatCurrency(analytics.totalDeposits)}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                        <PiggyBank size={24} />
                    </div>
                </div>
                <div className="bg-dark-900 border border-gray-800 rounded-3xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1 items-center flex gap-1"><ArrowUpRight size={14} className="text-red-500"/> Recent Withdrawals</p>
                        <p className="text-2xl font-black text-white">{formatCurrency(analytics.totalWithdrawals)}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                        <TrendingDown size={24} />
                    </div>
                </div>
                <div className="bg-dark-900 border border-gray-800 rounded-3xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1 items-center flex gap-1"><TrendingUp size={14} className="text-brand-500"/> Month Earnings</p>
                        <p className="text-2xl font-black text-white">{formatCurrency(analytics.thisMonthEarnings)}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500">
                        <BarChart2 size={24} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Professional Transactions Ledger */}
                <div className="xl:col-span-2 bg-dark-900 rounded-3xl border border-gray-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-black/20">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Transaction Ledger</h3>
                        <div className="flex gap-2">
                            <button className="text-[10px] font-bold uppercase text-gray-400 hover:text-white bg-dark-800 px-3 py-1.5 rounded-full border border-gray-700 transition flex items-center gap-1">
                                <Download size={12} /> Statement
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-2 sm:p-6">
                        {loading && transactions.length === 0 ? (
                            <div className="flex justify-center py-20">
                                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : transactions.length > 0 ? (
                            <div className="space-y-3">
                                {transactions.map(tx => (
                                    <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-dark rounded-2xl hover:bg-dark-800 transition-colors border border-transparent hover:border-gray-800 gap-4 group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border border-gray-800 ${
                                                tx.type === 'deposit' ? 'bg-green-500/10 text-green-500' : 
                                                (tx.type === 'withdrawal' || tx.type === 'withdraw') ? 'bg-red-500/10 text-red-500' : 
                                                tx.type === 'promo' ? 'bg-brand-500/10 text-brand-500' :
                                                'bg-blue-500/10 text-blue-500'
                                            }`}>
                                                {tx.type === 'deposit' ? <ArrowDownRight className="w-5 h-5" /> : 
                                                (tx.type === 'withdrawal' || tx.type === 'withdraw') ? <ArrowUpRight className="w-5 h-5" /> : 
                                                tx.type === 'promo' ? <Gift className="w-5 h-5" /> :
                                                <WalletIcon className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white uppercase tracking-wider text-sm">
                                                    {tx.type === 'deposit' ? 'Added Funds' : (tx.type === 'withdrawal' || tx.type === 'withdraw') ? 'Withdrawal' : tx.type === 'promo' ? 'Promo Code' : 'Transfer'}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase">{formatDate(tx.timestamp)}</span>
                                                    <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase">{tx.method || 'System'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                                            <div className="text-left sm:text-right">
                                                <p className={`font-black text-lg font-mono ${
                                                    tx.type === 'deposit' || tx.type === 'promo' ? 'text-green-400' : 
                                                    (tx.type === 'withdrawal' || tx.type === 'withdraw') ? 'text-white' : 
                                                    'text-white'
                                                }`}>
                                                    {tx.type === 'deposit' || tx.type === 'promo' ? '+' : ''}{formatCurrency(tx.amount)}
                                                </p>
                                                <div className="flex items-center justify-start sm:justify-end gap-1.5 mt-1">
                                                    <span className={`text-[9px] font-black outline outline-1 outline-offset-2 px-1.5 py-0.5 rounded-sm uppercase tracking-widest ${
                                                        tx.status === 'completed' || tx.status === 'success' ? 'text-green-500 outline-green-500/30 bg-green-500/10' :
                                                        tx.status === 'rejected' ? 'text-red-500 outline-red-500/30 bg-red-500/10' :
                                                        'text-yellow-500 outline-yellow-500/30 bg-yellow-500/10 animate-pulse'
                                                    }`}>
                                                        {tx.status}
                                                    </span>
                                                </div>
                                            </div>
                                            {(tx.status === 'pending' || tx.status === 'rejected') && (
                                                <button 
                                                    onClick={() => {
                                                        setSelectedTxForDispute(tx);
                                                        setDisputeModalOpen(true);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 absolute sm:relative right-4 sm:right-auto text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded-lg transition border border-red-500/20 flex items-center gap-1"
                                                >
                                                    <AlertTriangle className="w-3 h-3" /> Report
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {hasMore && (
                                    <div className="pt-4 text-center">
                                        <button 
                                            onClick={() => fetchTransactions(true)}
                                            disabled={loadingMore}
                                            className="text-xs font-black uppercase text-gray-400 hover:text-white bg-dark-800 hover:bg-dark-700 py-3 px-8 rounded-xl transition border border-gray-700 flex items-center gap-2 mx-auto disabled:opacity-50"
                                        >
                                            {loadingMore ? 'Loading...' : 'Load More History'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-dark-800/30 rounded-2xl border border-dashed border-gray-800">
                                <WalletIcon className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-50" />
                                <p className="text-white font-black uppercase tracking-widest text-sm mb-1">No Activity Found</p>
                                <p className="text-gray-500 text-xs font-bold uppercase max-w-xs mx-auto">Your wallet transaction history will appear here once you start using it.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column Stack */}
                <div className="space-y-6">
                    {/* Spending Overview Profile */}
                    <div ref={chartRef} className="bg-dark-900 rounded-3xl border border-gray-800 p-6">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex justify-between items-center">
                            Activity Overview
                            <span className="text-[9px] bg-dark-800 px-2 py-1 rounded text-gray-500 border border-gray-700">Recent</span>
                        </h3>
                        <div className="h-48 w-full">
                            {isChartInView && analytics.chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="name" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#334155" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                                        <RechartsTooltip 
                                            cursor={{fill: 'rgba(255,255,255,0.02)'}}
                                            contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'}}
                                            itemStyle={{color: '#fff'}}
                                            formatter={(value: number, name: string, props: any) => [`${formatCurrency(value)}`, props.payload.type === 'deposit' ? 'Incoming' : 'Outgoing']}
                                        />
                                        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                            {
                                                analytics.chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.type === 'deposit' || entry.type === 'promo' ? '#10b981' : '#3b82f6'} />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                    <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">Not enough data</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Security Module */}
                    <div className="bg-dark rounded-3xl border border-gray-800 p-6 overflow-hidden relative">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-green-500" /> Wallet Security
                        </h3>
                        <ul className="space-y-4 relative z-10">
                            <li className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 font-bold">Encrypted Connection</span>
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </li>
                            <li className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 font-bold">2FA Authentication</span>
                                <span className="text-[10px] bg-dark-800 text-gray-500 font-black px-2 py-0.5 rounded border border-gray-700 uppercase">Coming Soon</span>
                            </li>
                            <li className="pt-2">
                                <p className="text-[10px] text-gray-500 font-bold leading-relaxed">
                                    Your funds are protected by bank-level security. All transactions are logged and encrypted.
                                </p>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Modals remain structurally identical to logic but restyled via their internal components */}
            <WalletModal 
                isOpen={activeModal !== null} 
                onClose={() => {
                    setActiveModal(null);
                    setLastDoc(null);
                    fetchTransactions();
                }} 
                initialTab={activeModal === 'withdraw' ? 'withdraw' : 'deposit'} 
            />

            {/* Promo Code Modal */}
            {isPromoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setIsPromoModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-dark-900 rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden animate-scale-in p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <Gift className="w-6 h-6 text-brand-500" /> Promo Code
                                </h3>
                                <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Unlock premium rewards</p>
                            </div>
                            <button onClick={() => setIsPromoModalOpen(false)} className="text-gray-500 hover:text-white transition bg-dark-800 p-2 rounded-full border border-gray-700 hover:border-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-3 block">Enter your code</label>
                                <input 
                                    type="text" 
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                    className="w-full bg-dark border-2 border-gray-800 rounded-2xl p-5 text-white font-mono text-center text-2xl focus:border-brand-500 outline-none transition uppercase tracking-widest placeholder-gray-700"
                                    placeholder="NEXPLAY-V1"
                                />
                            </div>
                            <button 
                                onClick={handleRedeemPromo}
                                disabled={isRedeeming || !promoCode.trim()}
                                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2"
                            >
                                {isRedeeming ? 'Validating...' : 'Claim Reward'} <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dispute Modal */}
            {disputeModalOpen && selectedTxForDispute && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setDisputeModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-dark-900 rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden animate-scale-in p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <AlertTriangle className="w-6 h-6 text-red-500" /> Report Issue
                                </h3>
                                <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Secure Dispute Resolution</p>
                            </div>
                            <button onClick={() => setDisputeModalOpen(false)} className="text-gray-500 hover:text-white transition bg-dark-800 p-2 rounded-full border border-gray-700 hover:border-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-dark p-5 rounded-2xl border border-gray-800 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Transaction Ref</p>
                                    <p className="font-mono text-sm text-brand-400 font-bold">{selectedTxForDispute.refId || selectedTxForDispute.id}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{selectedTxForDispute.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</p>
                                    <p className="text-lg font-black text-white">{formatCurrency(selectedTxForDispute.amount)}</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-3 block">Describe the issue clearly</label>
                                <textarea 
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                    className="w-full bg-dark border-2 border-gray-800 rounded-2xl p-5 text-white focus:border-red-500/50 outline-none transition resize-none h-40 font-medium"
                                    placeholder="I initiated this withdrawal 3 days ago but haven't received it in my account yet..."
                                />
                            </div>
                            <button 
                                onClick={handleReportDispute}
                                disabled={isSubmittingDispute || !disputeReason.trim()}
                                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-red-500/25 flex items-center justify-center gap-2"
                            >
                                {isSubmittingDispute ? 'Opening Ticket...' : 'Submit Dispute'} <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Wallet;

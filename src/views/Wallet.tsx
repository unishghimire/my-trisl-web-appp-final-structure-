import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, updateDoc, increment, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, PromoCode } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Plus, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, Wallet as WalletIcon, Gift, AlertTriangle, X, DollarSign } from 'lucide-react';
import WalletModal from '../components/WalletModal';
import { useNotification } from '../context/NotificationContext';

import { walletApiService } from '../services/walletApiService';

const Wallet: React.FC = () => {
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | null>(null);
    
    // Promo Code State
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);

    // Dispute State
    const [disputeModalOpen, setDisputeModalOpen] = useState(false);
    const [selectedTxForDispute, setSelectedTxForDispute] = useState<Transaction | null>(null);
    const [disputeReason, setDisputeReason] = useState('');
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    useEffect(() => {
        if (user) {
            fetchTransactions();
        }
    }, [user]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'transactions'),
                where('userId', '==', user?.uid),
                orderBy('timestamp', 'desc'),
                limit(20)
            );
            const snap = await getDocs(q);
            setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
        } catch (error) {
            console.error("Error fetching transactions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRedeemPromo = async () => {
        if (!promoCode.trim() || !user) return;
        setIsRedeeming(true);
        try {
            const response = await walletApiService.redeemPromo(promoCode.trim());
            if (!response.success) throw new Error(response.error);

            showToast(`Successfully redeemed ${formatCurrency(response.data.amount)}!`, 'success');
            setPromoCode('');
            setIsPromoModalOpen(false);
            fetchTransactions();
        } catch (error: any) {
            console.error("Error redeeming promo code:", error);
            showToast(error.message || 'Failed to redeem promo code', 'error');
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

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20">
            {/* Header Section */}
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 border border-gray-800 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                
                <div className="relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center">
                        <div className="space-y-1">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <WalletIcon className="w-5 h-5 text-brand-500" />
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Balance</h2>
                            </div>
                            <p className="text-5xl md:text-6xl font-black text-white tracking-tight">
                                {formatCurrency(profile.balance || 0)}
                            </p>
                        </div>

                        {(profile.role === 'organizer' || profile.role === 'admin') && (
                            <>
                                <div className="space-y-1 border-t md:border-t-0 md:border-l border-gray-800 pt-8 md:pt-0">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <DollarSign className="w-5 h-5 text-green-500" />
                                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Org Wallet</h2>
                                    </div>
                                    <p className="text-4xl md:text-5xl font-black text-white tracking-tight">
                                        {formatCurrency(profile.orgWalletBalance || 0)}
                                    </p>
                                </div>
                                <div className="space-y-1 border-t md:border-t-0 md:border-l border-gray-800 pt-8 md:pt-0">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <Clock className="w-5 h-5 text-yellow-500" />
                                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Pending</h2>
                                    </div>
                                    <p className="text-4xl md:text-5xl font-black text-white tracking-tight">
                                        {formatCurrency(profile.orgPendingEarnings || 0)}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons Area - Now centered and integrated */}
            <div className="flex flex-wrap justify-center gap-4 py-4 px-2">
                <button 
                    onClick={() => setActiveModal('deposit')}
                    className="flex-1 min-w-[140px] max-w-[200px] bg-brand-600 hover:bg-brand-500 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
                >
                    <Plus className="w-5 h-5" /> Deposit
                </button>
                <button 
                    onClick={() => setActiveModal('withdraw')}
                    className="flex-1 min-w-[140px] max-w-[200px] bg-gray-800 hover:bg-gray-700 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border border-gray-700 flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
                >
                    <ArrowUpRight className="w-5 h-5" /> Withdraw
                </button>
                <button 
                    onClick={() => setIsPromoModalOpen(true)}
                    className="flex-1 min-w-[140px] max-w-[200px] bg-gray-800 hover:bg-gray-700 text-brand-400 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border border-gray-700 flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
                >
                    <Gift className="w-5 h-5" /> Promo
                </button>
            </div>

            {/* Transactions Section */}
            <div className="bg-card rounded-3xl border border-gray-800 overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="text-lg font-black text-white uppercase tracking-widest">Recent Transactions</h3>
                </div>
                
                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : transactions.length > 0 ? (
                        <div className="space-y-4">
                            {transactions.map(tx => (
                                <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-dark rounded-xl border border-gray-800 hover:border-gray-700 transition gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                            tx.type === 'deposit' ? 'bg-green-500/10 text-green-500' : 
                                            tx.type === 'withdraw' ? 'bg-red-500/10 text-red-500' : 
                                            tx.type === 'promo' ? 'bg-purple-500/10 text-purple-500' :
                                            'bg-brand-500/10 text-brand-500'
                                        }`}>
                                            {tx.type === 'deposit' ? <ArrowDownRight className="w-6 h-6" /> : 
                                             tx.type === 'withdraw' ? <ArrowUpRight className="w-6 h-6" /> : 
                                             tx.type === 'promo' ? <Gift className="w-6 h-6" /> :
                                             <WalletIcon className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white uppercase tracking-wider text-sm">
                                                {tx.type === 'deposit' ? 'Deposit' : tx.type === 'withdraw' ? 'Withdrawal' : tx.type === 'promo' ? 'Promo Code' : 'Transaction'}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">{formatDate(tx.timestamp)}</span>
                                                <span className="text-gray-700">•</span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{tx.method || 'System'}</span>
                                                {tx.refId && (
                                                    <>
                                                        <span className="text-gray-700">•</span>
                                                        <span className="text-[10px] text-gray-500 font-mono">{tx.refId}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                                        <div className="text-left sm:text-right">
                                            <p className={`font-black text-lg ${
                                                tx.type === 'deposit' || tx.type === 'promo' ? 'text-green-500' : 
                                                tx.type === 'withdraw' ? 'text-white' : 
                                                'text-white'
                                            }`}>
                                                {tx.type === 'deposit' || tx.type === 'promo' ? '+' : tx.type === 'withdraw' ? '-' : ''}{formatCurrency(tx.amount)}
                                            </p>
                                            <div className="flex items-center justify-start sm:justify-end gap-1 mt-1">
                                                {tx.status === 'completed' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> :
                                                 tx.status === 'rejected' ? <XCircle className="w-3 h-3 text-red-500" /> :
                                                 <Clock className="w-3 h-3 text-yellow-500" />}
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${
                                                    tx.status === 'completed' ? 'text-green-500' :
                                                    tx.status === 'rejected' ? 'text-red-500' :
                                                    'text-yellow-500'
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
                                                className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition border border-gray-700 flex items-center gap-1"
                                            >
                                                <AlertTriangle className="w-3 h-3" /> Report
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <WalletIcon className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No transactions yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Wallet Modal for Deposit/Withdraw */}
            <WalletModal 
                isOpen={activeModal !== null} 
                onClose={() => {
                    setActiveModal(null);
                    fetchTransactions(); // Refresh transactions after modal closes
                }} 
                initialTab={activeModal === 'withdraw' ? 'withdraw' : 'deposit'} 
            />

            {/* Promo Code Modal */}
            {isPromoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setIsPromoModalOpen(false)}></div>
                    <div className="relative w-full max-w-sm bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden animate-scale-in p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Gift className="w-5 h-5 text-brand-500" /> Redeem Promo
                            </h3>
                            <button onClick={() => setIsPromoModalOpen(false)} className="text-gray-500 hover:text-white transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Promo Code</label>
                                <input 
                                    type="text" 
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                    className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white font-mono text-center text-xl focus:border-brand-500 outline-none transition uppercase tracking-widest"
                                    placeholder="ENTER CODE"
                                />
                            </div>
                            <button 
                                onClick={handleRedeemPromo}
                                disabled={isRedeeming || !promoCode.trim()}
                                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-brand-500/25"
                            >
                                {isRedeeming ? 'Redeeming...' : 'Apply Code'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dispute Modal */}
            {disputeModalOpen && selectedTxForDispute && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setDisputeModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden animate-scale-in p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" /> Report Issue
                            </h3>
                            <button onClick={() => setDisputeModalOpen(false)} className="text-gray-500 hover:text-white transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-dark p-4 rounded-xl border border-gray-800">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Transaction Ref</p>
                                <p className="font-mono text-sm text-white">{selectedTxForDispute.refId || selectedTxForDispute.id}</p>
                                <div className="flex justify-between mt-2">
                                    <span className="text-xs text-gray-400">{selectedTxForDispute.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</span>
                                    <span className="text-xs font-bold text-white">{formatCurrency(selectedTxForDispute.amount)}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Reason for Dispute</label>
                                <textarea 
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none transition resize-none h-32"
                                    placeholder="Please explain the issue with this transaction in detail..."
                                />
                            </div>
                            <button 
                                onClick={handleReportDispute}
                                disabled={isSubmittingDispute || !disputeReason.trim()}
                                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-red-500/25"
                            >
                                {isSubmittingDispute ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Wallet;

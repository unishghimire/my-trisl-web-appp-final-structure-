import React from 'react';
import { X, CreditCard, Layout, Info, Eye, Image as ImageIcon, Check } from 'lucide-react';
import { Transaction } from '../../types';
import { formatCurrency, formatDate } from '../../utils';

interface TransactionDetailModalProps {
    selectedTx: Transaction;
    onClose: () => void;
    onDashboard: () => void;
    onApprove: (tx: Transaction) => void;
    onReject: (tx: Transaction) => void;
    onRefund: (tx: Transaction) => void;
    rejectionReason: string;
    setRejectionReason: (val: string) => void;
    getRelativeTime: (timestamp: any) => string;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
    selectedTx,
    onClose,
    onDashboard,
    onApprove,
    onReject,
    onRefund,
    rejectionReason,
    setRejectionReason,
    getRelativeTime
}) => {
    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-card w-full max-w-2xl rounded-3xl border border-gray-800 p-8 space-y-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center border-b border-gray-800 pb-5">
                    <div className="flex items-center gap-4">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <CreditCard className="text-brand-500" /> Review Transaction
                        </h3>
                        <button 
                            onClick={onDashboard}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                            <Layout className="w-3 h-3" /> Dashboard
                        </button>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white bg-dark p-2 rounded-full transition"><X className="w-5 h-5" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="bg-dark p-5 rounded-2xl border border-gray-800 shadow-inner">
                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Transaction Details</div>
                            <div className="flex items-end gap-3 mb-4">
                                <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(Math.abs(selectedTx.amount))}</div>
                                <div className={`text-sm font-bold uppercase mb-1 ${selectedTx.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>{selectedTx.type}</div>
                            </div>
                            <div className="space-y-2 text-sm font-mono">
                                <div className="flex justify-between border-b border-gray-800/50 pb-2">
                                    <span className="text-gray-500">Method</span>
                                    <span className="text-white">{selectedTx.method}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800/50 pb-2">
                                    <span className="text-gray-500">User</span>
                                    <span className="text-white">{selectedTx.username || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800/50 pb-2">
                                    <span className="text-gray-500">Email</span>
                                    <span className="text-white text-xs">{selectedTx.userEmail || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800/50 pb-2">
                                    <span className="text-gray-500">User ID</span>
                                    <span className="text-gray-400 text-[10px]">{selectedTx.userId}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800/50 pb-2">
                                    <span className="text-gray-500">Ref ID</span>
                                    <span className="text-brand-300 text-xs">{selectedTx.refId}</span>
                                </div>
                                {selectedTx.confirmedByUsername && (
                                    <div className="flex justify-between border-b border-gray-800/50 pb-2">
                                        <span className="text-brand-400">Confirmed By</span>
                                        <span className="text-brand-300">{selectedTx.confirmedByUsername}</span>
                                    </div>
                                )}
                            </div>
                            
                            {selectedTx.accountDetails && (
                                <div className="mt-5 p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                                    <div className="text-[10px] text-blue-400 uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                                        <Info className="w-3 h-3" /> Account / Transfer Info
                                    </div>
                                    <div className="text-xs text-blue-100 whitespace-pre-wrap font-mono leading-relaxed">{selectedTx.accountDetails}</div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Rejection Reason (Optional)</label>
                            <textarea 
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="w-full bg-dark border border-gray-800 rounded-xl p-4 text-white focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 outline-none h-28 text-sm transition-all"
                                placeholder="Explain why this is being rejected..."
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2">Proof of Payment</div>
                        {selectedTx.proofUrl ? (
                            <div className="relative group rounded-2xl overflow-hidden border border-gray-800 bg-black">
                                <img src={selectedTx.proofUrl || undefined} className="w-full aspect-square object-contain" alt="Proof" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                    <a href={selectedTx.proofUrl} target="_blank" rel="noreferrer" className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all border border-white/10">
                                        <Eye className="w-5 h-5" /> View Full Image
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full aspect-square bg-dark/50 rounded-2xl border-2 border-dashed border-gray-800 flex flex-col items-center justify-center text-gray-600">
                                <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
                                <span className="text-xs font-bold uppercase tracking-widest">No Proof Uploaded</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-4 pt-6 border-t border-gray-800">
                    {selectedTx.status === 'pending' ? (
                        <>
                            <button onClick={() => onReject(selectedTx)} className="flex-1 bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 py-4 rounded-xl font-black transition-all uppercase tracking-widest text-sm">
                                Reject
                            </button>
                            <button onClick={() => onApprove(selectedTx)} className="flex-[2] bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20 py-4 rounded-xl font-black transition-all uppercase tracking-widest text-sm">
                                Approve
                            </button>
                        </>
                    ) : selectedTx.status === 'success' && (selectedTx.type === 'withdrawal' || selectedTx.type === 'entry_fee') ? (
                        <button 
                            onClick={() => onRefund(selectedTx)} 
                            className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-black transition-all uppercase tracking-widest text-sm shadow-lg shadow-orange-600/20"
                        >
                            Manual Refund
                        </button>
                    ) : (
                        <div className="flex gap-4 w-full">
                            <button 
                                onClick={onDashboard} 
                                className="flex-1 bg-brand-600/20 hover:bg-brand-600 text-brand-400 hover:text-white border border-brand-500/30 hover:border-brand-500 py-4 rounded-xl font-black transition-all uppercase tracking-widest text-sm"
                            >
                                Dashboard
                            </button>
                            <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-black transition-all uppercase tracking-widest text-sm">
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;

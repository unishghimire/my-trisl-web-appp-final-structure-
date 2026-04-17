import React, { useState, useEffect } from 'react';
import { X, ArrowDown, ArrowUp, Info, CheckCircle, CreditCard, AlertTriangle } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, writeBatch, increment, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { PaymentMethod, PaymentCategory, SiteSettings, Transaction } from '../types';
import { formatCurrency } from '../utils';
import { walletApiService } from '../services/walletApiService';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'deposit' | 'withdraw';
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, initialTab = 'deposit' }) => {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(initialTab);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Deposit State
  const [selectedCategory, setSelectedCategory] = useState<PaymentCategory | null>(null);
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
    if (isOpen) {
      setActiveTab(initialTab);
      fetchData();
    }
  }, [isOpen, initialTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const catSnap = await getDocs(query(
        collection(db, 'paymentCategories'),
        where('isActive', '==', true)
      ));
      setPaymentCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentCategory)));

      const paySnap = await getDocs(query(
        collection(db, 'paymentMethods'),
        where('isActive', '==', true)
      ));
      setPaymentMethods(paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));

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

  const handleDepositSubmit = async () => {
    if (!user || !selectedMethod || !depositAmount || !senderNumber || !transactionCode) {
      return showToast('Please fill all fields', 'error');
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return showToast('Invalid amount', 'error');

    setIsSubmitting(true);
    try {
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

      showToast('Deposit request submitted!', 'success');
      onClose();
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
      const response = await walletApiService.requestWithdrawal(amount, withdrawMethod, accountDetails);
      if (!response.success) throw new Error(response.error);

      showToast('Withdrawal request submitted!', 'success');
      onClose();
    } catch (error: any) {
      console.error("Error submitting withdrawal:", error);
      showToast(error.message || 'Failed to submit withdrawal request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      <div className="relative w-full sm:max-w-lg bg-gray-900 rounded-t-3xl sm:rounded-3xl border border-gray-800 shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-in max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gradient-to-r from-gray-900 to-black shrink-0">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-500" /> {activeTab === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Loading options...</p>
            </div>
          ) : activeTab === 'deposit' ? (
            <div className="space-y-6">
              {!selectedCategory ? (
                <div className="grid grid-cols-1 gap-3">
                  <h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Select Payment Category</h3>
                  {paymentCategories.map(cat => (
                    <button 
                      key={cat.id} 
                      onClick={() => setSelectedCategory(cat)}
                      className="flex items-center justify-between p-4 bg-card rounded-xl border border-gray-800 hover:border-brand-500 transition group"
                    >
                      <div className="text-left">
                        <div className="font-bold text-white group-hover:text-brand-400 transition">{cat.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-black mt-1">{cat.description}</div>
                      </div>
                      <ArrowDown className="w-4 h-4 text-gray-600 group-hover:text-brand-500 transition -rotate-90" />
                    </button>
                  ))}
                </div>
              ) : !selectedMethod ? (
                <div className="space-y-6 animate-fade-in">
                  <button onClick={() => setSelectedCategory(null)} className="text-brand-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
                    <X className="w-3 h-3" /> Back to Categories
                  </button>
                  <h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Select {selectedCategory.name} Method</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {paymentMethods.filter(pm => pm.categoryId === selectedCategory.id).map(pm => (
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
                            <div className="text-[10px] text-gray-500 uppercase font-black">{pm.type}</div>
                          </div>
                        </div>
                        <ArrowDown className="w-4 h-4 text-gray-600 group-hover:text-brand-500 transition" />
                      </button>
                    ))}
                    {paymentMethods.filter(pm => pm.categoryId === selectedCategory.id).length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm">No payment methods available in this category.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                  <button onClick={() => setSelectedMethod(null)} className="text-brand-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
                    <X className="w-3 h-3" /> Change Method
                  </button>
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-40 h-40 bg-white p-2 rounded-xl">
                      <img src={selectedMethod.qrUrl || undefined} className="w-full h-full object-contain" alt="QR" />
                    </div>
                    <div className="bg-dark p-4 rounded-xl border border-gray-800 w-full">
                      <p className="text-[10px] text-gray-500 uppercase font-black mb-2">Instructions</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{selectedMethod.instructions}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <input 
                      type="number" 
                      placeholder="Amount (Rs.)"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none font-bold"
                    />
                    <input 
                      type="text" 
                      placeholder="Sender Number"
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value)}
                      className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none font-bold"
                    />
                    <input 
                      type="text" 
                      placeholder="Transaction Code / Name"
                      value={transactionCode}
                      onChange={(e) => setTransactionCode(e.target.value)}
                      className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none font-bold"
                    />
                    <button 
                      onClick={handleDepositSubmit}
                      disabled={isSubmitting}
                      className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-black uppercase tracking-widest transition shadow-lg"
                    >
                      {isSubmitting ? 'Processing...' : 'Submit Deposit'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-dark p-4 rounded-xl border border-gray-800 text-center">
                <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Available Balance</p>
                <p className="text-2xl font-black text-brand-400">{formatCurrency(profile?.balance || 0)}</p>
              </div>
              <div className="space-y-4">
                <input 
                  type="number" 
                  placeholder="Withdraw Amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none font-bold"
                />
                <select 
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                  className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none font-bold"
                >
                  <option value="">Select Method</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.name}>{pm.name}</option>
                  ))}
                </select>
                <textarea 
                  placeholder="Account Details (ID, Name, etc.)"
                  value={accountDetails}
                  onChange={(e) => setAccountDetails(e.target.value)}
                  className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none font-bold h-24 resize-none"
                />
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                  <p className="text-[10px] text-yellow-200 uppercase font-black leading-tight">Processed within 24-48 hours. Ensure details are correct.</p>
                </div>
                <button 
                  onClick={handleWithdrawSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-black uppercase tracking-widest transition shadow-lg"
                >
                  {isSubmitting ? 'Processing...' : 'Request Withdrawal'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;

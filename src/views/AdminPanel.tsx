import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, limit, setDoc, serverTimestamp, getDoc, writeBatch, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Transaction, UserProfile, Slide, PromoCode, Game, PaymentMethod, SiteSettings } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { NotificationService } from '../services/NotificationService';
import { Users, ArrowDown, ArrowUp, Settings, Gift, Layout, Check, X, Download, Search, Trash, Edit, Upload, Image as ImageIcon, CreditCard, Eye, QrCode, Plus, Bell, Megaphone } from 'lucide-react';

const AdminPanel: React.FC = () => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState('tab-dashboard');
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [games, setGames] = useState<Game[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ totalBalance: 0, todayDep: 0, todayWith: 0 });
    const [loading, setLoading] = useState(true);

    // Game Form State
    const [isGameModalOpen, setIsGameModalOpen] = useState(false);
    const [editingGame, setEditingGame] = useState<Game | null>(null);
    const [gameName, setGameName] = useState('');
    const [gameLogo, setGameLogo] = useState('');
    const [gameModes, setGameModes] = useState('');
    const [isPublished, setIsPublished] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Payment Method Form State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null);
    const [paymentName, setPaymentName] = useState('');
    const [paymentQr, setPaymentQr] = useState('');
    const [paymentInstructions, setPaymentInstructions] = useState('');
    const [paymentType, setPaymentType] = useState<'eSewa' | 'Khalti' | 'Bank' | 'Other'>('eSewa');
    const [paymentActive, setPaymentActive] = useState(true);
    const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

    // Promo Form State
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
    const [promoCode, setPromoCode] = useState('');
    const [promoAmount, setPromoAmount] = useState('');
    const [promoMaxUses, setPromoMaxUses] = useState('');
    const [promoActive, setPromoActive] = useState(true);

    // Slide Form State
    const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
    const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
    const [slideTitle, setSlideTitle] = useState('');
    const [slideImage, setSlideImage] = useState('');
    const [slideLink, setSlideLink] = useState('');
    const [slideBtnText, setSlideBtnText] = useState('View More');

    // Settings State
    const [minWithdrawal, setMinWithdrawal] = useState('');
    const [supportEmail, setSupportEmail] = useState('');
    const [supportPhone, setSupportPhone] = useState('');
    const [notice, setNotice] = useState('');
    const [isNoticeActive, setIsNoticeActive] = useState(false);

    // Transaction Review State
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // User Management State
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');

    useEffect(() => {
        if (profile?.role !== 'admin') return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch pending transactions
                const txSnap = await getDocs(query(collection(db, 'transactions'), where('status', '==', 'pending')));
                setPendingTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));

                // Fetch all recent transactions
                const allTxSnap = await getDocs(query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(50)));
                setAllTransactions(allTxSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));

                // Fetch slides
                const slideSnap = await getDocs(query(collection(db, 'slides'), orderBy('createdAt', 'desc')));
                setSlides(slideSnap.docs.map(d => ({ id: d.id, ...d.data() } as Slide)));

                // Fetch promo codes
                const promoSnap = await getDocs(query(collection(db, 'promocodes'), orderBy('createdAt', 'desc')));
                setPromoCodes(promoSnap.docs.map(d => ({ id: d.id, ...d.data() } as PromoCode)));

                // Fetch games
                const gameSnap = await getDocs(query(collection(db, 'games'), orderBy('createdAt', 'desc')));
                setGames(gameSnap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));

                // Fetch payment methods
                const paySnap = await getDocs(query(collection(db, 'paymentMethods'), orderBy('createdAt', 'desc')));
                setPaymentMethods(paySnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));

                // Fetch stats
                const usersSnap = await getDocs(collection(db, 'users'));
                let totalBal = 0;
                usersSnap.forEach(d => totalBal += (d.data().balance || 0));

                // Fetch site settings
                const settingsSnap = await getDoc(doc(db, 'settings', 'site'));
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data() as SiteSettings;
                    setSiteSettings(data);
                    setMinWithdrawal(data.minWithdrawal.toString());
                    setSupportEmail(data.supportEmail);
                    setSupportPhone(data.supportPhone);
                    setNotice(data.notice);
                    setIsNoticeActive(data.isNoticeActive);
                }

                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                const todayTxSnap = await getDocs(query(collection(db, 'transactions'), where('timestamp', '>=', startOfDay)));
                let dep = 0, withdr = 0;
                todayTxSnap.forEach(d => {
                    const data = d.data();
                    if (data.status === 'success') {
                        if (data.type === 'deposit') dep += data.amount;
                        if (data.type === 'withdrawal') withdr += Math.abs(data.amount);
                    }
                });

                setStats({ totalBalance: totalBal, todayDep: dep, todayWith: withdr });
            } catch (error) {
                console.error("Error fetching admin data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [profile]);

    const handleApproveTx = async (tx: Transaction) => {
        try {
            const batch = writeBatch(db);
            const txRef = doc(db, 'transactions', tx.id);
            const userRef = doc(db, 'users', tx.userId);

            if (tx.type === 'deposit') {
                batch.update(userRef, { balance: increment(tx.amount) });
            }
            batch.update(txRef, { status: 'success' });
            await batch.commit();

            // Send Notification
            await NotificationService.create(
                tx.userId,
                'Transaction Approved',
                `Your ${tx.type} of ${formatCurrency(tx.amount)} has been approved.`,
                'success',
                '/wallet'
            );

            alert('Transaction Approved');
            setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
        } catch (error) {
            console.error("Error approving transaction:", error);
        }
    };

    const handleRejectTx = async (tx: Transaction) => {
        if (!rejectionReason && !window.confirm('Reject without reason?')) return;
        try {
            const batch = writeBatch(db);
            const txRef = doc(db, 'transactions', tx.id);
            const userRef = doc(db, 'users', tx.userId);

            if (tx.type === 'withdrawal') {
                batch.update(userRef, { balance: increment(Math.abs(tx.amount)) });
            }
            batch.update(txRef, { 
                status: 'rejected',
                rejectionReason: rejectionReason || 'No reason provided'
            });
            await batch.commit();

            // Send Notification
            await NotificationService.create(
                tx.userId,
                'Transaction Rejected',
                `Your ${tx.type} of ${formatCurrency(tx.amount)} was rejected. Reason: ${rejectionReason || 'No reason provided'}`,
                'alert',
                '/wallet'
            );

            alert('Transaction Rejected');
            setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
            setSelectedTx(null);
            setRejectionReason('');
        } catch (error) {
            console.error("Error rejecting transaction:", error);
        }
    };

    const handleAdjustBalance = async () => {
        if (!selectedUser || !adjustmentAmount) return;
        const amount = parseFloat(adjustmentAmount);
        if (isNaN(amount)) return alert('Invalid amount');

        try {
            const finalAmount = adjustmentType === 'add' ? amount : -amount;
            await updateDoc(doc(db, 'users', selectedUser.uid), {
                balance: increment(finalAmount)
            });

            // Create a manual adjustment transaction
            const txRef = doc(collection(db, 'transactions'));
            await setDoc(txRef, {
                userId: selectedUser.uid,
                amount: finalAmount,
                type: 'prize', // Using prize as a generic adjustment type or add 'adjustment'
                method: 'Manual Adjustment',
                status: 'success',
                timestamp: serverTimestamp(),
                desc: `Admin Adjustment: ${adjustmentType === 'add' ? 'Added' : 'Subtracted'} ${amount}`
            });

            alert('Balance Adjusted');
            setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, balance: u.balance + finalAmount } : u));
            setSelectedUser(null);
            setAdjustmentAmount('');
        } catch (error) {
            console.error("Error adjusting balance:", error);
        }
    };

    const handleSavePayment = async () => {
        if (!paymentName || !paymentQr || !paymentInstructions) return alert('Please fill all fields');
        
        try {
            const payData = {
                name: paymentName,
                qrUrl: paymentQr,
                instructions: paymentInstructions,
                type: paymentType,
                isActive: paymentActive,
                createdAt: editingPayment ? editingPayment.createdAt : serverTimestamp()
            };

            if (editingPayment) {
                await updateDoc(doc(db, 'paymentMethods', editingPayment.id), payData);
                setPaymentMethods(prev => prev.map(p => p.id === editingPayment.id ? { ...p, ...payData } : p));
                alert('Payment Method Updated');
            } else {
                const newRef = doc(collection(db, 'paymentMethods'));
                await setDoc(newRef, payData);
                setPaymentMethods(prev => [{ id: newRef.id, ...payData }, ...prev]);
                alert('Payment Method Added');
            }
            
            setIsPaymentModalOpen(false);
            setEditingPayment(null);
            setPaymentName('');
            setPaymentQr('');
            setPaymentInstructions('');
        } catch (error) {
            console.error("Error saving payment method:", error);
        }
    };

    const handleDeletePayment = async (id: string) => {
        if (!window.confirm('Delete this payment method?')) return;
        try {
            await deleteDoc(doc(db, 'paymentMethods', id));
            setPaymentMethods(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error("Error deleting payment method:", error);
        }
    };

    const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const storageRef = ref(storage, `payments/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setPaymentQr(url);
        } catch (error) {
            console.error("Error uploading QR:", error);
            alert("Failed to upload QR");
        } finally {
            setUploading(false);
        }
    };

    const handleSearchUsers = async () => {
        try {
            let q = query(collection(db, 'users'), limit(20));
            if (searchQuery) {
                q = query(collection(db, 'users'), where('username', '>=', searchQuery), where('username', '<=', searchQuery + '\uf8ff'), limit(20));
            }
            const snap = await getDocs(q);
            setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
        } catch (error) {
            console.error("Error searching users:", error);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const storageRef = ref(storage, `games/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setGameLogo(url);
        } catch (error) {
            console.error("Error uploading logo:", error);
            alert("Failed to upload logo");
        } finally {
            setUploading(false);
        }
    };

    const handleSaveGame = async () => {
        if (!gameName || !gameLogo || !gameModes) return alert('Please fill all fields');
        const modesArray = gameModes.split(',').map(m => m.trim()).filter(m => m !== '');
        
        try {
            const gameData = {
                name: gameName,
                logoUrl: gameLogo,
                modes: modesArray,
                isPublished: isPublished,
                createdAt: editingGame ? editingGame.createdAt : serverTimestamp()
            };

            if (editingGame) {
                await updateDoc(doc(db, 'games', editingGame.id), gameData);
                setGames(prev => prev.map(g => g.id === editingGame.id ? { ...g, ...gameData } : g));
                alert('Game Updated');
            } else {
                const newGameRef = doc(collection(db, 'games'));
                await setDoc(newGameRef, gameData);
                setGames(prev => [{ id: newGameRef.id, ...gameData }, ...prev]);
                alert('Game Added');
            }
            
            setIsGameModalOpen(false);
            setEditingGame(null);
            setGameName('');
            setGameLogo('');
            setGameModes('');
        } catch (error) {
            console.error("Error saving game:", error);
        }
    };

    const handleSavePromo = async () => {
        if (!promoCode || !promoAmount || !promoMaxUses) return alert('Please fill all fields');
        try {
            const promoData = {
                code: promoCode.toUpperCase(),
                amount: parseFloat(promoAmount),
                maxUses: parseInt(promoMaxUses),
                currentUses: editingPromo ? editingPromo.currentUses : 0,
                isActive: promoActive,
                createdAt: editingPromo ? editingPromo.createdAt : serverTimestamp()
            };

            if (editingPromo) {
                await updateDoc(doc(db, 'promocodes', editingPromo.id), promoData);
                setPromoCodes(prev => prev.map(p => p.id === editingPromo.id ? { ...p, ...promoData } : p));
                alert('Promo Code Updated');
            } else {
                const newRef = doc(collection(db, 'promocodes'));
                await setDoc(newRef, promoData);
                setPromoCodes(prev => [{ id: newRef.id, ...promoData }, ...prev]);
                alert('Promo Code Added');
            }
            setIsPromoModalOpen(false);
            setEditingPromo(null);
            setPromoCode('');
            setPromoAmount('');
            setPromoMaxUses('');
        } catch (error) {
            console.error("Error saving promo:", error);
        }
    };

    const handleDeletePromo = async (id: string) => {
        if (!window.confirm('Delete this promo code?')) return;
        try {
            await deleteDoc(doc(db, 'promocodes', id));
            setPromoCodes(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error("Error deleting promo:", error);
        }
    };

    const handleSaveSlide = async () => {
        if (!slideTitle || !slideImage || !slideLink) return alert('Please fill all fields');
        try {
            const slideData = {
                title: slideTitle,
                imageUrl: slideImage,
                link: slideLink,
                buttonText: slideBtnText,
                createdAt: editingSlide ? editingSlide.createdAt : serverTimestamp()
            };

            if (editingSlide) {
                await updateDoc(doc(db, 'slides', editingSlide.id), slideData);
                setSlides(prev => prev.map(s => s.id === editingSlide.id ? { ...s, ...slideData } : s));
                alert('Slide Updated');
            } else {
                const newRef = doc(collection(db, 'slides'));
                await setDoc(newRef, slideData);
                setSlides(prev => [{ id: newRef.id, ...slideData }, ...prev]);
                alert('Slide Added');
            }
            setIsSlideModalOpen(false);
            setEditingSlide(null);
            setSlideTitle('');
            setSlideImage('');
            setSlideLink('');
        } catch (error) {
            console.error("Error saving slide:", error);
        }
    };

    const handleDeleteSlide = async (id: string) => {
        if (!window.confirm('Delete this slide?')) return;
        try {
            await deleteDoc(doc(db, 'slides', id));
            setSlides(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error("Error deleting slide:", error);
        }
    };

    const handleSaveSettings = async () => {
        try {
            const settingsData = {
                minWithdrawal: parseFloat(minWithdrawal),
                supportEmail,
                supportPhone,
                notice,
                isNoticeActive,
                updatedAt: serverTimestamp()
            };
            await setDoc(doc(db, 'settings', 'site'), settingsData);
            setSiteSettings(settingsData as any);
            alert('Settings Saved');
        } catch (error) {
            console.error("Error saving settings:", error);
        }
    };

    const handleSlideUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const storageRef = ref(storage, `slides/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setSlideImage(url);
        } catch (error) {
            console.error("Error uploading slide:", error);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteGame = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this game?')) return;
        try {
            await deleteDoc(doc(db, 'games', id));
            setGames(prev => prev.filter(g => g.id !== id));
            alert('Game Deleted');
        } catch (error) {
            console.error("Error deleting game:", error);
        }
    };

    const openEditGame = (game: Game) => {
        setEditingGame(game);
        setGameName(game.name);
        setGameLogo(game.logoUrl);
        setGameModes(game.modes.join(', '));
        setIsPublished(game.isPublished);
        setIsGameModalOpen(true);
    };

    if (profile?.role !== 'admin') return <div className="text-center text-red-500 mt-10">Restricted Area</div>;

    return (
        <div className="animate-fade-in max-w-6xl mx-auto">
            <div className="flex border-b border-gray-700 mb-6 overflow-x-auto">
                {['dashboard', 'transactions', 'users', 'games', 'payments', 'promo', 'settings'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(`tab-${tab}`)} 
                        className={`px-6 py-3 font-bold text-sm transition whitespace-nowrap ${activeTab === `tab-${tab}` ? 'text-white border-b-2 border-brand-500' : 'text-gray-400 hover:text-white'}`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {activeTab === 'tab-dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className="bg-card p-4 rounded-xl border border-gray-800 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center text-xl border border-blue-500/30">
                                <Users />
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase font-bold">Total User Holdings</div>
                                <div className="text-xl font-bold text-white">{formatCurrency(stats.totalBalance)}</div>
                            </div>
                        </div>
                        <div className="bg-card p-4 rounded-xl border border-gray-800 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-green-900/30 text-green-400 flex items-center justify-center text-xl border border-green-500/30">
                                <ArrowDown />
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase font-bold">Today's Deposits</div>
                                <div className="text-xl font-bold text-white">{formatCurrency(stats.todayDep)}</div>
                            </div>
                        </div>
                        <div className="bg-card p-4 rounded-xl border border-gray-800 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-red-900/30 text-red-400 flex items-center justify-center text-xl border border-red-500/30">
                                <ArrowUp />
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase font-bold">Today's Withdrawals</div>
                                <div className="text-xl font-bold text-white">{formatCurrency(stats.todayWith)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card p-4 rounded-xl border border-gray-800 lg:col-span-2">
                        <h2 className="font-bold text-white mb-4 border-b border-gray-700 pb-2">Pending Transactions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-96 overflow-y-auto custom-scrollbar content-start">
                            {pendingTransactions.length > 0 ? (
                                pendingTransactions.map(t => (
                                    <div key={t.id} className="bg-surface p-4 rounded-xl mb-3 border border-gray-700 shadow-md">
                                        <div className="flex justify-between items-start mb-3 border-b border-gray-600 pb-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold ${t.type === 'deposit' ? 'text-green-400' : 'text-red-400'} uppercase text-sm`}>{t.type}</span>
                                                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-300 border border-gray-600">{t.method}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-500 mt-1">{formatDate(t.timestamp)}</div>
                                            </div>
                                            <div className="text-xl font-bold text-white font-mono">{formatCurrency(Math.abs(t.amount))}</div>
                                        </div>
                                        <div className="text-xs text-gray-400 mb-4 break-all">
                                            <span className="text-gray-600">REF:</span> <span className="text-brand-200 select-all">{t.refId}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => handleApproveTx(t)} className="bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition">
                                                <Check className="w-4 h-4" /> Approve
                                            </button>
                                            <button onClick={() => setSelectedTx(t)} className="bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition">
                                                <Eye className="w-4 h-4" /> Review
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full text-gray-500 text-sm text-center py-10 flex flex-col items-center">
                                    <Check className="text-4xl mb-3 text-gray-700" /> All transactions cleared!
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedTx && (
                        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-2xl rounded-2xl border border-gray-800 p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                                <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                    <h3 className="text-xl font-bold text-white uppercase tracking-widest">Review Transaction</h3>
                                    <button onClick={() => setSelectedTx(null)} className="text-gray-500 hover:text-white"><X /></button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="bg-dark p-4 rounded-xl border border-gray-800">
                                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Details</div>
                                            <div className="text-white font-bold">{selectedTx.type.toUpperCase()} - {formatCurrency(selectedTx.amount)}</div>
                                            <div className="text-sm text-gray-400 mt-1">Method: {selectedTx.method}</div>
                                            <div className="text-sm text-gray-400">User ID: {selectedTx.userId}</div>
                                            {selectedTx.accountDetails && (
                                                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                                                    <div className="text-[10px] text-blue-400 uppercase font-bold mb-1">Withdrawal Account</div>
                                                    <div className="text-xs text-white whitespace-pre-wrap">{selectedTx.accountDetails}</div>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Rejection Reason (Optional)</label>
                                            <textarea 
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none h-24 text-sm"
                                                placeholder="Explain why this was rejected..."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="text-xs text-gray-500 uppercase font-bold mb-1">Proof of Payment</div>
                                        {selectedTx.proofUrl ? (
                                            <div className="relative group">
                                                <img src={selectedTx.proofUrl} className="w-full aspect-square object-contain bg-black rounded-xl border border-gray-800" alt="Proof" />
                                                <a href={selectedTx.proofUrl} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl">
                                                    <Download className="text-white" />
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="w-full aspect-square bg-dark rounded-xl border border-gray-800 flex items-center justify-center text-gray-600 text-sm italic">
                                                No proof uploaded
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => handleRejectTx(selectedTx)} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold transition uppercase text-sm">
                                        Reject Transaction
                                    </button>
                                    <button onClick={() => handleApproveTx(selectedTx)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition uppercase text-sm">
                                        Approve Transaction
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="bg-card p-4 rounded-xl border border-gray-800">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                                <h2 className="font-bold text-white">Promotion Slider</h2>
                                <button 
                                    onClick={() => {
                                        setEditingSlide(null);
                                        setSlideTitle('');
                                        setSlideImage('');
                                        setSlideLink('');
                                        setSlideBtnText('View More');
                                        setIsSlideModalOpen(true);
                                    }}
                                    className="bg-brand-600 px-2 py-1 rounded text-xs text-white"
                                >
                                    Add New
                                </button>
                            </div>
                            <div className="h-48 overflow-y-auto custom-scrollbar">
                                {slides.length > 0 ? (
                                    slides.map(s => (
                                        <div key={s.id} className="flex justify-between items-center bg-dark p-2 rounded mb-2 border border-gray-700">
                                            <div className="flex items-center gap-2">
                                                <img src={s.imageUrl} className="w-10 h-6 object-cover rounded" alt={s.title} />
                                                <span className="text-white text-sm truncate w-32">{s.title}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => {
                                                    setEditingSlide(s);
                                                    setSlideTitle(s.title);
                                                    setSlideImage(s.imageUrl);
                                                    setSlideLink(s.link);
                                                    setSlideBtnText(s.buttonText);
                                                    setIsSlideModalOpen(true);
                                                }} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteSlide(s.id)} className="text-red-400 hover:text-white"><Trash className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-sm text-center">No custom slides.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {isSlideModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingSlide ? 'Edit Slide' : 'Add Slide'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Title</label>
                                        <input type="text" value={slideTitle} onChange={e => setSlideTitle(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Image</label>
                                        <div className="flex gap-4 items-center">
                                            {slideImage ? (
                                                <img src={slideImage} className="w-20 h-12 object-cover rounded border border-gray-700" alt="Preview" />
                                            ) : (
                                                <label className="w-20 h-12 border-2 border-dashed border-gray-700 rounded flex items-center justify-center cursor-pointer hover:border-brand-500 transition">
                                                    <Upload className="w-4 h-4 text-gray-500" />
                                                    <input type="file" className="hidden" onChange={handleSlideUpload} />
                                                </label>
                                            )}
                                            <input type="text" value={slideImage} onChange={e => setSlideImage(e.target.value)} className="flex-grow bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none text-xs" placeholder="Or paste URL..." />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Link</label>
                                        <input type="text" value={slideLink} onChange={e => setSlideLink(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" placeholder="/tournaments or https://..." />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Button Text</label>
                                        <input type="text" value={slideBtnText} onChange={e => setSlideBtnText(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => setIsSlideModalOpen(false)} className="flex-1 bg-gray-800 py-3 rounded-xl font-bold">Cancel</button>
                                    <button onClick={handleSaveSlide} className="flex-1 bg-brand-600 py-3 rounded-xl font-bold">Save</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'tab-transactions' && (
                <div className="bg-card p-6 rounded-xl border border-gray-800">
                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-b border-gray-700 pb-2">Recent Transactions</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-gray-800">
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">User ID</th>
                                    <th className="py-3 px-4">Type</th>
                                    <th className="py-3 px-4">Method</th>
                                    <th className="py-3 px-4">Amount</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Ref ID</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs">
                                {allTransactions.map(t => (
                                    <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                                        <td className="py-3 px-4 text-gray-400">{formatDate(t.timestamp)}</td>
                                        <td className="py-3 px-4 text-gray-300 font-mono">{t.userId.slice(0, 8)}...</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                                                t.type === 'deposit' ? 'bg-green-900/30 text-green-400 border border-green-500/30' :
                                                t.type === 'withdrawal' ? 'bg-red-900/30 text-red-400 border border-red-500/30' :
                                                'bg-blue-900/30 text-blue-400 border border-blue-500/30'
                                            }`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-400">{t.method}</td>
                                        <td className={`py-3 px-4 font-bold ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatCurrency(t.amount)}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                                                t.status === 'success' ? 'bg-green-600 text-white' :
                                                t.status === 'pending' ? 'bg-yellow-600 text-white' :
                                                'bg-red-600 text-white'
                                            }`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-500 font-mono">{t.refId || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'tab-users' && (
                <div className="bg-card p-6 rounded-xl border border-gray-800">
                    <div className="flex gap-2 mb-6">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by Username..." 
                            className="flex-grow bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                        />
                        <button onClick={handleSearchUsers} className="bg-brand-600 px-6 rounded-lg font-bold text-white flex items-center gap-2">
                            <Search className="w-4 h-4" /> Search
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {users.length > 0 ? (
                            users.map(u => (
                                <div key={u.uid} className="bg-gray-900 p-3 rounded mb-2 border border-gray-700 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-white">{u.username} <span className="text-xs text-gray-500">({u.role})</span></div>
                                        <div className="text-xs text-gray-400">{u.email} | Bal: {formatCurrency(u.balance)}</div>
                                        <div className="text-[10px] text-gray-600">UID: {u.uid}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setSelectedUser(u)} className="bg-blue-600 px-3 py-1 rounded text-xs text-white">Manage</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-center py-10">Search for a user to manage their account.</p>
                        )}
                    </div>

                    {selectedUser && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-6 shadow-2xl">
                                <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                    <h3 className="text-xl font-bold text-white uppercase tracking-widest">Manage User</h3>
                                    <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white"><X /></button>
                                </div>

                                <div className="bg-dark p-4 rounded-xl border border-gray-800">
                                    <div className="text-white font-bold">{selectedUser.username}</div>
                                    <div className="text-sm text-gray-400">{selectedUser.email}</div>
                                    <div className="text-sm text-brand-400 mt-2 font-mono">Current Balance: {formatCurrency(selectedUser.balance)}</div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs text-gray-500 uppercase font-bold block">Adjust Balance</label>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setAdjustmentType('add')}
                                            className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase border ${adjustmentType === 'add' ? 'bg-green-600 border-green-500 text-white' : 'bg-dark border-gray-700 text-gray-500'}`}
                                        >
                                            Add
                                        </button>
                                        <button 
                                            onClick={() => setAdjustmentType('subtract')}
                                            className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase border ${adjustmentType === 'subtract' ? 'bg-red-600 border-red-500 text-white' : 'bg-dark border-gray-700 text-gray-500'}`}
                                        >
                                            Subtract
                                        </button>
                                    </div>
                                    <input 
                                        type="number" 
                                        value={adjustmentAmount}
                                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                                        placeholder="Enter amount..."
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                    />
                                    <button onClick={handleAdjustBalance} className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition uppercase text-sm">
                                        Confirm Adjustment
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'tab-games' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Game Management</h2>
                        <button 
                            onClick={() => {
                                setEditingGame(null);
                                setGameName('');
                                setGameLogo('');
                                setGameModes('');
                                setIsPublished(true);
                                setIsGameModalOpen(true);
                            }}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Game
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {games.map(game => (
                            <div key={game.id} className="bg-card p-4 rounded-xl border border-gray-800 flex items-center gap-4">
                                <img src={game.logoUrl} className="w-16 h-16 object-cover rounded-lg border border-gray-700" alt={game.name} />
                                <div className="flex-grow">
                                    <h3 className="font-bold text-white">{game.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2 h-2 rounded-full ${game.isPublished ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                                        <span className="text-[10px] text-gray-500 uppercase font-bold">{game.isPublished ? 'Published' : 'Draft'}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1 truncate w-32">
                                        {game.modes.join(', ')}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => openEditGame(game)} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteGame(game.id)} className="text-red-400 hover:text-white"><Trash className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isGameModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingGame ? 'Edit Game' : 'Add Game'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Game Name</label>
                                        <input 
                                            type="text" 
                                            value={gameName}
                                            onChange={(e) => setGameName(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                            placeholder="e.g. PUBG Mobile"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Logo/Banner</label>
                                        <div className="flex gap-4 items-center">
                                            {gameLogo ? (
                                                <div className="relative group">
                                                    <img src={gameLogo} className="w-20 h-20 object-cover rounded-lg border border-gray-700" alt="Preview" />
                                                    <button 
                                                        onClick={() => setGameLogo('')}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="w-20 h-20 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 transition text-gray-500 hover:text-brand-500">
                                                    <Upload className="w-6 h-6" />
                                                    <span className="text-[10px] mt-1 font-bold">UPLOAD</span>
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                                                </label>
                                            )}
                                            <div className="flex-grow">
                                                <input 
                                                    type="text" 
                                                    value={gameLogo}
                                                    onChange={(e) => setGameLogo(e.target.value)}
                                                    className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none text-sm"
                                                    placeholder="Or paste image URL..."
                                                />
                                                {uploading && <div className="text-[10px] text-brand-400 mt-1 animate-pulse">Uploading...</div>}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Game Modes (Comma separated)</label>
                                        <textarea 
                                            value={gameModes}
                                            onChange={(e) => setGameModes(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none h-24"
                                            placeholder="Battle Royale, Ranked, Arcade..."
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            id="isPublished"
                                            checked={isPublished}
                                            onChange={(e) => setIsPublished(e.target.checked)}
                                            className="w-4 h-4 accent-brand-500"
                                        />
                                        <label htmlFor="isPublished" className="text-sm text-gray-300 font-bold uppercase">Published (Visible to users)</label>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button 
                                        onClick={() => setIsGameModalOpen(false)}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSaveGame}
                                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        {editingGame ? 'Update' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'tab-payments' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Payment Methods (QR Codes)</h2>
                        <button 
                            onClick={() => {
                                setEditingPayment(null);
                                setPaymentName('');
                                setPaymentQr('');
                                setPaymentInstructions('');
                                setPaymentType('eSewa');
                                setPaymentActive(true);
                                setIsPaymentModalOpen(true);
                            }}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Method
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paymentMethods.map(pm => (
                            <div key={pm.id} className="bg-card p-4 rounded-xl border border-gray-800 flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-dark rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
                                        <img src={pm.qrUrl} className="w-full h-full object-contain" alt="QR" />
                                    </div>
                                    <div className="flex-grow">
                                        <h3 className="font-bold text-white">{pm.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`w-2 h-2 rounded-full ${pm.isActive ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">{pm.type} | {pm.isActive ? 'Active' : 'Inactive'}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button onClick={() => {
                                            setEditingPayment(pm);
                                            setPaymentName(pm.name);
                                            setPaymentQr(pm.qrUrl);
                                            setPaymentInstructions(pm.instructions);
                                            setPaymentType(pm.type);
                                            setPaymentActive(pm.isActive);
                                            setIsPaymentModalOpen(true);
                                        }} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeletePayment(pm.id)} className="text-red-400 hover:text-white"><Trash className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="text-[10px] text-gray-500 bg-dark p-2 rounded border border-gray-700 h-16 overflow-y-auto">
                                    {pm.instructions}
                                </div>
                            </div>
                        ))}
                    </div>

                    {isPaymentModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingPayment ? 'Edit Payment Method' : 'Add Payment Method'}
                                </h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Method Name</label>
                                        <input 
                                            type="text" 
                                            value={paymentName}
                                            onChange={(e) => setPaymentName(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                            placeholder="e.g. eSewa (Personal)"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Type</label>
                                        <select 
                                            value={paymentType}
                                            onChange={(e) => setPaymentType(e.target.value as any)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                        >
                                            <option value="eSewa">eSewa</option>
                                            <option value="Khalti">Khalti</option>
                                            <option value="Bank">Bank Transfer</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">QR Code Image</label>
                                        <div className="flex gap-4 items-center">
                                            {paymentQr ? (
                                                <div className="relative group">
                                                    <img src={paymentQr} className="w-20 h-20 object-contain bg-white rounded-lg border border-gray-700" alt="QR Preview" />
                                                    <button 
                                                        onClick={() => setPaymentQr('')}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="w-20 h-20 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 transition text-gray-500 hover:text-brand-500">
                                                    <Upload className="w-6 h-6" />
                                                    <span className="text-[10px] mt-1 font-bold">QR</span>
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleQrUpload} disabled={uploading} />
                                                </label>
                                            )}
                                            <div className="flex-grow">
                                                <input 
                                                    type="text" 
                                                    value={paymentQr}
                                                    onChange={(e) => setPaymentQr(e.target.value)}
                                                    className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none text-sm"
                                                    placeholder="Or paste QR URL..."
                                                />
                                                {uploading && <div className="text-[10px] text-brand-400 mt-1 animate-pulse">Uploading...</div>}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Instructions (Account Name, Number, etc.)</label>
                                        <textarea 
                                            value={paymentInstructions}
                                            onChange={(e) => setPaymentInstructions(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none h-24"
                                            placeholder="Account Name: John Doe&#10;Number: 98XXXXXXXX"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            id="paymentActive"
                                            checked={paymentActive}
                                            onChange={(e) => setPaymentActive(e.target.checked)}
                                            className="w-4 h-4 accent-brand-500"
                                        />
                                        <label htmlFor="paymentActive" className="text-sm text-gray-300 font-bold uppercase">Active (Visible to users)</label>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button 
                                        onClick={() => setIsPaymentModalOpen(false)}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSavePayment}
                                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition"
                                    >
                                        {editingPayment ? 'Update' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'tab-promo' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Promo Codes</h2>
                        <button 
                            onClick={() => {
                                setEditingPromo(null);
                                setPromoCode('');
                                setPromoAmount('');
                                setPromoMaxUses('');
                                setPromoActive(true);
                                setIsPromoModalOpen(true);
                            }}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Promo
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {promoCodes.map(p => (
                            <div key={p.id} className="bg-card p-4 rounded-xl border border-gray-800">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-xl font-black text-brand-400 tracking-tighter">{p.code}</div>
                                        <div className="text-xs text-gray-500 font-bold uppercase">{p.isActive ? 'Active' : 'Inactive'}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => {
                                            setEditingPromo(p);
                                            setPromoCode(p.code);
                                            setPromoAmount(p.amount.toString());
                                            setPromoMaxUses(p.maxUses.toString());
                                            setPromoActive(p.isActive);
                                            setIsPromoModalOpen(true);
                                        }} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeletePromo(p.id)} className="text-red-400 hover:text-white"><Trash className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="bg-dark p-2 rounded border border-gray-700">
                                        <div className="text-[10px] text-gray-500 uppercase font-bold">Amount</div>
                                        <div className="text-sm text-white font-bold">{formatCurrency(p.amount)}</div>
                                    </div>
                                    <div className="bg-dark p-2 rounded border border-gray-700">
                                        <div className="text-[10px] text-gray-500 uppercase font-bold">Uses</div>
                                        <div className="text-sm text-white font-bold">{p.currentUses} / {p.maxUses}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isPromoModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingPromo ? 'Edit Promo Code' : 'Add Promo Code'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Code</label>
                                        <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none uppercase" placeholder="WELCOME50" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Amount</label>
                                        <input type="number" value={promoAmount} onChange={e => setPromoAmount(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Max Uses</label>
                                        <input type="number" value={promoMaxUses} onChange={e => setPromoMaxUses(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" id="promoActive" checked={promoActive} onChange={e => setPromoActive(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                                        <label htmlFor="promoActive" className="text-sm text-gray-300 font-bold uppercase">Active</label>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => setIsPromoModalOpen(false)} className="flex-1 bg-gray-800 py-3 rounded-xl font-bold">Cancel</button>
                                    <button onClick={handleSavePromo} className="flex-1 bg-brand-600 py-3 rounded-xl font-bold">Save</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'tab-settings' && (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-8">
                    <div className="border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Settings className="text-brand-500" /> Site Configuration
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase font-bold">Manage global application settings and support info.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Financial Settings</h3>
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Minimum Withdrawal Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rs.</span>
                                    <input 
                                        type="number" 
                                        value={minWithdrawal}
                                        onChange={e => setMinWithdrawal(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-brand-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">Support Info</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Support Email</label>
                                    <input 
                                        type="email" 
                                        value={supportEmail}
                                        onChange={e => setSupportEmail(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Support Phone / WhatsApp</label>
                                    <input 
                                        type="text" 
                                        value={supportPhone}
                                        onChange={e => setSupportPhone(e.target.value)}
                                        className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="col-span-full space-y-6">
                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3">System Notice</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Megaphone className="text-brand-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Display Site-wide Notice</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={isNoticeActive} onChange={e => setIsNoticeActive(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                                    </label>
                                </div>
                                <textarea 
                                    value={notice}
                                    onChange={e => setNotice(e.target.value)}
                                    className="w-full bg-surface border border-gray-700 rounded-lg p-4 text-white focus:border-brand-500 outline-none h-32"
                                    placeholder="Enter notice message here... (e.g. Scheduled maintenance at 10 PM)"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-800 flex justify-end">
                        <button 
                            onClick={handleSaveSettings}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-10 py-3 rounded-xl font-bold transition shadow-lg shadow-brand-600/20 uppercase tracking-widest"
                        >
                            Save All Settings
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;

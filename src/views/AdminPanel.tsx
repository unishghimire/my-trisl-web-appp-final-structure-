import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, limit, setDoc, serverTimestamp, getDoc, writeBatch, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Transaction, UserProfile, Slide, PromoCode, Game, PaymentMethod, SiteSettings, OrgApplication, Tournament } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { NotificationService } from '../services/NotificationService';
import ConfirmModal from '../components/ConfirmModal';
import TournamentCreateModal from '../components/TournamentCreateModal';
import { useInvisibleImage } from '../hooks/useInvisibleImage';
import { DEFAULT_BANNER, NEXPLAY_LOGO } from '../constants';
import { Users, ArrowDown, ArrowUp, Settings, Gift, Layout, Check, X, Download, Search, Trash, Edit, Upload, Image as ImageIcon, CreditCard, Eye, QrCode, Plus, Bell, Megaphone, Trophy, Gamepad2, Tag, Sliders, Info, ExternalLink, CheckCircle } from 'lucide-react';

const AdminPanel: React.FC = () => {
    const { profile } = useAuth();
    const { showToast } = useNotification();
    const [activeTab, setActiveTab] = useState('tab-dashboard');
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
    const [orgApplications, setOrgApplications] = useState<OrgApplication[]>([]);
    const [organizers, setOrganizers] = useState<UserProfile[]>([]);
    const [orgTournaments, setOrgTournaments] = useState<Tournament[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
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
    const [orgFormDescription, setOrgFormDescription] = useState('');

    const { handlePaste: handlePasteSlide, handleDrop: handleDropSlide, handleDragOver: handleDragOverSlide } = useInvisibleImage({
        onUploadStart: () => setUploading(true),
        onUploadEnd: () => setUploading(false),
        onUploadSuccess: (url) => setSlideImage(url),
        onError: (err) => showToast(err, 'error')
    });

    const { handlePaste: handlePasteGame, handleDrop: handleDropGame, handleDragOver: handleDragOverGame } = useInvisibleImage({
        onUploadStart: () => setUploading(true),
        onUploadEnd: () => setUploading(false),
        onUploadSuccess: (url) => setGameLogo(url),
        onError: (err) => showToast(err, 'error')
    });

    const { handlePaste: handlePastePayment, handleDrop: handleDropPayment, handleDragOver: handleDragOverPayment } = useInvisibleImage({
        onUploadStart: () => setUploading(true),
        onUploadEnd: () => setUploading(false),
        onUploadSuccess: (url) => setPaymentQr(url),
        onError: (err) => showToast(err, 'error')
    });

    // Transaction Review State
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // User Management State
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');

    // Organizer Edit State
    const [isOrgEditModalOpen, setIsOrgEditModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<UserProfile | null>(null);
    const [orgEmail, setOrgEmail] = useState('');
    const [orgDiscord, setOrgDiscord] = useState('');
    const [orgYoutube, setOrgYoutube] = useState('');
    const [orgWhatsapp, setOrgWhatsapp] = useState('');
    const [orgNameEdit, setOrgNameEdit] = useState('');

    // Transaction Filter State
    const [txFilterStatus, setTxFilterStatus] = useState<'all' | 'pending' | 'success' | 'rejected' | 'refunded'>('all');
    const [txFilterType, setTxFilterType] = useState<'all' | 'deposit' | 'withdrawal' | 'prize' | 'refund' | 'entry_fee'>('all');
    const [txFilterTournament, setTxFilterTournament] = useState<string>('all');
    const [txSearchUser, setTxSearchUser] = useState('');

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    useEffect(() => {
        if (profile?.role !== 'admin') return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch pending transactions
                const txSnap = await getDocs(query(collection(db, 'transactions'), where('status', '==', 'pending')));
                setPendingTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));

                // Fetch all recent transactions
                const allTxSnap = await getDocs(query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(100)));
                setAllTransactions(allTxSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));

                // Fetch all tournaments for filtering
                const tourneySnap = await getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc')));
                setAllTournaments(tourneySnap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)));

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

                // Fetch Org Applications
                const orgAppSnap = await getDocs(query(collection(db, 'orgApplications'), where('status', '==', 'pending'), orderBy('timestamp', 'desc')));
                setOrgApplications(orgAppSnap.docs.map(d => ({ id: d.id, ...d.data() } as OrgApplication)));

                // Fetch Organizers
                const orgsSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['organizer', 'admin'])));
                setOrganizers(orgsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));

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
                    setOrgFormDescription(data.orgFormDescription || '');
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
            batch.update(txRef, { 
                status: 'success',
                confirmedBy: profile?.uid,
                confirmedByUsername: profile?.username
            });
            await batch.commit();

            // Send Notification
            await NotificationService.create(
                tx.userId,
                'Transaction Approved',
                `Your ${tx.type} of ${formatCurrency(tx.amount)} has been approved.`,
                'success',
                '/wallet'
            );

            showToast('Transaction Approved', 'success');
            setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
            setAllTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'success' } : t));
        } catch (error) {
            console.error("Error approving transaction:", error);
            showToast('Failed to approve transaction', 'error');
        }
    };

    const handleRefundTx = async (tx: Transaction) => {
        if (tx.status === 'refunded') return;
        
        setConfirmModal({
            isOpen: true,
            title: 'Confirm Refund',
            message: `Are you sure you want to refund ${formatCurrency(Math.abs(tx.amount))} to ${tx.username}? This will add the amount back to their wallet balance.`,
            onConfirm: async () => {
                try {
                    setLoading(true);
                    const batch = writeBatch(db);
                    const txRef = doc(db, 'transactions', tx.id);
                    const userRef = doc(db, 'users', tx.userId);

                    // 1. Update user balance
                    batch.update(userRef, { balance: increment(Math.abs(tx.amount)) });

                    // 2. Update transaction status
                    batch.update(txRef, { 
                        status: 'refunded',
                        confirmedBy: profile?.uid,
                        confirmedByUsername: profile?.username
                    });

                    // 3. Create a new refund record for clarity if needed, 
                    // but usually updating the original is enough for manual override.
                    
                    await batch.commit();

                    // Send Notification
                    await NotificationService.create(
                        tx.userId,
                        'Transaction Refunded',
                        `Your transaction of ${formatCurrency(Math.abs(tx.amount))} has been manually refunded by an admin.`,
                        'info',
                        '/wallet'
                    );

                    showToast('Transaction Refunded', 'success');
                    setAllTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'refunded' } : t));
                    setSelectedTx(null);
                } catch (error) {
                    console.error("Error refunding transaction:", error);
                    showToast('Failed to refund transaction', 'error');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const executeRejectTx = async (tx: Transaction, reason: string) => {
        try {
            const batch = writeBatch(db);
            const txRef = doc(db, 'transactions', tx.id);
            const userRef = doc(db, 'users', tx.userId);

            if (tx.type === 'withdrawal') {
                batch.update(userRef, { balance: increment(Math.abs(tx.amount)) });
            }
            batch.update(txRef, { 
                status: 'rejected',
                rejectionReason: reason || 'No reason provided',
                confirmedBy: profile?.uid,
                confirmedByUsername: profile?.username
            });
            await batch.commit();

            // Send Notification
            await NotificationService.create(
                tx.userId,
                'Transaction Rejected',
                `Your ${tx.type} of ${formatCurrency(tx.amount)} was rejected. Reason: ${reason || 'No reason provided'}`,
                'alert',
                '/wallet'
            );

            showToast('Transaction Rejected', 'success');
            setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
            setSelectedTx(null);
            setRejectionReason('');
        } catch (error) {
            console.error("Error rejecting transaction:", error);
            showToast('Failed to reject transaction', 'error');
        }
    };

    const handleRejectTx = (tx: Transaction) => {
        if (!rejectionReason) {
            setConfirmModal({
                isOpen: true,
                title: 'Reject without reason?',
                message: 'Are you sure you want to reject this transaction without providing a reason?',
                isDestructive: true,
                onConfirm: () => executeRejectTx(tx, rejectionReason)
            });
            return;
        }
        executeRejectTx(tx, rejectionReason);
    };

    const handleAdjustBalance = async () => {
        if (!selectedUser || !adjustmentAmount) return;
        const amount = parseFloat(adjustmentAmount);
        if (isNaN(amount)) return showToast('Invalid amount', 'error');

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

            showToast('Balance Adjusted', 'success');
            setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, balance: u.balance + finalAmount } : u));
            setSelectedUser(null);
            setAdjustmentAmount('');
        } catch (error) {
            console.error("Error adjusting balance:", error);
            showToast('Failed to adjust balance', 'error');
        }
    };

    const handleApproveOrg = async (app: OrgApplication) => {
        try {
            const batch = writeBatch(db);
            const appRef = doc(db, 'orgApplications', app.id);
            const userRef = doc(db, 'users', app.userId);

            batch.update(userRef, { 
                role: 'organizer',
                orgStatus: 'approved',
                orgName: app.orgName,
                isOrganizer: true
            });
            batch.update(appRef, { status: 'approved' });
            
            await batch.commit();

            await NotificationService.create(
                app.userId,
                'Organizer Application Approved',
                `Congratulations! Your application for ${app.orgName} has been approved. You can now host tournaments.`,
                'success',
                '/organizer-panel'
            );

            showToast('Application Approved', 'success');
            setOrgApplications(prev => prev.filter(a => a.id !== app.id));
        } catch (error) {
            console.error("Error approving org:", error);
            showToast('Failed to approve application', 'error');
        }
    };

    const handleCancelTournament = async (tournament: Tournament) => {
        setConfirmModal({
            isOpen: true,
            title: 'Cancel Tournament',
            message: `Are you sure you want to cancel "${tournament.title}"? All registered players will be automatically refunded. This action cannot be undone.`,
            isDestructive: true,
            onConfirm: async () => {
                try {
                    setLoading(true);
                    const batch = writeBatch(db);
                    
                    // 1. Update tournament status
                    const tournamentRef = doc(db, 'tournaments', tournament.id);
                    batch.update(tournamentRef, { status: 'cancelled' });

                    // 2. Fetch participants and pending transactions related to this tournament
                    const [participantsSnap, pendingTxSnap] = await Promise.all([
                        getDocs(query(collection(db, 'participants'), where('tournamentId', '==', tournament.id))),
                        getDocs(query(collection(db, 'transactions'), where('tournamentId', '==', tournament.id), where('status', '==', 'pending')))
                    ]);

                    const participants = participantsSnap.docs.map(d => d.data());
                    const pendingTxs = pendingTxSnap.docs;

                    // 3. Reject any pending transactions related to this tournament
                    for (const txDoc of pendingTxs) {
                        batch.update(txDoc.ref, { 
                            status: 'rejected', 
                            rejectionReason: 'Tournament Cancelled',
                            confirmedBy: profile?.uid,
                            confirmedByUsername: profile?.username
                        });
                    }

                    // 4. Process refunds for participants
                    for (const participant of participants) {
                        const userRef = doc(db, 'users', participant.userId);
                        const refundAmount = tournament.entryFee;

                        if (refundAmount > 0) {
                            // Update user balance
                            batch.update(userRef, { balance: increment(refundAmount) });

                            // Create refund transaction
                            const txRef = doc(collection(db, 'transactions'));
                            batch.set(txRef, {
                                userId: participant.userId,
                                username: participant.username,
                                type: 'refund',
                                amount: refundAmount,
                                method: 'Wallet Refund',
                                refId: `REFUND-${tournament.id}-${participant.userId.slice(0, 5)}`,
                                status: 'refunded',
                                timestamp: serverTimestamp(),
                                desc: `Refund for cancelled tournament: ${tournament.title}`,
                                tournamentId: tournament.id,
                                confirmedBy: profile?.uid,
                                confirmedByUsername: profile?.username
                            });

                            // Send notification
                            await NotificationService.create(
                                participant.userId,
                                'Tournament Cancelled - Refunded',
                                `The tournament "${tournament.title}" has been cancelled. Your entry fee of ${formatCurrency(refundAmount)} has been refunded to your wallet.`,
                                'info',
                                '/wallet'
                            );
                        }
                    }

                    // 4. Create Activity Log
                    const logRef = doc(collection(db, 'activityLogs'));
                    batch.set(logRef, {
                        type: 'tournament_cancellation',
                        adminId: profile?.uid,
                        adminName: profile?.username,
                        tournamentId: tournament.id,
                        tournamentTitle: tournament.title,
                        timestamp: serverTimestamp(),
                        details: `Cancelled tournament and refunded ${participants.length} players.`
                    });

                    await batch.commit();
                    showToast('Tournament cancelled and refunds processed', 'success');
                    
                    // Refresh tournaments if needed
                    if (selectedOrgId) {
                        fetchOrgTournaments(selectedOrgId);
                    }
                } catch (error) {
                    console.error("Error cancelling tournament:", error);
                    showToast('Failed to cancel tournament', 'error');
                } finally {
                    setLoading(false);
                    closeConfirmModal();
                }
            }
        });
    };

    const handleRejectOrg = async (app: OrgApplication) => {
        try {
            const batch = writeBatch(db);
            const appRef = doc(db, 'orgApplications', app.id);
            const userRef = doc(db, 'users', app.userId);

            batch.update(userRef, { orgStatus: 'rejected' });
            batch.update(appRef, { status: 'rejected' });
            
            await batch.commit();

            await NotificationService.create(
                app.userId,
                'Organizer Application Rejected',
                `We regret to inform you that your application for ${app.orgName} was rejected.`,
                'alert',
                '/contact'
            );

            showToast('Application Rejected', 'success');
            setOrgApplications(prev => prev.filter(a => a.id !== app.id));
        } catch (error) {
            console.error("Error rejecting org:", error);
            showToast('Failed to reject application', 'error');
        }
    };

    const fetchOrgTournaments = async (orgId: string) => {
        if (!orgId) return;
        setSelectedOrgId(orgId);
        try {
            const q = query(collection(db, 'tournaments'), where('hostUid', '==', orgId), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setOrgTournaments(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Tournament)));
        } catch (error) {
            console.error("Error fetching org tournaments:", error);
            showToast('Failed to fetch tournaments', 'error');
        }
    };

    const handleSavePayment = async () => {
        if (!paymentName || !paymentQr || !paymentInstructions) return showToast('Please fill all fields', 'warning');
        
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
                showToast('Payment Method Updated', 'success');
            } else {
                const newRef = doc(collection(db, 'paymentMethods'));
                await setDoc(newRef, payData);
                setPaymentMethods(prev => [{ id: newRef.id, ...payData }, ...prev]);
                showToast('Payment Method Added', 'success');
            }
            
            setIsPaymentModalOpen(false);
            setEditingPayment(null);
            setPaymentName('');
            setPaymentQr('');
            setPaymentInstructions('');
        } catch (error) {
            console.error("Error saving payment method:", error);
            showToast('Failed to save payment method', 'error');
        }
    };

    const executeDeletePayment = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'paymentMethods', id));
            setPaymentMethods(prev => prev.filter(p => p.id !== id));
            showToast('Payment method deleted', 'success');
        } catch (error) {
            console.error("Error deleting payment method:", error);
            showToast('Failed to delete payment method', 'error');
        }
    };

    const handleDeletePayment = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Payment Method',
            message: 'Are you sure you want to delete this payment method?',
            isDestructive: true,
            onConfirm: () => executeDeletePayment(id)
        });
    };

    const handleSearchUsers = async () => {
        if (!searchQuery.trim()) {
            const snap = await getDocs(query(collection(db, 'users'), limit(20)));
            setUsers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) } as UserProfile)));
            return;
        }

        setLoading(true);
        try {
            let q;
            if (searchQuery.includes('@')) {
                q = query(collection(db, 'users'), where('email', '==', searchQuery.trim().toLowerCase()), limit(1));
            } else {
                q = query(collection(db, 'users'), 
                    where('username', '>=', searchQuery), 
                    where('username', '<=', searchQuery + '\uf8ff'), 
                    limit(20)
                );
            }
            const snap = await getDocs(q);
            setUsers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) } as UserProfile)));
        } catch (error) {
            console.error("Error searching users:", error);
            showToast('Search failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUserRole = async (uid: string, newRole: 'admin' | 'organizer' | 'player') => {
        try {
            await updateDoc(doc(db, 'users', uid), { role: newRole });
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
            if (selectedUser?.uid === uid) {
                setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
            }
            showToast(`User role updated to ${newRole}`, 'success');
        } catch (error) {
            console.error("Error updating user role:", error);
            showToast('Failed to update user role', 'error');
        }
    };

    const handleSaveGame = async () => {
        if (!gameName || !gameLogo || !gameModes) return showToast('Please fill all fields', 'warning');
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
                showToast('Game Updated', 'success');
            } else {
                const newGameRef = doc(collection(db, 'games'));
                await setDoc(newGameRef, gameData);
                setGames(prev => [{ id: newGameRef.id, ...gameData }, ...prev]);
                showToast('Game Added', 'success');
            }
            
            setIsGameModalOpen(false);
            setEditingGame(null);
            setGameName('');
            setGameLogo('');
            setGameModes('');
        } catch (error) {
            console.error("Error saving game:", error);
            showToast('Failed to save game', 'error');
        }
    };

    const handleSavePromo = async () => {
        if (!promoCode || !promoAmount || !promoMaxUses) return showToast('Please fill all fields', 'warning');
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
                showToast('Promo Code Updated', 'success');
            } else {
                const newRef = doc(collection(db, 'promocodes'));
                await setDoc(newRef, promoData);
                setPromoCodes(prev => [{ id: newRef.id, ...promoData }, ...prev]);
                showToast('Promo Code Added', 'success');
            }
            setIsPromoModalOpen(false);
            setEditingPromo(null);
            setPromoCode('');
            setPromoAmount('');
            setPromoMaxUses('');
        } catch (error) {
            console.error("Error saving promo:", error);
            showToast('Failed to save promo code', 'error');
        }
    };

    const executeDeletePromo = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'promocodes', id));
            setPromoCodes(prev => prev.filter(p => p.id !== id));
            showToast('Promo code deleted', 'success');
        } catch (error) {
            console.error("Error deleting promo:", error);
            showToast('Failed to delete promo code', 'error');
        }
    };

    const handleDeletePromo = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Promo Code',
            message: 'Are you sure you want to delete this promo code?',
            isDestructive: true,
            onConfirm: () => executeDeletePromo(id)
        });
    };

    const handleSaveSlide = async () => {
        if (!slideTitle || !slideImage || !slideLink) return showToast('Please fill all fields', 'warning');
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
                showToast('Slide Updated', 'success');
            } else {
                const newRef = doc(collection(db, 'slides'));
                await setDoc(newRef, slideData);
                setSlides(prev => [{ id: newRef.id, ...slideData }, ...prev]);
                showToast('Slide Added', 'success');
            }
            setIsSlideModalOpen(false);
            setEditingSlide(null);
            setSlideTitle('');
            setSlideImage('');
            setSlideLink('');
        } catch (error) {
            console.error("Error saving slide:", error);
            showToast('Failed to save slide', 'error');
        }
    };

    const executeDeleteSlide = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'slides', id));
            setSlides(prev => prev.filter(s => s.id !== id));
            showToast('Slide deleted', 'success');
        } catch (error) {
            console.error("Error deleting slide:", error);
            showToast('Failed to delete slide', 'error');
        }
    };

    const handleDeleteSlide = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Slide',
            message: 'Are you sure you want to delete this slide?',
            isDestructive: true,
            onConfirm: () => executeDeleteSlide(id)
        });
    };

    // Tournament Management State
    const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

    const handleEditTournament = (tournament: Tournament) => {
        setSelectedTournament(tournament);
        setIsTournamentModalOpen(true);
    };

    const handleViewParticipants = (tournament: Tournament) => {
        // Redirect to tournament page or show a modal
        window.open(`/tournament/${tournament.id}`, '_blank');
    };

    const handleSaveSettings = async () => {
        try {
            const settingsData = {
                minWithdrawal: parseFloat(minWithdrawal),
                supportEmail,
                supportPhone,
                notice,
                isNoticeActive,
                isOrgFormOpen: siteSettings?.isOrgFormOpen ?? true,
                orgFormDescription,
                updatedAt: serverTimestamp()
            };
            await setDoc(doc(db, 'settings', 'site'), settingsData);
            setSiteSettings(settingsData as any);
            showToast('Settings Saved', 'success');
        } catch (error) {
            console.error("Error saving settings:", error);
            showToast('Failed to save settings', 'error');
        }
    };

    const toggleOrgForm = async () => {
        if (!siteSettings) return;
        try {
            const newValue = !siteSettings.isOrgFormOpen;
            await updateDoc(doc(db, 'settings', 'site'), { isOrgFormOpen: newValue });
            setSiteSettings(prev => prev ? { ...prev, isOrgFormOpen: newValue } : null);
            showToast(`Organizer applications ${newValue ? 'opened' : 'closed'}`, 'success');
        } catch (error) {
            console.error("Error toggling org form:", error);
            showToast('Failed to toggle form', 'error');
        }
    };

    const handleSaveOrgDetails = async () => {
        if (!editingOrg) return;
        try {
            const updateData = {
                email: orgEmail,
                discord: orgDiscord,
                youtube: orgYoutube,
                whatsapp: orgWhatsapp,
                orgName: orgNameEdit
            };
            await updateDoc(doc(db, 'users', editingOrg.uid), updateData);
            setOrganizers(prev => prev.map(o => o.uid === editingOrg.uid ? { ...o, ...updateData } : o));
            showToast('Organizer details updated', 'success');
            setIsOrgEditModalOpen(false);
        } catch (error) {
            console.error("Error saving org details:", error);
            showToast('Failed to save details', 'error');
        }
    };

    const handleSuspendOrg = async (uid: string, isSuspended: boolean) => {
        try {
            await updateDoc(doc(db, 'users', uid), { isBanned: isSuspended });
            setOrganizers(prev => prev.map(o => o.uid === uid ? { ...o, isBanned: isSuspended } : o));
            showToast(`Organizer ${isSuspended ? 'suspended' : 'activated'}`, 'success');
        } catch (error) {
            console.error("Error suspending org:", error);
            showToast('Failed to update status', 'error');
        }
    };

    const executeDeleteGame = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'games', id));
            setGames(prev => prev.filter(g => g.id !== id));
            showToast('Game Deleted', 'success');
        } catch (error) {
            console.error("Error deleting game:", error);
            showToast('Failed to delete game', 'error');
        }
    };

    const handleDeleteGame = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Game',
            message: 'Are you sure you want to delete this game?',
            isDestructive: true,
            onConfirm: () => executeDeleteGame(id)
        });
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
        <div className="animate-fade-in max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 shrink-0 space-y-6 bg-card p-4 rounded-2xl border border-gray-800 h-fit sticky top-24">
                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 px-2">Main</div>
                    <div className="space-y-1">
                        <button 
                            onClick={() => setActiveTab('tab-dashboard')} 
                            className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition flex items-center gap-3 ${
                                activeTab === 'tab-dashboard' 
                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                                    : 'text-gray-400 hover:bg-dark hover:text-white'
                            }`}
                        >
                            <Layout className={`w-5 h-5 ${activeTab === 'tab-dashboard' ? 'text-white' : 'text-gray-500'}`} />
                            Dashboard
                        </button>
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 px-2">Financial</div>
                    <div className="space-y-1">
                        {[
                            { id: 'pending-deposits', icon: ArrowDown, label: 'Pending Deposits' },
                            { id: 'pending-withdrawals', icon: ArrowUp, label: 'Pending Withdrawals' },
                            { id: 'tx-history', icon: CreditCard, label: 'Transaction History' }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === `tab-${tab.id}`;
                            return (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(`tab-${tab.id}`)} 
                                    className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition flex items-center gap-3 ${
                                        isActive 
                                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                                            : 'text-gray-400 hover:bg-dark hover:text-white'
                                    }`}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 px-2">Organizations</div>
                    <div className="space-y-1">
                        {[
                            { id: 'org-approvals', icon: Check, label: 'Org Approvals' },
                            { id: 'org-tournaments', icon: Trophy, label: 'Org Tournaments' },
                            { id: 'organizers', icon: Users, label: 'Manage Orgs' }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === `tab-${tab.id}`;
                            return (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(`tab-${tab.id}`)} 
                                    className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition flex items-center gap-3 ${
                                        isActive 
                                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                                            : 'text-gray-400 hover:bg-dark hover:text-white'
                                    }`}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 px-2">Management</div>
                    <div className="space-y-1">
                        {[
                            { id: 'tournaments', icon: Trophy, label: 'Tournaments' },
                            { id: 'users', icon: Users, label: 'Users' },
                            { id: 'games', icon: Gamepad2, label: 'Games' },
                            { id: 'payments', icon: QrCode, label: 'Payments' },
                            { id: 'promo', icon: Tag, label: 'Promo Codes' }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === `tab-${tab.id}`;
                            return (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(`tab-${tab.id}`)} 
                                    className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition flex items-center gap-3 ${
                                        isActive 
                                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                                            : 'text-gray-400 hover:bg-dark hover:text-white'
                                    }`}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 px-2">System</div>
                    <div className="space-y-1">
                        <button 
                            onClick={() => setActiveTab('tab-settings')} 
                            className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition flex items-center gap-3 ${
                                activeTab === 'tab-settings' 
                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                                    : 'text-gray-400 hover:bg-dark hover:text-white'
                            }`}
                        >
                            <Sliders className={`w-5 h-5 ${activeTab === 'tab-settings' ? 'text-white' : 'text-gray-500'}`} />
                            Settings
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-card rounded-2xl border border-gray-800 p-6 min-h-[600px]">
                {activeTab === 'tab-dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-900/40 to-blue-900/10 p-6 rounded-2xl border border-blue-500/20 flex items-center gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-xl border border-blue-500/30 shadow-lg shadow-blue-500/20">
                                <Users className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-blue-200/70 uppercase font-bold tracking-wider mb-1">Total User Holdings</div>
                                <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(stats.totalBalance)}</div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden bg-gradient-to-br from-green-900/40 to-green-900/10 p-6 rounded-2xl border border-green-500/20 flex items-center gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all"></div>
                            <div className="w-14 h-14 rounded-2xl bg-green-500/20 text-green-400 flex items-center justify-center text-xl border border-green-500/30 shadow-lg shadow-green-500/20">
                                <ArrowDown className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-green-200/70 uppercase font-bold tracking-wider mb-1">Today's Deposits</div>
                                <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(stats.todayDep)}</div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden bg-gradient-to-br from-red-900/40 to-red-900/10 p-6 rounded-2xl border border-red-500/20 flex items-center gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
                            <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-xl border border-red-500/30 shadow-lg shadow-red-500/20">
                                <ArrowUp className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-red-200/70 uppercase font-bold tracking-wider mb-1">Today's Withdrawals</div>
                                <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(stats.todayWith)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card p-6 rounded-2xl border border-gray-800 lg:col-span-2 shadow-xl">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h2 className="font-bold text-white text-lg flex items-center gap-2">
                                <Bell className="w-5 h-5 text-brand-400" /> Pending Transactions
                            </h2>
                            <span className="bg-brand-500/20 text-brand-400 text-xs font-bold px-3 py-1 rounded-full border border-brand-500/30">
                                {pendingTransactions.length} Pending
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px] overflow-y-auto custom-scrollbar content-start pr-2">
                            {pendingTransactions.length > 0 ? (
                                pendingTransactions.map(t => (
                                    <div key={t.id} className="bg-dark/50 hover:bg-dark p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all shadow-md group">
                                        <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`font-black tracking-wider ${t.type === 'deposit' ? 'text-green-400' : 'text-red-400'} uppercase text-xs`}>{t.type}</span>
                                                    <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded-full text-gray-300 font-bold tracking-wider">{t.method}</span>
                                                </div>
                                                <div className="text-white font-bold text-sm mb-1">{t.username || 'Unknown User'}</div>
                                                <div className="text-[10px] text-gray-500 font-mono">{formatDate(t.timestamp)}</div>
                                            </div>
                                            <div className="text-xl font-black text-white tracking-tight">{formatCurrency(Math.abs(t.amount))}</div>
                                        </div>
                                        <div className="text-[11px] text-gray-400 mb-5 bg-black/30 p-2 rounded-lg border border-gray-800/50 font-mono flex justify-between items-center">
                                            <span className="text-gray-600">REF:</span> 
                                            <span className="text-brand-300 select-all">{t.refId}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => handleApproveTx(t)} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/30 hover:border-green-500 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                                <Check className="w-4 h-4" /> Approve
                                            </button>
                                            <button onClick={() => setSelectedTx(t)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                                <Eye className="w-4 h-4" /> Review
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-500 py-10">
                                    <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4 border border-gray-800">
                                        <Check className="text-3xl text-green-500/50" />
                                    </div>
                                    <p className="font-bold uppercase tracking-widest text-sm text-gray-600">All Caught Up!</p>
                                    <p className="text-xs text-gray-700 mt-1">No pending transactions to review.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedTx && (
                        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
                            <div className="bg-card w-full max-w-2xl rounded-3xl border border-gray-800 p-8 space-y-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                                <div className="flex justify-between items-center border-b border-gray-800 pb-5">
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                        <CreditCard className="text-brand-500" /> Review Transaction
                                    </h3>
                                    <button onClick={() => setSelectedTx(null)} className="text-gray-500 hover:text-white bg-dark p-2 rounded-full transition"><X className="w-5 h-5" /></button>
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
                                                <div className="flex justify-between pb-1">
                                                    <span className="text-gray-500">Ref ID</span>
                                                    <span className="text-brand-300 text-xs">{selectedTx.refId}</span>
                                                </div>
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
                                                <img src={selectedTx.proofUrl || undefined} className="w-full aspect-square object-contain" alt="Proof" />
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
                                            <button onClick={() => handleRejectTx(selectedTx)} className="flex-1 bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 py-4 rounded-xl font-black transition-all uppercase tracking-widest text-sm">
                                                Reject
                                            </button>
                                            <button onClick={() => handleApproveTx(selectedTx)} className="flex-[2] bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20 py-4 rounded-xl font-black transition-all uppercase tracking-widest text-sm">
                                                Approve
                                            </button>
                                        </>
                                    ) : selectedTx.status === 'success' && (selectedTx.type === 'withdrawal' || selectedTx.type === 'entry_fee') ? (
                                        <button 
                                            onClick={() => handleRefundTx(selectedTx)} 
                                            className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-black transition-all uppercase tracking-widest text-sm shadow-lg shadow-orange-600/20"
                                        >
                                            Manual Refund
                                        </button>
                                    ) : (
                                        <button onClick={() => setSelectedTx(null)} className="w-full bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-black transition-all uppercase tracking-widest text-sm">
                                            Close
                                        </button>
                                    )}
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
                                                <img src={s.imageUrl || undefined} className="w-10 h-6 object-cover rounded" alt={s.title} />
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
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingSlide ? 'Edit Slide' : 'Add Slide'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Title</label>
                                        <input type="text" value={slideTitle} onChange={e => setSlideTitle(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Image (Paste or Drop)</label>
                                        <div 
                                            onPaste={handlePasteSlide}
                                            onDrop={handleDropSlide}
                                            onDragOver={handleDragOverSlide}
                                            className={`relative w-full aspect-video rounded-xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden group cursor-pointer ${uploading ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-brand-500 bg-dark'}`}
                                        >
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <img 
                                                        src={slideImage || DEFAULT_BANNER || undefined} 
                                                        alt="Slide Preview" 
                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                                        onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                                        <Plus className="w-8 h-8 text-white" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <input type="text" value={slideImage} onChange={e => setSlideImage(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none text-xs" placeholder="Or paste URL..." />
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

            {activeTab === 'tab-tournaments' && (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Trophy className="text-brand-500" /> All Tournaments
                        </h2>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input 
                                    type="text" 
                                    placeholder="Search tournaments..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-dark border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:border-brand-500 outline-none w-64"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {allTournaments
                            .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(t => (
                                <div key={t.id} className="bg-dark p-4 rounded-xl border border-gray-800 space-y-3">
                                    <img src={t.bannerUrl || undefined} className="w-full aspect-video object-cover rounded-lg" alt={t.title} />
                                    <div>
                                        <h3 className="font-bold text-white truncate">{t.title}</h3>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">{t.game}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                    t.status === 'upcoming' ? 'bg-blue-600/20 text-blue-400' :
                                                    t.status === 'ongoing' ? 'bg-green-600/20 text-green-400' :
                                                    t.status === 'cancelled' ? 'bg-red-600/20 text-red-400' :
                                                    'bg-gray-600/20 text-gray-400'
                                                }`}>
                                                    {t.status}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => handleViewParticipants(t)}
                                                        className="p-1.5 bg-brand-600/20 hover:bg-brand-600 text-brand-500 hover:text-white rounded-lg transition-all border border-brand-500/30"
                                                        title="View Participants"
                                                    >
                                                        <Users className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEditTournament(t)}
                                                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all border border-blue-500/30"
                                                        title="Edit Tournament"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                    {t.status !== 'cancelled' && t.status !== 'completed' && (
                                                        <button 
                                                            onClick={() => handleCancelTournament(t)}
                                                            className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/30"
                                                            title="Cancel Tournament"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {activeTab === 'tab-org-approvals' && (
                <div className="bg-card p-6 rounded-xl border border-gray-800">
                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-b border-gray-700 pb-2 flex items-center gap-2">
                        <Check className="text-brand-500" /> Organization Approvals
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {orgApplications.length > 0 ? (
                            orgApplications.map(app => (
                                <div key={app.id} className="bg-dark p-6 rounded-2xl border border-gray-800 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{app.orgName}</h3>
                                            <p className="text-xs text-gray-500">Applied by: {app.username}</p>
                                        </div>
                                        <span className="bg-yellow-600/20 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-yellow-500/30">
                                            Pending
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div className="bg-black/30 p-3 rounded-xl border border-gray-800">
                                            <div className="text-gray-500 uppercase font-bold text-[9px] mb-1">WhatsApp</div>
                                            <div className="text-white">{app.whatsapp}</div>
                                        </div>
                                        <div className="bg-black/30 p-3 rounded-xl border border-gray-800">
                                            <div className="text-gray-500 uppercase font-bold text-[9px] mb-1">Email</div>
                                            <div className="text-white truncate">{app.email}</div>
                                        </div>
                                    </div>
                                    <div className="bg-black/30 p-3 rounded-xl border border-gray-800">
                                        <div className="text-gray-500 uppercase font-bold text-[9px] mb-1">Proof Link</div>
                                        <a href={app.proofLink} target="_blank" rel="noreferrer" className="text-brand-400 hover:text-brand-300 flex items-center gap-2 truncate">
                                            <ExternalLink className="w-3 h-3" /> {app.proofLink}
                                        </a>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => handleRejectOrg(app)} className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 py-2.5 rounded-xl text-xs font-bold uppercase transition-all">
                                            Reject
                                        </button>
                                        <button onClick={() => handleApproveOrg(app)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold uppercase transition-all">
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-600">
                                <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">No pending applications</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'tab-org-tournaments' && (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Trophy className="text-brand-500" /> Organization Tournaments
                        </h2>
                        <select 
                            value={selectedOrgId}
                            onChange={(e) => fetchOrgTournaments(e.target.value)}
                            className="bg-dark border border-gray-700 rounded-lg p-2 text-white text-sm focus:border-brand-500 outline-none"
                        >
                            <option value="">Select Organization</option>
                            {organizers.map(org => (
                                <option key={org.uid} value={org.uid}>{org.username}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {orgTournaments.length > 0 ? (
                            orgTournaments.map(t => (
                                <div key={t.id} className="bg-dark p-4 rounded-xl border border-gray-800 space-y-3">
                                    <img src={t.bannerUrl || undefined} className="w-full aspect-video object-cover rounded-lg" alt={t.title} />
                                    <div>
                                        <h3 className="font-bold text-white truncate">{t.title}</h3>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">{t.game}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                    t.status === 'upcoming' ? 'bg-blue-600/20 text-blue-400' :
                                                    t.status === 'ongoing' ? 'bg-green-600/20 text-green-400' :
                                                    t.status === 'cancelled' ? 'bg-red-600/20 text-red-400' :
                                                    'bg-gray-600/20 text-gray-400'
                                                }`}>
                                                    {t.status}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => handleViewParticipants(t)}
                                                        className="p-1.5 bg-brand-600/20 hover:bg-brand-600 text-brand-500 hover:text-white rounded-lg transition-all border border-brand-500/30"
                                                        title="View Participants"
                                                    >
                                                        <Users className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEditTournament(t)}
                                                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all border border-blue-500/30"
                                                        title="Edit Tournament"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                    {t.status !== 'cancelled' && t.status !== 'completed' && (
                                                        <button 
                                                            onClick={() => handleCancelTournament(t)}
                                                            className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/30"
                                                            title="Cancel Tournament"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : selectedOrgId ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-600">
                                <Trophy className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">No tournaments found for this organization</p>
                            </div>
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-600">
                                <Users className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">Select an organization to view their tournaments</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'tab-organizers' && (
                <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Users className="text-brand-500" /> Manage Organizers
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {organizers.map(org => (
                            <div key={org.uid} className="bg-dark p-5 rounded-2xl border border-gray-800 space-y-4 relative overflow-hidden group">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-brand-600/20 rounded-full flex items-center justify-center border border-brand-500/30">
                                            <Users className="text-brand-500 w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{org.username}</h3>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">{org.orgName || 'No Org Name'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setEditingOrg(org);
                                                setOrgEmail(org.email);
                                                setOrgDiscord(org.discord || '');
                                                setOrgYoutube(org.youtube || '');
                                                setOrgWhatsapp(org.whatsapp || '');
                                                setOrgNameEdit(org.orgName || '');
                                                setIsOrgEditModalOpen(true);
                                            }}
                                            className="p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl transition-all border border-blue-500/30"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleSuspendOrg(org.uid, !org.isBanned)}
                                            className={`p-2 rounded-xl transition-all border ${
                                                org.isBanned 
                                                    ? 'bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border-green-500/30' 
                                                    : 'bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border-red-500/30'
                                            }`}
                                        >
                                            {org.isBanned ? <CheckCircle className="w-4 h-4" /> : <Trash className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <div className="bg-black/30 p-2 rounded-lg border border-gray-800">
                                        <div className="text-gray-600 uppercase font-bold mb-0.5">Email</div>
                                        <div className="text-gray-300 truncate">{org.email}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded-lg border border-gray-800">
                                        <div className="text-gray-600 uppercase font-bold mb-0.5">Status</div>
                                        <div className={`font-bold ${org.isBanned ? 'text-red-500' : 'text-green-500'}`}>
                                            {org.isBanned ? 'SUSPENDED' : 'ACTIVE'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isOrgEditModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    Edit Organizer Details
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Organization Name</label>
                                        <input type="text" value={orgNameEdit} onChange={e => setOrgNameEdit(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Email</label>
                                        <input type="email" value={orgEmail} onChange={e => setOrgEmail(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">WhatsApp</label>
                                        <input type="text" value={orgWhatsapp} onChange={e => setOrgWhatsapp(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Discord</label>
                                        <input type="text" value={orgDiscord} onChange={e => setOrgDiscord(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">YouTube</label>
                                        <input type="text" value={orgYoutube} onChange={e => setOrgYoutube(e.target.value)} className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none" />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setIsOrgEditModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition">Cancel</button>
                                    <button onClick={handleSaveOrgDetails} className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition">Save Changes</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

                {activeTab === 'tab-pending-deposits' && (
                    <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <ArrowDown className="text-green-500" /> Pending Deposits
                            </h2>
                            <span className="bg-brand-500/20 text-brand-400 text-xs font-bold px-3 py-1 rounded-full border border-brand-500/30">
                                {allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending').length} Pending
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px] overflow-y-auto custom-scrollbar content-start pr-2">
                            {allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending').length > 0 ? (
                                allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending').map(t => (
                                    <div key={t.id} className="bg-dark/50 hover:bg-dark p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all shadow-md group">
                                        <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-black tracking-wider text-green-400 uppercase text-xs">Deposit</span>
                                                    <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded-full text-gray-300 font-bold tracking-wider">{t.method}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono">{formatDate(t.timestamp)}</div>
                                            </div>
                                            <div className="text-xl font-black text-white tracking-tight">{formatCurrency(Math.abs(t.amount))}</div>
                                        </div>
                                        <div className="text-[11px] text-gray-400 mb-5 bg-black/30 p-2 rounded-lg border border-gray-800/50 font-mono flex justify-between items-center">
                                            <span className="text-gray-600">REF:</span> 
                                            <span className="text-brand-300 select-all">{t.refId}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => handleApproveTx(t)} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/30 hover:border-green-500 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                                <Check className="w-4 h-4" /> Approve
                                            </button>
                                            <button onClick={() => setSelectedTx(t)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                                <Eye className="w-4 h-4" /> Review
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-500 py-20">
                                    <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4 border border-gray-800">
                                        <Check className="text-3xl text-green-500/50" />
                                    </div>
                                    <p className="font-bold uppercase tracking-widest text-sm text-gray-600">All Caught Up!</p>
                                    <p className="text-xs text-gray-700 mt-1">No pending deposits to review.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'tab-pending-withdrawals' && (
                    <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <ArrowUp className="text-red-500" /> Pending Withdrawals
                            </h2>
                            <span className="bg-brand-500/20 text-brand-400 text-xs font-bold px-3 py-1 rounded-full border border-brand-500/30">
                                {allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').length} Pending
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px] overflow-y-auto custom-scrollbar content-start pr-2">
                            {allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').length > 0 ? (
                                allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').map(t => (
                                    <div key={t.id} className="bg-dark/50 hover:bg-dark p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all shadow-md group">
                                        <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-black tracking-wider text-red-400 uppercase text-xs">Withdrawal</span>
                                                    <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded-full text-gray-300 font-bold tracking-wider">{t.method}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono">{formatDate(t.timestamp)}</div>
                                            </div>
                                            <div className="text-xl font-black text-white tracking-tight">{formatCurrency(Math.abs(t.amount))}</div>
                                        </div>
                                        <div className="text-[11px] text-gray-400 mb-5 bg-black/30 p-2 rounded-lg border border-gray-800/50 font-mono flex justify-between items-center">
                                            <span className="text-gray-600">REF:</span> 
                                            <span className="text-brand-300 select-all">{t.refId}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => handleApproveTx(t)} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/30 hover:border-green-500 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                                <Check className="w-4 h-4" /> Approve
                                            </button>
                                            <button onClick={() => setSelectedTx(t)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                                                <Eye className="w-4 h-4" /> Review
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-500 py-20">
                                    <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4 border border-gray-800">
                                        <Check className="text-3xl text-green-500/50" />
                                    </div>
                                    <p className="font-bold uppercase tracking-widest text-sm text-gray-600">All Caught Up!</p>
                                    <p className="text-xs text-gray-700 mt-1">No pending withdrawals to review.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'tab-tx-history' && (
                    <div className="bg-card p-6 rounded-xl border border-gray-800 space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-700 pb-4">
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <CreditCard className="text-brand-500" /> Transaction History
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                <select 
                                    value={txFilterType} 
                                    onChange={e => setTxFilterType(e.target.value as any)}
                                    className="bg-dark border border-gray-700 rounded-lg p-2 text-white text-xs focus:border-brand-500 outline-none"
                                >
                                    <option value="all">All Types</option>
                                    <option value="deposit">Deposit</option>
                                    <option value="withdrawal">Withdrawal</option>
                                    <option value="prize">Prize</option>
                                    <option value="refund">Refund</option>
                                    <option value="entry_fee">Entry Fee</option>
                                </select>
                                <select 
                                    value={txFilterStatus} 
                                    onChange={e => setTxFilterStatus(e.target.value as any)}
                                    className="bg-dark border border-gray-700 rounded-lg p-2 text-white text-xs focus:border-brand-500 outline-none"
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="success">Success</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="refunded">Refunded</option>
                                </select>
                                <select 
                                    value={txFilterTournament} 
                                    onChange={e => setTxFilterTournament(e.target.value)}
                                    className="bg-dark border border-gray-700 rounded-lg p-2 text-white text-xs focus:border-brand-500 outline-none w-40"
                                >
                                    <option value="all">All Tournaments</option>
                                    {allTournaments.map(t => (
                                        <option key={t.id} value={t.id}>{t.title}</option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                                    <input 
                                        type="text" 
                                        placeholder="Search User..." 
                                        value={txSearchUser}
                                        onChange={e => setTxSearchUser(e.target.value)}
                                        className="bg-dark border border-gray-700 rounded-lg p-2 pl-8 text-white text-xs focus:border-brand-500 outline-none w-40"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-gray-800">
                                        <th className="py-3 px-4">Date</th>
                                        <th className="py-3 px-4">User</th>
                                        <th className="py-3 px-4">Type</th>
                                        <th className="py-3 px-4">Method</th>
                                        <th className="py-3 px-4">Amount</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">Ref ID</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {allTransactions
                                        .filter(t => {
                                            const matchesType = txFilterType === 'all' || t.type === txFilterType;
                                            const matchesStatus = txFilterStatus === 'all' || t.status === txFilterStatus;
                                            const matchesTournament = txFilterTournament === 'all' || t.tournamentId === txFilterTournament;
                                            const matchesUser = !txSearchUser || 
                                                t.username?.toLowerCase().includes(txSearchUser.toLowerCase()) ||
                                                t.userEmail?.toLowerCase().includes(txSearchUser.toLowerCase());
                                            return matchesType && matchesStatus && matchesUser && matchesTournament;
                                        })
                                        .map(t => (
                                        <tr 
                                            key={t.id} 
                                            onClick={() => setSelectedTx(t)}
                                            className="border-b border-gray-800/50 hover:bg-gray-800/30 transition cursor-pointer group"
                                        >
                                            <td className="py-3 px-4 text-gray-400">{formatDate(t.timestamp)}</td>
                                            <td className="py-3 px-4">
                                                <div className="text-white font-bold">{t.username || t.userId.slice(0, 8)}</div>
                                                <div className="text-[9px] text-gray-500 truncate max-w-[100px]">{t.userEmail}</div>
                                                {t.confirmedByUsername && <div className="text-[9px] text-brand-400 uppercase font-black">By: {t.confirmedByUsername}</div>}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                                                    t.type === 'deposit' ? 'bg-green-900/30 text-green-400 border border-green-500/30' :
                                                    t.type === 'withdrawal' ? 'bg-red-900/30 text-red-400 border border-red-500/30' :
                                                    t.type === 'refund' ? 'bg-orange-900/30 text-orange-400 border border-orange-500/30' :
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
                                                    t.status === 'refunded' ? 'bg-orange-600 text-white' :
                                                    'bg-red-600 text-white'
                                                }`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-gray-500 font-mono flex items-center justify-between">
                                                {t.refId || 'N/A'}
                                                <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-brand-400" />
                                            </td>
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
                                        <button 
                                            onClick={() => {
                                                setConfirmModal({
                                                    isOpen: true,
                                                    title: u.isBanned ? 'Unblock User' : 'Block User',
                                                    message: `Are you sure you want to ${u.isBanned ? 'unblock' : 'block'} ${u.username}?`,
                                                    isDestructive: true,
                                                    onConfirm: async () => {
                                                        try {
                                                            await updateDoc(doc(db, 'users', u.uid), { isBanned: !u.isBanned });
                                                            setUsers(prev => prev.map(user => user.uid === u.uid ? { ...user, isBanned: !u.isBanned } : user));
                                                            showToast(`User ${u.isBanned ? 'unblocked' : 'blocked'}`, 'success');
                                                        } catch (error) {
                                                            console.error("Error updating user status:", error);
                                                            showToast('Failed to update user status', 'error');
                                                        }
                                                        closeConfirmModal();
                                                    }
                                                });
                                            }}
                                            className={`px-3 py-1 rounded text-xs font-bold ${u.isBanned ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} text-white`}
                                        >
                                            {u.isBanned ? 'Unblock' : 'Block'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-center py-10">Search for a user to manage their account.</p>
                        )}
                    </div>

                    {selectedUser && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
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

                                <div className="space-y-4 border-t border-gray-800 pt-6">
                                    <label className="text-xs text-gray-500 uppercase font-bold block">Update Role</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['player', 'organizer', 'admin'] as const).map(role => (
                                            <button 
                                                key={role}
                                                onClick={() => handleUpdateUserRole(selectedUser.uid, role)}
                                                className={`py-2 rounded-lg font-bold text-[10px] uppercase border transition-all ${selectedUser.role === role ? 'bg-brand-600 border-brand-500 text-white' : 'bg-dark border-gray-700 text-gray-500 hover:border-gray-600'}`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
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
                                <img src={game.logoUrl || undefined} className="w-16 h-16 object-cover rounded-lg border border-gray-700" alt={game.name} />
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
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
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
                                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Logo/Banner (Paste or Drop)</label>
                                        <div 
                                            onPaste={handlePasteGame}
                                            onDrop={handleDropGame}
                                            onDragOver={handleDragOverGame}
                                            className={`relative w-full aspect-video rounded-xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden group cursor-pointer ${uploading ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-brand-500 bg-dark'}`}
                                        >
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <img 
                                                        src={gameLogo || DEFAULT_BANNER || undefined} 
                                                        alt="Game Logo Preview" 
                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                                        onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                                        <Plus className="w-8 h-8 text-white" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <input 
                                                type="text" 
                                                value={gameLogo}
                                                onChange={(e) => setGameLogo(e.target.value)}
                                                className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none text-sm"
                                                placeholder="Or paste image URL..."
                                            />
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
                                        <img src={pm.qrUrl || undefined} className="w-full h-full object-contain" alt="QR" />
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
                            <div className="bg-card w-full max-w-lg rounded-2xl border border-gray-800 p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-gray-800 pb-4">
                                    {editingPayment ? 'Edit Payment Method' : 'Add Payment Method'}
                                </h3>
                                
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Method Name</label>
                                        <input 
                                            type="text" 
                                            value={paymentName}
                                            onChange={(e) => setPaymentName(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
                                            placeholder="e.g. eSewa (Personal)"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Type</label>
                                        <select 
                                            value={paymentType}
                                            onChange={(e) => setPaymentType(e.target.value as any)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
                                        >
                                            <option value="eSewa">eSewa</option>
                                            <option value="Khalti">Khalti</option>
                                            <option value="Bank">Bank Transfer</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">QR Code Image (Paste or Drop)</label>
                                        <div 
                                            onPaste={handlePastePayment}
                                            onDrop={handleDropPayment}
                                            onDragOver={handleDragOverPayment}
                                            className={`relative w-48 h-48 mx-auto rounded-xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden group cursor-pointer ${uploading ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-brand-500 bg-dark'}`}
                                        >
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <img 
                                                        src={paymentQr || NEXPLAY_LOGO || undefined} 
                                                        alt="QR Preview" 
                                                        className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition"
                                                        onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                                        <Plus className="w-8 h-8 text-white" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="mt-3">
                                            <input 
                                                type="text" 
                                                value={paymentQr}
                                                onChange={(e) => setPaymentQr(e.target.value)}
                                                className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none text-sm transition"
                                                placeholder="Or paste QR URL..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Instructions (Account Name, Number, etc.)</label>
                                        <textarea 
                                            value={paymentInstructions}
                                            onChange={(e) => setPaymentInstructions(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none h-24 transition"
                                            placeholder="Account Name: John Doe&#10;Number: 98XXXXXXXX"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                                        <input 
                                            type="checkbox" 
                                            id="paymentActive"
                                            checked={paymentActive}
                                            onChange={(e) => setPaymentActive(e.target.checked)}
                                            className="w-5 h-5 accent-brand-500 cursor-pointer"
                                        />
                                        <label htmlFor="paymentActive" className="text-sm text-gray-300 font-bold uppercase cursor-pointer">Active (Visible to users)</label>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-2">
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
                            <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
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

                            <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-l-2 border-brand-500 pl-3 pt-4">Organizer Settings</h3>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="text-brand-500 w-5 h-5" />
                                        <span className="text-sm text-white font-bold uppercase">Open Organizer Applications</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={siteSettings?.isOrgFormOpen} onChange={toggleOrgForm} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Toggle whether users can apply to become an organization from the contact page.</p>
                                
                                <div className="pt-4 border-t border-gray-800">
                                    <label className="text-[10px] text-gray-500 uppercase font-black mb-2 block tracking-widest">Organizer Form Description</label>
                                    <textarea 
                                        value={orgFormDescription}
                                        onChange={e => setOrgFormDescription(e.target.value)}
                                        className="w-full bg-surface border border-gray-700 rounded-lg p-4 text-white focus:border-brand-500 outline-none h-32 text-sm"
                                        placeholder="Explain the requirements for becoming an organizer..."
                                    />
                                </div>
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

            {/* Tournament Edit Modal */}
            <TournamentCreateModal 
                isOpen={isTournamentModalOpen}
                onClose={() => {
                    setIsTournamentModalOpen(false);
                    setSelectedTournament(null);
                }}
                onSuccess={() => {
                    // Refresh tournaments
                    if (selectedOrgId) fetchOrgTournaments(selectedOrgId);
                }}
                editTournament={selectedTournament}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onClose={closeConfirmModal}
                isDestructive={confirmModal.isDestructive}
            />
        </div>
    );
};

export default AdminPanel;

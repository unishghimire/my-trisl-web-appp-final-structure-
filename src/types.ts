import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
    uid: string;
    email: string;
    username: string;
    role: 'player' | 'organizer' | 'admin';
    balance: number;
    totalEarnings: number;
    inGameId: string;
    teamName: string;
    phone: string;
    isBanned: boolean;
    createdAt: Timestamp | any;
    orgStatus?: 'pending' | 'approved' | 'rejected';
    bio?: string;
    profilePicUrl?: string;
    contactInfo?: string;
}

export interface Tournament {
    id: string;
    title: string;
    game: string;
    bannerUrl?: string;
    isFeatured?: boolean;
    prizePool: number;
    entryFee: number;
    slots: number;
    currentPlayers: number;
    type: string;
    startTime: Timestamp | any;
    rules?: string;
    status: 'upcoming' | 'live' | 'completed';
    hostUid: string;
    createdAt: Timestamp | any;
    prizeDistribution?: { rank: number; amount: number }[];
    roomId?: string;
    roomPass?: string;
    ytLink?: string;
    uploadLink?: string;
    resultUrl?: string;
    winners?: { uid: string; amount: number; rank: number; username?: string }[];
    distributedAmount?: number;
}

export interface Transaction {
    id: string;
    userId: string;
    type: 'deposit' | 'withdrawal' | 'prize';
    amount: number;
    method: string;
    refId: string;
    status: 'pending' | 'success' | 'rejected';
    timestamp: Timestamp | any;
    desc?: string;
    proofUrl?: string;
    rejectionReason?: string;
    accountDetails?: string;
}

export interface PaymentMethod {
    id: string;
    name: string;
    qrUrl: string;
    instructions: string;
    type: 'eSewa' | 'Khalti' | 'Bank' | 'Other';
    isActive: boolean;
    createdAt: Timestamp | any;
}

export interface Slide {
    id: string;
    imageUrl: string;
    title: string;
    link: string;
    buttonText: string;
    createdAt: Timestamp | any;
}

export interface PromoCode {
    id: string;
    code: string;
    amount: number;
    maxUses: number;
    currentUses: number;
    isActive: boolean;
    createdAt: Timestamp | any;
}

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'alert';
    read: boolean;
    link?: string;
    timestamp: Timestamp | any;
}

export interface Game {
    id: string;
    name: string;
    logoUrl: string;
    modes: string[];
    isPublished: boolean;
    createdAt: Timestamp | any;
}

export interface SiteSettings {
    minWithdrawal: number;
    supportEmail: string;
    supportPhone: string;
    notice: string;
    isNoticeActive: boolean;
    updatedAt: Timestamp | any;
}

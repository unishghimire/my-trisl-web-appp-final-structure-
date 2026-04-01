import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
    uid: string;
    email: string;
    username: string;
    role: 'player' | 'organizer' | 'admin';
    balance: number;
    totalEarnings: number;
    inGameId: string;
    inGameName?: string;
    teamName: string;
    teamId?: string;
    phone: string;
    isBanned: boolean;
    createdAt: Timestamp | any;
    orgStatus?: 'pending' | 'approved' | 'rejected';
    bio?: string;
    profilePicUrl?: string;
    bannerUrl?: string;
    contactInfo?: string;
    skills?: string[];
    status?: 'online' | 'idle' | 'dnd' | 'offline';
    customActivity?: string;
    lastActive?: Timestamp | any;
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
    teamSize: number;
    teamType: 'solo' | 'duo' | 'squad';
    map?: string;
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
    type: 'info' | 'success' | 'warning' | 'alert' | 'invite';
    read: boolean;
    link?: string;
    timestamp: Timestamp | any;
}

export interface Team {
    id: string;
    name: string;
    description: string;
    logoUrl?: string;
    bannerUrl?: string;
    ownerId: string;
    createdAt: Timestamp | any;
}

export interface TeamMember {
    id: string;
    teamId: string;
    userId: string;
    role: 'admin' | 'moderator' | 'member';
    joinedAt: Timestamp | any;
    user?: UserProfile; // Optional joined data
}

export interface TeamInvite {
    id: string;
    teamId: string;
    teamName: string;
    inviterId: string;
    inviteeId: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: Timestamp | any;
}

export interface TeamActivity {
    id: string;
    teamId: string;
    userId: string;
    userName: string;
    action: string;
    details?: string;
    createdAt: Timestamp | any;
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

export interface Participant {
    id: string;
    userId: string;
    tournamentId: string;
    username: string;
    inGameId: string;
    teamName: string;
    teamId?: string;
    teammates?: string[];
    timestamp: Timestamp | any;
}

export interface Media {
    id: string;
    userId: string;
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    createdAt: Timestamp | any;
}

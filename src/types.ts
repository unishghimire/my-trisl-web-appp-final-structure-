import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
    uid: string;
    email: string;
    username: string;
    role: 'player' | 'organizer' | 'admin';
    isPowerOrganizer?: boolean; // Added
    balance: number;
    totalEarnings: number;
    xp: number; // Added
    level: number; // Added
    inGameId: string;
    inGameName?: string;
    teamName: string;
    teamId?: string;
    isVerified?: boolean;
    isChampion?: boolean;
    rank?: string;
    points?: number;
    wins?: number;
    tournamentsPlayed?: number;
    winRate?: number;
    rankChange?: number;
    phone: string;
    isBanned: boolean;
    createdAt: Timestamp | any;
    orgStatus?: 'pending' | 'approved' | 'rejected';
    orgName?: string;
    isOrganizer?: boolean;
    discord?: string;
    youtube?: string;
    whatsapp?: string;
    bio?: string;
    profilePicUrl?: string;
    bannerUrl?: string;
    contactInfo?: string;
    skills?: string[];
    status?: 'online' | 'idle' | 'dnd' | 'offline';
    customActivity?: string;
    lastActive?: Timestamp | any;
    stats?: {
        totalMatches: number;
        wins: number;
        losses: number;
    };
    resultPresets?: { id: string; name: string; config: ResultTemplateConfig }[];
}

export interface PrizeDistribution {
    id: string; // Unique ID for drag-and-drop
    rank: number;
    label: string; // e.g., "1st", "MVP"
    amount: number;
}

export interface ManualResult {
    id: string;
    team: string;
    rank: number;
    score: number;
    status: string;
}

export interface ResultTemplateConfig {
    template: 'classic' | 'esports' | 'highlight' | 'compact' | 'custom';
    theme: {
        primaryColor: string;
        background: string;
    };
    showFields: {
        rank: boolean;
        team: boolean;
        score: boolean;
        status: boolean;
    };
}

export type TournamentStage = 'registration' | 'group_stage' | 'knockout' | 'completed';
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss' | 'hybrid';

export interface TournamentGroup {
    id: string;
    name: string;
    teamLimit: number;
    teams: Team[]; // Array of teams
    matches: Match[]; // Array of matches
    isPublic: boolean;
    passCode?: string;
    inviteLink?: string;
}

export interface MatchChangeLog {
    timestamp: Timestamp | any;
    oldTime: Timestamp | any;
    newTime: Timestamp | any;
    reason?: string;
    changedBy: string;
}

export interface Match {
    id: string;
    tournamentId?: string;
    groupId?: string;
    round: number;
    team1Id?: string;
    team2Id?: string;
    score1?: number;
    score2?: number;
    status: 'scheduled' | 'live' | 'completed';
    scheduledTime?: Timestamp | any;
    rescheduledTime?: Timestamp | any; // Added
    changeHistory?: MatchChangeLog[]; // Added
    winnerId?: string;
    replayLink?: string;
}

export interface Team {
    id: string;
    name: string;
    tag?: string;
    description?: string;
    logoUrl?: string;
    bannerUrl?: string;
    ownerId?: string;
    createdAt?: Timestamp | any;
    region?: string;
    formationDate?: Timestamp | any;
    ranking?: number;
    rankChange?: number;
    points?: number;
    totalEarnings?: number;
    players?: string[]; // Array of user IDs
    captainId?: string;
    stats?: {
        wins: number;
        losses: number;
        draws: number;
        points: number;
    };
}

export interface Tournament {
    id: string;
    title: string;
    game: string;
    bannerUrl?: string;
    isFeatured?: boolean;
    prizePool: number;
    currency?: string; // e.g., "NPR", "USD"
    prizeDistribution?: PrizeDistribution[];
    entryFee: number;
    slots: number;
    currentPlayers: number;
    type: string;
    matchType?: 'scrims' | 'tournament'; // Added
    scheduleType?: 'auto' | 'manual'; // Added
    teamSize: number;
    teamType: 'solo' | 'duo' | 'squad';
    map?: string;
    startTime: Timestamp | any;
    rules?: string;
    status: 'upcoming' | 'live' | 'completed' | 'cancelled';
    stage?: TournamentStage;
    format?: TournamentFormat;
    groups?: TournamentGroup[];
    bracketMatches?: Match[];
    hostUid: string;
    hostName?: string; // Organization Name
    createdAt: Timestamp | any;
    roomId?: string;
    roomPass?: string;
    ytLink?: string;
    uploadLink?: string;
    resultUrl?: string;
    winners?: { uid: string; amount: number; rank: number; username?: string }[];
    distributedAmount?: number;
    manualResults?: ManualResult[];
    resultTemplate?: ResultTemplateConfig;
}

export interface Transaction {
    id: string;
    userId: string;
    username?: string;
    userEmail?: string;
    type: 'deposit' | 'withdrawal' | 'prize' | 'refund' | 'entry_fee';
    amount: number;
    method: string;
    refId: string;
    status: 'pending' | 'success' | 'rejected' | 'refunded';
    timestamp: Timestamp | any;
    desc?: string;
    proofUrl?: string;
    rejectionReason?: string;
    accountDetails?: string;
    confirmedBy?: string;
    confirmedByUsername?: string;
    tournamentId?: string;
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
    description?: string;
    link: string;
    buttonText: string;
    isActive: boolean;
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

export interface TeamMember {
    id: string;
    teamId: string;
    userId: string;
    role: 'admin' | 'moderator' | 'member';
    roleInTeam?: 'Captain' | 'Fragger' | 'IGL' | 'Support' | 'Scout';
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

export interface MatchHistory {
    id: string;
    userId?: string;
    teamId?: string;
    tournamentId: string;
    tournamentName: string;
    result: 'victory' | 'defeat';
    kills: number;
    prize: number;
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
    isOrgFormOpen: boolean;
    orgFormDescription?: string;
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

export interface OrgApplication {
    id: string;
    userId: string;
    username: string;
    name: string;
    orgName: string;
    whatsapp: string;
    email: string;
    proofLink: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp: Timestamp | any;
}

export interface OrgPost {
    id: string;
    orgId: string;
    orgName: string;
    orgAvatar?: string;
    title: string;
    content: string;
    imageUrl?: string;
    createdAt: Timestamp | any;
    updatedAt?: Timestamp | any;
}

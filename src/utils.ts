import { Timestamp } from 'firebase/firestore';

export const formatCurrency = (amount: number | string, prefix: string = 'Rs. ') => {
    const numAmount = Number(amount);
    if (amount === null || amount === undefined || isNaN(numAmount)) return `${prefix}0`;

    const absAmount = Math.abs(numAmount);
    const sign = numAmount < 0 ? '-' : '';

    let formattedValue = '';
    if (absAmount >= 1_000_000_000) {
        formattedValue = (Math.trunc(absAmount / 100_000_000) / 10).toString() + 'B';
    } else if (absAmount >= 1_000_000) {
        formattedValue = (Math.trunc(absAmount / 100_000) / 10).toString() + 'M';
    } else if (absAmount >= 1_000) {
        formattedValue = (Math.trunc(absAmount / 100) / 10).toString() + 'K';
    } else {
        formattedValue = absAmount.toLocaleString('en-US', { maximumFractionDigits: 1 });
    }

    return `${sign}${prefix}${formattedValue}`;
};

export const formatDate = (ts: any) => {
    if (!ts) return 'N/A';
    try {
        if (ts instanceof Timestamp) return ts.toDate().toLocaleString('en-NP');
        if (ts.seconds) return new Timestamp(ts.seconds, ts.nanoseconds).toDate().toLocaleString('en-NP');
        return new Date(ts).toLocaleString('en-NP');
    } catch (e) {
        return 'N/A';
    }
};

export const timeAgo = (ts: any) => {
    if (!ts) return 'Just now';
    const date = ts instanceof Timestamp ? ts.toDate() : ts.seconds ? new Timestamp(ts.seconds, ts.nanoseconds).toDate() : new Date(ts);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
};

export const getYoutubeId = (url: string | undefined) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

export const calculateLevel = (xp: number = 0) => {
    // Simple level formula: Level = floor(XP / 500) + 1
    return Math.floor(xp / 500) + 1;
};

export const getXPForNextLevel = (level: number) => {
    // XP needed for level N+1 is N * 500
    return level * 500;
};

export const getLevelProgress = (xp: number = 0) => {
    const level = calculateLevel(xp);
    const currentLevelXP = (level - 1) * 500;
    const nextLevelXP = level * 500;
    const progress = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    return Math.min(100, Math.max(0, progress));
};

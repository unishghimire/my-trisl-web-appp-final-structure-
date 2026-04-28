import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, Bell, Crown } from 'lucide-react';
import { NotificationService } from '../services/NotificationService';
import { Notification } from '../types';
import ProfileDropdown from './navbar/ProfileDropdown';
import WalletDisplay from './navbar/WalletDisplay';

const Navbar: React.FC = () => {
    const { user, profile, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setIsMobileMenuOpen(false);
        setIsNotificationsOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (user) {
            const unsubNotifications = NotificationService.onNotifications(user.uid, setNotifications);
            const unsubCount = NotificationService.onUnreadCount(user.uid, setUnreadCount);
            return () => {
                unsubNotifications();
                unsubCount();
            };
        }
    }, [user]);

    const handleLogout = async () => {
        logout();
        navigate('/');
    };

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
    const toggleNotifications = () => {
        setIsNotificationsOpen(!isNotificationsOpen);
    };

    const handleNotificationClick = async (n: Notification) => {
        await NotificationService.markAsRead(n.id);
        if (n.link) navigate(n.link);
        setIsNotificationsOpen(false);
    };

    const handleMarkAllRead = async () => {
        if (user) await NotificationService.markAllAsRead(user.uid);
    };

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Games', path: '/games' },
        { name: 'Tournaments', path: '/tournaments' },
        { name: 'Teams', path: '/teams' },
    ];

    if (user) {
        if (profile?.role === 'organizer' || profile?.role === 'admin') {
            navLinks.push({ name: 'Organizer', path: '/organizer' });
        }
        if (profile?.role === 'admin') {
            navLinks.push({ name: 'Admin', path: '/admin' });
        }
    }

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="sticky top-0 z-50 bg-dark/80 backdrop-blur-md border-b border-gray-800 transition-all duration-200">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-between h-16 sm:h-20 max-w-full">
                    {/* Left Section: Logo */}
                    <Link to="/" className="flex items-center gap-2 sm:gap-3 shrink-0 group">
                        <img src="https://github.com/unishghimire/nexplay-logo/blob/main/nexplay.jpg?raw=true" alt="Nexplay Logo" className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg shadow-md group-hover:scale-105 transition-transform" />
                        <span className="text-lg sm:text-2xl font-black tracking-widest text-white leading-none">NEX<span className="text-brand-500">PLAY</span></span>
                    </Link>

                    {/* Center Section: Navigation (Desktop) */}
                    <div className="hidden lg:flex items-center gap-1 mx-4">
                        {navLinks.map((link) => (
                            <Link 
                                key={link.path} 
                                to={link.path} 
                                className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 flex items-center ${isActive(link.path) ? 'bg-brand-500/10 text-brand-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Right Section: Profile, Wallet, Notifications */}
                    <div className="flex items-center justify-end gap-2 sm:gap-4 shrink-0">
                        {user ? (
                            <>
                                <div className="relative">
                                    <button onClick={toggleNotifications} className="text-gray-400 hover:text-white transition-colors relative w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center shrink-0">
                                        <Bell className="w-5 h-5" aria-hidden="true" />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-dark" aria-label={`${unreadCount} unread notifications`}>
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    {isNotificationsOpen && (
                                        <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-[60]">
                                            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                                                <h4 className="text-sm font-black tracking-wider uppercase text-white">Notifications</h4>
                                                <button onClick={handleMarkAllRead} className="text-[10px] uppercase font-bold tracking-widest text-brand-400 hover:text-brand-300 transition-colors">Mark all as read</button>
                                            </div>
                                            <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                                {notifications.length > 0 ? (
                                                    notifications.map(n => (
                                                        <div 
                                                            key={n.id} 
                                                            onClick={() => handleNotificationClick(n)}
                                                            className={`p-4 border-b border-gray-800/50 cursor-pointer hover:bg-white/5 transition-colors ${!n.read ? 'bg-brand-900/5' : ''}`}
                                                        >
                                                            <div className="flex justify-between items-start mb-1 gap-2">
                                                                <span className={`text-xs font-bold leading-tight ${n.type === 'alert' ? 'text-red-400' : n.type === 'success' ? 'text-green-400' : 'text-brand-400'}`}>{n.title}</span>
                                                                {!n.read && <span className="w-2 h-2 bg-brand-500 rounded-full shrink-0 mt-0.5"></span>}
                                                            </div>
                                                            <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{n.message}</p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-8 text-center text-gray-500 text-sm font-medium">No notifications</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="hidden sm:block">
                                    <WalletDisplay balance={profile?.balance || 0} onClick={() => navigate('/wallet')} />
                                </div>
                                <div className="hidden sm:block">
                                    <ProfileDropdown username={profile?.username || 'User'} avatarUrl={profile?.profilePicUrl} onLogout={handleLogout} />
                                </div>
                            </>
                        ) : (
                            <div className="hidden sm:block">
                                <Link to="/login" className="bg-brand-500 hover:bg-brand-600 text-white h-10 px-6 flex items-center justify-center rounded-full font-black tracking-widest text-sm transition-all shadow-lg hover:shadow-brand-500/25 whitespace-nowrap shrink-0">
                                    LOGIN
                                </Link>
                            </div>
                        )}

                        {/* Hamburger icon for smaller screens */}
                        <button 
                            onClick={toggleMobileMenu} 
                            aria-label="Toggle mobile menu" 
                            aria-expanded={isMobileMenuOpen} 
                            className="lg:hidden text-gray-400 hover:text-white w-10 h-10 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center focus:outline-none ml-1 shrink-0"
                        >
                            {isMobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu (now covers all screens below lg) */}
            <div className={`lg:hidden absolute top-full left-0 w-full overflow-y-auto transition-all duration-300 ease-in-out bg-dark/95 backdrop-blur-xl border-b border-gray-800 ${isMobileMenuOpen ? 'max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] opacity-100 border-t border-gray-800/50' : 'max-h-0 opacity-0 pointer-events-none border-t-0'}`}>
                <div className="px-4 py-4 space-y-2">
                    {user && (
                        <div className="flex sm:hidden items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-800">
                            <ProfileDropdown username={profile?.username || 'User'} avatarUrl={profile?.profilePicUrl} onLogout={handleLogout} />
                            <WalletDisplay balance={profile?.balance || 0} onClick={() => navigate('/wallet')} />
                        </div>
                    )}
                    
                    <div className="space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-4 mb-2">Navigation</div>
                        {navLinks.map((link) => (
                            <Link 
                                key={link.path} 
                                to={link.path} 
                                onClick={() => setIsMobileMenuOpen(false)} 
                                className={`block px-4 py-3 rounded-xl text-sm font-bold transition-colors ${isActive(link.path) ? 'text-brand-400 bg-brand-500/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {user ? (
                        <div className="pt-4 mt-4 border-t border-gray-800 space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-4 mb-2">Account</div>
                            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                                Dashboard
                            </Link>
                            <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                                My Profile
                            </Link>
                            <Link to="/wallet" onClick={() => setIsMobileMenuOpen(false)} className="block sm:hidden px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                                My Wallet
                            </Link>
                            <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="block w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors mt-2">
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <div className="pt-4 mt-4 border-t border-gray-800 sm:hidden">
                            <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center w-full bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-full font-black tracking-widest text-sm transition-all shadow-lg hover:shadow-brand-500/25">
                                LOGIN / SIGN UP
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;

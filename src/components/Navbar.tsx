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
        console.log('Toggling notifications, current state:', isNotificationsOpen);
        setIsNotificationsOpen(!isNotificationsOpen);
    };

    const handleNotificationClick = async (n: Notification) => {
        console.log('Notification clicked:', n);
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
        <nav className="sticky top-0 z-50 bg-dark/80 backdrop-blur-md border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Left Section: Logo */}
                    <div className="flex items-center cursor-pointer group" onClick={() => navigate('/')}>
                        <img src="https://github.com/unishghimire/nexplay-logo/blob/main/nexplay.jpg?raw=true" alt="Nexplay Logo" className="w-8 h-8 sm:w-9 sm:h-9 rounded-md mr-2" />
                        <span className="text-lg sm:text-xl font-bold tracking-wider text-white">NEX<span className="text-brand-500">PLAY</span></span>
                    </div>

                    {/* Center Section: Navigation */}
                    <div className="hidden lg:flex items-center space-x-1">
                        {navLinks.map((link) => (
                            <Link 
                                key={link.path} 
                                to={link.path} 
                                className={`px-3 py-2 rounded-md text-sm font-medium transition flex items-center ${isActive(link.path) ? 'text-white border-b-2 border-brand-500' : 'text-gray-300 hover:text-white'}`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Right Section: Profile, Wallet, Notifications */}
                    <div className="hidden lg:flex items-center gap-4">
                        {user ? (
                            <>
                                <div className="relative">
                                    <button onClick={toggleNotifications} className="text-gray-400 hover:text-white transition relative p-2">
                                        <Bell className="w-5 h-5" />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    {isNotificationsOpen && (
                                    <div className="absolute right-0 mt-2 w-80 bg-card border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-[60]">
                                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                                                <h4 className="text-sm font-bold text-white">Notifications</h4>
                                                <button onClick={handleMarkAllRead} className="text-[10px] text-brand-400 hover:underline">Mark all as read</button>
                                            </div>
                                            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                                {notifications.length > 0 ? (
                                                    notifications.map(n => (
                                                        <div 
                                                            key={n.id} 
                                                            onClick={() => handleNotificationClick(n)}
                                                            className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-surface transition ${!n.read ? 'bg-brand-900/10' : ''}`}
                                                        >
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className={`text-xs font-bold ${n.type === 'alert' ? 'text-red-400' : n.type === 'success' ? 'text-green-400' : 'text-brand-400'}`}>{n.title}</span>
                                                                {!n.read && <span className="w-2 h-2 bg-brand-500 rounded-full"></span>}
                                                            </div>
                                                            <p className="text-xs text-gray-400 line-clamp-2">{n.message}</p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-8 text-center text-gray-500 text-sm">No notifications</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <WalletDisplay balance={profile?.balance || 0} onClick={() => navigate('/wallet')} />
                                <ProfileDropdown username={profile?.username || 'User'} avatarUrl={profile?.profilePicUrl} onLogout={handleLogout} />
                            </>
                        ) : (
                            <button onClick={() => navigate('/login')} className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg font-bold transition shadow-lg shadow-brand-600/20">LOGIN</button>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <div className="lg:hidden flex items-center gap-1">
                        {user && (
                            <div className="relative mr-1">
                                <button onClick={toggleNotifications} className="text-gray-400 hover:text-white transition relative p-2">
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                                {isNotificationsOpen && (
                                    <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-card border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-[60]">
                                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                                            <h4 className="text-sm font-bold text-white">Notifications</h4>
                                            <button onClick={handleMarkAllRead} className="text-[10px] text-brand-400 hover:underline">Mark all as read</button>
                                        </div>
                                        <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                            {notifications.length > 0 ? (
                                                notifications.map(n => (
                                                    <div 
                                                        key={n.id} 
                                                        onClick={() => handleNotificationClick(n)}
                                                        className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-surface transition ${!n.read ? 'bg-brand-900/10' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className={`text-xs font-bold ${n.type === 'alert' ? 'text-red-400' : n.type === 'success' ? 'text-green-400' : 'text-brand-400'}`}>{n.title}</span>
                                                            {!n.read && <span className="w-2 h-2 bg-brand-500 rounded-full"></span>}
                                                        </div>
                                                        <p className="text-xs text-gray-400 line-clamp-2">{n.message}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-8 text-center text-gray-500 text-sm">No notifications</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {user && <WalletDisplay balance={profile?.balance || 0} onClick={() => navigate('/wallet')} />}
                        {user && <ProfileDropdown username={profile?.username || 'User'} avatarUrl={profile?.profilePicUrl} onLogout={handleLogout} />}
                        <button onClick={toggleMobileMenu} className="text-gray-400 hover:text-white p-1 rounded-md focus:outline-none">
                            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="lg:hidden bg-dark border-b border-gray-800 animate-fade-in">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {navLinks.map((link) => (
                            <Link key={link.path} to={link.path} onClick={toggleMobileMenu} className={`block px-3 py-3 border-b border-gray-800 text-base font-medium ${isActive(link.path) ? 'text-white bg-brand-900/20' : 'text-gray-300 hover:text-white'}`}>
                                {link.name}
                            </Link>
                        ))}
                        {user ? (
                            <>
                                <Link to="/dashboard" onClick={toggleMobileMenu} className="block px-3 py-3 border-b border-gray-800 text-gray-300">
                                    Dashboard
                                </Link>
                                <Link to="/profile" onClick={toggleMobileMenu} className="block px-3 py-3 border-b border-gray-800 text-gray-300">
                                    My Profile
                                </Link>
                                <button onClick={() => { handleLogout(); toggleMobileMenu(); }} className="block w-full text-left px-3 py-3 text-red-400 font-bold">
                                    Logout
                                </button>
                            </>
                        ) : (
                            <Link to="/login" onClick={toggleMobileMenu} className="block px-3 py-3 text-brand-400 font-bold mt-2">
                                LOGIN / SIGN UP
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;

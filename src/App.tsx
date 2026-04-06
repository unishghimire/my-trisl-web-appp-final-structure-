import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Breadcrumbs from './components/Breadcrumbs';
import Footer from './components/Footer';
import BackButton from './components/BackButton';
import ScrollToTop from './components/ScrollToTop';
import Home from './views/Home';
import Tournaments from './views/Tournaments';
import TournamentDetails from './views/TournamentDetails';
import Dashboard from './views/Dashboard';
import Wallet from './views/Wallet';
import Profile from './views/Profile';
import Leaderboard from './views/Leaderboard';
import AdminPanel from './views/AdminPanel';
import OrganizerPanel from './views/OrganizerPanel';
import About from './views/About';
import Contact from './views/Contact';
import Privacy from './views/Privacy';
import Teams from './views/Teams';
import TeamDetails from './views/TeamDetails';
import OrgBrowser from './views/OrgBrowser';
import PublicProfile from './views/PublicProfile';
import ProfileCompletionGuard from './components/ProfileCompletionGuard';
import CompleteProfile from './views/CompleteProfile';
import PostDetails from './views/PostDetails';
import Toast, { ToastType } from './components/Toast';
import GamesBrowser from './views/GamesBrowser';
import GameModesBrowser from './views/GameModesBrowser';
import Login from './views/Login';
import Register from './views/Register';
import ProtectedRoute from './components/ProtectedRoute';

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

const AppContent = ({ toasts, removeToast }: { toasts: ToastData[], removeToast: (id: number) => void }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div id="app" className="min-h-screen flex flex-col relative">
      <Navbar />
      <Breadcrumbs />
      <ScrollToTop />
      <main id="main-content" className="flex-grow container mx-auto px-4 pt-8 pb-24 relative min-h-[80vh]">
        {!isHome && (
          <div className="mb-6">
            <BackButton />
          </div>
        )}
        <ProfileCompletionGuard>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/games" element={<GamesBrowser />} />
            <Route path="/games/:id" element={<GameModesBrowser />} />
            <Route path="/details/:id" element={<TournamentDetails />} />
            <Route path="/post/:id" element={<PostDetails />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
            <Route path="/user/:id" element={<PublicProfile />} />
            <Route path="/profile/:id" element={<PublicProfile />} />
            <Route path="/organization/:id" element={<PublicProfile />} />
            <Route path="/organizations" element={<OrgBrowser />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/team/:id" element={<TeamDetails />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminPanel /></ProtectedRoute>} />
            <Route path="/organizer" element={<ProtectedRoute allowedRoles={['organizer', 'admin']}><OrganizerPanel /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </ProfileCompletionGuard>
      </main>
      <Footer />
      <div id="toast-container" className="fixed bottom-5 right-5 z-[100] pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <AuthProvider>
          <NotificationProvider>
            <Router>
              <AppContent toasts={toasts} removeToast={removeToast} />
            </Router>
          </NotificationProvider>
        </AuthProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

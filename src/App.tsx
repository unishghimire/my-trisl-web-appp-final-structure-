import React, { useState, useCallback, Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Breadcrumbs from './components/Breadcrumbs';
import Footer from './components/Footer';
import BackButton from './components/BackButton';
import ScrollToTop from './components/ScrollToTop';
import ProfileCompletionGuard from './components/ProfileCompletionGuard';
import Toast, { ToastType } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load views
const Home = lazy(() => import('./views/Home'));
const Tournaments = lazy(() => import('./views/Tournaments'));
const TournamentDetails = lazy(() => import('./views/TournamentDetails'));
const Dashboard = lazy(() => import('./views/Dashboard'));
const Profile = lazy(() => import('./views/Profile'));
const Wallet = lazy(() => import('./views/Wallet'));
const Leaderboard = lazy(() => import('./views/Leaderboard'));
const AdminPanel = lazy(() => import('./views/AdminPanel'));
const OrganizerPanel = lazy(() => import('./views/OrganizerPanel'));
const TournamentAdminPanel = lazy(() => import('./views/TournamentAdminPanel'));
const About = lazy(() => import('./views/About'));
const Contact = lazy(() => import('./views/Contact'));
const Privacy = lazy(() => import('./views/Privacy'));
const Teams = lazy(() => import('./views/Teams'));
const TeamDetails = lazy(() => import('./views/TeamDetails'));
const OrgBrowser = lazy(() => import('./views/OrgBrowser'));
const PublicProfile = lazy(() => import('./views/PublicProfile'));
const CompleteProfile = lazy(() => import('./views/CompleteProfile'));
const PostDetails = lazy(() => import('./views/PostDetails'));
const GamesBrowser = lazy(() => import('./views/GamesBrowser'));
const GameModesBrowser = lazy(() => import('./views/GameModesBrowser'));
const Login = lazy(() => import('./views/Login'));
const Register = lazy(() => import('./views/Register'));

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

const LoadingFallback = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center">
    <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading...</p>
  </div>
);

import WalletModal from './components/WalletModal';

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
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/games" element={<GamesBrowser />} />
              <Route path="/games/:id" element={<GameModesBrowser />} />
              <Route path="/details/:id" element={<TournamentDetails />} />
              <Route path="/post/:id" element={<PostDetails />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
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
              <Route path="/tournament-admin/:id" element={<ProtectedRoute allowedRoles={['organizer', 'admin']}><TournamentAdminPanel /></ProtectedRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
            </Routes>
          </Suspense>
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

import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
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
import Toast, { ToastType } from './components/Toast';

import GamesBrowser from './views/GamesBrowser';

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

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
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <div id="app" className="min-h-screen flex flex-col relative">
            <Navbar />
            <main id="main-content" className="flex-grow container mx-auto px-4 py-8 relative min-h-[80vh]">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/games" element={<GamesBrowser />} />
                <Route path="/details/:id" element={<TournamentDetails />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/organizer" element={<OrganizerPanel />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/privacy" element={<Privacy />} />
              </Routes>
            </main>
            <Footer />
            <div id="toast-container" className="fixed bottom-5 right-5 z-[100] pointer-events-none">
              {toasts.map(t => (
                <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
              ))}
            </div>
          </div>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown, Users, Trophy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ProfileDropdownProps {
  username: string;
  avatarUrl?: string;
  onLogout: () => void;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ username, avatarUrl, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700"
      >
        <div className="w-6 h-6 bg-brand-700 rounded-full flex items-center justify-center font-bold text-xs">
          {avatarUrl ? <img src={avatarUrl} className="w-full h-full rounded-full object-cover" alt="Avatar" /> : username[0].toUpperCase()}
        </div>
        <span className="hidden md:block truncate max-w-[80px]">{username}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-card border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-50">
          <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-surface hover:text-white transition">
            <User className="w-4 h-4" /> View Profile
          </Link>
          <Link to="/teams" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-surface hover:text-white transition">
            <Users className="w-4 h-4" /> My Teams
          </Link>
          <Link to="/tournaments" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-surface hover:text-white transition">
            <Trophy className="w-4 h-4" /> My Tournaments
          </Link>
          <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-surface hover:text-white transition">
            <Settings className="w-4 h-4" /> Settings
          </Link>
          <button onClick={() => { onLogout(); setIsOpen(false); }} className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-surface hover:text-red-300 transition">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;

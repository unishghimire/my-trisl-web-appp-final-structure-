import React from 'react';
import { Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils';

interface WalletDisplayProps {
  balance: number;
}

const WalletDisplay: React.FC<WalletDisplayProps> = ({ balance }) => {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => navigate('/wallet')}
      className="flex items-center gap-1.5 bg-gradient-to-r from-brand-900/20 to-purple-900/20 border border-brand-500/30 px-2 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-lg hover:border-brand-500/50 transition cursor-pointer whitespace-nowrap"
    >
      <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-400" />
      <span className="text-xs sm:text-sm font-black text-white tracking-widest">{formatCurrency(balance)}</span>
    </button>
  );
};

export default WalletDisplay;

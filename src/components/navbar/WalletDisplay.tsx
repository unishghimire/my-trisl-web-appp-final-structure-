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
      className="flex items-center gap-2 bg-gradient-to-r from-brand-900/20 to-purple-900/20 border border-brand-500/30 px-4 py-1.5 rounded-full shadow-lg hover:border-brand-500/50 transition cursor-pointer"
    >
      <Wallet className="w-4 h-4 text-brand-400" />
      <span className="text-sm font-black text-white tracking-widest">{formatCurrency(balance)}</span>
    </button>
  );
};

export default WalletDisplay;

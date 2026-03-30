import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const colors = type === 'error' ? 'bg-red-900/90 border-red-500 text-red-100' : type === 'success' ? 'bg-green-900/90 border-green-500 text-green-100' : 'bg-slate-800 border-brand-500 text-white';
    const icon = type === 'success' ? <CheckCircle className="w-5 h-5" /> : type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />;

    return (
        <div className={`toast mb-3 p-4 rounded-lg shadow-lg border-l-4 flex items-center gap-3 ${colors} backdrop-blur-sm`}>
            {icon}
            <span className="flex-grow">{message}</span>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export default Toast;

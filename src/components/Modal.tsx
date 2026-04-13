import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'sm:max-w-lg' }) => {
    const location = useLocation();

    useEffect(() => {
        if (isOpen) {
            onClose();
        }
    }, [location.pathname]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 modal-backdrop transition-opacity" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                <div className={`relative inline-block align-bottom bg-card rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle ${maxWidth} sm:w-full border border-gray-700`}>
                    {title && (
                        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">{title}</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                    <div className="p-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Modal;

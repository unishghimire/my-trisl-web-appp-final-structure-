import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle } from 'lucide-react';

const Footer: React.FC = () => {
    return (
        <footer className="bg-dark border-t border-gray-800 py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-gray-500 text-sm text-center md:text-left">
                    <p>&copy; 2025 NexPlay.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-6 text-sm font-medium">
                    <Link to="/about" className="text-gray-400 hover:text-white transition">About Us</Link>
                    <Link to="/contact" className="text-gray-400 hover:text-white transition">Contact</Link>
                    <Link to="/privacy" className="text-gray-400 hover:text-white transition">Privacy Policy</Link>
                </div>
                <div className="flex gap-4 text-gray-400 text-sm">
                    <a href="mailto:nexplayorg@gmail.com" className="hover:text-white transition flex items-center gap-2">
                        <Mail className="w-4 h-4" /> nexplayorg@gmail.com
                    </a>
                    <a href="https://wa.me/+9779767783336" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

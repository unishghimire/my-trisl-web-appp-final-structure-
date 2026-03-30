import React from 'react';
import { Headset, Mail, Briefcase, MessageCircle, Facebook, Instagram, Music2 } from 'lucide-react';

const Contact: React.FC = () => {
    return (
        <div className="animate-fade-in max-w-3xl mx-auto">
            <div className="bg-card p-8 rounded-xl border border-gray-800 shadow-2xl">
                <h1 className="text-3xl font-bold text-white mb-6 border-b border-gray-700 pb-4 flex items-center">
                    <Headset className="mr-3 text-brand-500 w-8 h-8" /> Contact Us
                </h1>
                <p className="text-gray-400 mb-8">Have a question, found a bug, or want to partner with us? We'd love to hear from you.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="bg-surface p-4 rounded-lg border border-gray-700">
                            <h3 className="text-brand-400 font-bold text-sm uppercase mb-1">Email Support</h3>
                            <a href="mailto:nexplayorg@gmail.com" className="text-white text-lg hover:text-brand-300 transition flex items-center gap-2">
                                <Mail className="w-5 h-5" /> nexplayorg@gmail.com
                            </a>
                        </div>
                        <div className="bg-surface p-4 rounded-lg border border-gray-700">
                            <h3 className="text-brand-400 font-bold text-sm uppercase mb-1">Business Inquiries</h3>
                            <a href="mailto:nex.unishghimire@gmail.com" className="text-white text-lg hover:text-brand-300 transition flex items-center gap-2">
                                <Briefcase className="w-5 h-5" /> next.unishghimire@gmail.com
                            </a>
                        </div>
                    </div>

                    <div className="bg-dark p-6 rounded-lg border border-gray-700 text-center">
                        <h3 className="text-white font-bold mb-4">Follow Us</h3>
                        <div className="flex flex-col gap-3">
                            <a href="https://discord.gg/D3M3AqAe5U" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white py-3 rounded-lg font-bold transition">
                                <MessageCircle className="w-5 h-5" /> Join Discord
                            </a>
                            <a href="https://www.facebook.com/nexplayorg" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white py-3 rounded-lg font-bold transition">
                                <Facebook className="w-5 h-5" /> Facebook Page
                            </a>
                            <a href="https://www.instagram.com/nexplayorg?igsh=MWd6a2hqa2JqbzBxaw==" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-[#E1306C] hover:bg-[#C13584] text-white py-3 rounded-lg font-bold transition">
                                <Instagram className="w-5 h-5" /> Instagram
                            </a>
                            <a href="https://wa.me/+9779767783336" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-[#32cd32] hover:bg-[#28a745] text-white py-3 rounded-lg font-bold transition">
                                <MessageCircle className="w-5 h-5" /> WhatsApp
                            </a>
                            <a href="https://www.tiktok.com/@nexplayorg" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 bg-[#000039] hover:bg-black text-white py-3 rounded-lg font-bold transition">
                                <Music2 className="w-5 h-5" /> TikTok
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Contact;

import React from 'react';
import { Info, Users, Trophy, Zap } from 'lucide-react';

const About: React.FC = () => {
    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="bg-card p-8 rounded-xl border border-gray-800 shadow-2xl">
                <h1 className="text-3xl font-bold text-white mb-6 border-b border-gray-700 pb-4 flex items-center">
                    <Info className="mr-3 text-brand-500 w-8 h-8" /> About NexPlay
                </h1>
                <div className="space-y-4 text-gray-300 leading-relaxed">
                    <p>Welcome to <span className="text-brand-400 font-bold">NexPlay</span>, Nepal's premier esports tournament platform designed for gamers, by gamers. We are dedicated to elevating the esports ecosystem in Nepal by providing a professional, secure, and competitive environment for players to showcase their skills.</p>
                    <p>Founded in 2025, our mission is to bridge the gap between casual gaming and professional esports. Whether you play PUBG Mobile, Free Fire, or Mobile Legends, NexPlay offers daily tournaments, scrims, and major leagues with real cash prizes.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                        <div className="bg-dark p-4 rounded-lg border border-gray-700 text-center">
                            <Users className="text-3xl text-blue-500 mb-2 mx-auto" />
                            <h3 className="font-bold text-white">Community First</h3>
                            <p className="text-xs text-gray-500">Building a safe and toxic-free environment.</p>
                        </div>
                        <div className="bg-dark p-4 rounded-lg border border-gray-700 text-center">
                            <Trophy className="text-3xl text-yellow-500 mb-2 mx-auto" />
                            <h3 className="font-bold text-white">Fair Play</h3>
                            <p className="text-xs text-gray-500">Advanced anti-cheat and strict moderation.</p>
                        </div>
                        <div className="bg-dark p-4 rounded-lg border border-gray-700 text-center">
                            <Zap className="text-3xl text-brand-500 mb-2 mx-auto" />
                            <h3 className="font-bold text-white">Instant Payouts</h3>
                            <p className="text-xs text-gray-500">Fast and secure prize distribution.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;

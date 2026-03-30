import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, runTransaction, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, getYoutubeId } from '../utils';
import { Clock, Users, Trophy, Lock, Eye, Play } from 'lucide-react';
import { NotificationService } from '../services/NotificationService';

const TournamentDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [isJoined, setIsJoined] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!id) return;
            try {
                const docRef = doc(db, 'tournaments', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setTournament({ id: docSnap.id, ...docSnap.data() } as Tournament);
                    
                    if (user) {
                        const pSnap = await getDocs(query(
                            collection(db, 'participants'),
                            where('tournamentId', '==', id),
                            where('userId', '==', user.uid)
                        ));
                        setIsJoined(!pSnap.empty);
                    }
                }
            } catch (error) {
                console.error("Error fetching tournament details:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id, user]);

    const handleJoin = async () => {
        if (!user) {
            alert("Please login to join!");
            return;
        }
        if (!tournament || !profile) return;

        if (!profile.inGameId) {
            alert("Save your In-Game ID in Profile first!");
            navigate('/profile');
            return;
        }

        const tRef = doc(db, 'tournaments', tournament.id);
        const userRef = doc(db, 'users', user.uid);
        const partRef = doc(collection(db, 'participants'));

        try {
            await runTransaction(db, async (transaction) => {
                const tDoc = await transaction.get(tRef);
                const uDoc = await transaction.get(userRef);
                if (!tDoc.exists()) throw new Error("Tournament does not exist!");
                const tData = tDoc.data() as Tournament;
                const uData = uDoc.data() as UserProfile;

                if (tData.currentPlayers >= tData.slots) throw new Error("Tournament is Full!");
                if (uData.balance < tData.entryFee) throw new Error("Insufficient Balance!");

                transaction.update(userRef, { balance: uData.balance - tData.entryFee });
                transaction.update(tRef, { currentPlayers: tData.currentPlayers + 1 });
                transaction.set(partRef, {
                    userId: user.uid,
                    tournamentId: tournament.id,
                    inGameId: uData.inGameId,
                    teamName: uData.teamName || '',
                    username: uData.username,
                    timestamp: serverTimestamp()
                });
            });
            setIsJoined(true);
            await NotificationService.create(
                user.uid,
                'Tournament Joined!',
                `You have successfully joined ${tournament.title}. Good luck!`,
                'success',
                `/details/${tournament.id}`
            );
            alert('Joined Successfully!');
            navigate('/dashboard');
        } catch (e: any) {
            alert(e.message);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="loader mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono">ESTABLISHING UPLINK...</p>
            </div>
        );
    }

    if (!tournament) return <p className="text-center mt-10">Tournament not found.</p>;

    const bannerStyle = tournament.bannerUrl ? { backgroundImage: `url('${tournament.bannerUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: 'linear-gradient(to right, #4c1d95, #0f172a)' };
    const showRoom = isJoined && (tournament.status === 'live' || (tournament.roomId && tournament.status === 'upcoming'));
    const ytId = getYoutubeId(tournament.ytLink);

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="bg-card rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
                <div className="h-64 relative" style={bannerStyle}>
                    <div className="absolute inset-0 bg-black/50"></div>
                    <div className="absolute bottom-0 left-0 p-8 w-full bg-gradient-to-t from-gray-900 to-transparent">
                        <span className="bg-brand-600 text-white text-xs font-bold px-2 py-1 rounded mb-2 inline-block shadow">{tournament.game}</span>
                        <h1 className="text-3xl md:text-5xl font-bold text-white neon-text shadow-lg">{tournament.title}</h1>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8">
                    <div className="md:col-span-2 space-y-6">
                        {ytId && (
                            <div className="aspect-w-16 aspect-h-9 mb-6">
                                <iframe 
                                    src={`https://www.youtube.com/embed/${ytId}`} 
                                    frameBorder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowFullScreen 
                                    className="w-full h-64 md:h-96 rounded-xl shadow-lg border border-gray-700"
                                ></iframe>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-surface p-3 rounded border border-gray-700">
                                <div className="text-gray-500 text-xs uppercase">Start Time</div>
                                <div className="text-white font-bold">{formatDate(tournament.startTime)}</div>
                            </div>
                            <div className="bg-surface p-3 rounded border border-gray-700">
                                <div className="text-gray-500 text-xs uppercase">Type</div>
                                <div className="text-white font-bold">{tournament.type || 'Solo'}</div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-white font-bold mb-2">Rules & Information</h3>
                            <div className="bg-surface p-4 rounded-lg border border-gray-700 text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                                {tournament.rules || 'No specific rules provided. Play fair.'}
                            </div>
                        </div>
                        {showRoom ? (
                            <div className="bg-gradient-to-r from-brand-900/40 to-gray-900 border border-brand-500/50 p-4 rounded-lg animate-fade-in">
                                <h3 className="text-brand-400 font-bold mb-3 text-sm uppercase tracking-wider flex items-center">
                                    <Play className="w-4 h-4 mr-2 text-red-500" /> Room Access
                                </h3>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-400 text-sm">Room ID</span>
                                    <span className="font-mono text-white text-lg bg-black/30 px-3 py-1 rounded select-all cursor-pointer hover:bg-black/50">{tournament.roomId || 'Wait'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Password</span>
                                    <span className="font-mono text-white text-lg bg-black/30 px-3 py-1 rounded select-all cursor-pointer hover:bg-black/50">{tournament.roomPass || '---'}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-800/50 p-4 rounded-lg text-center text-gray-500 border border-gray-700 border-dashed">
                                <Lock className="inline-block w-4 h-4 mr-2" /> Room details appear here for registered players.
                            </div>
                        )}
                    </div>
                    <div className="space-y-6">
                        <div className="bg-surface p-6 rounded-xl border border-gray-700 text-center">
                            <div className="text-gray-400 text-sm mb-1">Prize Pool</div>
                            <div className="text-3xl font-bold text-brand-400 mb-4">{formatCurrency(tournament.prizePool)}</div>
                            {tournament.prizeDistribution && tournament.prizeDistribution.length > 0 && (
                                <div className="mt-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                    <h4 className="text-white text-sm font-bold uppercase mb-2 border-b border-gray-600 pb-1">Prize Breakdown</h4>
                                    {tournament.prizeDistribution.map(p => (
                                        <div key={p.rank} className="flex justify-between py-2 border-b border-gray-700 last:border-0">
                                            <span className="text-gray-300 font-medium">Rank {p.rank}</span>
                                            <span className="text-brand-400 font-bold">{formatCurrency(p.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-between text-sm text-gray-400 mb-4 border-t border-gray-600 pt-4 mt-4">
                                <span>Entry Fee</span>
                                <span className="text-white font-bold">{tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : 'FREE'}</span>
                            </div>
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Slots Filled</span>
                                    <span>{tournament.currentPlayers}/{tournament.slots}</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${(tournament.currentPlayers / tournament.slots) * 100}%` }}></div>
                                </div>
                            </div>
                            {tournament.status === 'completed' ? (
                                <button className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold text-white shadow-lg">VIEW RESULTS</button>
                            ) : !user ? (
                                <button onClick={() => navigate('/profile')} className="w-full bg-gray-700 py-3 rounded-lg font-bold text-white">Login to Join</button>
                            ) : isJoined ? (
                                <button disabled className="w-full bg-green-900/50 text-green-400 border border-green-500/50 py-3 rounded-lg font-bold">Registered</button>
                            ) : tournament.currentPlayers >= tournament.slots ? (
                                <button disabled className="w-full bg-red-900/20 text-red-500 border border-red-900 py-3 rounded-lg font-bold">FULL</button>
                            ) : tournament.status !== 'upcoming' ? (
                                <button disabled className="w-full bg-gray-700 text-gray-400 py-3 rounded-lg">CLOSED</button>
                            ) : (
                                <button onClick={handleJoin} className="w-full bg-brand-600 hover:bg-brand-500 py-3 rounded-lg font-bold text-white shadow-lg">JOIN NOW</button>
                            )}
                            <button className="w-full mt-3 border border-gray-600 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm font-bold transition">View Participants</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TournamentDetails;

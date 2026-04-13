import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, Game, Slide } from '../types';
import TournamentCard from '../components/TournamentCard';
import GameCard from '../components/GameCard';
import PromotionSlider from '../components/PromotionSlider';
import HotPromotionsSlider, { PromoSlide } from '../components/HotPromotionsSlider';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronRight, Gamepad2, Wallet, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HomeProps {
    openDepositModal: () => void;
    openWithdrawModal: () => void;
}

// Sample data for Hot Promotions Slider
const promoSlides: PromoSlide[] = [
    {
        id: 1,
        tournamentName: "NEXPLAY LEAGUE",
        game: "FREE FIRE",
        format: "SQUAD",
        status: "UPCOMING",
        prizePool: "Rs. 100,000",
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        image: "https://picsum.photos/seed/promo1/1920/1080",
        link: "/tournaments"
    },
    {
        id: 2,
        tournamentName: "CCC TOURNAMENT",
        game: "PUBG MOBILE",
        format: "SQUAD",
        status: "LIVE",
        prizePool: "Rs. 50,000",
        startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        image: "https://picsum.photos/seed/promo2/1920/1080",
        link: "/tournaments"
    },
    {
        id: 3,
        tournamentName: "COMING SOON",
        game: "VALORANT",
        format: "5V5",
        status: "UPCOMING",
        prizePool: "TBA",
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        image: "https://picsum.photos/seed/promo3/1920/1080",
        link: "/tournaments"
    }
];

const Home: React.FC<HomeProps> = ({ openDepositModal, openWithdrawModal }) => {
    const { user } = useAuth();
    const [featuredTournaments, setFeaturedTournaments] = useState<Tournament[]>([]);
    const [popularGames, setPopularGames] = useState<Game[]>([]);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch active slides
                const slidesSnap = await getDocs(query(
                    collection(db, 'slides'),
                    where('isActive', '==', true),
                    orderBy('createdAt', 'desc'),
                    limit(5)
                ));
                const slidesData = slidesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slide));
                setSlides(slidesData);

                // Fetch featured tournaments
                const tournamentsSnap = await getDocs(query(
                    collection(db, 'tournaments'),
                    where('isFeatured', '==', true),
                    where('status', '==', 'upcoming'),
                    limit(6)
                ));
                const tournamentsData = tournamentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
                setFeaturedTournaments(tournamentsData);

                // Fetch popular games
                const gamesSnap = await getDocs(query(
                    collection(db, 'games'),
                    where('isPublished', '==', true),
                    limit(8)
                ));
                const gamesData = gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                setPopularGames(gamesData);
            } catch (error) {
                console.error("Error fetching home data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-brand-500 text-xs font-black uppercase tracking-widest animate-pulse">Establishing Uplink...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-16 pb-20 relative">
            <div className="relative">
                <PromotionSlider slides={slides} />
            </div>

            {/* PROMO SLIDER START */}
            <HotPromotionsSlider slides={promoSlides} />
            {/* PROMO SLIDER END */}

            <section className="px-2">
                <div className="flex justify-between items-center mb-8">
                    <div className="space-y-1">
                        <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <Star className="text-yellow-500 w-6 h-6 md:w-8 md:h-8" />
                            Featured <span className="text-brand-500">Tournaments</span>
                        </h2>
                        <p className="text-gray-500 text-xs md:text-sm font-medium">Join the most prestigious battles on Nexplay</p>
                    </div>
                    <button 
                        onClick={() => navigate('/tournaments')} 
                        className="bg-gray-800/50 hover:bg-gray-700 text-white px-4 py-2 md:px-6 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-gray-700"
                    >
                        View All <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {featuredTournaments.length > 0 ? (
                        featuredTournaments.map(t => <TournamentCard key={t.id} tournament={t} />)
                    ) : (
                        <div className="col-span-full py-20 text-center text-gray-500 bg-gray-900/50 rounded-3xl border border-dashed border-gray-800">
                            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="font-bold uppercase tracking-widest text-sm">No featured tournaments active</p>
                        </div>
                    )}
                </div>
            </section>

            <section className="px-2">
                <div className="flex justify-between items-center mb-8">
                    <div className="space-y-1">
                        <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <Gamepad2 className="text-brand-500 w-6 h-6 md:w-8 md:h-8" />
                            Popular <span className="text-brand-500">Games</span>
                        </h2>
                        <p className="text-gray-500 text-xs md:text-sm font-medium">Explore tournaments across your favorite titles</p>
                    </div>
                    <button 
                        onClick={() => navigate('/games')} 
                        className="bg-gray-800/50 hover:bg-gray-700 text-white px-4 py-2 md:px-6 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-gray-700"
                    >
                        Explore <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    {popularGames.length > 0 ? (
                        popularGames.map(g => <GameCard key={g.id} game={g} />)
                    ) : (
                        <div className="col-span-full py-20 text-center text-gray-500 bg-gray-900/50 rounded-3xl border border-dashed border-gray-800">
                            <p className="font-bold uppercase tracking-widest text-sm">No games listed yet</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Home;

import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, Slide, Game } from '../types';
import TournamentCard from '../components/TournamentCard';
import GameCard from '../components/GameCard';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronRight, Gamepad2 } from 'lucide-react';

const Home: React.FC = () => {
    const [featuredTournaments, setFeaturedTournaments] = useState<Tournament[]>([]);
    const [popularGames, setPopularGames] = useState<Game[]>([]);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const slidesSnap = await getDocs(query(collection(db, 'slides'), orderBy('createdAt', 'desc')));
                const slidesData = slidesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slide));
                setSlides(slidesData);

                const tournamentsSnap = await getDocs(query(
                    collection(db, 'tournaments'),
                    where('isFeatured', '==', true),
                    limit(3)
                ));
                const tournamentsData = tournamentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
                setFeaturedTournaments(tournamentsData);

                const gamesSnap = await getDocs(query(
                    collection(db, 'games'),
                    where('isPublished', '==', true),
                    limit(4)
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

    useEffect(() => {
        if (slides.length > 1) {
            const interval = setInterval(() => {
                setCurrentSlide((prev) => (prev + 1) % slides.length);
            }, 4000);
            return () => clearInterval(interval);
        }
    }, [slides]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="loader mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono">ESTABLISHING UPLINK...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <section id="hero-slider" className="relative rounded-2xl overflow-hidden bg-gray-900 mb-12 border border-gray-800 shadow-2xl h-[400px]">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-900/90 to-transparent z-10"></div>
                <div id="slides-container">
                    {slides.length === 0 ? (
                        <div className="slide active">
                            <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1600" className="w-full h-[400px] object-cover opacity-60" alt="Default Hero" />
                            <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 z-20">
                                <h1 className="text-4xl md:text-6xl font-bold mb-4 neon-text text-white">WELCOME TO NEXPLAY</h1>
                                <p className="text-gray-300">Nepal's #1 Esports Platform</p>
                            </div>
                        </div>
                    ) : (
                        slides.map((slide, index) => (
                            <div key={slide.id} className={`slide ${index === currentSlide ? 'active' : ''}`}>
                                <img src={slide.imageUrl} className="w-full h-[400px] object-cover opacity-60" alt={slide.title} />
                                <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 z-20">
                                    <h1 className="text-4xl md:text-6xl font-bold mb-4 neon-text text-white uppercase">{slide.title}</h1>
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => slide.link.startsWith('http') ? window.open(slide.link, '_blank') : navigate(slide.link)} 
                                            className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg uppercase transition"
                                        >
                                            {slide.buttonText || 'JOIN NOW'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            <section className="mt-10">
                <div className="flex justify-between items-end mb-6">
                    <h2 className="text-2xl font-bold border-l-4 border-brand-500 pl-3 text-white flex items-center">
                        <Star className="text-yellow-500 mr-2 w-6 h-6" />
                        Featured Tournaments
                    </h2>
                    <button onClick={() => navigate('/tournaments')} className="text-brand-400 text-sm hover:underline flex items-center">
                        View All <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {featuredTournaments.length > 0 ? (
                        featuredTournaments.map(t => <TournamentCard key={t.id} tournament={t} />)
                    ) : (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
                            No featured tournaments.
                        </div>
                    )}
                </div>
            </section>

            <section className="mt-16">
                <div className="flex justify-between items-end mb-6">
                    <h2 className="text-2xl font-bold border-l-4 border-brand-500 pl-3 text-white flex items-center">
                        <Gamepad2 className="text-brand-500 mr-2 w-6 h-6" />
                        Popular Games
                    </h2>
                    <button onClick={() => navigate('/games')} className="text-brand-400 text-sm hover:underline flex items-center">
                        View All <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {popularGames.length > 0 ? (
                        popularGames.map(g => <GameCard key={g.id} game={g} />)
                    ) : (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
                            No games listed yet.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Home;

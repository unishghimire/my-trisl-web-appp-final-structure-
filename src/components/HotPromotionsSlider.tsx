import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';

export interface PromoSlide {
    id: number;
    tournamentName: string;
    game: string;
    format: string;
    status: "UPCOMING" | "LIVE" | "COMPLETED";
    prizePool: string;
    startDate: string;
    image: string;
    link: string;
}

interface HotPromotionsSliderProps {
    slides: PromoSlide[];
}

const HotPromotionsSlider: React.FC<HotPromotionsSliderProps> = ({ slides }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const navigate = useNavigate();

    const minSwipeDistance = 50;

    const nextSlide = useCallback(() => {
        setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, [slides.length]);

    const prevSlide = useCallback(() => {
        setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    }, [slides.length]);

    const goToSlide = (index: number) => {
        setCurrentIndex(index);
    };

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (!isPaused && slides.length > 1 && !prefersReducedMotion) {
            timerRef.current = setInterval(() => {
                nextSlide();
            }, 4000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPaused, nextSlide, slides.length]);

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        setIsPaused(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) {
            setTimeout(() => setIsPaused(false), 6000);
            return;
        }
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            nextSlide();
        } else if (isRightSwipe) {
            prevSlide();
        }
        
        setTimeout(() => setIsPaused(false), 6000);
    };

    if (!slides || slides.length === 0) return null;

    return (
        <div 
            className="w-full mb-12"
            role="region" 
            aria-label="Promotional tournaments"
        >
            {/* Section Header */}
            <div className="flex justify-between items-center mb-4 px-2">
                <div className="flex items-center gap-3 border-l-4 border-brand-500 pl-3">
                    <Star className="text-brand-500 w-5 h-5 md:w-6 md:h-6 fill-brand-500" />
                    <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">
                        HOT PROMOTIONS
                    </h2>
                </div>
                
                {/* Dot Indicators (Header) */}
                <div className="flex items-center gap-2">
                    {slides.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => goToSlide(idx)}
                            aria-label={`Go to slide ${idx + 1}`}
                            className={`w-2 h-2 rounded-full transition-all ${
                                currentIndex === idx ? 'bg-brand-500 w-4' : 'bg-gray-600 hover:bg-gray-500'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Slider Container */}
            <div 
                className="relative w-full h-[320px] sm:h-[160px] md:h-[200px] rounded-[14px] overflow-hidden bg-[#12162a] border border-brand-500/30 shadow-[0_0_15px_rgba(124,58,237,0.15)] group"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Slides Track */}
                <div 
                    className="flex h-full transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {slides.map((slide) => (
                        <div key={slide.id} className="min-w-full h-full flex flex-col-reverse sm:flex-row">
                            
                            {/* Left Side (Content) */}
                            <div className="w-full sm:w-[60%] h-[60%] sm:h-full p-4 md:p-6 flex flex-col justify-between relative z-10 bg-[#12162a] sm:bg-transparent">
                                {/* Badges */}
                                <div className="flex justify-between items-start w-full">
                                    <div className="flex gap-2">
                                        <span className="bg-brand-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                            {slide.game}
                                        </span>
                                        <span className={`text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                                            slide.status === 'UPCOMING' ? 'bg-green-600' : 
                                            slide.status === 'LIVE' ? 'bg-red-600' : 'bg-gray-600'
                                        }`}>
                                            {slide.status}
                                        </span>
                                    </div>
                                    <span className="bg-[#0a0e1a] text-gray-300 text-[10px] font-bold px-2 py-1 rounded-full border border-gray-700 uppercase tracking-wider">
                                        {slide.format}
                                    </span>
                                </div>

                                {/* Title & Prize */}
                                <div className="mt-2 sm:mt-0">
                                    <h3 className="text-white text-lg md:text-[20px] font-bold uppercase leading-tight truncate">
                                        {slide.tournamentName}
                                    </h3>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">PRIZE POOL</span>
                                        <span className="text-yellow-500 text-sm font-black ml-1">{slide.prizePool}</span>
                                    </div>
                                </div>

                                {/* Bottom Row: Countdown & CTA */}
                                <div className="flex items-end justify-between mt-auto pt-2">
                                    {slide.status === 'UPCOMING' ? (
                                        <CountdownTimer targetDate={slide.startDate} />
                                    ) : (
                                        <div className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                                            {slide.status === 'LIVE' ? 'MATCHES IN PROGRESS' : 'TOURNAMENT ENDED'}
                                        </div>
                                    )}
                                    
                                    <button 
                                        onClick={() => navigate(slide.link)}
                                        aria-label={slide.status === 'COMPLETED' ? 'View Results' : 'Join Now'}
                                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                            slide.status === 'COMPLETED' 
                                            ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                                            : 'bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white shadow-lg shadow-brand-500/25'
                                        } sm:w-auto w-full sm:ml-4 text-center`}
                                    >
                                        {slide.status === 'COMPLETED' ? 'VIEW RESULTS' : 'JOIN NOW'}
                                    </button>
                                </div>
                            </div>

                            {/* Right Side (Image) */}
                            <div className="w-full sm:w-[40%] h-[40%] sm:h-full relative">
                                <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-[#12162a] via-[#12162a]/80 to-transparent z-10" />
                                {slide.image ? (
                                    <img 
                                        src={slide.image} 
                                        alt={slide.tournamentName}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-[linear-gradient(135deg,#1a0533,#0d1225)]" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Navigation Arrows (Desktop Only) */}
                <button 
                    onClick={prevSlide}
                    aria-label="Previous slide"
                    className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-[#0a0e1a]/60 hover:bg-brand-600 text-white transition-colors z-20 opacity-0 group-hover:opacity-100"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                    onClick={nextSlide}
                    aria-label="Next slide"
                    className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-[#0a0e1a]/60 hover:bg-brand-600 text-white transition-colors z-20 opacity-0 group-hover:opacity-100"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>

                {/* Bottom Dot Indicators */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 sm:hidden">
                    {slides.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => goToSlide(idx)}
                            aria-label={`Go to slide ${idx + 1}`}
                            className={`w-2 h-2 rounded-full transition-all ${
                                currentIndex === idx ? 'bg-brand-500 w-4' : 'bg-white/30 hover:bg-white/50'
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

const CountdownTimer: React.FC<{ targetDate: string }> = ({ targetDate }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
    const [isStarted, setIsStarted] = useState(false);

    useEffect(() => {
        const target = new Date(targetDate).getTime();

        const updateTimer = () => {
            const now = new Date().getTime();
            const difference = target - now;

            if (difference <= 0) {
                setIsStarted(true);
                return;
            }

            setTimeLeft({
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                mins: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
                secs: Math.floor((difference % (1000 * 60)) / 1000)
            });
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    if (isStarted) {
        return <div className="text-brand-400 text-xs font-bold uppercase tracking-widest">STARTED</div>;
    }

    const timeBlocks = [
        { label: 'Days', value: timeLeft.days },
        { label: 'Hours', value: timeLeft.hours },
        { label: 'Mins', value: timeLeft.mins },
        { label: 'Secs', value: timeLeft.secs }
    ];

    return (
        <div className="flex gap-1.5">
            {timeBlocks.map((block, idx) => (
                <div key={idx} className="flex flex-col items-center">
                    <div className="bg-[#0a0e1a] border border-brand-500/30 rounded w-7 h-7 flex items-center justify-center text-white text-xs font-bold">
                        {block.value.toString().padStart(2, '0')}
                    </div>
                    <span className="text-[#8892b0] text-[8px] uppercase mt-0.5 font-medium">{block.label}</span>
                </div>
            ))}
        </div>
    );
};

export default HotPromotionsSlider;

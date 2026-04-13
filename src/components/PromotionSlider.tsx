import React, { useState, useEffect, useRef } from 'react';
import { Slide } from '../types';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface PromotionSliderProps {
    slides: Slide[];
}

const PromotionSlider: React.FC<PromotionSliderProps> = ({ slides }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const navigate = useNavigate();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            if (!isPaused) {
                setCurrentIndex((prev) => (prev + 1) % slides.length);
            }
        }, 5000);
    };

    useEffect(() => {
        if (slides.length === 0) return;
        startTimer();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [slides, isPaused]);

    if (slides.length === 0) return null;

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
        startTimer();
    };
    
    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
        startTimer();
    };

    const goToSlide = (index: number) => {
        setCurrentIndex(index);
        startTimer();
    };

    const slide = slides[currentIndex];

    return (
        <div 
            className="relative w-full h-[350px] md:h-[500px] rounded-3xl overflow-hidden bg-gray-900 border border-gray-800 shadow-2xl group"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={slide.id}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute inset-0"
                >
                    <img 
                        src={slide.imageUrl || 'https://picsum.photos/seed/promo/1920/1080'} 
                        alt={slide.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    
                    <div className="absolute bottom-0 left-0 p-6 md:p-12 w-full md:w-3/4 space-y-3 md:space-y-4">
                        <motion.h2 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-3xl md:text-6xl font-black text-white tracking-tight leading-tight"
                        >
                            {slide.title}
                        </motion.h2>
                        {slide.description && (
                            <motion.p 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-gray-300 text-sm md:text-lg max-w-2xl line-clamp-2 md:line-clamp-none font-medium"
                            >
                                {slide.description}
                            </motion.p>
                        )}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-center gap-4 pt-2 md:pt-4"
                        >
                            <button 
                                onClick={() => navigate(slide.link)}
                                className="bg-brand-600 hover:bg-brand-500 text-white px-6 md:px-10 py-3 md:py-4 rounded-xl font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-brand-600/20 flex items-center gap-2 text-xs md:text-sm"
                            >
                                {slide.buttonText} <ExternalLink className="w-4 h-4" />
                            </button>
                        </motion.div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            {slides.length > 1 && (
                <>
                    <button 
                        onClick={prevSlide} 
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-black/40 hover:bg-brand-600 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/10"
                    >
                        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                    <button 
                        onClick={nextSlide} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-black/40 hover:bg-brand-600 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/10"
                    >
                        <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </>
            )}

            {/* Dot Indicators */}
            {slides.length > 1 && (
                <div className="absolute bottom-6 right-6 md:right-12 flex items-center gap-2">
                    {slides.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => goToSlide(idx)}
                            className={`h-1.5 transition-all duration-300 rounded-full ${idx === currentIndex ? 'w-8 bg-brand-500' : 'w-2 bg-white/30 hover:bg-white/50'}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default PromotionSlider;

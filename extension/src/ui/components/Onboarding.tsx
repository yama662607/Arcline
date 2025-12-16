import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

interface OnboardingProps {
  onFinish: () => void;
}

const slides = [
  {
    title: 'Welcome to Arcline',
    description: 'Your browser, redefined. Experience a cleaner, more organized web.',
    icon: '✨',
  },
  {
    title: 'Spaces & Tabs',
    description: 'Organize your tabs into focused Spaces. Keep work and play separate.',
    icon: '🗂️',
  },
  {
    title: 'Auto Archive',
    description: 'Let go of the clutter. Old tabs are automatically archived to keep you focused.',
    icon: '🧹',
  },
  {
    title: 'Ready to Go?',
    description: 'Jump in and start browsing.',
    icon: '🚀',
  },
];

export function Onboarding({ onFinish }: OnboardingProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onFinish();
    }
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-6 text-foreground">
      <div className="relative w-full max-w-sm overflow-hidden text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-surface-hover text-5xl shadow-xl">
              {slides[currentIndex]?.icon}
            </div>
            <h2 className="mb-3 text-2xl font-bold text-white">{slides[currentIndex]?.title}</h2>
            <p className="mb-8 text-sm text-slate-400">{slides[currentIndex]?.description}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex w-full flex-col gap-4">
          <button
            type="button"
            onClick={nextSlide}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 active:scale-95"
          >
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </button>

          <div className="flex justify-center gap-2">
            {slides.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

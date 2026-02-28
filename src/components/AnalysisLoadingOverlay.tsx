'use client';

import { useEffect, useState } from 'react';

const MESSAGES = [
  { text: 'Reading the fine print so you don\'t have to...', icon: '📋' },
  { text: 'Comparing apples to slightly different apples...', icon: '🍎' },
  { text: 'Translating vendor-speak into plain English...', icon: '🔤' },
  { text: 'Hunting for hidden fees like a truffle pig...', icon: '🔍' },
  { text: 'Standardizing pricing across vendors... fun stuff.', icon: '📊' },
  { text: 'Making sure nobody\'s "unlimited" has a limit...', icon: '♾️' },
  { text: 'Cross-referencing implementation timelines...', icon: '📅' },
  { text: 'Decoding acronyms even vendors forgot about...', icon: '🧩' },
  { text: 'Flagging the asterisks behind the asterisks...', icon: '⚠️' },
  { text: 'Almost there — just dotting the i\'s and crossing the t\'s...', icon: '✍️' },
  { text: 'Crunching numbers that would make a spreadsheet blush...', icon: '🔢' },
  { text: 'Giving each proposal a fair, unbiased reading...', icon: '⚖️' },
];

export default function AnalysisLoadingOverlay() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(true);

  // Rotate messages every 5s with a fade transition
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
        setFade(true);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Animate progress bar (slow asymptotic crawl — never quite hits 100%)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 30) return prev + 0.8;
        if (prev < 60) return prev + 0.4;
        if (prev < 80) return prev + 0.15;
        if (prev < 92) return prev + 0.05;
        return prev;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const current = MESSAGES[messageIndex];

  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4 text-center">
        {/* Animated logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-outsail-blue-dark/10 mb-4">
            <svg className="w-8 h-8 text-outsail-blue-dark animate-spin" style={{ animationDuration: '3s' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Analyzing Proposals</h2>
          <p className="text-sm text-slate-500">
            This usually takes 30–60 seconds
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 mb-8 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-outsail-blue to-outsail-blue-dark rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Rotating message */}
        <div
          className="h-12 flex items-center justify-center transition-opacity duration-300"
          style={{ opacity: fade ? 1 : 0 }}
        >
          <p className="text-sm text-slate-600">
            <span className="mr-2">{current.icon}</span>
            {current.text}
          </p>
        </div>
      </div>
    </div>
  );
}

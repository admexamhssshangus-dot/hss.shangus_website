import React, { useEffect, useState } from 'react';
import ModernLoader from './ModernLoader';

/**
 * TabLoadingOverlay — Standardized institutional loading overlay for Suspense & Tab transitions
 */
export default function TabLoadingOverlay({ moduleKey = 'default', message = '' }) {
  const [progress, setProgress] = useState(25);

  useEffect(() => {
    // Smooth progress simulation for tab transitions
    const timer1 = setTimeout(() => setProgress(55), 80);
    const timer2 = setTimeout(() => setProgress(85), 220);
    const timer3 = setTimeout(() => setProgress(98), 450);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <ModernLoader
      moduleKey={moduleKey}
      subtext={message || undefined}
      progress={progress}
      className="min-h-[50vh]"
    />
  );
}

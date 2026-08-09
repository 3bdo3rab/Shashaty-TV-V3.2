import React, { useState, useEffect } from 'react';
import { Tv } from 'lucide-react';
import { toggleMaximizeWindow } from '../utils/tauri';

interface TitleBarProps {
  appName?: string;
}

export const TauriTitleBar: React.FC<TitleBarProps> = ({ appName = 'شاشتي TV' }) => {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleMaximizeWindow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Invisible top hover zone */}
      <div className="h-3 w-full pointer-events-auto cursor-pointer" />

      {/* Auto-hiding Title Bar */}
      <header 
        data-tauri-drag-region
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        className={`h-10 bg-zinc-950/95 border-b border-amber-400/20 backdrop-blur-xl flex items-center justify-center px-4 select-none shrink-0 w-full dir-rtl shadow-2xl transition-all duration-300 ease-in-out transform pointer-events-auto ${
          isHovered ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        {/* Centered App Logo and Name */}
        <div 
          className="flex items-center gap-2.5 mx-auto" 
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-400 to-rose-500 flex items-center justify-center text-black font-black text-xs shadow-md">
            <Tv className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs sm:text-sm font-extrabold tracking-wide text-white drop-shadow">
            {appName}
          </span>
        </div>
      </header>
    </div>
  );
};


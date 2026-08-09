import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getEpisodeInspiredCover } from '../utils/coverHelper';
import { isTauri } from '../utils/tauri';
import { Play } from 'lucide-react';

// Shared cache to prevent re-fetching the same thumbnail across re-renders
const thumbnailCache = new Map<string, string>();

interface EpisodeThumbnailProps {
  file: any;
  title: string;
  watchlistTitle: string;
  isActive: boolean;
}

export const EpisodeThumbnail: React.FC<EpisodeThumbnailProps> = ({ file, title, watchlistTitle, isActive }) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const fetchThumbnail = async () => {
      // 1. Use already provided cover image if available
      const providedCover = file.coverImage || file.thumbnail || file.poster;
      if (providedCover) {
        if (mountedRef.current) {
          setImgSrc(providedCover);
          setIsLoaded(true);
        }
        return;
      }

      const filePath = file.path || file.absolutePath;
      
      // 2. Check cache
      if (filePath && thumbnailCache.has(filePath)) {
        if (mountedRef.current) {
          setImgSrc(thumbnailCache.get(filePath)!);
          setIsLoaded(true);
        }
        return;
      }

      // 3. Extract thumbnail via Tauri Windows shell API
      if (filePath && isTauri()) {
        try {
          const tauriThumb = await invoke<string>('get_video_thumbnail', { 
            path: filePath, 
            width: 160, 
            height: 90 
          });
          
          if (tauriThumb && mountedRef.current) {
            thumbnailCache.set(filePath, tauriThumb);
            setImgSrc(tauriThumb);
            setIsLoaded(true);
            return;
          }
        } catch (e) {
          console.warn('Failed to extract native thumbnail for:', filePath, e);
        }
      }

      // 4. Fallback to generic thematic cover
      if (mountedRef.current) {
        const fallback = getEpisodeInspiredCover(title, watchlistTitle, [file], file.mode || file.targetMode);
        setImgSrc(fallback);
        setIsLoaded(true);
      }
    };

    fetchThumbnail();

    return () => {
      mountedRef.current = false;
    };
  }, [file, title, watchlistTitle]);

  return (
    <div className={`relative w-24 h-16 sm:w-28 sm:h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-800 border ${isActive ? 'border-amber-400' : 'border-white/10'}`}>
      {!isLoaded ? (
        <div className="w-full h-full flex items-center justify-center animate-pulse bg-zinc-800">
          <div className="w-6 h-6 rounded-full bg-zinc-700"></div>
        </div>
      ) : (
        <>
          <img 
            src={imgSrc} 
            alt={title} 
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            onError={(e) => {
              (e.target as HTMLImageElement).src = getEpisodeInspiredCover(title, watchlistTitle, [file]);
            }}
          />
          {/* Active Overlay & Icon */}
          <div className={`absolute inset-0 flex items-center justify-center transition-colors ${isActive ? 'bg-amber-500/20' : 'bg-black/20 group-hover:bg-black/40'}`}>
            {isActive ? (
              <Play className="w-6 h-6 text-amber-400 drop-shadow-md fill-amber-400" />
            ) : (
              <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-opacity" />
            )}
          </div>
          {/* Duration Badge if available */}
          {file.duration && (
            <div className="absolute bottom-1 right-1 bg-black/80 px-1 rounded text-[10px] font-mono text-white">
              {file.duration}
            </div>
          )}
        </>
      )}
    </div>
  );
};

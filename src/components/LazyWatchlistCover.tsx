import React, { useEffect, useState, useRef } from 'react';
import { Watchlist } from '../types';
import { extractVideoFrameThumbnail, getWatchlistCover } from '../utils/coverHelper';

interface LazyWatchlistCoverProps {
  watchlist: Watchlist;
  className?: string;
  imgClassName?: string;
  onCoverGenerated?: (id: string, newCover: string) => void;
  children?: React.ReactNode;
}

export const LazyWatchlistCover: React.FC<LazyWatchlistCoverProps> = ({ 
  watchlist, 
  className = '', 
  imgClassName = 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-105',
  onCoverGenerated,
  children
}) => {
  const [cover, setCover] = useState<string>(getWatchlistCover(watchlist));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (watchlist.coverImage) {
       setCover(watchlist.coverImage);
       return;
    }

    let observer: IntersectionObserver;
    if (containerRef.current) {
      observer = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting) {
           observer.disconnect(); 
           
           const allFiles = [...(watchlist.files || []), ...(watchlist.seasons?.flatMap((s: any) => s.files || []) || [])];
           const firstFile = allFiles.find(f => f instanceof File || (f && ((f as any).rawFile instanceof File || (f as any).blobUrl || (f as any).absolutePath)));
           if (firstFile) {
             try {
               const thumb = await extractVideoFrameThumbnail(firstFile);
               if (thumb) {
                 setCover(thumb);
                 if (onCoverGenerated) onCoverGenerated(watchlist.id, thumb);
               }
             } catch (e) {
               console.warn('Lazy thumbnail extraction failed:', e);
             }
           }
        }
      }, { rootMargin: '300px' }); 
      observer.observe(containerRef.current);
    }
    
    return () => observer?.disconnect();
  }, [watchlist, onCoverGenerated]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-black shrink-0 ${className}`}>
      <img src={cover} alt={watchlist.title} className={imgClassName} />
      {children}
    </div>
  );
};

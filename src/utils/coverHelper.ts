import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

export const THEMATIC_IMAGES = {
  kids: [
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&q=80&w=800', // Magical Cartoon
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=800', // Underwater World
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80&w=800', // Anime Art
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800', // Magical Forest
  ],
  music: [
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=800', // Studio Audio Wave
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800', // Music Stage
    'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&q=80&w=800', // Piano Melody
  ],
  cinema: [
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=800', // Cinema Theater
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=800', // Film Reel
    'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&q=80&w=800', // Movie Screen
  ],
  series: [
    'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=800', // Cinema Projector
    'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&q=80&w=800', // TV Broadcast
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&q=80&w=800', // Film Roll
  ],
  docs: [
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=800', // Mountains & Nature
    'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&q=80&w=800', // Wild Animals
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&q=80&w=800', // Earth Space
  ],
  quran: [
    'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&q=80&w=800', // Holy Quran Book
    'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&q=80&w=800', // Islamic Lantern
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&q=80&w=800', // Mosque Architecture
    'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&q=80&w=800', // Quran & Tasbih
  ],
  general: [
    'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&q=80&w=800',
  ]
};

function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652]/g, '');
}

function pickFromList(list: string[], seedText: string): string {
  let hash = 0;
  for (let i = 0; i < seedText.length; i++) {
    hash = (hash << 5) - hash + seedText.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % list.length;
  return list[index];
}

/**
 * Generate a video card poster SVG data URL derived directly from video file details
 */
export function generateVideoCardPoster(title: string, fileName?: string): string {
  const cleanTitle = (fileName || title || 'فيديو').replace(/\.[^/.]+$/, "");
  const displayTitle = cleanTitle.length > 32 ? cleanTitle.substring(0, 30) + '...' : cleanTitle;
  const ext = (fileName || title || '').split('.').pop()?.toUpperCase() || 'MP4';
  const displayExt = ['MP4', 'MKV', 'WEBM', 'AVI', 'MOV', 'TS', 'M4V', 'FLV', 'WMV'].includes(ext) ? ext : 'VIDEO';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="50%" stop-color="#1e1b4b"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#d97706" stop-opacity="0.2"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#bg)"/>
    <rect x="0" y="0" width="640" height="12" fill="#020617"/>
    <rect x="0" y="348" width="640" height="12" fill="#020617"/>
    <!-- Simulated Film Strip Holes -->
    <rect x="20" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="60" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="100" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="140" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="180" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="220" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="260" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="300" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="340" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="380" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="420" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="460" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="500" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="540" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="580" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    <rect x="620" y="3" width="12" height="6" rx="1.5" fill="#475569"/>
    
    <!-- Video Preview Card Frame -->
    <rect x="18" y="24" width="604" height="312" rx="16" fill="none" stroke="rgba(245, 158, 11, 0.4)" stroke-width="2"/>
    
    <!-- Central Play Icon -->
    <circle cx="320" cy="145" r="44" fill="rgba(15, 23, 42, 0.9)" stroke="#f59e0b" stroke-width="3"/>
    <polygon points="312,127 340,145 312,163" fill="#f59e0b"/>
    
    <!-- Video Format Badge -->
    <rect x="32" y="38" width="64" height="24" rx="6" fill="#f59e0b"/>
    <text x="64" y="55" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="900" fill="#000000" text-anchor="middle">${displayExt}</text>

    <!-- Title & Windows Thumbnail Tag -->
    <text x="320" y="235" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">${displayTitle}</text>
    <text x="320" y="270" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#fbbf24" text-anchor="middle">معاينة فيديو ويندوز 🎬</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Get an episode-inspired cover image for a watchlist strictly based on its videos, titles, or files.
 */
export function getEpisodeInspiredCover(title: string = '', section: string = '', files: any = [], targetMode?: string): string {
  const fileArray = Array.isArray(files) ? files : (files ? [files] : []);

  // 1. If a video file in the list already has an extracted frame or image, use it directly
  if (fileArray.length > 0) {
    const fileWithImage = fileArray.find(f => f && (f.coverImage || f.thumbnail || f.poster));
    if (fileWithImage) {
      return fileWithImage.coverImage || fileWithImage.thumbnail || fileWithImage.poster;
    }
    const firstFile = fileArray[0];
    const firstFileName = typeof firstFile === 'string' ? firstFile : (firstFile?.name || firstFile?.title || '');
    if (firstFileName) {
      return generateVideoCardPoster(title, firstFileName);
    }
  }

  // 2. Derive image strictly from video file names and episode titles in the playlist
  const videoNames = fileArray.map(f => (typeof f === 'string' ? f : (f?.name || f?.title || ''))).join(' ');
  const rawText = videoNames + ' ' + title + ' ' + section + ' ' + (targetMode || '');
  const normText = normalizeText(rawText);

  // Quran / Religious
  if (/قران|تلاوه|سوره|مصحب|اذكار|تفسير|حديث|اسلام|مساجد|مكه/.test(normText) || targetMode === 'quran') {
    return pickFromList(THEMATIC_IMAGES.quran, normText);
  }

  // Kids / Children / Cartoon / Anashid
  if (/اطفال|طفل|براعم|طيور|كرتون|انيميشن|انمي|سبونج|توم|جيري|ماشا|ديزني|حكايات|قصص اطفال|ماريو/.test(normText) || targetMode === 'kids') {
    if (/اناشيد|اغاني|نشيد|صوتيات/.test(normText)) {
      return THEMATIC_IMAGES.kids[0];
    }
    return pickFromList(THEMATIC_IMAGES.kids, normText);
  }

  // Music / Anashid / Songs / Audio
  if (/اناشيد|نشيد|اغاني|موسيقى|طرب|صوتيات|الحان|شيلات|معزوفه|حفله|بيانو/.test(normText) || targetMode === 'music') {
    return pickFromList(THEMATIC_IMAGES.music, normText);
  }

  // Documentaries / Science / Nature
  if (/وثايقي|طبيعه|حيوان|فضاء|علم|تاريخ|حضاره|عالم|غابه/.test(normText) || targetMode === 'docs') {
    return pickFromList(THEMATIC_IMAGES.docs, normText);
  }

  // Cinema / Movies
  if (/فيلم|افلام|سينما|هوليود|اكشن|اثاره|رعب|غموض/.test(normText) || targetMode === 'cinema') {
    return pickFromList(THEMATIC_IMAGES.cinema, normText);
  }

  // Series / Drama / Shows
  if (/مسلسل|مسلسلات|دراما|عربي|عربيه|مصريه|سوريه|تركي|رمضان|موسم|حلقات/.test(normText) || targetMode === 'family') {
    return pickFromList(THEMATIC_IMAGES.series, normText);
  }

  return pickFromList(THEMATIC_IMAGES.series, normText);
}

/**
 * Gets the cover image for a watchlist object.
 * Returns the watchlist's coverImage if available, or selects an arbitrary video frame/cover from playlist files.
 */
export function getWatchlistCover(list: { title?: string; section?: string; coverImage?: string; files?: any[]; seasons?: any[]; targetMode?: string }): string {
  if (!list) return '';
  
  if (list.coverImage && list.coverImage.trim()) {
    return list.coverImage;
  }

  const allFiles = [...(list.files || []), ...(list.seasons?.flatMap(s => s.files || []) || [])];
  
  const fileWithCover = allFiles.find(f => f && (f.coverImage || f.thumbnail || f.poster));
  if (fileWithCover) {
    const frame = fileWithCover.coverImage || fileWithCover.thumbnail || fileWithCover.poster;
    if (frame) return frame;
  }

  return getEpisodeInspiredCover(list.title || 'قائمة التشغيل', list.section || 'عام', allFiles, list.targetMode);
}

/**
 * Level 1: Extract a real video frame thumbnail from an absolute path using HTML5 Video & Canvas
 */
export async function extractVideoFrameThumbnail(fileInput: any): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      if (!fileInput) {
        reject('No file input');
        return;
      }

      if (fileInput.coverImage && (fileInput.coverImage.startsWith('data:') || fileInput.coverImage.startsWith('blob:'))) {
        resolve(fileInput.coverImage);
        return;
      }

      let assetUrl = '';
      
      if (fileInput instanceof File) {
        assetUrl = URL.createObjectURL(fileInput);
      } else {
        let absPath = '';
        if (typeof fileInput === 'string' && fileInput.length > 0) {
          absPath = fileInput;
        } else if (fileInput.absolutePath) {
          absPath = fileInput.absolutePath;
        } else if (fileInput.path) {
          absPath = fileInput.path;
        }

        if (!absPath) {
          reject('No valid path or file object');
          return;
        }
        assetUrl = convertFileSrc(absPath);
      }

      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.autoplay = false;
      
      video.src = assetUrl;

      let hasResolved = false;

      const finish = (result: string, isError: boolean = false) => {
        if (hasResolved) return;
        hasResolved = true;
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        video.src = '';
        if (fileInput instanceof File && assetUrl.startsWith('blob:')) {
          URL.revokeObjectURL(assetUrl);
        }
        if (isError) reject(result);
        else resolve(result);
      };

      video.onloadeddata = () => {
        // Seek to 3rd second (or middle if shorter)
        if (video.duration > 3) {
          video.currentTime = 3;
        } else if (video.duration > 0) {
          video.currentTime = video.duration / 2;
        } else {
          video.currentTime = 0;
        }
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            finish(dataUrl);
          } else {
            finish('Canvas context failed', true);
          }
        } catch (e) {
          finish('Draw image failed', true);
        }
      };

      video.onerror = () => {
        finish('Video load error', true);
      };

      // Timeout safety (5 seconds)
      setTimeout(() => {
        if (!hasResolved) finish('Timeout', true);
      }, 5000);

      video.load();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 3-Level Thumbnail Strategy:
 * Level 1: HTML5 Video & Canvas (extractVideoFrameThumbnail)
 * Level 2: Thematic Keyword Matching (getEpisodeInspiredCover)
 * Level 3: SVG Poster Generation (generateVideoCardPoster)
 */
export async function extractFirstValidThumbnail(filesInput: any[]): Promise<string> {
  if (!filesInput || filesInput.length === 0) return '';
  
  const validFiles = filesInput.filter(f => !!f);
  if (validFiles.length === 0) return '';
  
  // Return early if we already have a cached/blob image on one of them
  const fileWithImage = validFiles.find(f => f.coverImage && (f.coverImage.startsWith('data:') || f.coverImage.startsWith('blob:')));
  if (fileWithImage) {
    return fileWithImage.coverImage;
  }

  const filesToTry = validFiles.slice(0, 3);
  
  // Level 1: Try ultra-fast native OS thumbnail extraction via Rust backend
  try {
    const pathsToTry = filesToTry.map(f => f.path || f.absolutePath).filter(Boolean);
    if (pathsToTry.length > 0) {
      const dataUrl = await invoke<string>('get_first_valid_thumbnail', { 
        paths: pathsToTry, 
        width: 640, 
        height: 360 
      });
      if (dataUrl && dataUrl.startsWith('data:')) {
        return dataUrl;
      }
    }
  } catch (backendErr) {
    console.warn('Backend thumbnail extraction failed, falling back to HTML5 canvas:', backendErr);
  }

  // Level 2: Try HTML5 Extraction on up to the first 3 files sequentially
  for (const f of filesToTry) {
    try {
      const dataUrl = await extractVideoFrameThumbnail(f);
      if (dataUrl && dataUrl.startsWith('data:')) {
        return dataUrl;
      }
    } catch (e) {
      // Failed for this file (e.g. MKV not supported in browser), try next
    }
  }

  const titleForFallback = validFiles[0]?.name || validFiles[0]?.title || 'فيديو';

  // Level 2: Thematic Keyword Matching
  const thematicCover = getEpisodeInspiredCover(titleForFallback, '', validFiles);
  // We need to check if the returned thematic cover is just another generic SVG or an actual image URL.
  // getEpisodeInspiredCover returns an Unsplash URL if matched, otherwise it falls back to a default.
  // Wait, getEpisodeInspiredCover returns an Unsplash URL directly. Let's just use it.
  if (thematicCover && thematicCover.startsWith('http')) {
      return thematicCover;
  }

  // Level 3: SVG Poster
  return generateVideoCardPoster(titleForFallback);
}

import { invoke } from '@tauri-apps/api/core';
import { Watchlist, VideoFile } from '../types';
import { extractFirstValidThumbnail } from './coverHelper';
import { sortSmartMediaFiles, naturalCompare } from './sorter';

export const isCrossOriginIframe = () => false;

export async function getFilesFromDirectoryHandle(dirPath: string, rootFolderName: string): Promise<any[]> {
  try {
    const scannedFiles: any[] = await invoke('scan_media_directory', { path: dirPath });
    return scannedFiles.map(f => {
      let relPath = f.path.replace(dirPath, '');
      if (relPath.startsWith('/') || relPath.startsWith('\\')) relPath = relPath.substring(1);
      return {
        name: f.name,
        size: f.size,
        type: f.file_type,
        absolutePath: f.path,
        customPath: `${rootFolderName}/${relPath.replace(/\\/g, '/')}`,
        title: f.name.replace(/\.[^/.]+$/, "")
      };
    });
  } catch (err) {
    console.error('getFilesFromDirectoryHandle error:', err);
    return [];
  }
}
export async function processMediaDirectory(
  dirPath: string, 
  existingWatchlists: Watchlist[] = [],
  onProgress?: (current: number, total: number, statusText: string) => void
): Promise<Watchlist[]> {
  try {
    if (onProgress) onProgress(0, 100, 'جاري فحص مسارات الملفات من القرص...');
    console.log(`processMediaDirectory called with dirPath: ${dirPath}`);
    // Call our Rust command to recursively scan the directory
    const scannedFiles: any[] = await invoke('scan_media_directory', { path: dirPath });
    console.log(`processMediaDirectory received ${scannedFiles.length} files from Rust.`);
    
    if (scannedFiles.length === 0) return [];

    if (onProgress) onProgress(10, 100, `تم العثور على ${scannedFiles.length} ملف، جاري المعالجة...`);

    // Group files into logical series and seasons by parsing their paths
    const groups = new Map<string, { files: VideoFile[], seasons: Map<string, VideoFile[]> }>();
    
    // Default group for files at the root of the selected directory
    const rootGroupName = dirPath.split(/[/\\]/).pop() || 'مجلد جديد';
    
    // Helper to determine if a folder name is likely a season
    const isSeasonFolder = (name: string) => /season|موسم|جزء|s\d+|arc|book|volume|chapter|قسم|فصل|مجلد/i.test(name);

    scannedFiles.forEach(f => {
      // Find the relative path inside dirPath
      let relPath = f.path.replace(dirPath, '');
      if (relPath.startsWith('/') || relPath.startsWith('\\')) {
        relPath = relPath.substring(1);
      }
      
      const parts = relPath.split(/[/\\]/);
      let seriesName = rootGroupName;
      let seasonName = '';

      if (parts.length === 1) {
        // file is in root directory
        seriesName = rootGroupName;
      } else {
        // Find if any part is a season folder
        let seasonIdx = -1;
        for (let i = 0; i < parts.length - 1; i++) { // exclude the file name itself
          if (isSeasonFolder(parts[i])) {
            seasonIdx = i;
            break;
          }
        }

        if (seasonIdx === 0) {
          // e.g. dirPath/Season 1/Ep1.mp4
          seriesName = rootGroupName;
          seasonName = parts[0];
        } else if (seasonIdx > 0) {
          // e.g. dirPath/Breaking Bad/Season 1/Ep1.mp4 -> Series: Breaking Bad, Season: Season 1
          seriesName = parts[seasonIdx - 1];
          seasonName = parts[seasonIdx];
        } else {
          // No season folder found. Group by the top-level subfolder inside dirPath.
          // e.g. dirPath/Anime/Naruto/Ep1.mp4 -> Series: Anime (or Naruto depending on structure, parts[0] is the safest for root-level grouping).
          seriesName = parts[0];
        }
      }
      
      const vf: VideoFile = {
        name: f.name,
        size: f.size,
        type: f.file_type,
        absolutePath: f.path,
        title: f.name.replace(/\.[^/.]+$/, "") // remove extension
      };

      if (!groups.has(seriesName)) {
        groups.set(seriesName, { files: [], seasons: new Map() });
      }
      
      if (seasonName) {
        const series = groups.get(seriesName)!;
        if (!series.seasons.has(seasonName)) {
          series.seasons.set(seasonName, []);
        }
        series.seasons.get(seasonName)!.push(vf);
      } else {
        groups.get(seriesName)!.files.push(vf);
      }
    });

    const watchlists: Watchlist[] = [];
    
    let processedGroups = 0;
    const totalGroups = groups.size;

    for (const [seriesTitle, groupData] of groups.entries()) {
      if (onProgress) {
        // Base progress is 20%, remaining 80% is divided by total groups
        const percent = 20 + Math.floor((processedGroups / totalGroups) * 80);
        onProgress(percent, 100, `جاري استيراد وتجهيز: ${seriesTitle} (${processedGroups + 1} من ${totalGroups})`);
      }
      processedGroups++;

      const allFiles = [
        ...groupData.files, 
        ...Array.from(groupData.seasons.values()).flat()
      ];
      if (allFiles.length === 0) continue;
      
      const sortedFiles = sortSmartMediaFiles(groupData.files);
      
      // format seasons
      const seasonsArray = Array.from(groupData.seasons.entries()).map(([sName, sFiles]) => ({
        name: sName,
        files: sortSmartMediaFiles(sFiles)
      }));
      // sort seasons by name
      seasonsArray.sort((a, b) => naturalCompare(a.name, b.name));

      // Check for duplicate in existing watchlists (same folder path and group title)
      const existing = existingWatchlists.find(w => 
        w.folderPath === dirPath && w.title === seriesTitle
      );

      if (existing) {
        // Merge files
        const fileMap = new Map();
        (existing.files || []).forEach(f => fileMap.set((f as any).absolutePath || f.name, f));
        sortedFiles.forEach(f => fileMap.set((f as any).absolutePath || f.name, f));
        const mergedFiles = sortSmartMediaFiles(Array.from(fileMap.values()));
        
        // Merge seasons
        const existingSeasonsMap = new Map((existing.seasons || []).map(s => [s.name, s]));
        for (const newSeason of seasonsArray) {
           if (existingSeasonsMap.has(newSeason.name)) {
               const exSeason = existingSeasonsMap.get(newSeason.name)!;
               const sfMap = new Map();
               exSeason.files.forEach(f => sfMap.set((f as any).absolutePath || f.name, f));
               newSeason.files.forEach(f => sfMap.set((f as any).absolutePath || f.name, f));
               exSeason.files = sortSmartMediaFiles(Array.from(sfMap.values()));
           } else {
               existingSeasonsMap.set(newSeason.name, newSeason);
           }
        }
        const mergedSeasons = Array.from(existingSeasonsMap.values());
        mergedSeasons.sort((a, b) => naturalCompare(a.name, b.name));

        const totalEps = mergedFiles.length + mergedSeasons.reduce((acc, s) => acc + s.files.length, 0);

        watchlists.push({
          ...existing,
          files: mergedFiles,
          seasons: mergedSeasons,
          episodesCount: totalEps,
        });
      } else {
        // Extract cover image iteratively using 3-level strategy
        let coverImage = '';
        try {
          coverImage = await extractFirstValidThumbnail(allFiles);
        } catch (e) {
          console.warn('Could not extract cover for', seriesTitle, e);
        }
        
        const totalEps = sortedFiles.length + seasonsArray.reduce((acc, s) => acc + s.files.length, 0);
        
        watchlists.push({
          id: crypto.randomUUID(),
          title: seriesTitle,
          section: rootGroupName,
          coverImage,
          seriesCount: seasonsArray.length > 0 ? seasonsArray.length : 1,
          episodesCount: totalEps,
          lastWatched: new Date().toISOString(),
          progress: 0,
          timeRemaining: '',
          folderPath: dirPath,
          folderName: rootGroupName,
          files: sortedFiles,
          seasons: seasonsArray.length > 0 ? seasonsArray : undefined
        });
      }
    }

    // Sort watchlists naturally by title
    watchlists.sort((a, b) => naturalCompare(a.title, b.title));

    if (onProgress) onProgress(100, 100, 'تم الاستيراد بنجاح! جاري عرض القوائم...');
    return watchlists;
  } catch (err) {
    console.error('Failed to scan directory:', err);
    throw err;
  }
}

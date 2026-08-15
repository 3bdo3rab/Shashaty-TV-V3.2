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
    if (onProgress) onProgress(0, 100, 'جاري قراءة المجلدات والملفات من النظام...');
    const scannedFiles: any[] = await invoke('scan_media_directory', { path: dirPath });
    
    if (scannedFiles.length === 0) return [];

    if (onProgress) onProgress(10, 100, `تم العثور على ${scannedFiles.length} ملف، جاري تنظيمها...`);

    const rootGroupName = dirPath.split(/[\/\\]/).pop() || 'مجلد جديد';
    
    // rootFiles will become single-file watchlists
    const rootFiles: VideoFile[] = [];
    
    // seriesMap stores files by SeriesName -> SeasonName -> VideoFile[]
    const seriesMap = new Map<string, Map<string, VideoFile[]>>();

    scannedFiles.forEach(f => {
      let relPath = f.path.replace(dirPath, '');
      if (relPath.startsWith('/') || relPath.startsWith('\\')) {
        relPath = relPath.substring(1);
      }
      
      const parts = relPath.split(/[\/\\]/);
      
      const vf: VideoFile = {
        name: f.name,
        size: f.size,
        type: f.file_type,
        absolutePath: f.path,
        title: f.name.replace(/\.[^/.]+$/, "")
      };

      if (parts.length === 1) {
        // Direct file in the root folder -> Single item
        rootFiles.push(vf);
      } else {
        // Subfolder -> Series
        const seriesName = parts[0];
        if (!seriesMap.has(seriesName)) {
          seriesMap.set(seriesName, new Map());
        }
        
        const seasons = seriesMap.get(seriesName)!;
        
        if (parts.length === 2) {
          // Direct file inside series folder -> "الملفات المباشرة"
          const seasonName = "الملفات المباشرة";
          if (!seasons.has(seasonName)) seasons.set(seasonName, []);
          seasons.get(seasonName)!.push(vf);
        } else {
          // File inside season folder
          const seasonName = parts[1];
          if (!seasons.has(seasonName)) seasons.set(seasonName, []);
          seasons.get(seasonName)!.push(vf);
        }
      }
    });

    const watchlists: Watchlist[] = [];
    
    // 1. Process root files
    if (rootFiles.length > 0) {
      const existing = existingWatchlists.find(w => w.folderPath === dirPath && (w.title === rootGroupName || (w.files && w.files.some(f => rootFiles.some(rf => rf.absolutePath === (f as any).absolutePath)))));
      const sortedRootFiles = sortSmartMediaFiles(rootFiles);
      if (existing) {
        // Merge root files
        const fileMap = new Map();
        (existing.files || []).forEach(f => fileMap.set((f as any).absolutePath || f.name, f));
        sortedRootFiles.forEach(f => fileMap.set((f as any).absolutePath || f.name, f));
        watchlists.push({ ...existing, files: sortSmartMediaFiles(Array.from(fileMap.values())), isSingleFile: false });
      } else {
        watchlists.push({
          id: crypto.randomUUID(),
          title: rootGroupName,
          section: rootGroupName,
          coverImage: '',
          seriesCount: 1,
          episodesCount: rootFiles.length,
          lastWatched: new Date().toISOString(),
          progress: 0,
          timeRemaining: '',
          targetMode: '',
          isSingleFile: false,
          files: sortedRootFiles,
          folderPath: dirPath,
          folderName: rootGroupName
        });
      }
    }

    let processedGroups = 0;
    const totalGroups = seriesMap.size;

    // 2. Process series
    for (const [seriesTitle, seasonsMap] of seriesMap.entries()) {
      if (onProgress) {
        const percent = 20 + Math.floor((processedGroups / totalGroups) * 80);
        onProgress(percent, 100, `جاري تنظيم مسلسل: ${seriesTitle} (${processedGroups + 1} من ${totalGroups})`);
      }
      processedGroups++;

      // Count total files in this series
      let totalFilesInSeries = 0;
      const allFilesList: VideoFile[] = [];
      for (const sFiles of seasonsMap.values()) {
        totalFilesInSeries += sFiles.length;
        allFilesList.push(...sFiles);
      }

      const existing = existingWatchlists.find(w => w.folderPath === dirPath && (w.title === seriesTitle || (w.files && w.files.some(f => allFilesList.some(af => af.absolutePath === (f as any).absolutePath)))));

      if (totalFilesInSeries === 1) {
        // Special rule: Folder with exactly 1 file -> single playlist
        const singleFile = allFilesList[0];
        if (existing) {
          watchlists.push({ ...existing, files: [singleFile], seasons: undefined, isSingleFile: false, episodesCount: 1 });
        } else {
          watchlists.push({
            id: crypto.randomUUID(),
            title: seriesTitle,
            section: rootGroupName,
            coverImage: '',
            seriesCount: 1,
            episodesCount: 1,
            lastWatched: new Date().toISOString(),
            progress: 0,
            timeRemaining: '',
            targetMode: '',
            isSingleFile: false,
            files: [singleFile],
            folderPath: dirPath,
            folderName: rootGroupName
          });
        }
        continue;
      }

      // Normal series with multiple files
      const seasonsArray = [];
      let directFiles: VideoFile[] = [];

      for (const [sName, sFiles] of seasonsMap.entries()) {
        if (sName === "الملفات المباشرة") {
          directFiles = sortSmartMediaFiles(sFiles);
        } else {
          seasonsArray.push({
            name: sName,
            files: sortSmartMediaFiles(sFiles)
          });
        }
      }

      seasonsArray.sort((a, b) => naturalCompare(a.name, b.name));

      if (existing) {
        // Merge files
        const fileMap = new Map();
        (existing.files || []).forEach(f => fileMap.set((f as any).absolutePath || f.name, f));
        directFiles.forEach(f => fileMap.set((f as any).absolutePath || f.name, f));
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
          isSingleFile: false
        });
      } else {
        let coverImage = '';
        try {
          coverImage = await extractFirstValidThumbnail(allFilesList);
        } catch (e) {
          console.warn('Could not extract cover for', seriesTitle, e);
        }
        
        const totalEps = directFiles.length + seasonsArray.reduce((acc, s) => acc + s.files.length, 0);
        
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
          targetMode: '',
          isSingleFile: false,
          files: directFiles,
          seasons: seasonsArray,
          folderPath: dirPath,
          folderName: rootGroupName
        });
      }
    }

    if (onProgress) onProgress(100, 100, 'اكتملت العملية بنجاح!');
    return watchlists;
  } catch (err) {
    console.error('processMediaDirectory error:', err);
    if (onProgress) onProgress(100, 100, 'حدث خطأ أثناء قراءة المجلدات.');
    return [];
  }
}

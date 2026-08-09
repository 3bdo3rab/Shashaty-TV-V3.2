const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `  const hydrateLists = async (parentHandles: any[], storedWatchlists: Watchlist[]) => {
    try {
      setIsHydrating(true);
      const fileMap = new Map();
      const allPaths: string[] = [];
      
      for (const handle of parentHandles) {
         const allFiles = await getFilesFromDirectoryHandle(handle);
         allFiles.forEach(f => {
           const p = (f as any).customPath || f.webkitRelativePath;
           fileMap.set(p, f);
           allPaths.push(p);
         });
      }

      const findFile = (path: string) => {
         if (!path) return null;
         if (fileMap.has(path)) return fileMap.get(path);
         
         const targetSuffix = path.startsWith('/') ? path : '/' + path;
         const match = allPaths.find(p => p.endsWith(targetSuffix) || p === path);
         if (match) return fileMap.get(match);
         
         const fileName = path.split('/').pop();
         if (fileName) {
             const nameMatch = allPaths.find(p => p.endsWith('/' + fileName));
             if (nameMatch) return fileMap.get(nameMatch);
         }
         return null;
      };

      const hydrated = storedWatchlists.map(wl => {
        const hFiles = wl.files.map(f => {
          const path = (f as any).customPath || f.webkitRelativePath || f.name;
          return findFile(path) || f;
        });
        const hSeasons = wl.seasons?.map(s => ({
          ...s,
          files: s.files.map(f => {
             const path = (f as any).customPath || f.webkitRelativePath || f.name;
             return findFile(path) || f;
          })
        }));
        return { ...wl, files: hFiles, seasons: hSeasons };
      });
      
      setWatchlists(hydrated);
    } catch (e) {
      console.error('Error hydrating:', e);
      setWatchlists(storedWatchlists);
    } finally {
      setIsHydrating(false);
      setIsStoreLoaded(true);
    }
  };`;

const replaceStr = `  const hydrateLists = async (parentHandles: any[], storedWatchlists: Watchlist[]) => {
    try {
      setIsHydrating(true);
      
      // Fast path file resolution without recursively reading the entire directory tree
      const resolveFileFromPath = async (path: string): Promise<File | null> => {
        if (!path) return null;
        const parts = path.split('/').filter(Boolean);
        if (parts.length === 0) return null;
        
        for (const parentHandle of parentHandles) {
          try {
            let currentHandle = parentHandle;
            let pathParts = [...parts];
            // If the first part of the path matches the parent handle's name, skip it
            if (pathParts[0] === parentHandle.name) {
              pathParts.shift();
            }
            if (pathParts.length === 0) continue;
            
            for (let i = 0; i < pathParts.length - 1; i++) {
              currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
            }
            
            const fileName = pathParts[pathParts.length - 1];
            const fileHandle = await currentHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            
            try {
              Object.defineProperty(file, 'customPath', { value: path, writable: true });
            } catch (e) {
              (file as any).customPath = path;
            }
            return file;
          } catch (e) {
            // File not found in this parent handle or path mismatch, try next
          }
        }
        return null;
      };

      // Since we need to hydrate potentially many files, we process watchlists in parallel
      const hydrated = await Promise.all(storedWatchlists.map(async wl => {
        const hFiles = await Promise.all((wl.files || []).map(async f => {
          if (f instanceof File) return f; // Already a file
          const path = (f as any).customPath || f.webkitRelativePath || f.name;
          const resolved = await resolveFileFromPath(path);
          return resolved || f;
        }));
        
        let hSeasons = undefined;
        if (wl.seasons) {
          hSeasons = await Promise.all(wl.seasons.map(async s => {
            const sFiles = await Promise.all((s.files || []).map(async f => {
              if (f instanceof File) return f;
              const path = (f as any).customPath || f.webkitRelativePath || f.name;
              const resolved = await resolveFileFromPath(path);
              return resolved || f;
            }));
            return { ...s, files: sFiles };
          }));
        }
        
        return { ...wl, files: hFiles, seasons: hSeasons };
      }));
      
      setWatchlists(hydrated);
    } catch (e) {
      console.error('Error hydrating:', e);
      setWatchlists(storedWatchlists);
    } finally {
      setIsHydrating(false);
      setIsStoreLoaded(true);
    }
  };`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log("Replaced hydration logic");

import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

// Tauri Desktop Helper Utilities

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
};

export const getTauriWindow = async () => {
  if (!isTauri()) return null;
  try {
    return getCurrentWindow();
  } catch (e) {
    console.warn('Could not load Tauri window module:', e);
  }
  return null;
};

export const minimizeWindow = async () => {
  const win = await getTauriWindow();
  if (win && typeof win.minimize === 'function') {
    try {
      await win.minimize();
      return;
    } catch (e) {
      console.warn('Tauri window minimize error:', e);
    }
  }
};

export const toggleMaximizeWindow = async () => {
  let isMax = false;
  let handledByTauri = false;

  const win = await getTauriWindow();
  if (win) {
    try {
      if (typeof win.toggleMaximize === 'function') {
        await win.toggleMaximize();
        isMax = typeof win.isMaximized === 'function' ? await win.isMaximized() : true;
        handledByTauri = true;
      } else if (typeof win.isMaximized === 'function') {
        const currentlyMax = await win.isMaximized();
        if (currentlyMax) {
          if (typeof win.unmaximize === 'function') await win.unmaximize();
          isMax = false;
        } else {
          if (typeof win.maximize === 'function') await win.maximize();
          isMax = true;
        }
        handledByTauri = true;
      }
    } catch (e) {
      console.warn('Tauri window maximize error, falling back to browser mode:', e);
    }
  }

  if (!handledByTauri) {
    // Browser / iFrame Fallback
    try {
      const isCurrentlyFullscreen = !!document.fullscreenElement || (document as any).webkitFullscreenElement;
      const isBodyMax = document.body.classList.contains('app-maximized-viewport');

      if (!isCurrentlyFullscreen && !isBodyMax) {
        let fullscreenSuccess = false;
        try {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
            fullscreenSuccess = true;
          } else if ((document.documentElement as any).webkitRequestFullscreen) {
            await (document.documentElement as any).webkitRequestFullscreen();
            fullscreenSuccess = true;
          }
        } catch (fErr) {
          fullscreenSuccess = false;
        }

        if (!fullscreenSuccess) {
          document.body.classList.add('app-maximized-viewport');
          isMax = true;
        } else {
          isMax = true;
        }
      } else {
        if (isCurrentlyFullscreen) {
          try {
            if (document.exitFullscreen) {
              await document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
              await (document as any).webkitExitFullscreen();
            }
          } catch (exitErr) {
            // ignore
          }
        }
        document.body.classList.remove('app-maximized-viewport');
        isMax = false;
      }
    } catch (err) {
      console.warn('Browser maximize error:', err);
      isMax = document.body.classList.toggle('app-maximized-viewport');
    }
  }

  window.dispatchEvent(new CustomEvent('app-maximize-toggled', { detail: { isMaximized: isMax } }));
  return isMax;
};

export const closeWindow = async () => {
  try {
    if (isTauri()) {
      await invoke('quit_app');
    } else {
      // Web fallback
      if (confirm('هل تريد إغلاق تطبيق شاشتي TV؟')) {
        window.close();
      }
    }
  } catch (e: any) {
    console.warn('Close error: ', e);
  }
};

export const setFullscreen = async (fullscreen: boolean) => {
  const win = await getTauriWindow();
  if (win && typeof win.setFullscreen === 'function') {
    try {
      await win.setFullscreen(fullscreen);
    } catch (e) {
      console.warn('Tauri setFullscreen error:', e);
    }
  } else {
    if (fullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!fullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }
};

export const setAlwaysOnTop = async (alwaysOnTop: boolean) => {
  const win = await getTauriWindow();
  if (win && typeof win.setAlwaysOnTop === 'function') {
    try {
      await win.setAlwaysOnTop(alwaysOnTop);
    } catch (e) {
      console.warn('Tauri setAlwaysOnTop error:', e);
    }
  }
};

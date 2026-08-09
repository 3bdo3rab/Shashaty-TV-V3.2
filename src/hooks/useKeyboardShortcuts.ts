import { useEffect } from 'react';
import { ViewState, Mode } from '../types';
import { loadUserShortcuts, ShortcutAction } from '../utils/keyboardDefaults';

interface UseKeyboardShortcutsProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  currentMode: Mode;
  setCurrentMode: (mode: Mode) => void;
}

export function useKeyboardShortcuts({
  currentView,
  setCurrentView,
  currentMode,
  setCurrentMode,
}: UseKeyboardShortcutsProps) {

  useEffect(() => {
    // Load shortcuts whenever the hook mounts or window focuses (in case settings changed)
    let shortcuts = loadUserShortcuts();

    const handleFocus = () => {
      shortcuts = loadUserShortcuts();
    };
    window.addEventListener('focus', handleFocus);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const activeEl = document.activeElement as HTMLElement;

      const key = e.key.toLowerCase();
      const shift = e.shiftKey;
      const ctrl = e.ctrlKey;
      const alt = e.altKey;

      const matchAction = (action: ShortcutAction): boolean => {
        const sc = shortcuts[action];
        if (!sc) return false;
        
        // Special case for volume up '+' which might be '=' on some keyboards without shift
        if (action === 'volume_up' && (key === '+' || key === '=') && sc.key === '+') {
           return sc.shift === shift && sc.ctrl === ctrl && sc.alt === alt;
        }
        // Special case for volume down '-' which might be '_'
        if (action === 'volume_down' && (key === '-' || key === '_') && sc.key === '-') {
           return sc.shift === shift && sc.ctrl === ctrl && sc.alt === alt;
        }

        return sc.key === key && sc.shift === shift && sc.ctrl === ctrl && sc.alt === alt;
      };

      // ==========================================
      // 1. Spatial Navigation (D-Pad)
      // ==========================================
      let navDir: 'up' | 'down' | 'left' | 'right' | null = null;
      if (matchAction('nav_up')) navDir = 'up';
      else if (matchAction('nav_down')) navDir = 'down';
      else if (matchAction('nav_left')) navDir = 'left';
      else if (matchAction('nav_right')) navDir = 'right';

      if (navDir) {
        e.preventDefault();
        
        // Find all focusable elements
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const rawElements = Array.from(document.querySelectorAll<HTMLElement>(focusableSelector));
        
        const focusableElements = rawElements.filter((el) => {
          return !el.hasAttribute('disabled') && el.offsetWidth > 0 && el.offsetHeight > 0;
        });

        if (focusableElements.length === 0) return;

        let currentRect = activeEl && activeEl !== document.body ? activeEl.getBoundingClientRect() : null;

        // If no element is currently focused, just focus the first one
        if (!currentRect) {
          focusableElements[0]?.focus();
          return;
        }

        // Calculate distance and filter based on direction
        let bestMatch: HTMLElement | null = null;
        let minDistance = Infinity;

        focusableElements.forEach((el) => {
          if (el === activeEl) return;
          const rect = el.getBoundingClientRect();

          let isValidDirection = false;
          let distance = Infinity;

          const cx1 = currentRect!.left + currentRect!.width / 2;
          const cy1 = currentRect!.top + currentRect!.height / 2;
          const cx2 = rect.left + rect.width / 2;
          const cy2 = rect.top + rect.height / 2;

          const dx = cx2 - cx1;
          const dy = cy2 - cy1;

          switch (navDir) {
            case 'up':
              isValidDirection = rect.bottom <= currentRect!.top + 10;
              if (isValidDirection) distance = Math.abs(dy) * 1.5 + Math.abs(dx);
              break;
            case 'down':
              isValidDirection = rect.top >= currentRect!.bottom - 10;
              if (isValidDirection) distance = Math.abs(dy) * 1.5 + Math.abs(dx);
              break;
            case 'left':
              isValidDirection = rect.right <= currentRect!.left + 10;
              if (isValidDirection) distance = Math.abs(dx) * 1.5 + Math.abs(dy);
              break;
            case 'right':
              isValidDirection = rect.left >= currentRect!.right - 10;
              if (isValidDirection) distance = Math.abs(dx) * 1.5 + Math.abs(dy);
              break;
          }

          if (isValidDirection && distance < minDistance) {
            minDistance = distance;
            bestMatch = el;
          }
        });

        if (bestMatch) {
          (bestMatch as HTMLElement).focus();
        }
        return;
      }

      if (e.key === 'Enter') {
        if (activeEl && activeEl !== document.body) {
          if (activeEl.tagName !== 'BUTTON' && activeEl.tagName !== 'A' && activeEl.tagName !== 'INPUT') {
            e.preventDefault();
            activeEl.click();
          }
        }
        return;
      }

      // ==========================================
      // 2. Tab Navigation (Sidebar vs Main Content)
      // ==========================================
      if (e.key === 'Tab' && !shift && !ctrl && !alt) {
        e.preventDefault();
        
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(document.querySelectorAll<HTMLElement>(focusableSelector)).filter(
          (el) => !el.hasAttribute('disabled') && el.offsetWidth > 0 && el.offsetHeight > 0
        );

        const inSidebar = activeEl?.closest('aside') || activeEl?.closest('[data-sidebar="true"]');
        let targetEl: HTMLElement | undefined;
        
        if (inSidebar) {
          targetEl = focusableElements.find(el => !el.closest('aside') && !el.closest('[data-sidebar="true"]'));
        } else {
          targetEl = focusableElements.find(el => el.closest('aside') || el.closest('[data-sidebar="true"]'));
        }

        if (targetEl) {
          targetEl.focus();
        } else if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
        return;
      }

      // ==========================================
      // 3. Action Dispatcher
      // ==========================================
      
      const dispatchAction = (action: ShortcutAction, isDefaultPrevented: boolean = true) => {
        if (isDefaultPrevented) e.preventDefault();
        
        switch (action) {
          case 'mode_kids':
            setCurrentMode('kids');
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'switch_mode', payload: { value: 'kids' } } }));
            break;
          case 'mode_series':
            setCurrentMode('series');
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'switch_mode', payload: { value: 'series' } } }));
            break;
          case 'mode_family':
            setCurrentMode('family');
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'switch_mode', payload: { value: 'family' } } }));
            break;
          case 'mode_cinema':
            setCurrentMode('cinema');
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'switch_mode', payload: { value: 'cinema' } } }));
            break;
          case 'mode_quran':
            setCurrentMode('quran');
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'switch_mode', payload: { value: 'quran' } } }));
            break;
          case 'back':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'back' } }));
            break;
          case 'play_pause':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'play_pause' } }));
            break;
          case 'toggle_mute':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'toggle_mute' } }));
            break;
          case 'toggle_pip':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'toggle_pip' } }));
            break;
          case 'toggle_fullscreen':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'toggle_fullscreen' } }));
            break;
          case 'volume_up':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'volume_up' } }));
            break;
          case 'volume_down':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'volume_down' } }));
            break;
          case 'go_home':
            setCurrentView('home');
            break;
          case 'go_channels':
            setCurrentView('channels');
            break;
          case 'go_sessions':
            setCurrentView('sessions');
            break;
          case 'go_library':
            setCurrentView('library');
            break;
          case 'f1_red':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'f1_red' } }));
            break;
          case 'f2_green':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'f2_green' } }));
            break;
          case 'f3_yellow':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'f3_yellow' } }));
            break;
          case 'f4_blue':
            window.dispatchEvent(new CustomEvent('tvCommand', { detail: { action: 'f4_blue' } }));
            break;
        }
      };

      // Check all actions against the pressed key
      const allActions = Object.keys(shortcuts) as ShortcutAction[];
      for (const action of allActions) {
        if (matchAction(action)) {
          dispatchAction(action, true);
          return;
        }
      }

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('focus', handleFocus);
    };
  }, [setCurrentView, setCurrentMode]);
}

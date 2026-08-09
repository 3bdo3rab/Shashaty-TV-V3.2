export type ShortcutAction = 
  | 'nav_up' | 'nav_down' | 'nav_left' | 'nav_right'
  | 'play_pause' | 'toggle_mute' | 'volume_up' | 'volume_down'
  | 'toggle_fullscreen' | 'toggle_pip' | 'back'
  | 'go_home' | 'go_channels' | 'go_sessions' | 'go_library'
  | 'mode_kids' | 'mode_series' | 'mode_family' | 'mode_cinema' | 'mode_quran'
  | 'f1_red' | 'f2_green' | 'f3_yellow' | 'f4_blue';

export interface ShortcutBinding {
  action: ShortcutAction;
  label: string;
  defaultKey: string;
  defaultModifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean };
}

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  // Navigation
  { action: 'nav_up', label: 'التنقل للأعلى', defaultKey: 'ArrowUp' },
  { action: 'nav_down', label: 'التنقل للأسفل', defaultKey: 'ArrowDown' },
  { action: 'nav_left', label: 'التنقل لليسار', defaultKey: 'ArrowLeft' },
  { action: 'nav_right', label: 'التنقل لليمين', defaultKey: 'ArrowRight' },
  
  // Playback
  { action: 'play_pause', label: 'تشغيل / إيقاف مؤقت', defaultKey: ' ' },
  { action: 'toggle_mute', label: 'كتم الصوت', defaultKey: 'm' },
  { action: 'volume_up', label: 'رفع الصوت', defaultKey: '+' }, // we'll handle '=' too in the hook
  { action: 'volume_down', label: 'خفض الصوت', defaultKey: '-' },
  { action: 'toggle_fullscreen', label: 'ملء الشاشة', defaultKey: 'f' },
  { action: 'toggle_pip', label: 'نافذة عائمة (PiP)', defaultKey: 'p' },
  { action: 'back', label: 'رجوع / خروج', defaultKey: 'Escape' },

  // Sections
  { action: 'go_home', label: 'الرئيسية (الجدولة)', defaultKey: 's' },
  { action: 'go_channels', label: 'القنوات', defaultKey: 'c' },
  { action: 'go_sessions', label: 'الجلسات', defaultKey: 'd' },
  { action: 'go_library', label: 'المكتبة', defaultKey: 'l' },

  // Modes
  { action: 'mode_kids', label: 'وضع أطفالي', defaultKey: 'c', defaultModifiers: { shift: true } },
  { action: 'mode_series', label: 'وضع المسلسلات', defaultKey: 's', defaultModifiers: { shift: true } },
  { action: 'mode_family', label: 'وضع عائلتي', defaultKey: 'f', defaultModifiers: { shift: true } },
  { action: 'mode_cinema', label: 'وضع الأفلام', defaultKey: 'm', defaultModifiers: { shift: true } },
  { action: 'mode_quran', label: 'وضع القرآن الكريم', defaultKey: 'q', defaultModifiers: { shift: true } },

  // Functions
  { action: 'f1_red', label: 'وظيفة F1', defaultKey: 'F1' },
  { action: 'f2_green', label: 'وظيفة F2', defaultKey: 'F2' },
  { action: 'f3_yellow', label: 'وظيفة F3', defaultKey: 'F3' },
  { action: 'f4_blue', label: 'وظيفة F4', defaultKey: 'F4' }
];

export interface UserShortcut {
  key: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

export function loadUserShortcuts(): Record<ShortcutAction, UserShortcut> {
  try {
    const saved = localStorage.getItem('app_keyboard_shortcuts');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {}

  // Fallback to defaults
  const defaults: Partial<Record<ShortcutAction, UserShortcut>> = {};
  DEFAULT_SHORTCUTS.forEach(binding => {
    defaults[binding.action] = {
      key: binding.defaultKey.toLowerCase(),
      shift: !!binding.defaultModifiers?.shift,
      ctrl: !!binding.defaultModifiers?.ctrl,
      alt: !!binding.defaultModifiers?.alt
    };
  });
  return defaults as Record<ShortcutAction, UserShortcut>;
}

export function saveUserShortcuts(shortcuts: Record<ShortcutAction, UserShortcut>) {
  localStorage.setItem('app_keyboard_shortcuts', JSON.stringify(shortcuts));
}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Keyboard, Check, Undo2 } from 'lucide-react';
import { 
  DEFAULT_SHORTCUTS, 
  loadUserShortcuts, 
  saveUserShortcuts,
  ShortcutAction,
  ShortcutBinding,
  UserShortcut
} from '../utils/keyboardDefaults';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ onClose }) => {
  const [shortcuts, setShortcuts] = useState<Record<ShortcutAction, UserShortcut>>(loadUserShortcuts());
  const [editingAction, setEditingAction] = useState<ShortcutAction | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editingAction) return;
      e.preventDefault();
      e.stopPropagation();

      // Ignore if only a modifier key is pressed
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      const newShortcut: UserShortcut = {
        key: e.key.toLowerCase(),
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey
      };

      const updated = { ...shortcuts, [editingAction]: newShortcut };
      setShortcuts(updated);
      saveUserShortcuts(updated);
      setEditingAction(null);
    };

    if (editingAction) {
      window.addEventListener('keydown', handleKeyDown, { capture: true });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [editingAction, shortcuts]);

  const handleReset = (action: ShortcutAction) => {
    const defaultBinding = DEFAULT_SHORTCUTS.find(b => b.action === action);
    if (!defaultBinding) return;

    const newShortcut: UserShortcut = {
      key: defaultBinding.defaultKey.toLowerCase(),
      shift: !!defaultBinding.defaultModifiers?.shift,
      ctrl: !!defaultBinding.defaultModifiers?.ctrl,
      alt: !!defaultBinding.defaultModifiers?.alt
    };

    const updated = { ...shortcuts, [action]: newShortcut };
    setShortcuts(updated);
    saveUserShortcuts(updated);
  };

  const handleResetAll = () => {
    const defaults: Partial<Record<ShortcutAction, UserShortcut>> = {};
    DEFAULT_SHORTCUTS.forEach(binding => {
      defaults[binding.action] = {
        key: binding.defaultKey.toLowerCase(),
        shift: !!binding.defaultModifiers?.shift,
        ctrl: !!binding.defaultModifiers?.ctrl,
        alt: !!binding.defaultModifiers?.alt
      };
    });
    setShortcuts(defaults as Record<ShortcutAction, UserShortcut>);
    saveUserShortcuts(defaults as Record<ShortcutAction, UserShortcut>);
  };

  const renderKey = (sc: UserShortcut) => {
    const parts = [];
    if (sc.ctrl) parts.push('Ctrl');
    if (sc.alt) parts.push('Alt');
    if (sc.shift) parts.push('Shift');
    
    let keyLabel = sc.key.toUpperCase();
    if (sc.key === ' ') keyLabel = 'SPACE';
    if (sc.key === 'escape') keyLabel = 'ESC';
    if (sc.key.startsWith('arrow')) keyLabel = sc.key.replace('arrow', 'ARROW ');
    
    parts.push(keyLabel);

    return parts.map((part, idx) => (
      <span key={idx} className="bg-slate-800 text-slate-200 px-2 py-1 rounded text-xs font-mono border border-slate-700 mx-0.5 shadow-sm">
        {part}
      </span>
    ));
  };

  return (
    <div className="pl-6 sm:pl-12 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-4 bg-blue-500/20 rounded-2xl border border-blue-500/30">
          <Keyboard className="w-8 h-8 text-blue-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl sm:text-3xl font-bold">اختصارات لوحة المفاتيح</h2>
          <p className="text-white/60 text-sm mt-1">تخصيص أزرار التحكم بالتطبيق لتناسب تفضيلاتك</p>
        </div>
        <button
          onClick={handleResetAll}
          className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors flex items-center gap-2"
        >
          <Undo2 className="w-4 h-4" />
          استعادة الافتراضي للكل
        </button>
      </div>

      <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/5 space-y-4">
        {editingAction && (
          <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl flex items-center justify-center gap-3 text-blue-200 animate-pulse">
            <Keyboard className="w-5 h-5" />
            <span>اضغط على أي زر الآن لتعيينه لاختصار: <strong>{DEFAULT_SHORTCUTS.find(b => b.action === editingAction)?.label}</strong></span>
            <button 
              onClick={() => setEditingAction(null)}
              className="mr-auto text-xs bg-blue-500/30 hover:bg-blue-500/50 px-3 py-1.5 rounded-lg transition-colors"
            >
              إلغاء
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {DEFAULT_SHORTCUTS.map((binding) => {
            const currentShortcut = shortcuts[binding.action];
            const isEditing = editingAction === binding.action;
            
            return (
              <div 
                key={binding.action}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isEditing 
                    ? 'bg-blue-500/10 border-blue-500/50 ring-2 ring-blue-500/20' 
                    : 'bg-black/30 border-white/10 hover:bg-black/50'
                }`}
              >
                <span className="text-slate-300 font-medium">{binding.label}</span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingAction(binding.action)}
                    className={`flex items-center gap-1 min-w-[80px] justify-center px-3 py-2 rounded-lg transition-colors ${
                      isEditing 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/5'
                    }`}
                  >
                    {isEditing ? (
                      <span className="text-xs">اضغط الآن...</span>
                    ) : (
                      renderKey(currentShortcut)
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleReset(binding.action)}
                    title="استعادة الافتراضي"
                    className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

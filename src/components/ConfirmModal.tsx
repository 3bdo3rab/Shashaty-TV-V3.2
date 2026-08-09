import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Trash2, X, AlertTriangle, ExternalLink } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = 'تأكيد',
  message,
  confirmText = 'موافق',
  cancelText,
  isDanger,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  // Keyboard shortcut listener for Enter (Confirm) and Escape (Cancel)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't override inside text inputs unless requested
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel]);

  // Determine if this is explicitly a deletion/destructive action
  const isDelete = isDanger === true || (isDanger !== false && (title.includes('حذف') || message.includes('حذف')));
  const isAlertOrNotice = title.includes('تنبيه') || message.includes('علامة تبويب') || message.includes('مجلد') || message.includes('قيود');

  const renderIcon = () => {
    if (isDelete) {
      return <Trash2 className="w-8 h-8 text-red-400" />;
    }
    if (message.includes('علامة تبويب') || message.includes('تبويب جديدة')) {
      return <ExternalLink className="w-8 h-8 text-amber-400" />;
    }
    if (isAlertOrNotice || isDanger === false) {
      return <AlertTriangle className="w-8 h-8 text-amber-400" />;
    }
    return <Info className="w-8 h-8 text-indigo-400" />;
  };

  const getIconContainerStyle = () => {
    if (isDelete) {
      return 'bg-red-500/20 border-red-500/30';
    }
    if (isAlertOrNotice || message.includes('علامة تبويب')) {
      return 'bg-amber-500/20 border-amber-500/30';
    }
    return 'bg-indigo-500/20 border-indigo-500/30';
  };

  const getConfirmButtonStyle = () => {
    if (isDelete) {
      return 'bg-red-500 hover:bg-red-600 text-white font-bold';
    }
    if (isAlertOrNotice || message.includes('علامة تبويب')) {
      return 'bg-amber-400 hover:bg-amber-500 text-black font-extrabold';
    }
    return 'bg-white text-black hover:bg-white/90 font-bold';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card w-full max-w-md rounded-[2rem] p-8 border border-white/20 shadow-2xl relative space-y-6 text-center"
        >
          <button
            onClick={onCancel}
            className="absolute top-5 left-5 p-2 text-white/50 hover:text-white glass rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className={`mx-auto w-16 h-16 rounded-2xl border flex items-center justify-center ${getIconContainerStyle()}`}>
            {renderIcon()}
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
            <p className="text-sm text-white/80 leading-relaxed font-medium">{message}</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {cancelText && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl font-bold text-sm glass text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 py-3 rounded-xl text-sm shadow-lg transition-transform hover:scale-105 cursor-pointer ${getConfirmButtonStyle()}`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

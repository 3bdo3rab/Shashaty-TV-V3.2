import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';

interface DialogOptions {
  type: 'alert' | 'confirm';
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

interface DialogContextType {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string, isDanger?: boolean) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<(DialogOptions & { resolve: (value: any) => void }) | null>(null);

  const showAlert = (message: string, title: string = 'تنبيه') => {
    return new Promise<void>((resolve) => {
      setDialog({
        type: 'alert',
        title,
        message,
        confirmText: 'موافق',
        isDanger: false,
        resolve,
      });
    });
  };

  const showConfirm = (message: string, title: string = 'تأكيد', isDanger: boolean = true) => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        type: 'confirm',
        title,
        message,
        confirmText: 'موافق',
        cancelText: 'إلغاء',
        isDanger,
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    if (dialog) {
      if (dialog.type === 'confirm') {
        dialog.resolve(true);
      } else {
        dialog.resolve(undefined);
      }
      setDialog(null);
    }
  };

  const handleCancel = () => {
    if (dialog) {
      if (dialog.type === 'confirm') {
        dialog.resolve(false);
      } else {
        dialog.resolve(undefined);
      }
      setDialog(null);
    }
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {dialog && (
        <ConfirmModal
          isOpen={true}
          title={dialog.title}
          message={dialog.message}
          confirmText={dialog.confirmText}
          cancelText={dialog.type === 'confirm' ? dialog.cancelText : undefined}
          isDanger={dialog.isDanger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

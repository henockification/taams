'use client';

import { toast } from 'sonner';
import { ReactNode } from 'react';

interface CustomToastProps {
  message: string;
  icon: ReactNode;
  type?: 'success' | 'error' | 'info' | 'warning';
}

export const showCustomToast = ({ message, icon, type = 'success' }: CustomToastProps) => {
  const toastContent = (
    <div className="flex items-center gap-2">
      {icon}
      <span>{message}</span>
    </div>
  );

  switch (type) {
    case 'success':
      return toast.success(toastContent);
    case 'error':
      return toast.error(toastContent);
    case 'info':
      return toast.info(toastContent);
    case 'warning':
      return toast.warning(toastContent);
    default:
      return toast(toastContent);
  }
};

// Convenience functions for common use cases
export const showSuccessToast = (message: string, icon: ReactNode) => {
  return showCustomToast({ message, icon, type: 'success' });
};

export const showErrorToast = (message: string, icon: ReactNode) => {
  return showCustomToast({ message, icon, type: 'error' });
};

export const showInfoToast = (message: string, icon: ReactNode) => {
  return showCustomToast({ message, icon, type: 'info' });
};

export const showWarningToast = (message: string, icon: ReactNode) => {
  return showCustomToast({ message, icon, type: 'warning' });
};

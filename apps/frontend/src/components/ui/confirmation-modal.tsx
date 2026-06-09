'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmationModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

export default function ConfirmationModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  loading = false,
}: ConfirmationModalProps) {
  return (
    <Dialog open={opened} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <div className="flex flex-col items-center gap-6 p-4">
          {/* Icon */}
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-muted">
            <HelpCircle className="h-[30px] w-[30px] text-muted-foreground" />
          </div>

          {/* Title */}
          <DialogTitle className="text-xl font-bold">
            {title}
          </DialogTitle>

          {/* Message */}
          <p className="text-center text-muted-foreground">
            {message}
          </p>

          {/* Action Buttons */}
          <div className="flex w-full gap-4">
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Please wait...' : confirmLabel}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              {cancelLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

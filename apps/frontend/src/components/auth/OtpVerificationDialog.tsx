'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type OtpVerificationDialogProps = {
  open: boolean;
  email: string;
  loading?: boolean;
  resending?: boolean;
  error?: string | null;
  testingMode?: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<void>;
};

export function OtpVerificationDialog({
  open,
  email,
  loading = false,
  resending = false,
  error,
  testingMode = false,
  onOpenChange,
  onVerify,
  onResend,
}: OtpVerificationDialogProps) {
  const t = useTranslations('auth');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (open) setOtp('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!loading && !resending) onOpenChange(nextOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => {
          event.preventDefault();
          if (otp.length === 6 && !loading) void onVerify(otp);
        }}>
          <DialogHeader>
            <DialogTitle>{t('otpDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('otpDialogDescription', { email })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-6">
            <InputOTP
              autoFocus
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]*"
              value={otp}
              onChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              disabled={loading || resending}
              aria-label={t('verificationCode')}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot key={index} index={index} className="h-12 w-11 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>

            {testingMode ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-center text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                {t('otpTestingMode')}
              </p>
            ) : null}
            {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}

            <Button type="button" variant="ghost" size="sm" onClick={() => void onResend()} disabled={loading || resending}>
              <RefreshCw className={resending ? 'size-4 animate-spin' : 'size-4'} />
              {resending ? t('resendingOtp') : t('resendOtp')}
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading || resending}>
              {t('cancelOtp')}
            </Button>
            <Button type="submit" disabled={otp.length !== 6 || loading || resending}>
              {loading ? t('verifyingOtp') : t('verifyOtp')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

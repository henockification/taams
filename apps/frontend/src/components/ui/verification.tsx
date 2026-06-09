'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface VerificationProps {
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onClearError?: () => void;
  isLoading?: boolean;
  isResending?: boolean;
  error?: string;
  className?: string;
}

export function Verification({ 
  onVerify, 
  onResend, 
  onClearError,
  isLoading = false, 
  isResending = false,
  error,
  className 
}: VerificationProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Clear code when error occurs
  useEffect(() => {
    if (error) {
      setCode(['', '', '', '', '', '']);
      setActiveIndex(0);
      inputRefs.current[0]?.focus();
    }
  }, [error]);

  // Don't clear error when user types - let it persist until new verification attempt
  const handleInputChange = (index: number, value: string) => {
    // Only allow single digit
    if (value.length > 1) {
      value = value.slice(-1);
    }

    // Only allow numbers
    if (!/^\d*$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Move to next input if value is entered
    if (value && index < 5) {
      setActiveIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      handleVerify(newCode.join(''));
    }
  };



  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      setActiveIndex(index - 1);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      setActiveIndex(5);
      inputRefs.current[5]?.focus();
      handleVerify(pastedData);
    }
  };

  // Verify code
  const handleVerify = async (verificationCode: string) => {
    // Clear error before new verification attempt
    if (error && onClearError) {
      onClearError();
    }
    await onVerify(verificationCode);
  };

  // Resend code
  const handleResend = async () => {
    try {
      await onResend();
      toast.success('A new verification code has been sent to your email');
    } catch (error) {
      toast.error('Failed to resend verification code');
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <p className="text-sm text-muted-foreground text-center">
        Enter the 6-digit verification code sent to your email
      </p>

      {/* Code Input Fields */}
      <div className="flex justify-center gap-2">
        {code.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`
              w-12 h-12 text-center text-lg font-semibold border-2 rounded-lg text-gray-900
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              transition-all duration-200
              ${error 
                ? 'border-red-500 bg-red-50' 
                : 'border-gray-300 bg-white'
              }
              ${activeIndex === index 
                ? 'border-blue-500 ring-2 ring-blue-500' 
                : ''
              }
            `}
            disabled={isLoading}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive text-center">
          {error}
        </p>
      )}

      {/* Resend Code */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={handleResend}
          disabled={isLoading || isResending}
          size="sm"
        >
          <RefreshCw className="size-4 mr-2" />
          {isResending ? 'Resending...' : 'Resend Code'}
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2">
          <Spinner className="size-4" />
          <p className="text-sm text-muted-foreground">
            Verifying code...
          </p>
        </div>
      )}
    </div>
  );
}

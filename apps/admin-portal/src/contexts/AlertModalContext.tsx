"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Info, Loader2, X } from "lucide-react";
import { Button } from "@fitnudge/ui";

export type AlertVariant = "success" | "warning" | "error" | "info";

export interface AlertOptions {
  title: string;
  message?: string;
  variant?: AlertVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  showCloseIcon?: boolean;
  dismissible?: boolean;
  /** Custom content instead of message */
  content?: React.ReactNode;
  /**
   * When provided, confirm button runs this async action. Modal stays open,
   * buttons are disabled, until the action completes. Modal closes on success or error.
   */
  onConfirm?: () => Promise<void>;
}

interface AlertRequest extends AlertOptions {
  id: string;
  resolve: (result: boolean) => void;
  reject: (err: unknown) => void;
}

interface AlertModalContextValue {
  showAlert: (options: AlertOptions) => Promise<boolean>;
  showConfirm: (options: AlertOptions) => Promise<boolean>;
  dismiss: () => void;
}

const AlertModalContext = createContext<AlertModalContextValue | undefined>(undefined);

const DEFAULT_OPTIONS: AlertOptions = {
  title: "",
  message: "",
  variant: "info",
  confirmLabel: "OK",
  cancelLabel: "Cancel",
  showCancel: false,
  showCloseIcon: false,
  dismissible: true,
};

const variantConfig: Record<
  AlertVariant,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    confirmVariant: "default" | "destructive" | "outline";
  }
> = {
  success: {
    icon: CheckCircle,
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
    confirmVariant: "default",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    confirmVariant: "default",
  },
  error: {
    icon: AlertCircle,
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
    confirmVariant: "destructive",
  },
  info: {
    icon: Info,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    confirmVariant: "default",
  },
};

function AlertModalOverlay({
  alert,
  onResolve,
  onReject,
}: {
  alert: AlertRequest | null;
  onResolve: (result: boolean) => void;
  onReject: (err: unknown) => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Hooks must be called unconditionally (before any early return)
  useEffect(() => {
    if (!alert) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && alert.dismissible && !isProcessing) onResolve(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [alert, onResolve, isProcessing]);

  if (!alert) return null;

  const variant = alert.variant ?? "info";
  const config = variantConfig[variant];
  const Icon = config.icon;
  const disabled = isProcessing;

  const handleBackdropClick = () => {
    if (alert.dismissible && !disabled) onResolve(false);
  };

  const handleConfirmClick = async () => {
    if (alert.onConfirm) {
      setIsProcessing(true);
      try {
        await alert.onConfirm();
        onResolve(true);
      } catch (err) {
        onReject(err);
      } finally {
        setIsProcessing(false);
      }
    } else {
      onResolve(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {alert.showCloseIcon && !disabled && (
          <button
            type="button"
            onClick={() => onResolve(false)}
            className="absolute top-4 right-4 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="flex flex-col items-center text-center">
          <div
            className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${config.iconBg} ${config.iconColor}`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <h3 id="alert-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {alert.title}
          </h3>
          {alert.content ? (
            <div className="mb-6 w-full text-left">{alert.content}</div>
          ) : alert.message ? (
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              {alert.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {alert.showCancel && (
            <Button
              variant="outline"
              onClick={() => onResolve(false)}
              disabled={disabled}
            >
              {alert.cancelLabel ?? "Cancel"}
            </Button>
          )}
          <Button
            variant={config.confirmVariant}
            onClick={handleConfirmClick}
            disabled={disabled}
          >
            {disabled ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {alert.confirmLabel ?? "OK"}
              </>
            ) : (
              alert.confirmLabel ?? "OK"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AlertModalProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<AlertRequest[]>([]);
  const [currentAlert, setCurrentAlert] = useState<AlertRequest | null>(null);

  useEffect(() => {
    if (!currentAlert && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrentAlert(next);
      setQueue(rest);
    }
  }, [queue, currentAlert]);

  const enqueueAlert = useCallback((options: AlertOptions) => {
    return new Promise<boolean>((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      setQueue((prev) => [...prev, { ...DEFAULT_OPTIONS, ...options, id, resolve, reject }]);
    });
  }, []);

  const showAlert = useCallback(
    (options: AlertOptions) => enqueueAlert({ ...options, showCancel: false }),
    [enqueueAlert]
  );

  const showConfirm = useCallback(
    (options: AlertOptions) =>
      enqueueAlert({
        ...options,
        showCancel: true,
        showCloseIcon: true,
        dismissible: false,
      }),
    [enqueueAlert]
  );

  const handleResolve = useCallback((result: boolean) => {
    setCurrentAlert((prev) => {
      if (prev) prev.resolve(result);
      return null;
    });
  }, []);

  const handleReject = useCallback((err: unknown) => {
    setCurrentAlert((prev) => {
      if (prev) prev.reject(err);
      return null;
    });
  }, []);

  const dismiss = useCallback(() => {
    handleResolve(false);
  }, [handleResolve]);

  const value = useMemo(
    () => ({ showAlert, showConfirm, dismiss }),
    [showAlert, showConfirm, dismiss]
  );

  return (
    <AlertModalContext.Provider value={value}>
      {children}
      <AlertModalOverlay
        alert={currentAlert}
        onResolve={handleResolve}
        onReject={handleReject}
      />
    </AlertModalContext.Provider>
  );
}

export function useAlertModal(): AlertModalContextValue {
  const context = useContext(AlertModalContext);
  if (!context) {
    throw new Error("useAlertModal must be used within an AlertModalProvider");
  }
  return context;
}

import { useEffect, useState } from "react";
import { CloseIcon, CheckCircleIcon, AlertIcon, InfoIcon } from "../../icons";

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertProps {
  type?: AlertType;
  message: string;
  onClose?: () => void;
  duration?: number;
  className?: string;
}

export default function Alert({
  type = "info",
  message,
  onClose,
  duration = 5000,
  className = "",
}: AlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) {
          setTimeout(onClose, 300); // Wait for fade out animation
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!isVisible) {
    return null;
  }

  const typeStyles = {
    success: {
      bg: "bg-success-50 dark:bg-success-900/20",
      border: "border-success-200 dark:border-success-800",
      text: "text-success-800 dark:text-success-200",
      icon: <CheckCircleIcon className="w-5 h-5 text-success-600 dark:text-success-400" />,
    },
    error: {
      bg: "bg-error-50 dark:bg-error-900/20",
      border: "border-error-200 dark:border-error-800",
      text: "text-error-800 dark:text-error-200",
      icon: <AlertIcon className="w-5 h-5 text-error-600 dark:text-error-400" />,
    },
    warning: {
      bg: "bg-warning-50 dark:bg-warning-900/20",
      border: "border-warning-200 dark:border-warning-800",
      text: "text-warning-800 dark:text-warning-200",
      icon: <AlertIcon className="w-5 h-5 text-warning-600 dark:text-warning-400" />,
    },
    info: {
      bg: "bg-brand-50 dark:bg-brand-900/20",
      border: "border-brand-200 dark:border-brand-800",
      text: "text-brand-800 dark:text-brand-200",
      icon: <InfoIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />,
    },
  };

  const styles = typeStyles[type];

  return (
    <div
      className={`transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      } ${className}`}
    >
      <div
        className={`${styles.bg} ${styles.border} border rounded-lg shadow-xl p-4 flex items-start gap-3 backdrop-blur-sm`}
      >
        <div className="flex-shrink-0">{styles.icon}</div>
        <div className="flex-1">
          <p className={`text-sm font-medium ${styles.text}`}>{message}</p>
        </div>
        {onClose && (
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className={`flex-shrink-0 ${styles.text} hover:opacity-70 transition-opacity`}
            aria-label="Close alert"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}


import { createContext, useContext, useState, ReactNode } from "react";
import Alert, { AlertType } from "../components/ui/Alert";

interface AlertContextType {
  showAlert: (type: AlertType, message: string, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Array<{ id: number; type: AlertType; message: string; duration?: number }>>([]);

  const showAlert = (type: AlertType, message: string, duration = 5000) => {
    const id = Date.now();
    setAlerts((prev) => [...prev, { id, type, message, duration }]);
  };

  const showSuccess = (message: string, duration?: number) => showAlert("success", message, duration);
  const showError = (message: string, duration?: number) => showAlert("error", message, duration);
  const showWarning = (message: string, duration?: number) => showAlert("warning", message, duration);
  const showInfo = (message: string, duration?: number) => showAlert("info", message, duration);

  const removeAlert = (id: number) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  return (
    <AlertContext.Provider value={{ showAlert, showSuccess, showError, showWarning, showInfo }}>
      {children}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[999999] space-y-2 w-full max-w-md px-4 pointer-events-none">
        {alerts.map((alert) => (
          <div key={alert.id} className="pointer-events-auto">
            <Alert
              type={alert.type}
              message={alert.message}
              duration={alert.duration}
              onClose={() => removeAlert(alert.id)}
            />
          </div>
        ))}
      </div>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within AlertProvider");
  }
  return context;
}










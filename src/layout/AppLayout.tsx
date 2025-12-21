import { useState, useEffect } from "react";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet, Navigate, useLocation } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import { useData } from "../context/DataContext";
import { hasPermission } from "../utils/permissions";
import DailyConfirmationModal from "../components/modals/DailyConfirmationModal";
import api from "../services/api";
import { getCookie, setCookie } from "../utils/cookies";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { currentUser, loading } = useData();
  const location = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    previousCashBalance: number;
    bankBalances: Array<{
      bankAccountId: string;
      bankName: string;
      accountNumber: string;
      balance: number;
    }>;
  } | null>(null);
  const [, setIsCheckingConfirmation] = useState(false);

  // Check authentication on mount - synchronous check
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("currentUser");
    
    if (!token || !storedUser) {
      // No token/user, clear everything immediately
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      setIsCheckingAuth(false);
    } else {
      // We have token, wait for currentUser to load from context
      setIsCheckingAuth(false);
    }
  }, []);

  // Check daily confirmation when user is loaded
  useEffect(() => {
    const checkDailyConfirmation = async () => {
      if (!currentUser || loading) return;

      // Check if user has sales, purchase, or expense permissions, or is admin/superadmin
      const hasRelevantPermission =
        currentUser.role === "admin" ||
        currentUser.role === "superadmin" ||
        (currentUser.permissions && (
          currentUser.permissions.some((p: string) => p.includes("sales")) ||
          currentUser.permissions.some((p: string) => p.includes("purchase")) ||
          currentUser.permissions.some((p: string) => p.includes("expense"))
        ));

      if (!hasRelevantPermission) return;

      // Get today's date in YYYY-MM-DD format
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      const cookieName = "daily_confirmation_date";
      
      // Check if already confirmed today (check cookie first)
      const confirmedDate = getCookie(cookieName);
      console.log("Daily Confirmation Check - Cookie date:", confirmedDate, "Today:", today);
      
      // Only skip API call if cookie date exactly matches today's date
      if (confirmedDate === today) {
        // Already confirmed today, skip API call
        console.log("Daily confirmation already done today (from cookie), skipping API call");
        setIsCheckingConfirmation(false);
        return;
      }
      
      // If cookie has old date (not today) or no cookie, proceed to check API
      // This ensures modal shows for new day even if old cookie exists
      if (confirmedDate && confirmedDate !== today) {
        console.log("Cookie has old date (" + confirmedDate + "), checking API for today (" + today + ")");
      } else {
        console.log("No cookie found, checking API for confirmation status");
      }

      setIsCheckingConfirmation(true);
      try {
        // API call to check if confirmation is needed
        const status = await api.checkDailyConfirmation();
        console.log("Daily confirmation status from API:", status);
        
        // If already confirmed, store in cookie and don't show modal
        if (status && status.confirmed) {
          setCookie(cookieName, today, 1); // Store for 1 day
          setIsCheckingConfirmation(false);
          return;
        }

        // If needs confirmation, show modal
        if (status && status.needsConfirmation) {
          console.log("Showing confirmation modal - needsConfirmation is true");
          setConfirmationData({
            previousCashBalance: status.previousCashBalance || 0,
            bankBalances: status.bankBalances || [],
          });
          setShowConfirmationModal(true);
        } else if (status && !status.confirmed) {
          // If status exists but not confirmed, show modal (this handles edge cases)
          console.log("Showing confirmation modal - status exists but not confirmed");
          setConfirmationData({
            previousCashBalance: status.previousCashBalance || 0,
            bankBalances: status.bankBalances || [],
          });
          setShowConfirmationModal(true);
        } else {
          // If status is not clear, check if today's opening balance exists
          let todayBalance = null;
          try {
            todayBalance = await api.getOpeningBalance(today);
          } catch (e) {
            // If error, assume no balance exists
            todayBalance = null;
          }

          // If no opening balance for today and not confirmed, show modal for first time setup
          if (!todayBalance && (!status || !status.confirmed)) {
            console.log("Showing confirmation modal - no opening balance and not confirmed");
            setConfirmationData({
              previousCashBalance: status?.previousCashBalance || 0,
              bankBalances: status?.bankBalances || [],
            });
            setShowConfirmationModal(true);
          } else if (status && status.confirmed) {
            // If confirmed, store in cookie
            console.log("Already confirmed, storing cookie");
            setCookie(cookieName, today, 1);
          }
        }
      } catch (error) {
        console.error("Error checking daily confirmation:", error);
        // On error, don't show modal - let user proceed
      } finally {
        setIsCheckingConfirmation(false);
      }
    };

    checkDailyConfirmation();
  }, [currentUser, loading]);

  // Show loading while checking auth OR while loading user data (but only if we have a token)
  const token = localStorage.getItem("authToken");
  const hasToken = !!token;
  
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-brand-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If we have a token but user is still loading, show loading (prevent flash)
  if (hasToken && loading && !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-brand-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If no token or no currentUser after loading, redirect
  if (!hasToken || !currentUser) {
    // Clear invalid data
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    return <Navigate to="/login" replace />;
  }

  // Check permissions
  if (!hasPermission(currentUser.role, location.pathname, currentUser.permissions)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  const handleConfirmationClose = () => {
    setShowConfirmationModal(false);
    setConfirmationData(null);
  };

  return (
    <>
      <div className={`min-h-screen flex flex-col lg:flex-row ${showConfirmationModal ? "pointer-events-none opacity-50" : ""}`}>
        <div className="flex-shrink-0">
          <AppSidebar />
          <Backdrop />
        </div>
        <div
          className={`flex-1 transition-all duration-300 ease-in-out ${
            isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
          } ${isMobileOpen ? "ml-0" : ""}`}
        >
          <AppHeader />
          <div className="p-2 sm:p-4 md:p-6 mx-auto max-w-full xl:max-w-[1536px] 2xl:max-w-[1920px]">
            <Outlet />
          </div>
        </div>
      </div>

      {showConfirmationModal && confirmationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <DailyConfirmationModal
            isOpen={showConfirmationModal}
            onConfirm={handleConfirmationClose}
            previousCashBalance={confirmationData.previousCashBalance}
            bankBalances={confirmationData.bankBalances}
          />
        </div>
      )}
    </>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;

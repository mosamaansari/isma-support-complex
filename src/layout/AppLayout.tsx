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
import { getCookie } from "../utils/cookies";

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

  // Check daily confirmation when user is loaded and periodically at 12 PM
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

      // Don't check if modal is already shown
      if (showConfirmationModal) return;

      // Get today's date in YYYY-MM-DD format (using Pakistan timezone)
      const now = new Date();
      const pakistanTime = new Date();
      console.log("Local time:", now.toString()); 
      const year = pakistanTime.getFullYear();
      const month = String(pakistanTime.getMonth() + 1).padStart(2, '0');
      const day = String(pakistanTime.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      const cookieName = "daily_confirmation_date";
      
      // Check cookie first - if today's date is not in cookie, we need to check backend
      const confirmedDate = getCookie(cookieName);
      console.log("Daily Confirmation Check - Cookie date:", confirmedDate, "Today:", today);
      
      // If cookie has today's date, user has already confirmed (skip API call for optimization)
      if (confirmedDate === today) {
        console.log("Daily confirmation already done today (from cookie), skipping API call");
        setIsCheckingConfirmation(false);
        return;
      }
      
      // Cookie doesn't have today's date - check backend to see if user has confirmed
      // This handles cases where cookie was cleared or it's a new day
      if (confirmedDate && confirmedDate !== today) {
        console.log("Cookie has old date (" + confirmedDate + "), checking backend for today (" + today + ")");
      } else {
        console.log("No cookie found or date mismatch, checking backend for confirmation status");
      }

      setIsCheckingConfirmation(true);
      try {
        // Check backend to see if THIS user has confirmed today
        const status = await api.checkDailyConfirmation();
        console.log("Daily confirmation status from backend:", status);
        
        // Backend is authoritative - if user has already confirmed, don't show modal
        if (status && status.confirmed) {
          console.log("User has already confirmed today (backend check), not showing modal");
          setIsCheckingConfirmation(false);
          return;
        }

        // Backend says user hasn't confirmed - show modal
        if (status && status.needsConfirmation) {
          console.log("Showing confirmation modal - user needs to confirm (backend: needsConfirmation=true)");
          setConfirmationData({
            previousCashBalance: status.previousCashBalance || 0,
            bankBalances: status.bankBalances || [],
          });
          setShowConfirmationModal(true);
        } else if (status && !status.confirmed) {
          // If status exists but not confirmed, show modal
          console.log("Showing confirmation modal - user has not confirmed (backend: confirmed=false)");
          setConfirmationData({
            previousCashBalance: status.previousCashBalance || 0,
            bankBalances: status.bankBalances || [],
          });
          setShowConfirmationModal(true);
        } else {
          // If status is unclear, assume confirmation is needed and show modal
          console.log("Showing confirmation modal - status unclear, assuming confirmation needed");
          setConfirmationData({
            previousCashBalance: status?.previousCashBalance || 0,
            bankBalances: status?.bankBalances || [],
          });
          setShowConfirmationModal(true);
        }
      } catch (error) {
        console.error("Error checking daily confirmation:", error);
        // On error, don't show modal - let user proceed to avoid blocking access
      } finally {
        setIsCheckingConfirmation(false);
      }
    };

    // Check immediately on mount or when user loads
    checkDailyConfirmation();

    // Set up periodic check every minute to catch when it becomes 12 PM
    const intervalId = setInterval(() => {
      checkDailyConfirmation();
    }, 60000); // Check every minute (60000ms)

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

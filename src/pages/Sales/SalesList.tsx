import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Label from "../../components/form/Label";
import { Modal } from "../../components/ui/modal";
import { useModal } from "../../hooks/useModal";
import Pagination from "../../components/ui/Pagination";
import PageSizeSelector from "../../components/ui/PageSizeSelector";
import DatePicker from "../../components/form/DatePicker";
import { DownloadIcon, PencilIcon } from "../../icons";
import { FaEye, FaCreditCard, FaListAlt, FaUndo } from "react-icons/fa";
import { SalePayment } from "../../types";
import { extractErrorMessage } from "../../utils/errorHandler";
import { getTodayDate, formatBackendDate, formatBackendDateShort } from "../../utils/dateHelpers";
import { formatPriceWithCurrencyComplete } from "../../utils/priceHelpers";
import { hasResourcePermission } from "../../utils/permissions";
import { api } from "../../services/api";

export default function SalesList() {
  const { sales, salesPagination, cancelSale, addPaymentToSale, currentUser, bankAccounts, refreshBankAccounts, refreshSales, loading } = useData();
  const { showSuccess, showError } = useAlert();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending" | "cancelled">("all");
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Initial load effect - runs only once on component mount
  useEffect(() => {
    if (!initialLoadDone && !loading) {
      console.log("SalesList - Initial load");
      refreshSales(1, 10, { search: "", status: "all" }).then(() => {
        setInitialLoadDone(true);
      }).catch(err => {
        console.error("SalesList - Error in initial load:", err);
        setInitialLoadDone(true);
      });
    }
  }, [initialLoadDone, loading]);

  // Memoized refresh function to prevent unnecessary re-renders
  const refreshCurrentSales = useCallback(async () => {
    return await refreshSales(salesPagination?.page || 1, salesPagination?.pageSize || 10, { search: searchTerm, status: filterStatus });
  }, [refreshSales, salesPagination?.page, salesPagination?.pageSize, searchTerm, filterStatus]);

  // Handle search and filter changes with debouncing
  useEffect(() => {
    if (!initialLoadDone) return; // Don't run until initial load is done

    const delayedSearch = setTimeout(() => {
      console.log("SalesList - Applying filters:", { searchTerm, filterStatus, currentPage: salesPagination?.page });

      // We always want to go to page 1 when search or status filters change
      // But we should avoid redundant calls if we are already on page 1 and nothing changed
      // The refreshSales function in DataContext is now stable, so this effect won't re-run 
      // unnecessarily when salesPagination updates.
      refreshSales(1, salesPagination?.pageSize || 10, { search: searchTerm, status: filterStatus });
    }, 300); // 300ms debounce

    return () => clearTimeout(delayedSearch);
  }, [searchTerm, filterStatus, initialLoadDone, refreshSales]); // Removed salesPagination dependencies to prevent infinite loops or redundant resets

  const handlePageChange = (page: number) => {
    if (page === salesPagination.page) return;
    console.log("SalesList - Changing to page:", page);
    refreshSales(page, salesPagination?.pageSize || 10, { search: searchTerm, status: filterStatus });
  };

  const handlePageSizeChange = (pageSize: number) => {
    refreshSales(1, pageSize, { search: searchTerm, status: filterStatus });
  };
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const { isOpen: isPaymentModalOpen, openModal: openPaymentModal, closeModal: closePaymentModal } = useModal();
  const { isOpen: isViewPaymentsModalOpen, openModal: openViewPaymentsModal, closeModal: closeViewPaymentsModal } = useModal();
  const [paymentData, setPaymentData] = useState<SalePayment & { date?: string }>({
    type: "cash",
    amount: 0,
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const bankAccountsLoadedRef = useRef(false);

  // Load bank accounts only once on mount to prevent duplicate API calls
  useEffect(() => {
    if (!bankAccountsLoadedRef.current && bankAccounts.length === 0) {
      bankAccountsLoadedRef.current = true;
      refreshBankAccounts().catch(console.error);
    } else if (bankAccounts.length > 0) {
      bankAccountsLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Since we're now using backend filtering, just use the sales data as is
  const filteredSales = sales || [];

  // Get summary statistics from backend API data
  const summaryStats = (salesPagination as any)?.summary || {
    totalSales: 0,
    totalPaid: 0,
    totalRemaining: 0,
    totalRefunded: 0, // Count of refunded sales, not amount
    completedSales: 0,
  };

  const { totalSales, totalPaid, totalRemaining, totalRefunded, completedSales } = summaryStats;

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<any>(null);
  const [refundMethod, setRefundMethod] = useState<"cash" | "bank_transfer">("cash");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [bankBalance, setBankBalance] = useState<number | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  const handleCancelSaleClick = (sale: any) => {
    setSaleToCancel(sale);
    setRefundMethod("cash");
    setSelectedBankAccountId("");
    setBankBalance(null);
    setCancelModalOpen(true);
  };

  const checkBankBalance = async (bankAccountId: string) => {
    if (!bankAccountId || !saleToCancel) return;

    setCheckingBalance(true);
    try {
      const payments = (saleToCancel.payments || []) as SalePayment[];
      const validPayments = payments.filter((p: SalePayment) =>
        p?.amount !== undefined &&
        p?.amount !== null &&
        !isNaN(Number(p.amount)) &&
        Number(p.amount) > 0
      );
      const totalPaid = validPayments.reduce((sum: number, p: SalePayment) => sum + (p?.amount || 0), 0);

      const response = await api.getCurrentBankBalance(bankAccountId);
      const balance = response.balance || 0;
      setBankBalance(balance);

      if (balance < totalPaid) {
        showError(`Insufficient bank balance. Available: Rs. ${balance.toFixed(2)}, Required: Rs. ${totalPaid.toFixed(2)}`);
        return false;
      }
      return true;
    } catch (error: any) {
      showError(extractErrorMessage(error) || "Failed to check bank balance");
      return false;
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleRefundMethodChange = async (method: "cash" | "bank_transfer") => {
    setRefundMethod(method);
    setSelectedBankAccountId("");
    setBankBalance(null);
    if (method === "bank_transfer" && bankAccounts && bankAccounts.length > 0) {
      const firstBankId = bankAccounts[0].id;
      setSelectedBankAccountId(firstBankId);
      // Auto-check balance when bank is selected
      if (firstBankId && saleToCancel) {
        await checkBankBalance(firstBankId);
      }
    }
  };

  const handleBankAccountChange = async (bankAccountId: string) => {
    setSelectedBankAccountId(bankAccountId);
    setBankBalance(null);
    if (bankAccountId) {
      await checkBankBalance(bankAccountId);
    }
  };

  const confirmCancelSale = async () => {
    if (!saleToCancel) return;

    // If bank transfer, check balance first
    if (refundMethod === "bank_transfer") {
      if (!selectedBankAccountId) {
        showError("Please select a bank account");
        return;
      }
      const hasBalance = await checkBankBalance(selectedBankAccountId);
      if (!hasBalance) {
        return;
      }
    }

    try {
      const refundData = {
        refundMethod,
        ...(refundMethod === "bank_transfer" && selectedBankAccountId ? { bankAccountId: selectedBankAccountId } : {}),
      };
      await cancelSale(saleToCancel.id, refundData);
      showSuccess(`Sale cancelled successfully! Refund processed via ${refundMethod === "cash" ? "cash" : "bank transfer"}.`);
      refreshCurrentSales();
      setCancelModalOpen(false);
      setSaleToCancel(null);
      setRefundMethod("cash");
      setSelectedBankAccountId("");
      setBankBalance(null);
    } catch (error: any) {
      showError(extractErrorMessage(error) || "Failed to cancel sale. Please try again.");
    }
  };

  // Reprint handled via view bill (download button removed)

  const handleAddPayment = (sale: any) => {
    setSelectedSale(sale);
    setPaymentData({
      type: "cash",
      amount: 0,
      date: getTodayDate(), // Today's date (YYYY-MM-DD format)
    });
    openPaymentModal();
  };

  const handleViewPayments = (sale: any) => {
    setSelectedSale(sale);
    openViewPaymentsModal();
  };

  const handlePrintPayment = (billNumber: string, paymentIndex: number) => {
    window.open(`/sales/payment/${billNumber}/${paymentIndex}`, "_blank");
  };

  const handlePrintAllPayments = (billNumber: string) => {
    window.open(`/sales/payments/${billNumber}`, "_blank");
  };

  const handleSubmitPayment = async () => {
    if (!selectedSale) return;

    if (paymentData.amount === undefined || paymentData.amount === null || paymentData.amount < 0) {
      showError("Payment amount cannot be negative");
      return;
    }

    const remainingBalance = selectedSale.remainingBalance || (selectedSale.total - (selectedSale.payments?.reduce((sum: number, p: SalePayment) => sum + (p.amount || 0), 0) || 0));

    if (paymentData.amount > remainingBalance) {
      showError(`Payment amount cannot exceed remaining balance of Rs. ${remainingBalance.toFixed(2)}`);
      return;
    }

    if (paymentData.type === "bank_transfer" && !paymentData.bankAccountId) {
      showError("Please select a bank account for bank transfer payment");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      // Always use current date and time for payment
      const paymentPayload = {
        ...paymentData,
        date: new Date().toISOString() // Current date and time
      };
      await addPaymentToSale(selectedSale.id, paymentPayload);
      await refreshCurrentSales();
      closePaymentModal();
      setSelectedSale(null);
      setPaymentData({ type: "cash", amount: 0, date: getTodayDate(), bankAccountId: undefined });
      showSuccess("Payment added successfully!");
    } catch (err: any) {
      showError(extractErrorMessage(err) || "Failed to add payment");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
        </div>
      </div>
    );
  }

  if (loading && (!sales || sales.length === 0)) {
    return (
      <>
        <PageMeta title="Sales List | Isma Sports Complex" description="View all sales and bills" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading sales...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title="Sales List | Isma Sports Complex"
        description="View all sales and bills"
      />
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            Sales List
          </h1>
          {hasResourcePermission(currentUser.role, 'sales:create', currentUser.permissions) && (
            <Link to="/sales/entry" className="w-full sm:w-auto">
              <Button size="sm" className="w-full sm:w-auto">New Sale</Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 dark:text-white price-responsive">
              {formatPriceWithCurrencyComplete(totalSales)}
            </p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Paid</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 dark:text-green-400 price-responsive">
              {formatPriceWithCurrencyComplete(totalPaid)}
            </p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Remaining</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600 dark:text-orange-400 price-responsive">
              {formatPriceWithCurrencyComplete(totalRemaining)}
            </p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Refunded</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 dark:text-red-400">
              {totalRefunded}
            </p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Completed Sales</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400 price-responsive">
              {formatPriceWithCurrencyComplete(completedSales)}
            </p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Bills</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 dark:text-white">
              {filteredSales.length}
            </p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Completed</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 dark:text-green-400">
              {filteredSales.filter((s) => s && s.status === "completed").length}
            </p>
          </div>
          <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Pending</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600 dark:text-orange-400">
              {filteredSales.filter((s) => s && s.status === "pending").length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by bill number, customer name or phone..."
          />
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as "all" | "completed" | "pending" | "cancelled")
            }
            className="px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="p-8 text-center text-gray-500">
          Loading sales...
        </div>
      )}

      {!loading && (!sales || sales.length === 0) && (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow-sm dark:bg-gray-800">
          <p className="mb-4">No sales found. Create your first sale!</p>
          <Link to="/sales/entry">
            <Button size="sm">Create Sale</Button>
          </Link>
        </div>
      )}

      {!loading && sales && sales.length > 0 && (
        <div className="table-container bg-white rounded-lg shadow-sm dark:bg-gray-800">
          <table className="responsive-table">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-2 sm:p-3 md:p-4 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                  Bill Number
                </th>
                <th className="p-2 sm:p-3 md:p-4 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[120px]">
                  Date
                </th>
                <th className="p-2 sm:p-3 md:p-4 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[150px]">
                  Customer
                </th>
                <th className="p-2 sm:p-3 md:p-4 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[80px]">
                  Items
                </th>
                <th className="p-2 sm:p-3 md:p-4 text-right text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                  Total
                </th>
                <th className="p-2 sm:p-3 md:p-4 text-right text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                  Paid
                </th>
                <th className="p-2 sm:p-3 md:p-4 text-right text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[110px]">
                  Remaining
                </th>
                <th className="p-2 sm:p-3 md:p-4 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[90px]">
                  Status
                </th>
                <th className="p-2 sm:p-3 md:p-4 text-center text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[140px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-4 sm:p-6 md:p-8 text-center text-gray-500 text-sm sm:text-base">
                    No sales found
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  if (!sale || !sale.billNumber) return null;

                  // Filter out payments with invalid amounts (0, null, undefined, NaN) before calculating totalPaid
                  const validPayments = (sale.payments || []).filter((p: SalePayment) =>
                    p?.amount !== undefined &&
                    p?.amount !== null &&
                    !isNaN(Number(p.amount)) &&
                    Number(p.amount) > 0
                  );
                  const totalPaid = validPayments.reduce((sum: number, p: SalePayment) => sum + (p?.amount || 0), 0);
                  const remainingBalance = Math.max(0, (sale.total || 0) - totalPaid);

                  return (
                    <tr
                      key={sale.id}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="p-2 sm:p-3 md:p-4 font-medium text-gray-800 dark:text-white whitespace-nowrap text-xs sm:text-sm">
                        {sale.billNumber}
                      </td>
                      <td className="p-2 sm:p-3 md:p-4 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs sm:text-sm">
                        <span className="hidden sm:inline">
                          {formatBackendDate(sale.createdAt)}
                        </span>
                        <span className="sm:hidden">
                          {formatBackendDateShort(sale.date || sale.createdAt)}
                        </span>
                      </td>
                      <td className="p-2 sm:p-3 md:p-4 text-gray-700 dark:text-gray-300 max-w-[150px] sm:max-w-[200px]">
                        <div className="line-clamp-2 sm:line-clamp-3">
                          <div className="font-medium text-xs sm:text-sm">{sale.customerName || "Walk-in"}</div>
                          {sale.customerPhone && sale.customerPhone !== "0000000000" && sale.customerPhone.trim() !== "" && (
                            <div className="text-xs text-gray-500 mt-1">{sale.customerPhone}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-2 sm:p-3 md:p-4 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs sm:text-sm">
                        {(sale.items || []).length} item(s)
                      </td>
                      <td className="p-2 sm:p-3 md:p-4 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap price-responsive">
                        Rs. {(sale.total || 0).toFixed(2)}
                      </td>
                      <td className="p-2 sm:p-3 md:p-4 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap price-responsive">
                        Rs. {totalPaid.toFixed(2)}
                      </td>
                      <td className="p-2 sm:p-3 md:p-4 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap price-responsive">
                        {remainingBalance > 0 ? (
                          <span className="text-orange-600 dark:text-orange-400">
                            Rs. {remainingBalance.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">Rs. 0.00</span>
                        )}
                      </td>
                      <td className="p-2 sm:p-3 md:p-4 whitespace-nowrap">
                        <span
                          className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded ${sale.status === "completed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : sale.status === "pending"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                            }`}
                        >
                          {sale.status || "completed"}
                        </span>
                      </td>
                      <td className="p-2 sm:p-3 md:p-4">
                        <div className="flex items-center justify-center gap-1 sm:gap-2 flex-nowrap whitespace-nowrap">
                          {/* View Bill Button */}
                          <Link to={`/sales/bill/${sale.billNumber}`}>
                            <button
                              className="p-1.5 sm:p-2 text-gray-600 hover:bg-gray-50 rounded dark:hover:bg-gray-900/20 border border-gray-300 dark:border-gray-600 flex-shrink-0"
                              title="View Bill"
                            >
                              <FaEye className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                            </button>
                          </Link>
                          {/* View Payments Button */}
                          {sale.payments && sale.payments.length > 0 && (
                            <button
                              onClick={() => handleViewPayments(sale)}
                              className="p-1.5 sm:p-2 text-indigo-500 hover:bg-indigo-50 rounded dark:hover:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 flex-shrink-0"
                              title="View Payments"
                            >
                              <FaListAlt className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          )}

                          {/* Add Payment Button */}
                          {hasResourcePermission(currentUser.role, 'sales:add_payment', currentUser.permissions) && sale.status === "pending" && remainingBalance > 0 && (
                            <button
                              onClick={() => handleAddPayment(sale)}
                              className="p-1.5 sm:p-2 text-green-500 hover:bg-green-50 rounded dark:hover:bg-green-900/20 border border-green-200 dark:border-green-800 flex-shrink-0"
                              title="Add Payment"
                            >
                              <FaCreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          )}
                          {/* Edit Sale Button */}
                          {hasResourcePermission(currentUser.role, 'sales:update', currentUser.permissions) && (
                            sale.status === "pending" ? (
                              <Link to={`/sales/edit/${sale.id}`}>
                                <button
                                  className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20 flex-shrink-0"
                                  title="Edit Sale"
                                >
                                  <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                                </button>
                              </Link>
                            ) : (
                              <button
                                disabled
                                className="p-1.5 sm:p-2 text-gray-400 cursor-not-allowed rounded dark:bg-gray-900/20 flex-shrink-0 opacity-50"
                                title={sale.status === "completed" ? "Completed sales cannot be edited" : "Cancelled sales cannot be edited"}
                              >
                                <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                              </button>
                            )
                          )}
                          {/* Cancel Sale Button */}
                          {hasResourcePermission(currentUser.role, 'sales:cancel', currentUser.permissions) && sale.status !== "cancelled" && (
                            <button
                              onClick={() => handleCancelSaleClick(sale)}
                              className="p-1.5 sm:p-2 text-orange-600 hover:bg-orange-50 rounded dark:hover:bg-orange-900/20 border border-orange-200 dark:border-orange-800 flex-shrink-0"
                              title="Refund Sale"
                            >
                              <FaUndo className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }).filter(Boolean)
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={closePaymentModal} className="max-w-md m-4">
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
            Add Payment
          </h2>
          {selectedSale && (
            <div className="mb-4 p-3 bg-gray-50 rounded dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-400">Bill Number: <span className="font-semibold">{selectedSale.billNumber}</span></p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total: <span className="font-semibold">Rs. {selectedSale.total.toFixed(2)}</span></p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Remaining: <span className="font-semibold text-orange-600 dark:text-orange-400">
                  Rs. {(() => {
                    // Filter out payments with invalid amounts (0, null, undefined, NaN)
                    const validPaymentsForRemaining = (selectedSale.payments || []).filter((p: SalePayment) =>
                      p?.amount !== undefined &&
                      p?.amount !== null &&
                      !isNaN(Number(p.amount)) &&
                      Number(p.amount) > 0
                    );
                    const totalPaidForRemaining = validPaymentsForRemaining.reduce((sum: number, p: SalePayment) => sum + (p.amount || 0), 0);
                    return Math.max(0, selectedSale.total - totalPaidForRemaining).toFixed(2);
                  })()}
                </span>
              </p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label>Payment Type</Label>
              <Select
                value={paymentData.type}
                onChange={(value) => setPaymentData({ ...paymentData, type: value as SalePayment["type"], bankAccountId: undefined })}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "bank_transfer", label: "Bank Transfer" },
                ]}
              />
            </div>
            {paymentData.type === "bank_transfer" && (
              <div>
                <Label>Select Bank Account</Label>
                <Select
                  value={paymentData.bankAccountId || ""}
                  onChange={(value) => setPaymentData({ ...paymentData, bankAccountId: value })}
                  options={[

                    ...(bankAccounts || []).filter((acc) => acc.isActive).map((acc) => ({
                      value: acc.id,
                      label: `${acc.accountName} - ${acc.bankName}${acc.isDefault ? " (Default)" : ""}`,
                    })),
                  ]}
                />
              </div>
            )}
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step={0.01}
                value={(paymentData.amount !== null && paymentData.amount !== undefined && paymentData.amount !== 0) ? String(paymentData.amount) : ""}
                onChange={(e) => {
                  const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                  setPaymentData({ ...paymentData, amount: (isNaN(value as any) || value === null || value === undefined) ? 0 : value });
                }}
                placeholder="Enter payment amount"
              />
            </div>
            <div>
              <Label>Date</Label>
              <DatePicker
                value={paymentData.date || getTodayDate()}
                onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                disabled={true}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" size="sm" onClick={closePaymentModal} className="flex-1">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitPayment}
              className="flex-1"
              loading={isSubmittingPayment}
              disabled={isSubmittingPayment || !paymentData.amount || paymentData.amount <= 0 || (paymentData.type === "bank_transfer" && !paymentData.bankAccountId)}
            >
              Add Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Payments Modal */}
      <Modal isOpen={isViewPaymentsModalOpen} onClose={closeViewPaymentsModal} className="max-w-3xl m-4">
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
            Payments - Bill #{selectedSale?.billNumber}
          </h2>
          {selectedSale && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded dark:bg-gray-900">
                <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Bill Total:</p>
                    <p className="font-semibold text-gray-800 dark:text-white">Rs. {selectedSale.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Remaining Balance:</p>
                    <p className={`font-semibold ${(selectedSale.remainingBalance || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      Rs. {(selectedSale.remainingBalance || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Total Payments: <span className="font-semibold">{(selectedSale.payments || []).length}</span> |
                    Total Paid: <span className="font-semibold">Rs. {(() => {
                      // Filter out payments with invalid amounts (0, null, undefined, NaN)
                      const validPayments = (selectedSale.payments || []).filter((p: SalePayment) =>
                        p?.amount !== undefined &&
                        p?.amount !== null &&
                        !isNaN(Number(p.amount)) &&
                        Number(p.amount) > 0
                      );
                      return validPayments.reduce((sum: number, p: SalePayment) => sum + (p?.amount || 0), 0).toFixed(2);
                    })()}</span>
                  </p>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="p-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">#</th>
                      <th className="p-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Date & Time</th>
                      <th className="p-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Type</th>
                      <th className="p-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                      <th className="p-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedSale.payments || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-500">
                          No payments found
                        </td>
                      </tr>
                    ) : (
                      [...(selectedSale.payments || [])]
                        .sort((a, b) => {
                          // Sort by date (oldest first)
                          const dateA = a.date ? new Date(a.date).getTime() : 0;
                          const dateB = b.date ? new Date(b.date).getTime() : 0;
                          return dateA - dateB;
                        })
                        .map((payment: SalePayment & { date?: string }, index: number) => {
                          return (
                            <tr key={index} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="p-3 text-gray-700 dark:text-gray-300 font-medium">{index + 1}</td>
                              <td className="p-3 text-gray-700 dark:text-gray-300">
                                <span className="font-medium">
                                  {(() => {
                                    // Show date/time exactly as it comes from backend without UTC conversion
                                    const dateToShow = payment.date || selectedSale.date || selectedSale.createdAt;

                                    if (!dateToShow) return "";

                                    // Parse date string directly to extract components without UTC conversion
                                    // Handle both ISO format (2026-01-24T04:36:52.331Z) and other formats
                                    let year: string, month: string, day: string, hours: string, minutes: string, seconds: string;

                                    if (typeof dateToShow === 'string') {
                                      // Extract date and time from ISO string directly
                                      // Format: "2026-01-24T04:36:52.331Z" or "2026-01-24T04:36:52.331"
                                      const dateTimeMatch = dateToShow.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                                      if (dateTimeMatch) {
                                        year = dateTimeMatch[1];
                                        month = dateTimeMatch[2];
                                        day = dateTimeMatch[3];
                                        hours = dateTimeMatch[4];
                                        minutes = dateTimeMatch[5];
                                        seconds = dateTimeMatch[6];

                                        // Format time in 12-hour format
                                        const hoursNum = parseInt(hours, 10);
                                        const isPM = hoursNum >= 12;
                                        const displayHours = hoursNum === 0 ? 12 : hoursNum > 12 ? hoursNum - 12 : hoursNum;
                                        const hoursStr = String(displayHours).padStart(2, "0");
                                        const ampm = isPM ? "PM" : "AM";

                                        // Show date and time: MM/DD/YYYY HH:MM:SS AM/PM
                                        return `${month}/${day}/${year} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
                                      } else {
                                        // Fallback: use formatBackendDate for date-only
                                        return formatBackendDate(dateToShow);
                                      }
                                    } else if (dateToShow instanceof Date) {
                                      // If it's already a Date object, extract local components
                                      year = String(dateToShow.getFullYear());
                                      month = String(dateToShow.getMonth() + 1).padStart(2, "0");
                                      day = String(dateToShow.getDate()).padStart(2, "0");
                                      hours = String(dateToShow.getHours()).padStart(2, "0");
                                      minutes = String(dateToShow.getMinutes()).padStart(2, "0");
                                      seconds = String(dateToShow.getSeconds()).padStart(2, "0");

                                      // Format time in 12-hour format
                                      const hoursNum = parseInt(hours, 10);
                                      const isPM = hoursNum >= 12;
                                      const displayHours = hoursNum === 0 ? 12 : hoursNum > 12 ? hoursNum - 12 : hoursNum;
                                      const hoursStr = String(displayHours).padStart(2, "0");
                                      const ampm = isPM ? "PM" : "AM";

                                      return `${month}/${day}/${year} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
                                    } else {
                                      return formatBackendDate(dateToShow);
                                    }
                                  })()}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 uppercase">
                                  {payment.type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="p-3 text-right font-semibold text-gray-800 dark:text-white">
                                Rs. {(payment.amount || 0).toFixed(2)}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handlePrintPayment(selectedSale.billNumber, index)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                    title="Print Payment Receipt"
                                  >
                                    <DownloadIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <td colSpan={3} className="p-3 text-right font-semibold text-gray-800 dark:text-white">
                        Total Paid:
                      </td>
                      <td className="p-3 text-right font-bold text-lg text-gray-800 dark:text-white">
                        Rs. {(() => {
                          // Filter out payments with invalid amounts (0, null, undefined, NaN)
                          const validPaymentsForTotal = (selectedSale.payments || []).filter((p: SalePayment) =>
                            p?.amount !== undefined &&
                            p?.amount !== null &&
                            !isNaN(Number(p.amount)) &&
                            Number(p.amount) > 0
                          );
                          return validPaymentsForTotal.reduce((sum: number, p: SalePayment) => sum + (p?.amount || 0), 0).toFixed(2);
                        })()}
                      </td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  💡 Tip: Click the print icon next to each payment to print individual receipts, or use "Print All Payments" to get a combined receipt.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handlePrintAllPayments(selectedSale.billNumber)}
                    size="sm"
                    className="flex-1"
                  >
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    Print All Payments (Combined)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeViewPaymentsModal}
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Pagination Controls */}
      <div className="mt-4 sm:mt-6 flex flex-col gap-3 sm:gap-4 bg-white rounded-lg shadow-sm p-3 sm:p-4 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <PageSizeSelector
            pageSize={salesPagination?.pageSize || 10}
            onPageSizeChange={handlePageSizeChange}
          />
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Showing {((salesPagination.page - 1) * salesPagination.pageSize) + 1} to{" "}
            {Math.min(salesPagination.page * salesPagination.pageSize, salesPagination.total)} of{" "}
            {salesPagination.total} sales
          </span>
        </div>
        <div className="flex justify-center">
          <Pagination
            currentPage={salesPagination?.page || 1}
            totalPages={salesPagination?.totalPages || 1}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Cancel Sale Confirmation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setSaleToCancel(null);
          setRefundMethod("cash");
          setSelectedBankAccountId("");
          setBankBalance(null);
        }}
        className="max-w-md mx-4"
        showCloseButton={true}
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full dark:bg-orange-900/20">
              <FaUndo className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Refund Sale
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This action cannot be undone
              </p>
            </div>
          </div>

          {saleToCancel && (() => {
            const payments = (saleToCancel.payments || []) as SalePayment[];
            // Filter out payments with invalid amounts (0, null, undefined, NaN)
            const validPaymentsForCancel = payments.filter((p: SalePayment) =>
              p?.amount !== undefined &&
              p?.amount !== null &&
              !isNaN(Number(p.amount)) &&
              Number(p.amount) > 0
            );
            const totalPaid = validPaymentsForCancel.reduce((sum: number, p: SalePayment) => sum + (p?.amount || 0), 0);
            const saleCreatedAt = new Date(saleToCancel.createdAt);
            const today = new Date();
            const daysDifference = Math.floor((today.getTime() - saleCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
            const canReturn = daysDifference <= 7;

            return (
              <>
                <p className="mb-4 text-gray-700 dark:text-gray-300">
                  Are you sure you want to cancel this sale? This will restore product stock. This action cannot be undone.
                </p>

                {!canReturn && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      ⚠️ This sale is more than 7 days old. Returns are only allowed within 7 days of the sale date.
                    </p>
                  </div>
                )}

                {totalPaid > 0 && canReturn && (
                  <div className="mb-6 space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                      <p className="text-sm font-medium text-gray-800 dark:text-white mb-2">
                        Refund Amount: Rs. {totalPaid.toFixed(2)}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label>Refund Method *</Label>
                        <Select
                          value={refundMethod}
                          onChange={(value) => handleRefundMethodChange(value as "cash" | "bank_transfer")}
                          options={[
                            { value: "cash", label: "Cash" },
                            { value: "bank_transfer", label: "Bank Transfer" },
                          ]}
                          className="w-full"
                        />
                      </div>

                      {refundMethod === "bank_transfer" && (
                        <div className="space-y-3">
                          <div>
                            <Label>Select Bank Account *</Label>
                            <Select
                              value={selectedBankAccountId}
                              onChange={(value) => handleBankAccountChange(value)}
                              options={[

                                ...((bankAccounts || []).map((bank) => ({
                                  value: bank.id,
                                  label: `${bank.bankName} - ${bank.accountNumber}`,
                                }))),
                              ]}
                              className="w-full"
                            />
                          </div>

                          {selectedBankAccountId && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                              {checkingBalance ? (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Checking balance...</p>
                              ) : bankBalance !== null ? (
                                <>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Available Balance:</p>
                                  <p className={`text-sm font-semibold ${bankBalance >= totalPaid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    Rs. {bankBalance.toFixed(2)}
                                  </p>
                                  {bankBalance < totalPaid && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                      Insufficient balance. Required: Rs. {totalPaid.toFixed(2)}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Select a bank account to check balance</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCancelModalOpen(false);
                      setSaleToCancel(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={confirmCancelSale}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    disabled={!canReturn || (refundMethod === "bank_transfer" && (!selectedBankAccountId || (bankBalance !== null && bankBalance < totalPaid)))}
                  >
                    Cancel Sale
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      </Modal>
    </>
  );
}

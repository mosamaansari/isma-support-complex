import { useState, useEffect } from "react";
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
import {TrashBinIcon, DownloadIcon } from "../../icons";
import { FaEye, FaCreditCard, FaListAlt } from "react-icons/fa";
import { SalePayment } from "../../types";

export default function SalesList() {
  const { sales, salesPagination, cancelSale, addPaymentToSale, currentUser, bankAccounts, refreshSales, loading } = useData();
  const { showSuccess, showError } = useAlert();
  
  useEffect(() => {
    console.log("SalesList - Sales data:", sales);
    console.log("SalesList - Sales count:", sales?.length || 0);
    console.log("SalesList - Loading:", loading);
    
    // Refresh sales if empty and not loading
    if (!loading && (!sales || sales.length === 0)) {
      console.log("SalesList - Refreshing sales...");
      refreshSales(salesPagination?.page || 1, salesPagination?.pageSize || 10).catch(err => {
        console.error("SalesList - Error refreshing sales:", err);
      });
    }
  }, [sales, loading, refreshSales, salesPagination?.page, salesPagination?.pageSize]);

  const handlePageChange = (page: number) => {
    refreshSales(page, salesPagination?.pageSize || 10);
  };

  const handlePageSizeChange = (pageSize: number) => {
    refreshSales(1, pageSize);
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending" | "cancelled">("all");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const { isOpen: isPaymentModalOpen, openModal: openPaymentModal, closeModal: closePaymentModal } = useModal();
  const { isOpen: isViewPaymentsModalOpen, openModal: openViewPaymentsModal, closeModal: closeViewPaymentsModal } = useModal();
  const [paymentData, setPaymentData] = useState<SalePayment & { date?: string }>({
    type: "cash",
    amount: 0,
  });

  const filteredSales = (sales || []).filter((sale) => {
    if (!sale || !sale.billNumber) return false;
    const matchesSearch =
      sale.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customerPhone?.includes(searchTerm);
    const matchesStatus =
      filterStatus === "all" || sale.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalSales = filteredSales
    .filter((s) => s && s.status === "completed")
    .reduce((sum, s) => sum + (s?.total || 0), 0);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<string | null>(null);

  const handleCancelSaleClick = (id: string) => {
    setSaleToCancel(id);
    setCancelModalOpen(true);
  };

  const confirmCancelSale = async () => {
    if (!saleToCancel) return;
    
    try {
      await cancelSale(saleToCancel);
      showSuccess("Sale cancelled successfully!");
      refreshSales(salesPagination?.page || 1, salesPagination?.pageSize || 10);
      setCancelModalOpen(false);
      setSaleToCancel(null);
    } catch (error: any) {
      showError(error?.response?.data?.error || "Failed to cancel sale. Please try again.");
      setCancelModalOpen(false);
      setSaleToCancel(null);
    }
  };

  // Reprint handled via view bill (download button removed)

  const handleAddPayment = (sale: any) => {
    setSelectedSale(sale);
    const remainingBalance = sale.remainingBalance || (sale.total - (sale.payments?.reduce((sum: number, p: SalePayment) => sum + p.amount, 0) || 0));
    setPaymentData({
      type: "cash",
      amount: remainingBalance,
      date: new Date().toISOString().split("T")[0],
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

    if (paymentData.amount <= 0) {
      showError("Payment amount must be greater than 0");
      return;
    }

    const remainingBalance = selectedSale.remainingBalance || (selectedSale.total - (selectedSale.payments?.reduce((sum: number, p: SalePayment) => sum + p.amount, 0) || 0));
    
    if (paymentData.amount > remainingBalance) {
      showError(`Payment amount cannot exceed remaining balance of Rs. ${remainingBalance.toFixed(2)}`);
      return;
    }

    if (paymentData.type === "bank_transfer" && !paymentData.bankAccountId) {
      showError("Please select a bank account for bank transfer payment");
      return;
    }

    try {
      // Ensure date is included in payment data
      const paymentPayload = {
        ...paymentData,
        date: paymentData.date || new Date().toISOString().split("T")[0]
      };
      await addPaymentToSale(selectedSale.id, paymentPayload);
      await refreshSales(salesPagination?.page || 1, salesPagination?.pageSize || 10);
      closePaymentModal();
      setSelectedSale(null);
      setPaymentData({ type: "cash", amount: 0, date: new Date().toISOString().split("T")[0], bankAccountId: undefined });
      showSuccess("Payment added successfully!");
    } catch (err: any) {
      showError(err.response?.data?.error || "Failed to add payment");
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
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Sales List
          </h1>
          <Link to="/sales/entry">
            <Button size="sm">New Sale</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4">
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              Rs. {totalSales.toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Bills</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {filteredSales.length}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {filteredSales.filter((s) => s && s.status === "completed").length}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
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
      <div className="overflow-x-auto bg-white rounded-lg shadow-sm dark:bg-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Bill Number
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Date
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Customer
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Items
              </th>
              <th className="p-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Total
              </th>
              <th className="p-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Paid
              </th>
              <th className="p-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Remaining
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </th>
              <th className="p-4 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  No sales found
                </td>
              </tr>
            ) : (
              filteredSales.map((sale) => {
                if (!sale || !sale.billNumber) return null;
                
                const totalPaid = (sale.payments || []).reduce((sum: number, p: SalePayment) => sum + (p?.amount || 0), 0);
                const remainingBalance = sale.remainingBalance !== undefined && sale.remainingBalance !== null 
                  ? sale.remainingBalance 
                  : ((sale.total || 0) - totalPaid);
                
                return (
                  <tr
                    key={sale.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="p-4 font-medium text-gray-800 dark:text-white">
                      {sale.billNumber}
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      {new Date(sale.date || sale.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      {sale.customerName || "Walk-in"}
                      {sale.customerPhone && (
                        <p className="text-xs text-gray-500">{sale.customerPhone}</p>
                      )}
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      {(sale.items || []).length} item(s)
                    </td>
                    <td className="p-4 text-right font-semibold text-gray-800 dark:text-white">
                      Rs. {(sale.total || 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-gray-700 dark:text-gray-300">
                      Rs. {totalPaid.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-semibold text-gray-800 dark:text-white">
                      {remainingBalance > 0 ? (
                        <span className="text-orange-600 dark:text-orange-400">
                          Rs. {remainingBalance.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">Rs. 0.00</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          sale.status === "completed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : sale.status === "pending"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                        }`}
                      >
                        {sale.status || "completed"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {/* View Bill Button */}
                        <Link to={`/sales/bill/${sale.billNumber}`}>
                        <button 
                            className="p-2 text-gray-600 hover:bg-gray-50 rounded dark:hover:bg-gray-900/20 border border-gray-300 dark:border-gray-600"
                            title="View Bill"
                          >
                            <FaEye className="w-4 h-4 text-blue-500" />
                          </button>
                        </Link>
                        {/* View Payments Button */}
                        {sale.payments && sale.payments.length > 0 && (
                          <button
                            onClick={() => handleViewPayments(sale)}
                            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded dark:hover:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
                            title="View Payments"
                          >
                            <FaListAlt className="w-4 h-4" />
                          </button>
                        )}

                        {/* Add Payment Button */}
                        {sale.status === "pending" && remainingBalance > 0 && (
                          <button
                            onClick={() => handleAddPayment(sale)}
                            className="p-2 text-green-500 hover:bg-green-50 rounded dark:hover:bg-green-900/20 border border-green-200 dark:border-green-800"
                            title="Add Payment"
                          >
                            <FaCreditCard className="w-4 h-4" />
                          </button>
                        )}
                        {/* Cancel Sale Button */}
                        {sale.status !== "cancelled" &&
                          (currentUser?.role === "admin" ||
                            currentUser?.role === "superadmin" ||
                            currentUser?.id === sale.userId) && (
                            <button
                              onClick={() => handleCancelSaleClick(sale.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800"
                              title="Cancel Sale"
                            >
                              <TrashBinIcon className="w-4 h-4" />
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
        <div className="p-6 bg-white rounded-lg dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
            Add Payment
          </h2>
          {selectedSale && (
            <div className="mb-4 p-3 bg-gray-50 rounded dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-400">Bill Number: <span className="font-semibold">{selectedSale.billNumber}</span></p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total: <span className="font-semibold">Rs. {selectedSale.total.toFixed(2)}</span></p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Remaining: <span className="font-semibold text-orange-600 dark:text-orange-400">
                  Rs. {(selectedSale.remainingBalance || (selectedSale.total - (selectedSale.payments?.reduce((sum: number, p: SalePayment) => sum + p.amount, 0) || 0))).toFixed(2)}
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
                    { value: "", label: "Select Bank Account" },
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
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="Enter payment amount"
              />
            </div>
            <div>
              <Label>Date</Label>
              <DatePicker
                value={paymentData.date || new Date().toISOString().split("T")[0]}
                onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" size="sm" onClick={closePaymentModal} className="flex-1">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmitPayment} className="flex-1">
              Add Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Payments Modal */}
      <Modal isOpen={isViewPaymentsModalOpen} onClose={closeViewPaymentsModal} className="max-w-3xl m-4">
        <div className="p-6 bg-white rounded-lg dark:bg-gray-800">
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
                    Total Paid: <span className="font-semibold">Rs. {(selectedSale.payments || []).reduce((sum: number, p: SalePayment) => sum + (p?.amount || 0), 0).toFixed(2)}</span>
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
                        // Handle date - it might be ISO string or Date object
                        let paymentDate: Date;
                        if (payment.date) {
                          paymentDate = typeof payment.date === 'string' ? new Date(payment.date) : payment.date;
                        } else {
                          paymentDate = new Date(selectedSale.date || selectedSale.createdAt);
                        }
                        
                        return (
                          <tr key={index} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="p-3 text-gray-700 dark:text-gray-300 font-medium">{index + 1}</td>
                            <td className="p-3 text-gray-700 dark:text-gray-300">
                              <div className="flex flex-col">
                                <span className="font-medium">{paymentDate.toLocaleDateString('en-GB', { 
                                  day: '2-digit', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}</span>
                                <span className="text-xs text-gray-500">{paymentDate.toLocaleTimeString('en-GB', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 uppercase">
                                {payment.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-800 dark:text-white">
                              Rs. {payment.amount.toFixed(2)}
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
                        Rs. {(selectedSale.payments || []).reduce((sum: number, p: SalePayment) => sum + (p?.amount || 0), 0).toFixed(2)}
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
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg shadow-sm p-4 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <PageSizeSelector
            pageSize={salesPagination?.pageSize || 10}
            onPageSizeChange={handlePageSizeChange}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((salesPagination.page - 1) * salesPagination.pageSize) + 1} to{" "}
            {Math.min(salesPagination.page * salesPagination.pageSize, salesPagination.total)} of{" "}
            {salesPagination.total} sales
          </span>
        </div>
        <Pagination
          currentPage={salesPagination?.page || 1}
          totalPages={salesPagination?.totalPages || 1}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Cancel Sale Confirmation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setSaleToCancel(null);
        }}
        className="max-w-md mx-4"
        showCloseButton={true}
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full dark:bg-orange-900/20">
              <TrashBinIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Cancel Sale
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This action cannot be undone
              </p>
            </div>
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Are you sure you want to cancel this sale? This will restore product stock. This action cannot be undone.
          </p>
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
            >
              Cancel Sale
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

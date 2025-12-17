import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import { Purchase, PurchasePayment } from "../../types";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import DatePicker from "../../components/form/DatePicker";
import Pagination from "../../components/ui/Pagination";
import PageSizeSelector from "../../components/ui/PageSizeSelector";
import { PencilIcon, DownloadIcon } from "../../icons";
import { FaEye, FaListAlt, FaCreditCard } from "react-icons/fa";
import Select from "../../components/form/Select";
import Label from "../../components/form/Label";

export default function PurchaseList() {
  const { purchases, purchasesPagination, refreshPurchases, cards, refreshCards, bankAccounts, refreshBankAccounts, addPaymentToPurchase, loading, error } = useData();
  const { showSuccess, showError } = useAlert();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending" | "cancelled">("all");
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showViewPaymentsModal, setShowViewPaymentsModal] = useState(false);
  const [paymentData, setPaymentData] = useState<PurchasePayment & { date?: string }>({
    type: "cash",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cardsLoadedRef = useRef(false);
  const bankAccountsLoadedRef = useRef(false);
  const purchasesLoadedRef = useRef(false);

  // Load cards only once on mount
  useEffect(() => {
    if (!cardsLoadedRef.current && cards.length === 0) {
      cardsLoadedRef.current = true;
      refreshCards().catch(console.error);
    } else if (cards.length > 0) {
      cardsLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load bank accounts only once on mount
  useEffect(() => {
    if (!bankAccountsLoadedRef.current && bankAccounts.length === 0) {
      bankAccountsLoadedRef.current = true;
      refreshBankAccounts().catch(console.error);
    } else if (bankAccounts.length > 0) {
      bankAccountsLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load purchases only once on mount
  useEffect(() => {
    if (!purchasesLoadedRef.current) {
      purchasesLoadedRef.current = true;
      if (!loading && (!purchases || purchases.length === 0)) {
        refreshPurchases(purchasesPagination?.page || 1, purchasesPagination?.pageSize || 10).catch(err => {
          console.error("PurchaseList - Error refreshing purchases:", err);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (page: number) => {
    refreshPurchases(page, purchasesPagination?.pageSize || 10);
  };

  const handlePageSizeChange = (pageSize: number) => {
    refreshPurchases(1, pageSize);
  };

  const filteredPurchases = (purchases || []).filter((purchase) => {
    if (!purchase || !purchase.supplierName) return false;
    const matchesSearch =
      purchase.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (purchase.supplierPhone && purchase.supplierPhone.includes(searchTerm));
    const matchesStatus =
      filterStatus === "all" || purchase.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (p?.total || 0), 0);
  const totalRemaining = filteredPurchases.reduce((sum, p) => sum + (p?.remainingBalance || 0), 0);

  const handleAddPayment = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setPaymentData({
      type: "cash",
      amount: Math.min(purchase.remainingBalance, purchase.remainingBalance),
      date: new Date().toISOString().split("T")[0],
    });
    setShowAddPaymentModal(true);
  };

  const handleViewPayments = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setShowViewPaymentsModal(true);
  };

  const handlePrintPayment = (purchaseId: string, paymentIndex: number) => {
    window.open(`/inventory/purchase/payment/${purchaseId}/${paymentIndex}`, "_blank");
  };

  const handlePrintAllPayments = (purchaseId: string) => {
    window.open(`/inventory/purchase/payments/${purchaseId}`, "_blank");
  };

  const handleSubmitPayment = async () => {
    if (!selectedPurchase) return;

    if (paymentData.amount <= 0) {
      showError("Payment amount must be greater than 0");
      return;
    }

    if (paymentData.amount > selectedPurchase.remainingBalance) {
      showError(`Payment amount cannot exceed remaining balance of Rs. ${selectedPurchase.remainingBalance.toFixed(2)}`);
      return;
    }

    if (paymentData.type === "bank_transfer" && !paymentData.bankAccountId) {
      showError("Please select a bank account for bank transfer payment");
      return;
    }

    setIsSubmitting(true);
    try {
      await addPaymentToPurchase(selectedPurchase.id, paymentData);
      showSuccess("Payment added successfully!");
      setShowAddPaymentModal(false);
      setSelectedPurchase(null);
      await refreshPurchases(purchasesPagination?.page || 1, purchasesPagination?.pageSize || 10);
    } catch (error: any) {
      showError(error.message || "Failed to add payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Purchases | Isma Sports Complex"
        description="View and manage purchases"
      />
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Purchases
          </h1>
          <Link to="/inventory/purchase">
            <Button size="sm">Add Purchase</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4">
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Purchases</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {filteredPurchases.length}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              Rs. {totalPurchases.toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {filteredPurchases.filter((p) => p && p.status === "pending").length}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Remaining Balance</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              Rs. {totalRemaining.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by supplier name or phone..."
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
          Loading purchases...
        </div>
      )}

      {error && (
        <div className="p-4 mb-4 text-red-600 bg-red-50 rounded-lg dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && (!purchases || purchases.length === 0) && (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow-sm dark:bg-gray-800">
          <p className="mb-4">No purchases found. Create your first purchase!</p>
          <Link to="/inventory/purchase">
            <Button size="sm">Create Purchase</Button>
          </Link>
        </div>
      )}

      {!loading && purchases && purchases.length > 0 && (
      <div className="overflow-x-auto bg-white rounded-lg shadow-sm dark:bg-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Date
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Supplier
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Items
              </th>
              <th className="p-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Subtotal
              </th>
              <th className="p-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Tax
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
            {filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-500">
                  No purchases found
                </td>
              </tr>
            ) : (
              filteredPurchases.map((purchase) => {
                if (!purchase || !purchase.id) return null;
                
                const payments = (purchase.payments || []) as PurchasePayment[];
                const totalPaid = payments.reduce((sum, p) => sum + (p?.amount || 0), 0);
                return (
                  <tr
                    key={purchase.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      {new Date(purchase.date).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">
                          {purchase.supplierName}
                        </p>
                        {purchase.supplierPhone && (
                          <p className="text-xs text-gray-500">{purchase.supplierPhone}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      {(purchase.items || []).length} item(s)
                    </td>
                    <td className="p-4 text-right text-gray-700 dark:text-gray-300">
                      Rs. {(purchase.subtotal || 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-gray-700 dark:text-gray-300">
                      Rs. {(purchase.tax || 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-semibold text-gray-800 dark:text-white">
                      Rs. {(purchase.total || 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-gray-700 dark:text-gray-300">
                      Rs. {totalPaid.toFixed(2)}
                      {payments.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {payments.length} payment{payments.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-right font-semibold text-gray-800 dark:text-white">
                      {(purchase.remainingBalance || 0) > 0 ? (
                        <span className="text-orange-600 dark:text-orange-400">
                          Rs. {(purchase.remainingBalance || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">Rs. 0.00</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          purchase.status === "completed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : purchase.status === "pending"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                        }`}
                      >
                        {purchase.status || ((purchase.remainingBalance || 0) > 0 ? "pending" : "completed")}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <Link to={`/inventory/purchase/view/${purchase.id}`}>
                          <button 
                            className="p-2 text-gray-600 hover:bg-gray-50 rounded dark:hover:bg-gray-900/20 border border-gray-300 dark:border-gray-600"
                            title="View Purchase"
                          >
                            <FaEye className="w-4 h-4 text-blue-500" />
                          </button>
                        </Link>
                        {/* View Payments Button */}
                        {purchase.payments && purchase.payments.length > 0 && (
                          <button
                            onClick={() => handleViewPayments(purchase)}
                            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded dark:hover:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
                            title="View Payments"
                          >
                            <FaListAlt className="w-4 h-4" />
                          </button>
                        )}
                        {purchase.status === "pending" && (purchase.remainingBalance || 0) > 0 && (
                          <button
                            onClick={() => handleAddPayment(purchase)}
                            className="p-2 text-green-500 hover:bg-green-50 rounded dark:hover:bg-green-900/20 border border-green-200 dark:border-green-800"
                            title="Add Payment"
                          >
                            <FaCreditCard className="w-4 h-4" />
                          </button>
                        )}
                        <Link to={`/inventory/purchase/edit/${purchase.id}`}>
                          <button 
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20"
                            title="Edit Purchase"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        </Link>
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
      {showAddPaymentModal && selectedPurchase && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => {
            setShowAddPaymentModal(false);
            setSelectedPurchase(null);
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              Add Payment
            </h2>
            <div className="space-y-4">
              <div className="mb-4 p-3 bg-gray-50 rounded dark:bg-gray-900">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Supplier: <span className="font-medium">{selectedPurchase.supplierName}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Total: <span className="font-medium">Rs. {selectedPurchase.total.toFixed(2)}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Total Paid: <span className="font-medium">Rs. {(selectedPurchase.payments || []).reduce((sum: number, p: PurchasePayment) => sum + (p?.amount || 0), 0).toFixed(2)}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Remaining Balance: <span className="font-medium text-orange-600">Rs. {selectedPurchase.remainingBalance.toFixed(2)}</span>
                </p>
                {(selectedPurchase.payments || []).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Previous Payments:</p>
                    {(selectedPurchase.payments || []).map((p: PurchasePayment, idx: number) => (
                      <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                        {new Date(p.date || selectedPurchase.date).toLocaleDateString()} - {p.type.toUpperCase()}: Rs. {p.amount.toFixed(2)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>
                  Payment Type <span className="text-error-500">*</span>
                </Label>
                <Select
                  value={paymentData.type}
                  onChange={(value) => {
                    setPaymentData({
                      ...paymentData,
                      type: value as "cash" | "bank_transfer",
                      bankAccountId: value === "bank_transfer" ? paymentData.bankAccountId : undefined,
                    });
                  }}
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "bank_transfer", label: "Bank Transfer" },
                  ]}
                />
              </div>

              {paymentData.type === "bank_transfer" && (
                <div>
                  <Label>
                    Select Bank Account <span className="text-error-500">*</span>
                  </Label>
                  {bankAccounts.filter((acc) => acc.isActive).length === 0 ? (
                    <div className="p-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded">
                      No active bank accounts available.
                    </div>
                  ) : (
                    <Select
                      value={paymentData.bankAccountId || ""}
                      onChange={(value) => setPaymentData({ ...paymentData, bankAccountId: value })}
                      options={[
                        { value: "", label: "Select a bank account" },
                        ...bankAccounts
                          .filter((acc) => acc.isActive)
                          .map((acc) => ({
                            value: acc.id,
                            label: `${acc.accountName} - ${acc.bankName}${acc.isDefault ? " (Default)" : ""}`,
                          })),
                      ]}
                    />
                  )}
                </div>
              )}

              <div>
                <Label>
                  Payment Date <span className="text-error-500">*</span>
                </Label>
                <DatePicker
                  value={paymentData.date}
                  onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>
                  Amount <span className="text-error-500">*</span>
                </Label>
                <Input
                  type="number"
                  step={0.01}
                  min="0"
                  max={String(selectedPurchase.remainingBalance)}
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter amount"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Max: Rs. {selectedPurchase.remainingBalance.toFixed(2)}
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={handleSubmitPayment}
                  size="sm"
                  disabled={isSubmitting || paymentData.amount <= 0 || (paymentData.type === "bank_transfer" && !paymentData.bankAccountId)}
                  className="flex-1"
                >
                  {isSubmitting ? "Adding..." : "Add Payment"}
                </Button>
                <Button
                  onClick={() => {
                    setShowAddPaymentModal(false);
                    setSelectedPurchase(null);
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Payments Modal */}
      {showViewPaymentsModal && selectedPurchase && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => {
            setShowViewPaymentsModal(false);
            setSelectedPurchase(null);
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              Payments - Purchase #{selectedPurchase.id.slice(-8)}
            </h2>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded dark:bg-gray-900">
                <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Purchase Total:</p>
                    <p className="font-semibold text-gray-800 dark:text-white">Rs. {selectedPurchase.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Remaining Balance:</p>
                    <p className={`font-semibold ${selectedPurchase.remainingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      Rs. {selectedPurchase.remainingBalance.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Total Payments: <span className="font-semibold">{(selectedPurchase.payments || []).length}</span> | 
                    Total Paid: <span className="font-semibold">Rs. {(selectedPurchase.payments || []).reduce((sum: number, p: PurchasePayment) => sum + (p?.amount || 0), 0).toFixed(2)}</span>
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
                    {(selectedPurchase.payments || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-500">
                          No payments found
                        </td>
                      </tr>
                    ) : (
                      [...(selectedPurchase.payments || [])]
                        .sort((a, b) => {
                          // Sort by date (oldest first)
                          const dateA = a.date ? new Date(a.date).getTime() : 0;
                          const dateB = b.date ? new Date(b.date).getTime() : 0;
                          return dateA - dateB;
                        })
                        .map((payment: PurchasePayment, index: number) => {
                        // Handle date - it might be ISO string or Date object
                        let paymentDate: Date;
                        if (payment.date) {
                          paymentDate = typeof payment.date === 'string' ? new Date(payment.date) : payment.date;
                        } else {
                          paymentDate = new Date(selectedPurchase.date);
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
                                {payment.type}
                              </span>
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-800 dark:text-white">
                              Rs. {payment.amount.toFixed(2)}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handlePrintPayment(selectedPurchase.id, index)}
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
                        Rs. {(selectedPurchase.payments || []).reduce((sum: number, p: PurchasePayment) => sum + (p?.amount || 0), 0).toFixed(2)}
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
                    onClick={() => handlePrintAllPayments(selectedPurchase.id)}
                    size="sm"
                    className="flex-1"
                  >
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    Print All Payments (Combined)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowViewPaymentsModal(false);
                      setSelectedPurchase(null);
                    }}
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && purchases && purchases.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg shadow-sm p-4 dark:bg-gray-800">
          <div className="flex items-center gap-4">
            <PageSizeSelector
              pageSize={purchasesPagination?.pageSize || 10}
              onPageSizeChange={handlePageSizeChange}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Showing {((purchasesPagination?.page || 1) - 1) * (purchasesPagination?.pageSize || 10) + 1} to{" "}
              {Math.min((purchasesPagination?.page || 1) * (purchasesPagination?.pageSize || 10), purchasesPagination?.total || 0)} of{" "}
              {purchasesPagination?.total || 0} purchases
            </span>
          </div>
          <Pagination
            currentPage={purchasesPagination?.page || 1}
            totalPages={purchasesPagination?.totalPages || 1}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </>
  );
}


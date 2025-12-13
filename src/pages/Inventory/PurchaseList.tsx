import { useState, useEffect } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { Purchase, PurchasePayment } from "../../types";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import { PencilIcon, PlusIcon } from "../../icons";
import Select from "../../components/form/Select";
import Label from "../../components/form/Label";

export default function PurchaseList() {
  const { purchases, refreshPurchases, currentUser, cards, refreshCards, bankAccounts, refreshBankAccounts, addPaymentToPurchase } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<PurchasePayment & { date?: string }>({
    type: "cash",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    refreshPurchases().catch(console.error);
    if (cards.length === 0) {
      refreshCards();
    }
    if (bankAccounts.length === 0) {
      refreshBankAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPurchases = purchases.filter((purchase) => {
    const matchesSearch =
      purchase.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (purchase.supplierPhone && purchase.supplierPhone.includes(searchTerm));
    return matchesSearch;
  });

  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + p.total, 0);
  const totalRemaining = filteredPurchases.reduce((sum, p) => sum + p.remainingBalance, 0);

  const handleAddPayment = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setPaymentData({
      type: "cash",
      amount: Math.min(purchase.remainingBalance, purchase.remainingBalance),
      date: new Date().toISOString().split("T")[0],
    });
    setShowAddPaymentModal(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedPurchase) return;

    if (paymentData.amount <= 0) {
      alert("Payment amount must be greater than 0");
      return;
    }

    if (paymentData.amount > selectedPurchase.remainingBalance) {
      alert(`Payment amount cannot exceed remaining balance of Rs. ${selectedPurchase.remainingBalance.toFixed(2)}`);
      return;
    }

    if (paymentData.type === "card" && !paymentData.cardId) {
      alert("Please select a card for card payment");
      return;
    }

    setIsSubmitting(true);
    try {
      await addPaymentToPurchase(selectedPurchase.id, paymentData);
      alert("Payment added successfully!");
      setShowAddPaymentModal(false);
      setSelectedPurchase(null);
      await refreshPurchases();
    } catch (error: any) {
      alert(error.message || "Failed to add payment");
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

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Remaining Balance</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              Rs. {totalRemaining.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by supplier name or phone..."
          />
        </div>
      </div>

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
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Payments
              </th>
              <th className="p-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Remaining
              </th>
              <th className="p-4 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  No purchases found
                </td>
              </tr>
            ) : (
              filteredPurchases.map((purchase) => {
                const payments = (purchase.payments || []) as PurchasePayment[];
                const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
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
                      {purchase.items.length} item(s)
                    </td>
                    <td className="p-4 text-right text-gray-700 dark:text-gray-300">
                      Rs. {purchase.subtotal.toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-gray-700 dark:text-gray-300">
                      Rs. {purchase.tax.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-semibold text-gray-800 dark:text-white">
                      Rs. {purchase.total.toFixed(2)}
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {payments.map((payment, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 capitalize">
                              {payment.type}
                            </span>
                            <span className="ml-2 text-gray-600 dark:text-gray-400">
                              Rs. {payment.amount.toFixed(2)}
                            </span>
                            {payment.type === "card" && payment.cardId && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({cards.find(c => c.id === payment.cardId)?.name || "Card"})
                              </span>
                            )}
                          </div>
                        ))}
                        <div className="text-xs text-gray-500">
                          Total Paid: Rs. {totalPaid.toFixed(2)}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`font-semibold ${purchase.remainingBalance > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                        Rs. {purchase.remainingBalance.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link to={`/inventory/purchase/edit/${purchase.id}`}>
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        </Link>
                        {purchase.remainingBalance > 0 && (
                          <button
                            onClick={() => handleAddPayment(purchase)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded dark:hover:bg-green-900/20"
                            title="Add Payment"
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Payment Modal */}
      {showAddPaymentModal && selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              Add Payment
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Supplier: <span className="font-medium">{selectedPurchase.supplierName}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Total: <span className="font-medium">Rs. {selectedPurchase.total.toFixed(2)}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Remaining Balance: <span className="font-medium text-orange-600">Rs. {selectedPurchase.remainingBalance.toFixed(2)}</span>
                </p>
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
                      type: value as "cash" | "card",
                      cardId: value === "card" ? paymentData.cardId : undefined,
                    });
                  }}
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "card", label: "Card" },
                  ]}
                />
              </div>

              {paymentData.type === "card" && (
                <div>
                  <Label>
                    Select Card <span className="text-error-500">*</span>
                  </Label>
                  {cards.filter((c) => c.isActive).length === 0 ? (
                    <div className="p-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded">
                      No active cards available.
                    </div>
                  ) : (
                    <Select
                      value={paymentData.cardId || ""}
                      onChange={(value) => setPaymentData({ ...paymentData, cardId: value })}
                      options={[
                        { value: "", label: "Select a card" },
                        ...cards
                          .filter((c) => c.isActive)
                          .map((card) => ({
                            value: card.id,
                            label: `${card.name}${card.isDefault ? " (Default)" : ""}`,
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
                <Input
                  type="date"
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
                  max={selectedPurchase.remainingBalance}
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
                  disabled={isSubmitting || paymentData.amount <= 0 || (paymentData.type === "card" && !paymentData.cardId)}
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
    </>
  );
}


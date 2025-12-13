import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { Product, PurchaseItem, PurchasePayment } from "../../types";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import { TrashBinIcon, ChevronLeftIcon, PlusIcon } from "../../icons";
import api from "../../services/api";

export default function PurchaseEntry() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { products, addPurchase, updatePurchase, currentUser, cards, refreshCards, bankAccounts, refreshBankAccounts } = useData();
  const navigate = useNavigate();
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<
    (PurchaseItem & { product: Product })[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [tax, setTax] = useState(0);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cards.length === 0) {
      refreshCards();
    }
    if (bankAccounts.length === 0) {
      refreshBankAccounts();
    }
    // Add default cash payment
    if (payments.length === 0 && !isEdit) {
      setPayments([{ type: "cash", amount: 0 }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load purchase data for edit
  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      api.getPurchase(id)
        .then((purchase: any) => {
          setSupplierName(purchase.supplierName);
          setSupplierPhone(purchase.supplierPhone || "");
          setDate(new Date(purchase.date).toISOString().split("T")[0]);
          setTax(Number(purchase.tax) || 0);
          setPayments((purchase.payments || []) as PurchasePayment[]);
          
          // Load products for items
          const itemsWithProducts = purchase.items.map((item: any) => {
            const product = products.find(p => p.id === item.productId);
            return {
              ...item,
              product: product || { id: item.productId, name: item.productName } as Product,
            };
          });
          setSelectedProducts(itemsWithProducts);
        })
        .catch((err) => {
          console.error("Error loading purchase:", err);
          alert("Failed to load purchase data");
          navigate("/inventory/purchases");
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  useEffect(() => {
    if (searchTerm) {
      setFilteredProducts(
        products.filter((p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredProducts([]);
    }
  }, [searchTerm, products]);

  const addProductToPurchase = (product: Product) => {
    const existingItem = selectedProducts.find(
      (item) => item.productId === product.id
    );

    if (existingItem) {
      setSelectedProducts(
        selectedProducts.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, total: item.cost * (item.quantity + 1) }
            : item
        )
      );
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          cost: 0,
          total: 0,
          product,
        },
      ]);
    }
    setSearchTerm("");
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          return { ...item, quantity, total: item.cost * quantity };
        }
        return item;
      })
    );
  };

  const updateItemCost = (productId: string, cost: number) => {
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          return { ...item, cost, total: cost * item.quantity };
        }
        return item;
      })
    );
  };

  const removeItem = (productId: string) => {
    setSelectedProducts(
      selectedProducts.filter((item) => item.productId !== productId)
    );
  };

  const subtotal = selectedProducts.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal + tax;
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remainingBalance = total - totalPaid;

  const addPayment = () => {
    setPayments([
      ...payments,
      {
        type: "cash",
        amount: 0,
      },
    ]);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const updatePayment = (index: number, field: keyof PurchasePayment, value: any) => {
    setPayments(
      payments.map((payment, i) => {
        if (i === index) {
          const updated = { ...payment, [field]: value };
          // If type changes to cash, remove cardId
          if (field === "type" && value === "cash") {
            delete updated.cardId;
            delete updated.bankAccountId;
          }
          // If type changes to card, don't auto-select - let user choose
          if (field === "type" && value === "card") {
            // Only auto-select if no card is selected and there's a default card
            if (!updated.cardId && cards.length > 0) {
              const defaultCard = cards.find((c) => c.isDefault && c.isActive);
              if (defaultCard) {
                updated.cardId = defaultCard.id;
              }
            }
          }
          return updated;
        }
        return payment;
      })
    );
  };

  const handleSubmit = async () => {
    if (selectedProducts.length === 0) {
      alert("Please add at least one product");
      return;
    }
    if (!supplierName) {
      alert("Please enter supplier name");
      return;
    }
    if (payments.length === 0) {
      alert("Please add at least one payment method");
      return;
    }
    if (totalPaid > total) {
      alert("Total paid amount cannot exceed total amount");
      return;
    }

    // Validate card payments have cardId
    for (const payment of payments) {
      if (payment.type === "card" && !payment.cardId) {
        alert("Please select a card for card payment");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const purchaseItems: PurchaseItem[] = selectedProducts.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        cost: item.cost,
        discount: item.discount || 0,
        total: item.total,
        toWarehouse: item.toWarehouse !== undefined ? item.toWarehouse : true,
      }));

      const purchaseData = {
        supplierName,
        supplierPhone: supplierPhone || undefined,
        items: purchaseItems,
        subtotal,
        tax,
        total,
        payments,
        remainingBalance,
        date,
        userId: currentUser!.id,
        userName: currentUser!.name,
      };

      if (isEdit && id) {
        await updatePurchase(id, purchaseData);
        alert("Purchase updated successfully!");
      } else {
        await addPurchase(purchaseData);
        alert("Purchase entry added successfully!");
      }
      navigate("/inventory/purchases");
    } catch (error: any) {
      alert(error.message || `Failed to ${isEdit ? "update" : "create"} purchase`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta
        title={`${isEdit ? "Edit" : "Add"} Purchase | Isma Sports Complex`}
        description={`${isEdit ? "Edit" : "Add"} purchase entry`}
      />
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-500">Loading purchase data...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <Link to="/inventory/purchases">
              <Button variant="outline" size="sm">
                <ChevronLeftIcon className="w-4 h-4 mr-2" />
                Back to Purchases
              </Button>
            </Link>
          </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Product Search
            </h2>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
            />
            {filteredProducts.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg dark:border-gray-700 max-h-60 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addProductToPurchase(product)}
                    className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Current Stock: {(product.shopQuantity || 0) + (product.warehouseQuantity || 0)}
                        </p>
                      </div>
                      <p className="font-semibold text-brand-600 dark:text-brand-400">
                        Rs. {product.salePrice ? product.salePrice.toFixed(2) : "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 mt-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Selected Products
            </h2>
            {selectedProducts.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                No products selected. Search and add products above.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Product
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Cost
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Qty
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Total
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map((item) => (
                      <tr
                        key={item.productId}
                        className="border-b border-gray-100 dark:border-gray-700"
                      >
                        <td className="p-2 font-medium text-gray-800 dark:text-white">
                          {item.productName}
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step={0.01}
                            min="0"
                            value={String(item.cost)}
                            onChange={(e) =>
                              updateItemCost(
                                item.productId,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-24"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQuantity(
                                item.productId,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20"
                          />
                        </td>
                        <td className="p-2 font-semibold text-gray-800 dark:text-white">
                          Rs. {item.total.toFixed(2)}
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
                          >
                            <TrashBinIcon className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Purchase Details
            </h2>
            <div className="space-y-4">
              <div>
                <Label>
                  Supplier Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Enter supplier name"
                  required
                />
              </div>
              <div>
                <Label>Mobile Number</Label>
                <Input
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="Enter mobile number (optional)"
                  type="tel"
                />
              </div>
              <div>
                <Label>
                  Date <span className="text-error-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <h2 className="mt-6 mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Summary
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                <span className="text-gray-800 dark:text-white">Rs. {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <Label className="mb-0">Tax:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step={0.01}
                    min="0"
                    value={tax}
                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <span className="text-gray-800 dark:text-white">Rs. {tax.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-lg font-semibold text-gray-800 dark:text-white">
                  Total:
                </span>
                <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
                  Rs. {total.toFixed(2)}
                </span>
              </div>
            </div>

            <h2 className="mt-6 mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Payment Methods
            </h2>
            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-lg dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Payment {index + 1}
                    </span>
                    {payments.length > 1 && (
                      <button
                        onClick={() => removePayment(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashBinIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label>Payment Type</Label>
                      <Select
                        value={payment.type}
                        onChange={(value) => updatePayment(index, "type", value)}
                        options={[
                          { value: "cash", label: "Cash" },
                          { value: "card", label: "Card" },
                        ]}
                      />
                    </div>
                    {payment.type === "card" && (
                      <div className="mt-2">
                        <Label>
                          Select Card <span className="text-error-500">*</span>
                        </Label>
                        {cards.filter((c) => c.isActive).length === 0 ? (
                          <div className="p-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded">
                            No active cards available. Please add a card in Settings.
                          </div>
                        ) : (
                          <>
                            <Select
                              value={payment.cardId || ""}
                              onChange={(value) => updatePayment(index, "cardId", value)}
                              options={[
                                { value: "", label: "Select a card" },
                                ...cards
                                  .filter((c) => c.isActive)
                                  .map((card) => ({
                                    value: card.id,
                                    label: `${card.name}${card.isDefault ? " (Default)" : ""}${card.cardNumber ? ` - ****${card.cardNumber.slice(-4)}` : ""}`,
                                  })),
                              ]}
                            />
                            {!payment.cardId && (
                              <p className="mt-1 text-xs text-error-500">
                                Please select a card for this payment
                              </p>
                            )}
                            {payment.cardId && (
                              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                                Card selected: {cards.find(c => c.id === payment.cardId)?.name}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step={0.01}
                        min="0"
                        max={String(total - totalPaid + payment.amount)}
                        value={payment.amount}
                        onChange={(e) => updatePayment(index, "amount", parseFloat(e.target.value) || 0)}
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                onClick={addPayment}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Payment Method
              </Button>
            </div>

            <div className="mt-4 space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Paid:</span>
                <span className="font-semibold text-gray-800 dark:text-white">
                  Rs. {totalPaid.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Remaining Balance:</span>
                <span className={`font-semibold ${remainingBalance > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                  Rs. {remainingBalance.toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full mt-6"
              size="sm"
              disabled={selectedProducts.length === 0 || !supplierName || payments.length === 0 || isSubmitting}
            >
              {isSubmitting ? (isEdit ? "Updating..." : "Saving...") : (isEdit ? "Update Purchase" : "Save Purchase")}
            </Button>
          </div>
        </div>
      </div>
        </>
      )}
    </>
  );
}

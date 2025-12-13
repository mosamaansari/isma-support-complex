import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { Product, SaleItem, SalePayment } from "../../types";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import { TrashBinIcon, PlusIcon } from "../../icons";

export default function SalesEntry() {
  const { products, currentUser, addSale, sales, loading, error, bankAccounts, refreshBankAccounts, cards, refreshCards } = useData();
  const navigate = useNavigate();
  const [selectedProducts, setSelectedProducts] = useState<
    (SaleItem & { product: Product })[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [globalTax, setGlobalTax] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (bankAccounts.length === 0) {
      refreshBankAccounts();
    }
    if (cards.length === 0) {
      refreshCards();
    }
    // Add default cash payment
    if (payments.length === 0) {
      setPayments([{ type: "cash", amount: 0 }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
          <Button onClick={() => navigate("/signin")} size="sm">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error: {error}</p>
          <Button onClick={() => window.location.reload()} size="sm">
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (searchTerm) {
      setFilteredProducts(
        products.filter(
          (p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      );
    } else {
      setFilteredProducts([]);
    }
  }, [searchTerm, products]);

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
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== index));
    }
  };

  const updatePayment = (index: number, field: keyof SalePayment, value: any) => {
    setPayments(
      payments.map((payment, i) => {
        if (i === index) {
          const updated = { ...payment, [field]: value };
          // If type changes to cash, remove cardId and bankAccountId
          if (field === "type" && value === "cash") {
            delete updated.cardId;
            delete updated.bankAccountId;
          }
          // If type changes to card, auto-select default card if available
          if (field === "type" && value === "card" && !updated.cardId && cards.length > 0) {
            const defaultCard = cards.find((c) => c.isDefault && c.isActive);
            if (defaultCard) {
              updated.cardId = defaultCard.id;
            }
          }
          // If type changes to bank_transfer, auto-select default bank account if available
          if (field === "type" && value === "bank_transfer" && !updated.bankAccountId && bankAccounts.length > 0) {
            const defaultAccount = bankAccounts.find((acc) => acc.isDefault && acc.isActive);
            if (defaultAccount) {
              updated.bankAccountId = defaultAccount.id;
            }
          }
          return updated;
        }
        return payment;
      })
    );
  };

  const addProductToCart = (product: Product) => {
    const existingItem = selectedProducts.find(
      (item) => item.productId === product.id
    );

    if (existingItem) {
      setSelectedProducts(
        selectedProducts.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
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
          unitPrice: product.salePrice || 0,
          discount: 0,
          tax: 0,
          total: (product.salePrice || 0) * 1,
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
          const newTotal =
            (item.unitPrice * quantity * (1 - item.discount / 100) +
              item.tax) *
            (1 - globalDiscount / 100);
          return { ...item, quantity, total: newTotal };
        }
        return item;
      })
    );
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          const newTotal =
            (item.unitPrice * item.quantity * (1 - discount / 100) +
              item.tax) *
            (1 - globalDiscount / 100);
          return { ...item, discount, total: newTotal };
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

  const calculateTotals = () => {
    const subtotal = selectedProducts.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const discountAmount = (subtotal * globalDiscount) / 100;
    const taxAmount = (subtotal * globalTax) / 100;
    const total = subtotal - discountAmount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  };

  const generateBillNumber = () => {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
    const count = sales.filter((s) =>
      s.billNumber.startsWith(`BILL-${dateStr}`)
    ).length;
    return `BILL-${dateStr}-${String(count + 1).padStart(4, "0")}`;
  };

  const handleSubmit = async () => {
    if (selectedProducts.length === 0) {
      alert("Please add at least one product");
      return;
    }

    const { subtotal, discountAmount, taxAmount, total } = calculateTotals();
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    
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
      if (payment.type === "bank_transfer" && !payment.bankAccountId) {
        alert("Please select a bank account for bank transfer payment");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const saleItems: SaleItem[] = selectedProducts.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        tax: (item.unitPrice * item.quantity * globalTax) / 100,
        total: item.total,
      }));

      const billNumber = generateBillNumber();

      await addSale({
        billNumber,
        items: saleItems,
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        paymentType: payments[0]?.type || "cash", // Required for backward compatibility
        payments: payments.map(p => ({
          type: p.type,
          amount: p.amount,
          cardId: p.cardId,
          bankAccountId: p.bankAccountId,
        })),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        date,
        userId: currentUser!.id,
        userName: currentUser!.name,
        status: "completed",
      });

      // Redirect to bill print page
      navigate(`/sales/bill/${billNumber}`);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create sale. Please try again.");
      console.error("Error creating sale:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const { subtotal, total } = calculateTotals();
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remainingBalance = total - totalPaid;

  return (
    <>
      <PageMeta
        title="Sales Entry | Isma Sports Complex"
        description="Create new sales entry and generate bill"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Product Search
            </h2>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products by name or category..."
            />
            {filteredProducts.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg dark:border-gray-700 max-h-60 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addProductToCart(product)}
                    className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {product.category || "N/A"} - Stock: {(product.shopQuantity || 0) + (product.warehouseQuantity || 0)}
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
                        Price
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Qty
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Disc%
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
                        <td className="p-2">
                          <p className="font-medium text-gray-800 dark:text-white">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Stock: {(item.product.shopQuantity || 0) + (item.product.warehouseQuantity || 0)}
                          </p>
                        </td>
                        <td className="p-2 text-gray-700 dark:text-gray-300">
                          Rs. {item.unitPrice.toFixed(2)}
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="1"
                            max={((item.product.shopQuantity || 0) + (item.product.warehouseQuantity || 0)).toString()}
                            value={item.quantity.toString()}
                            onChange={(e) =>
                              updateItemQuantity(
                                item.productId,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount.toString()}
                            onChange={(e) =>
                              updateItemDiscount(
                                item.productId,
                                parseFloat(e.target.value) || 0
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
              Customer Details
            </h2>
            <div className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Customer Name</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <h2 className="mt-6 mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Payment Details
            </h2>
            <div className="space-y-4">
              {payments.map((payment, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <Label>Payment {index + 1}</Label>
                    {payments.length > 1 && (
                      <button
                        onClick={() => removePayment(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
                      >
                        <TrashBinIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Payment Type</Label>
                      <Select
                        value={payment.type}
                        onChange={(value) =>
                          updatePayment(index, "type", value)
                        }
                        options={[
                          { value: "cash", label: "Cash" },
                          { value: "card", label: "Card" },
                          { value: "credit", label: "Credit" },
                          { value: "bank_transfer", label: "Bank Transfer" },
                        ]}
                      />
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        max={String(remainingBalance + payment.amount)}
                        value={payment.amount}
                        onChange={(e) =>
                          updatePayment(index, "amount", parseFloat(e.target.value) || 0)
                        }
                        placeholder="Enter amount"
                      />
                    </div>
                    {payment.type === "card" && (
                      <div>
                        <Label>Select Card</Label>
                        <Select
                          value={payment.cardId || ""}
                          onChange={(value) =>
                            updatePayment(index, "cardId", value)
                          }
                          options={[
                            { value: "", label: "Select Card" },
                            ...cards
                              .filter((card) => card.isActive)
                              .map((card) => ({
                                value: card.id,
                                label: `${card.name}${card.cardNumber ? ` - ${card.cardNumber}` : ""}${card.isDefault ? " (Default)" : ""}`,
                              })),
                          ]}
                        />
                      </div>
                    )}
                    {payment.type === "bank_transfer" && (
                      <div>
                        <Label>Select Bank Account</Label>
                        <Select
                          value={payment.bankAccountId || ""}
                          onChange={(value) =>
                            updatePayment(index, "bankAccountId", value)
                          }
                          options={[
                            { value: "", label: "Select Bank Account" },
                            ...bankAccounts
                              .filter((acc) => acc.isActive)
                              .map((acc) => ({
                                value: acc.id,
                                label: `${acc.accountName} - ${acc.bankName}${acc.isDefault ? " (Default)" : ""}`,
                              })),
                          ]}
                        />
                      </div>
                    )}
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
                Add Payment
              </Button>
              {remainingBalance > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Remaining Balance: Rs. {remainingBalance.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <h2 className="mt-6 mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Bill Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  Rs. {subtotal.toFixed(2)}
                </span>
              </div>
              <div>
                <Label>Discount (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={globalDiscount}
                  onChange={(e) =>
                    setGlobalDiscount(parseFloat(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <Label>Tax (%)</Label>
                <Input
                  type="number"
                  min="0"
                  value={globalTax}
                  onChange={(e) => setGlobalTax(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-lg font-semibold text-gray-800 dark:text-white">
                  Total:
                </span>
                <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
                  Rs. {total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Paid:</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  Rs. {totalPaid.toFixed(2)}
                </span>
              </div>
              {remainingBalance > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    Rs. {remainingBalance.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full mt-6"
              size="sm"
              disabled={selectedProducts.length === 0 || isSubmitting}
            >
              {isSubmitting ? "Generating Bill..." : "Generate Bill"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}


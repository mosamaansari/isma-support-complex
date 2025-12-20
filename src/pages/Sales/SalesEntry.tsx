import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import { Product, SaleItem, SalePayment } from "../../types";
import Input from "../../components/form/input/InputField";
import DatePicker from "../../components/form/DatePicker";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import TaxDiscountInput from "../../components/form/TaxDiscountInput";
import Button from "../../components/ui/button/Button";
import { TrashBinIcon, PlusIcon } from "../../icons";
import { getTodayDate } from "../../utils/dateHelpers";

const salesEntrySchema = yup.object().shape({
  customerName: yup
    .string()
    .required("Customer name is required")
    .trim()
    .min(2, "Customer name must be at least 2 characters")
    .max(100, "Customer name must be less than 100 characters"),
  customerPhone: yup
    .string()
    .optional()
    .matches(/^[0-9+\-\s()]*$/, "Phone number contains invalid characters")
    .max(20, "Phone number must be less than 20 characters"),
  customerCity: yup
    .string()
    .optional()
    .max(50, "City name must be less than 50 characters"),
  date: yup
    .string()
    .required("Date is required"),
});

export default function SalesEntry() {
  const { products, currentUser, addSale, sales, loading, error, bankAccounts, refreshBankAccounts, cards, refreshCards } = useData();
  const { showError } = useAlert();
  const navigate = useNavigate();
  const [selectedProducts, setSelectedProducts] = useState<
    (SaleItem & { product: Product })[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [date, setDate] = useState(getTodayDate());
  const [globalDiscount, setGlobalDiscount] = useState<number | null>(null);
  const [globalDiscountType, setGlobalDiscountType] = useState<"percent" | "value">("percent");
  const [globalTax, setGlobalTax] = useState<number | null>(null);
  const [globalTaxType, setGlobalTaxType] = useState<"percent" | "value">("percent");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendErrors, setBackendErrors] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState<string>("");

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: yupResolver(salesEntrySchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerCity: "",
      date: getTodayDate(),
    },
  });

  const customerName = watch("customerName");
  const customerPhone = watch("customerPhone");
  const customerCity = watch("customerCity");

  useEffect(() => {
    if (bankAccounts.length === 0) {
      refreshBankAccounts();
    }
    if (cards.length === 0) {
      refreshCards();
    }
    // Add default cash payment
    if (payments.length === 0) {
      setPayments([{ type: "cash", amount: undefined as any }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
          <Button onClick={() => navigate("/login")} size="sm">
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

  // Filter products based on search term - compute directly instead of using useEffect
  const filteredProducts = searchTerm
    ? (products || []).filter((p) =>
        p && p.name && (
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      )
    : (products || []);

  const addPayment = () => {
    setPayments([
      ...payments,
      {
        type: "cash",
        amount: undefined as any,
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
          // If type changes to cash, remove bankAccountId
          if (field === "type" && value === "cash") {
            delete updated.bankAccountId;
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

  const recalcItemTotals = (
    item: SaleItem & { product: Product },
    overrides: Partial<SaleItem & { shopQuantity?: number; warehouseQuantity?: number }> = {}
  ) => {
    const updated = { ...item, ...overrides };
    const quantity = updated.quantity ?? 0;
    const effectivePrice =
      updated.customPrice && updated.customPrice > 0 ? updated.customPrice : updated.unitPrice;
    const discountAmount =
      updated.discountType === "value"
        ? (updated.discount || 0)
        : (effectivePrice * quantity * (updated.discount || 0)) / 100;
    const taxAmount =
      updated.taxType === "value"
        ? (updated.tax || 0)
        : (effectivePrice * quantity * (updated.tax || 0)) / 100;

    const total = (effectivePrice * quantity) - discountAmount + taxAmount;

    return { ...updated, total };
  };

  const addProductToCart = (product: Product) => {
    const existingItem = selectedProducts.find(
      (item) => item.productId === product.id
    );

    if (existingItem) {
      setSelectedProducts(
        selectedProducts.map((item) =>
          item.productId === product.id
            ? (() => {
                const nextShopQty = (item.shopQuantity || 0) + 1;
                if (nextShopQty > (item.product.shopQuantity || 0)) {
                  showError(`Shop stock for ${item.productName} is only ${item.product.shopQuantity || 0}`);
                  return item;
                }
                return recalcItemTotals(item as any, {
                  shopQuantity: nextShopQty,
                  warehouseQuantity: item.warehouseQuantity || 0,
                  quantity: nextShopQty + (item.warehouseQuantity || 0),
                });
              })()
            : item
        )
      );
    } else {
      const baseItem = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        shopQuantity: 1,
        warehouseQuantity: 0,
        unitPrice: product.salePrice || 0,
        customPrice: undefined,
        discount: undefined,
        discountType: "percent",
        tax: undefined,
        taxType: "percent",
        total: (product.salePrice || 0) * 1,
        product,
      } as SaleItem & { product: Product };

      setSelectedProducts([...selectedProducts, recalcItemTotals(baseItem)]);
    }
    setSearchTerm("");
  };

  const updateItemPrice = (productId: string, price: number | undefined) => {
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          return recalcItemTotals(item as any, {
            customPrice: (price !== undefined && price > 0) ? price : undefined,
            unitPrice: item.unitPrice,
          });
        }
        return item;
      })
    );
  };

  const updateItemLocationQuantity = (
    productId: string,
    location: "shop" | "warehouse",
    rawQty: string
  ) => {
    const parsed = rawQty === "" ? null : parseInt(rawQty, 10);
    const quantity = (rawQty === "" || Number.isNaN(parsed)) ? null : parsed;
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          const availableShop = item.product?.shopQuantity ?? 0;
          const availableWarehouse = item.product?.warehouseQuantity ?? 0;
          if (location === "shop" && quantity !== null && quantity > availableShop) {
            showError(`Shop stock available for ${item.productName} is ${availableShop}`);
            return item;
          }
          if (location === "warehouse" && quantity !== null && quantity > availableWarehouse) {
            showError(`Warehouse stock available for ${item.productName} is ${availableWarehouse}`);
            return item;
          }
          const shopQty = location === "shop" ? (quantity ?? 0) : (item.shopQuantity ?? 0);
          const warehouseQty = location === "warehouse" ? (quantity ?? 0) : (item.warehouseQuantity ?? 0);
          const totalQty = shopQty + warehouseQty;
          return recalcItemTotals(item as any, {
            shopQuantity: location === "shop" ? (quantity ?? undefined) : item.shopQuantity,
            warehouseQuantity: location === "warehouse" ? (quantity ?? undefined) : item.warehouseQuantity,
            quantity: totalQty > 0 ? totalQty : 1,
          });
        }
        return item;
      })
    );
  };

  const updateItemDiscount = (productId: string, discount: number | undefined) => {
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          return recalcItemTotals(item as any, { discount: discount ?? undefined });
        }
        return item;
      })
    );
  };

  const updateItemDiscountType = (productId: string, discountType: "percent" | "value") => {
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          return recalcItemTotals(item as any, { discountType });
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
    const subtotal = selectedProducts.reduce((sum, item) => {
      const effectivePrice = item.customPrice || item.unitPrice;
      return sum + effectivePrice * item.quantity;
    }, 0);
    
    // Calculate item-level discounts and taxes
    const itemDiscounts = selectedProducts.reduce((sum, item) => {
      const effectivePrice = item.customPrice || item.unitPrice;
      const discount = item.discount ?? 0;
      if (item.discountType === "value") {
        return sum + discount;
      } else {
        return sum + (effectivePrice * item.quantity * discount / 100);
      }
    }, 0);
    
    const itemTaxes = selectedProducts.reduce((sum, item) => {
      const effectivePrice = item.customPrice || item.unitPrice;
      const tax = item.tax ?? 0;
      if (item.taxType === "value") {
        return sum + tax;
      } else {
        return sum + (effectivePrice * item.quantity * tax / 100);
      }
    }, 0);
    
    // Calculate global discount based on type
    let globalDiscountAmount = 0;
    if (globalDiscount !== null && globalDiscount !== undefined) {
      if (globalDiscountType === "value") {
        globalDiscountAmount = globalDiscount;
      } else {
        globalDiscountAmount = (subtotal * globalDiscount) / 100;
      }
    }
    
    // Calculate global tax based on type
    let globalTaxAmount = 0;
    if (globalTax !== null && globalTax !== undefined) {
      if (globalTaxType === "value") {
        globalTaxAmount = globalTax;
      } else {
        const afterDiscount = subtotal - itemDiscounts - globalDiscountAmount;
        globalTaxAmount = (afterDiscount * globalTax) / 100;
      }
    }

    const totalDiscount = itemDiscounts + globalDiscountAmount;
    const totalTax = itemTaxes + globalTaxAmount;
    const total = Math.max(0, subtotal - totalDiscount + totalTax);

    return { subtotal, discountAmount: totalDiscount, taxAmount: totalTax, total };
  };

  const generateBillNumber = () => {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
    const count = sales.filter((s) =>
      s.billNumber.startsWith(`BILL-${dateStr}`)
    ).length;
    return `BILL-${dateStr}-${String(count + 1).padStart(4, "0")}`;
  };

  const onSubmit = async (data: any) => {
    if (selectedProducts.length === 0) {
      showError("Please add at least one product");
      return;
    }

    setShowErrors(true);
    setBackendErrors({});
    setFormError("");

    // Validate quantities > 0
    for (const item of selectedProducts) {
      const shopQty = item.shopQuantity || 0;
      const warehouseQty = item.warehouseQuantity || 0;
      const totalQty = shopQty + warehouseQty;
      if (!totalQty || totalQty <= 0) {
        showError(`Quantity for "${item.productName}" must be greater than 0`);
        return;
      }
      const availableShop = item.product?.shopQuantity ?? 0;
      const availableWarehouse = item.product?.warehouseQuantity ?? 0;
      if (shopQty > availableShop) {
        showError(`Shop stock for "${item.productName}" is only ${availableShop}`);
        return;
      }
      if (warehouseQty > availableWarehouse) {
        showError(`Warehouse stock for "${item.productName}" is only ${availableWarehouse}`);
        return;
      }
    }

    const { subtotal, discountAmount, taxAmount, total } = calculateTotals();
    const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
    
    if (totalPaid > total) {
      showError("Total paid amount cannot exceed total amount");
      return;
    }

    // Validate payments
    for (const payment of payments) {
      if (payment.amount === undefined || payment.amount === null || payment.amount <= 0) {
        showError("Payment amount must be greater than 0");
        return;
      }
      if (payment.type === "bank_transfer" && !payment.bankAccountId) {
        showError("Please select a bank account for bank transfer payment");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const saleItems: SaleItem[] = selectedProducts.map((item) => {
        const effectivePrice = item.customPrice || item.unitPrice;
        const totalQty = (item.shopQuantity || 0) + (item.warehouseQuantity || 0) || item.quantity;
        const taxAmount = item.taxType === "value"
          ? item.tax
          : (effectivePrice * totalQty * (item.tax || globalTax || 0) / 100);
        
        return {
          productId: item.productId,
          productName: item.productName,
          quantity: totalQty,
          shopQuantity: item.shopQuantity || 0,
          warehouseQuantity: item.warehouseQuantity || 0,
          unitPrice: item.unitPrice,
          customPrice: item.customPrice,
          discount: item.discount,
          discountType: item.discountType || "percent",
          tax: taxAmount,
          taxType: item.taxType || "percent",
          total: item.total,
        };
      });

      const billNumber = generateBillNumber();

      await addSale({
        billNumber,
        items: saleItems,
        subtotal,
        discount: discountAmount,
        discountType: globalDiscountType,
        tax: taxAmount,
        taxType: globalTaxType,
        total,
        paymentType: payments[0]?.type || "cash", // Required for backward compatibility
        payments: payments.map(p => ({
          type: p.type,
          amount: p.amount,
          bankAccountId: p.bankAccountId,
        })),
        customerName: data.customerName.trim(),
        customerPhone: data.customerPhone || undefined,
        customerCity: data.customerCity || undefined,
        date: data.date,
        userId: currentUser!.id,
        userName: currentUser!.name,
        status: "completed",
      });

      // Redirect to bill print page
      navigate(`/sales/bill/${billNumber}`);
    } catch (err: any) {
      const backendErr = err?.response?.data?.error;
      if (backendErr && typeof backendErr === "object") {
        const mapped: Record<string, string> = {};
        Object.entries(backendErr).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            mapped[key.replace("data.", "")] = String(value[0]);
          }
        });
        setBackendErrors(mapped);
        setFormError("Please fix the highlighted errors.");
        showError("Please fix the highlighted errors.");
      } else {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to create sale. Please try again.";
        setFormError(msg);
        showError(msg);
      }
      console.error("Error creating sale:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const { subtotal, total } = calculateTotals();
  const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
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
            {formError && (
              <div className="mb-4 p-3 text-sm text-error-600 bg-error-50 border border-error-200 rounded dark:text-error-300 dark:bg-error-900/20 dark:border-error-800">
                {formError}
              </div>
            )}
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
                          {product.category || "N/A"} - Shop: {product.shopQuantity || 0} | Warehouse: {product.warehouseQuantity || 0}
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
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[100px] max-w-[100px]">
                        Product
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[140px] max-w-[160px]">
                        Custom Price
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[110px] max-w-[130px]">
                        Shop Qty
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[130px] max-w-[150px]">
                        Warehouse Qty
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[180px] max-w-[220px]" colSpan={2}>
                        Discount
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[100px] max-w-[120px]">
                        Total
                      </th>
                      <th className="p-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[80px] max-w-[100px]">
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
                        <td className="p-2 min-w-[100px] max-w-[150px]">
                          <p className="font-medium text-gray-800 dark:text-white">
                            {item.productName}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            Rs. {item.unitPrice.toFixed(2)}
                          </p>
                        </td>
                        <td className="p-2 whitespace-nowrap min-w-[140px] max-w-[160px]">
                          <Input
                            type="number"
                            min="0"
                            step={0.01}
                            placeholder="Custom"
                            value={item.customPrice ?? ""}
                            onChange={(e) => {
                              const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                              updateItemPrice(item.productId, isNaN(value as any) ? undefined : value);
                            }}
                            className="w-full min-w-[112px] max-w-[144px]"
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap min-w-[110px] max-w-[130px]">
                          <Input
                            type="number"
                            min="0"
                            max={(item.product.shopQuantity || 0).toString()}
                            value={item.shopQuantity !== null && item.shopQuantity !== undefined ? item.shopQuantity : ""}
                            onChange={(e) => updateItemLocationQuantity(item.productId, "shop", e.target.value)}
                            className="w-full min-w-[96px] max-w-[112px]"
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap min-w-[130px] max-w-[150px]">
                          <Input
                            type="number"
                            min="0"
                            max={(item.product.warehouseQuantity || 0).toString()}
                            value={item.warehouseQuantity !== null && item.warehouseQuantity !== undefined ? item.warehouseQuantity : ""}
                            onChange={(e) => updateItemLocationQuantity(item.productId, "warehouse", e.target.value)}
                            className="w-full min-w-[96px] max-w-[112px]"
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap min-w-[180px] max-w-[220px]" colSpan={2}>
                          <TaxDiscountInput
                            value={item.discount}
                            type={item.discountType || "percent"}
                            onValueChange={(value) => updateItemDiscount(item.productId, value ?? undefined)}
                            onTypeChange={(type) => updateItemDiscountType(item.productId, type)}
                            placeholder="0"
                            min={0}
                            step={0.01}
                            className="w-full min-w-[160px] max-w-[200px]"
                          />
                        </td>
                        <td className="p-2 font-semibold text-gray-800 dark:text-white whitespace-nowrap min-w-[100px] max-w-[120px]">
                          Rs. {item.total.toFixed(2)}
                        </td>
                        <td className="p-2 whitespace-nowrap min-w-[80px] max-w-[100px]">
                          <div className="flex items-center justify-center gap-2 flex-nowrap">
                            <button
                              onClick={() => removeItem(item.productId)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20 flex-shrink-0"
                            >
                              <TrashBinIcon className="w-5 h-5" />
                            </button>
                          </div>
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
                <Label>
                  Customer Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  name="customerName"
                  value={customerName}
                  onChange={(e) => {
                    setValue("customerName", e.target.value);
                  }}
                  onBlur={register("customerName").onBlur}
                  placeholder="Enter customer name"
                  required
                  error={!!errors.customerName}
                  hint={errors.customerName?.message}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  name="customerPhone"
                  value={customerPhone}
                  onChange={(e) => {
                    setValue("customerPhone", e.target.value);
                  }}
                  onBlur={register("customerPhone").onBlur}
                  placeholder="Enter phone number"
                  error={!!errors.customerPhone}
                  hint={errors.customerPhone?.message}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  name="customerCity"
                  value={customerCity}
                  onChange={(e) => {
                    setValue("customerCity", e.target.value);
                  }}
                  onBlur={register("customerCity").onBlur}
                  placeholder="Enter city"
                  error={!!errors.customerCity}
                  hint={errors.customerCity?.message}
                />
              </div>
              <div>
                <Label>
                  Date <span className="text-error-500">*</span>
                </Label>
                <DatePicker
                  name="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setValue("date", e.target.value);
                  }}
                  onBlur={register("date").onBlur}
                  required
                  error={!!errors.date}
                  hint={errors.date?.message}
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
                      <Label>Payment Type  <span className="text-error-500">*</span></Label>
                      <Select
                        value={payment.type}
                        onChange={(value) =>
                          updatePayment(index, "type", value)
                        }
                        options={[
                          { value: "cash", label: "Cash" },
                          { value: "bank_transfer", label: "Bank Transfer" },
                        ]}
                      />
                    </div>
                    <div>
                      <Label>Amount  <span className="text-error-500">*</span></Label>
                    <Input
                      type="number"
                      min="0"
                      max={String(remainingBalance + (payment.amount ?? 0))}
                      value={(payment.amount !== null && payment.amount !== undefined && payment.amount !== 0) ? String(payment.amount) : ""}
                      onChange={(e) => {
                        const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                        updatePayment(index, "amount", isNaN(value as any) || value === null ? undefined : value);
                      }}
                      placeholder="Enter amount"
                      required
                      error={
                        (showErrors && (payment.amount === undefined || payment.amount === null || payment.amount <= 0)) ||
                        !!backendErrors[`payments.${index}.amount`]
                      }
                      hint={
                        (showErrors && (payment.amount === undefined || payment.amount === null || payment.amount <= 0)
                          ? "Amount must be greater than 0"
                          : undefined) ||
                        backendErrors[`payments.${index}.amount`]
                      }
                    />
                    </div>
                    {payment.type === "bank_transfer" && (
                      <div>
                        <Label>Select Bank Account <span className="text-error-500">*</span></Label>
                        <Select
                          value={payment.bankAccountId || ""}
                          onChange={(value) =>
                            updatePayment(index, "bankAccountId", value)
                          }
                          options={[
                            ...bankAccounts
                              .filter((acc) => acc.isActive)
                              .map((acc) => ({
                                value: acc.id,
                                label: `${acc.accountName} - ${acc.bankName}${acc.isDefault ? " (Default)" : ""}`,
                              })),
                          ]}
                        />
                        {((showErrors && payment.type === "bank_transfer" && !payment.bankAccountId) ||
                          backendErrors[`payments.${index}.bankAccountId`]) && (
                          <p className="mt-1 text-xs text-error-500">
                            {backendErrors[`payments.${index}.bankAccountId`] ||
                              "Bank account is required for bank transfer"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {totalPaid > total && (
                <div className="p-2 text-sm text-error-500 bg-error-50 border border-error-200 rounded dark:bg-error-900/20 dark:border-error-700">
                  Total paid amount cannot exceed total amount.
                </div>
              )}
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
              <div className="flex items-center justify-between">
                <Label className="mb-0 whitespace-nowrap">Discount:</Label>
                <div className="">
                  <TaxDiscountInput
                    value={globalDiscount}
                    type={globalDiscountType}
                    onValueChange={(value) => setGlobalDiscount(value ?? null)}
                    onTypeChange={(type) => setGlobalDiscountType(type)}
                    placeholder="0"
                    min={0}
                    step={0.01}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="mb-0 whitespace-nowrap">Tax:</Label>
                <div className="">
                  <TaxDiscountInput
                    value={globalTax}
                    type={globalTaxType}
                    onValueChange={(value) => setGlobalTax(value ?? null)}
                    onTypeChange={(type) => setGlobalTaxType(type)}
                    placeholder="0"
                    min={0}
                    step={0.01}
                  />
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
              onClick={handleFormSubmit(onSubmit)}
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


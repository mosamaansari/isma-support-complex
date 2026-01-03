import { useState, useEffect, useRef } from "react";
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
import { getTodayDate, formatDateToString, formatDateToLocalISO } from "../../utils/dateHelpers";
import { extractErrorMessage, extractValidationErrors } from "../../utils/errorHandler";
import { restrictDecimalInput } from "../../utils/numberHelpers";

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
  const { products, currentUser, addSale, sales, loading, error, bankAccounts, refreshBankAccounts, cards, refreshCards, refreshProducts } = useData();
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
  const bankAccountsLoadedRef = useRef(false);

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
    // Set initial date value in form
    setValue("date", getTodayDate());

    // Load products only when on this page
    if (products.length === 0 && !loading) {
      refreshProducts(1, 100).catch(console.error); // Load more products for selection
    }
    // Load bank accounts only once on mount to prevent duplicate API calls
    if (!bankAccountsLoadedRef.current && bankAccounts.length === 0) {
      bankAccountsLoadedRef.current = true;
      refreshBankAccounts();
    } else if (bankAccounts.length > 0) {
      bankAccountsLoadedRef.current = true;
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
        (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()))
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
    const priceType: "single" | "dozen" = (updated as any).priceType || "single";
    const enteredShopQty = Number((updated as any).shopQuantity ?? 0);
    const enteredWarehouseQty = Number((updated as any).warehouseQuantity ?? 0);
    const qtyMultiplier = priceType === "dozen" ? 12 : 1;
    const quantityUnits = (enteredShopQty + enteredWarehouseQty) * qtyMultiplier;

    // Use customPrice if set and > 0, otherwise fall back to unitPrice for calculations
    // But keep customPrice as null if it was cleared (to show empty in input)
    // Round effectivePrice only for calculations, don't modify customPrice
    const rawPrice = updated.customPrice !== null && updated.customPrice !== undefined && updated.customPrice > 0
      ? updated.customPrice
      : updated.unitPrice;
    const effectivePrice = Math.round(rawPrice * 100) / 100; // Round to 2 decimals for calculations only

    // Ensure discount and discountType are properly set
    const discount = updated.discount ?? 0;
    const discountType = updated.discountType || "percent";

    // Calculate subtotal first (rounded to 2 decimals)
    const subtotal = Math.round((effectivePrice * quantityUnits) * 100) / 100;

    // Calculate discount amount based on type
    let discountAmount = 0;
    if (discount > 0) {
      if (discountType === "value") {
        discountAmount = Math.round(discount * 100) / 100; // Round to 2 decimals
      } else {
        discountAmount = Math.round((subtotal * discount / 100) * 100) / 100; // Round to 2 decimals
      }
    }

    const total = Math.round((subtotal - discountAmount) * 100) / 100; // Round to 2 decimals

    // Preserve priceSingle and priceDozen if they were explicitly set in overrides (user typed values)
    // Otherwise calculate from customPrice or use existing values
    let displayPriceSingle: number | undefined;
    let displayPriceDozen: number | undefined;

    if (updated.customPrice === null || updated.customPrice === undefined) {
      // Price was cleared
      displayPriceSingle = undefined;
      displayPriceDozen = undefined;
    } else {
      // Use priceSingle/priceDozen from updated if they exist (preserves user-typed values)
      // Otherwise calculate from customPrice
      if (updated.priceSingle !== undefined && updated.priceSingle !== null) {
        displayPriceSingle = updated.priceSingle; // Use user-typed value
      } else {
        displayPriceSingle = updated.customPrice; // Calculate from customPrice
      }

      if (updated.priceDozen !== undefined && updated.priceDozen !== null) {
        displayPriceDozen = updated.priceDozen; // Use user-typed value
      } else {
        displayPriceDozen = displayPriceSingle !== undefined ? displayPriceSingle * 12 : undefined; // Calculate from priceSingle
      }
    }

    return {
      ...updated,
      quantity: quantityUnits,
      discount: discount,
      discountType: discountType,
      priceSingle: displayPriceSingle,
      priceDozen: displayPriceDozen,
      total
    };
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
              const priceType: "single" | "dozen" = (item as any).priceType || "single";
              const nextShopUnits = priceType === "dozen" ? nextShopQty * 12 : nextShopQty;
              if (nextShopUnits > (item.product.shopQuantity || 0)) {
                showError(`Shop stock for ${item.productName} is only ${item.product.shopQuantity || 0}`);
                return item;
              }
              return recalcItemTotals(item as any, {
                shopQuantity: nextShopQty,
                warehouseQuantity: item.warehouseQuantity || 0,
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
        priceType: "single",
        priceSingle: product.salePrice || 0,
        priceDozen: (product.salePrice || 0) * 12,
        discount: undefined,
        discountType: "percent",
        total: (product.salePrice || 0) * 1,
        product,
      } as SaleItem & { product: Product };

      setSelectedProducts([...selectedProducts, recalcItemTotals(baseItem)]);
    }
    setSearchTerm("");
  };

  const updateItemPriceType = (productId: string, priceType: "single" | "dozen") => {
    setSelectedProducts(
      selectedProducts.map((item: any) => {
        if (item.productId !== productId) return item;

        const unitPrice = item.unitPrice || 0;
        // If customPrice is null, keep it null (user cleared the price)
        // Otherwise use customPrice or fall back to unitPrice
        const currentSingle =
          item.customPrice !== undefined && item.customPrice !== null && item.customPrice > 0
            ? item.customPrice
            : (item.customPrice === null ? undefined : unitPrice);
        const currentDozen = currentSingle !== undefined && currentSingle !== null ? (item.priceDozen ?? currentSingle * 12) : undefined;

        return recalcItemTotals(item, {
          priceType,
          customPrice: item.customPrice, // Preserve customPrice (null if cleared)
          priceSingle: currentSingle,
          priceDozen: currentDozen,
          // Keep entered qty the same; meaning changes based on priceType (single vs dozen)
          // (Dozen mode: 1 means 1 dozen; Single mode: 1 means 1 unit)
          shopQuantity: item.shopQuantity,
          warehouseQuantity: item.warehouseQuantity,
        } as any);
      })
    );
  };

  const updateItemPrice = (productId: string, price: number | undefined) => {
    setSelectedProducts(
      selectedProducts.map((item: any) => {
        if (item.productId === productId) {
          const priceType: "single" | "dozen" = item.priceType || "single";
          // Allow null/undefined/empty during editing - validation happens on submit
          // Set to null if value is invalid (undefined, null, NaN, negative, or 0)
          if (price === undefined || price === null || price === 0 || isNaN(Number(price)) || price < 0) {
            return recalcItemTotals(item as any, {
              customPrice: null, // Set to null to allow clearing, will use unitPrice for calculations
              priceSingle: undefined, // Set to undefined so input shows empty
              priceDozen: undefined, // Set to undefined so input shows empty
            } as any);
          }
          // Preserve exact value user typed - don't round during input
          // Rounding will happen in recalcItemTotals for calculations only
          let priceSingle: number;
          let priceDozen: number;

          if (priceType === "dozen") {
            // User entered dozen price (e.g., "1" means 1 dozen = 12 units)
            priceDozen = price; // Keep exact value: if user types "1", store 1
            priceSingle = price / 12; // Calculate unit price: 1/12 = 0.08333...
          } else {
            // User entered single/unit price (e.g., "1" means 1 unit)
            priceSingle = price; // Keep exact value: if user types "1", store 1
            priceDozen = price * 12; // Calculate dozen price: 1*12 = 12
          }

          return recalcItemTotals(item as any, {
            customPrice: priceSingle, // per-unit (will be rounded in recalcItemTotals for calculations)
            priceSingle, // Display exact value user typed
            priceDozen, // Display calculated value
          } as any);
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
          const priceType: "single" | "dozen" = (item as any).priceType || "single";
          const availableShop = item.product?.shopQuantity ?? 0;
          const availableWarehouse = item.product?.warehouseQuantity ?? 0;
          const qtyMultiplier = priceType === "dozen" ? 12 : 1;
          const unitsToCheck = quantity !== null ? quantity * qtyMultiplier : null;
          if (location === "shop" && unitsToCheck !== null && unitsToCheck > availableShop) {
            showError(`Shop stock available for ${item.productName} is ${availableShop}`);
            return item;
          }
          if (location === "warehouse" && unitsToCheck !== null && unitsToCheck > availableWarehouse) {
            showError(`Warehouse stock available for ${item.productName} is ${availableWarehouse}`);
            return item;
          }
          const shopEntered = location === "shop" ? (quantity ?? 0) : (item.shopQuantity ?? 0);
          const warehouseEntered = location === "warehouse" ? (quantity ?? 0) : (item.warehouseQuantity ?? 0);
          const totalUnits = (shopEntered + warehouseEntered) * (priceType === "dozen" ? 12 : 1);
          return recalcItemTotals(item as any, {
            shopQuantity: location === "shop" ? (quantity ?? undefined) : item.shopQuantity,
            warehouseQuantity: location === "warehouse" ? (quantity ?? undefined) : item.warehouseQuantity,
            quantity: totalUnits > 0 ? totalUnits : 1,
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
    // Use item.total which is already calculated with proper rounding in recalcItemTotals
    const subtotal = Math.round(selectedProducts.reduce((sum, item: any) => {
      return sum + (item.total || 0);
    }, 0) * 100) / 100; // Round to 2 decimals

    // Calculate global discount based on type (rounded to 2 decimals)
    let globalDiscountAmount = 0;
    if (globalDiscount !== null && globalDiscount !== undefined) {
      if (globalDiscountType === "value") {
        globalDiscountAmount = Math.round(globalDiscount * 100) / 100;
      } else {
        globalDiscountAmount = Math.round((subtotal * globalDiscount / 100) * 100) / 100;
      }
    }

    // Calculate global tax based on type (rounded to 2 decimals)
    let globalTaxAmount = 0;
    if (globalTax !== null && globalTax !== undefined) {
      if (globalTaxType === "value") {
        globalTaxAmount = Math.round(globalTax * 100) / 100;
      } else {
        const afterDiscount = subtotal - globalDiscountAmount;
        globalTaxAmount = Math.round((afterDiscount * globalTax / 100) * 100) / 100;
      }
    }

    const total = Math.round(Math.max(0, subtotal - globalDiscountAmount + globalTaxAmount) * 100) / 100;

    return { subtotal, discountAmount: globalDiscountAmount, taxAmount: globalTaxAmount, total };
  };

  const generateBillNumber = () => {
    const today = new Date();
    const dateStr = formatDateToString(today).replace(/-/g, "");
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

    // Validate quantities > 0 and prices > 0
    for (const item of selectedProducts as any[]) {
      const priceType: "single" | "dozen" = item.priceType || "single";
      const shopEntered = Number(item.shopQuantity || 0);
      const warehouseEntered = Number(item.warehouseQuantity || 0);
      const totalQty = (shopEntered + warehouseEntered) * (priceType === "dozen" ? 12 : 1);
      if (!totalQty || totalQty <= 0) {
        showError(`Quantity for "${item.productName}" must be greater than 0`);
        return;
      }

      // Validate price - must be greater than 0
      const effectivePrice = item.customPrice ?? item.unitPrice ?? 0;
      if (!effectivePrice || effectivePrice <= 0) {
        showError(`Price for "${item.productName}" must be greater than 0`);
        return;
      }

      const availableShop = item.product?.shopQuantity ?? 0;
      const availableWarehouse = item.product?.warehouseQuantity ?? 0;
      const shopUnits = priceType === "dozen" ? shopEntered * 12 : shopEntered;
      const warehouseUnits = priceType === "dozen" ? warehouseEntered * 12 : warehouseEntered;
      if (shopUnits > availableShop) {
        showError(`Shop stock for "${item.productName}" is only ${availableShop}`);
        return;
      }
      if (warehouseUnits > availableWarehouse) {
        showError(`Warehouse stock for "${item.productName}" is only ${availableWarehouse}`);
        return;
      }
    }
    console.log("selectedProducts", selectedProducts)
    const { subtotal, total } = calculateTotals();
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
        const priceType: "single" | "dozen" = (item as any).priceType || "single";
        const shopEntered = Number(item.shopQuantity || 0);
        const warehouseEntered = Number(item.warehouseQuantity || 0);
        const shopQtyUnits = priceType === "dozen" ? shopEntered * 12 : shopEntered;
        const warehouseQtyUnits = priceType === "dozen" ? warehouseEntered * 12 : warehouseEntered;
        const totalQty = shopQtyUnits + warehouseQtyUnits || item.quantity;

        // Recalculate total to ensure accuracy (matching backend logic)
        const effectivePrice = item.customPrice ?? item.unitPrice;
        // Round subtotal to 2 decimals
        const itemSubtotal = Math.round((effectivePrice * totalQty) * 100) / 100;
        const discount = item.discount ?? 0;
        const discountType = item.discountType || "percent";

        let itemDiscount = 0;
        if (discount > 0) {
          if (discountType === "value") {
            itemDiscount = Math.round(discount * 100) / 100; // Round to 2 decimals
          } else {
            itemDiscount = Math.round((itemSubtotal * discount / 100) * 100) / 100; // Round to 2 decimals
          }
        }

        const itemTotal = Math.round((itemSubtotal - itemDiscount) * 100) / 100; // Round to 2 decimals

        return {
          productId: item.productId,
          productName: item.productName,
          quantity: totalQty,
          shopQuantity: shopQtyUnits,
          warehouseQuantity: warehouseQtyUnits,
          unitPrice: item.unitPrice,
          customPrice: item.customPrice,
          priceType,
          priceSingle: (item as any).priceSingle ?? (item.customPrice ?? item.unitPrice),
          priceDozen: (item as any).priceDozen ?? ((item.customPrice ?? item.unitPrice) * 12),
          discount: discount,
          discountType: discountType,
          total: itemTotal,
        };
      });

      const billNumber = generateBillNumber();

      // Combine selected date with current time (using local timezone)
      const dateParts = data.date.split("-");
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
      const day = parseInt(dateParts[2]);
      const now = new Date();
      // Create date in local timezone with current time
      const dateTime = new Date(year, month, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      // Use local ISO format to avoid timezone conversion
      const dateIsoString = formatDateToLocalISO(dateTime);

      const createdSale = await addSale({
        billNumber,
        items: saleItems,
        subtotal,
        discount: globalDiscount || 0,
        discountType: globalDiscountType,
        tax: globalTax || 0,
        taxType: globalTaxType,
        total,
        paymentType: payments[0]?.type || "cash", // Required for backward compatibility
        payments: payments.map(p => ({
          type: p.type,
          amount: p.amount,
          bankAccountId: p.bankAccountId,
          date: dateIsoString, // Always use combined date and time
        })),
        customerName: data.customerName.trim(),
        customerPhone: data.customerPhone || undefined,
        customerCity: data.customerCity || undefined,
        date: dateIsoString,
        userId: currentUser!.id,
        userName: currentUser!.name,
        status: "completed",
      });

      // Redirect to bill print page using the bill number from the backend
      navigate(`/sales/bill/${createdSale.billNumber}`);
    } catch (err: any) {
      const validationErrors = extractValidationErrors(err);
      if (validationErrors) {
        const mapped: Record<string, string> = {};
        Object.entries(validationErrors).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            mapped[key.replace("data.", "")] = String(value[0]);
          }
        });
        setBackendErrors(mapped);
        setFormError("Please fix the highlighted errors.");
        showError("Please fix the highlighted errors.");
      } else {
        const msg = extractErrorMessage(err) || "Failed to create sale. Please try again.";
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
      <div className="grid grid-cols-12 gap-3 sm:gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="p-3 sm:p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
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
              placeholder="Search products by name or brand..."
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
                          {product.brand || "N/A"} - Shop: {product.shopQuantity || 0} | Warehouse: {product.warehouseQuantity || 0}
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

          <div className="p-3 sm:p-4 md:p-6 mt-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
              Selected Products
            </h2>
            {selectedProducts.length === 0 ? (
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                No products selected. Search and add products above.
              </p>
            ) : (
              <div className="table-container overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full min-w-[1000px] table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[250px]">
                        Product
                      </th>
                      <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[140px]">
                        Price Type
                      </th>
                      <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[160px]">
                        Price
                      </th>
                      <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[100px]">
                        {selectedProducts.some(item => ((item as any).priceType || "single") === "dozen")
                          ? "Shop Qty"
                          : "Shop Qty"}
                      </th>
                      <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[100px]">
                        {selectedProducts.some(item => ((item as any).priceType || "single") === "dozen")
                          ? "Warehouse Qty"
                          : "Warehouse Qty"}
                      </th>
                      <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[160px]" colSpan={2}>
                        Discount
                      </th>
                      <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[140px]">
                        Total
                      </th>
                      <th scope="col" className="p-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[80px]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                    {selectedProducts.map((item) => (
                      <tr
                        key={item.productId}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="p-3 overflow-hidden">
                          <div className="flex flex-col max-w-full">
                            <p className="font-medium text-gray-900 dark:text-white text-sm truncate" title={item.productName}>
                              {item.productName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              Rs. {item.unitPrice.toFixed(2)}
                            </p>
                          </div>
                        </td>
                        <td className="p-3">
                          <Select
                            value={((item as any).priceType || "single") as any}
                            onChange={(value) => updateItemPriceType(item.productId, value as any)}
                            options={[
                              { value: "single", label: "Per Qty" },
                              { value: "dozen", label: "Dozen" },
                            ]}
                          />
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min="0"
                              step={0.01}
                              placeholder={((item as any).priceType || "single") === "dozen" ? "Dozen price" : "Single price"}
                              value={
                                ((item as any).priceType || "single") === "dozen"
                                  ? ((item as any).priceDozen !== undefined && (item as any).priceDozen !== null
                                    ? String((item as any).priceDozen)
                                    : "")
                                  : ((item as any).priceSingle !== undefined && (item as any).priceSingle !== null
                                    ? String((item as any).priceSingle)
                                    : "")
                              }
                              onInput={restrictDecimalInput}
                              onChange={(e) => {
                                // Handle empty string as null to allow clearing
                                if (e.target.value === "" || e.target.value === null) {
                                  updateItemPrice(item.productId, undefined);
                                  return;
                                }
                                // Parse the value but don't round during typing - preserve what user types
                                const numValue = parseFloat(e.target.value);
                                if (isNaN(numValue)) {
                                  updateItemPrice(item.productId, undefined);
                                  return;
                                }
                                // Pass the raw value, rounding will happen in updateItemPrice
                                updateItemPrice(item.productId, numValue);
                              }}
                              className="w-full text-sm"
                            />
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Unit: Rs. {(((item as any).priceSingle ?? (item.customPrice ?? item.unitPrice)) || 0).toFixed(2)}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min="0"
                              max={(((item as any).priceType || "single") === "dozen"
                                ? Math.floor((item.product.shopQuantity || 0) / 12)
                                : (item.product.shopQuantity || 0)
                              ).toString()}
                              value={item.shopQuantity !== null && item.shopQuantity !== undefined ? item.shopQuantity : ""}
                              onChange={(e) => updateItemLocationQuantity(item.productId, "shop", e.target.value)}
                              className="w-full text-sm"
                              placeholder={((item as any).priceType || "single") === "dozen" ? "Dozen" : "Units"}
                            />
                            {((item as any).priceType || "single") === "dozen" && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Units: {((item.shopQuantity || 0) * 12).toFixed(0)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min="0"
                              max={(((item as any).priceType || "single") === "dozen"
                                ? Math.floor((item.product.warehouseQuantity || 0) / 12)
                                : (item.product.warehouseQuantity || 0)
                              ).toString()}
                              value={item.warehouseQuantity !== null && item.warehouseQuantity !== undefined ? item.warehouseQuantity : ""}
                              onChange={(e) => updateItemLocationQuantity(item.productId, "warehouse", e.target.value)}
                              className="w-full text-sm"
                              placeholder={((item as any).priceType || "single") === "dozen" ? "Dozen" : "Units"}
                            />
                            {((item as any).priceType || "single") === "dozen" && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Units: {((item.warehouseQuantity || 0) * 12).toFixed(0)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3" colSpan={2}>
                          <TaxDiscountInput
                            value={item.discount}
                            type={item.discountType || "percent"}
                            onValueChange={(value) => updateItemDiscount(item.productId, value ?? undefined)}
                            onTypeChange={(type) => updateItemDiscountType(item.productId, type)}
                            placeholder="0"
                            min={0}
                            step={0.01}
                            className="w-full"
                          />
                        </td>
                        <td className="p-3">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white break-all">
                            Rs. {item.total.toFixed(2)}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            title="Remove item"
                          >
                            <TrashBinIcon className="w-5 h-5 inline-block" />
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
          <div className="p-3 sm:p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
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
                  disabled={true}
                  error={!!errors.date}
                  hint={errors.date?.message}
                />
              </div>
            </div>

            <h2 className="mt-4 sm:mt-6 mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
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

            <h2 className="mt-4 sm:mt-6 mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
              Bill Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Subtotal:</span>
                <span className="font-medium text-sm sm:text-base text-gray-800 dark:text-white price-responsive">
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
                <span className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
                  Total:
                </span>
                <span className="text-base sm:text-lg font-bold text-brand-600 dark:text-brand-400 price-responsive">
                  Rs. {total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Total Paid:</span>
                <span className="font-medium text-sm sm:text-base text-gray-800 dark:text-white price-responsive">
                  Rs. {totalPaid.toFixed(2)}
                </span>
              </div>
              {remainingBalance > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Remaining:</span>
                  <span className="font-medium text-sm sm:text-base text-red-600 dark:text-red-400 price-responsive">
                    Rs. {remainingBalance.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={handleFormSubmit(onSubmit)}
              className="w-full mt-6"
              size="sm"
              loading={isSubmitting}
              disabled={selectedProducts.length === 0 || isSubmitting}
            >
              Generate Bill
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}


import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
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
import { TrashBinIcon, PlusIcon, ChevronDownIcon, ChevronUpIcon } from "../../icons";
import api from "../../services/api";
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
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { products, currentUser, addSale, updateSale, sales, loading, error, bankAccounts, refreshBankAccounts, cards, refreshCards, refreshProducts } = useData();
  const { showError, showSuccess } = useAlert();
  const navigate = useNavigate();
  const [selectedProducts, setSelectedProducts] = useState<
    (SaleItem & { product: Product; rowId: string })[]
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
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(true);
  const [isBillSummaryOpen, setIsBillSummaryOpen] = useState(true);
  const [saleStatus, setSaleStatus] = useState<"completed" | "pending" | "cancelled" | null>(null);
  const [originalRowIds, setOriginalRowIds] = useState<Set<string>>(new Set());
  const [loadingSale, setLoadingSale] = useState(false);
  const [originalPaymentsLength, setOriginalPaymentsLength] = useState(0);

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
    // Payments are optional, don't add default payment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open collapsible sections when products are added
  useEffect(() => {
    if (selectedProducts.length > 0) {
      setIsPaymentDetailsOpen(true);
      setIsBillSummaryOpen(true);
    }
  }, [selectedProducts.length]);

  // Load sale data for edit
  useEffect(() => {
    if (isEdit && id) {
      setLoadingSale(true);
      api.getSale(id)
        .then((sale: any) => {
          // Store sale status
          setSaleStatus(sale.status || "pending");
          
          setValue("customerName", sale.customerName || "");
          setValue("customerPhone", sale.customerPhone || "");
          setValue("customerCity", sale.customerCity || "");
          const saleDate = sale.date ? new Date(sale.date).toISOString().split('T')[0] : getTodayDate();
          setDate(saleDate);
          setValue("date", saleDate);
          setGlobalTaxType((sale.taxType as "percent" | "value") || "percent");
          setGlobalTax(sale.tax ? Number(sale.tax) : null);
          setGlobalDiscountType((sale.discountType as "percent" | "value") || "percent");
          setGlobalDiscount(sale.discount ? Number(sale.discount) : null);
          setPayments((sale.payments || []) as SalePayment[]);
          setOriginalPaymentsLength((sale.payments || []).length);

          // Store original row IDs for pending sales (to prevent editing/deleting)
          const originalRowIdsSet = new Set<string>();

          // Load products for items
          const itemsWithProducts = sale.items.map((item: any) => {
            const product = products.find(p => p.id === item.productId);
            const priceType: "single" | "dozen" = item.priceType || "single";
            const rawShopQty = Number(item.shopQuantity || 0);
            const rawWarehouseQty = Number(item.warehouseQuantity || 0);
            const displayShopQty = priceType === "dozen" ? rawShopQty / 12 : rawShopQty;
            const displayWarehouseQty = priceType === "dozen" ? rawWarehouseQty / 12 : rawWarehouseQty;
            const rowId = item.productId; // Use productId as rowId for original items
            originalRowIdsSet.add(rowId);
            return {
              ...item,
              productId: item.productId?.trim() || item.productId,
              rowId,
              priceType,
              priceSingle: item.priceSingle ?? item.unitPrice,
              priceDozen: item.priceDozen ?? ((item.priceSingle ?? item.unitPrice ?? 0) * 12),
              customPrice: item.customPrice ?? null,
              shopQuantity: displayShopQty,
              warehouseQuantity: displayWarehouseQty,
              quantity: priceType === "dozen"
                ? (displayShopQty + displayWarehouseQty) * 12
                : (displayShopQty + displayWarehouseQty),
              product: product || { id: item.productId, name: item.productName } as Product,
            };
          });
          setOriginalRowIds(originalRowIdsSet);
          setSelectedProducts(itemsWithProducts);
        })
        .catch((err) => {
          console.error("Error loading sale:", err);
          showError("Failed to load sale data");
          navigate("/sales");
        })
        .finally(() => setLoadingSale(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  if (loadingSale) {
    return (
      <>
        <PageMeta
          title={`${isEdit ? "Edit" : "Add"} Sale | Isma Sports Complex`}
          description={`${isEdit ? "Edit" : "Add"} sale entry`}
        />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-500">Loading sale data...</p>
          </div>
        </div>
      </>
    );
  }

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
    // For pending sales, prevent deleting old payments
    if (isEdit && saleStatus === "pending" && index < originalPaymentsLength) {
      showError("Cannot delete old payments for pending sales. You can only add new payments.");
      return;
    }
    // Allow removing payments even if it's the last one (payments are optional)
    setPayments(payments.filter((_, i) => i !== index));
  };

  const updatePayment = (index: number, field: keyof SalePayment, value: any) => {
    // For pending sales, prevent editing old payments
    if (isEdit && saleStatus === "pending" && index < originalPaymentsLength) {
      showError("Cannot edit old payments for pending sales. You can only add new payments.");
      return;
    }
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
    item: SaleItem & { product: Product; rowId: string },
    overrides: Partial<SaleItem & { shopQuantity?: number; warehouseQuantity?: number }> = {}
  ) => {
    const updated = { ...item, ...overrides };
    const priceType: "single" | "dozen" = (updated as any).priceType || "single";
    const enteredShopQty = Number((updated as any).shopQuantity ?? 0);
    const enteredWarehouseQty = Number((updated as any).warehouseQuantity ?? 0);
    const qtyMultiplier = priceType === "dozen" ? 12 : 1;
    const quantityUnits = (enteredShopQty + enteredWarehouseQty) * qtyMultiplier;

    // Use customPrice if set (even if 0), otherwise fall back to unitPrice for calculations
    // But keep customPrice as null if it was cleared (to show empty in input)
    // Don't round price early - round only the final result to avoid precision loss
    const rawPrice = updated.customPrice !== null && updated.customPrice !== undefined
      ? updated.customPrice
      : updated.unitPrice;
    const effectivePrice = rawPrice || 0; // Don't round here, round final result

    // Ensure discount and discountType are properly set
    const discount = updated.discount ?? 0;
    const discountType = updated.discountType || "percent";

    // Calculate subtotal first (rounded to 2 decimals at the end)
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
    // In edit mode with pending sales, check if there's a locked row for this product
    if (isEdit && saleStatus === "pending") {
      // Check if there's an unlocked (new) row for this product
      const unlockedRow = selectedProducts.find(
        (item) => item.productId === product.id && !originalRowIds.has(item.rowId)
      );
      
      if (unlockedRow) {
        // Update the unlocked row's quantity - but only if there's stock available
        const currentShopQty = unlockedRow.shopQuantity || 0;
        const currentWarehouseQty = unlockedRow.warehouseQuantity || 0;
        const priceType: "single" | "dozen" = (unlockedRow as any).priceType || "single";
        
        // Use fresh product data from search dropdown, not stale data from unlockedRow
        const availableShop = product.shopQuantity ?? 0;
        const availableWarehouse = product.warehouseQuantity ?? 0;
        const totalAvailable = availableShop + availableWarehouse;
        
        // If no stock available at all, don't auto-increment, just show message
        if (totalAvailable === 0) {
          showError(`No stock available for ${unlockedRow.productName}. Please manually adjust quantities.`);
          return;
        }
        
        // Try to increment shop quantity first, if not available try warehouse
        let nextShopQty = currentShopQty;
        let nextWarehouseQty = currentWarehouseQty;
        
        const qtyMultiplier = priceType === "dozen" ? 12 : 1;
        const incrementUnits = 1 * qtyMultiplier;
        
        if (availableShop >= (currentShopQty * qtyMultiplier) + incrementUnits) {
          // Add to shop
          nextShopQty = currentShopQty + 1;
          setSelectedProducts(
            selectedProducts.map((item) =>
              item.rowId === unlockedRow.rowId
                ? recalcItemTotals({ ...item, product } as any, {
                    shopQuantity: nextShopQty,
                    warehouseQuantity: nextWarehouseQty,
                  })
                : item
            )
          );
        } else if (availableWarehouse >= (currentWarehouseQty * qtyMultiplier) + incrementUnits) {
          // Add to warehouse
          nextWarehouseQty = currentWarehouseQty + 1;
          setSelectedProducts(
            selectedProducts.map((item) =>
              item.rowId === unlockedRow.rowId
                ? recalcItemTotals({ ...item, product } as any, {
                    shopQuantity: nextShopQty,
                    warehouseQuantity: nextWarehouseQty,
                  })
                : item
            )
          );
        } else {
          // No space in either location
          showError(`Insufficient stock for ${unlockedRow.productName}. Shop: ${availableShop}, Warehouse: ${availableWarehouse}`);
        }
      } else {
        // No unlocked row exists, create a new one (with empty quantities - user will fill them)
        const rowId = `${product.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const baseItem = {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          shopQuantity: null as any,
          warehouseQuantity: null as any,
          unitPrice: product.salePrice || 0,
          customPrice: undefined,
          priceType: "single",
          priceSingle: product.salePrice || 0,
          priceDozen: (product.salePrice || 0) * 12,
          discount: undefined,
          discountType: "percent",
          total: 0,
          product,
          rowId,
        } as SaleItem & { product: Product; rowId: string };

        setSelectedProducts([...selectedProducts, recalcItemTotals(baseItem)]);
      }
    } else {
      // Create mode: normal behavior - check if product exists
      const existingItem = selectedProducts.find(
        (item) => item.productId === product.id
      );

      if (existingItem) {
        // Product already exists - update quantity only if stock available
        const currentShopQty = existingItem.shopQuantity || 0;
        const currentWarehouseQty = existingItem.warehouseQuantity || 0;
        const priceType: "single" | "dozen" = (existingItem as any).priceType || "single";
        
        // Use fresh product data from search dropdown, not stale data from existingItem
        const availableShop = product.shopQuantity ?? 0;
        const availableWarehouse = product.warehouseQuantity ?? 0;
        const totalAvailable = availableShop + availableWarehouse;
        
        // If no stock available at all, don't auto-increment
        if (totalAvailable === 0) {
          showError(`No stock available for ${existingItem.productName}. Please manually adjust quantities.`);
          return;
        }
        
        // Try to increment shop quantity first, if not available try warehouse
        let nextShopQty = currentShopQty;
        let nextWarehouseQty = currentWarehouseQty;
        
        const qtyMultiplier = priceType === "dozen" ? 12 : 1;
        const incrementUnits = 1 * qtyMultiplier;
        
        if (availableShop >= (currentShopQty * qtyMultiplier) + incrementUnits) {
          // Add to shop
          nextShopQty = currentShopQty + 1;
          setSelectedProducts(
            selectedProducts.map((item) =>
              item.productId === product.id
                ? recalcItemTotals({ ...item, product } as any, {
                    shopQuantity: nextShopQty,
                    warehouseQuantity: nextWarehouseQty,
                  })
                : item
            )
          );
        } else if (availableWarehouse >= (currentWarehouseQty * qtyMultiplier) + incrementUnits) {
          // Add to warehouse
          nextWarehouseQty = currentWarehouseQty + 1;
          setSelectedProducts(
            selectedProducts.map((item) =>
              item.productId === product.id
                ? recalcItemTotals({ ...item, product } as any, {
                    shopQuantity: nextShopQty,
                    warehouseQuantity: nextWarehouseQty,
                  })
                : item
            )
          );
        } else {
          // No space in either location
          showError(`Insufficient stock for ${existingItem.productName}. Shop: ${availableShop}, Warehouse: ${availableWarehouse}`);
        }
      } else {
        // New product: Add as new row (with empty quantities - user will fill them)
        const rowId = product.id;
        
        const baseItem = {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          shopQuantity: null as any,
          warehouseQuantity: null as any,
          unitPrice: product.salePrice || 0,
          customPrice: undefined,
          priceType: "single",
          priceSingle: product.salePrice || 0,
          priceDozen: (product.salePrice || 0) * 12,
          discount: undefined,
          discountType: "percent",
          total: 0,
          product,
          rowId,
        } as SaleItem & { product: Product; rowId: string };

        setSelectedProducts([...selectedProducts, recalcItemTotals(baseItem)]);
      }
    }
    setSearchTerm("");
  };

  const updateItemPriceType = (rowId: string, priceType: "single" | "dozen") => {
    setSelectedProducts(
      selectedProducts.map((item: any) => {
        if (item.rowId !== rowId) return item;

        const unitPrice = item.unitPrice || 0;
        const currentSingle =
          item.customPrice !== undefined && item.customPrice !== null
            ? item.customPrice
            : (item.customPrice === null ? undefined : unitPrice);
        const currentDozen = currentSingle !== undefined && currentSingle !== null ? (item.priceDozen ?? currentSingle * 12) : undefined;

        // Don't change qty values when switching price type
        // Keep the same qty values, only update priceType
        // Units will be calculated automatically in recalcItemTotals based on priceType
        return recalcItemTotals(item, {
          priceType,
          customPrice: item.customPrice,
          priceSingle: currentSingle,
          priceDozen: currentDozen,
          // Keep existing qty values - don't change them
          shopQuantity: item.shopQuantity,
          warehouseQuantity: item.warehouseQuantity,
        } as any);
      })
    );
  };

  const updateItemPrice = (rowId: string, price: number | undefined) => {
    setSelectedProducts(
      selectedProducts.map((item: any) => {
        if (item.rowId === rowId) {
          const priceType: "single" | "dozen" = item.priceType || "single";
          // Allow 0 price - user can intentionally set price to 0
          if (price === 0) {
            // Allow 0 price
            return recalcItemTotals(item as any, {
              customPrice: 0, // Set to 0 to accept user's 0 price
              priceSingle: 0,
              priceDozen: 0,
            } as any);
          }
          // Allow null/undefined/empty during editing - validation happens on submit
          // Reject negative or invalid values
          if (price === undefined || price === null || isNaN(Number(price)) || price < 0) {
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
    rowId: string,
    location: "shop" | "warehouse",
    rawQty: string
  ) => {
    const parsed = rawQty === "" ? null : parseInt(rawQty, 10);
    const quantity = (rawQty === "" || Number.isNaN(parsed)) ? null : parsed;
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.rowId === rowId) {
          const priceType: "single" | "dozen" = (item as any).priceType || "single";
          // Get fresh product data from products array
          const freshProduct = products.find(p => p.id === item.productId);
          const availableShop = freshProduct?.shopQuantity ?? item.product?.shopQuantity ?? 0;
          const availableWarehouse = freshProduct?.warehouseQuantity ?? item.product?.warehouseQuantity ?? 0;
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

  const updateItemDiscount = (rowId: string, discount: number | undefined) => {
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.rowId === rowId) {
          return recalcItemTotals(item as any, { discount: discount ?? undefined });
        }
        return item;
      })
    );
  };

  const updateItemDiscountType = (rowId: string, discountType: "percent" | "value") => {
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.rowId === rowId) {
          return recalcItemTotals(item as any, { discountType });
        }
        return item;
      })
    );
  };

  const removeItem = (rowId: string) => {
    if (isEdit && saleStatus === "pending" && originalRowIds.has(rowId)) {
      showError("Old products cannot be deleted. You can only add new products.");
      return;
    }
    setSelectedProducts(
      selectedProducts.filter((item) => item.rowId !== rowId)
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

      // Validate price - allow 0 or greater
      const effectivePrice = item.customPrice ?? item.unitPrice ?? 0;
      if (effectivePrice === undefined || effectivePrice === null || effectivePrice < 0) {
        showError(`Price for "${item.productName}" cannot be negative`);
        return;
      }

      const availableShop = products.find(p => p.id === item.productId)?.shopQuantity ?? item.product?.shopQuantity ?? 0;
      const availableWarehouse = products.find(p => p.id === item.productId)?.warehouseQuantity ?? item.product?.warehouseQuantity ?? 0;
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
    const { subtotal, total } = calculateTotals();
    const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);

    if (totalPaid > total) {
      showError("Total paid amount cannot exceed total amount");
      return;
    }

    // Validate payments - payments are optional, but if provided, validate them
    for (const payment of payments) {
      // Only validate if amount is provided (payments are optional)
      if (payment.amount !== undefined && payment.amount !== null) {
        if (payment.amount < 0) {
          showError("Payment amount cannot be negative");
          return;
        }
        if (payment.type === "bank_transfer" && !payment.bankAccountId) {
          showError("Please select a bank account for bank transfer payment");
          return;
        }
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

      // Filter valid payments (with actual amount > 0)
      const validPayments = payments
        .filter(p => p.amount !== undefined && p.amount !== null && !isNaN(Number(p.amount)) && Number(p.amount) > 0)
        .map(p => ({
          type: p.type,
          amount: p.amount,
          bankAccountId: p.bankAccountId,
          date: dateIsoString, // Always use combined date and time
        }));

      // Build sale object - conditionally include paymentType only if there are valid payments
      const saleData: any = {
        billNumber,
        items: saleItems,
        subtotal,
        discount: globalDiscount || 0,
        discountType: globalDiscountType,
        tax: globalTax || 0,
        taxType: globalTaxType,
        total,
        payments: validPayments.length > 0 ? validPayments : [], // Always send payments array (even if empty)
        customerName: data.customerName.trim(),
        customerPhone: data.customerPhone || undefined,
        customerCity: data.customerCity || undefined,
        date: dateIsoString,
        userId: currentUser!.id,
        userName: currentUser!.name,
        status: "completed",
      };

      // Only include paymentType if there are valid payments (to avoid triggering old format in backend)
      if (validPayments.length > 0) {
        saleData.paymentType = validPayments[0]?.type || "cash";
      }

      if (isEdit && id) {
        // For edit mode, send only changed fields (backend calculates subtotal and total)
        const updateData: any = {
          items: saleItems,
          discount: globalDiscount || 0,
          discountType: globalDiscountType,
          tax: globalTax || 0,
          taxType: globalTaxType,
          payments: validPayments.length > 0 ? validPayments : [],
          customerName: data.customerName.trim(),
          customerPhone: data.customerPhone || undefined,
          customerCity: data.customerCity || undefined,
        };
        await updateSale(id, updateData);
        showSuccess("Sale updated successfully!");
        navigate("/sales");
      } else {
        const createdSale = await addSale(saleData);
        // Redirect to bill print page using the bill number from the backend
        navigate(`/sales/bill/${createdSale.billNumber}`);
      }
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
      <div className="space-y-4 md:space-y-6">
        <div className="p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
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

        <div className="p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
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
                      <th scope="col" className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[180px]">
                        Product
                      </th>
                      <th scope="col" className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[140px]">
                        Price Type
                      </th>
                      <th scope="col" className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[160px]">
                        Price
                      </th>
                      <th scope="col" className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[100px]">
                        {selectedProducts.some(item => ((item as any).priceType || "single") === "dozen")
                          ? "Shop Qty"
                          : "Shop Qty"}
                      </th>
                      <th scope="col" className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[100px]">
                        {selectedProducts.some(item => ((item as any).priceType || "single") === "dozen")
                          ? "Warehouse Qty"
                          : "Warehouse Qty"}
                      </th>
                      <th scope="col" className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[160px]" colSpan={2}>
                        Discount
                      </th>
                      <th scope="col" className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[140px]">
                        Total
                      </th>
                      <th scope="col" className="p-2 text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[80px]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                    {selectedProducts.map((item) => {
                      const isOldProduct = originalRowIds.has(item.rowId);
                      const isPendingSale = saleStatus === "pending";
                      const disableOldProductFields = isEdit && isPendingSale && isOldProduct;
                      
                      return (
                      <tr
                        key={item.rowId}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="p-2 overflow-hidden">
                          <div className="flex flex-col max-w-full">
                            <p className="font-medium text-gray-900 dark:text-white text-[11px] truncate" title={item.productName}>
                              {item.productName}
                            </p>
                            <p className="text-[9px] text-gray-500 dark:text-gray-400 truncate">
                              Rs. {item.unitPrice.toFixed(2)}
                            </p>
                          </div>
                        </td>
                        <td className="p-2">
                          <Select
                            value={((item as any).priceType || "single") as any}
                            onChange={(value) => updateItemPriceType(item.rowId, value as any)}
                            options={[
                              { value: "single", label: "Per Qty" },
                              { value: "dozen", label: "Dozen" },
                            ]}
                            disabled={disableOldProductFields}
                          />
                        </td>
                        <td className="p-2">
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
                                if (disableOldProductFields) return;
                                // Handle empty string as null to allow clearing
                                if (e.target.value === "" || e.target.value === null) {
                                  updateItemPrice(item.rowId, undefined);
                                  return;
                                }
                                // Parse the value but don't round during typing - preserve what user types
                                const numValue = parseFloat(e.target.value);
                                if (isNaN(numValue)) {
                                  updateItemPrice(item.rowId, undefined);
                                  return;
                                }
                                // Pass the raw value, rounding will happen in updateItemPrice
                                updateItemPrice(item.rowId, numValue);
                              }}
                              className="w-full text-[11px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              disabled={disableOldProductFields}
                            />
                            <div className="text-[9px] text-gray-500 dark:text-gray-400">
                              Unit: Rs. {(((item as any).priceSingle ?? (item.customPrice ?? item.unitPrice)) || 0).toFixed(2)}
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min="0"
                              max={(((item as any).priceType || "single") === "dozen"
                                ? Math.floor((item.product.shopQuantity || 0) / 12)
                                : (item.product.shopQuantity || 0)
                              ).toString()}
                              value={item.shopQuantity !== null && item.shopQuantity !== undefined ? item.shopQuantity : ""}
                              onChange={(e) => updateItemLocationQuantity(item.rowId, "shop", e.target.value)}
                              className="w-full text-[11px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder={((item as any).priceType || "single") === "dozen" ? "Dozen" : "Units"}
                              disabled={disableOldProductFields}
                            />
                            {((item as any).priceType || "single") === "dozen" && (
                              <div className="text-[9px] text-gray-500 dark:text-gray-400">
                                Units: {((item.shopQuantity || 0) * 12).toFixed(0)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min="0"
                              max={(((item as any).priceType || "single") === "dozen"
                                ? Math.floor((item.product.warehouseQuantity || 0) / 12)
                                : (item.product.warehouseQuantity || 0)
                              ).toString()}
                              value={item.warehouseQuantity !== null && item.warehouseQuantity !== undefined ? item.warehouseQuantity : ""}
                              onChange={(e) => updateItemLocationQuantity(item.rowId, "warehouse", e.target.value)}
                              className="w-full text-[11px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder={((item as any).priceType || "single") === "dozen" ? "Dozen" : "Units"}
                              disabled={disableOldProductFields}
                            />
                            {((item as any).priceType || "single") === "dozen" && (
                              <div className="text-[9px] text-gray-500 dark:text-gray-400">
                                Units: {((item.warehouseQuantity || 0) * 12).toFixed(0)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2" colSpan={2}>
                          <TaxDiscountInput
                            value={item.discount}
                            type={item.discountType || "percent"}
                            onValueChange={(value) => updateItemDiscount(item.rowId, value ?? undefined)}
                            onTypeChange={(type) => updateItemDiscountType(item.rowId, type)}
                            placeholder="0"
                            min={0}
                            step={0.01}
                            className="w-full"
                            disabled={disableOldProductFields}
                          />
                        </td>
                        <td className="p-2">
                          <div className="text-[11px] font-semibold text-gray-900 dark:text-white break-all">
                            Rs. {item.total.toFixed(2)}
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          {disableOldProductFields ? (
                            <div className="relative group">
                              <button
                                disabled
                                className="text-gray-400 cursor-not-allowed opacity-50"
                                title="Cannot delete old products from pending sale"
                              >
                                <TrashBinIcon className="w-5 h-5" />
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                Cannot delete old products from pending sale
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => removeItem(item.rowId)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              title="Remove item"
                            >
                              <TrashBinIcon className="w-5 h-5 inline-block" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white">
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
          </div>

          <div className="p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setIsPaymentDetailsOpen(!isPaymentDetailsOpen)}
              className="flex items-center justify-between w-full mt-4 mb-3 text-base font-semibold text-gray-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              <span>Payment Details</span>
              {isPaymentDetailsOpen ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
            {isPaymentDetailsOpen && (
            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-lg dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Payment {index + 1}</Label>
                    {!isEdit && (
                      <button
                        onClick={() => removePayment(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
                      >
                        <TrashBinIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-sm">Payment Type  <span className="text-error-500">*</span></Label>
                      <Select
                        value={payment.type}
                        onChange={(value) =>
                          updatePayment(index, "type", value)
                        }
                        options={[
                          { value: "cash", label: "Cash" },
                          { value: "bank_transfer", label: "Bank Transfer" },
                        ]}
                        disabled={isEdit}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Amount (Optional)</Label>
                      <Input
                        type="number"
                        min="0"
                        max={String(remainingBalance + (payment.amount ?? 0))}
                        value={(payment.amount !== null && payment.amount !== undefined && payment.amount !== 0) ? String(payment.amount) : ""}
                        onChange={(e) => {
                          const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                          updatePayment(index, "amount", isNaN(value as any) || value === null ? undefined : value);
                        }}
                        placeholder="Enter amount (optional)"
                        error={
                          (showErrors && payment.amount !== undefined && payment.amount !== null && payment.amount < 0) ||
                          !!backendErrors[`payments.${index}.amount`]
                        }
                        hint={
                          (showErrors && payment.amount !== undefined && payment.amount !== null && payment.amount < 0
                            ? "Amount cannot be negative"
                            : undefined) ||
                          backendErrors[`payments.${index}.amount`]
                        }
                        disabled={isEdit}
                      />
                    </div>
                    {payment.type === "bank_transfer" && (
                      <div>
                        <Label className="text-sm">Select Bank Account <span className="text-error-500">*</span></Label>
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
                          disabled={isEdit}
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
              {!isEdit && (
                <Button
                  onClick={addPayment}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Payment
                </Button>
              )}
              {remainingBalance > 0 && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
                  <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                    Remaining Balance: Rs. {remainingBalance.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
            )}
          </div>

          <div className="p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setIsBillSummaryOpen(!isBillSummaryOpen)}
              className="flex items-center justify-between w-full mb-4 text-base font-semibold text-gray-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              <span>Bill Summary</span>
              {isBillSummaryOpen ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
            {isBillSummaryOpen && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal:</span>
                <span className="font-medium text-sm text-gray-800 dark:text-white">
                  Rs. {subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <Label className="mb-0 whitespace-nowrap text-sm">Discount:</Label>
                <div className="flex-1 max-w-[200px]">
                  <TaxDiscountInput
                    value={globalDiscount}
                    type={globalDiscountType}
                    onValueChange={(value) => setGlobalDiscount(value ?? null)}
                    onTypeChange={(type) => setGlobalDiscountType(type)}
                    placeholder="0"
                    min={0}
                    step={0.01}
                    disabled={isEdit}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="mb-0 whitespace-nowrap text-sm">Tax:</Label>
                <div className="flex-1 max-w-[200px]">
                  <TaxDiscountInput
                    value={globalTax}
                    type={globalTaxType}
                    onValueChange={(value) => setGlobalTax(value ?? null)}
                    onTypeChange={(type) => setGlobalTaxType(type)}
                    placeholder="0"
                    min={0}
                    step={0.01}
                    disabled={isEdit}
                  />
                </div>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-base font-semibold text-gray-800 dark:text-white">
                  Total:
                </span>
                <span className="text-base font-bold text-brand-600 dark:text-brand-400">
                  Rs. {total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Paid:</span>
                <span className="font-medium text-sm text-gray-800 dark:text-white">
                  Rs. {totalPaid.toFixed(2)}
                </span>
              </div>
              {remainingBalance > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Remaining:</span>
                  <span className="font-medium text-sm text-red-600 dark:text-red-400">
                    Rs. {remainingBalance.toFixed(2)}
                  </span>
                </div>
              )}
              <Button
                onClick={handleFormSubmit(onSubmit)}
                className="w-full mt-4"
                size="sm"
                loading={isSubmitting}
                disabled={selectedProducts.length === 0 || isSubmitting}
              >
                {isEdit ? "Update Sale" : "Generate Bill"}
              </Button>
            </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}


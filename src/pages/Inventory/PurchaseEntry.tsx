import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import { Product, PurchaseItem, PurchasePayment } from "../../types";
import Input from "../../components/form/input/InputField";
import DatePicker from "../../components/form/DatePicker";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import TaxDiscountInput from "../../components/form/TaxDiscountInput";
import Button from "../../components/ui/button/Button";
import { TrashBinIcon, ChevronLeftIcon, PlusIcon, ChevronDownIcon, ChevronUpIcon } from "../../icons";
import api from "../../services/api";
import { hasPermission } from "../../utils/permissions";
import { AVAILABLE_PERMISSIONS } from "../../utils/availablePermissions";
import { extractErrorMessage } from "../../utils/errorHandler";
import { getTodayDate, formatDateToLocalISO } from "../../utils/dateHelpers";

const purchaseEntrySchema = yup.object().shape({
  supplierName: yup
    .string()
    .required("Supplier name is required")
    .trim()
    .min(2, "Supplier name must be at least 2 characters")
    .max(100, "Supplier name must be less than 100 characters"),
  supplierPhone: yup
    .string()
    .optional()
    .matches(/^[0-9+\-\s()]*$/, "Phone number contains invalid characters")
    .max(20, "Phone number must be less than 20 characters"),
  date: yup
    .string()
    .required("Date is required"),
  tax: yup
    .number()
    .nullable()
    .min(0, "Tax cannot be negative")
    .max(1000000, "Tax amount is too large"),
});

export default function PurchaseEntry() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { products, addPurchase, updatePurchase, currentUser, cards, refreshCards, bankAccounts, refreshBankAccounts, refreshProducts } = useData();
  const { showSuccess, showError } = useAlert();
  const navigate = useNavigate();
  const [selectedProducts, setSelectedProducts] = useState<
    (PurchaseItem & { product: Product; rowId: string })[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [date, setDate] = useState(getTodayDate());
  const [tax, setTax] = useState<number | null>(null);
  const [taxType, setTaxType] = useState<"percent" | "value">("percent");
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [purchaseStatus, setPurchaseStatus] = useState<"completed" | "pending" | "cancelled" | null>(null);
  const [originalRowIds, setOriginalRowIds] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: yupResolver(purchaseEntrySchema),
    defaultValues: {
      supplierName: "",
      supplierPhone: "",
      date: getTodayDate(),
      tax: null,
    },
  });

  const supplierName = watch("supplierName");
  const supplierPhone = watch("supplierPhone");

  useEffect(() => {
    // Load products only when on this page
    if (products.length === 0 && !loading) {
      refreshProducts(1, 100).catch(console.error); // Load more products for selection
    }
    if (cards.length === 0) {
      refreshCards();
    }
    if (bankAccounts.length === 0) {
      refreshBankAccounts();
    }
    // Don't add default payment - payments are optional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open collapsible sections when products are added
  useEffect(() => {
    if (selectedProducts.length > 0) {
      setIsPaymentMethodsOpen(true);
      setIsSummaryOpen(true);
    }
  }, [selectedProducts.length]);

  // Load purchase data for edit
  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      api.getPurchase(id)
        .then((purchase: any) => {
          // Store purchase status
          setPurchaseStatus(purchase.status || "pending");
          
          setValue("supplierName", purchase.supplierName);
          setValue("supplierPhone", purchase.supplierPhone || "");
          // Use the purchase's actual date, not today's date
          const purchaseDate = purchase.date ? new Date(purchase.date).toISOString().split('T')[0] : getTodayDate();
          setDate(purchaseDate);
          setValue("date", purchaseDate);
          setTaxType((purchase.taxType as "percent" | "value") || "percent");
          setTax(purchase.tax ? Number(purchase.tax) : null);
          setPayments((purchase.payments || []) as PurchasePayment[]);

          // Store original row IDs for pending purchases (to prevent editing/deleting)
          const originalRowIdsSet = new Set<string>();

          // Load products for items
          const itemsWithProducts = purchase.items.map((item: any) => {
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
              costSingle: item.costSingle ?? item.cost,
              costDozen: item.costDozen ?? ((item.costSingle ?? item.cost ?? 0) * 12),
              // For editing UI:
              // - if priceType is dozen, show qty as dozens (units/12)
              // - otherwise show qty as units
              shopQuantity: displayShopQty,
              warehouseQuantity: displayWarehouseQty,
              // quantity is always stored internally as units (used for validation/payload)
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
          console.error("Error loading purchase:", err);
          showError("Failed to load purchase data");
          navigate("/inventory/purchases");
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  // Filter products based on search term - compute directly instead of using useEffect
  const filteredProducts = searchTerm
    ? (products || []).filter((p) =>
      p && p.name && (
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    )
    : (products || []);

  const addProductToPurchase = (product: Product) => {
    // Validate product has a valid ID
    if (!product.id || typeof product.id !== 'string' || !product.id.trim()) {
      showError("Invalid product. Please try again.");
      return;
    }

    // In edit mode with pending purchases, check if there's a locked row for this product
    if (isEdit && purchaseStatus === "pending") {
      // Check if there's an unlocked (new) row for this product
      const unlockedRow = selectedProducts.find(
        (item) => item.productId === product.id && !originalRowIds.has(item.rowId)
      );
      
      if (unlockedRow) {
        // Update the unlocked row's quantity
        setSelectedProducts(
          selectedProducts.map((item) =>
            item.rowId === unlockedRow.rowId
              ? {
                ...item,
                shopQuantity: (item.shopQuantity || 0) + 1,
                quantity: ((item.shopQuantity || 0) + 1) + (item.warehouseQuantity || 0),
                total: (item.cost || 0) * (((item.shopQuantity || 0) + 1) + (item.warehouseQuantity || 0))
              }
              : item
          )
        );
      } else {
        // No unlocked row exists, create a new one
        const rowId = `${product.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        setSelectedProducts([
          ...selectedProducts,
          {
            productId: product.id.trim(),
            productName: product.name,
            quantity: undefined as any,
            shopQuantity: undefined as any,
            warehouseQuantity: undefined as any,
            cost: undefined as any,
            priceType: "single",
            costSingle: undefined,
            costDozen: undefined,
            total: 0,
            product,
            rowId,
          },
        ]);
      }
    } else {
      // Create mode: normal behavior - check if product exists
      const existingItem = selectedProducts.find(
        (item) => item.productId === product.id
      );

      if (existingItem) {
        setSelectedProducts(
          selectedProducts.map((item) =>
            item.productId === product.id
              ? {
                ...item,
                shopQuantity: (item.shopQuantity || 0) + 1,
                quantity: ((item.shopQuantity || 0) + 1) + (item.warehouseQuantity || 0),
                total: (item.cost || 0) * (((item.shopQuantity || 0) + 1) + (item.warehouseQuantity || 0))
              }
              : item
          )
        );
      } else {
        // New product: Add as new row
        const rowId = product.id;
        
        setSelectedProducts([
          ...selectedProducts,
          {
            productId: product.id.trim(),
            productName: product.name,
            quantity: undefined as any,
            shopQuantity: undefined as any,
            warehouseQuantity: undefined as any,
            cost: undefined as any,
            priceType: "single",
            costSingle: undefined,
            costDozen: undefined,
            total: 0,
            product,
            rowId,
          },
        ]);
      }
    }
    setSearchTerm("");
  };

  const recalcItem = (
    item: PurchaseItem & { product: Product; rowId: string },
    overrides: Partial<PurchaseItem> = {}
  ) => {
    const updated: any = { ...item, ...overrides };
    const enteredShopQty = Number(updated.shopQuantity || 0);
    const enteredWarehouseQty = Number(updated.warehouseQuantity || 0);

    const priceType: "single" | "dozen" = updated.priceType || "single";
    const costSingle = updated.costSingle ?? updated.cost ?? 0;
    const unitCost = Number(costSingle || 0);

    const shopUnits = priceType === "dozen" ? enteredShopQty * 12 : enteredShopQty;
    const warehouseUnits = priceType === "dozen" ? enteredWarehouseQty * 12 : enteredWarehouseQty;
    const totalUnits = shopUnits + warehouseUnits;

    return {
      ...updated,
      // quantity is always units
      quantity: totalUnits,
      priceType,
      cost: unitCost,
      total: unitCost * totalUnits,
    };
  };

  const updateItemShopQuantity = (rowId: string, shopQuantity: number | undefined) => {
    // For pending purchases, prevent editing of original products
    if (isEdit && purchaseStatus === "pending" && originalRowIds.has(rowId)) {
      showError("Old products cannot be edited. You can only add new products.");
      return;
    }
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.rowId === rowId) {
          return recalcItem(item as any, { shopQuantity });
        }
        return item;
      })
    );
  };

  const updateItemWarehouseQuantity = (rowId: string, warehouseQuantity: number | undefined) => {
    // For pending purchases, prevent editing of original products
    if (isEdit && purchaseStatus === "pending" && originalRowIds.has(rowId)) {
      showError("Old products cannot be edited. You can only add new products.");
      return;
    }
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.rowId === rowId) {
          return recalcItem(item as any, { warehouseQuantity });
        }
        return item;
      })
    );
  };

  const updateItemPriceType = (rowId: string, priceType: "single" | "dozen") => {
    // For pending purchases, prevent editing of original products
    if (isEdit && purchaseStatus === "pending" && originalRowIds.has(rowId)) {
      showError("Old products cannot be edited. You can only add new products.");
      return;
    }
    setSelectedProducts(
      selectedProducts.map((item: any) => {
        if (item.rowId !== rowId) return item;
        // Keep existing prices and derive missing one when switching type
        const currentSingle = item.costSingle ?? item.cost ?? undefined;
        const currentDozen = item.costDozen ?? (currentSingle !== undefined ? currentSingle * 12 : undefined);

        // Convert entered quantities when switching between modes
        const prevType: "single" | "dozen" = item.priceType || "single";
        const shopEntered = Number(item.shopQuantity || 0);
        const warehouseEntered = Number(item.warehouseQuantity || 0);

        let nextShopQty = shopEntered;
        let nextWarehouseQty = warehouseEntered;

        if (prevType !== priceType) {
          if (prevType === "single" && priceType === "dozen") {
            // Switching units -> dozens: only allow if divisible by 12
            if (shopEntered % 12 !== 0 || warehouseEntered % 12 !== 0) {
              showError("Shop/Warehouse Qty must be multiple of 12 to switch to Dozen.");
              return item;
            }
            nextShopQty = shopEntered / 12;
            nextWarehouseQty = warehouseEntered / 12;
          }
          if (prevType === "dozen" && priceType === "single") {
            // Switching dozens -> units
            nextShopQty = shopEntered * 12;
            nextWarehouseQty = warehouseEntered * 12;
          }
        }

        return recalcItem(item, {
          priceType,
          costSingle: currentSingle,
          costDozen: currentDozen,
          shopQuantity: nextShopQty,
          warehouseQuantity: nextWarehouseQty,
        } as any);
      })
    );
  };

  const updateItemPrice = (rowId: string, price: number | undefined) => {
    // For pending purchases, prevent editing of original products
    if (isEdit && purchaseStatus === "pending" && originalRowIds.has(rowId)) {
      showError("Old products cannot be edited. You can only add new products.");
      return;
    }
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.rowId === rowId) {
          const priceType: "single" | "dozen" = (item as any).priceType || "single";
          if (price === undefined || price === null) {
            return recalcItem(item as any, { cost: undefined, costSingle: undefined, costDozen: undefined } as any);
          }
          // Allow 0 as valid price
          const costSingle = priceType === "dozen" ? price / 12 : price;
          const costDozen = priceType === "dozen" ? price : price * 12;
          return recalcItem(item as any, { costSingle, costDozen } as any);
        }
        return item;
      })
    );
  };

  const removeItem = (rowId: string) => {
    // For pending purchases, prevent deletion of original products
    if (isEdit && purchaseStatus === "pending" && originalRowIds.has(rowId)) {
      showError("Old products cannot be deleted. You can only add new products.");
      return;
    }
    setSelectedProducts(
      selectedProducts.filter((item) => item.rowId !== rowId)
    );
  };

  const subtotal = selectedProducts.reduce((sum, item) => sum + (item.total || 0), 0);
  // Calculate tax based on type
  let taxAmount = 0;
  if (tax !== null && tax !== undefined) {
    if (taxType === "value") {
      taxAmount = tax;
    } else {
      taxAmount = (subtotal * tax) / 100;
    }
  }
  const total = subtotal + taxAmount;
  const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const remainingBalance = total - totalPaid;

  const addPayment = () => {
    setPayments([
      ...payments,
      {
        type: "cash",
        amount: undefined,
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
          // If type changes to cash, remove bankAccountId
          if (field === "type" && value === "cash") {
            delete updated.bankAccountId;
          }
          // If type changes to bank_transfer, auto-select default bank account if available
          if (field === "type" && value === "bank_transfer") {
            // Only auto-select if no bank account is selected and there's a default account
            if (!updated.bankAccountId && bankAccounts.length > 0) {
              const defaultAccount = bankAccounts.find((acc) => acc.isDefault && acc.isActive);
              if (defaultAccount) {
                updated.bankAccountId = defaultAccount.id;
              }
            }
          }
          return updated;
        }
        return payment;
      })
    );
  };

  const onSubmit = async (data: any) => {
    // Check permission for creating purchase (only for new purchases, not edits)
    if (!isEdit && currentUser) {
      const canCreate = currentUser.role === "superadmin" ||
        currentUser.role === "admin" ||
        hasPermission(
          currentUser.role,
          AVAILABLE_PERMISSIONS.PURCHASE_CREATE,
          currentUser.permissions
        );

      if (!canCreate) {
        showError("You don't have permission to create purchases. Please contact your administrator.");
        return;
      }
    }

    if (selectedProducts.length === 0) {
      showError("Please add at least one product");
      return;
    }
    if (totalPaid > total) {
      showError("Total paid amount cannot exceed total amount");
      return;
    }

    // Validate payments (only if payments exist)
    for (const payment of payments) {
      if (payment.amount !== undefined && payment.amount !== null && payment.amount <= 0) {
        showError("Payment amount must be greater than 0 if provided");
        return;
      }
      if (payment.type === "bank_transfer" && payment.amount !== undefined && payment.amount !== null && payment.amount > 0 && !payment.bankAccountId) {
        showError("Please select a bank account for bank transfer payment");
        return;
      }
    }

    // Validate productIds, quantity, and cost are valid
    for (const item of selectedProducts) {
      if (!item.productId || typeof item.productId !== 'string' || !item.productId.trim()) {
        showError(`Invalid product ID for ${item.productName || 'product'}. Please remove and re-add the product.`);
        setIsSubmitting(false);
        return;
      }
      const priceType: "single" | "dozen" = (item as any).priceType || "single";
      const shopEntered = Number(item.shopQuantity || 0);
      const warehouseEntered = Number(item.warehouseQuantity || 0);
      if (priceType === "dozen") {
        if (!Number.isInteger(shopEntered) || !Number.isInteger(warehouseEntered)) {
          showError(`Dozen quantity must be a whole number for ${item.productName || 'product'}`);
          setIsSubmitting(false);
          return;
        }
      }
      const shopUnits = priceType === "dozen" ? shopEntered * 12 : shopEntered;
      const warehouseUnits = priceType === "dozen" ? warehouseEntered * 12 : warehouseEntered;
      const totalQty = shopUnits + warehouseUnits;

      if (totalQty <= 0) {
        showError(`Please enter a valid quantity (shop or warehouse) for ${item.productName || 'product'}`);
        setIsSubmitting(false);
        return;
      }
      if (item.cost === undefined || item.cost === null) {
        showError(`Please enter a valid cost for ${item.productName || 'product'}`);
        setIsSubmitting(false);
        return;
      }
      // Allow 0 as valid cost
    }

    setIsSubmitting(true);
    try {
      const purchaseItems: PurchaseItem[] = selectedProducts.map((item) => {
        const priceType: "single" | "dozen" = (item as any).priceType || "single";
        const shopEntered = Number(item.shopQuantity || 0);
        const warehouseEntered = Number(item.warehouseQuantity || 0);
        const shopQtyUnits = priceType === "dozen" ? shopEntered * 12 : shopEntered;
        const warehouseQtyUnits = priceType === "dozen" ? warehouseEntered * 12 : warehouseEntered;
        const totalQty = shopQtyUnits + warehouseQtyUnits;

        return {
          productId: item.productId.trim(),
          productName: item.productName,
          quantity: totalQty,
          shopQuantity: shopQtyUnits,
          warehouseQuantity: warehouseQtyUnits,
          cost: item.cost || 0,
          priceType: (item as any).priceType || "single",
          costSingle: (item as any).costSingle ?? item.cost,
          costDozen: (item as any).costDozen ?? ((item.cost || 0) * 12),
          discount: item.discount || 0,
          total: item.total || 0,
          toWarehouse: warehouseQtyUnits > 0 && shopQtyUnits === 0 ? true : (shopQtyUnits > 0 && warehouseQtyUnits === 0 ? false : (item.toWarehouse !== undefined ? item.toWarehouse : true)),
        };
      });

      // Combine selected date with current time (using local timezone)
      // Parse date string (YYYY-MM-DD) to avoid timezone issues
      const dateParts = data.date.split("-");
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
      const day = parseInt(dateParts[2]);
      const now = new Date();
      // Create date in local timezone with current time
      const dateTime = new Date(year, month, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      // Use local ISO format to avoid timezone conversion
      const dateIsoString = formatDateToLocalISO(dateTime);

      const purchaseData = {
        supplierName: data.supplierName.trim(),
        supplierPhone: data.supplierPhone || undefined,
        items: purchaseItems,
        subtotal,
        tax: tax || 0,
        taxType: taxType,
        total,
        payments: payments.map(p => ({
          ...p,
          date: dateIsoString, // Always use combined date and time
        })),
        remainingBalance,
        date: dateIsoString,
        userId: currentUser!.id,
        userName: currentUser!.name,
        status: "completed" as const,
      };

      if (isEdit && id) {
        await updatePurchase(id, purchaseData);
        showSuccess("Purchase updated successfully!");
      } else {
        await addPurchase(purchaseData);
        showSuccess("Purchase entry added successfully!");
      }
      navigate("/inventory/purchases");
    } catch (error: any) {
      showError(extractErrorMessage(error) || `Failed to ${isEdit ? "update" : "create"} purchase`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check permission on component mount
  useEffect(() => {
    if (!isEdit && currentUser) {
      const canCreate = currentUser.role === "superadmin" ||
        currentUser.role === "admin" ||
        hasPermission(
          currentUser.role,
          AVAILABLE_PERMISSIONS.PURCHASE_CREATE,
          currentUser.permissions
        );

      if (!canCreate) {
        showError("You don't have permission to create purchases. Redirecting to purchase list...");
        navigate("/inventory/purchases");
      }
    }
  }, [isEdit, currentUser, navigate]);

  // Show access denied message if user doesn't have permission
  if (!isEdit && currentUser) {
    const canCreate = currentUser.role === "superadmin" ||
      currentUser.role === "admin" ||
      hasPermission(
        currentUser.role,
        AVAILABLE_PERMISSIONS.PURCHASE_CREATE,
        currentUser.permissions
      );

    if (!canCreate) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You don't have permission to create purchases.
            </p>
            <Button onClick={() => navigate("/inventory/purchases")} size="sm">
              Go to Purchase List
            </Button>
          </div>
        </div>
      );
    }
  }

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

          <div className="space-y-4 md:space-y-6">
            <div className="p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
              <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
                Product Search
              </h2>
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
                        onClick={() => addProductToPurchase(product)}
                        className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">
                              {product.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {product.brand || "N/A"} - Stock: {(product.shopQuantity || 0) + (product.warehouseQuantity || 0)}
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
                  <p className="text-gray-500 dark:text-gray-400">
                    No products selected. Search and add products above.
                  </p>
                ) : (
                  <div className="table-container overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full min-w-[980px] table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[180px]">
                            Product
                          </th>
                          <th className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[140px]">
                            Price Type
                          </th>
                          <th className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[140px]">
                            Price
                          </th>
                          <th className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[120px]">
                            Unit (Rs)
                          </th>
                          <th className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[120px]">
                            Shop Qty
                          </th>
                          <th className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[140px]">
                            Warehouse Qty
                          </th>
                          <th className="p-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[140px]">
                            Total
                          </th>
                          <th className="p-2 text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 w-[80px]">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                        {selectedProducts.map((item) => {
                          const isOldProduct = originalRowIds.has(item.rowId);
                          const isPendingPurchase = purchaseStatus === "pending";
                          const disableOldProductFields = isEdit && isPendingPurchase && isOldProduct;
                          
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
                              <Input
                                type="number"
                                step={0.01}
                                min="0"
                                value={
                                  ((item as any).priceType || "single") === "dozen"
                                    ? ((item as any).costDozen ?? "")
                                    : ((item as any).costSingle ?? "")
                                }
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === "" || value === null || value === undefined) {
                                    updateItemPrice(item.rowId, undefined);
                                  } else {
                                    const numValue = parseFloat(value);
                                    updateItemPrice(item.rowId, isNaN(numValue) ? undefined : numValue);
                                  }
                                }}
                                className="w-full text-[11px]"
                                placeholder="0"
                                disabled={disableOldProductFields}
                              />
                            </td>
                            <td className="p-2 text-[11px] text-gray-700 dark:text-gray-300">
                              Rs. {(((item as any).costSingle ?? item.cost) || 0).toFixed(2)}
                            </td>
                            <td className="p-2">
                              <div>
                                <Input
                                  type="number"
                                  min="0"
                                  value={item.shopQuantity === undefined || item.shopQuantity === null ? "" : item.shopQuantity}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === "" || value === null || value === undefined) {
                                      updateItemShopQuantity(item.rowId, undefined);
                                    } else {
                                      const numValue = parseInt(value);
                                      updateItemShopQuantity(item.rowId, isNaN(numValue) ? undefined : numValue);
                                    }
                                  }}
                                  disabled={disableOldProductFields}
                                  className="w-full text-[11px]"
                                  placeholder="0"
                                />
                                {((item as any).priceType || "single") === "dozen" && (
                                  <div className="text-[9px] text-gray-500 dark:text-gray-400">
                                    Units: {((item.shopQuantity || 0) * 12).toFixed(0)}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-2">
                              <div>
                                <Input
                                  type="number"
                                  min="0"
                                  value={item.warehouseQuantity === undefined || item.warehouseQuantity === null ? "" : item.warehouseQuantity}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === "" || value === null || value === undefined) {
                                      updateItemWarehouseQuantity(item.rowId, undefined);
                                    } else {
                                      const numValue = parseInt(value);
                                      updateItemWarehouseQuantity(item.rowId, isNaN(numValue) ? undefined : numValue);
                                    }
                                  }}
                                  disabled={disableOldProductFields}
                                  className="w-full text-[11px]"
                                  placeholder="0"
                                />
                                {((item as any).priceType || "single") === "dozen" && (
                                  <div className="text-[9px] text-gray-500 dark:text-gray-400">
                                    Units: {((item.warehouseQuantity || 0) * 12).toFixed(0)}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-2">
                              <div className="text-[11px] font-semibold text-gray-900 dark:text-white break-all">
                              Rs. {(item.total || 0).toFixed(2)}
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              {disableOldProductFields ? (
                                <div className="relative group">
                                  <button
                                    disabled
                                    className="text-gray-400 cursor-not-allowed opacity-50"
                                    title="Cannot delete old products from pending purchase"
                                  >
                                    <TrashBinIcon className="w-5 h-5" />
                                  </button>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                    Cannot delete old products from pending purchase
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => removeItem(item.rowId)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                >
                                  <TrashBinIcon className="w-5 h-5" />
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
                  Purchase Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label>
                      Supplier Name <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      name="supplierName"
                      value={supplierName}
                      onChange={(e) => {
                        setValue("supplierName", e.target.value);
                      }}
                      onBlur={register("supplierName").onBlur}
                      placeholder="Enter supplier name"
                      required
                      error={!!errors.supplierName}
                      hint={errors.supplierName?.message}
                    />
                  </div>
                  <div>
                    <Label>Mobile Number</Label>
                    <Input
                      name="supplierPhone"
                      value={supplierPhone}
                      onChange={(e) => {
                        setValue("supplierPhone", e.target.value);
                      }}
                      onBlur={register("supplierPhone").onBlur}
                      placeholder="Enter mobile number (optional)"
                      type="tel"
                      error={!!errors.supplierPhone}
                      hint={errors.supplierPhone?.message}
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
                  onClick={() => setIsPaymentMethodsOpen(!isPaymentMethodsOpen)}
                  className="flex items-center justify-between w-full mb-4 text-base font-semibold text-gray-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  <span>Payment Methods</span>
                  {isPaymentMethodsOpen ? (
                    <ChevronUpIcon className="w-4 h-4" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4" />
                  )}
                </button>
                {isPaymentMethodsOpen && (
                <div className="space-y-3">
                  {payments.map((payment, index) => (
                    <div key={index} className="p-2 border border-gray-200 rounded-lg dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Payment {index + 1}
                        </span>
                        {!(isEdit && purchaseStatus === "pending") && (
                          <button
                            onClick={() => removePayment(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <TrashBinIcon className="w-4 h-4" />
                          </button>
                        )}
                        {isEdit && purchaseStatus === "pending" && (
                          <span className="text-xs text-gray-500 dark:text-gray-400"></span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Payment Type <span className="text-error-500">*</span></Label>
                          <Select
                            value={payment.type}
                            onChange={(value) => {
                              if (isEdit && purchaseStatus === "pending") {
                                showError("Payments cannot be edited for pending purchases.");
                                return;
                              }
                              updatePayment(index, "type", value);
                            }}
                            disabled={isEdit && purchaseStatus === "pending"}
                            options={[
                              { value: "cash", label: "Cash" },
                              { value: "bank_transfer", label: "Bank Transfer" },
                            ]}
                          />
                        </div>
                        {payment.type === "bank_transfer" && (
                          <div className="mt-2">
                            <Label className="text-xs">
                              Select Bank Account <span className="text-error-500">*</span>
                            </Label>
                            {bankAccounts.filter((acc) => acc.isActive).length === 0 ? (
                              <div className="p-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded">
                                No active bank accounts available. Please add a bank account in Settings.
                              </div>
                            ) : (
                              <>
                                <Select
                                  value={payment.bankAccountId || ""}
                                  onChange={(value) => {
                                    if (isEdit && purchaseStatus === "pending") {
                                      showError("Payments cannot be edited for pending purchases.");
                                      return;
                                    }
                                    updatePayment(index, "bankAccountId", value);
                                  }}
                                  disabled={isEdit && purchaseStatus === "pending"}
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
                                {!payment.bankAccountId && (
                                  <p className="mt-1 text-xs text-error-500">
                                    Please select a bank account for this payment
                                  </p>
                                )}
                                {payment.bankAccountId && (
                                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                                    Bank account selected: {bankAccounts.find(acc => acc.id === payment.bankAccountId)?.accountName}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        <div>
                          <Label className="text-xs">Amount (Optional)</Label>
                          <Input
                            type="number"
                            step={0.01}
                            min="0"
                            max={String(total - totalPaid + (payment.amount || 0))}
                            value={(payment.amount !== null && payment.amount !== undefined && payment.amount !== 0) ? String(payment.amount) : ""}
                            onChange={(e) => {
                              if (isEdit && purchaseStatus === "pending") {
                                showError("Payments cannot be edited for pending purchases.");
                                return;
                              }
                              const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                              updatePayment(index, "amount", isNaN(value as any) || value === null ? undefined : value);
                            }}
                            disabled={isEdit && purchaseStatus === "pending"}
                            placeholder="Enter amount (optional)"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {payments.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        No payments added. Payments are optional.
                      </p>
                    </div>
                  )}
                  {!(isEdit && purchaseStatus === "pending") && (
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
                  {isEdit && purchaseStatus === "pending" && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Payments cannot be added or modified for pending purchases
                    </p>
                  )}
                  {totalPaid > total && (
                    <div className="p-2 text-sm text-error-500 bg-error-50 border border-error-200 rounded dark:bg-error-900/20 dark:border-error-700">
                      Total paid amount cannot exceed total amount.
                    </div>
                  )}
                  {remainingBalance > 0 && totalPaid > 0 && (
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
                  onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                  className="flex items-center justify-between w-full mb-4 text-base font-semibold text-gray-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  <span>Summary</span>
                  {isSummaryOpen ? (
                    <ChevronUpIcon className="w-4 h-4" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4" />
                  )}
                </button>
                {isSummaryOpen && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal:</span>
                    <span className="text-sm text-gray-800 dark:text-white">Rs. {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <Label className="mb-0 text-sm">Tax:</Label>
                    <div className="flex items-center gap-2">
                      <TaxDiscountInput
                        value={tax}
                        type={taxType}
                        onValueChange={(value) => {
                          if (isEdit && purchaseStatus === "pending") {
                            showError("Tax cannot be edited for pending purchases.");
                            return;
                          }
                          setTax(value || null);
                          setValue("tax", value || null);
                        }}
                        onTypeChange={(type) => {
                          if (isEdit && purchaseStatus === "pending") {
                            showError("Tax cannot be edited for pending purchases.");
                            return;
                          }
                          setTaxType(type);
                        }}
                        disabled={isEdit && purchaseStatus === "pending"}
                        placeholder="0"
                        className="w-32"
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
                  <Button
                    onClick={handleFormSubmit(onSubmit)}
                    className="w-full mt-4"
                    size="sm"
                    loading={isSubmitting}
                    disabled={selectedProducts.length === 0 || !supplierName || isSubmitting}
                  >
                    {isEdit ? "Update Purchase" : "Save Purchase"}
                  </Button>
                </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

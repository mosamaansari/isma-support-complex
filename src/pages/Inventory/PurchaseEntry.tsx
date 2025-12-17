import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useFormik } from "formik";
import * as yup from "yup";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import { Product, PurchaseItem, PurchasePayment } from "../../types";
import Input from "../../components/form/input/InputField";
import DatePicker from "../../components/form/DatePicker";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import { TrashBinIcon, ChevronLeftIcon, PlusIcon } from "../../icons";
import api from "../../services/api";
import { hasPermission } from "../../utils/permissions";
import { AVAILABLE_PERMISSIONS } from "../../utils/availablePermissions";

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
    .min(0, "Tax cannot be negative")
    .max(1000000, "Tax amount is too large"),
});

export default function PurchaseEntry() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { products, addPurchase, updatePurchase, currentUser, cards, refreshCards, bankAccounts, refreshBankAccounts } = useData();
  const { showSuccess, showError } = useAlert();
  const navigate = useNavigate();
  const [selectedProducts, setSelectedProducts] = useState<
    (PurchaseItem & { product: Product })[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [tax, setTax] = useState(0);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [supplierFetchEnabled, setSupplierFetchEnabled] = useState(false);
  const [backendErrors, setBackendErrors] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState<string>("");

  const formik = useFormik({
    initialValues: {
      supplierName: "",
      supplierPhone: "",
      date: new Date().toISOString().split("T")[0],
      tax: 0,
    },
    validationSchema: purchaseEntrySchema,
    onSubmit: (values: any) => onSubmit(values),
    validateOnBlur: false,
    validateOnChange: false,
  });

  const supplierName = formik.values.supplierName;
  const supplierPhone = formik.values.supplierPhone;

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

  // Load suppliers for autocomplete
  useEffect(() => {
    if (!supplierFetchEnabled) return;

    const loadSuppliers = async (term: string) => {
      try {
        const suppliersList = await api.getSuppliers(term || undefined);
        setSuppliers(suppliersList || []);
        setShowSupplierDropdown(true);
      } catch (err) {
        console.error("Error loading suppliers:", err);
        setSuppliers([]);
        setShowSupplierDropdown(false);
      }
    };

    const trimmed = supplierSearchTerm.trim();

    // Require at least 2 characters to show recommendations
    if (trimmed.length < 2) {
      setSuppliers([]);
      setShowSupplierDropdown(false);
      return;
    }

    const debounceTimer = setTimeout(() => {
      loadSuppliers(trimmed);
    }, 250);

    return () => clearTimeout(debounceTimer);
  }, [supplierSearchTerm, supplierFetchEnabled]);

  // Load purchase data for edit
  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      api.getPurchase(id)
        .then((purchase: any) => {
          if (purchase.status === "completed") {
            showError("Completed purchases cannot be edited.");
            navigate("/inventory/purchases");
            return;
          }
          formik.setValues({
            supplierName: purchase.supplierName,
            supplierPhone: purchase.supplierPhone || "",
            date: new Date(purchase.date).toISOString().split("T")[0],
            tax: Number(purchase.tax) || 0,
          });
          setDate(new Date(purchase.date).toISOString().split("T")[0]);
          setTax(Number(purchase.tax) || 0);
          setPayments((purchase.payments || []) as PurchasePayment[]);
          
          // Load products for items
          const itemsWithProducts = purchase.items.map((item: any) => {
            const product = products.find(p => p.id === item.productId);
            const shopQty = item.shopQuantity ?? (item.toWarehouse === false ? item.quantity : 0);
            const warehouseQty = item.warehouseQuantity ?? (item.toWarehouse === false ? 0 : item.quantity);
            return {
              ...item,
              shopQuantity: shopQty,
              warehouseQuantity: warehouseQty,
              quantity: shopQty + warehouseQty,
              productId: item.productId?.trim() || item.productId,
              product: product || { id: item.productId, name: item.productName } as Product,
            };
          });
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
        p && p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : (products || []);

  const addProductToPurchase = (product: Product) => {
    // Validate product has a valid ID
    if (!product.id || typeof product.id !== 'string' || !product.id.trim()) {
      showError("Invalid product. Please try again.");
      return;
    }

    const existingItem = selectedProducts.find(
      (item) => item.productId === product.id
    );

    if (existingItem) {
      setSelectedProducts(
        selectedProducts.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                warehouseQuantity: (item.warehouseQuantity || 0) + 1,
                shopQuantity: item.shopQuantity || 0,
                quantity: (item.shopQuantity || 0) + (item.warehouseQuantity || 0) + 1,
                total: item.cost * ((item.shopQuantity || 0) + (item.warehouseQuantity || 0) + 1),
              }
            : item
        )
      );
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          productId: product.id.trim(),
          productName: product.name,
          quantity: 1,
          shopQuantity: 0,
          warehouseQuantity: 1,
          cost: 0,
          total: 0,
          toWarehouse: true,
          product,
        },
      ]);
    }
    setSearchTerm("");
  };

  const updateItemLocationQuantity = (
    productId: string,
    location: "shop" | "warehouse",
    rawQuantity: string
  ) => {
    const parsed = rawQuantity === "" ? 0 : parseInt(rawQuantity, 10);
    const safeQuantity = Number.isNaN(parsed) ? 0 : parsed;
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          const shopQty = location === "shop" ? safeQuantity : item.shopQuantity || 0;
          const warehouseQty = location === "warehouse" ? safeQuantity : item.warehouseQuantity || 0;
          const totalQty = shopQty + warehouseQty;
          return {
            ...item,
            shopQuantity: shopQty,
            warehouseQuantity: warehouseQty,
            quantity: totalQty,
            total: item.cost * totalQty,
            toWarehouse: warehouseQty > 0 && shopQty === 0,
          };
        }
        return item;
      })
    );
  };

  const updateItemCost = (productId: string, cost: number) => {
    // Validate cost is greater than 0
    if (cost < 0) {
      cost = 0;
    }
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          const totalQty = (item.shopQuantity || 0) + (item.warehouseQuantity || 0);
          const safeTotal = totalQty || item.quantity;
          return { ...item, cost, total: cost * safeTotal, quantity: safeTotal };
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
    if (!currentUser) {
      showError("User not loaded yet. Please try again.");
      return;
    }
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
    // Validate quantities > 0
    for (const item of selectedProducts) {
      const totalQty = (item.shopQuantity || 0) + (item.warehouseQuantity || 0);
      if (!totalQty || totalQty <= 0) {
        showError(`Quantity for "${item.productName}" must be greater than 0`);
        return;
      }
    }
    if (payments.length === 0) {
      showError("Please add at least one payment method");
      return;
    }
    if (totalPaid > total) {
      showError("Total paid amount cannot exceed total amount");
      return;
    }

    setFormError("");
    // Validate payment amounts are greater than 0
    for (const payment of payments) {
      if (!payment.amount || payment.amount <= 0) {
        showError("Payment amount must be greater than 0");
        return;
      }
    }

    // Validate bank transfer payments have bankAccountId
    for (const payment of payments) {
      if (payment.type === "bank_transfer" && !payment.bankAccountId) {
        showError("Please select a bank account for bank transfer payment");
        return;
      }
    }

    // Validate productIds are valid
    for (const item of selectedProducts) {
      if (!item.productId || typeof item.productId !== 'string' || !item.productId.trim()) {
        showError(`Invalid product ID for ${item.productName || 'product'}. Please remove and re-add the product.`);
        setIsSubmitting(false);
        return;
      }
    }

    setShowErrors(true);
    setBackendErrors({});
    setIsSubmitting(true);
    try {
      const purchaseItems: PurchaseItem[] = selectedProducts.map((item) => ({
        productId: item.productId.trim(),
        productName: item.productName,
        quantity: (item.shopQuantity || 0) + (item.warehouseQuantity || 0),
        shopQuantity: item.shopQuantity || 0,
        warehouseQuantity: item.warehouseQuantity || 0,
        cost: item.cost,
        discount: item.discount || 0,
        total: item.total,
        toWarehouse: item.toWarehouse !== undefined ? item.toWarehouse : true,
      }));

      const purchaseData = {
        supplierName: data.supplierName.trim(),
        supplierPhone: data.supplierPhone || undefined,
        items: purchaseItems,
        subtotal,
        tax: data.tax,
        total,
        payments,
        remainingBalance,
        status: (remainingBalance > 0 ? "pending" : "completed") as "completed" | "pending" | "cancelled",
        date: data.date,
        userId: currentUser.id,
        userName: currentUser.name,
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
      const backendErr = error?.response?.data?.error;
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
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          `Failed to ${isEdit ? "update" : "create"} purchase`;
        setFormError(msg);
        showError(msg);
      }
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

  // Show loading if currentUser is not loaded yet
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

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
                          Stock — Shop: {product.shopQuantity || 0} | Warehouse: {product.warehouseQuantity || 0}
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
                        Shop Qty
                      </th>
                      <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Warehouse Qty
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
                            min="0.01"
                            value={String(item.cost)}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              updateItemCost(item.productId, value);
                            }}
                            className="w-24"
                    error={showErrors && (!item.cost || item.cost <= 0)}
                    hint={
                      showErrors && (!item.cost || item.cost <= 0)
                        ? "Cost must be greater than 0"
                        : ""
                    }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={item.shopQuantity === 0 ? "" : item.shopQuantity}
                            onChange={(e) => updateItemLocationQuantity(item.productId, "shop", e.target.value)}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={item.warehouseQuantity === 0 ? "" : item.warehouseQuantity}
                            onChange={(e) => updateItemLocationQuantity(item.productId, "warehouse", e.target.value)}
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
              <div className="relative">
                <Label>
                  Supplier Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  name="supplierName"
                  value={supplierName}
                  onChange={(e) => {
                    const value = e.target.value;
                    formik.setFieldValue("supplierName", value);
                    setSupplierSearchTerm(value);
                  }}
                  onFocus={() => {
                    setSupplierFetchEnabled(true);
                    setSupplierSearchTerm(supplierName || "");
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSupplierDropdown(false), 200);
                    formik.handleBlur("supplierName");
                  }}
                  placeholder="Enter supplier name"
                  required
                  error={(showErrors && !!formik.errors.supplierName) || !!backendErrors.supplierName}
                  hint={
                    (showErrors &&
                      (typeof formik.errors.supplierName === "string"
                        ? formik.errors.supplierName
                        : undefined)) ||
                    backendErrors.supplierName
                  }
                />
                {showSupplierDropdown && suppliers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-700 max-h-60 overflow-y-auto">
                    {suppliers.map((supplier) => (
                      <div
                        key={supplier.id}
                        onClick={() => {
                          formik.setFieldValue("supplierName", supplier.name);
                          formik.setFieldValue("supplierPhone", supplier.phone || "");
                          setSupplierSearchTerm(supplier.name);
                          setShowSupplierDropdown(false);
                        }}
                        className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">
                              {supplier.name}
                            </p>
                            {supplier.phone && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {supplier.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Mobile Number</Label>
                <Input
                  name="supplierPhone"
                  value={supplierPhone}
                  onChange={(e) => {
                    formik.setFieldValue("supplierPhone", e.target.value);
                  }}
                  onBlur={() => formik.handleBlur("supplierPhone")}
                  placeholder="Enter mobile number (optional)"
                  type="tel"
                  error={(showErrors && !!formik.errors.supplierPhone) || !!backendErrors.supplierPhone}
                  hint={
                    (showErrors &&
                      (typeof formik.errors.supplierPhone === "string"
                        ? formik.errors.supplierPhone
                        : undefined)) ||
                    backendErrors.supplierPhone
                  }
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
                    formik.setFieldValue("date", e.target.value);
                  }}
                  onBlur={() => formik.handleBlur("date")}
                  required
                  error={(showErrors && !!formik.errors.date) || !!backendErrors.date}
                  hint={
                    (showErrors &&
                      (typeof formik.errors.date === "string"
                        ? formik.errors.date
                        : undefined)) ||
                    backendErrors.date
                  }
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
              <div className="flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <Label className="mb-0">Tax:</Label>
                  <Input
                    type="number"
                    name="tax"
                    step={0.01}
                    min="0"
                    value={tax}
                    onChange={(e) => {
                      const taxValue = parseFloat(e.target.value) || 0;
                      setTax(taxValue);
                      formik.setFieldValue("tax", taxValue);
                    }}
                    onBlur={() => formik.handleBlur("tax")}
                    className="w-20"
                    error={(showErrors && !!formik.errors.tax) || !!backendErrors.tax}
                    hint={
                      (showErrors &&
                        (typeof formik.errors.tax === "string" ? formik.errors.tax : undefined)) ||
                      backendErrors.tax
                    }
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
                          { value: "bank_transfer", label: "Bank Transfer" },
                        ]}
                      />
                    </div>
                    {payment.type === "bank_transfer" && (
                      <div className="mt-2">
                        <Label>
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
                              onChange={(value) => updatePayment(index, "bankAccountId", value)}
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
                            {((showErrors && !payment.bankAccountId) ||
                              backendErrors[`payments.${index}.bankAccountId`]) && (
                              <p className="mt-1 text-xs text-error-500">
                                {backendErrors[`payments.${index}.bankAccountId`] ||
                                  "Please select a bank account for this payment"}
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
                      <Label>
                        Amount <span className="text-error-500">*</span>
                      </Label>
                      <Input
                        type="number"
                        step={0.01}
                        min="0.01"
                        max={String(total - totalPaid + payment.amount)}
                        value={payment.amount}
                        onChange={(e) => updatePayment(index, "amount", parseFloat(e.target.value) || 0)}
                        placeholder="Enter amount"
                        required
                        error={
                          (showErrors && (!payment.amount || payment.amount <= 0)) ||
                          !!backendErrors[`payments.${index}.amount`]
                        }
                        hint={
                          (showErrors && (!payment.amount || payment.amount <= 0)
                            ? "Amount must be greater than 0"
                            : undefined) ||
                          backendErrors[`payments.${index}.amount`]
                        }
                      />
                    </div>
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
              onClick={() => {
                setShowErrors(true);
                formik.handleSubmit();
              }}
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



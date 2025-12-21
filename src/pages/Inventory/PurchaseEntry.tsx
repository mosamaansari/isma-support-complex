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
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import TaxDiscountInput from "../../components/form/TaxDiscountInput";
import Button from "../../components/ui/button/Button";
import { TrashBinIcon, ChevronLeftIcon, PlusIcon } from "../../icons";
import api from "../../services/api";
import { hasPermission } from "../../utils/permissions";
import { AVAILABLE_PERMISSIONS } from "../../utils/availablePermissions";
import { extractErrorMessage } from "../../utils/errorHandler";
import { getTodayDate, formatDateToString } from "../../utils/dateHelpers";

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
    (PurchaseItem & { product: Product })[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [date, setDate] = useState(getTodayDate());
  const [tax, setTax] = useState<number | null>(null);
  const [taxType, setTaxType] = useState<"percent" | "value">("percent");
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

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
    // Add default cash payment
    if (payments.length === 0 && !isEdit) {
      setPayments([{ type: "cash", amount: undefined }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load purchase data for edit
  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      api.getPurchase(id)
        .then((purchase: any) => {
          setValue("supplierName", purchase.supplierName);
          setValue("supplierPhone", purchase.supplierPhone || "");
          // Format date to YYYY-MM-DD (accurate, no timezone issues)
          const purchaseDate = new Date(purchase.date);
          setDate(formatDateToString(purchaseDate));
          setTax(purchase.tax ? Number(purchase.tax) : null);
          setTaxType((purchase.taxType as "percent" | "value") || "percent");
          setPayments((purchase.payments || []) as PurchasePayment[]);
          
          // Load products for items
          const itemsWithProducts = purchase.items.map((item: any) => {
            const product = products.find(p => p.id === item.productId);
            return {
              ...item,
              productId: item.productId?.trim() || item.productId,
              shopQuantity: item.shopQuantity,
              warehouseQuantity: item.warehouseQuantity,
              quantity: (item.shopQuantity || 0) + (item.warehouseQuantity || 0),
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
      setSelectedProducts([
        ...selectedProducts,
        {
          productId: product.id.trim(),
          productName: product.name,
          quantity: undefined as any,
          shopQuantity: undefined as any,
          warehouseQuantity: undefined as any,
          cost: undefined as any,
          total: 0,
          product,
        },
      ]);
    }
    setSearchTerm("");
  };

  const updateItemShopQuantity = (productId: string, shopQuantity: number | undefined) => {
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          const shopQty = shopQuantity || 0;
          const warehouseQty = item.warehouseQuantity || 0;
          const totalQty = shopQty + warehouseQty;
          const costValue = item.cost || 0;
          return { 
            ...item, 
            shopQuantity: shopQuantity, 
            quantity: totalQty,
            total: costValue * totalQty 
          };
        }
        return item;
      })
    );
  };

  const updateItemWarehouseQuantity = (productId: string, warehouseQuantity: number | undefined) => {
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          const shopQty = item.shopQuantity || 0;
          const warehouseQty = warehouseQuantity || 0;
          const totalQty = shopQty + warehouseQty;
          const costValue = item.cost || 0;
          return { 
            ...item, 
            warehouseQuantity: warehouseQuantity, 
            quantity: totalQty,
            total: costValue * totalQty 
          };
        }
        return item;
      })
    );
  };

  const updateItemCost = (productId: string, cost: number | undefined) => {
    setSelectedProducts(
      selectedProducts.map((item) => {
        if (item.productId === productId) {
          const costValue = cost || 0;
          const shopQty = item.shopQuantity || 0;
          const warehouseQty = item.warehouseQuantity || 0;
          const totalQty = shopQty + warehouseQty;
          return { 
            ...item, 
            cost: cost, 
            quantity: totalQty,
            total: costValue * totalQty 
          };
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
    if (payments.length === 0) {
      showError("Please add at least one payment method");
      return;
    }
    if (totalPaid > total) {
      showError("Total paid amount cannot exceed total amount");
      return;
    }

    // Validate payments
    for (const payment of payments) {
      if (payment.amount === undefined || payment.amount === null || payment.amount <= 0) {
        showError("Please enter a valid amount for all payments");
        return;
      }
      if (payment.type === "bank_transfer" && !payment.bankAccountId) {
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
      const shopQty = item.shopQuantity || 0;
      const warehouseQty = item.warehouseQuantity || 0;
      const totalQty = shopQty + warehouseQty;
      
      if (totalQty <= 0) {
        showError(`Please enter a valid quantity (shop or warehouse) for ${item.productName || 'product'}`);
        setIsSubmitting(false);
        return;
      }
      if (item.cost === undefined || item.cost === null || item.cost <= 0) {
        showError(`Please enter a valid cost for ${item.productName || 'product'}`);
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const purchaseItems: PurchaseItem[] = selectedProducts.map((item) => {
        const shopQty = item.shopQuantity || 0;
        const warehouseQty = item.warehouseQuantity || 0;
        const totalQty = shopQty + warehouseQty;
        
        return {
          productId: item.productId.trim(),
          productName: item.productName,
          quantity: totalQty,
          shopQuantity: shopQty,
          warehouseQuantity: warehouseQty,
          cost: item.cost || 0,
          discount: item.discount || 0,
          total: item.total || 0,
          toWarehouse: warehouseQty > 0 && shopQty === 0 ? true : (shopQty > 0 && warehouseQty === 0 ? false : (item.toWarehouse !== undefined ? item.toWarehouse : true)),
        };
      });

      const purchaseData = {
        supplierName: data.supplierName.trim(),
        supplierPhone: data.supplierPhone || undefined,
        items: purchaseItems,
        subtotal,
        tax: taxAmount,
        taxType: taxType,
        total,
        payments: payments.map(p => ({
          ...p,
          date: new Date().toISOString(), // Always use current date and time
        })),
        remainingBalance,
        date: data.date,
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

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
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
                            min="0"
                            value={item.cost === undefined || item.cost === null ? "" : item.cost}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || value === null || value === undefined) {
                                updateItemCost(item.productId, undefined);
                              } else {
                                const numValue = parseFloat(value);
                                updateItemCost(item.productId, isNaN(numValue) ? undefined : numValue);
                              }
                            }}
                            className="w-24"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={item.shopQuantity === undefined || item.shopQuantity === null ? "" : item.shopQuantity}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || value === null || value === undefined) {
                                updateItemShopQuantity(item.productId, undefined);
                              } else {
                                const numValue = parseInt(value);
                                updateItemShopQuantity(item.productId, isNaN(numValue) ? undefined : numValue);
                              }
                            }}
                            className="w-20"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={item.warehouseQuantity === undefined || item.warehouseQuantity === null ? "" : item.warehouseQuantity}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || value === null || value === undefined) {
                                updateItemWarehouseQuantity(item.productId, undefined);
                              } else {
                                const numValue = parseInt(value);
                                updateItemWarehouseQuantity(item.productId, isNaN(numValue) ? undefined : numValue);
                              }
                            }}
                            className="w-20"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2 font-semibold text-gray-800 dark:text-white">
                          Rs. {(item.total || 0).toFixed(2)}
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
                <Input
                  type="date"
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
                  <TaxDiscountInput
                    value={tax}
                    type={taxType}
                    onValueChange={(value) => {
                      setTax(value || null);
                      setValue("tax", value || null);
                    }}
                    onTypeChange={(type) => {
                      setTaxType(type);
                    }}
                    placeholder="0"
                    className="w-32"
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
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step={0.01}
                        min="0"
                        max={String(total - totalPaid + (payment.amount || 0))}
                        value={payment.amount === undefined || payment.amount === null ? "" : payment.amount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || value === null || value === undefined) {
                            updatePayment(index, "amount", undefined);
                          } else {
                            const numValue = parseFloat(value);
                            updatePayment(index, "amount", isNaN(numValue) ? undefined : numValue);
                          }
                        }}
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
              onClick={handleFormSubmit(onSubmit)}
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

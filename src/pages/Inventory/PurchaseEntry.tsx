import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { Product, PurchaseItem } from "../../types";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { TrashBinIcon, ChevronLeftIcon } from "../../icons";

export default function PurchaseEntry() {
  const { products, addPurchase, currentUser } = useData();
  const navigate = useNavigate();
  const [supplierName, setSupplierName] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<
    (PurchaseItem & { product: Product })[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

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
          cost: product.cost,
          total: product.cost,
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

  const totalAmount = selectedProducts.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = () => {
    if (selectedProducts.length === 0) {
      alert("Please add at least one product");
      return;
    }
    if (!supplierName) {
      alert("Please enter supplier name");
      return;
    }

    const purchaseItems: PurchaseItem[] = selectedProducts.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      cost: item.cost,
      total: item.total,
    }));

    addPurchase({
      supplierName,
      items: purchaseItems,
      total: totalAmount,
      date,
      userId: currentUser!.id,
      userName: currentUser!.name,
    });

    alert("Purchase entry added successfully!");
    navigate("/inventory/purchases");
  };

  return (
    <>
      <PageMeta
        title="Purchase Entry | Isma Sports Complex"
        description="Add new purchase entry"
      />
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
                          Current Stock: {product.quantity}
                        </p>
                      </div>
                      <p className="font-semibold text-brand-600 dark:text-brand-400">
                        Rs. {product.cost.toFixed(2)}
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
            <div className="space-y-3">
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-lg font-semibold text-gray-800 dark:text-white">
                  Total:
                </span>
                <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
                  Rs. {totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full mt-6"
              size="sm"
              disabled={selectedProducts.length === 0 || !supplierName}
            >
              Save Purchase
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}


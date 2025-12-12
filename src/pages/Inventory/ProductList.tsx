import { useState, useEffect } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import { PencilIcon, TrashBinIcon, AlertIcon } from "../../icons";

export default function ProductList() {
  const {
    products,
    deleteProduct,
    getLowStockProducts,
    currentUser,
    loading,
    error,
    refreshProducts,
  } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Refresh products on mount if empty
  useEffect(() => {
    if (products.length === 0 && !loading && currentUser) {
      refreshProducts().catch(console.error);
    }
  }, [products.length, loading, currentUser, refreshProducts]);

  const lowStockProducts = getLowStockProducts();
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLowStock = !showLowStock || product.quantity <= product.minStockLevel;
    return matchesSearch && matchesLowStock;
  });

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      setIsDeleting(id);
      try {
        await deleteProduct(id);
        await refreshProducts();
      } catch (err) {
        alert("Failed to delete product. Please try again.");
        console.error("Delete error:", err);
      } finally {
        setIsDeleting(null);
      }
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
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

  if (error && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error: {error}</p>
          <Button onClick={() => refreshProducts()} size="sm">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Product List | Isma Sports Complex"
        description="Manage products and inventory"
      />
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              Products & Inventory
            </h1>
            {lowStockProducts.length > 0 && (
              <div className="flex items-center gap-2 mt-2 text-orange-600 dark:text-orange-400">
                <AlertIcon className="w-5 h-5" />
                <span className="text-sm">
                  {lowStockProducts.length} product(s) are low in stock
                </span>
              </div>
            )}
          </div>
          <Link to="/inventory/product/add">
            <Button size="sm">Add Product</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Products</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {products.length}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Low Stock</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {lowStockProducts.length}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Stock Value</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              Rs.{" "}
              {products
                .reduce((sum, p) => sum + (p.quantity || 0) * (p.cost || 0), 0)
                .toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products by name or category..."
          />
          <label className="flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm cursor-pointer dark:bg-gray-800">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Show only low stock items
            </span>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-sm dark:bg-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Image
                      </th>
                      <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Product Name
                      </th>
                      <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Category
                      </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Cost Price
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Sale Price
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Quantity
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Min Stock
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </th>
              <th className="p-4 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  {products.length === 0
                    ? "No products available. Add your first product!"
                    : "No products match your search criteria"}
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => {
                const isLowStock = product.quantity <= product.minStockLevel;
                return (
                  <tr
                    key={product.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="p-4">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center dark:bg-gray-700">
                          <span className="text-xs text-gray-500">No Image</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-medium text-gray-800 dark:text-white">
                      {product.name}
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      {product.category}
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      Rs. {Number(product.cost || 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      Rs. {Number(product.salePrice || 0).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`font-semibold ${
                          isLowStock
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-gray-800 dark:text-white"
                        }`}
                      >
                        {product.quantity}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      {product.minStockLevel}
                    </td>
                    <td className="p-4">
                      {isLowStock ? (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link to={`/inventory/product/edit/${product.id}`}>
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        </Link>
                        {(currentUser?.role === "admin" ||
                          currentUser?.role === "warehouse_manager" ||
                          currentUser?.role === "superadmin") && (
                          <button
                            onClick={() => handleDelete(product.id)}
                            disabled={isDeleting === product.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <TrashBinIcon className="w-4 h-4" />
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
    </>
  );
}


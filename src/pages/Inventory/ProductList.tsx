import { useState, useEffect } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import Pagination from "../../components/ui/Pagination";
import PageSizeSelector from "../../components/ui/PageSizeSelector";
import { Modal } from "../../components/ui/modal";
import { PencilIcon, TrashBinIcon, AlertIcon } from "../../icons";

export default function ProductList() {
  const {
    products,
    productsPagination,
    deleteProduct,
    getLowStockProducts,
    currentUser,
    loading,
    error,
    refreshProducts,
  } = useData();
  const { showSuccess, showError } = useAlert();
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [hasTriedRefresh, setHasTriedRefresh] = useState(false);

  // Refresh products on mount if empty (only once)
  useEffect(() => {
    if (products.length === 0 && !loading && currentUser && !hasTriedRefresh) {
      setHasTriedRefresh(true);
      // Use default values if pagination is not initialized
      refreshProducts(productsPagination?.page || 1, productsPagination?.pageSize || 10).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length, loading, currentUser]);

  const handlePageChange = (page: number) => {
    refreshProducts(page, productsPagination?.pageSize || 10);
  };

  const handlePageSizeChange = (pageSize: number) => {
    refreshProducts(1, pageSize);
  };

  const lowStockProducts = getLowStockProducts();
  const filteredProducts = (products || []).filter((product) => {
    if (!product || !product.name) return false;
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const shopMin = (product as any).shopMinStockLevel ?? product.minStockLevel ?? 0;
    const warehouseMin = (product as any).warehouseMinStockLevel ?? product.minStockLevel ?? 0;
    const shopLow = shopMin > 0 && (product.shopQuantity || 0) <= shopMin;
    const warehouseLow = warehouseMin > 0 && (product.warehouseQuantity || 0) <= warehouseMin;
    const matchesLowStock =
      !showLowStock || shopLow || warehouseLow;
    return matchesSearch && matchesLowStock;
  });

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    
    setIsDeleting(productToDelete);
    try {
      await deleteProduct(productToDelete);
      await refreshProducts(productsPagination?.page || 1, productsPagination?.pageSize || 10);
      setDeleteModalOpen(false);
      setProductToDelete(null);
      showSuccess("Product deleted successfully!");
    } catch (err) {
      showError("Failed to delete product. Please try again.");
      console.error("Delete error:", err);
    } finally {
      setIsDeleting(null);
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
          <Button onClick={() => refreshProducts(productsPagination?.page || 1, productsPagination?.pageSize || 10)} size="sm">
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
            {(lowStockProducts || []).length > 0 && (
              <div className="flex items-center gap-2 mt-2 text-orange-600 dark:text-orange-400">
                <AlertIcon className="w-5 h-5" />
                <span className="text-sm">
                  {(lowStockProducts || []).length} product(s) are low in stock
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
              {(products || []).length}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Low Stock</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {(lowStockProducts || []).length}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Stock Value</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              Rs.{" "}
              {(products || [])
                .reduce((sum, p) => {
                  if (!p) return sum;
                  const totalQuantity = (p.shopQuantity || 0) + (p.warehouseQuantity || 0);
                  const price = p.salePrice || 0;
                  return sum + totalQuantity * price;
                }, 0)
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
                Sale Price
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Shop Stock
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Warehouse Stock
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Total Stock
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
                const totalQuantity = (product.shopQuantity || 0) + (product.warehouseQuantity || 0);
                const shopMin = (product as any).shopMinStockLevel ?? product.minStockLevel ?? 0;
                const warehouseMin = (product as any).warehouseMinStockLevel ?? product.minStockLevel ?? 0;
                const shopLow = shopMin > 0 && (product.shopQuantity || 0) <= shopMin;
                const warehouseLow = warehouseMin > 0 && (product.warehouseQuantity || 0) <= warehouseMin;
                const isLowStock = shopLow || warehouseLow;
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
                      Rs. {Number(product.salePrice || 0).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`font-semibold ${shopLow ? "text-orange-600 dark:text-orange-400" : "text-gray-800 dark:text-white"}`}
                      >
                        {(product.shopQuantity || 0)}{" "}
                        <span className="text-xs text-gray-500 dark:text-gray-400">(min {shopMin})</span>
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`font-semibold ${warehouseLow ? "text-orange-600 dark:text-orange-400" : "text-gray-800 dark:text-white"}`}
                      >
                        {(product.warehouseQuantity || 0)}{" "}
                        <span className="text-xs text-gray-500 dark:text-gray-400">(min {warehouseMin})</span>
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-gray-800 dark:text-white">
                      {totalQuantity}
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
                            onClick={() => handleDeleteClick(product.id)}
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

      {/* Pagination Controls */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg shadow-sm p-4 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <PageSizeSelector
            pageSize={productsPagination?.pageSize || 10}
            onPageSizeChange={handlePageSizeChange}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((productsPagination.page - 1) * productsPagination.pageSize) + 1} to{" "}
            {Math.min(productsPagination.page * productsPagination.pageSize, productsPagination.total)} of{" "}
            {productsPagination.total} products
          </span>
        </div>
        <Pagination
          currentPage={productsPagination?.page || 1}
          totalPages={productsPagination?.totalPages || 1}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setProductToDelete(null);
        }}
        className="max-w-md mx-4"
        showCloseButton={true}
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full dark:bg-red-900/20">
              <TrashBinIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Delete Product
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This action cannot be undone
              </p>
            </div>
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Are you sure you want to delete this product? This will permanently remove the product and all associated data.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteModalOpen(false);
                setProductToDelete(null);
              }}
              disabled={isDeleting !== null}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmDelete}
              disabled={isDeleting !== null}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete Product"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}



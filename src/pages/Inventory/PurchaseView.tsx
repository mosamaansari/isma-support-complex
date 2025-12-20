import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import api from "../../services/api";
import { Purchase, PurchasePayment } from "../../types";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";

export default function PurchaseView() {
  const { id } = useParams<{ id: string }>();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      setLoading(true);
      setError(null);
      api
        .getPurchase(id)
        .then((data: any) => {
          setPurchase(data);
        })
        .catch((err: any) => {
          console.error("Error loading purchase:", err);
          setError(err.response?.data?.error || "Failed to load purchase data");
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <>
        <PageMeta title="Purchase Details | Isma Sports Complex" description="View purchase details" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading purchase details...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !purchase) {
    return (
      <>
        <PageMeta title="Purchase Details | Isma Sports Complex" description="View purchase details" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error || "Purchase not found"}</p>
            <Link to="/inventory/purchases">
              <Button>Back to Purchases</Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  const payments = (purchase.payments || []) as PurchasePayment[];
  const totalPaid = payments.reduce((sum, p) => sum + (p?.amount || 0), 0);

  return (
    <>
      <PageMeta title="Purchase Details | Isma Sports Complex" description="View purchase details" />
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link to="/inventory/purchases">
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded dark:hover:bg-gray-800">
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Purchase Details</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <DownloadIcon className="w-4 h-4" />
              Print
            </button>
            <Link to={`/inventory/purchase/edit/${purchase.id}`}>
              <Button>Edit Purchase</Button>
            </Link>
          </div>
        </div>

        {/* Screen View */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Supplier Information</h3>
              <p className="text-gray-800 dark:text-white font-medium">{purchase.supplierName}</p>
              {purchase.supplierPhone && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">{purchase.supplierPhone}</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Purchase Information</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Date: {new Date(purchase.date).toLocaleDateString()}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Status:{" "}
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    purchase.status === "completed"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                      : purchase.status === "pending"
                      ? "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                  }`}
                >
                  {purchase.status || "completed"}
                </span>
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Product</th>
                    <th className="text-right p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Quantity</th>
                    <th className="text-right p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Cost</th>
                    <th className="text-right p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Discount</th>
                    <th className="text-right p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="p-3 text-gray-800 dark:text-white">{item.productName}</td>
                      <td className="p-3 text-right text-gray-600 dark:text-gray-400">{item.quantity}</td>
                      <td className="p-3 text-right text-gray-600 dark:text-gray-400">Rs. {(item.cost || 0).toFixed(2)}</td>
                      <td className="p-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {((item as any).discountType === "percent" ? `${item.discount || 0}%` : `Rs. ${(item.discount || 0).toFixed(2)}`)}
                      </td>
                      <td className="p-3 text-right text-gray-800 dark:text-white font-medium">
                        Rs. {item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal:</span>
                  <span>Rs. {purchase.subtotal.toFixed(2)}</span>
                </div>
                {(purchase as any).discount > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Discount{((purchase as any).discountType === "percent" ? " (%)" : " (Rs)")}:</span>
                    <span className="text-red-600 dark:text-red-400">
                      - Rs. {Number((purchase as any).discount || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {purchase.tax > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Tax{((purchase as any).taxType === "percent" ? " (%)" : " (Rs)")}:</span>
                    <span>+ Rs. {(purchase.tax || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold text-gray-800 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span>Total:</span>
                  <span>Rs. {purchase.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Payment Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Total Paid:</span>
                  <span className="text-green-600 dark:text-green-400">Rs. {totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Remaining Balance:</span>
                  <span className="text-orange-600 dark:text-orange-400">
                    Rs. {(purchase.remainingBalance || 0).toFixed(2)}
                  </span>
                </div>
                {payments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Payment History:</p>
                    {payments.map((p, idx) => (
                      <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {new Date(p.date || purchase.date).toLocaleDateString()} - {p.type.toUpperCase()}: Rs.{" "}
                        {(p.amount || 0).toFixed(2)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Print View */}
        <div className="hidden print:block p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Purchase Receipt</h2>
            <p className="text-gray-600">Date: {new Date(purchase.date).toLocaleDateString()}</p>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Supplier: {purchase.supplierName}</h3>
            {purchase.supplierPhone && <p>Phone: {purchase.supplierPhone}</p>}
          </div>

          <table className="w-full border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left p-2">Product</th>
                <th className="text-right p-2">Qty</th>
                <th className="text-right p-2">Cost</th>
                <th className="text-right p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-300">
                  <td className="p-2">{item.productName}</td>
                  <td className="p-2 text-right">{item.quantity}</td>
                  <td className="p-2 text-right">Rs. {(item.cost || 0).toFixed(2)}</td>
                  <td className="p-2 text-right">Rs. {item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-800">
                <td colSpan={3} className="p-2 text-right font-semibold">Total:</td>
                <td className="p-2 text-right font-semibold">Rs. {purchase.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="mb-4">
            <p>
              <strong>Total Paid:</strong> Rs. {totalPaid.toFixed(2)}
            </p>
            <p>
              <strong>Remaining Balance:</strong> Rs. {(purchase.remainingBalance || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}


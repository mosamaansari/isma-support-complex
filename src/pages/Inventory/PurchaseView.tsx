import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import api from "../../services/api";
import { Purchase, PurchasePayment } from "../../types";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import { formatBackendDateOnly } from "../../utils/dateHelpers";
import { useData } from "../../context/DataContext";
import { hasResourcePermission } from "../../utils/permissions";

export default function PurchaseView() {
  const { currentUser, settings } = useData();
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

  // Calculate actual discount and tax amounts
  const discountType = (purchase as any).discountType || "percent";
  const taxType = (purchase as any).taxType || "percent";

  const actualDiscountAmount = discountType === "value"
    ? (purchase as any).discount
    : (purchase.subtotal * ((purchase as any).discount || 0)) / 100;

  const actualTaxAmount = taxType === "value"
    ? purchase.tax
    : ((purchase.subtotal - actualDiscountAmount) * purchase.tax) / 100;

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
            <Link to={`/inventory/purchase/bill/${purchase.id}`}>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                Print Slip
              </button>
            </Link>
    
            {currentUser && hasResourcePermission(currentUser.role, 'purchases:update', currentUser.permissions) && (
              purchase.status === "pending" ? (
                <Link to={`/inventory/purchase/edit/${purchase.id}`}>
                  <Button>Edit Purchase</Button>
                </Link>
              ) : (
                <div className="relative group">
                  <button
                    disabled
                    className="px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50 flex items-center gap-2"
                    title={purchase.status === "completed" ? "Completed payment edit nhi ho skti purchase ki" : "Cancelled purchases cannot be edited"}
                  >
                    Edit Purchase
                  </button>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {purchase.status === "completed" ? "Completed payment edit nhi ho skti purchase ki" : "Cancelled purchases cannot be edited"}
                  </div>
                </div>
              )
            )}
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
                Date: {formatBackendDateOnly(purchase.date)}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Status:{" "}
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${purchase.status === "completed"
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
                {actualDiscountAmount > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Discount{discountType === "value" ? " (Rs)" : ` (${(purchase as any).discount}%)`}:</span>
                    <span className="text-red-600 dark:text-red-400">
                      - Rs. {actualDiscountAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                {actualTaxAmount > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Tax{taxType === "value" ? " (Rs)" : ` (${purchase.tax}%)`}:</span>
                    <span>+ Rs. {actualTaxAmount.toFixed(2)}</span>
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
                        {formatBackendDateOnly(p.date || purchase.date)} - {p.type.toUpperCase()}: Rs.{" "}
                        {(p.amount || 0).toFixed(2)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Thermal-style print view (shown only when printing) */}
        <div
          className="print-receipt"
          style={{ display: "none" }}
        >
          <div className="shop-header">
            <div className="shop-name">{settings.shopName}</div>
            <div className="shop-details">
              Address: {settings.address}<br />
              Telp. {settings.contactNumber}
            </div>
          </div>
          <div className="separator">********************************</div>
          <div className="section-title">PURCHASE RECEIPT</div>
          <div className="separator">********************************</div>

          <div className="customer-info">
            <div><strong>Supplier:</strong> {purchase.supplierName}</div>
            {purchase.supplierPhone && (
              <div><strong>Phone:</strong> {purchase.supplierPhone}</div>
            )}
          </div>

          <div className="separator">********************************</div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item, idx) => (
                <tr key={idx}>
                  <td colSpan={3}>
                    <div style={{ fontWeight: 'bold' }}>{item.productName}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{item.quantity} x Rs. {item.cost?.toFixed(2)}</span>
                      <span>Rs. {item.total.toFixed(2)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="separator">********************************</div>

          <div className="totals">
            <div className="totals-row">
              <span>Subtotal:</span>
              <span>Rs. {purchase.subtotal.toFixed(2)}</span>
            </div>
            {actualDiscountAmount > 0 && (
              <div className="totals-row">
                <span>Discount:</span>
                <span>- Rs. {actualDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            {actualTaxAmount > 0 && (
              <div className="totals-row">
                <span>Tax:</span>
                <span>+ Rs. {actualTaxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="totals-row total-row">
              <span>Grand Total:</span>
              <span>Rs. {purchase.total.toFixed(2)}</span>
            </div>
            <div className="totals-row">
              <span>Total Paid:</span>
              <span>Rs. {totalPaid.toFixed(2)}</span>
            </div>
            <div className="totals-row">
              <span>Remaining:</span>
              <span>Rs. {purchase.remainingBalance.toFixed(2)}</span>
            </div>
          </div>

          <div className="separator">********************************</div>

          <div className="footer">
            <div className="thank-you">THANK YOU!</div>
            <div>Order #: {purchase.id.slice(-8).toUpperCase()}</div>
            <div>Date: {new Date().toLocaleString()}</div>
          </div>
        </div>

        <style>{`
          @media print {
            .no-print {
              display: none !important;
            }
            .print-hidden {
              display: none !important;
            }
            body > *:not(.print-receipt) {
              display: none !important;
            }
            body {
              background: white;
              padding: 0 !important;
              margin: 0 !important;
            }
            .print-receipt {
              display: block !important;
              position: absolute;
              left: 50%;
              transform: translateX(-50%);
              top: 0;
              width: 80mm;
              max-width: 80mm;
              margin: 0;
              padding: 4mm;
              font-size: 12px;
              color: #000;
              background: #fff;
            }
            .print-receipt .shop-header {
              text-align: center;
              margin-bottom: 8px;
              border-bottom: 1px dashed #000;
              padding-bottom: 8px;
            }
            .print-receipt .shop-name {
              font-weight: bold;
              font-size: 14px;
              margin-bottom: 4px;
              text-transform: uppercase;
            }
            .print-receipt .shop-details {
              font-size: 10px;
              line-height: 1.4;
            }
            .print-receipt .separator {
              text-align: center;
              margin: 6px 0;
              font-size: 10px;
            }
            .print-receipt .section-title {
              text-align: center;
              font-weight: bold;
              font-size: 12px;
              margin: 8px 0;
              text-transform: uppercase;
            }
            .print-receipt .customer-info {
              margin: 8px 0;
              font-size: 11px;
              line-height: 1.5;
            }
            .print-receipt table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
              font-size: 11px;
            }
            .print-receipt table th {
              text-align: left;
              padding: 4px 2px;
              font-weight: bold;
              border-bottom: 1px dashed #000;
            }
            .print-receipt table td {
              padding: 4px 2px;
            }
            .print-receipt .text-right {
              text-align: right;
            }
            .print-receipt .totals {
              margin: 8px 0;
              font-size: 11px;
            }
            .print-receipt .totals-row {
              display: flex;
              justify-content: space-between;
              margin: 3px 0;
            }
            .print-receipt .total-row {
              font-weight: bold;
              font-size: 13px;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 4px 0;
              margin: 6px 0;
            }
            .print-receipt .footer {
              text-align: center;
              margin-top: 12px;
              font-size: 10px;
            }
            .print-receipt .thank-you {
              font-weight: bold;
              font-size: 12px;
              margin: 8px 0;
            }
          }
        `}</style>
      </div>
    </>
  );
}


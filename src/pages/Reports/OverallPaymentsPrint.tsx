import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import api from "../../services/api";
import { Sale, SalePayment, Purchase, PurchasePayment } from "../../types";

export default function OverallPaymentsPrint() {
  const [searchParams] = useSearchParams();
  const { settings } = useData();
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [type, setType] = useState<"sales" | "purchases" | "all">("all");

  useEffect(() => {
    const fetchData = async () => {
      const start = searchParams.get("startDate") || "";
      const end = searchParams.get("endDate") || "";
      const t = (searchParams.get("type") as "sales" | "purchases" | "all") || "all";

      setStartDate(start);
      setEndDate(end);
      setType(t);

      if (!start || !end) {
        setError("Start date and end date are required");
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        if (t === "sales" || t === "all") {
          const salesData = await api.getSales({ startDate: start, endDate: end });
          setSales(Array.isArray(salesData.data) ? salesData.data : []);
        }
        
        if (t === "purchases" || t === "all") {
          const purchasesData = await api.getPurchases({ startDate: start, endDate: end });
          setPurchases(Array.isArray(purchasesData.data) ? purchasesData.data : []);
        }
      } catch (err: any) {
        console.error("Error fetching payments:", err);
        setError(err.response?.data?.error || err.message || "Failed to load payments");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchParams]);

  useEffect(() => {
    if (!loading && (sales.length > 0 || purchases.length > 0)) {
      window.print();
    }
  }, [loading, sales, purchases]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading payments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => navigate("/reports")} variant="outline" size="sm">
          Back to Reports
        </Button>
      </div>
    );
  }

  // Collect all payments
  const allSalesPayments: Array<{ sale: Sale; payment: SalePayment & { date?: string }; index: number }> = [];
  sales.forEach((sale) => {
    (sale.payments || []).forEach((payment: SalePayment & { date?: string }, index: number) => {
      allSalesPayments.push({ sale, payment, index });
    });
  });

  const allPurchasePayments: Array<{ purchase: Purchase; payment: PurchasePayment; index: number }> = [];
  purchases.forEach((purchase) => {
    (purchase.payments || []).forEach((payment: PurchasePayment, index: number) => {
      allPurchasePayments.push({ purchase, payment, index });
    });
  });

  const totalSalesPayments = allSalesPayments.reduce((sum, item) => sum + item.payment.amount, 0);
  const totalPurchasePayments = allPurchasePayments.reduce((sum, item) => sum + item.payment.amount, 0);
  const grandTotal = totalSalesPayments + totalPurchasePayments;

  if (allSalesPayments.length === 0 && allPurchasePayments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-500 mb-4">No payments found for the selected period</p>
        <Button onClick={() => navigate("/reports")} variant="outline" size="sm">
          Back to Reports
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={`Overall Payments Report | Isma Sports Complex`}
        description="Overall payments report"
      />
      <div className="print-container max-w-5xl mx-auto p-8 bg-white">
        {/* Print Controls - Hidden when printing */}
        <div className="no-print mb-6 flex items-center justify-between">
          <Button
            onClick={() => navigate("/reports")}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Reports
          </Button>
          <Button
            onClick={() => window.print()}
            size="sm"
            className="flex items-center gap-2"
          >
            <DownloadIcon className="w-4 h-4" />
            Print
          </Button>
        </div>

        {/* Overall Payments Report */}
        <div className="border-2 border-gray-300 rounded-lg p-8">
          {/* Header */}
          <div className="text-center mb-8 border-b-2 border-gray-300 pb-4">
            {settings.logo && (
              <img
                src={settings.logo}
                alt="Logo"
                className="h-16 mx-auto mb-4"
              />
            )}
            <h1 className="text-3xl font-bold text-gray-800">{settings.shopName}</h1>
            <p className="text-gray-600 mt-2">{settings.address}</p>
            <p className="text-gray-600">
              {settings.contactNumber} {settings.email && `| ${settings.email}`}
            </p>
            <h2 className="text-2xl font-semibold text-gray-800 mt-4">OVERALL PAYMENTS REPORT</h2>
            <p className="text-gray-600 mt-2">
              {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
            </p>
          </div>

          {/* Summary */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales Payments</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">Rs. {totalSalesPayments.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">{allSalesPayments.length} payment(s)</p>
            </div>
            <div className="p-4 bg-gray-50 rounded dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Purchase Payments</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">Rs. {totalPurchasePayments.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">{allPurchasePayments.length} payment(s)</p>
            </div>
            <div className="p-4 bg-blue-50 rounded dark:bg-blue-900/20">
              <p className="text-sm text-gray-600 dark:text-gray-400">Grand Total</p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-400">Rs. {grandTotal.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">{allSalesPayments.length + allPurchasePayments.length} payment(s)</p>
            </div>
          </div>

          {/* Sales Payments */}
          {(type === "sales" || type === "all") && allSalesPayments.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 border-b border-gray-300 pb-2">
                Sales Payments ({allSalesPayments.length})
              </h3>
              <div className="space-y-4">
                {allSalesPayments.map((item, idx) => {
                  const paymentDate = item.payment.date ? new Date(item.payment.date) : new Date(item.sale.date || item.sale.createdAt);
                  return (
                    <div key={`sale-${item.sale.id}-${idx}`} className="border border-gray-200 rounded p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">Bill #{item.sale.billNumber} - Payment #{item.index + 1}</p>
                          <p className="text-sm text-gray-600">
                            Customer: {item.sale.customerName || "Walk-in"}
                            {item.sale.customerPhone && ` | ${item.sale.customerPhone}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            Date: {paymentDate.toLocaleDateString()} {paymentDate.toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Type:</p>
                          <p className="font-semibold uppercase">{item.payment.type.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-gray-700">Amount:</span>
                        <span className="font-semibold text-lg">Rs. {item.payment.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Purchase Payments */}
          {(type === "purchases" || type === "all") && allPurchasePayments.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 border-b border-gray-300 pb-2">
                Purchase Payments ({allPurchasePayments.length})
              </h3>
              <div className="space-y-4">
                {allPurchasePayments.map((item, idx) => {
                  const paymentDate = item.payment.date ? new Date(item.payment.date) : new Date(item.purchase.date);
                  return (
                    <div key={`purchase-${item.purchase.id}-${idx}`} className="border border-gray-200 rounded p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">Purchase #{item.purchase.id.slice(-8)} - Payment #{item.index + 1}</p>
                          <p className="text-sm text-gray-600">
                            Supplier: {item.purchase.supplierName}
                            {item.purchase.supplierPhone && ` | ${item.purchase.supplierPhone}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            Date: {paymentDate.toLocaleDateString()} {paymentDate.toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Type:</p>
                          <p className="font-semibold uppercase">{item.payment.type}</p>
                        </div>
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-gray-700">Amount:</span>
                        <span className="font-semibold text-lg">Rs. {item.payment.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t-2 border-gray-300 pt-4 mt-6 text-center">
            <p className="text-sm text-gray-600">Overall Payments Report</p>
            <p className="text-xs text-gray-500 mt-2">
              This is a computer-generated report. No signature required.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-container {
            max-width: 100%;
            padding: 0;
          }
          body {
            background: white;
          }
        }
      `}</style>
    </>
  );
}






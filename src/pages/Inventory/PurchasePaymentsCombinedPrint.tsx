import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import api from "../../services/api";
import { Purchase, PurchasePayment } from "../../types";

export default function PurchasePaymentsCombinedPrint() {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const { settings } = useData();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!purchaseId) {
        navigate("/inventory/purchases");
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const fetchedPurchase = await api.getPurchase(purchaseId);
        if (fetchedPurchase) {
          setPurchase(fetchedPurchase);
        } else {
          setError("Purchase not found");
        }
      } catch (err: any) {
        console.error("Error fetching purchase:", err);
        setError(err.response?.data?.error || err.message || "Failed to load payments");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [purchaseId, navigate]);

  useEffect(() => {
    if (purchase && purchase.payments && purchase.payments.length > 0) {
      window.print();
    }
  }, [purchase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading payments...</p>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{error || "Purchase not found"}</p>
        <Button onClick={() => navigate("/inventory/purchases")} variant="outline" size="sm">
          Back to Purchases
        </Button>
      </div>
    );
  }

  const payments = purchase.payments || [];
  const totalPaid = payments.reduce((sum: number, p: PurchasePayment) => sum + (p?.amount || 0), 0);

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-500 mb-4">No payments found for this purchase</p>
        <Button onClick={() => navigate("/inventory/purchases")} variant="outline" size="sm">
          Back to Purchases
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={`All Payments - Purchase ${purchaseId} | Isma Sports Complex`}
        description="Combined payment receipt"
      />
      <div className="print-container max-w-4xl mx-auto p-8 bg-white">
        {/* Print Controls - Hidden when printing */}
        <div className="no-print mb-6 flex items-center justify-between">
          <Button
            onClick={() => navigate("/inventory/purchases")}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Purchases
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

        {/* Combined Payment Receipt */}
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
            <h2 className="text-2xl font-semibold text-gray-800 mt-4">COMBINED PAYMENT RECEIPT</h2>
          </div>

          {/* Purchase Details */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Purchase ID:</p>
                <p className="font-semibold text-lg">{purchaseId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Purchase Date:</p>
                <p className="font-semibold">{new Date(purchase.date).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">Supplier Name:</p>
              <p className="font-semibold">{purchase.supplierName}</p>
              {purchase.supplierPhone && (
                <p className="text-sm text-gray-600">Phone: {purchase.supplierPhone}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Purchase Total:</p>
                <p className="font-semibold text-lg">Rs. {purchase.total.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Remaining Balance:</p>
                <p className={`font-semibold text-lg ${purchase.remainingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  Rs. {purchase.remainingBalance.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* All Payments */}
          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">All Payments ({payments.length})</h3>
            <div className="space-y-4">
              {payments.map((payment: PurchasePayment, index: number) => {
                // Handle date - it might be ISO string or Date object
                let paymentDate: Date;
                if (payment.date) {
                  paymentDate = typeof payment.date === 'string' ? new Date(payment.date) : payment.date;
                } else {
                  paymentDate = new Date(purchase.date);
                }
                return (
                  <div key={index} className="border border-gray-200 rounded p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">Payment #{index + 1}</p>
                        <p className="text-sm text-gray-600">
                          Date: {paymentDate.toLocaleDateString()} {paymentDate.toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Type:</p>
                        <p className="font-semibold uppercase">{payment.type}</p>
                      </div>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-gray-700">Amount:</span>
                      <span className="font-semibold text-lg">Rs. {payment.amount.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t-2 border-gray-300 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total Paid:</span>
                <span className="font-bold text-xl">Rs. {totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Purchase Total:</span>
                <span className="font-semibold">Rs. {purchase.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Remaining Balance:</span>
                <span className={`font-semibold ${purchase.remainingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  Rs. {purchase.remainingBalance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-300 pt-4 mt-6 text-center">
            <p className="text-sm text-gray-600">Thank you for your payments!</p>
            <p className="text-xs text-gray-500 mt-2">
              This is a computer-generated receipt. No signature required.
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








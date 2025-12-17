import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import api from "../../services/api";
import { Purchase, PurchasePayment } from "../../types";

export default function PurchasePaymentPrint() {
  const { purchaseId, paymentIndex } = useParams<{ purchaseId: string; paymentIndex?: string }>();
  const { settings } = useData();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [payment, setPayment] = useState<PurchasePayment | null>(null);
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
          
          // Get specific payment if paymentIndex is provided
          if (paymentIndex !== undefined && fetchedPurchase.payments) {
            const index = parseInt(paymentIndex);
            if (index >= 0 && index < fetchedPurchase.payments.length) {
              setPayment(fetchedPurchase.payments[index]);
            }
          }
        } else {
          setError("Purchase not found");
        }
      } catch (err: any) {
        console.error("Error fetching purchase:", err);
        setError(err.response?.data?.error || err.message || "Failed to load payment");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [purchaseId, paymentIndex, navigate]);

  useEffect(() => {
    if (purchase && payment) {
      window.print();
    }
  }, [purchase, payment]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading payment...</p>
      </div>
    );
  }

  if (error || !purchase || !payment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{error || "Payment not found"}</p>
        <Button onClick={() => navigate("/inventory/purchases")} variant="outline" size="sm">
          Back to Purchases
        </Button>
      </div>
    );
  }

  // Handle date - it might be ISO string or Date object
  let paymentDate: Date;
  if (payment.date) {
    paymentDate = typeof payment.date === 'string' ? new Date(payment.date) : payment.date;
  } else {
    paymentDate = new Date(purchase.date);
  }
  const totalPaid = (purchase.payments || []).reduce((sum: number, p: PurchasePayment) => sum + (p?.amount || 0), 0);
  const paymentNumber = paymentIndex ? parseInt(paymentIndex) + 1 : 1;
  const totalPayments = (purchase.payments || []).length;

  return (
    <>
      <PageMeta
        title={`Payment Receipt - Purchase ${purchaseId} | Isma Sports Complex`}
        description="Payment receipt"
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

        {/* Payment Receipt */}
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
            <h2 className="text-2xl font-semibold text-gray-800 mt-4">PAYMENT RECEIPT</h2>
          </div>

          {/* Payment Details */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Receipt Number:</p>
                <p className="font-semibold">PUR-{purchaseId.slice(-8)}-PAY-{paymentNumber.toString().padStart(3, '0')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Date:</p>
                <p className="font-semibold">{paymentDate.toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Purchase ID:</p>
                <p className="font-semibold">{purchaseId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Time:</p>
                <p className="font-semibold">{paymentDate.toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">Supplier Name:</p>
              <p className="font-semibold">{purchase.supplierName}</p>
              {purchase.supplierPhone && (
                <p className="text-sm text-gray-600">Phone: {purchase.supplierPhone}</p>
              )}
            </div>
          </div>

          {/* Payment Information */}
          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">Payment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700">Payment Type:</span>
                <span className="font-semibold uppercase">{payment.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Amount Paid:</span>
                <span className="font-semibold text-lg">Rs. {payment.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Purchase Total:</span>
                <span className="font-semibold">Rs. {purchase.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Total Paid (All Payments):</span>
                <span className="font-semibold">Rs. {totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Remaining Balance:</span>
                <span className={`font-semibold ${purchase.remainingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  Rs. {purchase.remainingBalance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Payment {paymentNumber} of {totalPayments} payment(s) for Purchase #{purchaseId.slice(-8)}
            </p>
            {totalPayments > 1 && (
              <p className="text-xs text-gray-500">
                This is one of multiple payments. Please refer to combined receipt for complete payment history.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-300 pt-4 text-center">
            <p className="text-sm text-gray-600">Thank you for your payment!</p>
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






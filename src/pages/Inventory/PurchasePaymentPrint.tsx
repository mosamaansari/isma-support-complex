import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import api from "../../services/api";
import { Purchase, PurchasePayment } from "../../types";

// Printing helper: show whole numbers only (no decimals) on printed bills
const formatPrintAmount = (value: number | string | null | undefined): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "0";
  }
  return Math.round(num).toString();
};

// Parse date string directly to extract components without UTC conversion
const parseDateString = (dateStr: string | Date | undefined): { dateStr: string; timeStr: string; dateTimeStr: string } => {
  if (!dateStr) {
    const now = new Date();
    return {
      dateStr: now.toLocaleDateString(),
      timeStr: now.toLocaleTimeString(),
      dateTimeStr: now.toLocaleString()
    };
  }

  if (typeof dateStr === 'string') {
    // Extract date and time from ISO string directly
    // Format: "2026-01-24T04:36:52.331Z" or "2026-01-24T04:36:52.331"
    const dateTimeMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (dateTimeMatch) {
      const year = dateTimeMatch[1];
      const month = dateTimeMatch[2];
      const day = dateTimeMatch[3];
      const hours = dateTimeMatch[4];
      const minutes = dateTimeMatch[5];
      const seconds = dateTimeMatch[6];

      // Format date: MM/DD/YYYY
      const dateStr = `${month}/${day}/${year}`;

      // Format time in 12-hour format
      const hoursNum = parseInt(hours, 10);
      const isPM = hoursNum >= 12;
      const displayHours = hoursNum === 0 ? 12 : hoursNum > 12 ? hoursNum - 12 : hoursNum;
      const hoursStr = String(displayHours).padStart(2, "0");
      const ampm = isPM ? "PM" : "AM";
      const timeStr = `${hoursStr}:${minutes}:${seconds} ${ampm}`;

      return {
        dateStr,
        timeStr,
        dateTimeStr: `${dateStr} ${timeStr}`
      };
    }
  }

  // Fallback: use Date object
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return {
    dateStr: date.toLocaleDateString(),
    timeStr: date.toLocaleTimeString(),
    dateTimeStr: date.toLocaleString()
  };
};

export default function PurchasePaymentPrint() {
  const { purchaseId: rawPurchaseId, paymentIndex } = useParams<{ purchaseId?: string; paymentIndex?: string }>();
  const purchaseId = rawPurchaseId || "";
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

  const paymentDateInfo = parseDateString(payment.date || purchase.date);
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
                <p className="font-semibold">{paymentDateInfo.dateStr}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Purchase ID:</p>
                <p className="font-semibold">{purchaseId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Time:</p>
                <p className="font-semibold">{paymentDateInfo.timeStr}</p>
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
                <span className="font-semibold text-lg">Rs. {(payment.amount || 0).toFixed(2)}</span>
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
        <div className="section-title">PAYMENT RECEIPT</div>
        <div className="separator">********************************</div>

        <div className="customer-info">
          <div><strong>Supplier:</strong> {purchase.supplierName}</div>
          {purchase.supplierPhone && (
            <div><strong>Phone:</strong> {purchase.supplierPhone}</div>
          )}
        </div>

        <div className="separator">********************************</div>

        <div className="totals">
          <div className="totals-row">
            <span>Purchase #:</span>
            <span>{purchaseId.slice(-8).toUpperCase()}</span>
          </div>
          <div className="totals-row">
            <span>Receipt #:</span>
            <span>PAY-{paymentNumber.toString().padStart(3, '0')}</span>
          </div>
          <div className="totals-row">
            <span>Date:</span>
            <span>{paymentDateInfo.dateStr}</span>
          </div>
          <div className="totals-row">
            <span>Time:</span>
            <span>{paymentDateInfo.timeStr}</span>
          </div>
          <div className="totals-row">
            <span>Payment Type:</span>
            <span className="uppercase">{payment.type}</span>
          </div>
          <div className="totals-row total-row">
            <span>Amount Paid:</span>
            <span>{formatPrintAmount(payment.amount)}</span>
          </div>
        </div>

        <div className="separator">********************************</div>

        <div className="totals" style={{ fontSize: "10px" }}>
          <div className="totals-row">
            <span>Purchase Total:</span>
            <span>{formatPrintAmount(purchase.total)}</span>
          </div>
          <div className="totals-row">
            <span>Total Paid (All):</span>
            <span>{formatPrintAmount(totalPaid)}</span>
          </div>
          <div className="totals-row">
            <span>Remaining:</span>
            <span>{formatPrintAmount(purchase.remainingBalance)}</span>
          </div>
        </div>

        <div className="separator">********************************</div>
        <div className="footer">
          <div className="thank-you">THANK YOU!</div>
          <div>Purchase ID: {purchaseId}</div>
          <div>Date: {new Date().toLocaleString()}</div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-container {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          .print-receipt, .print-receipt * {
            visibility: visible;
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
          .print-receipt .customer-info div {
            margin: 2px 0;
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
            font-size: 12px;
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
    </>
  );
}







import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import api from "../../services/api";
import { Purchase, PurchasePayment } from "../../types";

export default function PurchasePaymentPrint() {
  const { purchaseId: rawPurchaseId, paymentIndex } = useParams<{ purchaseId?: string; paymentIndex?: string }>();
  const purchaseId = rawPurchaseId || "";
  const { settings, bankAccounts, refreshBankAccounts } = useData();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [payment, setPayment] = useState<PurchasePayment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bankAccountsLoadedRef = useRef(false);
  const hasPrintedRef = useRef(false);

  // Load bank accounts only once on mount
  useEffect(() => {
    if (!bankAccountsLoadedRef.current && bankAccounts.length === 0) {
      bankAccountsLoadedRef.current = true;
      refreshBankAccounts().catch((err) => {
        console.error("Failed to load bank accounts for payment print:", err);
      });
    } else if (bankAccounts.length > 0) {
      bankAccountsLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const parseDateString = (dateStr: string | Date | undefined): { dateStr: string; timeStr: string; dateTimeStr: string } => {
    try {
      if (!dateStr) {
        const now = new Date();
        return {
          dateStr: now.toLocaleDateString(),
          timeStr: now.toLocaleTimeString(),
          dateTimeStr: now.toLocaleString()
        };
      }

      if (typeof dateStr === 'string') {
        const dateTimeMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (dateTimeMatch) {
          const year = dateTimeMatch[1];
          const month = dateTimeMatch[2];
          const day = dateTimeMatch[3];
          const hours = dateTimeMatch[4];
          const minutes = dateTimeMatch[5];
          const seconds = dateTimeMatch[6];

          const dStr = `${month}/${day}/${year}`;
          const hoursNum = parseInt(hours, 10);
          const isPM = hoursNum >= 12;
          const displayHours = hoursNum === 0 ? 12 : hoursNum > 12 ? hoursNum - 12 : hoursNum;
          const hoursStr = String(displayHours).padStart(2, "0");
          const ampm = isPM ? "PM" : "AM";
          const tStr = `${hoursStr}:${minutes}:${seconds} ${ampm}`;

          return {
            dateStr: dStr,
            timeStr: tStr,
            dateTimeStr: `${dStr} ${tStr}`
          };
        }
      }

      const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      if (isNaN(date.getTime())) throw new Error("Invalid date");

      return {
        dateStr: date.toLocaleDateString(),
        timeStr: date.toLocaleTimeString(),
        dateTimeStr: date.toLocaleString()
      };
    } catch (e) {
      return { dateStr: "N/A", timeStr: "N/A", dateTimeStr: "N/A" };
    }
  };

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

  const defaultBank = bankAccounts.find((b: any) => b.isDefault) || bankAccounts[0];
  const paymentDateInfo = parseDateString(payment.date || purchase.date);
  const validPayments = (purchase.payments || []).filter((p: PurchasePayment) =>
    p?.amount !== undefined &&
    p?.amount !== null &&
    !isNaN(Number(p.amount)) &&
    Number(p.amount) > 0
  );
  const totalPaid = validPayments.reduce((sum: number, p: PurchasePayment) => sum + (p?.amount || 0), 0);
  const paymentNumber = paymentIndex ? parseInt(paymentIndex) + 1 : 1;
  const totalPayments = (purchase.payments || []).length;
  const paymentBank =
    ((payment as any).bankAccountId && bankAccounts.find((b: any) => b.id === (payment as any).bankAccountId)) ||
    defaultBank;

  const handlePrintReceipt = () => {
    if (!purchase || !payment) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - Purchase ${purchaseId.slice(-8)}</title>
          <style>
            @media print {
              @page { 
                margin: 0;
                size: 80mm auto;
              }
              body { 
                margin: 0; 
                padding: 0; 
              }
                       *{
              overflow: visible !important;
              }
              .no-print { display: none !important; }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              padding: 2mm;
              margin: 0;
              color: #000000;
              background: #fff;
              width: 80mm;
              max-width: 80mm;
              box-sizing: border-box;
            }
            .receipt {
              background: #fff;
              padding: 2mm;
            }
            .shop-header {
              text-align: center;
              margin-bottom: 4px;
              border-bottom: 1px dashed #000000;
              padding-bottom: 4px;
            }
            .shop-name {
              font-weight: bold;
              font-size: 14px;
              margin-bottom: 4px;
              text-transform: uppercase;
            }
            .shop-details {
              font-size: 14px;
              font-weight: 900;
              line-height: 1.4;
              color: #000000;
            }
            .separator {
              text-align: center;
              margin: 4px 0;
              font-size: 10px;
              color: #000000;
            }
            .section-title {
              text-align: center;
              font-weight: 700;
              font-size: 12px;
              margin: 4px 0;
              text-transform: uppercase;
              color: #000000;
            }
            .customer-info {
              margin: 4px 0;
              font-size: 12px;
              font-weight: 700;
              line-height: 1.5;
              color: #000000;
            }
            .customer-info div {
              margin: 2px 0;
            }
            .totals {
              margin: 4px 0;
              font-size: 12px;
              font-weight: 700;
              color: #000000;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              margin: 3px 0;
              color: #000000;
            }
            .total-row {
              font-size: 12px;
              font-weight: 700;
              border-top: 1px dashed #000000;
              border-bottom: 1px dashed #000000;
              padding: 4px 0;
              margin: 4px 0;
              color: #000000;
            }
            .bank-info {
              margin: 4px 0;
              font-size: 12px;
              font-weight: 700;
              line-height: 1.4;
              color: #000000;
            }
            .bank-info div {
              margin: 2px 0;
              color: #000000;
            }
            .footer {
              text-align: center;
              margin-top: 8px;
              font-size: 10px;
              color: #000000;
            }
            .thank-you {
              font-weight: bold;
              font-size: 12px;
              margin: 4px 0;
              color: #000000;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="shop-header">
              <div class="shop-name">${settings.shopName}</div>
              <div class="shop-details">
                Address: ${settings.address}<br>
                Telp. ${settings.contactNumber}
              </div>
            </div>
            <div class="separator">********************************</div>
            <div class="section-title">PURCHASE PAYMENT</div>
            <div class="separator">********************************</div>

            <div class="customer-info">
              <div><strong>Supplier:</strong> ${purchase.supplierName}</div>
              ${purchase.supplierPhone ? `<div><strong>Phone:</strong> ${purchase.supplierPhone}</div>` : ""}
            </div>

            <div class="separator">********************************</div>

            <div class="totals">
              <div class="totals-row">
                <span>Purchase #:</span>
                <span>${purchaseId.slice(-8).toUpperCase()}</span>
              </div>
              <div class="totals-row">
                <span>Payment #:</span>
                <span>${paymentNumber} / ${totalPayments}</span>
              </div>
              <div class="totals-row">
                <span>Date:</span>
                <span>${paymentDateInfo.dateTimeStr}</span>
              </div>
              <div class="totals-row">
                <span>Type:</span>
                <span>${(payment.type || "unknown").replace("_", " ")}</span>
              </div>
              <div class="totals-row total-row">
                <span>Amount Paid:</span>
                <span>${(payment.amount || 0).toFixed(2)}</span>
              </div>
              <div class="totals-row">
                <span>Purchase Total:</span>
                <span>${purchase.total.toFixed(2)}</span>
              </div>
              <div class="totals-row">
                <span>Total Paid (All):</span>
                <span>${totalPaid.toFixed(2)}</span>
              </div>
              <div class="totals-row">
                <span>Remaining:</span>
                <span>${(purchase.remainingBalance || 0).toFixed(2)}</span>
              </div>
            </div>

            ${paymentBank ? `
              <div class="separator">********************************</div>
              <div class="bank-info">
                <div><strong>Bank:</strong> ${paymentBank?.bankName || "---"}</div>
                <div><strong>Account Name:</strong> ${paymentBank ? ((paymentBank as any).accountName || (paymentBank as any).accountHolder || "---") : "---"}</div>
                <div><strong>Account No.:</strong> ${paymentBank?.accountNumber || "---"}</div>
                ${paymentBank?.branchName ? `<div><strong>Branch:</strong> ${paymentBank.branchName}</div>` : ""}
                ${paymentBank?.ifscCode ? `<div><strong>IBAN/IFSC:</strong> ${paymentBank.ifscCode}</div>` : ""}
              </div>
            ` : ""}

            <div class="separator">********************************</div>

            <div class="footer">
              <div class="thank-you">THANK YOU!</div>
              <div>Date: ${paymentDateInfo.dateTimeStr}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Auto-print on load (once)
  if (!hasPrintedRef.current && purchase && payment) {
    hasPrintedRef.current = true;
    setTimeout(() => handlePrintReceipt(), 500);
  }

  return (
    <>
      <PageMeta
        title={`Payment Receipt - Purchase ${purchaseId} | Isma Sports Complex`}
        description="Payment receipt"
      />
      <div className="max-w-4xl mx-auto p-8 bg-white">
        {/* Print Controls */}
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
            onClick={handlePrintReceipt}
            size="sm"
            className="flex items-center gap-2"
          >
            <DownloadIcon className="w-4 h-4" />
            Print
          </Button>
        </div>

        {/* Screen View */}
        <div className="border-2 border-gray-300 rounded-lg p-8">
          <div className="text-center mb-8 border-b-2 border-gray-300 pb-4">
            {settings.logo && (
              <img src={settings.logo} alt="Logo" className="h-16 mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-bold text-gray-800">{settings.shopName}</h1>
            <p className="text-gray-600 mt-2">{settings.address}</p>
            <p className="text-gray-600">
              {settings.contactNumber} {settings.email && `| ${settings.email}`}
            </p>
            <h2 className="text-2xl font-semibold text-gray-800 mt-4">PAYMENT RECEIPT</h2>
          </div>

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

          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">Payment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700">Payment Type:</span>
                <span className="font-semibold uppercase">{(payment.type || "unknown").replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Amount Paid:</span>
                <span className="font-semibold text-lg">Rs. {(payment.amount || 0).toFixed(2)}</span>
              </div>
              {paymentBank && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Bank Account:</span>
                  <span className="font-semibold">
                    {paymentBank.bankName || "Bank"} - {paymentBank.accountNumber || ""}
                  </span>
                </div>
              )}
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

          <div className="border-t-2 border-gray-300 pt-4 text-center">
            <p className="text-sm text-gray-600">Thank you for your payment!</p>
            <p className="text-xs text-gray-500 mt-2">
              This is a computer-generated receipt. No signature required.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

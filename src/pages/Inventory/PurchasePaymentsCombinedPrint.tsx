import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import api from "../../services/api";
import { Purchase, PurchasePayment } from "../../types";

export default function PurchasePaymentsCombinedPrint() {
  const { purchaseId: rawPurchaseId } = useParams<{ purchaseId: string }>();
  const purchaseId = rawPurchaseId || "";
  const { settings, bankAccounts, refreshBankAccounts } = useData();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bankAccountsLoadedRef = useRef(false);
  const hasPrintedRef = useRef(false);

  // Load bank accounts only once on mount
  useEffect(() => {
    if (!bankAccountsLoadedRef.current && bankAccounts.length === 0) {
      bankAccountsLoadedRef.current = true;
      refreshBankAccounts().catch((err) => {
        console.error("Failed to load bank accounts for combined payment print:", err);
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

  const defaultBank = bankAccounts.find((b: any) => b.isDefault) || bankAccounts[0];
  const payments = purchase.payments || [];
  const validPayments = payments.filter((p: PurchasePayment) =>
    p?.amount !== undefined &&
    p?.amount !== null &&
    !isNaN(Number(p.amount)) &&
    Number(p.amount) > 0
  );
  const totalPaid = validPayments.reduce((sum: number, p: PurchasePayment) => sum + (p?.amount || 0), 0);

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

  const handlePrintReceipt = () => {
    if (!purchase) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const paymentsRows = payments.map((payment: PurchasePayment, index: number) => {
      const pDate = parseDateString(payment.date || purchase.date);
      const paymentTypeStr = (payment.type || "unknown").replace("_", " ");
      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            ${pDate.dateStr} ${pDate.timeStr}
            <br>
            <span style="font-size: 10px;">${paymentTypeStr}</span>
          </td>
          <td class="text-right">${(payment.amount || 0).toFixed(2)}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Combined Payments - Purchase ${purchaseId.slice(-8)}</title>
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
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
              font-size: 11px;
            }
            table th {
              text-align: left;
              padding: 4px 2px;
              font-weight: bold;
              border-bottom: 1px dashed #000000;
              color: #000000;
            }
            table td {
              padding: 3px 2px;
              border-bottom: 1px dashed #666;
              color: #000000;
              font-size: 12px;
              font-weight: 700;
            }
            .text-right {
              text-align: right;
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
            <div class="section-title">COMBINED PAYMENTS</div>
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
                <span>Purchase Total:</span>
                <span>${purchase.total.toFixed(2)}</span>
              </div>
              <div class="totals-row">
                <span>Remaining:</span>
                <span>${purchase.remainingBalance.toFixed(2)}</span>
              </div>
              <div class="totals-row total-row">
                <span>Total Paid:</span>
                <span>${totalPaid.toFixed(2)}</span>
              </div>
            </div>

            <div class="separator">********************************</div>
            <div><strong>Payments:</strong></div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th class="text-right">Amt</th>
                </tr>
              </thead>
              <tbody>
                ${paymentsRows}
              </tbody>
            </table>

            ${defaultBank ? `
              <div class="separator">********************************</div>
              <div class="bank-info">
                <div><strong>Company Bank:</strong></div>
                <div>${defaultBank?.bankName || "---"}</div>
                <div>${defaultBank ? ((defaultBank as any).accountName || (defaultBank as any).accountHolder || "") : ""} ${defaultBank?.accountNumber ? " - " + defaultBank.accountNumber : ""}</div>
                ${defaultBank?.branchName ? `<div>${defaultBank.branchName}</div>` : ""}
                ${defaultBank?.ifscCode ? `<div>IBAN/IFSC: ${defaultBank.ifscCode}</div>` : ""}
              </div>
            ` : ""}

            <div class="separator">********************************</div>

            <div class="footer">
              <div class="thank-you">THANK YOU!</div>
              <div>Date: ${new Date().toLocaleString()}</div>
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
  if (!hasPrintedRef.current && purchase && payments.length > 0) {
    hasPrintedRef.current = true;
    setTimeout(() => handlePrintReceipt(), 500);
  }

  const purchaseDateInfo = parseDateString(purchase.date);

  return (
    <>
      <PageMeta
        title={`All Payments - Purchase ${purchaseId} | Isma Sports Complex`}
        description="Combined payment receipt"
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
            <h1 className="text-3xl font-bold text-gray-800">{settings.shopName}</h1>
            <p className="text-gray-600 mt-2">{settings.address}</p>
            <p className="text-gray-600">
              {settings.contactNumber} {settings.email && `| ${settings.email}`}
            </p>
            <h2 className="text-2xl font-semibold text-gray-800 mt-4">COMBINED PAYMENT RECEIPT</h2>
          </div>

          <div className="mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Purchase ID:</p>
                <p className="font-semibold text-lg">{purchaseId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Date:</p>
                <p className="font-semibold">{purchaseDateInfo.dateStr}</p>
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
              <div className="text-right">
                <p className="text-sm text-gray-600">Remaining Balance:</p>
                <p className={`font-semibold text-lg ${purchase.remainingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  Rs. {purchase.remainingBalance.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">All Payments ({payments.length})</h3>
            <div className="space-y-4">
              {payments.map((payment: PurchasePayment, index: number) => {
                const pDate = parseDateString(payment.date || purchase.date);
                const paymentTypeStr = (payment.type || "unknown").replace('_', ' ');
                return (
                  <div key={index} className="border border-gray-200 rounded p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">Payment #{index + 1}</p>
                        <p className="text-sm text-gray-600">
                          Date: {pDate.dateStr} {pDate.timeStr}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Type:</p>
                        <p className="font-semibold uppercase">{paymentTypeStr}</p>
                      </div>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-gray-700">Amount:</span>
                      <span className="font-semibold text-lg">Rs. {(payment.amount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
        </div>
      </div>
    </>
  );
}

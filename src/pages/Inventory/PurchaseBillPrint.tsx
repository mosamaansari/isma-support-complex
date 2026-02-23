import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon, PencilIcon } from "../../icons";
import api from "../../services/api";
import { Purchase } from "../../types";
import { formatBackendDateOnly } from "../../utils/dateHelpers";
import { hasResourcePermission } from "../../utils/permissions";

export default function PurchaseBillPrint() {
  const { id } = useParams<{ id: string }>();
  const { settings, refreshBankAccounts, bankAccounts, currentUser } = useData();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bankAccountsLoadedRef = useRef(false);
  const hasPrintedRef = useRef(false);

  useEffect(() => {
    const fetchPurchase = async () => {
      if (!id) {
        navigate("/inventory/purchases");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const fetchedPurchase = await api.getPurchase(id);
        if (fetchedPurchase) {
          setPurchase(fetchedPurchase);
        } else {
          setError("Purchase not found");
        }
      } catch (err: any) {
        console.error("Error fetching purchase:", err);
        setError(err.response?.data?.error || err.message || "Failed to load purchase");
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, [id, navigate]);

  // Load bank accounts only once on mount
  useEffect(() => {
    if (!bankAccountsLoadedRef.current && bankAccounts.length === 0) {
      bankAccountsLoadedRef.current = true;
      refreshBankAccounts().catch((err) => {
        console.error("Failed to load bank accounts for purchase print:", err);
      });
    } else if (bankAccounts.length > 0) {
      bankAccountsLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultBank = bankAccounts.find((b) => b.isDefault) || bankAccounts[0];

  const parseDateString = (dateStr: string | Date | undefined): string => {
    if (!dateStr) {
      const now = new Date();
      return now.toLocaleDateString();
    }

    if (typeof dateStr === 'string') {
      const dateTimeMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T/);
      if (dateTimeMatch) {
        const year = dateTimeMatch[1];
        const month = dateTimeMatch[2];
        const day = dateTimeMatch[3];
        return `${month}/${day}/${year}`;
      }
    }

    return formatBackendDateOnly(dateStr);
  };

  // Printing helper: show whole numbers only (no decimals) on printed bills
  // This matches Sales logic and saves space
  const formatPrintAmount = (value: number | string | null | undefined): string => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return "0";
    }
    return Math.round(num).toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading purchase...</p>
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

  const totalPaid = (purchase.payments || []).reduce((sum: number, p: any) => sum + (p?.amount || 0), 0);
  const remainingBalance = Math.max(0, purchase.total - totalPaid);
  const discountType = (purchase as any).discountType || "percent";
  const taxType = (purchase as any).taxType || "percent";

  const actualDiscountAmount = discountType === "value"
    ? (purchase as any).discount || 0
    : (purchase.subtotal * ((purchase as any).discount || 0)) / 100;

  const actualTaxAmount = taxType === "value"
    ? purchase.tax
    : ((purchase.subtotal - actualDiscountAmount) * purchase.tax) / 100;

  const purchaseDate = parseDateString(purchase.date || purchase.createdAt);

  const handlePrintBill = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsRows = purchase.items.map((item: any) => `
      <tr>
        <td class="col-item">${item.productName}</td>
        <td class="col-qty">${item.quantity}</td>
        <td class="col-price">${formatPrintAmount(item.cost || 0)}</td>
        <td class="col-total">${formatPrintAmount(item.total)}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Bill - ${purchase.id.slice(-8)}</title>
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
           
              .no-print { display: none !important; }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 11px;
              padding: 0;
              margin: 0;
              color: #000000;
              background: #fff;
              width: 72mm;
              max-width: 72mm;
              box-sizing: border-box;
            }
            .receipt {
              background: #fff;
              padding: 1mm 5mm;
              width: 100%;
              box-sizing: border-box;
              overflow: visible !important;
            }
            .shop-header {
              text-align: center;
              margin-bottom: 4px;
              border-bottom: 1px dashed #000000;
              padding-bottom: 4px;
            }
            .shop-name {
              font-weight: bold;
              font-size: 13px;
              margin-bottom: 2px;
              text-transform: uppercase;
            }
            .shop-details {
              font-size: 12px;
              font-weight: 700;
              line-height: 1.2;
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
              table-layout: fixed; /* Force fixed layout to prevent overflow */
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
              font-size: 11px;
              font-weight: 700;
              word-break: break-all;
            }
            /* Set specific widths for columns */
            .col-item { width: 45%; }
            .col-qty { width: 15%; text-align: center; }
            .col-price { width: 22%; text-align: right; }
            .col-total { width: 18%; text-align: right; }
            
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
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
            .totals-row span:last-child {
              padding-right: 2mm; /* Give more space to values on the right */
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
              font-size: 11px;
              font-weight: 700;
              line-height: 1.2;
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
            <div class="section-title">PURCHASE RECEIPT</div>
            <div class="separator">********************************</div>

            <div class="customer-info">
              <div><strong>Supplier:</strong> ${purchase.supplierName}</div>
              ${purchase.supplierPhone ? `<div><strong>Phone:</strong> ${purchase.supplierPhone}</div>` : ""}
              <div><strong>ID:</strong> ${purchase.id.slice(-8).toUpperCase()}</div>
              <div><strong>Date:</strong> ${purchaseDate}</div>
            </div>

            <div class="separator">********************************</div>

            <table>
              <thead>
                <tr>
                  <th class="col-item">Item</th>
                  <th class="col-qty">Qty</th>
                  <th class="col-price">Price</th>
                  <th class="col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div class="separator">********************************</div>

            <div class="totals">
              <div class="totals-row">
                <span>Subtotal:</span>
                <span>${formatPrintAmount(purchase.subtotal)}</span>
              </div>
              ${actualDiscountAmount > 0 ? `
              <div class="totals-row">
                <span>Discount:</span>
                <span>-${formatPrintAmount(actualDiscountAmount)}</span>
              </div>
              ` : ""}
              ${actualTaxAmount > 0 ? `
              <div class="totals-row">
                <span>Tax:</span>
                <span>+${formatPrintAmount(actualTaxAmount)}</span>
              </div>
              ` : ""}
              <div class="totals-row total-row">
                <span>Total:</span>
                <span>${formatPrintAmount(purchase.total)}</span>
              </div>
              <div class="totals-row">
                <span>Paid:</span>
                <span>${formatPrintAmount(totalPaid)}</span>
              </div>
              <div class="totals-row">
                <span>Remaining:</span>
                <span>${formatPrintAmount(remainingBalance)}</span>
              </div>
              <div class="totals-row">
                <span>Status:</span>
                <span style="text-transform: uppercase;">${purchase.status || "completed"}</span>
              </div>
            </div>

            ${defaultBank ? `
              <div class="separator">********************************</div>
              <div class="bank-info">
                <div><strong>Company Bank:</strong> ${defaultBank?.bankName || "---"}</div>
               
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
  if (!hasPrintedRef.current && purchase) {
    hasPrintedRef.current = true;
    setTimeout(() => handlePrintBill(), 500);
  }

  return (
    <>
      <PageMeta
        title={`Purchase Receipt ${purchase.id.slice(-8).toUpperCase()} | Isma Sports Complex`}
        description="View and print purchase receipt"
      />
      <div className="max-w-4xl mx-auto p-8 bg-white">
        <div className="mb-6 flex items-center justify-between no-print">
          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/inventory/purchases")}
              variant="outline"
              size="sm"
            >
              <ChevronLeftIcon className="w-4 h-4 mr-2" />
              Back to Purchases
            </Button>
          </div>
          <div className="flex gap-2">
            {currentUser && hasResourcePermission(currentUser.role, 'purchases:update', currentUser.permissions) && (
              purchase.status === "pending" && (
                <Button
                  onClick={() => navigate(`/inventory/purchase/edit/${purchase.id}`)}
                  variant="outline"
                  size="sm"
                >
                  <PencilIcon className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )
            )}
            <Button onClick={handlePrintBill} size="sm">
              <DownloadIcon className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
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
            <h2 className="text-2xl font-semibold text-gray-800 mt-4 uppercase">Purchase Receipt</h2>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Supplier</h3>
              <p className="font-bold text-lg text-gray-800">{purchase.supplierName}</p>
              {purchase.supplierPhone && (
                <p className="text-gray-600 font-medium">{purchase.supplierPhone}</p>
              )}
            </div>
            <div className="text-right">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Purchase Info</h3>
              <p className="text-gray-800 font-medium">
                <span className="font-semibold text-gray-600">ID:</span> {purchase.id.slice(-8).toUpperCase()}
              </p>
              <p className="text-gray-800 font-medium">
                <span className="font-semibold text-gray-600">Date:</span> {purchaseDate}
              </p>
              <p className="text-gray-800 font-medium">
                <span className="font-semibold text-gray-600">Status:</span>{" "}
                <span className="uppercase font-semibold">{purchase.status || "completed"}</span>
              </p>
            </div>
          </div>

          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="py-2 text-left text-sm font-bold text-gray-700 uppercase">Item</th>
                <th className="py-2 text-center text-sm font-bold text-gray-700 uppercase">Qty</th>
                <th className="py-2 text-right text-sm font-bold text-gray-700 uppercase">Price</th>
                <th className="py-2 text-right text-sm font-bold text-gray-700 uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-3 text-gray-800 font-medium">{item.productName}</td>
                  <td className="py-3 text-center text-gray-700">{item.quantity}</td>
                  <td className="py-3 text-right text-gray-700">Rs. {(item.cost || 0).toFixed(2)}</td>
                  <td className="py-3 text-right font-bold text-gray-800">Rs. {item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-start pt-4 border-t-2 border-gray-300">
            {/* Bank details in screen view if user wants them visible too */}
            <div className="text-left max-w-xs">
              {defaultBank && (
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Payment Info</h3>
                  <p className="text-sm font-semibold text-gray-800">{defaultBank.bankName}</p>
                  <p className="text-xs text-gray-600">
                    {(defaultBank as any).accountName || (defaultBank as any).accountHolder || ""}
                  </p>
                  <p className="text-xs text-gray-600 font-mono">{defaultBank.accountNumber}</p>
                </div>
              )}
            </div>

            <div className="w-full max-w-xs space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span className="font-medium">Rs. {purchase.subtotal.toFixed(2)}</span>
              </div>
              {actualDiscountAmount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Discount:</span>
                  <span className="font-medium">- Rs. {actualDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              {actualTaxAmount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax:</span>
                  <span className="font-medium">+ Rs. {actualTaxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-3 font-bold text-gray-900 text-xl">
                <span>Total:</span>
                <span>Rs. {purchase.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-600 font-bold">
                <span>Paid:</span>
                <span>Rs. {totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-orange-600 font-bold">
                <span>Remaining:</span>
                <span>Rs. {remainingBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center text-sm text-gray-500 border-t-2 border-gray-300 pt-8 no-print">
            <p className="font-bold text-gray-700 mb-2 uppercase">Thank you!</p>
            <p>This is a computer-generated receipt.</p>
          </div>
        </div>
      </div>
    </>
  );
}

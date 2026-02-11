import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon, PencilIcon } from "../../icons";
import api from "../../services/api";
import { Purchase } from "../../types";
import { formatBackendDateOnly } from "../../utils/dateHelpers";
import { hasResourcePermission } from "../../utils/permissions";

// Parse date string directly to extract components without UTC conversion
const parseDateString = (dateStr: string | Date | undefined): string => {
    if (!dateStr) {
        const now = new Date();
        return now.toLocaleDateString();
    }

    if (typeof dateStr === 'string') {
        // Extract date from ISO string directly
        // Format: "2026-01-24T04:36:52.331Z" or "2026-01-24T04:36:52.331"
        const dateTimeMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T/);
        if (dateTimeMatch) {
            const year = dateTimeMatch[1];
            const month = dateTimeMatch[2];
            const day = dateTimeMatch[3];
            // Format date: MM/DD/YYYY
            return `${month}/${day}/${year}`;
        }
    }

    // Fallback: use formatBackendDateOnly
    return formatBackendDateOnly(dateStr);
};

// Printing helper: show whole numbers only (no decimals) on printed bills
const formatPrintAmount = (value: number | string | null | undefined): string => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return "0";
    }
    return Math.round(num).toString();
};

export default function PurchaseBillPrint() {
    const { id } = useParams<{ id: string }>();
    const { settings, refreshBankAccounts, bankAccounts, currentUser } = useData();
    const { showError } = useAlert();
    const navigate = useNavigate();
    const [purchase, setPurchase] = useState<Purchase | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bankAccountsLoadedRef = useRef(false);

    useEffect(() => {
        const fetchPurchase = async () => {
            if (!id) {
                navigate("/inventory/purchases");
                return;
            }

            setLoading(true);
            setError(null);

            try {
                console.log("Fetching purchase from API:", id);
                const fetchedPurchase = await api.getPurchase(id);
                console.log("Fetched purchase:", fetchedPurchase);
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

    const handleDownloadPDF = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            showError("Please allow popups to print the bill");
            return;
        }

        if (!purchase) return;

        const totalPaid = (purchase.payments || []).reduce((sum: number, p: any) => sum + (p?.amount || 0), 0);
        const purchaseDate = parseDateString(purchase.date || purchase.createdAt);

        const pdfDiscountType = (purchase as any).discountType || "percent";
        const pdfTaxType = (purchase as any).taxType || "percent";

        const pdfDiscountAmount = pdfDiscountType === "value"
            ? (purchase as any).discount || 0
            : (purchase.subtotal * ((purchase as any).discount || 0)) / 100;

        const pdfTaxAmount = pdfTaxType === "value"
            ? purchase.tax
            : ((purchase.subtotal - pdfDiscountAmount) * purchase.tax) / 100;

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Receipt ${purchase.id.slice(-8).toUpperCase()}</title>
          <style>
            @media print {
              @page { 
                margin: 0;
                size: 80mm auto;
              }
              body { margin: 0; padding: 5mm; }
              .no-print { display: none !important; }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              padding: 5mm;
              margin: 0;
              color: #000000;
              background: #fff;
              max-width: 80mm;
              margin: 0 auto;
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
              font-size: 12px;
              font-weight: 700;
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
            .total-row {
              font-size: 12px;
              font-weight: 700;
              border-top: 1px dashed #000000;
              border-bottom: 1px dashed #000000;
              padding: 4px 0;
              margin: 4px 0;
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
            </div>
            
            <div class="separator">********************************</div>
            
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="text-center">Qty</th>
                  <th class="text-right">Price</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${purchase.items.map((item: any) => `
                  <tr>
                    <td>${item.productName}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-right">${formatPrintAmount(item.cost)}</td>
                    <td class="text-right">${formatPrintAmount(item.total)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            
            <div class="separator">********************************</div>
            
            <div class="totals">
              <div class="totals-row">
                <span>Subtotal:</span>
                <span>${formatPrintAmount(purchase.subtotal)}</span>
              </div>
              ${pdfDiscountAmount > 0 ? `
                <div class="totals-row">
                  <span>Discount${(pdfDiscountType === "value" ? " (Rs)" : ` (${(purchase as any).discount}%)`)}:</span>
                  <span>-${formatPrintAmount(pdfDiscountAmount)}</span>
                </div>
              ` : ""}
              ${pdfTaxAmount > 0 ? `
                <div class="totals-row">
                  <span>Tax${(pdfTaxType === "value" ? " (Rs)" : ` (${purchase.tax}%)`)}:</span>
                  <span>+${formatPrintAmount(pdfTaxAmount)}</span>
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
                <span>${formatPrintAmount(purchase.remainingBalance)}</span>
              </div>
              <div class="totals-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #000;">
                <span>Status:</span>
                <span style="text-transform: uppercase;">${purchase.status || "completed"}</span>
              </div>
            </div>
            
            <div class="separator">********************************</div>
            
            <div class="footer">
              <div class="thank-you">THANK YOU!</div>
              <div>ID: ${purchase.id.slice(-8).toUpperCase()}</div>
              <div>Date: ${purchaseDate}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
        printWindow.document.close();
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
    const discountType = (purchase as any).discountType || "percent";
    const taxType = (purchase as any).taxType || "percent";

    const actualDiscountAmount = discountType === "value"
        ? (purchase as any).discount || 0
        : (purchase.subtotal * ((purchase as any).discount || 0)) / 100;

    const actualTaxAmount = taxType === "value"
        ? purchase.tax
        : ((purchase.subtotal - actualDiscountAmount) * purchase.tax) / 100;

    return (
        <>
            <PageMeta
                title={`Purchase Receipt ${purchase.id.slice(-8).toUpperCase()} | Isma Sports Complex`}
                description="View and print purchase receipt"
            />
            <div className="mb-4 no-print">
                <Button
                    onClick={() => navigate("/inventory/purchases")}
                    variant="outline"
                    size="sm"
                    className="mr-2"
                >
                    <ChevronLeftIcon className="w-4 h-4 mr-2" />
                    Back to Purchases
                </Button>
                <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="mr-2">
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    Print
                </Button>
                {currentUser && hasResourcePermission(currentUser.role, 'purchases:update', currentUser.permissions) && (
                    purchase.status === "pending" ? (
                        <Button
                            onClick={() => navigate(`/inventory/purchase/edit/${purchase.id}`)}
                            size="sm"
                        >
                            <PencilIcon className="w-4 h-4 mr-2" />
                            Edit Purchase
                        </Button>
                    ) : (
                        <button
                            disabled
                            className="px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50 flex items-center gap-2 text-sm inline-flex"
                        >
                            <PencilIcon className="w-4 h-4" />
                            Edit Purchase
                        </button>
                    )
                )}
            </div>

            <div className="p-8 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <div className="mb-6 text-center border-b border-gray-200 dark:border-gray-700 pb-6">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                        {settings.shopName}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">{settings.address}</p>
                    <p className="text-gray-600 dark:text-gray-400">Phone: {settings.contactNumber}</p>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mt-4 uppercase">
                        Purchase Receipt
                    </h2>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Supplier</h3>
                        <p className="font-bold text-gray-800 dark:text-white">{purchase.supplierName}</p>
                        {purchase.supplierPhone && (
                            <p className="text-gray-600 dark:text-gray-400">{purchase.supplierPhone}</p>
                        )}
                    </div>
                    <div className="text-right">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Purchase Info</h3>
                        <p className="text-gray-800 dark:text-white">
                            <span className="font-semibold">ID:</span> {purchase.id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-gray-800 dark:text-white">
                            <span className="font-semibold">Date:</span> {parseDateString(purchase.date)}
                        </p>
                        <p className="text-gray-800 dark:text-white">
                            <span className="font-semibold">Status:</span>{" "}
                            <span className="uppercase font-medium">{purchase.status || "completed"}</span>
                        </p>
                    </div>
                </div>

                <table className="w-full mb-8">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="p-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Item</th>
                            <th className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Qty</th>
                            <th className="p-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Price</th>
                            <th className="p-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {purchase.items.map((item, index) => (
                            <tr key={index} className="border-b border-gray-100 dark:border-gray-700">
                                <td className="p-2 text-gray-800 dark:text-white">{item.productName}</td>
                                <td className="p-2 text-center text-gray-700 dark:text-gray-300">{item.quantity}</td>
                                <td className="p-2 text-right text-gray-700 dark:text-gray-300">Rs. {(item.cost || 0).toFixed(2)}</td>
                                <td className="p-2 text-right font-medium text-gray-800 dark:text-white">Rs. {item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {defaultBank && (
                    <div className="p-4 mt-6 bg-gray-50 rounded-lg dark:bg-gray-900 no-print">
                        <h3 className="mb-2 font-semibold text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                            Our Bank Details:
                        </h3>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            <p><span className="font-medium text-gray-700 dark:text-gray-300">Bank:</span> {defaultBank.bankName}</p>
                            <p><span className="font-medium text-gray-700 dark:text-gray-300">Account No:</span> {defaultBank.accountNumber}</p>
                            {defaultBank.accountName && <p><span className="font-medium text-gray-700 dark:text-gray-300">Account Name:</span> {defaultBank.accountName}</p>}
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <div className="w-full max-w-xs space-y-2">
                        <div className="flex justify-between text-gray-600 dark:text-gray-400">
                            <span>Subtotal:</span>
                            <span>Rs. {purchase.subtotal.toFixed(2)}</span>
                        </div>
                        {actualDiscountAmount > 0 && (
                            <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                <span>Discount:</span>
                                <span>- Rs. {actualDiscountAmount.toFixed(2)}</span>
                            </div>
                        )}
                        {actualTaxAmount > 0 && (
                            <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                <span>Tax:</span>
                                <span>+ Rs. {actualTaxAmount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 font-bold text-gray-800 dark:text-white text-lg">
                            <span>Total:</span>
                            <span>Rs. {purchase.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-green-600 dark:text-green-400 font-semibold">
                            <span>Paid:</span>
                            <span>Rs. {totalPaid.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-orange-600 dark:text-orange-400 font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">
                            <span>Remaining:</span>
                            <span>Rs. {purchase.remainingBalance.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-6">
                    <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">THANK YOU!</p>
                    <p>This is a computer-generated receipt.</p>
                </div>
            </div>
        </>
    );
}

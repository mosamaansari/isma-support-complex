import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import api from "../../services/api";
import { Sale } from "../../types";

export default function BillPrint() {
  const { billNumber } = useParams<{ billNumber: string }>();
  const { getSale, settings, refreshSales, salesPagination, bankAccounts, refreshBankAccounts } = useData();
  const { showError } = useAlert();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSale = async () => {
      if (!billNumber) {
        navigate("/sales");
        return;
      }

      setLoading(true);
      setError(null);
      
      // First try to get from local state
      try {
        const localSale = getSale(billNumber);
        if (localSale) {
          console.log("Found sale in local state:", localSale);
          setSale(localSale);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Error getting sale from local state:", err);
      }

      // If not found locally, fetch from API
      try {
        console.log("Fetching sale from API:", billNumber);
        const fetchedSale = await api.getSaleByBillNumber(billNumber);
        console.log("Fetched sale:", fetchedSale);
        if (fetchedSale) {
          setSale(fetchedSale);
          // Refresh sales list to include this sale
          await refreshSales(salesPagination?.page || 1, salesPagination?.pageSize || 10);
        } else {
          setError("Bill not found");
        }
      } catch (err: any) {
        console.error("Error fetching sale:", err);
        // Don't navigate immediately, show error message
        setError(err.response?.data?.error || err.message || "Failed to load bill");
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
  }, [billNumber, navigate, getSale, refreshSales]);

  useEffect(() => {
    if (bankAccounts.length === 0) {
      refreshBankAccounts().catch((err) => {
        console.error("Failed to load bank accounts for bill print:", err);
      });
    }
  }, [bankAccounts.length, refreshBankAccounts]);

  const defaultBank = bankAccounts.find((b) => b.isDefault) || bankAccounts[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading bill...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => navigate("/sales")} variant="outline" size="sm">
          Back to Sales
        </Button>
      </div>
    );
  }

  if (!sale) {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading bill...</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-500 mb-4">Bill not found</p>
        <Button onClick={() => navigate("/sales")} variant="outline" size="sm">
          Back to Sales
        </Button>
      </div>
    );
  }

  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showError("Please allow popups to print the bill");
      return;
    }

    const totalPaid = sale.payments?.reduce((sum, p) => sum + p.amount, 0) || (sale.remainingBalance && sale.remainingBalance < sale.total ? sale.total - sale.remainingBalance : sale.total);
    const remainingBalance = sale.remainingBalance || (sale.total - totalPaid);
    const change = totalPaid > sale.total ? totalPaid - sale.total : 0;
    const paymentStatus = remainingBalance > 0 ? "Pending" : "Completed";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill ${sale.billNumber}</title>
          <style>
            @media print {
              @page { 
                margin: 0;
                size: 80mm auto;
              }
              body { margin: 0; padding: 10mm; }
              .no-print { display: none !important; }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              padding: 10mm;
              margin: 0;
              color: #000;
              background: #fff;
              max-width: 80mm;
              margin: 0 auto;
            }
            .receipt {
              background: #fff;
              padding: 5mm;
            }
            .shop-header {
              text-align: center;
              margin-bottom: 8px;
              border-bottom: 1px dashed #000;
              padding-bottom: 8px;
            }
            .shop-name {
              font-weight: bold;
              font-size: 14px;
              margin-bottom: 4px;
              text-transform: uppercase;
            }
            .shop-details {
              font-size: 10px;
              line-height: 1.4;
            }
            .separator {
              text-align: center;
              margin: 6px 0;
              font-size: 10px;
            }
            .section-title {
              text-align: center;
              font-weight: bold;
              font-size: 12px;
              margin: 8px 0;
              text-transform: uppercase;
            }
            .customer-info {
              margin: 8px 0;
              font-size: 11px;
              line-height: 1.5;
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
              border-bottom: 1px dashed #000;
            }
            table td {
              padding: 3px 2px;
              border-bottom: 1px dashed #ccc;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .totals {
              margin: 8px 0;
              font-size: 11px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              margin: 3px 0;
            }
            .total-row {
              font-weight: bold;
              font-size: 12px;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 4px 0;
              margin: 6px 0;
            }
            .bank-info {
              margin: 8px 0;
              font-size: 10px;
              line-height: 1.4;
            }
            .bank-info div {
              margin: 2px 0;
            }
            .footer {
              text-align: center;
              margin-top: 12px;
              font-size: 10px;
            }
            .thank-you {
              font-weight: bold;
              font-size: 12px;
              margin: 8px 0;
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
            <div class="section-title">CASH RECEIPT</div>
            <div class="separator">********************************</div>
            
            <div class="customer-info">
              <div><strong>Customer:</strong> ${sale.customerName || "Walk-in"}</div>
              ${sale.customerPhone ? `<div><strong>Phone:</strong> ${sale.customerPhone}</div>` : ""}
              ${(sale as any).customerCity ? `<div><strong>City:</strong> ${(sale as any).customerCity}</div>` : ""}
            </div>
            
            <div class="separator">********************************</div>
            
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                ${sale.items.map((item: any) => {
                  const itemTotal = Number(item.total);
                  return `
                    <tr>
                      <td>${item.productName} x${item.quantity}</td>
                      <td class="text-right">${itemTotal.toFixed(2)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
            
            <div class="separator">********************************</div>
            
            <div class="totals">
              <div class="totals-row">
                <span>Subtotal:</span>
                <span>${sale.subtotal.toFixed(2)}</span>
              </div>
              ${sale.discount > 0 ? `
                <div class="totals-row">
                  <span>Discount:</span>
                  <span>-${sale.discount.toFixed(2)}</span>
                </div>
              ` : ""}
              ${sale.tax > 0 ? `
                <div class="totals-row">
                  <span>Tax:</span>
                  <span>${sale.tax.toFixed(2)}</span>
                </div>
              ` : ""}
              <div class="totals-row total-row">
                <span>Total:</span>
                <span>${sale.total.toFixed(2)}</span>
              </div>
              ${totalPaid > 0 ? `
                <div class="totals-row">
                  <span>Paid:</span>
                  <span>${totalPaid.toFixed(2)}</span>
                </div>
              ` : ""}
              ${remainingBalance > 0 ? `
                <div class="totals-row">
                  <span>Remaining:</span>
                  <span>${remainingBalance.toFixed(2)}</span>
                </div>
              ` : ""}
              ${change > 0 ? `
                <div class="totals-row">
                  <span>Change:</span>
                  <span>${change.toFixed(2)}</span>
                </div>
              ` : ""}
              <div class="totals-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #000;">
                <span>Status:</span>
                <span>${paymentStatus}</span>
              </div>
            </div>
            
            ${defaultBank ? `
              <div class="separator">********************************</div>
              <div class="bank-info">
                <div><strong>Bank:</strong> ${defaultBank.bankName || "---"}</div>
                <div><strong>Account Name:</strong> ${defaultBank.accountName || defaultBank.accountHolder || "---"}</div>
                <div><strong>Account No.:</strong> ${defaultBank.accountNumber || "---"}</div>
                ${defaultBank.branchName ? `<div><strong>Branch:</strong> ${defaultBank.branchName}</div>` : ""}
                ${defaultBank.ifscCode ? `<div><strong>IBAN/IFSC:</strong> ${defaultBank.ifscCode}</div>` : ""}
              </div>
            ` : ""}
            
            <div class="separator">********************************</div>
            
            <div class="footer">
              <div class="thank-you">THANK YOU!</div>
              <div>Bill #: ${sale.billNumber}</div>
              <div>Date: ${new Date(sale.date || sale.createdAt).toLocaleString()}</div>
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

  // Early return if sale is not available
  if (!sale) {
    return null;
  }

  const totalPaid = (sale.payments || []).reduce((sum: number, p: any) => sum + (p?.amount || 0), 0) || (sale.remainingBalance !== undefined && sale.remainingBalance !== null && sale.remainingBalance < sale.total ? sale.total - sale.remainingBalance : sale.total);
  const remainingBalance = sale.remainingBalance !== undefined && sale.remainingBalance !== null ? sale.remainingBalance : (sale.total - totalPaid);
  const change = totalPaid > sale.total ? totalPaid - sale.total : 0;
  const paymentRows = (sale.payments || []).map((p, idx) => {
    const bank = p.bankAccountId ? bankAccounts.find((b) => b.id === p.bankAccountId) : null;
    const bankLabel = bank ? `${bank.accountName || ""} ${bank.bankName ? " - " + bank.bankName : ""}`.trim() : "-";
    return (
      <tr key={idx} className="border-b border-gray-200 dark:border-gray-700 text-sm">
        <td className="p-2 text-gray-700 dark:text-gray-300">{idx + 1}</td>
        <td className="p-2 text-gray-700 dark:text-gray-300 uppercase">{p.type || "-"}</td>
        <td className="p-2 text-gray-700 dark:text-gray-300">{bankLabel}</td>
        <td className="p-2 text-right font-medium text-gray-800 dark:text-white">Rs. {(p.amount || 0).toFixed(2)}</td>
      </tr>
    );
  });
  const paymentStatus = remainingBalance > 0 ? "Pending" : "Completed";

  // Check if settings is available
  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={`Bill ${sale.billNumber} | Isma Sports Complex`}
        description="View and print bill"
      />
      <div className="mb-4 no-print">
        <Button
          onClick={() => navigate("/sales")}
          variant="outline"
          size="sm"
          className="mr-2"
        >
          <ChevronLeftIcon className="w-4 h-4 mr-2" />
          Back to Sales
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="mr-2">
          <DownloadIcon className="w-4 h-4 mr-2" />
          Print
        </Button>
      
      </div>

      {/* Screen View - Old UI Design */}
      <div
        id="bill-content"
        className="screen-view p-8 bg-white rounded-lg shadow-sm dark:bg-gray-800"
      >
        <div className="mb-6 text-center">
          <img
            src={settings.logo}
            alt={settings.shopName}
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            {settings.shopName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{settings.address}</p>
          <p className="text-gray-600 dark:text-gray-400">
            Phone: {settings.contactNumber}
          </p>
          {settings.email && (
            <p className="text-gray-600 dark:text-gray-400">
              Email: {settings.email}
            </p>
          )}
        </div>

        <div className="mb-6 border-t border-b border-gray-200 dark:border-gray-700 py-4">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-400">Bill Number:</span>
            <span className="font-semibold text-gray-800 dark:text-white">
              {sale.billNumber}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-400">Date:</span>
            <span className="text-gray-800 dark:text-white">
              {new Date(sale.date || sale.createdAt).toLocaleString()}
            </span>
          </div>
          {sale.customerName && (
            <div className="flex justify-between mb-2">
              <span className="text-gray-600 dark:text-gray-400">Customer:</span>
              <span className="text-gray-800 dark:text-white">
                {sale.customerName}
              </span>
            </div>
          )}
          {sale.customerPhone && (
            <div className="flex justify-between mb-2">
              <span className="text-gray-600 dark:text-gray-400">Phone:</span>
              <span className="text-gray-800 dark:text-white">
                {sale.customerPhone}
              </span>
            </div>
          )}
          {(sale as any).customerCity && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">City:</span>
              <span className="text-gray-800 dark:text-white">
                {(sale as any).customerCity}
              </span>
            </div>
          )}
        </div>

        <table className="w-full mb-6">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Item
              </th>
              <th className="p-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                Qty
              </th>
              <th className="p-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Price
              </th>
              <th className="p-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Discount
              </th>
              <th className="p-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item: any, index) => (
              <tr
                key={index}
                className="border-b border-gray-100 dark:border-gray-700"
              >
                <td className="p-2 text-gray-800 dark:text-white">
                  {item.productName}
                </td>
                <td className="p-2 text-center text-gray-700 dark:text-gray-300">
                  {item.quantity}
                </td>
                <td className="p-2 text-right text-gray-700 dark:text-gray-300">
                  <div>
                    <p>Rs. {(item as any).customPrice ? (item as any).customPrice.toFixed(2) : item.unitPrice.toFixed(2)}</p>
                    {(item as any).customPrice && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-through">
                        Rs. {item.unitPrice.toFixed(2)}
                      </p>
                    )}
                  </div>
                </td>
                <td className="p-2 text-right text-gray-700 dark:text-gray-300">
                  {(item as any).discount > 0 ? (
                    <div>
                      {(item as any).discountType === "value" ? (
                        <p>Rs. {(item as any).discount.toFixed(2)}</p>
                      ) : (
                        <p>{(item as any).discount}%</p>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="p-2 text-right font-medium text-gray-800 dark:text-white">
                  Rs. {item.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mb-6 text-right">
          <div className="flex justify-end mb-2">
            <span className="w-40 text-gray-600 dark:text-gray-400">Subtotal:</span>
            <span className="w-32 text-gray-800 dark:text-white">
              Rs. {sale.subtotal.toFixed(2)}
            </span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-end mb-2">
              <span className="w-40 text-gray-600 dark:text-gray-400">
                Discount:
              </span>
              <span className="w-32 text-gray-800 dark:text-white">
                - Rs. {sale.discount.toFixed(2)}
              </span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="flex justify-end mb-2">
              <span className="w-40 text-gray-600 dark:text-gray-400">Tax:</span>
              <span className="w-32 text-gray-800 dark:text-white">
                Rs. {sale.tax.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-end pt-2 border-t-2 border-gray-300 dark:border-gray-600">
            <span className="w-40 text-lg font-bold text-gray-800 dark:text-white">
              Total:
            </span>
            <span className="w-32 text-lg font-bold text-brand-600 dark:text-brand-400">
              Rs. {sale.total.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white">Payments</h3>
          <div className="overflow-hidden border border-gray-200 rounded-lg dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="p-2 text-left text-gray-600 dark:text-gray-300">#</th>
                  <th className="p-2 text-left text-gray-600 dark:text-gray-300">Type</th>
                  <th className="p-2 text-left text-gray-600 dark:text-gray-300">Bank</th>
                  <th className="p-2 text-right text-gray-600 dark:text-gray-300">Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.length > 0 ? (
                  paymentRows
                ) : (
                  <tr>
                    <td colSpan={4} className="p-3 text-center text-gray-500 dark:text-gray-400">
                      No payments recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Payment Status</span>
              <span className="font-semibold">{remainingBalance > 0 ? "Pending" : "Completed"}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Paid</span>
              <span className="font-semibold text-gray-900 dark:text-white">Rs. {totalPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining</span>
              <span className="font-semibold text-gray-900 dark:text-white">Rs. {remainingBalance.toFixed(2)}</span>
            </div>
            {change > 0 && (
              <div className="flex justify-between">
                <span>Change</span>
                <span className="font-semibold text-gray-900 dark:text-white">Rs. {change.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {defaultBank && (
          <div className="p-4 mt-6 bg-gray-50 rounded-lg dark:bg-gray-900">
            <h3 className="mb-2 font-semibold text-gray-800 dark:text-white">
              Bank Account Details:
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bank: {defaultBank.bankName}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Account Number: {defaultBank.accountNumber}
            </p>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Thank you for your business!</p>
          <p className="mt-2">Generated by: {sale.userName}</p>
        </div>
      </div>

      {/* Print View - Receipt Style (Hidden on screen, shown only when printing) */}
      <div
        id="print-receipt"
        className="print-receipt"
        style={{
          display: "none",
        }}
      >
        <div className="shop-header">
          <div className="shop-name">{settings.shopName}</div>
          <div className="shop-details">
            Address: {settings.address}<br />
            Telp. {settings.contactNumber}
          </div>
        </div>
        <div className="separator">********************************</div>
        <div className="section-title">CASH RECEIPT</div>
        <div className="separator">********************************</div>
        
        <div className="customer-info">
          <div><strong>Customer:</strong> {sale.customerName || "Walk-in"}</div>
          {sale.customerPhone && (
            <div><strong>Phone:</strong> {sale.customerPhone}</div>
          )}
          {(sale as any).customerCity && (
            <div><strong>City:</strong> {(sale as any).customerCity}</div>
          )}
        </div>
        
        <div className="separator">********************************</div>
        
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item: any, index) => {
              const itemTotal = Number(item.total);
              return (
                <tr key={index}>
                  <td>{item.productName} x{item.quantity}</td>
                  <td className="text-right">{itemTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        <div className="separator">********************************</div>
        
        <div className="totals">
          <div className="totals-row">
            <span>Subtotal:</span>
            <span>{sale.subtotal.toFixed(2)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="totals-row">
              <span>Discount:</span>
              <span>-{sale.discount.toFixed(2)}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="totals-row">
              <span>Tax:</span>
              <span>{sale.tax.toFixed(2)}</span>
            </div>
          )}
          <div className="totals-row total-row">
            <span>Total:</span>
            <span>{sale.total.toFixed(2)}</span>
          </div>
          {totalPaid > 0 && (
            <div className="totals-row">
              <span>Paid:</span>
              <span>{totalPaid.toFixed(2)}</span>
            </div>
          )}
          {remainingBalance > 0 && (
            <div className="totals-row">
              <span>Remaining:</span>
              <span>{remainingBalance.toFixed(2)}</span>
            </div>
          )}
          {change > 0 && (
            <div className="totals-row">
              <span>Change:</span>
              <span>{change.toFixed(2)}</span>
            </div>
          )}
          <div className="totals-row" style={{ marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed #000" }}>
            <span>Status:</span>
            <span>{paymentStatus}</span>
          </div>
          {defaultBank && (
            <>
              <div className="totals-row" style={{ marginTop: "6px" }}>
                <span><strong>Bank:</strong></span>
                <span style={{ textAlign: "right" }}>
                  {defaultBank.bankName || "---"}
                </span>
              </div>
              <div className="totals-row">
                <span><strong>Account:</strong></span>
                <span style={{ textAlign: "right" }}>
                  {(defaultBank.accountName || "")}{defaultBank.accountNumber ? ` - ${defaultBank.accountNumber}` : ""}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="separator">********************************</div>
        <div>
          <strong>Payments:</strong>
          <table style={{ width: "100%", marginTop: "4px", fontSize: "11px", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "2px 0" }}>#</th>
                <th style={{ textAlign: "left", padding: "2px 0" }}>Type</th>
                <th style={{ textAlign: "left", padding: "2px 0" }}>Bank</th>
                <th style={{ textAlign: "right", padding: "2px 0" }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {(sale.payments || []).length > 0 ? (
                (sale.payments || []).map((p: any, idx: number) => {
                  const bank = p.bankAccountId ? bankAccounts.find((b) => b.id === p.bankAccountId) : null;
                  const bankLabel = bank ? `${bank.accountName || ""}${bank.bankName ? " - " + bank.bankName : ""}`.trim() : "-";
                  return (
                    <tr key={idx}>
                      <td style={{ padding: "2px 0" }}>{idx + 1}</td>
                      <td style={{ padding: "2px 0" }}>{(p.type || "").toUpperCase()}</td>
                      <td style={{ padding: "2px 0" }}>{bankLabel || "-"}</td>
                      <td style={{ padding: "2px 0", textAlign: "right" }}>{Number(p.amount || 0).toFixed(2)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "4px 0" }}>No payments recorded</td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ fontSize: "11px", marginTop: "2px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Total Paid:</span>
              <span>{totalPaid.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Remaining:</span>
              <span>{remainingBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {defaultBank && (
          <>
            <div className="separator">********************************</div>
            <div className="bank-info">
              <div><strong>Company Bank:</strong></div>
              <div>{defaultBank.bankName || "---"}</div>
              <div>{defaultBank.accountName || ""} {defaultBank.accountNumber ? " - " + defaultBank.accountNumber : ""}</div>
            </div>
          </>
        )}
        
        <div className="separator">********************************</div>
        
        <div className="footer">
          <div className="thank-you">THANK YOU!</div>
          <div>Bill #: {sale.billNumber}</div>
          <div>Date: {new Date(sale.date || sale.createdAt).toLocaleString()}</div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .screen-view {
            display: none !important;
          }
          .print-receipt {
            display: block !important;
            visibility: visible !important;
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            top: 0;
            width: 80mm;
            max-width: 80mm;
            margin: 0;
            padding: 10mm;
            font-family: 'Courier New', monospace;
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
            padding: 3px 2px;
            border-bottom: 1px dashed #ccc;
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
            font-size: 12px;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 4px 0;
            margin: 6px 0;
          }
          .print-receipt .bank-info {
            margin: 8px 0;
            font-size: 10px;
            line-height: 1.4;
          }
          .print-receipt .bank-info div {
            margin: 2px 0;
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

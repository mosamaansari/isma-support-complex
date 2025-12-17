import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import api from "../../services/api";
import { Sale, SalePayment } from "../../types";

export default function SalesPaymentsCombinedPrint() {
  const { billNumber } = useParams<{ billNumber: string }>();
  const { getSale, settings, bankAccounts, refreshBankAccounts } = useData();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultBank = bankAccounts.find((b: any) => b.isDefault) || bankAccounts[0];

  useEffect(() => {
    if (bankAccounts.length === 0) {
      refreshBankAccounts().catch((err) => {
        console.error("Failed to load bank accounts for combined payment print:", err);
      });
    }
  }, [bankAccounts.length, refreshBankAccounts]);

  useEffect(() => {
    const fetchData = async () => {
      if (!billNumber) {
        navigate("/sales");
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const fetchedSale = await api.getSaleByBillNumber(billNumber);
        if (fetchedSale) {
          setSale(fetchedSale);
        } else {
          setError("Bill not found");
        }
      } catch (err: any) {
        console.error("Error fetching sale:", err);
        setError(err.response?.data?.error || err.message || "Failed to load payments");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [billNumber, navigate]);

  useEffect(() => {
    if (sale && sale.payments && sale.payments.length > 0) {
      window.print();
    }
  }, [sale]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading payments...</p>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{error || "Sale not found"}</p>
        <Button onClick={() => navigate("/sales")} variant="outline" size="sm">
          Back to Sales
        </Button>
      </div>
    );
  }

  const payments = sale.payments || [];
  const totalPaid = payments.reduce((sum: number, p: SalePayment) => sum + (p?.amount || 0), 0);

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-500 mb-4">No payments found for this bill</p>
        <Button onClick={() => navigate("/sales")} variant="outline" size="sm">
          Back to Sales
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={`All Payments - ${sale.billNumber} | Isma Sports Complex`}
        description="Combined payment receipt"
      />
      <div className="print-container max-w-4xl mx-auto p-8 bg-white">
        {/* Print Controls - Hidden when printing */}
        <div className="no-print mb-6 flex items-center justify-between">
          <Button
            onClick={() => navigate("/sales")}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Sales
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

          {/* Bill Details */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Bill Number:</p>
                <p className="font-semibold text-lg">{sale.billNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Bill Date:</p>
                <p className="font-semibold">{new Date(sale.date || sale.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {sale.customerName && (
              <div className="mb-4">
                <p className="text-sm text-gray-600">Customer Name:</p>
                <p className="font-semibold">{sale.customerName}</p>
                {sale.customerPhone && (
                  <p className="text-sm text-gray-600">Phone: {sale.customerPhone}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Bill Total:</p>
                <p className="font-semibold text-lg">Rs. {sale.total.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Remaining Balance:</p>
                <p className={`font-semibold text-lg ${(sale.remainingBalance || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  Rs. {(sale.remainingBalance || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* All Payments */}
          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">All Payments ({payments.length})</h3>
            <div className="space-y-4">
              {payments.map((payment: SalePayment & { date?: string }, index: number) => {
                // Handle date - it might be ISO string or Date object
                let paymentDate: Date;
                if (payment.date) {
                  paymentDate = typeof payment.date === 'string' ? new Date(payment.date) : payment.date;
                } else {
                  paymentDate = new Date(sale.date || sale.createdAt);
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
                        <p className="font-semibold uppercase">{payment.type.replace('_', ' ')}</p>
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
                <span className="text-gray-700">Bill Total:</span>
                <span className="font-semibold">Rs. {sale.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Remaining Balance:</span>
                <span className={`font-semibold ${(sale.remainingBalance || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  Rs. {(sale.remainingBalance || 0).toFixed(2)}
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
        <div className="section-title">COMBINED PAYMENTS</div>
        <div className="separator">********************************</div>

        <div className="customer-info">
          <div><strong>Customer:</strong> {sale.customerName || "Walk-in"}</div>
          {sale.customerPhone && (
            <div><strong>Phone:</strong> {sale.customerPhone}</div>
          )}
        </div>

        <div className="separator">********************************</div>

        <div className="totals">
          <div className="totals-row">
            <span>Bill #:</span>
            <span>{sale.billNumber}</span>
          </div>
          <div className="totals-row">
            <span>Bill Date:</span>
            <span>{new Date(sale.date || sale.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="totals-row">
            <span>Bill Total:</span>
            <span>{sale.total.toFixed(2)}</span>
          </div>
          <div className="totals-row">
            <span>Remaining:</span>
            <span>{(sale.remainingBalance || 0).toFixed(2)}</span>
          </div>
          <div className="totals-row total-row">
            <span>Total Paid:</span>
            <span>{totalPaid.toFixed(2)}</span>
          </div>
        </div>

        <div className="separator">********************************</div>
        <div><strong>Payments:</strong></div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th className="text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment: SalePayment & { date?: string }, index: number) => {
              let paymentDate: Date;
              if (payment.date) {
                paymentDate = typeof payment.date === 'string' ? new Date(payment.date) : payment.date;
              } else {
                paymentDate = new Date(sale.date || sale.createdAt);
              }
              return (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    {paymentDate.toLocaleDateString()} {paymentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    <br />
                    <span style={{ fontSize: "10px" }}>{payment.type.replace("_", " ")}</span>
                  </td>
                  <td className="text-right">{payment.amount.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {defaultBank && (
          <>
            <div className="separator">********************************</div>
            <div className="bank-info">
              <div><strong>Company Bank:</strong></div>
              <div>{defaultBank.bankName || "---"}</div>
              <div>{defaultBank.accountName || defaultBank.accountHolder || ""} {defaultBank.accountNumber ? " - " + defaultBank.accountNumber : ""}</div>
              {defaultBank.branchName && <div>{defaultBank.branchName}</div>}
              {defaultBank.ifscCode && <div>IBAN/IFSC: {defaultBank.ifscCode}</div>}
            </div>
          </>
        )}

        <div className="separator">********************************</div>
        <div className="footer">
          <div className="thank-you">THANK YOU!</div>
          <div>Bill #: {sale.billNumber}</div>
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







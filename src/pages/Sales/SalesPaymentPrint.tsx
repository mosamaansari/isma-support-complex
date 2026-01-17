import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import api from "../../services/api";
import { Sale, SalePayment } from "../../types";

export default function SalesPaymentPrint() {
  const { billNumber, paymentIndex } = useParams<{ billNumber: string; paymentIndex?: string }>();
  const { settings, bankAccounts, refreshBankAccounts } = useData();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);
  const [payment, setPayment] = useState<SalePayment & { date?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bankAccountsLoadedRef = useRef(false);
  const defaultBank = bankAccounts.find((b: any) => b.isDefault) || bankAccounts[0];

  // Load bank accounts only once on mount to prevent duplicate API calls
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
          
          // Get specific payment if paymentIndex is provided
          if (paymentIndex !== undefined && fetchedSale.payments) {
            const index = parseInt(paymentIndex);
            if (index >= 0 && index < fetchedSale.payments.length) {
              setPayment(fetchedSale.payments[index]);
            }
          }
        } else {
          setError("Bill not found");
        }
      } catch (err: any) {
        console.error("Error fetching sale:", err);
        setError(err.response?.data?.error || err.message || "Failed to load payment");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [billNumber, paymentIndex, navigate]);

  useEffect(() => {
    if (sale && payment) {
      window.print();
    }
  }, [sale, payment]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading payment...</p>
      </div>
    );
  }

  if (error || !sale || !payment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{error || "Payment not found"}</p>
        <Button onClick={() => navigate("/sales")} variant="outline" size="sm">
          Back to Sales
        </Button>
      </div>
    );
  }

  // Handle date - it might be ISO string or Date object
  let paymentDate: Date;
  if (payment.date) {
    paymentDate = typeof payment.date === 'string' ? new Date(payment.date) : payment.date;
  } else {
    paymentDate = new Date(sale.date || sale.createdAt);
  }
  // Filter out payments with invalid amounts (0, null, undefined, NaN) before calculating totalPaid
  const validPayments = (sale.payments || []).filter((p: SalePayment) => 
    p?.amount !== undefined && 
    p?.amount !== null && 
    !isNaN(Number(p.amount)) && 
    Number(p.amount) > 0
  );
  const totalPaid = validPayments.reduce((sum: number, p: SalePayment) => sum + (p?.amount || 0), 0);
  const paymentNumber = paymentIndex ? parseInt(paymentIndex) + 1 : 1;
  const totalPayments = (sale.payments || []).length;
  const paymentBank =
    (payment.bankAccountId && bankAccounts.find((b: any) => b.id === payment.bankAccountId)) ||
    defaultBank;

  return (
    <>
      <PageMeta
        title={`Payment Receipt - ${sale.billNumber} | Isma Sports Complex`}
        description="Payment receipt"
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
                <p className="font-semibold">{sale.billNumber}-PAY-{paymentNumber.toString().padStart(3, '0')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Date:</p>
                <p className="font-semibold">{paymentDate.toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Bill Number:</p>
                <p className="font-semibold">{sale.billNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Time:</p>
                <p className="font-semibold">{paymentDate.toLocaleTimeString()}</p>
              </div>
            </div>

            {sale.customerName && (
              <div className="mb-4">
                <p className="text-sm text-gray-600">Customer Name:</p>
                <p className="font-semibold">{sale.customerName}</p>
                {sale.customerPhone && sale.customerPhone !== "0000000000" && sale.customerPhone.trim() !== "" && (
                  <p className="text-sm text-gray-600">Phone: {sale.customerPhone}</p>
                )}
              </div>
            )}
          </div>

          {/* Payment Information */}
          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">Payment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700">Payment Type:</span>
                <span className="font-semibold uppercase">{payment.type.replace('_', ' ')}</span>
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
                <span className="text-gray-700">Bill Total:</span>
                <span className="font-semibold">Rs. {sale.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Total Paid (All Payments):</span>
                <span className="font-semibold">Rs. {totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Remaining Balance:</span>
                <span className={`font-semibold ${(sale.remainingBalance || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  Rs. {(sale.remainingBalance || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Payment {paymentNumber} of {totalPayments} payment(s) for Bill #{sale.billNumber}
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
            {paymentBank && (
              <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                <p className="font-semibold">Company Bank</p>
                <p>{paymentBank.bankName || "---"}</p>
                <p>
                  {paymentBank.accountName || paymentBank.accountHolder || ""}
                  {paymentBank.accountNumber ? ` - ${paymentBank.accountNumber}` : ""}
                </p>
                {paymentBank.branchName && <p>{paymentBank.branchName}</p>}
                {paymentBank.ifscCode && <p>IBAN/IFSC: {paymentBank.ifscCode}</p>}
              </div>
            )}
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
            <span>Payment #:</span>
            <span>{paymentNumber} / {totalPayments}</span>
          </div>
          <div className="totals-row">
            <span>Date:</span>
            <span>{paymentDate.toLocaleString()}</span>
          </div>
          <div className="totals-row">
            <span>Type:</span>
            <span>{payment.type.replace("_", " ")}</span>
          </div>
          <div className="totals-row total-row">
            <span>Paid:</span>
            <span>{(payment.amount || 0).toFixed(2)}</span>
          </div>
          <div className="totals-row">
            <span>Bill Total:</span>
            <span>{sale.total.toFixed(2)}</span>
          </div>
          <div className="totals-row">
            <span>Total Paid:</span>
            <span>{totalPaid.toFixed(2)}</span>
          </div>
          <div className="totals-row">
            <span>Remaining:</span>
            <span>{(sale.remainingBalance || 0).toFixed(2)}</span>
          </div>
        </div>

        {paymentBank && (
          <>
            <div className="separator">********************************</div>
            <div className="bank-info">
              <div><strong>Bank:</strong> {paymentBank.bankName || "---"}</div>
              <div><strong>Account Name:</strong> {paymentBank.accountName || paymentBank.accountHolder || "---"}</div>
              <div><strong>Account No.:</strong> {paymentBank.accountNumber || "---"}</div>
              {paymentBank.branchName && <div><strong>Branch:</strong> {paymentBank.branchName}</div>}
              {paymentBank.ifscCode && <div><strong>IBAN/IFSC:</strong> {paymentBank.ifscCode}</div>}
            </div>
          </>
        )}

        <div className="separator">********************************</div>

        <div className="footer">
          <div className="thank-you">THANK YOU!</div>
          <div>Date: {paymentDate.toLocaleString()}</div>
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







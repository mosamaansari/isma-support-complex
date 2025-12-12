import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useData } from "../../context/DataContext";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, DownloadIcon } from "../../icons";
import api from "../../services/api";
import { Sale } from "../../types";

export default function BillPrint() {
  const { billNumber } = useParams<{ billNumber: string }>();
  const { getSale, settings, refreshSales } = useData();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSale = async () => {
      if (!billNumber) {
        navigate("/sales");
        return;
      }

      // First try to get from local state
      const localSale = getSale(billNumber);
      if (localSale) {
        setSale(localSale);
        return;
      }

      // If not found locally, fetch from API
      setLoading(true);
      try {
        const fetchedSale = await api.getSaleByBillNumber(billNumber);
        setSale(fetchedSale);
        // Refresh sales list to include this sale
        await refreshSales();
      } catch (error) {
        console.error("Error fetching sale:", error);
        navigate("/sales");
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
  }, [billNumber, navigate, getSale, refreshSales]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading bill...</p>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Bill not found</p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Bill ${sale.billNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .bill-details { margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
              .total { font-weight: bold; font-size: 18px; }
              .footer { margin-top: 30px; text-align: center; font-size: 12px; }
            </style>
          </head>
          <body>
            ${document.getElementById("bill-content")?.innerHTML || ""}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <>
      <PageMeta
        title={`Bill ${sale.billNumber} | Isma Sports Complex`}
        description="View and print bill"
      />
      <div className="mb-4">
        <Button
          onClick={() => navigate("/sales")}
          variant="outline"
          size="sm"
          className="mr-2"
        >
          <ChevronLeftIcon className="w-4 h-4 mr-2" />
          Back to Sales
        </Button>
        <Button onClick={handlePrint} variant="outline" size="sm" className="mr-2">
          <DownloadIcon className="w-4 h-4 mr-2" />
          Print
        </Button>
        <Button onClick={handleDownload} variant="outline" size="sm">
          Download PDF
        </Button>
      </div>

      <div
        id="bill-content"
        className="p-8 bg-white rounded-lg shadow-sm dark:bg-gray-800 print:shadow-none"
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
              {new Date(sale.createdAt).toLocaleString()}
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
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Phone:</span>
              <span className="text-gray-800 dark:text-white">
                {sale.customerPhone}
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
                Disc%
              </th>
              <th className="p-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => (
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
                  Rs. {item.unitPrice.toFixed(2)}
                </td>
                <td className="p-2 text-right text-gray-700 dark:text-gray-300">
                  {item.discount > 0 ? `${item.discount}%` : "-"}
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

        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Payment Type:{" "}
            <span className="font-semibold text-gray-800 dark:text-white uppercase">
              {sale.paymentType}
            </span>
          </p>
        </div>

        <div className="p-4 mt-6 bg-gray-50 rounded-lg dark:bg-gray-900">
          <h3 className="mb-2 font-semibold text-gray-800 dark:text-white">
            Bank Account Details:
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Bank: {settings.bankName}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Account Number: {settings.bankAccountNumber}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            IFSC Code: {settings.ifscCode}
          </p>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Thank you for your business!</p>
          <p className="mt-2">Generated by: {sale.userName}</p>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #bill-content, #bill-content * {
            visibility: visible;
          }
          #bill-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}


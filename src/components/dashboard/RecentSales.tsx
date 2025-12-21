import { useMemo } from "react";
import { Link } from "react-router";
import { useData } from "../../context/DataContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import { formatPriceWithCurrency } from "../../utils/priceHelpers";

export default function RecentSales() {
  const { sales } = useData();

  // Get recent 5 sales
  const recentSales = useMemo(() => {
    return sales
      .filter((s) => s.status === "completed")
      .sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt).getTime();
        const dateB = new Date(b.date || b.createdAt).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [sales]);

  const getStatusBadge = (sale: any) => {
    if (sale.status === "pending") {
      return <Badge color="warning">Pending</Badge>;
    }
    if (sale.status === "cancelled") {
      return <Badge color="error">Cancelled</Badge>;
    }
    return <Badge color="success">Completed</Badge>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (recentSales.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Recent Sales
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Latest completed sales transactions
            </p>
          </div>
        </div>
        <div className="py-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No sales found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 pb-3 pt-3 sm:px-4 sm:pt-4 dark:border-gray-800 dark:bg-white/[0.03] md:px-6">
      <div className="flex flex-col gap-2 mb-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white/90">
            Recent Sales
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Latest completed sales transactions
          </p>
        </div>

        <Link
          to="/sales"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
        >
          View All
        </Link>
      </div>
      <div className="table-container">
        <Table>
          <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
            <TableRow>
              <TableCell
                isHeader
                className="py-2 sm:py-3 font-medium text-gray-500 text-start text-xs sm:text-theme-xs dark:text-gray-400 whitespace-nowrap min-w-[100px]"
              >
                Bill Number
              </TableCell>
              <TableCell
                isHeader
                className="py-2 sm:py-3 font-medium text-gray-500 text-start text-xs sm:text-theme-xs dark:text-gray-400 whitespace-nowrap min-w-[120px]"
              >
                Customer
              </TableCell>
              <TableCell
                isHeader
                className="py-2 sm:py-3 font-medium text-gray-500 text-start text-xs sm:text-theme-xs dark:text-gray-400 whitespace-nowrap min-w-[100px]"
              >
                Date
              </TableCell>
              <TableCell
                isHeader
                className="py-2 sm:py-3 font-medium text-gray-500 text-start text-xs sm:text-theme-xs dark:text-gray-400 whitespace-nowrap min-w-[100px]"
              >
                Amount
              </TableCell>
              <TableCell
                isHeader
                className="py-2 sm:py-3 font-medium text-gray-500 text-start text-xs sm:text-theme-xs dark:text-gray-400 whitespace-nowrap min-w-[90px]"
              >
                Status
              </TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentSales.map((sale) => (
              <TableRow key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <TableCell className="py-2 sm:py-3">
                  <Link
                    to={`/sales/bill/${sale.billNumber}`}
                    className="font-medium text-gray-800 text-xs sm:text-theme-sm hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400"
                  >
                    #{sale.billNumber}
                  </Link>
                </TableCell>
                <TableCell className="py-2 sm:py-3 text-gray-500 text-xs sm:text-theme-sm dark:text-gray-400">
                  <div className="max-w-[120px] truncate">{sale.customerName || "Walk-in"}</div>
                </TableCell>
                <TableCell className="py-2 sm:py-3 text-gray-500 text-xs sm:text-theme-sm dark:text-gray-400 whitespace-nowrap">
                  {formatDate(sale.date || sale.createdAt)}
                </TableCell>
                <TableCell className="py-2 sm:py-3 font-medium text-gray-800 text-xs sm:text-theme-sm dark:text-white/90 price-responsive whitespace-nowrap">
                  {formatPriceWithCurrency(sale.total || 0)}
                </TableCell>
                <TableCell className="py-2 sm:py-3 text-gray-500 text-xs sm:text-theme-sm dark:text-gray-400">
                  {getStatusBadge(sale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}







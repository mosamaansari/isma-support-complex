import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import api from "../../services/api";

interface RecentSale {
  id: string;
  billNumber: string;
  customerName: string;
  date: string;
  total: number;
  status: string;
}

export default function RecentOrders() {
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const stats = await api.getDashboardStats();
        // Handle null/undefined recentSales
        if (stats?.recentSales && Array.isArray(stats.recentSales)) {
          setRecentSales(stats.recentSales);
        } else {
          setRecentSales([]);
        }
      } catch (error: any) {
        console.error("Error loading recent sales:", error);
        setError(error?.response?.data?.error || "Failed to load recent sales");
        setRecentSales([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === "pending") {
      return <Badge color="warning">Pending</Badge>;
    }
    if (status === "cancelled") {
      return <Badge color="error">Cancelled</Badge>;
    }
    return <Badge color="success">Completed</Badge>;
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 dark:bg-gray-800 mb-4"></div>
          <div className="h-40 bg-gray-200 rounded dark:bg-gray-800"></div>
        </div>
      </div>
    );
  }

  if (!recentSales || recentSales.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Recent Sales
            </h3>
          </div>
        </div>
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Data not found</p>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Recent Sales
          </h3>
        </div>

        <Link
          to="/sales"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
        >
          See all
        </Link>
      </div>
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
            <TableRow>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Bill Number
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Customer
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Date
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Amount
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Status
              </TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentSales.map((sale) => {
              // Safe defaults for each sale
              const safeSale = {
                id: sale?.id || "",
                billNumber: sale?.billNumber || "N/A",
                customerName: sale?.customerName || "Walk-in",
                date: sale?.date || new Date().toISOString(),
                total: sale?.total ?? 0,
                status: sale?.status || "completed",
              };

              return (
                <TableRow key={safeSale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <TableCell className="py-3">
                    {safeSale.billNumber !== "N/A" ? (
                      <Link
                        to={`/sales/bill/${safeSale.billNumber}`}
                        className="font-medium text-gray-800 text-theme-sm hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400"
                      >
                        #{safeSale.billNumber}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                        {safeSale.billNumber}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    {safeSale.customerName}
                  </TableCell>
                  <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    {safeSale.date ? formatDate(safeSale.date) : "N/A"}
                  </TableCell>
                  <TableCell className="py-3 font-medium text-gray-800 text-theme-sm dark:text-white/90">
                    Rs. {(safeSale.total || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    {getStatusBadge(safeSale.status)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

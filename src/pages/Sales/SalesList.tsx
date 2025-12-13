import { useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import { EyeIcon, TrashBinIcon } from "../../icons";

export default function SalesList() {
  const { sales, cancelSale, currentUser } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "cancelled">("all");

  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      sale.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customerPhone?.includes(searchTerm);
    const matchesStatus =
      filterStatus === "all" || sale.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCancelSale = (id: string) => {
    if (window.confirm("Are you sure you want to cancel this sale?")) {
      cancelSale(id);
    }
  };

  const totalSales = filteredSales
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + s.total, 0);

  return (
    <>
      <PageMeta
        title="Sales List | Isma Sports Complex"
        description="View all sales and bills"
      />
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Sales List
          </h1>
          <Link to="/sales/entry">
            <Button size="sm">New Sale</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              Rs. {totalSales.toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Bills</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {filteredSales.length}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {filteredSales.filter((s) => s.status === "completed").length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by bill number, customer name or phone..."
          />
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as "all" | "completed" | "cancelled")
            }
            className="px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-sm dark:bg-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Bill Number
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Date
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Customer
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Items
              </th>
              <th className="p-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Total
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Payment
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </th>
              <th className="p-4 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  No sales found
                </td>
              </tr>
            ) : (
              filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="p-4 font-medium text-gray-800 dark:text-white">
                    {sale.billNumber}
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300">
                    {new Date(sale.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300">
                    {sale.customerName || "Walk-in"}
                    {sale.customerPhone && (
                      <p className="text-xs text-gray-500">{sale.customerPhone}</p>
                    )}
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300">
                    {sale.items.length} item(s)
                  </td>
                  <td className="p-4 text-right font-semibold text-gray-800 dark:text-white">
                    Rs. {sale.total.toFixed(2)}
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 uppercase">
                      {sale.paymentType}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        sale.status === "completed"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                      }`}
                    >
                      {sale.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <Link to={`/sales/bill/${sale.billNumber}`}>
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      </Link>
                      {sale.status === "completed" &&
                        (currentUser?.role === "admin" ||
                          currentUser?.id === sale.userId) && (
                          <button
                            onClick={() => handleCancelSale(sale.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
                          >
                            <TrashBinIcon className="w-4 h-4" />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}



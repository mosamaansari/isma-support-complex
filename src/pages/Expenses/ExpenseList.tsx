import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import { ExpenseCategory } from "../../types";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import DatePicker from "../../components/form/DatePicker";
import Pagination from "../../components/ui/Pagination";
import PageSizeSelector from "../../components/ui/PageSizeSelector";
import { PencilIcon, TrashBinIcon } from "../../icons";
import { Modal } from "../../components/ui/modal";
import api from "../../services/api";
import { formatDateToString } from "../../utils/dateHelpers";
import { formatPriceWithCurrency } from "../../utils/priceHelpers";

export default function ExpenseList() {
  const { expenses, expensesPagination, deleteExpense, currentUser, loading, error, refreshExpenses } = useData();
  const { showSuccess, showError } = useAlert();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all");
  const [filterDate, setFilterDate] = useState("");
  const [expenseSummary, setExpenseSummary] = useState<{
    totalAmount: number;
    totalCount: number;
    categoryTotals: Record<string, { total: number; count: number }>;
  } | null>(null);
  const expensesLoadedRef = useRef(false);

  // Load expenses on mount if empty
  useEffect(() => {
    if (!expensesLoadedRef.current) {
      expensesLoadedRef.current = true;
      if (!loading && (!expenses || expenses.length === 0)) {
        refreshExpenses(expensesPagination?.page || 1, expensesPagination?.pageSize || 10).catch(err => {
          console.error("ExpenseList - Error refreshing expenses:", err);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load expense summary from API response when expenses are loaded
  useEffect(() => {
    const loadExpenseSummary = async () => {
      try {
        const result = await api.getExpenses({ page: 1, pageSize: 10 });
        if (result.summary) {
          setExpenseSummary(result.summary);
        }
      } catch (err) {
        console.error("Error loading expense summary:", err);
      }
    };
    loadExpenseSummary();
  }, []);

  // Refresh summary when expenses list changes (after add/update/delete)
  useEffect(() => {
    const refreshSummary = async () => {
      try {
        const result = await api.getExpenses({ page: 1, pageSize: 10 });
        if (result.summary) {
          setExpenseSummary(result.summary);
        }
      } catch (err) {
        console.error("Error refreshing expense summary:", err);
      }
    };
    // Only refresh if we have expenses loaded
    if (expenses && expenses.length > 0) {
      refreshSummary();
    }
  }, [expenses]);

  const handlePageChange = (page: number) => {
    refreshExpenses(page, expensesPagination?.pageSize || 10);
  };

  const handlePageSizeChange = (pageSize: number) => {
    refreshExpenses(1, pageSize);
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
        </div>
      </div>
    );
  }

  // Show error only if there's an error and no expenses at all
  if (error && (!expenses || expenses.length === 0) && !loading) {
    return (
      <>
        <PageMeta title="Expenses | Isma Sports Complex" description="Manage expenses" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">Error: {error}</p>
            <Button onClick={() => refreshExpenses(expensesPagination?.page || 1, expensesPagination?.pageSize || 10)} size="sm">
              Retry
            </Button>
          </div>
        </div>
      </>
    );
  }

  const filteredExpenses = (expenses || []).filter((expense) => {
    if (!expense) return false;
    const matchesSearch =
      !searchTerm ||
      (expense.description && expense.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.userName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || expense.category === filterCategory;
    // Compare date part only (YYYY-MM-DD)
    const expenseDateStr = expense.date ? formatDateToString(new Date(expense.date)) : '';
    const matchesDate = !filterDate || expenseDateStr === filterDate;
    return matchesSearch && matchesCategory && matchesDate;
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setExpenseToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await deleteExpense(expenseToDelete);
      setDeleteModalOpen(false);
      setExpenseToDelete(null);
      showSuccess("Expense deleted successfully!");
      // Refresh summary from backend after delete
      try {
        const result = await api.getExpenses({ page: 1, pageSize: 10 });
        if (result.summary) {
          setExpenseSummary(result.summary);
        }
      } catch (err) {
        console.error("Error refreshing expense summary:", err);
      }
      // Also refresh the paginated list
      await refreshExpenses(expensesPagination?.page || 1, expensesPagination?.pageSize || 10);
    } catch (err) {
      console.error("Error deleting expense:", err);
      showError("Failed to delete expense. Please try again.");
    }
  };

  // Use summary from API response (all-time totals from start to today)
  const totalExpenses = expenseSummary?.totalAmount 
    ? (typeof expenseSummary.totalAmount === 'number' 
        ? expenseSummary.totalAmount 
        : parseFloat(String(expenseSummary.totalAmount)) || 0)
    : 0;

  const categoryTotals = expenseSummary?.categoryTotals
    ? Object.entries(expenseSummary.categoryTotals).reduce((acc, [category, data]) => {
        acc[category] = typeof data.total === 'number' ? data.total : parseFloat(String(data.total)) || 0;
        return acc;
      }, {} as Record<string, number>)
    : {};

  return (
    <>
      <PageMeta
        title="Expenses | Isma Sports Complex"
        description="Manage expenses"
      />
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            Expenses Management
          </h1>
          <Link to="/expenses/add" className="w-full sm:w-auto">
            <Button size="sm" className="w-full sm:w-auto">Add Expense</Button>
          </Link>
        </div>

        {/* Loading overlay - only show when loading and no data */}
        {loading && (!expenses || expenses.length === 0) ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading expenses...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-6 sm:grid-cols-2 md:grid-cols-4">
              <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 dark:text-white price-responsive">
                  {formatPriceWithCurrency(totalExpenses)}
                </p>
              </div>
              {Object.entries(categoryTotals)
                .sort(([, a], [, b]) => {
                  const amountA = typeof a === 'number' ? a : parseFloat(String(a)) || 0;
                  const amountB = typeof b === 'number' ? b : parseFloat(String(b)) || 0;
                  return amountB - amountA;
                })
                .slice(0, 3)
                .map(([category, amount]) => {
                  const amountValue = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
                  return (
                    <div key={category} className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {category}
                      </p>
                      <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 dark:text-white price-responsive">
                        {formatPriceWithCurrency(amountValue)}
                      </p>
                    </div>
                  );
                })}
            </div>

            <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search expenses..."
              />
              <select
                value={filterCategory}
                onChange={(e) =>
                  setFilterCategory(e.target.value as ExpenseCategory | "all")
                }
                className="px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                <option value="all">All Categories</option>
                <option value="rent">Rent</option>
                <option value="bills">Bills</option>
                <option value="transport">Transport</option>
                <option value="salaries">Salaries</option>
                <option value="maintenance">Maintenance</option>
                <option value="marketing">Marketing</option>
                <option value="tea">Tea</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="refreshment">Refreshment</option>
                <option value="other">Other</option>
              </select>
              <DatePicker
                value={filterDate}
                onChange={(e) => {
                  const dateValue = e.target.value;
                  setFilterDate(dateValue || "");
                }}
                placeholder="Filter by date"
              />
            </div>
          </>
        )}
      </div>

      {/* Content section - always show table, even when loading or empty */}
      {!loading ? (
        <>
          <div className="table-container bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <table className="responsive-table">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="p-2 sm:p-3 md:p-4 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Date
                    </th>
                    <th className="p-2 sm:p-3 md:p-4 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Category
                    </th>
                    <th className="p-2 sm:p-3 md:p-4 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[200px]">
                      Description
                    </th>
                    <th className="p-2 sm:p-3 md:p-4 text-right text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Amount
                    </th>
                    <th className="p-2 sm:p-3 md:p-4 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Added By
                    </th>
                    <th className="p-2 sm:p-3 md:p-4 text-center text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 sm:p-6 md:p-8 text-center text-gray-500 text-sm sm:text-base">
                        No expenses found
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <tr
                        key={expense.id}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="p-2 sm:p-3 md:p-4 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs sm:text-sm">
                          <span className="hidden sm:inline">{new Date(expense.date).toLocaleDateString()}</span>
                          <span className="sm:hidden">{new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </td>
                        <td className="p-2 sm:p-3 md:p-4 whitespace-nowrap">
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 capitalize">
                            {expense.category}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 md:p-4 text-gray-700 dark:text-gray-300 max-w-[200px] sm:max-w-[300px]">
                          <div className="line-clamp-2 sm:line-clamp-3 truncate text-xs sm:text-sm">
                            {expense.description || <span className="text-gray-400 italic">No description</span>}
                          </div>
                        </td>
                        <td className="p-2 sm:p-3 md:p-4 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap price-responsive">
                          Rs. {(typeof expense.amount === 'number' ? expense.amount : parseFloat(String(expense.amount)) || 0).toFixed(2)}
                        </td>
                        <td className="p-2 sm:p-3 md:p-4 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs sm:text-sm">
                          {expense.userName}
                        </td>
                        <td className="p-2 sm:p-3 md:p-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 sm:gap-2 flex-nowrap">
                            <Link to={`/expenses/edit/${expense.id}`}>
                              <button className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20 flex-shrink-0">
                                <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                              </button>
                            </Link>
                            {(currentUser?.role === "admin" ||
                              currentUser?.id === expense.userId) && (
                              <button
                                onClick={() => handleDeleteClick(expense.id)}
                                className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20 flex-shrink-0"
                              >
                                <TrashBinIcon className="w-3 h-3 sm:w-4 sm:h-4" />
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

          {/* Pagination Controls */}
          <div className="mt-4 sm:mt-6 flex flex-col gap-3 sm:gap-4 bg-white rounded-lg shadow-sm p-3 sm:p-4 dark:bg-gray-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <PageSizeSelector
                pageSize={expensesPagination?.pageSize || 10}
                onPageSizeChange={handlePageSizeChange}
              />
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Showing {((expensesPagination?.page || 1) - 1) * (expensesPagination?.pageSize || 10) + 1} to{" "}
                {Math.min((expensesPagination?.page || 1) * (expensesPagination?.pageSize || 10), expensesPagination?.total || 0)} of{" "}
                {expensesPagination?.total || 0} expenses
              </span>
            </div>
            <div className="flex justify-center">
              <Pagination
                currentPage={expensesPagination?.page || 1}
                totalPages={expensesPagination?.totalPages || 1}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        </>
      ) : null}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setExpenseToDelete(null);
        }}
        className="max-w-md mx-4"
        showCloseButton={true}
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full dark:bg-red-900/20">
              <TrashBinIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Delete Expense
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This action cannot be undone
              </p>
            </div>
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Are you sure you want to delete this expense? This will permanently remove the expense record.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteModalOpen(false);
                setExpenseToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Expense
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}



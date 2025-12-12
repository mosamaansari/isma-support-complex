import { useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { ExpenseCategory } from "../../types";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import { PencilIcon, TrashBinIcon } from "../../icons";

export default function ExpenseList() {
  const { expenses, deleteExpense, currentUser } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all");
  const [filterDate, setFilterDate] = useState("");

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || expense.category === filterCategory;
    const matchesDate = !filterDate || expense.date === filterDate;
    return matchesSearch && matchesCategory && matchesDate;
  });

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      deleteExpense(id);
    }
  };

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<ExpenseCategory, number>);

  return (
    <>
      <PageMeta
        title="Expenses | Isma Sports Complex"
        description="Manage expenses"
      />
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Expenses Management
          </h1>
          <Link to="/expenses/add">
            <Button size="sm">Add Expense</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4">
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              Rs. {totalExpenses.toFixed(2)}
            </p>
          </div>
          {Object.entries(categoryTotals).slice(0, 3).map(([category, amount]) => (
            <div key={category} className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                {category}
              </p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                Rs. {amount.toFixed(2)}
              </p>
            </div>
          ))}
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
            <option value="other">Other</option>
          </select>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            placeholder="Filter by date"
          />
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-sm dark:bg-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Date
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Category
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </th>
              <th className="p-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount
              </th>
              <th className="p-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Added By
              </th>
              <th className="p-4 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No expenses found
                </td>
              </tr>
            ) : (
              filteredExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="p-4 text-gray-700 dark:text-gray-300">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 capitalize">
                      {expense.category}
                    </span>
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300">
                    {expense.description}
                  </td>
                  <td className="p-4 text-right font-semibold text-gray-800 dark:text-white">
                    Rs. {expense.amount.toFixed(2)}
                  </td>
                  <td className="p-4 text-gray-700 dark:text-gray-300">
                    {expense.userName}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <Link to={`/expenses/edit/${expense.id}`}>
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </Link>
                      {(currentUser?.role === "admin" ||
                        currentUser?.id === expense.userId) && (
                        <button
                          onClick={() => handleDelete(expense.id)}
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


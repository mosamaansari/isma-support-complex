import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SuperAdminSignIn from "./pages/AuthPages/SuperAdminSignIn";
import ForgotPassword from "./pages/AuthPages/ForgotPassword";
import NotFound from "./pages/OtherPage/NotFound";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";

// Sales Pages
import SalesEntry from "./pages/Sales/SalesEntry";
import SalesList from "./pages/Sales/SalesList";
import BillPrint from "./pages/Sales/BillPrint";

// Inventory Pages
import ProductList from "./pages/Inventory/ProductList";
import ProductForm from "./pages/Inventory/ProductForm";
import PurchaseEntry from "./pages/Inventory/PurchaseEntry";

// Expenses Pages
import ExpenseList from "./pages/Expenses/ExpenseList";
import ExpenseForm from "./pages/Expenses/ExpenseForm";

// Reports
import Reports from "./pages/Reports/Reports";

// Users
import UserList from "./pages/Users/UserList";
import UserForm from "./pages/Users/UserForm";

// Settings
import Settings from "./pages/Settings/Settings";

// Profile
import Profile from "./pages/Profile/Profile";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Auth Layout - Must be before protected routes */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/superadmin" element={<SuperAdminSignIn />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Dashboard Layout - Protected Routes */}
          <Route element={<AppLayout />}>
            <Route index path="/" element={<Home />} />

            {/* Sales & Billing */}
            <Route path="/sales" element={<SalesList />} />
            <Route path="/sales/entry" element={<SalesEntry />} />
            <Route path="/sales/bill/:billNumber" element={<BillPrint />} />

            {/* Inventory */}
            <Route path="/inventory/products" element={<ProductList />} />
            <Route path="/inventory/product/add" element={<ProductForm />} />
            <Route path="/inventory/product/edit/:id" element={<ProductForm />} />
            <Route path="/inventory/purchase" element={<PurchaseEntry />} />
            <Route path="/inventory/purchases" element={<PurchaseEntry />} />

            {/* Expenses */}
            <Route path="/expenses" element={<ExpenseList />} />
            <Route path="/expenses/add" element={<ExpenseForm />} />
            <Route path="/expenses/edit/:id" element={<ExpenseForm />} />

            {/* Reports */}
            <Route path="/reports" element={<Reports />} />

            {/* Users (Admin Only) */}
            <Route path="/users" element={<UserList />} />
            <Route path="/users/add" element={<UserForm />} />
            <Route path="/users/edit/:id" element={<UserForm />} />

            {/* Settings (Admin Only) */}
            <Route path="/settings" element={<Settings />} />

            {/* Profile (All Users) */}
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}

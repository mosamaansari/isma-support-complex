# Permissions System Guide

## Overview

The system now supports granular permissions for users. Each user can have custom permissions assigned, in addition to their role-based default permissions.

## Permission Structure

### Permission Types

1. **Page Permissions** - Control access to specific pages/routes
   - Example: `/sales`, `/inventory/products`, `/users`

2. **Action Permissions** - Control specific actions
   - Example: `sales:cancel`, `inventory:delete`, `expenses:delete`

### Available Permissions

#### Sales & Billing
- `/sales` - View sales list
- `/sales/entry` - Create new sale
- `/sales/bill/:billNumber` - View bills
- `sales:cancel` - Cancel sales

#### Inventory
- `/inventory/products` - View products
- `/inventory/product/add` - Add product
- `/inventory/product/edit/:id` - Edit product
- `inventory:delete` - Delete product
- `/inventory/purchases` - View purchases
- `/inventory/purchase` - Create purchase

#### Expenses
- `/expenses` - View expenses
- `/expenses/add` - Add expense
- `/expenses/edit/:id` - Edit expense
- `expenses:delete` - Delete expense

#### Reports
- `/reports` - View reports
- `reports:sales` - Sales reports
- `reports:expenses` - Expense reports
- `reports:profit-loss` - Profit/Loss reports

#### User Management
- `/users` - View users
- `/users/add` - Add user
- `/users/edit/:id` - Edit user
- `users:delete` - Delete user

#### Settings
- `/settings` - View settings
- `settings:edit` - Edit settings

## Default Permissions by Role

### SuperAdmin
- **All permissions** - Has access to everything

### Admin
- All Sales permissions
- All Inventory permissions
- All Expense permissions
- All Report permissions
- All User Management permissions
- All Settings permissions

### Cashier
- View Sales
- Create Sale
- View Bills

### Warehouse Manager
- View Products
- Add Product
- Edit Product
- View Purchases
- Create Purchase

## How Permissions Work

### Frontend
1. **Role-based defaults** - Each role has default permissions
2. **Custom permissions** - Can be assigned per user
3. **Permission check** - `hasPermission()` function checks both role and custom permissions
4. **Route protection** - AppLayout checks permissions before rendering pages

### Backend
1. **JWT token** - Contains user ID
2. **User lookup** - Fetches user with permissions from database
3. **Permission validation** - Can be checked in route handlers
4. **Role-based fallback** - If no custom permissions, uses role defaults

## Adding/Editing Users

### Steps:
1. Go to `/users` (Admin/SuperAdmin only)
2. Click "Add User" or edit existing user
3. Fill in user details:
   - Username
   - Password
   - Name
   - Email (optional)
   - Role
4. **Select Permissions:**
   - Permissions are grouped by category
   - Check/uncheck individual permissions
   - Use "Select All" / "Deselect All" for each group
   - Default permissions are set based on role, but can be customized
5. Click "Add User" or "Update User"

### Permission Selection Tips:
- **Role-based defaults** - When you select a role, default permissions are automatically set
- **Customize** - You can then add or remove specific permissions
- **Select All** - Use the "Select All" button for a group to quickly select all permissions in that category
- **Save** - Permissions are saved with the user and enforced immediately

## Permission Enforcement

### Frontend Enforcement
- **Route Protection** - AppLayout checks permissions before rendering
- **Menu Visibility** - Sidebar shows/hides menu items based on permissions
- **Button Visibility** - Action buttons (delete, edit) check permissions

### Backend Enforcement
- **Middleware** - `authenticate` middleware loads user with permissions
- **Route Handlers** - Can check specific permissions before allowing actions
- **Role Checks** - `authorize` middleware checks roles

## Examples

### Example 1: Cashier with View-Only Access
- Role: `cashier`
- Permissions: `["/sales", "/sales/bill/:billNumber"]`
- Can view sales and bills, but cannot create sales

### Example 2: Warehouse Manager with Delete Access
- Role: `warehouse_manager`
- Permissions: `["/inventory/products", "/inventory/product/add", "/inventory/product/edit/:id", "inventory:delete"]`
- Can manage products including delete

### Example 3: Custom Admin with Limited Access
- Role: `admin`
- Permissions: `["/sales", "/sales/entry", "/expenses", "/expenses/add"]`
- Can only access sales and expenses, not inventory or users

## Testing Permissions

1. **Create a test user:**
   - Go to `/users/add`
   - Create user with specific permissions
   - Login as that user
   - Try accessing different pages

2. **Verify access:**
   - Pages with permissions should load
   - Pages without permissions should show "Access Denied"
   - Menu items should show/hide based on permissions

## Notes

- **SuperAdmin** always has all permissions (cannot be restricted)
- **Default permissions** are set automatically based on role
- **Custom permissions** override role defaults
- **Permissions are stored** in the database as an array of strings
- **Permission checks** happen on both frontend and backend


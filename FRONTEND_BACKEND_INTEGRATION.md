# Frontend-Backend Integration Guide

## ✅ Integration Complete!

Frontend ab backend API ke saath fully integrated hai. Sab kuch ready hai!

## What's Been Integrated

### 1. API Client (`src/services/api.ts`)
- Complete API client with axios
- Automatic JWT token management
- Request/Response interceptors
- Error handling
- All endpoints covered:
  - Authentication (login, superadmin login, logout)
  - Products (CRUD)
  - Sales (CRUD, cancel)
  - Expenses (CRUD)
  - Purchases (CRUD)
  - Reports (sales, expenses, profit/loss)
  - Users (CRUD - admin only)
  - Settings (get, update)

### 2. DataContext Updated (`src/context/DataContext.tsx`)
- Replaced localStorage with API calls
- Async functions for all operations
- Loading and error states
- Automatic data refresh
- Token-based authentication

### 3. Login Forms Updated
- `SignInForm.tsx` - Uses async API login
- `SuperAdminSignInForm.tsx` - Uses async API superadmin login
- Loading states added
- Error handling improved

### 4. Components Updated
- `BillPrint.tsx` - Fetches sale from API if not found locally
- `UserDropdown.tsx` - Async logout

## Environment Setup

### Frontend `.env` File

Create `src/.env` file (or update existing):

```env
VITE_API_URL=http://localhost:5000/api
```

**Note:** Vite uses `VITE_` prefix for environment variables.

## How It Works

### Authentication Flow

1. User logs in via `/signin` or `/superadmin`
2. API returns JWT token and user data
3. Token stored in `localStorage` as `authToken`
4. User data stored in `localStorage` as `currentUser`
5. All subsequent API calls include token in `Authorization` header
6. On 401 error, user is automatically logged out

### Data Flow

1. **On Login:**
   - User authenticates
   - Initial data loaded (products, sales, expenses, purchases, settings)

2. **On Operations:**
   - User performs action (add product, create sale, etc.)
   - API call made
   - On success, local state updated
   - Related data refreshed if needed

3. **On Logout:**
   - Token cleared
   - User data cleared
   - All state reset

## API Endpoints Used

### Authentication
- `POST /api/auth/login` - Regular user login
- `POST /api/auth/superadmin/login` - SuperAdmin login
- `POST /api/auth/logout` - Logout

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/inventory/low-stock` - Get low stock products

### Sales
- `GET /api/sales` - Get all sales
- `GET /api/sales/:id` - Get single sale
- `GET /api/sales/bill/:billNumber` - Get sale by bill number
- `POST /api/sales` - Create sale
- `PATCH /api/sales/:id/cancel` - Cancel sale

### Expenses
- `GET /api/expenses` - Get all expenses
- `GET /api/expenses/:id` - Get single expense
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Purchases
- `GET /api/purchases` - Get all purchases
- `POST /api/purchases` - Create purchase

### Reports
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/expenses` - Expenses report
- `GET /api/reports/profit-loss` - Profit/Loss report

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get single user (admin only)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Settings
- `GET /api/settings` - Get shop settings
- `PUT /api/settings` - Update shop settings (admin only)

## Testing the Integration

### 1. Start Backend
```bash
cd backend
npm run dev
```

### 2. Start Frontend
```bash
npm run dev
```

### 3. Test Login
- Go to `http://localhost:5173/signin`
- Login with: `admin` / `admin123`
- Should redirect to dashboard

### 4. Test Operations
- Add a product
- Create a sale
- Add an expense
- Check if data persists (refresh page)

## Troubleshooting

### CORS Error
- Make sure backend CORS_ORIGIN in `.env` matches frontend URL
- Default: `CORS_ORIGIN=http://localhost:5173`

### 401 Unauthorized
- Check if token is being sent
- Check if token is valid
- Try logging in again

### Network Error
- Check if backend is running on port 5000
- Check `VITE_API_URL` in frontend `.env`
- Check browser console for errors

### Data Not Loading
- Check browser Network tab
- Check backend logs
- Verify database connection
- Verify Redis connection

## Next Steps

1. ✅ Backend running
2. ✅ Frontend running
3. ✅ Login working
4. ✅ Data operations working
5. ✅ All features integrated

**Everything is ready!** 🎉

## Notes

- All API calls are async
- Error handling is in place
- Loading states are managed
- Token management is automatic
- Data refresh happens automatically after mutations


# Isma Sports Complex - Backend API

Backend API for Isma Sports Complex Sales & Inventory Management System.

## Tech Stack

- **Node.js** + **Express** - Server framework
- **Prisma ORM** - Database ORM
- **PostgreSQL** - Database
- **Redis** - Caching & session management
- **Winston** - Logging
- **TypeScript** - Type safety

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Update the following in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `JWT_SECRET` - Secret key for JWT tokens
- `CORS_ORIGIN` - Frontend URL (default: http://localhost:5173)

### 3. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database (creates default users)
npm run prisma:seed
```

### 4. Start Redis Server

Make sure Redis is running on your system. If not installed:

**Windows:**
- Download from https://redis.io/download
- Or use WSL: `wsl redis-server`

**Linux/Mac:**
```bash
redis-server
```

### 5. Start Development Server

```bash
npm run dev
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/superadmin/login` - SuperAdmin login
- `POST /api/auth/logout` - Logout

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin/Warehouse Manager)
- `PUT /api/products/:id` - Update product (Admin/Warehouse Manager)
- `DELETE /api/products/:id` - Delete product (Admin/Warehouse Manager)
- `GET /api/products/inventory/low-stock` - Get low stock products

### Sales
- `GET /api/sales` - Get all sales
- `GET /api/sales/:id` - Get single sale
- `GET /api/sales/bill/:billNumber` - Get sale by bill number
- `POST /api/sales` - Create sale (Cashier/Admin)
- `PATCH /api/sales/:id/cancel` - Cancel sale (Admin)

### Expenses
- `GET /api/expenses` - Get all expenses
- `GET /api/expenses/:id` - Get single expense
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Purchases
- `GET /api/purchases` - Get all purchases
- `POST /api/purchases` - Create purchase (Warehouse Manager/Admin)

### Reports
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/expenses` - Expenses report
- `GET /api/reports/profit-loss` - Profit/Loss report

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get single user (Admin only)
- `POST /api/users` - Create user (Admin only)
- `PUT /api/users/:id` - Update user (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)

### Settings
- `GET /api/settings` - Get shop settings
- `PUT /api/settings` - Update shop settings (Admin only)

## Default Users

After seeding:
- **SuperAdmin**: `superadmin` / `superadmin123`
- **Admin**: `admin` / `admin123`

## Logging

Logs are stored in `./logs/` directory:
- `combined-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Error logs only

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Build the project: `npm run build`
3. Start server: `npm start`
4. Make sure PostgreSQL and Redis are running
5. Run migrations: `npm run prisma:migrate deploy`


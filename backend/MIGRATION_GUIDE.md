# Migration Guide: Separate AdminUser and User Tables

## Problem
The database doesn't have the `admin_users` table yet. We need to run a migration to:
1. Create the `admin_users` table
2. Migrate existing superadmin/admin users from `users` table to `admin_users`
3. Update `users` table to only allow cashier/warehouse_manager roles

## Solution

### Option 1: Using Prisma Migrate (Recommended)

When your database is accessible, run:

```bash
cd backend

# Generate Prisma Client first
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name separate_admin_and_user_tables
```

### Option 2: Manual SQL Migration

If Prisma migrate doesn't work, you can run the SQL manually:

1. **Connect to your database** (using pgAdmin, psql, or any PostgreSQL client)

2. **Run the migration SQL file:**
   ```bash
   # Using psql
   psql -h your-host -U your-user -d your-database -f prisma/migrations/manual_separate_admin_user.sql
   
   # Or copy the SQL from prisma/migrations/manual_separate_admin_user.sql
   # and run it in your database client
   ```

3. **After running the SQL, generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

4. **Then run the seed:**
   ```bash
   npx prisma db seed
   ```

### Option 3: Using Vercel/Remote Database

If you're using a remote database (like Vercel/Prisma):

1. **Get database connection string** from your environment variables

2. **Run migration using Prisma:**
   ```bash
   # Set DATABASE_URL
   export DATABASE_URL="your-database-url"
   
   # Or create .env file with DATABASE_URL
   
   # Generate and migrate
   npx prisma generate
   npx prisma migrate deploy
   ```

3. **Or use Prisma Studio to run SQL:**
   ```bash
   npx prisma studio
   # Then go to SQL tab and paste the migration SQL
   ```

## Verification

After migration, verify:

1. **Check admin_users table exists:**
   ```sql
   SELECT * FROM admin_users;
   ```

2. **Check users table only has cashier/warehouse_manager:**
   ```sql
   SELECT * FROM users;
   ```

3. **Run seed to create default admin users:**
   ```bash
   npx prisma db seed
   ```

## Rollback (if needed)

If something goes wrong, you can rollback:

```sql
-- Move admin users back to users table
INSERT INTO "users" ("id", "username", "password", "role", "name", "email", "profilePicture", "createdAt", "updatedAt")
SELECT "id", "username", "password", "role", "name", "email", "profilePicture", "createdAt", "updatedAt"
FROM "admin_users"
ON CONFLICT ("username") DO NOTHING;

-- Drop admin_users table
DROP TABLE IF EXISTS "admin_users";

-- Revert users table role column
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole";
```

## Important Notes

- ⚠️ **Backup your database** before running migration
- ✅ Make sure no users are logged in during migration
- ✅ The migration preserves all existing data
- ✅ Admin/superadmin users will be moved to `admin_users` table
- ✅ Regular users (cashier/warehouse_manager) stay in `users` table







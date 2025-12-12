@echo off
REM Setup .env file for Windows

if not exist .env (
    echo Creating .env file...
    (
        echo # Server Configuration
        echo PORT=5000
        echo NODE_ENV=development
        echo.
        echo # Database Configuration
        echo # IMPORTANT: Update with your PostgreSQL credentials
        echo DATABASE_URL="postgresql://postgres:postgres@localhost:5432/isma_sports_complex?schema=public"
        echo.
        echo # Redis Configuration
        echo REDIS_HOST=localhost
        echo REDIS_PORT=6379
        echo REDIS_PASSWORD=
        echo.
        echo # JWT Configuration
        echo # IMPORTANT: Change this to a strong random string in production!
        echo JWT_SECRET=isma-sports-complex-super-secret-jwt-key-change-this-in-production
        echo JWT_EXPIRE=7d
        echo.
        echo # CORS Configuration
        echo CORS_ORIGIN=http://localhost:5173
        echo.
        echo # Logging
        echo LOG_LEVEL=info
        echo LOG_DIR=./logs
    ) > .env
    echo.
    echo ✅ .env file created successfully!
    echo.
    echo ⚠️  IMPORTANT: Please update the following in .env file:
    echo    1. DATABASE_URL - Update with your PostgreSQL password
    echo    2. JWT_SECRET - Change to a strong random string
    echo.
) else (
    echo ⚠️  .env file already exists. Skipping creation.
    echo    If you want to recreate it, delete .env first and run this script again.
)

pause


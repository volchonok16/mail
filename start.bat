@echo off
echo ========================================
echo   Mail Server alexol.io
echo   Starting all services...
echo ========================================
echo.

docker-compose up -d --build

echo.
echo ========================================
echo   Services started!
echo ========================================
echo.
echo   Frontend: http://localhost:3000
echo   Backend API: http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo   MinIO Console: http://localhost:9001
echo.
echo   Default Admin:
echo   Email: admin@alexol.io
echo   Password: Gord078134Alexol!9256
echo.
echo ========================================
echo.
pause


@echo off
echo ========================================
echo   Mail Server alexol.io
echo   Stopping all services...
echo ========================================
echo.

docker-compose down

echo.
echo ========================================
echo   All services stopped!
echo ========================================
echo.
pause


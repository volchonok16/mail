@echo off
echo ========================================
echo   Пересборка и перезапуск backend
echo ========================================
echo.

docker-compose stop backend
docker-compose build backend --no-cache
docker-compose up -d backend

echo.
echo ========================================
echo   Backend пересобран и запущен!
echo ========================================
echo.
echo Проверьте логи:
echo docker-compose logs -f backend
echo.
pause


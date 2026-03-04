@echo off
echo ========================================
echo   Полная пересборка backend
echo ========================================
echo.

echo Шаг 1: Остановка контейнера...
docker-compose stop backend

echo.
echo Шаг 2: Удаление старого образа...
docker-compose rm -f backend

echo.
echo Шаг 3: Пересборка БЕЗ кеша (это займет 2-3 минуты)...
docker-compose build --no-cache backend

echo.
echo Шаг 4: Запуск нового контейнера...
docker-compose up -d backend

echo.
echo ========================================
echo   Готово! Проверяем логи...
echo ========================================
echo.

timeout /t 3 /nobreak >nul

docker-compose logs --tail=50 backend

echo.
echo ========================================
echo   Пересборка завершена!
echo ========================================
echo.
echo Откройте http://localhost:3000
echo.
pause


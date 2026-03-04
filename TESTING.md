# Руководство по тестированию

## Автоматическое тестирование всех функций

### 1. Подготовка

```bash
# Запустите систему
docker-compose up -d --build

# Дождитесь запуска всех сервисов (~1 минута)
docker-compose ps
```

### 2. Тестирование веб-интерфейса

#### 2.1 Вход администратора
1. Откройте: http://localhost:3000
2. Войдите:
   - Email: `admin@alexol.io`
   - Пароль: `Gord078134Alexol!9256`
3. ✅ Должна открыться админ-панель

#### 2.2 Создание пользователя
1. Нажмите "Создать пользователя"
2. Заполните:
   - ФИО: `Петров Петр Петрович`
   - Логин: `PPetrov`
   - Телефон: `+7 900 111-22-33`
   - Пароль: `Test123456`
3. Нажмите "Создать"
4. ✅ Должен появиться пользователь `PPetrov@alexol.io` в списке

#### 2.3 Создание второго пользователя
1. Повторите шаг 2.2 с данными:
   - ФИО: `Сидоров Сидор Сидорович`
   - Логин: `SSidorov`
   - Телефон: `+7 900 333-44-55`
   - Пароль: `Test123456`
2. ✅ Должен появиться пользователь `SSidorov@alexol.io`

#### 2.4 Выход и вход пользователем
1. Нажмите "Выйти"
2. Войдите как первый пользователь:
   - Email: `PPetrov@alexol.io`
   - Пароль: `Test123456`
3. ✅ Должна открыться страница почты

#### 2.5 Отправка письма
1. Нажмите "Написать письмо"
2. Заполните:
   - Кому: `SSidorov@alexol.io`
   - Тема: `Тестовое письмо`
   - Сообщение: `Привет! Это тестовое письмо.`
3. Нажмите "Отправить"
4. ✅ Письмо должно отправиться
5. Перейдите во вкладку "Отправленные"
6. ✅ Письмо должно появиться в списке

#### 2.6 Получение письма
1. Выйдите и войдите как второй пользователь:
   - Email: `SSidorov@alexol.io`
   - Пароль: `Test123456`
2. Перейдите во вкладку "Входящие"
3. ✅ Должно быть письмо от `PPetrov@alexol.io`
4. Нажмите на письмо
5. ✅ Должен открыться полный текст

#### 2.7 Обновление профиля
1. Нажмите "Профиль"
2. Измените телефон на `+7 900 999-88-77`
3. Нажмите "Сохранить изменения"
4. ✅ Профиль должен обновиться

#### 2.8 Загрузка аватара
1. На странице профиля нажмите "Выбрать фото"
2. Выберите любое изображение
3. Нажмите "Сохранить фото"
4. ✅ Аватар должен загрузиться и отобразиться
5. Вернитесь в почту
6. ✅ Аватар должен отображаться в боковой панели

#### 2.9 Смена пароля
1. Перейдите в "Профиль"
2. Введите:
   - Новый пароль: `NewPass123`
   - Подтвердите пароль: `NewPass123`
3. Нажмите "Сохранить изменения"
4. Выйдите и войдите с новым паролем
5. ✅ Вход должен пройти успешно

#### 2.10 Удаление пользователя (Админ)
1. Войдите как админ
2. Найдите пользователя `PPetrov@alexol.io`
3. Нажмите кнопку удаления (корзина)
4. Подтвердите удаление
5. ✅ Пользователь должен исчезнуть из списка

### 3. Тестирование API

#### 3.1 Проверка здоровья
```bash
curl http://localhost:8000/api/health
```
✅ Ответ: `{"status":"ok"}`

#### 3.2 Вход
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@alexol.io",
    "password": "Gord078134Alexol!9256"
  }'
```
✅ Должен вернуть JWT токен

#### 3.3 Получение профиля
```bash
# Сохраните токен из предыдущего запроса
TOKEN="ваш_токен"

curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```
✅ Должен вернуть данные админа

#### 3.4 Список пользователей
```bash
curl http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer $TOKEN"
```
✅ Должен вернуть массив пользователей

#### 3.5 API документация
Откройте: http://localhost:8000/docs
✅ Должна открыться интерактивная документация Swagger

### 4. Тестирование SMTP

#### 4.1 Проверка SMTP порта
```bash
telnet localhost 25
```
✅ Должно подключиться к SMTP серверу

#### 4.2 Отправка письма через SMTP (Python)
```python
import smtplib
from email.mime.text import MIMEText

msg = MIMEText("Тестовое письмо через SMTP")
msg['Subject'] = 'Тест SMTP'
msg['From'] = 'test@alexol.io'
msg['To'] = 'SSidorov@alexol.io'

with smtplib.SMTP('localhost', 25) as smtp:
    smtp.send_message(msg)
    print("Письмо отправлено!")
```
✅ Письмо должно появиться у получателя

### 5. Тестирование MinIO

#### 5.1 Веб-консоль
1. Откройте: http://localhost:9001
2. Войдите:
   - Username: `minioadmin`
   - Password: `minioadmin`
3. ✅ Должна открыться консоль MinIO
4. Перейдите в bucket `avatars`
5. ✅ Должны быть загруженные аватары

#### 5.2 Прямой доступ к файлам
```bash
# Если загружен аватар PPetrov_*.jpg
curl http://localhost:9000/avatars/PPetrov_[ID].jpg --output test.jpg
```
✅ Файл должен скачаться

### 6. Тестирование PostgreSQL

```bash
# Подключение к БД
docker-compose exec postgres psql -U mailuser -d maildb

# Проверка пользователей
SELECT id, email, full_name, is_admin FROM users;

# Проверка писем
SELECT id, from_address, to_address, subject, is_sent FROM emails;

# Выход
\q
```
✅ Данные должны быть в таблицах

### 7. Нагрузочное тестирование

#### 7.1 Массовое создание пользователей
```bash
# Получите токен админа
TOKEN="ваш_токен"

# Создайте 100 пользователей
for i in {1..100}; do
  curl -X POST http://localhost:8000/api/admin/users \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"full_name\": \"User$i Test\",
      \"username\": \"user$i\",
      \"phone\": \"+7 900 000-00-$i\",
      \"password\": \"Pass123\"
    }"
done
```

#### 7.2 Массовая отправка писем
```bash
# Войдите как пользователь
TOKEN="ваш_токен"

# Отправьте 50 писем
for i in {1..50}; do
  curl -X POST http://localhost:8000/api/emails/send \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"to_address\": \"user1@alexol.io\",
      \"subject\": \"Тест письмо $i\",
      \"body\": \"Это тестовое письмо номер $i\"
    }"
done
```

### 8. Проверка логов

```bash
# Все логи
docker-compose logs

# Backend
docker-compose logs backend

# Поиск ошибок
docker-compose logs | grep -i error

# Следить за логами в реальном времени
docker-compose logs -f backend
```

### 9. Проверка производительности

#### 9.1 Использование ресурсов
```bash
docker stats
```
✅ Проверьте CPU, RAM, Network

#### 9.2 Размер баз данных
```bash
# PostgreSQL
docker-compose exec postgres psql -U mailuser -d maildb -c "
  SELECT 
    pg_size_pretty(pg_database_size('maildb')) as db_size;
"

# MinIO
docker-compose exec minio du -sh /data
```

### 10. Чек-лист полного тестирования

- [ ] Запуск всех контейнеров
- [ ] Вход администратора
- [ ] Создание пользователя
- [ ] Вход пользователя
- [ ] Отправка письма через веб
- [ ] Получение письма через веб
- [ ] Обновление профиля
- [ ] Загрузка аватара
- [ ] Смена пароля
- [ ] Удаление пользователя
- [ ] API Health Check
- [ ] API Login
- [ ] API Documentation (Swagger)
- [ ] SMTP порт доступен
- [ ] Отправка через SMTP
- [ ] MinIO консоль доступна
- [ ] Аватары в MinIO
- [ ] PostgreSQL подключение
- [ ] Данные в таблицах
- [ ] Логи без критических ошибок
- [ ] Нормальное использование ресурсов

## Известные проблемы и решения

### Проблема: Не запускается PostgreSQL
```bash
# Решение
docker-compose down -v
docker-compose up -d postgres
# Подождите 10 секунд
docker-compose up -d
```

### Проблема: MinIO bucket не создается
```bash
# Решение - пересоздать MinIO
docker-compose down
docker volume rm mail_minio_data
docker-compose up -d
```

### Проблема: Frontend не подключается к Backend
```bash
# Проверьте порты
netstat -tulpn | grep -E '3000|8000'

# Проверьте прокси в Vite/Nginx
cat frontend/vite.config.ts
cat frontend/nginx.conf
```

### Проблема: Не отправляются письма
```bash
# Проверьте SMTP сервер
docker-compose logs backend | grep SMTP

# Проверьте порт
telnet localhost 25
```

## Автоматизированные тесты

Для создания автоматических тестов можно использовать:
- **Pytest** для Backend
- **Jest** для Frontend
- **Selenium** для E2E тестов
- **K6** для нагрузочных тестов

## Continuous Testing

Рекомендуется настроить CI/CD с автоматическим тестированием:
- GitHub Actions
- GitLab CI
- Jenkins

Пример `.github/workflows/test.yml` можно создать для автоматического запуска тестов при каждом коммите.


# Структура проекта

```
mail/
│
├── 📄 Документация (Markdown файлы)
│   ├── README.md              - Полное описание проекта
│   ├── QUICKSTART.md          - Быстрый старт (3 минуты)
│   ├── OVERVIEW.md            - Краткий обзор системы
│   ├── SETUP.md               - Настройка Outlook и клиентов
│   ├── TESTING.md             - Руководство по тестированию
│   ├── ARCHITECTURE.md        - Техническая архитектура
│   ├── PRODUCTION.md          - Развертывание в продакшене
│   └── PROJECT_STRUCTURE.md   - Этот файл
│
├── 🚀 Скрипты запуска
│   ├── start.bat              - Запуск на Windows
│   ├── stop.bat               - Остановка на Windows
│   └── docker-compose.yml     - Конфигурация Docker
│
├── 🔧 Backend (Python/FastAPI)
│   └── backend/
│       ├── Dockerfile         - Docker образ backend
│       ├── requirements.txt   - Python зависимости
│       └── app/
│           ├── __init__.py    - Инициализация модуля
│           ├── main.py        - ⭐ Главный файл API
│           ├── config.py      - Конфигурация
│           ├── database.py    - Настройки БД
│           ├── models.py      - Модели SQLAlchemy
│           ├── schemas.py     - Pydantic схемы
│           ├── auth.py        - Аутентификация JWT
│           ├── smtp_server.py - SMTP сервер
│           └── minio_client.py- MinIO клиент
│
└── 🎨 Frontend (React/TypeScript)
    └── frontend/
        ├── Dockerfile         - Docker образ frontend
        ├── nginx.conf         - Nginx конфигурация
        ├── index.html         - HTML шаблон
        ├── package.json       - Node зависимости
        ├── tsconfig.json      - TypeScript конфиг
        ├── tsconfig.node.json - TS конфиг для Vite
        ├── vite.config.ts     - Vite конфигурация
        └── src/
            ├── main.tsx       - ⭐ Точка входа React
            ├── App.tsx        - Главный компонент + роутинг
            ├── index.css      - Глобальные стили
            ├── api/
            │   └── axios.ts   - API клиент
            ├── store/
            │   └── authStore.ts - Zustand store (авторизация)
            └── pages/
                ├── Login.tsx              - Страница входа
                ├── Login.css
                ├── AdminDashboard.tsx     - Админ-панель
                ├── AdminDashboard.css
                ├── UserDashboard.tsx      - Почтовый ящик
                ├── UserDashboard.css
                ├── Profile.tsx            - Профиль пользователя
                └── Profile.css
```

## Описание ключевых файлов

### 📄 Документация

| Файл | Размер | Назначение |
|------|--------|------------|
| `README.md` | 📖 Большой | Полная документация с установкой, настройкой, API |
| `QUICKSTART.md` | 📄 Малый | Быстрый старт за 3 минуты |
| `OVERVIEW.md` | 📋 Средний | Общий обзор системы для новичков |
| `SETUP.md` | 🔧 Средний | Настройка Outlook и других почтовых клиентов |
| `TESTING.md` | 🧪 Большой | Полное руководство по тестированию |
| `ARCHITECTURE.md` | 🏗️ Большой | Техническая архитектура для разработчиков |
| `PRODUCTION.md` | 🚀 Большой | Пошаговое развертывание на сервере |

### 🔧 Backend файлы

#### `backend/app/main.py` (⭐ Главный файл API)
- REST API endpoints
- Startup/shutdown events
- CORS настройки
- Создание дефолтного админа

**Основные endpoints:**
```python
POST   /api/auth/login           # Вход
GET    /api/auth/me              # Текущий пользователь
POST   /api/admin/users          # Создать пользователя (админ)
GET    /api/admin/users          # Список пользователей (админ)
DELETE /api/admin/users/{id}     # Удалить пользователя (админ)
PUT    /api/profile              # Обновить профиль
POST   /api/profile/avatar       # Загрузить аватар
POST   /api/emails/send          # Отправить письмо
GET    /api/emails/inbox         # Входящие
GET    /api/emails/sent          # Отправленные
GET    /api/emails/{id}          # Получить письмо
DELETE /api/emails/{id}          # Удалить письмо
GET    /api/health               # Health check
```

#### `backend/app/smtp_server.py`
- Асинхронный SMTP сервер (aiosmtpd)
- Прием входящих писем
- Сохранение в PostgreSQL

#### `backend/app/auth.py`
- JWT аутентификация
- Хеширование паролей (bcrypt)
- Middleware для проверки токенов
- Разделение прав (admin/user)

#### `backend/app/models.py`
- SQLAlchemy модели:
  - `User` - пользователи
  - `Email` - письма

#### `backend/app/minio_client.py`
- Загрузка файлов в MinIO
- Удаление файлов
- Генерация публичных URL

### 🎨 Frontend файлы

#### `frontend/src/App.tsx` (⭐ Главный компонент)
- React Router настройка
- Защищенные маршруты (ProtectedRoute)
- Перенаправления на основе роли

**Маршруты:**
```typescript
/login      → Login          (публичный)
/admin      → AdminDashboard (только админ)
/dashboard  → UserDashboard  (авторизованные)
/profile    → Profile        (авторизованные)
/           → редирект на /dashboard или /login
```

#### `frontend/src/pages/Login.tsx`
- Форма входа
- Валидация email/password
- Получение JWT токена
- Сохранение в localStorage

#### `frontend/src/pages/AdminDashboard.tsx`
- Список пользователей (таблица)
- Форма создания пользователя (модальное окно)
- Удаление пользователей
- Автоматическая генерация email

#### `frontend/src/pages/UserDashboard.tsx`
- Список писем (Входящие/Отправленные)
- Форма написания письма
- Просмотр письма (модальное окно)
- Удаление писем
- Авто-обновление каждые 30 секунд

#### `frontend/src/pages/Profile.tsx`
- Редактирование профиля (ФИО, телефон)
- Смена пароля
- Загрузка аватара с превью
- Интеграция с MinIO

#### `frontend/src/store/authStore.ts`
- Zustand store для авторизации
- Сохранение токена и пользователя
- Persist в localStorage
- Глобальное состояние auth

#### `frontend/src/api/axios.ts`
- Настроенный axios клиент
- Автоматическое добавление JWT токена
- Обработка 401 ошибок (logout)
- Base URL для API

### 🐳 Docker файлы

#### `docker-compose.yml`
Запускает 4 сервиса:
1. **postgres** - PostgreSQL база данных
2. **minio** - Хранилище файлов
3. **backend** - FastAPI сервер
4. **frontend** - React приложение (Nginx)

#### `backend/Dockerfile`
```dockerfile
FROM python:3.11-slim
- Устанавливает Python зависимости
- Копирует код
- Expose порты: 8000, 25, 587, 143
- CMD: uvicorn app.main:app
```

#### `frontend/Dockerfile`
```dockerfile
Multi-stage build:
1. Build stage (node:20-alpine)
   - npm install
   - npm run build
2. Production stage (nginx:alpine)
   - Копирует build в nginx
   - Expose порт: 80
```

### 🚀 Скрипты

#### `start.bat` (Windows)
```batch
- Запускает docker-compose up -d --build
- Выводит информацию о портах
- Показывает дефолтные логины
```

#### `stop.bat` (Windows)
```batch
- Останавливает все контейнеры
- docker-compose down
```

## Размер файлов

### Backend
```
app/main.py         ~15 KB  (основной API)
app/smtp_server.py  ~5 KB   (SMTP сервер)
app/auth.py         ~4 KB   (авторизация)
app/models.py       ~2 KB   (модели БД)
app/schemas.py      ~3 KB   (Pydantic схемы)
app/config.py       ~2 KB   (конфигурация)
app/minio_client.py ~3 KB   (MinIO клиент)
requirements.txt    ~1 KB   (зависимости)
```

### Frontend
```
pages/AdminDashboard.tsx    ~10 KB
pages/UserDashboard.tsx     ~12 KB
pages/Profile.tsx           ~8 KB
pages/Login.tsx             ~4 KB
App.tsx                     ~2 KB
store/authStore.ts          ~1 KB
api/axios.ts                ~1 KB

CSS файлы (по ~3-5 KB каждый)
```

### Документация
```
README.md           ~12 KB
ARCHITECTURE.md     ~15 KB
PRODUCTION.md       ~20 KB
TESTING.md          ~18 KB
SETUP.md            ~8 KB
QUICKSTART.md       ~2 KB
OVERVIEW.md         ~10 KB
```

## Зависимости

### Backend (Python)
```
fastapi         - Веб-фреймворк
uvicorn         - ASGI сервер
sqlalchemy      - ORM
asyncpg         - PostgreSQL драйвер
aiosmtpd        - SMTP сервер
python-jose     - JWT токены
passlib         - Хеширование паролей
minio           - MinIO клиент
pydantic        - Валидация данных
```

### Frontend (Node)
```
react           - UI библиотека
typescript      - Типизация
vite            - Сборщик
react-router    - Маршрутизация
axios           - HTTP клиент
zustand         - State management
@tanstack/react-query - Server state
lucide-react    - Иконки
```

## Общая статистика проекта

```
📊 Строки кода (приблизительно):
   Backend:   ~800 строк Python
   Frontend:  ~1500 строк TypeScript/TSX
   CSS:       ~800 строк
   Docs:      ~2000 строк Markdown
   
📁 Файлов:   ~35 файлов
📦 Размер:   ~50 MB (с node_modules)
🐳 Docker:   4 контейнера
💾 Volumes:  2 (postgres_data, minio_data)
🌐 Порты:    8 (3000, 8000, 25, 587, 143, 5432, 9000, 9001)
```

## Как ориентироваться в проекте

### Если вы новичок:
1. Начните с `QUICKSTART.md` - запустите проект
2. Прочитайте `OVERVIEW.md` - поймете общую картину
3. Используйте `README.md` - как справочник

### Если вы пользователь:
1. `QUICKSTART.md` - запуск
2. `SETUP.md` - настройка Outlook
3. Используйте веб-интерфейс

### Если вы разработчик:
1. `ARCHITECTURE.md` - архитектура
2. Изучите `backend/app/main.py` - REST API
3. Изучите `frontend/src/App.tsx` - роутинг
4. Изучите `frontend/src/pages/*` - UI компоненты
5. `TESTING.md` - как тестировать

### Если вы DevOps:
1. `PRODUCTION.md` - развертывание
2. `docker-compose.yml` - инфраструктура
3. `backend/Dockerfile` и `frontend/Dockerfile`
4. `TESTING.md` (раздел мониторинга)

## Горячие точки для модификации

### Хотите изменить домен?
```
1. backend/app/config.py → MAIL_DOMAIN
2. docker-compose.yml → environment MAIL_DOMAIN
3. Все документация (поиск и замена alexol.io)
```

### Хотите добавить новую страницу?
```
1. Создайте frontend/src/pages/MyPage.tsx
2. Добавьте роут в frontend/src/App.tsx
3. Добавьте навигацию в существующие страницы
```

### Хотите добавить API endpoint?
```
1. Добавьте endpoint в backend/app/main.py
2. (Опционально) Добавьте схему в schemas.py
3. (Опционально) Обновите модель в models.py
```

### Хотите изменить UI?
```
1. Страницы: frontend/src/pages/*.tsx
2. Стили: frontend/src/pages/*.css
3. Глобальные стили: frontend/src/index.css
```

## Полезные команды

### Поиск по проекту
```bash
# Найти все TODO
grep -r "TODO" backend/ frontend/

# Найти использование функции
grep -r "create_access_token" backend/

# Найти все API endpoints
grep -r "@app\." backend/app/main.py
```

### Статистика кода
```bash
# Подсчет строк
find backend -name "*.py" | xargs wc -l
find frontend/src -name "*.tsx" -o -name "*.ts" | xargs wc -l

# Количество файлов
find . -type f | wc -l
```

## Архивирование проекта

```bash
# Создать backup без node_modules
tar -czf mail-backup.tar.gz \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.git' \
  mail/
```

---

**Навигация по документации:**
- [Главная](README.md)
- [Быстрый старт](QUICKSTART.md)
- [Обзор](OVERVIEW.md)
- [Настройка](SETUP.md)
- [Тестирование](TESTING.md)
- [Архитектура](ARCHITECTURE.md)
- [Продакшен](PRODUCTION.md)
- [Структура проекта](PROJECT_STRUCTURE.md) ← Вы здесь


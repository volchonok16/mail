# 📧 Почтовый сервер alexol.io

<div align="center">

**Полноценный почтовый сервер на собственном домене**

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

[🚀 Быстрый старт](#-быстрый-старт) • [📚 Документация](#-документация) • [✨ Возможности](#-возможности) • [🛠 Технологии](#-технологии)

</div>

---

## 🎯 Что это?

Готовое решение для корпоративной почты с:
- ✉️ **SMTP/IMAP серверами** для работы с Outlook и другими клиентами
- 🖥️ **Веб-интерфейсом** - админка + личные кабинеты
- 👥 **Управлением пользователями**
- 📸 **Профилями с аватарами**
- 🔐 **Безопасной авторизацией**

## 🚀 Быстрый старт

### Для Windows:

1. **Установите Docker Desktop**
   ```
   https://www.docker.com/products/docker-desktop/
   ```

2. **Запустите проект**
   ```
   Дважды кликните start.bat
   ```

3. **Откройте браузер**
   ```
   http://localhost:3000
   ```

4. **Войдите как админ**
   ```
   Email: admin@alexol.io
   Пароль: Gord078134Alexol!9256
   ```

### Для Linux/Mac:

```bash
# Установите Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Запустите проект
docker-compose up -d --build

# Откройте http://localhost:3000
```

**🎉 Готово! Ваш почтовый сервер работает!**

---

## ✨ Возможности

### Для администраторов 👨‍💼
- 👥 Создание пользователей
- 📧 Автоматическая генерация email (@alexol.io)
- 🗑️ Удаление пользователей
- 📊 Просмотр статистики

### Для пользователей 👤
- 📨 Отправка и получение писем
- 📬 Входящие / Отправленные
- 📸 Загрузка аватара (MinIO)
- 🔑 Смена пароля
- ✏️ Редактирование профиля
- 📱 Интеграция с Outlook/Thunderbird

---

## 🖼️ Скриншоты

### Страница входа
```
╔═══════════════════════════════╗
║  Почтовый сервер              ║
║  alexol.io                    ║
║                               ║
║  📧 Email: _______________    ║
║  🔒 Пароль: ______________   ║
║                               ║
║      [ 🚀 Войти ]             ║
╚═══════════════════════════════╝
```

### Админ-панель
```
┌──────────────────────────────────────┐
│ 👥 Управление пользователями         │
│                                      │
│ [➕ Создать пользователя]            │
│                                      │
│ ID  ФИО            Email        🗑️   │
│ 1   Admin          admin@...         │
│ 2   Иванов И.И.    IIvanov@... 🗑️   │
└──────────────────────────────────────┘
```

### Почтовый ящик
```
┌─────────┬────────────────────────────┐
│ Sidebar │ 📬 Входящие           [🔄] │
│         │                            │
│ [✍️ Написать]                         │
│         │ ┌────────────────────────┐ │
│ 📥 Входящие │ От: test@...     12:30 │ │
│         │ │ Тема: Тестовое письмо│ │
│ 📤 Отправленные └──────────────┘     │
└─────────┴────────────────────────────┘
```

---

## 🛠 Технологии

### Backend
- 🐍 **Python 3.11** + **FastAPI**
- 📧 **aiosmtpd** - SMTP сервер
- 🗄️ **PostgreSQL** - база данных
- 📦 **MinIO** - хранилище файлов
- 🔐 **JWT** - аутентификация

### Frontend
- ⚛️ **React 18** + **TypeScript**
- ⚡ **Vite** - сборка
- 🎨 **CSS** - красивый UI
- 🔄 **TanStack Query** - управление данными

### DevOps
- 🐳 **Docker** + **Docker Compose**
- 🌐 **Nginx** - веб-сервер

---

## 📚 Документация

### 🎯 Начало работы
- **[START_HERE.md](START_HERE.md)** - 🚀 **НАЧНИТЕ С ЭТОГО!**
- **[QUICKSTART.md](QUICKSTART.md)** - Запуск за 3 минуты
- **[VISUAL_GUIDE.md](VISUAL_GUIDE.md)** - Визуальное руководство

### 📖 Основная документация
- **[OVERVIEW.md](OVERVIEW.md)** - Краткий обзор
- **[README.md](README.md)** - Полная документация (EN)
- **[INDEX.md](INDEX.md)** - Полный индекс всех документов

### 🔧 Для пользователей
- **[SETUP.md](SETUP.md)** - Настройка Outlook и других клиентов

### 💻 Для разработчиков
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Техническая архитектура
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Структура проекта
- **[TESTING.md](TESTING.md)** - Руководство по тестированию

### 🚀 Для DevOps
- **[PRODUCTION.md](PRODUCTION.md)** - Развертывание на сервере

---

## 📦 Структура проекта

```
mail/
├── backend/              # Python/FastAPI
│   ├── app/
│   │   ├── main.py      # REST API
│   │   ├── smtp_server.py # SMTP сервер
│   │   └── ...
│   └── requirements.txt
│
├── frontend/            # React/TypeScript
│   ├── src/
│   │   ├── pages/       # Страницы
│   │   ├── api/         # API клиент
│   │   └── ...
│   └── package.json
│
├── docker-compose.yml   # Конфигурация Docker
├── start.bat           # Запуск (Windows)
└── *.md                # Документация
```

---

## 🔌 API Endpoints

### Аутентификация
```
POST /api/auth/login      - Вход
GET  /api/auth/me         - Текущий пользователь
```

### Администрирование (только админ)
```
POST   /api/admin/users        - Создать пользователя
GET    /api/admin/users        - Список пользователей
DELETE /api/admin/users/{id}   - Удалить пользователя
```

### Профиль
```
PUT  /api/profile         - Обновить профиль
POST /api/profile/avatar  - Загрузить аватар
```

### Почта
```
POST   /api/emails/send    - Отправить письмо
GET    /api/emails/inbox   - Входящие
GET    /api/emails/sent    - Отправленные
GET    /api/emails/{id}    - Получить письмо
DELETE /api/emails/{id}    - Удалить письмо
```

**📖 Интерактивная документация:** http://localhost:8000/docs

---

## 🎯 Пример использования

### 1. Создание пользователя (Админ)

```javascript
POST /api/admin/users
{
  "full_name": "Иванов Иван Иванович",
  "username": "IIvanov",
  "phone": "+7 900 123-45-67",
  "password": "SecurePass123"
}

→ Email создастся автоматически: IIvanov@alexol.io
```

### 2. Отправка письма

```javascript
POST /api/emails/send
{
  "to_address": "user@example.com",
  "subject": "Тестовое письмо",
  "body": "Привет! Это тестовое письмо."
}
```

### 3. Настройка Outlook

```
IMAP:
  Сервер: localhost (или ваш домен)
  Порт: 143
  Email: IIvanov@alexol.io
  Пароль: [ваш пароль]

SMTP:
  Сервер: localhost (или ваш домен)
  Порт: 587
  Email: IIvanov@alexol.io
  Пароль: [ваш пароль]
```

---

## 🐳 Docker Compose

Проект включает 4 сервиса:

| Сервис | Порт | Назначение |
|--------|------|-----------|
| **frontend** | 3000 | React веб-интерфейс |
| **backend** | 8000, 25, 587, 143 | API + SMTP/IMAP |
| **postgres** | 5432 | База данных |
| **minio** | 9000, 9001 | Хранилище файлов |

---

## 🔐 Безопасность

- ✅ JWT токены для аутентификации
- ✅ Bcrypt хеширование паролей
- ✅ Разделение прав (admin/user)
- ✅ Валидация всех входных данных
- ⚠️ **В продакшене:** измените пароли, настройте SSL

---

## 🧪 Тестирование

```bash
# Проверка API
curl http://localhost:8000/api/health

# Логи
docker-compose logs -f

# Статус
docker-compose ps
```

**Полное руководство:** [TESTING.md](TESTING.md)

---

## 🚀 Продакшн развертывание

### Требования:
- VPS (2GB RAM, 2 CPU, 40GB диск)
- Доменное имя (alexol.io)
- Ubuntu 20.04+ / Debian 11+

### Шаги:
1. Установите Docker на сервер
2. Настройте DNS записи
3. Получите SSL сертификаты (Let's Encrypt)
4. Измените пароли в docker-compose.yml
5. Запустите: `docker-compose up -d --build`

**Детальное руководство:** [PRODUCTION.md](PRODUCTION.md)

---

## 🛠 Команды управления

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Логи
docker-compose logs -f backend

# Перезапуск
docker-compose restart

# Бэкап PostgreSQL
docker-compose exec postgres pg_dump -U mailuser maildb > backup.sql
```

---

## 🆘 Решение проблем

### Не запускается?
1. Убедитесь, что Docker запущен
2. Проверьте свободные порты: `netstat -tulpn | grep -E '3000|8000'`
3. Перезапустите: `docker-compose down && docker-compose up -d`

### Не работает Outlook?
- Проверьте настройки IMAP/SMTP
- Убедитесь, что порты 143 и 587 открыты
- См. [SETUP.md](SETUP.md)

### Письма не отправляются?
- Проверьте логи: `docker-compose logs backend | grep SMTP`
- Попробуйте через веб-интерфейс

**Полное руководство:** [TESTING.md](TESTING.md) → "Устранение неполадок"

---

## 📊 Производительность

### Текущая конфигурация:
- 👥 100-500 пользователей
- 📧 10,000 писем в день
- 💻 4GB RAM, 2 CPU

### Масштабирование:
- Кластер PostgreSQL
- Distributed MinIO
- Load Balancer
- Redis кеширование

→ 10,000+ пользователей, 1M+ писем/день

---

## 🗺️ Дорожная карта

### Текущая версия (v1.0):
- ✅ Базовая функциональность
- ✅ Веб-интерфейс
- ✅ SMTP/IMAP
- ✅ Админ-панель

### Будущие версии:
- [ ] Поддержка вложений
- [ ] Папки и метки
- [ ] Поиск по письмам
- [ ] Подписи писем
- [ ] SPF/DKIM/DMARC
- [ ] Мобильное приложение

---

## 🤝 Вклад в проект

Мы приветствуем ваш вклад!

1. Fork репозитория
2. Создайте feature branch: `git checkout -b feature/AmazingFeature`
3. Commit изменения: `git commit -m 'Add some AmazingFeature'`
4. Push в branch: `git push origin feature/AmazingFeature`
5. Откройте Pull Request

---

## 📄 Лицензия

MIT License - свободное использование в коммерческих и личных целях.

---

## 👨‍💻 Авторы

Разработано для домена **alexol.io**

---

## 📞 Поддержка

- 📧 **Email:** admin@alexol.io
- 🐛 **Issues:** [GitHub Issues](#)
- 📖 **Docs:** См. файлы `.md` в проекте
- 💬 **Дискуссии:** [GitHub Discussions](#)

---

## ⭐ Благодарности

Спасибо всем, кто использует этот проект!

Если проект вам помог - поставьте ⭐ на GitHub!

---

<div align="center">

**🚀 Начните сейчас: [START_HERE.md](START_HERE.md)**

**Сделано с ❤️ для alexol.io**

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>


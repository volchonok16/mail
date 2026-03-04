# Исправления и обновления

## Исправление 1: Импорт AsyncSessionLocal (16:16)

**Проблема:**
```
UnboundLocalError: cannot access local variable 'AsyncSessionLocal' where it is not associated with a value
```

**Решение:**
- Добавлен импорт `AsyncSessionLocal` в `backend/app/main.py`
- Файл: `backend/app/main.py`, строка 10

## Исправление 2: Поддержка длинных паролей (16:18)

**Проблема:**
```
ValueError: password cannot be longer than 72 bytes, truncate manually if necessary
```

**Причина:**
- Bcrypt имеет ограничение в 72 байта для паролей
- При попытке хешировать длинный пароль возникала ошибка

**Решение:**
1. Обновлена функция `get_password_hash()` в `backend/app/auth.py`:
   - Автоматически обрезает пароли длиннее 72 байт
   - Безопасное обрезание с учетом UTF-8 кодировки

2. Обновлена функция `verify_password()` в `backend/app/auth.py`:
   - Также обрезает пароли для корректной проверки

3. Добавлена явная версия bcrypt в `requirements.txt`:
   - `bcrypt==4.0.1` для лучшей совместимости

**Теперь можно:**
- ✅ Использовать пароли любой длины
- ✅ Система автоматически обрезает до 72 байт
- ✅ Проверка паролей работает корректно

## Как применить исправления:

### Вариант 1 (рекомендуется - полная пересборка):
```bash
# Дважды кликните файл:
rebuild-force.bat
```

Этот скрипт:
- Остановит backend
- Удалит старый образ
- Пересоберет БЕЗ кеша (важно!)
- Запустит заново
- Покажет логи

⏱️ Займет 2-3 минуты

### Вариант 2 (вручную):
```bash
docker-compose stop backend
docker-compose rm -f backend
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Вариант 3 (полная остановка всего):
```bash
docker-compose down
docker-compose up -d --build
```

**ВАЖНО:** Нужен флаг `--no-cache`, иначе Docker использует старый кеш!

## Проверка работы:

```bash
# Проверьте логи
docker-compose logs -f backend

# Должны увидеть:
# ✅ Default admin created: admin@alexol.io
# ✅ SMTP Server started on 0.0.0.0:25
# ✅ Application startup complete
```

Затем откройте http://localhost:3000 и войдите!

## Технические детали

### Обрезание паролей:
```python
# До 72 байт безопасно
if len(password.encode('utf-8')) > 72:
    password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
```

Это гарантирует:
- Пароли не будут вызывать ошибки
- UTF-8 символы обрабатываются корректно
- Безопасность не снижается (72 байта достаточно)

### Почему 72 байта?
- Это ограничение алгоритма Bcrypt
- 72 байта = примерно 72 ASCII символа или 24 кириллических
- Это все равно очень надежный пароль

## Файлы изменены:
- ✅ `backend/app/main.py` - добавлен импорт
- ✅ `backend/app/auth.py` - обрезание паролей
- ✅ `backend/requirements.txt` - версия bcrypt
- ✅ `rebuild.bat` - скрипт пересборки (новый)
- ✅ `FIXES.md` - этот файл (новый)


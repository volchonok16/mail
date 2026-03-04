# 🚀 Запуск с обновлёнными портами

## ✅ Что изменилось:

### Почтовые порты (СТАНДАРТНЫЕ):
```
25   → SMTP приём (было 17025)
587  → SMTP Submission (было 17587)
143  → IMAP (было 17143)
```

### Веб-интерфейс:
```
8080 → Frontend (было 17080)
```

### Внутренние сервисы (остались нестандартными):
```
17000 → Backend API (проксируется через nginx)
17432 → PostgreSQL (только внутри Docker сети)
17900 → MinIO API (только внутри Docker сети)
17901 → MinIO Console (внутренний доступ)
```

---

## 📋 Шаг 1: Настройте фаервол (на сервере)

### Базовая защита + открытие портов:

```bash
# Сбросим правила (опционально)
sudo ufw --force reset

# Политика по умолчанию
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Почтовые порты (ОБЯЗАТЕЛЬНО)
sudo ufw allow 25/tcp     # SMTP приём писем
sudo ufw allow 587/tcp    # SMTP отправка через клиенты
sudo ufw allow 143/tcp    # IMAP чтение писем

# Веб-интерфейс
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS (когда настроите SSL)
sudo ufw allow 8080/tcp   # Frontend (если нет nginx на хосте)

# SSH (ВАЖНО! Сначала разрешите, потом включайте ufw!)
sudo ufw allow 22/tcp
# Или только с вашего IP (безопаснее):
# sudo ufw allow from ВАШ_IP to any port 22

# Включаем фаервол
sudo ufw enable

# Проверяем
sudo ufw status verbose
```

---

## 📋 Шаг 2: Установите Fail2ban (защита от атак)

```bash
# Установка
sudo apt update
sudo apt install fail2ban -y

# Создаём конфигурацию для SMTP
sudo nano /etc/fail2ban/jail.local
```

Вставьте:

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22

[postfix]
enabled = true
port = 25,587
filter = postfix
logpath = /var/log/mail.log
maxretry = 5
```

Сохраните и запустите:

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo systemctl status fail2ban
```

---

## 📋 Шаг 3: Обновите nginx на хосте (если есть)

Если у вас nginx на сервере (не в Docker):

```bash
sudo nano /etc/nginx/sites-available/mail.alexol.io
```

Обновите порты:

```nginx
server {
    listen 80;
    server_name mail.alexol.io;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy
    location /api {
        proxy_pass http://localhost:17000;  # Порт API не изменился
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:8080;  # ИЗМЕНИЛОСЬ! Было 17080
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

Перезагрузите nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📋 Шаг 4: Перезапустите Docker контейнеры

```bash
# Остановите старые контейнеры
docker-compose down

# Запустите с новыми портами
docker-compose up -d

# Проверьте статус
docker-compose ps
```

Вы должны увидеть:

```
mail_backend    ... Up ... 0.0.0.0:25->25/tcp, 0.0.0.0:143->143/tcp, 0.0.0.0:587->587/tcp, 0.0.0.0:17000->8000/tcp
mail_frontend   ... Up ... 0.0.0.0:8080->80/tcp
```

---

## 📋 Шаг 5: Проверьте порты

```bash
# Проверьте, что порты открыты
sudo netstat -tulpn | grep -E ':(25|587|143|8080|17000) '

# Ожидаемый результат:
tcp  0.0.0.0:25     0.0.0.0:*  LISTEN  (docker-proxy)
tcp  0.0.0.0:587    0.0.0.0:*  LISTEN  (docker-proxy)
tcp  0.0.0.0:143    0.0.0.0:*  LISTEN  (docker-proxy)
tcp  0.0.0.0:8080   0.0.0.0:*  LISTEN  (docker-proxy)
tcp  0.0.0.0:17000  0.0.0.0:*  LISTEN  (docker-proxy)
```

### Проверка извне (с другого компьютера):

```bash
# Проверка порта 25
telnet mail.alexol.io 25
# Должно подключиться и показать: 220 ... ESMTP

# Проверка веб-интерфейса
curl -I http://mail.alexol.io:8080
# Или откройте в браузере
```

---

## 📋 Шаг 6: Настройте DNS на REG.RU

### Обязательные записи:

#### 1. A запись (для сервера):
```
Тип: A
Имя: mail
Значение: ВАШ_IP_АДРЕС_СЕРВЕРА
TTL: 3600
```

#### 2. MX запись (для приёма почты):
```
Тип: MX
Имя: @ (или alexol.io)
Приоритет: 10
Значение: mail.alexol.io
TTL: 3600
```

#### 3. SPF запись (против спама):
```
Тип: TXT
Имя: @ (или alexol.io)
Значение: v=spf1 ip4:ВАШ_IP_АДРЕС -all
TTL: 3600
```

#### 4. DMARC запись:
```
Тип: TXT
Имя: _dmarc
Значение: v=DMARC1;p=quarantine;rua=mailto:dmarc@alexol.io
TTL: 3600
```

**⏰ Распространение DNS занимает 1-4 часа**

---

## 📋 Шаг 7: Проверьте работу

### Тест 1: Веб-интерфейс

```
Откройте в браузере:
http://mail.alexol.io (если nginx на хосте)
или
http://mail.alexol.io:8080 (прямой доступ)

Войдите:
Email: admin@alexol.io
Пароль: Gord078134Alexol!9256
```

### Тест 2: Проверка DNS (через 1-2 часа)

```bash
# MX запись
dig alexol.io MX +short
# Должно показать: 10 mail.alexol.io.

# A запись
dig mail.alexol.io +short
# Должно показать: ВАШ_IP

# SPF запись
dig alexol.io TXT +short
# Должно показать: "v=spf1 ..."
```

### Тест 3: Отправка письма с Gmail

1. Войдите в систему как admin@alexol.io
2. Отправьте письмо на ваш Gmail
3. Проверьте, что письмо пришло (может быть в спаме первое время)

### Тест 4: Получение письма от Gmail

1. Отправьте письмо со своего Gmail на admin@alexol.io
2. Проверьте inbox в системе
3. Письмо должно прийти!

---

## 🔧 Проверка логов

Если что-то не работает:

```bash
# Логи backend (SMTP сервер)
docker-compose logs -f backend

# Логи всех контейнеров
docker-compose logs -f

# Логи фаервола
sudo tail -f /var/log/ufw.log

# Логи Fail2ban
sudo tail -f /var/log/fail2ban.log
```

---

## ✅ Чеклист готовности

- [ ] Фаервол настроен (порты 25, 587, 143, 80 открыты)
- [ ] Fail2ban установлен и запущен
- [ ] Nginx обновлён (если есть на хосте)
- [ ] Docker контейнеры перезапущены
- [ ] Порты проверены (netstat/telnet)
- [ ] DNS записи добавлены на REG.RU (MX, A, SPF, DMARC)
- [ ] Веб-интерфейс открывается
- [ ] Тестовое письмо на Gmail отправлено
- [ ] Тестовое письмо от Gmail получено

---

## 🎯 Карта сервисов

### Внешние адреса (доступны из интернета):

```
http://mail.alexol.io          → Веб-интерфейс (через nginx)
http://mail.alexol.io:8080     → Веб-интерфейс (прямой)

mail.alexol.io:25              → SMTP приём (для всех почтовых серверов)
mail.alexol.io:587             → SMTP отправка (для Outlook/Thunderbird)
mail.alexol.io:143             → IMAP (для Outlook/Thunderbird)
```

### Внутренние (только с сервера):

```
localhost:17000                → Backend API
localhost:17432                → PostgreSQL
localhost:17900                → MinIO API
localhost:17901                → MinIO Console
```

---

## 🆘 Частые проблемы

### Проблема: "Connection refused" на порту 25

**Причина:** Фаервол закрыт или хостер блокирует порт

**Решение:**
```bash
sudo ufw allow 25/tcp
# Или обратитесь к хостеру
```

### Проблема: Nginx "502 Bad Gateway"

**Причина:** Порт 8080 в nginx не обновлён

**Решение:**
```bash
sudo nano /etc/nginx/sites-available/mail.alexol.io
# Измените 17080 на 8080
sudo systemctl reload nginx
```

### Проблема: Письма не приходят

**Причина:** DNS не обновились или MX запись неправильная

**Решение:**
```bash
# Проверьте MX
dig alexol.io MX +short
# Подождите 1-4 часа
```

### Проблема: Порт 25 занят

**Причина:** На сервере уже работает другой SMTP (postfix, sendmail)

**Решение:**
```bash
# Остановите старый SMTP
sudo systemctl stop postfix
sudo systemctl disable postfix
```

---

**Готово! После выполнения всех шагов ваш почтовый сервер будет работать! 🎉**


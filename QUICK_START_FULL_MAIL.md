# ⚡ Быстрый старт - Отправка на любые домены

## 🎯 Что изменилось

Теперь ваш почтовый сервер может:
- ✅ Отправлять письма на **ЛЮБЫЕ домены** (@gmail.com, @yahoo.com, @mail.ru)
- ✅ Получать письма со **ВСЕХ доменов**
- ✅ Работать как настоящий почтовый сервер

---

## 🚀 Вариант 1: Быстрый запуск (SMTP Relay - 5 минут)

**Рекомендуется для начала!** Работает сразу, без сложной настройки DNS.

### Шаг 1: Зарегистрируйтесь на SendGrid
1. https://sendgrid.com/ → Sign Up (бесплатно)
2. Settings → API Keys → Create API Key
3. Скопируйте ключ (например: `SG.abc123...`)

### Шаг 2: Обновите docker-compose.yml

```yaml
environment:
  SMTP_RELAY_ENABLED: "true"
  SMTP_RELAY_HOST: smtp.sendgrid.net
  SMTP_RELAY_PORT: 587
  SMTP_RELAY_USER: apikey
  SMTP_RELAY_PASSWORD: SG.ваш_api_ключ_здесь
  SMTP_RELAY_USE_TLS: "true"
```

### Шаг 3: Перезапустите

```bash
docker-compose build backend
docker-compose up -d
```

### Шаг 4: Тестируйте!

Отправьте письмо с `support@alexol.io` на ваш Gmail - **дойдёт!** ✅

---

## 🏗️ Вариант 2: Полноценный сервер (требует настройки)

Для самостоятельной отправки нужны:
1. ✅ DNS записи (MX, SPF, DKIM, DMARC)
2. ✅ Reverse DNS (PTR) 
3. ✅ Открытый порт 25
4. ✅ Прогрев IP (2-4 недели)

**Подробная инструкция:** `FULL_MAIL_SERVER_SETUP.md`

### Минимальная настройка DNS:

```bash
# MX запись (для получения писем)
alexol.io.    MX    10    mail.alexol.io.

# A запись
mail.alexol.io.    A    ВАШ_IP

# SPF запись (для отправки)
alexol.io.    TXT    "v=spf1 ip4:ВАШ_IP -all"

# DMARC запись
_dmarc.alexol.io.    TXT    "v=DMARC1;p=quarantine;rua=mailto:dmarc@alexol.io"
```

### Перезапуск без SMTP Relay:

```yaml
environment:
  SMTP_RELAY_ENABLED: "false"  # Прямая отправка
```

```bash
docker-compose build backend
docker-compose up -d
```

---

## 🧪 Как работает отправка

### Внешние домены (@gmail.com):
1. Система ищет MX записи домена получателя
2. Подключается к почтовому серверу Gmail
3. Отправляет письмо напрямую

**ИЛИ (если включен SMTP Relay):**
1. Отправляет через SendGrid/Mailgun
2. Они доставляют с хорошей репутацией

### Внутренние домены (@alexol.io):
1. Сохраняется в локальную базу
2. Получатель видит в inbox

---

## 📊 Что нового в коде

### backend/app/main.py
- ✅ Автоматический DNS MX lookup для внешних доменов
- ✅ Прямая отправка на почтовые серверы получателя
- ✅ Fallback на SMTP Relay (если настроен)
- ✅ Обработка ошибок доставки

### backend/requirements.txt
- ✅ Добавлена библиотека `dnspython` для DNS lookups

### backend/app/config.py
- ✅ Настройки SMTP Relay (host, port, credentials)

---

## ⚡ Рекомендации

### Для production:
**Используйте SMTP Relay** - надёжно, быстро, без головной боли

### Для testing:
**SMTP Relay** или только внутренние письма

### Для экспериментов:
Настройте полноценный сервер по инструкции `FULL_MAIL_SERVER_SETUP.md`

---

## 📧 Провайдеры SMTP Relay

| Провайдер | Бесплатно | Цена |
|-----------|-----------|------|
| SendGrid | 100/день | От $19.95/мес |
| Mailgun | 5000/месяц | $35 за 50k |
| AWS SES | 62k/месяц* | $0.10 за 1000 |
| Mailjet | 200/день | От €9.65/мес |

*Если отправка с EC2

---

## 🆘 Проблемы?

### Ошибка: "No MX records found"
→ Домен получателя не существует или нет MX записей

### Ошибка: "Connection refused (port 25)"
→ Порт 25 заблокирован хостером → используйте SMTP Relay

### Письма в спам
→ Настройте DNS записи (SPF, DKIM, DMARC) или используйте SMTP Relay

### "SMTP Relay not configured"
→ Включите в docker-compose.yml или настройте DNS для прямой отправки

---

## ✅ Чек-лист

- [ ] Код обновлён (backend/app/main.py, requirements.txt)
- [ ] docker-compose.yml настроен (SMTP_RELAY_* переменные)
- [ ] Контейнер пересобран (`docker-compose build backend`)
- [ ] Контейнеры запущены (`docker-compose up -d`)
- [ ] Отправлено тестовое письмо на Gmail
- [ ] Письмо пришло в inbox (не спам)

---

**Готово! Теперь ваш сервер отправляет и получает письма со всех доменов! 🎉**


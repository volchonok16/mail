# 📧 Настройка отправки на внешние адреса (Gmail, Yahoo и т.д.)

## Проблема

Ваш SMTP сервер работает **локально** и может принимать письма для домена `@alexol.io`, но **НЕ МОЖЕТ** отправлять на внешние адреса типа `@gmail.com`, `@yahoo.com` и т.д.

**Почему письма не доходят на Gmail:**
- ❌ Нет MX/SPF/DKIM записей
- ❌ IP адрес не прогрет (плохая репутация)
- ❌ Нет Reverse DNS (PTR записи)
- ❌ Gmail блокирует как спам

## ✅ Решение: SMTP Relay

Используйте проверенный SMTP сервис для отправки на внешние адреса.

---

## 🚀 Вариант 1: SendGrid (Рекомендуется)

**Бесплатно: 100 писем/день**

### 1. Регистрация
1. Зарегистрируйтесь на https://sendgrid.com/
2. Подтвердите email
3. Создайте API Key: Settings → API Keys → Create API Key

### 2. Настройка в docker-compose.yml

Раскомментируйте и обновите переменные:

```yaml
environment:
  SMTP_RELAY_ENABLED: "true"
  SMTP_RELAY_HOST: smtp.sendgrid.net
  SMTP_RELAY_PORT: 587
  SMTP_RELAY_USER: apikey
  SMTP_RELAY_PASSWORD: SG.ваш_api_ключ_здесь
  SMTP_RELAY_USE_TLS: "true"
```

### 3. Перезапустите контейнер

```bash
docker-compose restart backend
```

### 4. Проверьте отправку

Отправьте письмо с `support@alexol.io` на ваш Gmail - теперь дойдёт! ✅

---

## 🚀 Вариант 2: Mailgun

**Бесплатно: 5000 писем/месяц**

### 1. Регистрация
1. Зарегистрируйтесь на https://www.mailgun.com/
2. Получите SMTP credentials в разделе Sending → Domain settings → SMTP credentials

### 2. Настройка

```yaml
environment:
  SMTP_RELAY_ENABLED: "true"
  SMTP_RELAY_HOST: smtp.mailgun.org
  SMTP_RELAY_PORT: 587
  SMTP_RELAY_USER: postmaster@ваш_домен.mailgun.org
  SMTP_RELAY_PASSWORD: ваш_пароль
  SMTP_RELAY_USE_TLS: "true"
```

---

## 🚀 Вариант 3: AWS SES

**Очень дёшево: $0.10 за 1000 писем**

### 1. Настройка AWS SES
1. Зайдите в AWS Console → SES
2. Verify your email/domain
3. Создайте SMTP credentials

### 2. Настройка

```yaml
environment:
  SMTP_RELAY_ENABLED: "true"
  SMTP_RELAY_HOST: email-smtp.us-east-1.amazonaws.com  # ваш регион
  SMTP_RELAY_PORT: 587
  SMTP_RELAY_USER: ваш_aws_access_key
  SMTP_RELAY_PASSWORD: ваш_aws_secret_key
  SMTP_RELAY_USE_TLS: "true"
```

---

## 🚀 Вариант 4: Gmail SMTP (Google Workspace)

**Только если у вас есть Google Workspace**

### 1. Создайте App Password
1. Google Account → Security → 2-Step Verification
2. App passwords → Generate new app password

### 2. Настройка

```yaml
environment:
  SMTP_RELAY_ENABLED: "true"
  SMTP_RELAY_HOST: smtp.gmail.com
  SMTP_RELAY_PORT: 587
  SMTP_RELAY_USER: ваш_email@gmail.com
  SMTP_RELAY_PASSWORD: сгенерированный_app_password
  SMTP_RELAY_USE_TLS: "true"
```

**Ограничение:** 500 писем/день для бесплатного Gmail, 2000/день для Google Workspace

---

## 🔧 Полная настройка DNS (Опционально, для лучшей доставляемости)

Даже с SMTP Relay, рекомендуется настроить DNS записи:

### 1. MX запись
```
alexol.io.    MX    10    mail.alexol.io.
```

### 2. A запись
```
mail.alexol.io.    A    ВАШ_IP_АДРЕС
```

### 3. SPF запись
```
alexol.io.    TXT    "v=spf1 include:sendgrid.net ~all"
```
*Замените `sendgrid.net` на ваш SMTP провайдер*

### 4. DKIM запись
Получите от вашего SMTP провайдера и добавьте в DNS.

### 5. DMARC запись
```
_dmarc.alexol.io.    TXT    "v=DMARC1;p=none;rua=mailto:dmarc@alexol.io"
```

---

## ✅ Проверка работы

После настройки:

1. Перезапустите backend:
```bash
docker-compose restart backend
```

2. Отправьте тестовое письмо:
- От: `support@alexol.io`
- Кому: `ваш_gmail@gmail.com`
- Тема: `Test from mail server`

3. Проверьте Gmail - письмо должно прийти!

---

## 🎯 Рекомендация

**Для начала используйте SendGrid:**
- ✅ Бесплатно 100 писем/день
- ✅ Простая настройка
- ✅ Отличная доставляемость
- ✅ Подробная статистика

Когда объём писем вырастет - переходите на AWS SES (самый дёшевый).

---

## ❓ FAQ

**Q: Можно ли отправлять без SMTP Relay?**
A: Да, но письма будут попадать в спам на 99%. Нужны DNS записи, прогретый IP и месяцы работы.

**Q: Что если я отправляю на свой домен @alexol.io?**
A: Это работает без SMTP Relay - письма идут через локальный SMTP.

**Q: Сколько стоит?**
A: SendGrid - 100/день бесплатно, Mailgun - 5000/месяц бесплатно, AWS SES - $0.10 за 1000 писем.

**Q: Могу ли я использовать несколько провайдеров?**
A: Да, но нужно настроить логику переключения в коде.

---

## 🆘 Поддержка

Если возникли проблемы - проверьте логи:
```bash
docker-compose logs -f backend
```


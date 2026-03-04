# 🚀 Настройка полноценного почтового сервера

## Обзор

Ваш почтовый сервер теперь может:
- ✅ **Отправлять** письма на ЛЮБЫЕ домены (@gmail.com, @yahoo.com, @mail.ru, etc.)
- ✅ **Получать** письма со ВСЕХ доменов  
- ✅ Работать как настоящий почтовый сервер (Gmail, Outlook)

## ⚠️ Важно понимать

Для **полноценной работы** нужно:
1. **Выделенный IP адрес** (не shared hosting)
2. **Настроенные DNS записи** (MX, SPF, DKIM, DMARC)
3. **Reverse DNS (PTR)** - заказывается у хостера
4. **Прогретая репутация IP** - занимает 2-4 недели
5. **Порт 25 открыт** - многие хостеры блокируют

**Без этого письма будут попадать в спам! 📧**

---

## 🎯 Два режима работы

### Режим 1: Прямая отправка (требует настройки DNS)
Ваш сервер сам ищет MX записи получателя и отправляет напрямую.

**Плюсы:** Независимость, бесплатно  
**Минусы:** Сложная настройка, риск спама

### Режим 2: SMTP Relay (рекомендуется для начала)
Используется проверенный сервис (SendGrid, Mailgun) для отправки.

**Плюсы:** Работает сразу, отличная доставляемость  
**Минусы:** Есть лимиты/оплата

---

## 📋 Шаг 1: Базовая настройка DNS

### 1.1 MX запись (для ПРИЁМА писем)

Зайдите в панель управления DNS вашего домена и добавьте:

```
Тип: MX
Имя: @  (или alexol.io)
Приоритет: 10
Значение: mail.alexol.io
```

### 1.2 A запись (для почтового сервера)

```
Тип: A
Имя: mail
Значение: ВАШ_IP_АДРЕС_СЕРВЕРА
```

### 1.3 SPF запись (разрешённые серверы)

```
Тип: TXT
Имя: @  (или alexol.io)
Значение: v=spf1 ip4:ВАШ_IP_АДРЕС a:mail.alexol.io -all
```

**Пример с SMTP Relay (SendGrid):**
```
v=spf1 ip4:ВАШ_IP_АДРЕС include:sendgrid.net -all
```

### 1.4 DMARC запись (политика обработки)

```
Тип: TXT
Имя: _dmarc
Значение: v=DMARC1;p=quarantine;rua=mailto:dmarc@alexol.io;pct=100;adkim=s;aspf=s
```

**Объяснение:**
- `p=quarantine` - подозрительные письма в карантин
- `rua=mailto:...` - отчёты о нарушениях
- `adkim=s` - строгая проверка DKIM
- `aspf=s` - строгая проверка SPF

---

## 📋 Шаг 2: DKIM подпись (цифровая подпись)

### 2.1 Установите opendkim на сервере

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install opendkim opendkim-tools -y
```

### 2.2 Создайте ключи

```bash
# Создайте директорию для ключей
sudo mkdir -p /etc/opendkim/keys/alexol.io
cd /etc/opendkim/keys/alexol.io

# Генерация ключей
sudo opendkim-genkey -s default -d alexol.io

# Установите права
sudo chown opendkim:opendkim default.private
sudo chmod 600 default.private
```

### 2.3 Настройте opendkim

Отредактируйте `/etc/opendkim.conf`:

```bash
sudo nano /etc/opendkim.conf
```

Добавьте:
```
Domain                  alexol.io
KeyFile                 /etc/opendkim/keys/alexol.io/default.private
Selector                default
Socket                  inet:8891@localhost
```

### 2.4 Добавьте DKIM в DNS

Прочитайте публичный ключ:
```bash
sudo cat /etc/opendkim/keys/alexol.io/default.txt
```

Вы увидите что-то вроде:
```
default._domainkey IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBA..."
```

Добавьте в DNS:
```
Тип: TXT
Имя: default._domainkey
Значение: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBA...
```

### 2.5 Запустите opendkim

```bash
sudo systemctl enable opendkim
sudo systemctl start opendkim
```

---

## 📋 Шаг 3: Reverse DNS (PTR запись)

Это **КРИТИЧНО** для доставляемости!

### 3.1 Узнайте ваш IP

```bash
curl ifconfig.me
```

### 3.2 Закажите PTR запись у хостера

Обратитесь в поддержку хостинга и попросите настроить PTR запись:

```
IP: ВАШ_IP_АДРЕС
PTR: mail.alexol.io
```

### 3.3 Проверьте PTR

```bash
dig -x ВАШ_IP_АДРЕС +short
# Должно вернуть: mail.alexol.io
```

---

## 📋 Шаг 4: Настройка портов

### 4.1 Откройте порты в фаерволе

```bash
# Ubuntu UFW
sudo ufw allow 25/tcp    # SMTP (приём)
sudo ufw allow 587/tcp   # SMTP Submission (отправка)
sudo ufw allow 143/tcp   # IMAP
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
```

### 4.2 Проверьте, что порт 25 не заблокирован хостером

```bash
# С другого сервера/компьютера
telnet ВАШ_IP_АДРЕС 25
```

Если не подключается - обратитесь к хостеру для разблокировки порта 25.

**Важно:** Многие облачные провайдеры (AWS, Azure, Google Cloud) блокируют порт 25 по умолчанию!

---

## 📋 Шаг 5: Проверка конфигурации

### 5.1 Проверьте MX записи

```bash
dig alexol.io MX +short
# Должно вернуть: 10 mail.alexol.io
```

### 5.2 Проверьте SPF

```bash
dig alexol.io TXT +short
# Должно включать: "v=spf1 ..."
```

### 5.3 Проверьте DKIM

```bash
dig default._domainkey.alexol.io TXT +short
# Должно вернуть: "v=DKIM1; k=rsa; p=..."
```

### 5.4 Проверьте DMARC

```bash
dig _dmarc.alexol.io TXT +short
# Должно вернуть: "v=DMARC1; ..."
```

### 5.5 Онлайн проверка

Используйте сервисы:
- https://mxtoolbox.com/ - проверка DNS, blacklist
- https://www.mail-tester.com/ - отправьте тестовое письмо и получите оценку
- https://dkimvalidator.com/ - проверка DKIM

---

## 📋 Шаг 6: Прогрев IP (важно!)

Новые IP адреса имеют **нулевую репутацию**. Gmail и другие провайдеры будут блокировать письма.

### 6.1 План прогрева (2-4 недели)

**День 1-3:** 10-20 писем/день  
**День 4-7:** 50 писем/день  
**День 8-14:** 100-200 писем/день  
**День 15-21:** 500 писем/день  
**День 22-28:** 1000+ писем/день

### 6.2 Правила прогрева

- ✅ Отправляйте на **существующие адреса**
- ✅ Используйте **качественный контент**
- ✅ Получайте **открытия и клики**
- ✅ Избегайте **жалоб на спам**
- ❌ НЕ массовая рассылка сразу!

---

## 📋 Шаг 7: Запуск с новой конфигурацией

### 7.1 Обновите docker-compose.yml

Если хотите использовать SMTP Relay для надёжности:

```yaml
environment:
  SMTP_RELAY_ENABLED: "true"
  SMTP_RELAY_HOST: smtp.sendgrid.net
  SMTP_RELAY_PORT: 587
  SMTP_RELAY_USER: apikey
  SMTP_RELAY_PASSWORD: SG.ваш_api_key
  SMTP_RELAY_USE_TLS: "true"
```

Или отключите для прямой отправки:
```yaml
environment:
  SMTP_RELAY_ENABLED: "false"
```

### 7.2 Пересоберите backend

```bash
cd /path/to/mail/project

# Пересоберите контейнер
docker-compose build backend

# Перезапустите
docker-compose up -d
```

---

## 🧪 Тестирование

### Тест 1: Отправка на Gmail

1. Войдите в систему как `support@alexol.io`
2. Отправьте письмо на ваш Gmail
3. Проверьте:
   - ✅ Письмо пришло в inbox (не спам)
   - ✅ SPF: PASS
   - ✅ DKIM: PASS
   - ✅ DMARC: PASS

### Тест 2: Получение с Gmail

1. Отправьте письмо со своего Gmail на `support@alexol.io`
2. Проверьте inbox в системе - письмо должно прийти

### Тест 3: Mail-tester.com

1. Отправьте письмо на адрес с https://www.mail-tester.com/
2. Получите оценку (цель: 9/10 или 10/10)

---

## ❌ Типичные проблемы

### Проблема 1: Письма попадают в спам

**Причины:**
- Не настроен SPF/DKIM/DMARC
- Нет PTR записи
- IP в blacklist
- Плохой контент письма

**Решение:**
- Проверьте все DNS записи
- Используйте mail-tester.com для диагностики
- Проверьте IP на blacklist: https://mxtoolbox.com/blacklists.aspx

### Проблема 2: Порт 25 заблокирован

**Причины:**
- Хостер блокирует SMTP
- Фаервол закрыт

**Решение:**
- Обратитесь к хостеру
- Используйте VPS/Dedicated сервер (не shared hosting)
- Как временное решение - SMTP Relay

### Проблема 3: PTR запись не совпадает

**Причины:**
- Не настроена у хостера
- Время распространения DNS (до 48 часов)

**Решение:**
- Закажите у хостера
- Подождите распространения

---

## 🎯 Рекомендации

### Для production:

1. **Используйте SMTP Relay** (SendGrid/Mailgun) - минимум проблем
2. **Настройте все DNS записи** - обязательно
3. **Мониторьте репутацию** - проверяйте blacklist еженедельно
4. **Логируйте всё** - отслеживайте доставку
5. **Обрабатывайте отписки** - уменьшает жалобы на спам

### Для development/тестов:

1. **SMTP Relay** - самое простое
2. **Локальная отправка** - только для внутренних адресов

---

## 📊 Мониторинг

### Отслеживайте:

- **Bounce rate** - сколько писем не доставлено
- **Spam complaints** - жалобы на спам
- **Open rate** - открытия
- **Blacklist status** - проверка еженедельно

### Инструменты:

- https://mxtoolbox.com/ - проверка DNS
- https://www.mail-tester.com/ - тест доставляемости
- https://postmaster.google.com/ - статистика Gmail (после верификации)
- https://postmaster.yahoo.com/ - статистика Yahoo

---

## 🆘 Если ничего не работает

### Используйте SMTP Relay!

Это **профессиональное решение**, которое используют даже крупные компании:

**SendGrid** - бесплатно 100 писем/день
**Mailgun** - 5000 писем/месяц бесплатно
**AWS SES** - $0.10 за 1000 писем

Настройка займёт 5 минут, и всё заработает! ✅

---

## ✅ Чеклист готовности

- [ ] Выделенный IP адрес
- [ ] MX запись настроена
- [ ] A запись для mail.alexol.io
- [ ] SPF запись добавлена
- [ ] DKIM ключи сгенерированы
- [ ] DKIM запись в DNS
- [ ] DMARC запись добавлена
- [ ] PTR запись настроена у хостера
- [ ] Порт 25 открыт
- [ ] Порты 587, 143 открыты
- [ ] Тест на mail-tester.com: 8+/10
- [ ] IP не в blacklist
- [ ] Docker контейнеры обновлены
- [ ] Тестовое письмо на Gmail успешно

---

## 🎓 Дополнительные ресурсы

- [RFC 5321 - SMTP Protocol](https://tools.ietf.org/html/rfc5321)
- [Google Email Sender Guidelines](https://support.google.com/mail/answer/81126)
- [SPF Record Syntax](http://www.open-spf.org/SPF_Record_Syntax/)
- [DKIM.org](http://www.dkim.org/)
- [DMARC.org](https://dmarc.org/)

---

**Удачи с настройкой! 🚀**

Если возникнут вопросы - проверяйте логи:
```bash
docker-compose logs -f backend
```


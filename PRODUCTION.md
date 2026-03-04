# Развертывание в продакшен

## Предварительные требования

1. VPS или выделенный сервер (минимум 2GB RAM, 2 CPU, 40GB диск)
2. Доменное имя (alexol.io)
3. Ubuntu 20.04+ / Debian 11+ / CentOS 8+
4. Root доступ к серверу

## Шаг 1: Подготовка сервера

### 1.1 Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Установка Docker
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Проверка
docker --version
docker-compose --version
```

### 1.3 Настройка брандмауэра
```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 25/tcp    # SMTP
sudo ufw allow 587/tcp   # SMTP Submission
sudo ufw allow 143/tcp   # IMAP
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Проверка
sudo ufw status
```

## Шаг 2: Настройка DNS

Добавьте следующие записи в вашем DNS провайдере (например, CloudFlare, GoDaddy):

```
Тип  Имя          Значение            TTL     Приоритет
A    @            ВАШ_IP_АДРЕС        3600    -
A    mail         ВАШ_IP_АДРЕС        3600    -
A    www          ВАШ_IP_АДРЕС        3600    -
MX   @            mail.alexol.io      3600    10
TXT  @            v=spf1 mx ~all      3600    -
TXT  _dmarc       v=DMARC1; p=none;   3600    -
```

### Проверка DNS
```bash
# Проверка A записи
dig alexol.io +short

# Проверка MX записи
dig MX alexol.io +short

# Проверка с других серверов
nslookup alexol.io 8.8.8.8
```

## Шаг 3: Клонирование проекта

```bash
cd /opt
sudo git clone <ваш-репозиторий> mail
cd mail
sudo chown -R $USER:$USER /opt/mail
```

## Шаг 4: Настройка SSL сертификатов

### 4.1 Установка Certbot
```bash
sudo apt install certbot -y
```

### 4.2 Получение сертификатов
```bash
# Остановите контейнеры, если запущены
docker-compose down

# Получите сертификат
sudo certbot certonly --standalone \
  -d alexol.io \
  -d mail.alexol.io \
  -d www.alexol.io \
  --email admin@alexol.io \
  --agree-tos

# Сертификаты будут в:
# /etc/letsencrypt/live/alexol.io/fullchain.pem
# /etc/letsencrypt/live/alexol.io/privkey.pem
```

### 4.3 Автообновление сертификатов
```bash
# Добавьте в crontab
sudo crontab -e

# Добавьте строку (обновление каждый день в 3:00)
0 3 * * * certbot renew --quiet --post-hook "docker-compose -f /opt/mail/docker-compose.yml restart"
```

## Шаг 5: Изменение конфигурации

### 5.1 Создайте продакшн docker-compose
```bash
cp docker-compose.yml docker-compose.prod.yml
```

Отредактируйте `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: mail_postgres
    restart: always
    environment:
      POSTGRES_USER: mailuser_prod
      POSTGRES_PASSWORD: ИЗМЕНИТЕ_ЭТОТ_ПАРОЛЬ_123456
      POSTGRES_DB: maildb_prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - mail_network

  minio:
    image: minio/minio:latest
    container_name: mail_minio
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ИЗМЕНИТЕ_ЭТОТ_ЛОГИН
      MINIO_ROOT_PASSWORD: ИЗМЕНИТЕ_ЭТОТ_ПАРОЛЬ_МИНИМУМ_8_СИМВОЛОВ
    volumes:
      - minio_data:/data
    networks:
      - mail_network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: mail_backend
    restart: always
    environment:
      DATABASE_URL: postgresql+asyncpg://mailuser_prod:ИЗМЕНИТЕ_ЭТОТ_ПАРОЛЬ_123456@postgres:5432/maildb_prod
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ИЗМЕНИТЕ_ЭТОТ_ЛОГИН
      MINIO_SECRET_KEY: ИЗМЕНИТЕ_ЭТОТ_ПАРОЛЬ_МИНИМУМ_8_СИМВОЛОВ
      MINIO_BUCKET: avatars
      MINIO_SECURE: "false"
      SECRET_KEY: СГЕНЕРИРУЙТЕ_СЛУЧАЙНЫЙ_КЛЮЧ_64_СИМВОЛА_python3_-c_"import secrets; print(secrets.token_urlsafe(48))"
      MAIL_DOMAIN: alexol.io
      DEFAULT_ADMIN_EMAIL: admin@alexol.io
      DEFAULT_ADMIN_PASSWORD: ИЗМЕНИТЕ_ЭТОТ_ПАРОЛЬ_НА_СЛОЖНЫЙ
    ports:
      - "8000:8000"
      - "25:25"
      - "587:587"
      - "143:143"
    depends_on:
      - postgres
      - minio
    networks:
      - mail_network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: mail_frontend
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./nginx-prod.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - backend
    networks:
      - mail_network

volumes:
  postgres_data:
  minio_data:

networks:
  mail_network:
    driver: bridge
```

### 5.2 Создайте продакшн nginx конфиг
```bash
nano nginx-prod.conf
```

```nginx
# HTTP → HTTPS редирект
server {
    listen 80;
    server_name alexol.io www.alexol.io mail.alexol.io;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name alexol.io www.alexol.io;
    
    ssl_certificate /etc/letsencrypt/live/alexol.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/alexol.io/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    root /usr/share/nginx/html;
    index index.html;

    # API proxy
    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кеширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### 5.3 Генерация SECRET_KEY
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Скопируйте результат и вставьте в `docker-compose.prod.yml` как `SECRET_KEY`.

## Шаг 6: Запуск в продакшене

```bash
# Сборка и запуск
docker-compose -f docker-compose.prod.yml up -d --build

# Проверка статуса
docker-compose -f docker-compose.prod.yml ps

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f
```

## Шаг 7: Проверка

### 7.1 Проверка веб-интерфейса
1. Откройте: https://alexol.io
2. Войдите как админ (с новым паролем)
3. Создайте тестового пользователя
4. Отправьте письмо

### 7.2 Проверка SMTP
```bash
telnet alexol.io 25
```

### 7.3 Проверка SSL
```bash
curl -I https://alexol.io
openssl s_client -connect alexol.io:443 -servername alexol.io
```

## Шаг 8: Резервное копирование

### 8.1 Скрипт backup
Создайте `/opt/mail/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/mail/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Создать папку
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker-compose -f /opt/mail/docker-compose.prod.yml exec -T postgres \
  pg_dump -U mailuser_prod maildb_prod | gzip > $BACKUP_DIR/postgres_$DATE.sql.gz

# Backup MinIO
docker-compose -f /opt/mail/docker-compose.prod.yml exec -T minio \
  tar czf - /data | cat > $BACKUP_DIR/minio_$DATE.tar.gz

# Удалить старые бэкапы (старше 7 дней)
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
chmod +x /opt/mail/backup.sh
```

### 8.2 Автоматический backup (cron)
```bash
sudo crontab -e

# Каждый день в 2:00
0 2 * * * /opt/mail/backup.sh >> /var/log/mail-backup.log 2>&1
```

### 8.3 Восстановление из backup
```bash
# PostgreSQL
gunzip < backups/postgres_20240101_020000.sql.gz | \
  docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U mailuser_prod maildb_prod

# MinIO
docker-compose -f docker-compose.prod.yml exec -T minio \
  tar xzf - -C / < backups/minio_20240101_020000.tar.gz
```

## Шаг 9: Мониторинг

### 9.1 Логирование
```bash
# Настройка ротации логов
sudo nano /etc/logrotate.d/mail

# Добавьте:
/var/log/mail-backup.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
}
```

### 9.2 Мониторинг ресурсов
```bash
# Установите htop
sudo apt install htop

# Мониторинг Docker
docker stats

# Disk usage
df -h
```

### 9.3 Алерты
Настройте отправку алертов на email при проблемах:

```bash
# Установите mailutils
sudo apt install mailutils

# Скрипт проверки
nano /opt/mail/health-check.sh
```

```bash
#!/bin/bash
EMAIL="admin@alexol.io"

# Проверка сервисов
if ! docker-compose -f /opt/mail/docker-compose.prod.yml ps | grep -q "Up"; then
    echo "Mail services are down!" | mail -s "ALERT: Mail Server Down" $EMAIL
fi

# Проверка диска
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo "Disk usage is $DISK_USAGE%" | mail -s "ALERT: Disk Space Low" $EMAIL
fi
```

```bash
chmod +x /opt/mail/health-check.sh

# Запускать каждые 5 минут
sudo crontab -e
*/5 * * * * /opt/mail/health-check.sh
```

## Шаг 10: Обновление

```bash
cd /opt/mail

# Сделайте backup
./backup.sh

# Получите обновления
git pull

# Пересоберите и перезапустите
docker-compose -f docker-compose.prod.yml up -d --build

# Проверьте логи
docker-compose -f docker-compose.prod.yml logs -f
```

## Безопасность в продакшене

### Обязательные меры:
- ✅ Изменены все дефолтные пароли
- ✅ Настроен SSL/TLS
- ✅ Firewall настроен
- ✅ Регулярные бэкапы
- ✅ Мониторинг работает
- ✅ Логи ротируются
- ✅ Обновления применяются

### Рекомендуемые меры:
- Настройте fail2ban для защиты от брутфорса
- Используйте VPN для доступа к админке
- Настройте 2FA для администраторов
- Ограничьте доступ по IP (белый список)
- Регулярно проверяйте на уязвимости

## Производительность

### Для высоких нагрузок:
1. Увеличьте ресурсы сервера
2. Настройте PostgreSQL connection pooling
3. Добавьте Redis для кеширования
4. Используйте CDN для статики
5. Настройте load balancer для нескольких backend

### Оптимизация PostgreSQL:
```bash
# Редактируйте конфиг
docker-compose -f docker-compose.prod.yml exec postgres \
  nano /var/lib/postgresql/data/postgresql.conf

# Добавьте:
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
work_mem = 4MB
```

## Поддержка

- Email: admin@alexol.io
- GitHub Issues: <ваш-репозиторий>/issues
- Documentation: https://alexol.io/docs

## Чек-лист продакшн-готовности

- [ ] Сервер подготовлен и обновлен
- [ ] Docker установлен
- [ ] Firewall настроен
- [ ] DNS записи добавлены и работают
- [ ] SSL сертификаты получены
- [ ] Все пароли изменены
- [ ] SECRET_KEY сгенерирован
- [ ] docker-compose.prod.yml настроен
- [ ] nginx-prod.conf настроен
- [ ] Приложение запущено
- [ ] HTTPS работает
- [ ] SMTP/IMAP работают
- [ ] Резервное копирование настроено
- [ ] Мониторинг настроен
- [ ] Логи проверены
- [ ] Проведено тестирование

**Поздравляем! Ваш почтовый сервер готов к продакшену! 🚀**


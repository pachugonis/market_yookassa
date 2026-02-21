# Installation Guide for Market YooKassa

This guide provides detailed instructions for installing the Market YooKassa project on Ubuntu 24 VPS using both standard installation and Docker methods.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Method 1: Standard Installation](#method-1-standard-installation)
- [Method 2: Docker Installation](#method-2-docker-installation)
- [Post-Installation Setup](#post-installation-setup)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- Ubuntu 24.04 LTS
- Minimum 2GB RAM
- At least 10GB free disk space
- Root or sudo access
- Domain name (optional, for production)

### Update System

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Method 1: Standard Installation

### Step 1: Install Node.js 20.x

```bash
# Install Node.js 20.x via NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### Step 2: Install PostgreSQL 16

```bash
# Add PostgreSQL repository
sudo apt install -y wget ca-certificates
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE market_yookassa;
CREATE USER marketuser WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE market_yookassa TO marketuser;
\c market_yookassa
GRANT ALL ON SCHEMA public TO marketuser;
EOF
```

### Step 3: Install Git

```bash
sudo apt install -y git
```

### Step 4: Clone the Repository

```bash
# Create app directory
sudo mkdir -p /var/www/market-yookassa
sudo chown -R $USER:$USER /var/www/market-yookassa

# Clone repository
cd /var/www/market-yookassa
git clone https://github.com/your-username/market-yookassa.git .
```

### Step 5: Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit environment variables
nano .env
```

Update the following variables:

```env
# Database
DATABASE_URL="postgresql://marketuser:your_secure_password@localhost:5432/market_yookassa?schema=public"

# NextAuth
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="generate-random-32-char-string-here"

# YooKassa (get from https://yookassa.ru)
YOOKASSA_SHOP_ID="your_shop_id"
YOOKASSA_SECRET_KEY="your_secret_key"

# App
NEXT_PUBLIC_BASE_URL="https://yourdomain.com"
UPLOAD_DIR="uploads"
```

**Generate secure NEXTAUTH_SECRET:**

```bash
openssl rand -base64 32
```

### Step 6: Install Dependencies

```bash
npm install
```

### Step 7: Initialize Database

```bash
# Generate Prisma Client
npm run db:generate

# Run database migrations
npm run db:push

# (Optional) Seed database with initial data
npm run db:seed
```

### Step 8: Create Upload Directory

```bash
# Create uploads directory with proper permissions
mkdir -p uploads public/avatars public/covers public/category-icons
chmod 755 uploads public/avatars public/covers public/category-icons
```

### Step 9: Build the Application

```bash
# Build Next.js application
npm run build
```

### Step 10: Install PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application with PM2
pm2 start npm --name "market-yookassa" -- start

# Set PM2 to start on system boot
pm2 startup
pm2 save
```

### Step 11: Configure Nginx as Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/market-yookassa
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/market-yookassa /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 12: Install SSL Certificate (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal
sudo certbot renew --dry-run
```

### Step 13: Configure Firewall

```bash
# Enable UFW firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Method 2: Docker Installation

### Step 1: Install Docker and Docker Compose

```bash
# Install Docker
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### Step 2: Clone the Repository

```bash
# Create app directory
mkdir -p ~/market-yookassa
cd ~/market-yookassa

# Clone repository
git clone https://github.com/your-username/market-yookassa.git .
```

### Step 3: Create Docker Configuration Files

Create `Dockerfile`:

```bash
nano Dockerfile
```

```dockerfile
# Base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create uploads directory
RUN mkdir -p uploads public/avatars public/covers public/category-icons
RUN chown -R nextjs:nodejs uploads public

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

Create `docker-compose.yml`:

```bash
nano docker-compose.yml
```

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: market-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: market_yookassa
      POSTGRES_USER: marketuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - market-network

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: market-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://marketuser:${DB_PASSWORD}@postgres:5432/market_yookassa?schema=public
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      YOOKASSA_SHOP_ID: ${YOOKASSA_SHOP_ID}
      YOOKASSA_SECRET_KEY: ${YOOKASSA_SECRET_KEY}
      NEXT_PUBLIC_BASE_URL: ${NEXT_PUBLIC_BASE_URL}
      UPLOAD_DIR: uploads
    volumes:
      - ./uploads:/app/uploads
      - ./public/avatars:/app/public/avatars
      - ./public/covers:/app/public/covers
      - ./public/category-icons:/app/public/category-icons
    depends_on:
      - postgres
    networks:
      - market-network

  nginx:
    image: nginx:alpine
    container_name: market-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    networks:
      - market-network

networks:
  market-network:
    driver: bridge

volumes:
  postgres_data:
```

Create `nginx.conf`:

```bash
nano nginx.conf
```

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        client_max_body_size 500M;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

### Step 4: Configure Environment Variables

```bash
# Create .env file
nano .env
```

```env
# Database
DB_PASSWORD=your_secure_database_password

# NextAuth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=generate-random-32-char-string-here

# YooKassa
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key

# App
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### Step 5: Update next.config.ts for Docker

Add to `next.config.ts`:

```typescript
const nextConfig = {
  output: 'standalone',
  // ... other config
};
```

### Step 6: Build and Start Containers

```bash
# Build and start all containers
docker compose up -d --build

# View logs
docker compose logs -f

# Check container status
docker compose ps
```

### Step 7: Initialize Database

```bash
# Run migrations
docker compose exec app npx prisma db push

# (Optional) Seed database
docker compose exec app npm run db:seed
```

### Step 8: Setup SSL with Let's Encrypt (Optional)

```bash
# Stop nginx container temporarily
docker compose stop nginx

# Install Certbot
sudo apt install -y certbot

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Create SSL directory
mkdir -p ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/
sudo chown -R $USER:$USER ssl/

# Update nginx.conf to use SSL
nano nginx.conf
```

Add SSL configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    client_max_body_size 500M;

    location / {
        proxy_pass http://app;
        # ... rest of proxy config
    }
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

Restart containers:

```bash
docker compose up -d
```

---

## Post-Installation Setup

### 1. Create Admin Account

Access your application at `http://yourdomain.com` (or `https://yourdomain.com` with SSL) and register the first user. Then, manually set their role to ADMIN:

**Standard Installation:**

```bash
psql -U marketuser -d market_yookassa
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@example.com';
\q
```

**Docker Installation:**

```bash
docker compose exec postgres psql -U marketuser -d market_yookassa
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@example.com';
\q
```

### 2. Configure YooKassa

1. Register at https://yookassa.ru
2. Create a shop and obtain credentials
3. Update `.env` with your `YOOKASSA_SHOP_ID` and `YOOKASSA_SECRET_KEY`
4. Restart the application

**Standard Installation:**

```bash
pm2 restart market-yookassa
```

**Docker Installation:**

```bash
docker compose restart app
```

### 3. Set Up Automated Backups

Create backup script:

```bash
sudo nano /usr/local/bin/backup-market.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/market-yookassa"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker compose exec -T postgres pg_dump -U marketuser market_yookassa > $BACKUP_DIR/db_$DATE.sql

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

Make executable and schedule:

```bash
sudo chmod +x /usr/local/bin/backup-market.sh
sudo crontab -e
```

Add daily backup at 2 AM:

```
0 2 * * * /usr/local/bin/backup-market.sh
```

---

## Troubleshooting

### Database Connection Issues

**Standard Installation:**

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -U marketuser -d market_yookassa -h localhost
```

**Docker Installation:**

```bash
# Check container logs
docker compose logs postgres

# Connect to database
docker compose exec postgres psql -U marketuser -d market_yookassa
```

### Application Not Starting

**Standard Installation:**

```bash
# Check PM2 logs
pm2 logs market-yookassa

# Restart application
pm2 restart market-yookassa
```

**Docker Installation:**

```bash
# Check logs
docker compose logs app

# Restart container
docker compose restart app
```

### Upload Issues

```bash
# Check permissions
ls -la uploads/ public/avatars/ public/covers/

# Fix permissions (Standard)
chmod -R 755 uploads/ public/avatars/ public/covers/ public/category-icons/

# Fix permissions (Docker)
docker compose exec app chown -R nextjs:nodejs uploads/ public/avatars/ public/covers/ public/category-icons/
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 PID
```

### SSL Certificate Renewal (Let's Encrypt)

```bash
# Renew certificates
sudo certbot renew

# Update Docker SSL files if needed
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/
docker compose restart nginx
```

---

## Useful Commands

### Standard Installation

```bash
# View application logs
pm2 logs market-yookassa

# Restart application
pm2 restart market-yookassa

# Stop application
pm2 stop market-yookassa

# Database migrations
npm run db:push

# Open Prisma Studio
npm run db:studio
```

### Docker Installation

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f app

# Restart all services
docker compose restart

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build

# Execute command in container
docker compose exec app npm run db:push

# Open shell in container
docker compose exec app sh
```

---

## Security Recommendations

1. **Change default passwords** in production
2. **Enable firewall** (UFW on Ubuntu)
3. **Use strong NEXTAUTH_SECRET** (32+ characters)
4. **Enable SSL/TLS** with Let's Encrypt
5. **Regular backups** of database and uploads
6. **Keep system updated**: `sudo apt update && sudo apt upgrade`
7. **Monitor logs** regularly for suspicious activity
8. **Limit database access** to localhost only
9. **Use environment variables** for sensitive data
10. **Enable 2FA** for admin accounts in the application

---

## Support

For issues or questions:
- Check the [GitHub repository](https://github.com/your-username/market-yookassa)
- Review application logs
- Contact support

---

**Installation Complete!** Your Market YooKassa application should now be running on your Ubuntu 24 VPS.

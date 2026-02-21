# Docker Installation Guide for Market YooKassa

Complete guide for deploying Market YooKassa on Ubuntu 24 VPS using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Installation](#detailed-installation)
- [Configuration](#configuration)
- [SSL Setup](#ssl-setup)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- Ubuntu 24.04 LTS
- Minimum 2GB RAM (4GB recommended)
- At least 20GB free disk space
- Root or sudo access
- Domain name pointed to your server IP

### Update System

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Quick Start

For experienced users, here's a quick deployment:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Clone and setup
git clone https://github.com/your-username/market-yookassa.git
cd market-yookassa
cp .env.example .env
nano .env  # Edit configuration

# Deploy
docker compose up -d --build

# Initialize database
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed
```

---

## Detailed Installation

### Step 1: Install Docker Engine

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 2: Configure Docker (Post-Installation)

```bash
# Start and enable Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (avoid sudo)
sudo usermod -aG docker $USER

# Apply group changes
newgrp docker

# Verify Docker works without sudo
docker run hello-world
```

### Step 3: Clone Repository

```bash
# Create application directory
mkdir -p ~/apps
cd ~/apps

# Clone the repository
git clone https://github.com/your-username/market-yookassa.git
cd market-yookassa
```

### Step 4: Create Docker Configuration Files

#### Create Dockerfile

Create `Dockerfile` in the project root:

```dockerfile
# Multi-stage build for optimal image size
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Generate Prisma Client
RUN npx prisma generate

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create system user and group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create directories for file uploads
RUN mkdir -p uploads public/avatars public/covers public/category-icons && \
    chown -R nextjs:nodejs uploads public

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]
```

#### Create docker-compose.yml

Create `docker-compose.yml` in the project root:

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: market-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: market_yookassa
      POSTGRES_USER: marketuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    networks:
      - market-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U marketuser -d market_yookassa"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Next.js Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - NODE_ENV=production
    container_name: market-app
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      NODE_ENV: production
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
      postgres:
        condition: service_healthy
    networks:
      - market-network
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: market-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - app
    networks:
      - market-network
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  market-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

#### Create .dockerignore

Create `.dockerignore` to optimize build:

```
node_modules
.next
.git
.gitignore
.env
.env.local
.env.development
.env.production
README.md
INSTALL.md
DOCKER_INSTALL.md
docker-compose.yml
Dockerfile
.dockerignore
npm-debug.log
yarn-debug.log
yarn-error.log
.DS_Store
*.log
coverage
.vscode
.idea
uploads/*
!uploads/.gitkeep
```

### Step 5: Create Nginx Configuration

```bash
# Create nginx directory structure
mkdir -p nginx/ssl nginx/logs

# Create nginx configuration
nano nginx/nginx.conf
```

Add the following configuration:

```nginx
# Nginx configuration for Market YooKassa

user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 500M;
    client_body_buffer_size 128k;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    # Upstream application
    upstream app_backend {
        server app:3000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # HTTP Server (redirect to HTTPS in production)
    server {
        listen 80;
        listen [::]:80;
        server_name _;

        # Allow Let's Encrypt challenges
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # For initial setup without SSL
        location / {
            proxy_pass http://app_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_buffering off;
            proxy_request_buffering off;
        }

        # Uncomment after SSL setup to redirect HTTP to HTTPS
        # location / {
        #     return 301 https://$host$request_uri;
        # }
    }

    # HTTPS Server (uncomment after SSL setup)
    # server {
    #     listen 443 ssl http2;
    #     listen [::]:443 ssl http2;
    #     server_name yourdomain.com www.yourdomain.com;
    #
    #     # SSL certificates
    #     ssl_certificate /etc/nginx/ssl/fullchain.pem;
    #     ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    #
    #     # SSL configuration
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    #     ssl_prefer_server_ciphers off;
    #     ssl_session_cache shared:SSL:10m;
    #     ssl_session_timeout 10m;
    #     ssl_stapling on;
    #     ssl_stapling_verify on;
    #
    #     # Security headers
    #     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    #     add_header X-Frame-Options "SAMEORIGIN" always;
    #     add_header X-Content-Type-Options "nosniff" always;
    #     add_header X-XSS-Protection "1; mode=block" always;
    #
    #     # Application proxy
    #     location / {
    #         limit_req zone=general burst=20 nodelay;
    #         
    #         proxy_pass http://app_backend;
    #         proxy_http_version 1.1;
    #         proxy_set_header Upgrade $http_upgrade;
    #         proxy_set_header Connection 'upgrade';
    #         proxy_set_header Host $host;
    #         proxy_set_header X-Real-IP $remote_addr;
    #         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #         proxy_set_header X-Forwarded-Proto $scheme;
    #         proxy_cache_bypass $http_upgrade;
    #         proxy_buffering off;
    #         proxy_request_buffering off;
    #
    #         # Timeouts
    #         proxy_connect_timeout 60s;
    #         proxy_send_timeout 60s;
    #         proxy_read_timeout 60s;
    #     }
    #
    #     # API endpoints with higher rate limit
    #     location /api/ {
    #         limit_req zone=api burst=50 nodelay;
    #         
    #         proxy_pass http://app_backend;
    #         proxy_http_version 1.1;
    #         proxy_set_header Host $host;
    #         proxy_set_header X-Real-IP $remote_addr;
    #         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #         proxy_set_header X-Forwarded-Proto $scheme;
    #     }
    #
    #     # Static files caching
    #     location /_next/static/ {
    #         proxy_pass http://app_backend;
    #         proxy_cache_valid 200 365d;
    #         add_header Cache-Control "public, immutable";
    #     }
    # }
}
```

### Step 6: Configure Environment Variables

```bash
# Create .env file
nano .env
```

Add the following configuration:

```env
# Database Configuration
DB_PASSWORD=your_very_secure_database_password_here

# NextAuth Configuration
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your_generated_32_character_secret_here

# YooKassa Payment Gateway
# Get credentials from https://yookassa.ru
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key

# Application URLs
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

**Generate secure secrets:**

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate DB_PASSWORD
openssl rand -base64 24
```

### Step 7: Update next.config.ts

Add standalone output mode to `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    domains: ['localhost'],
  },
  // ... rest of your config
};

export default nextConfig;
```

### Step 8: Create Health Check Endpoint

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

### Step 9: Build and Start Services

```bash
# Build and start all containers
docker compose up -d --build

# View build progress
docker compose logs -f

# Once build is complete, check status
docker compose ps
```

### Step 10: Initialize Database

```bash
# Run Prisma migrations
docker compose exec app npx prisma db push

# (Optional) Seed database with sample data
docker compose exec app npm run db:seed

# Verify database connection
docker compose exec postgres psql -U marketuser -d market_yookassa -c "\dt"
```

### Step 11: Create Admin User

```bash
# Connect to database
docker compose exec postgres psql -U marketuser -d market_yookassa

# Update user role to ADMIN
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your-email@example.com';

# Exit
\q
```

---

## Configuration

### Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | `secure_password_123` |
| `NEXTAUTH_URL` | Application URL | `https://yourdomain.com` |
| `NEXTAUTH_SECRET` | NextAuth secret key | `32-character-random-string` |
| `YOOKASSA_SHOP_ID` | YooKassa shop ID | `123456` |
| `YOOKASSA_SECRET_KEY` | YooKassa secret key | `live_xxx` or `test_xxx` |
| `NEXT_PUBLIC_BASE_URL` | Public URL | `https://yourdomain.com` |

### Docker Compose Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f app

# Check service status
docker compose ps

# Rebuild and restart
docker compose up -d --build

# Stop and remove volumes (⚠️ deletes data)
docker compose down -v
```

---

## SSL Setup

### Method 1: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot

# Stop nginx container temporarily
docker compose stop nginx

# Obtain SSL certificate
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --agree-tos \
  --email your-email@example.com

# Copy certificates to nginx directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
sudo chown -R $USER:$USER nginx/ssl/
chmod 600 nginx/ssl/*.pem

# Update nginx.conf to enable HTTPS
nano nginx/nginx.conf
# Uncomment the HTTPS server block and comment HTTP redirect

# Restart nginx
docker compose up -d nginx
```

### Automatic Certificate Renewal

```bash
# Create renewal script
sudo nano /usr/local/bin/renew-ssl.sh
```

```bash
#!/bin/bash
docker compose -f /path/to/market-yookassa/docker-compose.yml stop nginx
certbot renew --quiet
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /path/to/market-yookassa/nginx/ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /path/to/market-yookassa/nginx/ssl/
docker compose -f /path/to/market-yookassa/docker-compose.yml start nginx
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/renew-ssl.sh

# Add to crontab (check daily at 2 AM)
sudo crontab -e
```

Add:
```
0 2 * * * /usr/local/bin/renew-ssl.sh >> /var/log/ssl-renew.log 2>&1
```

### Method 2: Self-Signed Certificate (Development Only)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=yourdomain.com"

# Update nginx.conf to enable HTTPS
nano nginx/nginx.conf
```

---

## Maintenance

### Backup Strategy

#### Database Backup

```bash
# Create backup script
nano backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/market-yookassa"
DATE=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="/path/to/market-yookassa/docker-compose.yml"

mkdir -p $BACKUP_DIR

# Backup database
docker compose -f $COMPOSE_FILE exec -T postgres pg_dump \
  -U marketuser market_yookassa | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup uploads
cd /path/to/market-yookassa
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/ public/avatars/ public/covers/ public/category-icons/

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x backup.sh

# Schedule daily backups
crontab -e
```

Add:
```
0 3 * * * /path/to/market-yookassa/backup.sh >> /var/log/market-backup.log 2>&1
```

#### Restore from Backup

```bash
# Restore database
gunzip < /backups/market-yookassa/db_20260221_030000.sql.gz | \
  docker compose exec -T postgres psql -U marketuser -d market_yookassa

# Restore uploads
tar -xzf /backups/market-yookassa/uploads_20260221_030000.tar.gz -C /path/to/market-yookassa/
```

### Update Application

```bash
# Pull latest changes
cd ~/apps/market-yookassa
git pull origin main

# Rebuild and restart
docker compose up -d --build

# Check logs
docker compose logs -f app
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f postgres
docker compose logs -f nginx

# Last 100 lines
docker compose logs --tail=100 app

# Save logs to file
docker compose logs app > app.log
```

### Monitor Resources

```bash
# Container stats
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a --volumes
```

### Database Management

```bash
# Access PostgreSQL
docker compose exec postgres psql -U marketuser -d market_yookassa

# Run Prisma Studio (database GUI)
docker compose exec app npx prisma studio

# Run migrations
docker compose exec app npx prisma migrate deploy

# Reset database (⚠️ deletes all data)
docker compose exec app npx prisma migrate reset
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check container status
docker compose ps

# View container logs
docker compose logs app

# Check if port is already in use
sudo lsof -i :3000
sudo lsof -i :5432

# Restart container
docker compose restart app
```

### Database Connection Issues

```bash
# Check PostgreSQL logs
docker compose logs postgres

# Test database connection
docker compose exec postgres pg_isready -U marketuser

# Connect to database manually
docker compose exec postgres psql -U marketuser -d market_yookassa

# Check environment variables
docker compose exec app env | grep DATABASE_URL
```

### Build Failures

```bash
# Clean build cache
docker builder prune -a

# Rebuild without cache
docker compose build --no-cache

# Remove old images
docker image prune -a
```

### Permission Issues

```bash
# Fix upload directory permissions
sudo chown -R 1001:1001 uploads/ public/avatars/ public/covers/ public/category-icons/
chmod -R 755 uploads/ public/avatars/ public/covers/ public/category-icons/
```

### Out of Disk Space

```bash
# Check disk usage
df -h
docker system df

# Clean up unused Docker resources
docker system prune -a --volumes

# Remove old images
docker image prune -a

# Remove stopped containers
docker container prune
```

### High Memory Usage

```bash
# Check container resource usage
docker stats

# Restart containers
docker compose restart

# Add memory limits to docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 1G
```

### Application Not Accessible

```bash
# Check if services are running
docker compose ps

# Check nginx logs
docker compose logs nginx

# Test app directly (bypass nginx)
curl http://localhost:3000/api/health

# Check firewall
sudo ufw status
```

### SSL Certificate Issues

```bash
# Verify certificate files exist
ls -la nginx/ssl/

# Check certificate expiration
openssl x509 -in nginx/ssl/fullchain.pem -noout -dates

# Test SSL configuration
docker compose exec nginx nginx -t

# Renew Let's Encrypt certificate
sudo certbot renew
```

---

## Performance Optimization

### Enable Redis Caching (Optional)

Add to `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: market-redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - market-network
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

### Docker Resource Limits

Update `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 512M
```

### Enable Logging Rotation

Create `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
sudo systemctl restart docker
docker compose up -d
```

---

## Security Best Practices

1. **Use strong passwords** for all services
2. **Enable firewall** and expose only necessary ports
3. **Keep Docker updated**: `sudo apt update && sudo apt upgrade`
4. **Regular backups** of database and uploads
5. **Monitor logs** for suspicious activity
6. **Use SSL/TLS** in production
7. **Limit container resources** to prevent DoS
8. **Never commit** `.env` file to version control
9. **Scan images** for vulnerabilities: `docker scan market-app`
10. **Use secrets** for sensitive data (Docker Swarm/Kubernetes)

---

## Useful Commands Reference

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart single service
docker compose restart app

# View logs
docker compose logs -f app

# Execute command in container
docker compose exec app npm run db:push

# Access container shell
docker compose exec app sh

# Build without cache
docker compose build --no-cache

# Scale service (multiple instances)
docker compose up -d --scale app=3

# Check resource usage
docker stats

# Clean up everything
docker compose down -v
docker system prune -a --volumes
```

---

## Getting Help

- Check logs: `docker compose logs -f`
- Verify configuration: `docker compose config`
- Test connectivity: `docker compose exec app ping postgres`
- Official docs: https://docs.docker.com
- Next.js docs: https://nextjs.org/docs

---

**Installation Complete!** Your Market YooKassa application is now running in Docker containers.

Access your application at: `http://your-server-ip` or `https://yourdomain.com` (with SSL)

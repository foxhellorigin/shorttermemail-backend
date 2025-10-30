#!/bin/bash

# ShortTermEmail.com Backend Deployment Script
# Usage: ./deploy.sh [production|staging]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
ENVIRONMENT=${1:-production}
DOMAIN="shorttermemail.com"
APP_NAME="shorttermemail-backend"
APP_DIR="/var/www/$APP_NAME"
SERVICE_USER=$(whoami)

log_info "Starting $APP_NAME deployment..."
log_info "Environment: $ENVIRONMENT"
log_info "Domain: $DOMAIN"
log_info "App Directory: $APP_DIR"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_error "Please do not run this script as root"
    exit 1
fi

# Check system requirements
log_info "Checking system requirements..."

# Check Ubuntu version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [ "$ID" = "ubuntu" ]; then
        log_success "Ubuntu $VERSION_ID detected"
    else
        log_warning "This script is tested on Ubuntu. Other distributions may require adjustments."
    fi
else
    log_warning "Could not detect OS version. Continuing anyway..."
fi

# Update system packages
log_info "Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install required packages
log_info "Installing system dependencies..."
sudo apt install -y curl wget git build-essential redis-server nginx certbot python3-certbot-nginx

# Install Node.js 18.x
log_info "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
log_info "Verifying installations..."
node --version
npm --version
redis-server --version
nginx -v

# Create application directory
log_info "Setting up application directory..."
sudo mkdir -p $APP_DIR
sudo chown $SERVICE_USER:$SERVICE_USER $APP_DIR

# Copy application files (assuming we're in the project directory)
log_info "Copying application files..."
cp -r . $APP_DIR/
cd $APP_DIR

# Set proper permissions
log_info "Setting file permissions..."
find $APP_DIR -type d -exec chmod 755 {} \;
find $APP_DIR -type f -exec chmod 644 {} \;
chmod +x $APP_DIR/deploy.sh

# Install Node.js dependencies
log_info "Installing Node.js dependencies..."
npm ci --production

# Setup environment file
if [ ! -f .env ]; then
    log_info "Creating environment configuration..."
    cp .env.example .env
    
    # Generate secure secrets
    SESSION_SECRET=$(openssl rand -base64 64)
    API_KEY=$(openssl rand -base64 32)
    
    sed -i "s/your-super-secure-session-secret/$SESSION_SECRET/" .env
    sed -i "s/your-secure-api-key-here/$API_KEY/" .env
    sed -i "s/shorttermemail.com/$DOMAIN/" .env
    
    log_success "Environment file created with secure secrets"
else
    log_info "Environment file already exists, skipping creation"
fi

# Configure Redis
log_info "Configuring Redis..."
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Test Redis connection
if redis-cli ping | grep -q "PONG"; then
    log_success "Redis is running correctly"
else
    log_error "Redis is not responding"
    exit 1
fi

# Install PM2
log_info "Installing PM2 process manager..."
sudo npm install -g pm2

# Create logs directory
mkdir -p logs

# Start application with PM2
log_info "Starting application with PM2..."
pm2 start ecosystem.config.js --env $ENVIRONMENT
pm2 save
pm2 startup

# Configure Nginx for API
log_info "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/api.$DOMAIN << EOF
# ShortTermEmail.com API - Nginx Configuration
server {
    listen 80;
    server_name api.$DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Health check
    location /api/health {
        access_log off;
        limit_req off;
        proxy_pass http://localhost:3001;
    }
    
    # Deny access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}

# Rate limiting zone
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
EOF

# Configure Nginx for SMTP domain
sudo tee /etc/nginx/sites-available/mail.$DOMAIN << EOF
server {
    listen 80;
    server_name mail.$DOMAIN;
    
    # Simple redirect or information page
    location / {
        return 200 'SMTP Server for $DOMAIN - Email reception service';
        add_header Content-Type text/plain;
    }
}
EOF

# Enable sites
sudo ln -sf /etc/nginx/sites-available/api.$DOMAIN /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/mail.$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
log_info "Testing Nginx configuration..."
sudo nginx -t

# Start Nginx
log_info "Starting Nginx..."
sudo systemctl enable nginx
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
log_info "Setting up SSL certificate..."
sudo certbot --nginx -d api.$DOMAIN -d mail.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Configure firewall
log_info "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 25/tcp  # SMTP
sudo ufw allow 3001/tcp  # API (for internal use)
sudo ufw --force enable

# Create maintenance script
log_info "Creating maintenance scripts..."
cat > maintenance.sh << 'EOF'
#!/bin/bash
# Maintenance script for ShortTermEmail Backend

cd /var/www/shorttermemail-backend

case "$1" in
    start)
        pm2 start ecosystem.config.js --env production
        ;;
    stop)
        pm2 stop all
        ;;
    restart)
        pm2 restart all
        ;;
    status)
        pm2 status
        ;;
    logs)
        pm2 logs
        ;;
    update)
        git pull
        npm ci --production
        pm2 restart all
        ;;
    backup)
        tar -czf backup/backup-$(date +%Y%m%d-%H%M%S).tar.gz .env logs/ redis/dump.rdb
        ;;
    cleanup)
        curl -X POST https://api.shorttermemail.com/api/cleanup
        ;;
    monitor)
        pm2 monit
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|update|backup|cleanup|monitor}"
        exit 1
        ;;
esac
EOF

chmod +x maintenance.sh

# Create backup directory
mkdir -p backup

# Setup log rotation
log_info "Setting up log rotation..."
sudo tee /etc/logrotate.d/shorttermemail << EOF
/var/www/shorttermemail-backend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Setup daily maintenance cron job
log_info "Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "0 2 * * * cd $APP_DIR && ./maintenance.sh backup >/dev/null 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 3 * * * cd $APP_DIR && ./maintenance.sh cleanup >/dev/null 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 4 * * * sudo certbot renew --quiet && sudo systemctl reload nginx") | crontab -

# Create health check script
cat > health-check.sh << 'EOF'
#!/bin/bash
# Health check script for ShortTermEmail

response=$(curl -s -o /dev/null -w "%{http_code}" https://api.shorttermemail.com/api/health)

if [ "$response" -eq 200 ]; then
    echo "✅ API is healthy"
    exit 0
else
    echo "❌ API is unhealthy (HTTP $response)"
    # Restart services
    cd /var/www/shorttermemail-backend
    pm2 restart all
    exit 1
fi
EOF

chmod +x health-check.sh

# Add health check to cron (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * cd $APP_DIR && ./health-check.sh >/dev/null 2>&1") | crontab -

# Final checks
log_info "Performing final checks..."

# Check if services are running
if systemctl is-active --quiet nginx; then
    log_success "Nginx is running"
else
    log_error "Nginx is not running"
fi

if systemctl is-active --quiet redis-server; then
    log_success "Redis is running"
else
    log_error "Redis is not running"
fi

if pm2 status | grep -q online; then
    log_success "PM2 processes are running"
else
    log_error "PM2 processes are not running"
fi

# Test API endpoint
log_info "Testing API endpoint..."
if curl -s https://api.$DOMAIN/api/health | grep -q "OK"; then
    log_success "API is responding correctly"
else
    log_error "API is not responding correctly"
fi

# Display deployment summary
echo ""
echo "=============================================="
log_success "Backend deployment completed successfully!"
echo ""
echo "🌐 API URL: https://api.$DOMAIN"
echo "📧 SMTP Server: mail.$DOMAIN:25"
echo "🛠️  Management: ./maintenance.sh {start|stop|restart|status|logs}"
echo "📊 Monitoring: ./maintenance.sh monitor"
echo "🔧 Health Check: ./health-check.sh"
echo ""
echo "📋 Next steps:"
echo "1. Update DNS records for api.$DOMAIN and mail.$DOMAIN"
echo "2. Configure MX records for email reception"
echo "3. Test email sending and receiving"
echo "4. Monitor logs for any issues"
echo "5. Set up monitoring and alerts"
echo "=============================================="
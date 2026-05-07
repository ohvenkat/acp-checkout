# 🚀 Quick Deployment Guide for Hostinger VPS

## Get Started in 5 Minutes

### 1. Prepare Your Code
```bash
# Copy all files to my_playground/acp-checkout/
mkdir -p ~/my_playground/acp-checkout
cd ~/my_playground/acp-checkout
# Copy: acp-server.js, package.json, .env.example, test-acp-flow.js, README.md, .gitignore
```

### 2. SSH into Hostinger VPS
```bash
ssh username@your_vps_ip
```

### 3. Install Node.js (if needed)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should be 16+
```

### 4. Upload and Setup
```bash
# Option A: Clone from GitHub (recommended)
cd /home/username
git clone https://github.com/yourusername/acp-checkout.git
cd acp-checkout
npm install

# Option B: Upload via SCP
# From your local machine:
scp -r ./my_playground/acp-checkout username@your_vps_ip:/home/username/
ssh username@your_vps_ip
cd acp-checkout
npm install
```

### 5. Configure Secrets
```bash
# SSH to VPS
nano .env
```

Paste:
```
PORT=3000
STRIPE_SECRET_KEY=sk_test_your_key_here
NODE_ENV=production
```

Save: `Ctrl+X`, `Y`, `Enter`

### 6. Test Locally
```bash
npm start
# In another terminal:
curl http://localhost:3000/health
# Should return: {"status":"ok",...}
```

### 7. Deploy with PM2
```bash
# Install PM2
sudo npm install -g pm2

# Start server
pm2 start acp-server.js --name "acp-checkout"

# Auto-restart on reboot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs acp-checkout
```

### 8. Setup Nginx (Optional but Recommended)
```bash
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/acp-checkout > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/acp-checkout /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. Enable HTTPS (Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 10. Test Your Deployment
```bash
# From local machine:
curl https://your-domain.com/health
```

---

## Daily Operations

**Check status:**
```bash
pm2 status
pm2 logs acp-checkout
```

**Restart server:**
```bash
pm2 restart acp-checkout
```

**Stop server:**
```bash
pm2 stop acp-checkout
```

**View real-time logs:**
```bash
pm2 logs acp-checkout --follow
```

---

## Test the API

### Health Check
```bash
curl https://your-domain.com/health
```

### Create Checkout
```bash
curl -X POST https://your-domain.com/checkouts \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "item_123", "quantity": 1}
    ],
    "buyer": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    }
  }'
```

### Run Full Test Suite
```bash
# SSH to VPS
node test-acp-flow.js https://your-domain.com
```

---

## Troubleshooting

**Server won't start:**
```bash
pm2 logs acp-checkout --err
# Check .env file and Stripe keys
```

**502 Bad Gateway:**
```bash
# Check if Node server is running
pm2 status
# Check if listening on 3000
netstat -tuln | grep 3000
# Check Nginx config
sudo nginx -t
```

**SSL Certificate Issues:**
```bash
# Renew certificate
sudo certbot renew

# Check expiry
sudo certbot certificates
```

---

## Next Steps

- [ ] **Database**: Replace in-memory Map with PostgreSQL (your Supabase project `rblossfvjirzsaduolyk`)
- [ ] **Webhooks**: Listen for Stripe webhook events
- [ ] **Monitoring**: Add error tracking (Sentry)
- [ ] **Testing**: Run integration tests
- [ ] **Payments**: Implement real Stripe payment processing
- [ ] **Admin Dashboard**: Build web UI to monitor orders

---

## Files Included

```
acp-checkout/
├── acp-server.js          # Main server
├── package.json           # Dependencies
├── .env.example          # Env template
├── .gitignore            # Git config
├── README.md             # Full docs
├── QUICK_START.md        # This file
└── test-acp-flow.js      # Test script
```

---

## Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/checkouts` | Create new checkout |
| GET | `/checkouts/:id` | Retrieve checkout status |
| PUT | `/checkouts/:id` | Update checkout |
| POST | `/checkouts/:id/complete` | Process payment |
| POST | `/checkouts/:id/cancel` | Cancel checkout |
| GET | `/health` | Health check |

---

## Support Resources

- **ACP Docs**: https://docs.stripe.com/agentic-commerce
- **Stripe API**: https://stripe.com/docs/api
- **Hostinger VPS Docs**: https://www.hostinger.com/help
- **PM2 Docs**: https://pm2.keymetrics.io
- **Nginx Docs**: https://nginx.org

---

**You're all set! 🎉**

Your ACP checkout server is now ready to accept payments from AI agents through Stripe.

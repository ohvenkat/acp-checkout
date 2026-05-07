# Agentic Commerce Protocol (ACP) Checkout Server

A production-ready Node.js/Express implementation of the Stripe Agentic Commerce Protocol checkout endpoints, designed for deployment on your Hostinger VPS.

## What This Does

Implements all ACP checkout endpoints:
- **POST /checkouts** - Create a new checkout session
- **GET /checkouts/:id** - Retrieve checkout status
- **PUT /checkouts/:id** - Update checkout (items, address, fulfillment option)
- **POST /checkouts/:id/complete** - Process payment completion
- **POST /checkouts/:id/cancel** - Cancel a checkout

## Prerequisites

- Node.js 16+ (check with `node --version`)
- npm or yarn
- A Stripe account with API keys
- SSH access to your Hostinger VPS

## Local Setup (Development)

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

```bash
touch .env
```

Edit `.env` and add:

```
PORT=3000
STRIPE_SECRET_KEY=sk_test_your_key_here
NODE_ENV=development
```

Get your Stripe keys from: https://dashboard.stripe.com/apikeys

### 3. Run Locally

```bash
npm start
```

Server runs at `http://localhost:3000`

### 4. Test the Endpoints

**Create a checkout:**
```bash
curl -X POST http://localhost:3000/checkouts \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "item_123", "quantity": 2},
      {"id": "item_456", "quantity": 1}
    ],
    "buyer": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    }
  }'
```

**Retrieve checkout:**
```bash
curl http://localhost:3000/checkouts/checkout_abc123
```

**Update checkout with shipping address:**
```bash
curl -X PUT http://localhost:3000/checkouts/checkout_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "fulfillment_address": {
      "name": "John Doe",
      "line_one": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "country": "US",
      "postal_code": "94105"
    },
    "fulfillment_option_id": "shipping_fast"
  }'
```

**Complete checkout:**
```bash
curl -X POST http://localhost:3000/checkouts/checkout_abc123/complete \
  -H "Content-Type: application/json" \
  -d '{
    "payment_data": {
      "token": "spt_123abc",
      "provider": "stripe"
    }
  }'
```

**Cancel checkout:**
```bash
curl -X POST http://localhost:3000/checkouts/checkout_abc123/cancel
```

## Deployment to Hostinger VPS

### Step 1: SSH into Your VPS

```bash
ssh root@your_vps_ip
```

Or with your credentials:
```bash
ssh -i /path/to/key username@your_vps_ip
```

### Step 2: Install Node.js (if not already installed)

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18 (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
```

Verify installation:
```bash
node --version
npm --version
```

### Step 3: Clone or Upload Project

**Option A: Git clone (recommended)**
```bash
cd /home/username
git clone https://github.com/yourusername/acp-server.git
cd acp-server
npm install
```

**Option B: Upload files via SCP**
```bash
scp -r ./acp-server username@your_vps_ip:/home/username/
ssh username@your_vps_ip
cd acp-server
npm install
```

### Step 4: Create Environment File

```bash
nano .env
```

Add your Stripe keys and desired port:
```
PORT=3000
STRIPE_SECRET_KEY=sk_test_your_secret_key
NODE_ENV=production
```

Save with `Ctrl+X`, then `Y`, then `Enter`.

### Step 5: Set Up PM2 for Process Management

PM2 keeps your server running 24/7 and auto-restarts on failure.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the server with PM2
pm2 start acp-server.js --name "acp-checkout"

# Set up auto-start on VPS reboot
pm2 startup
pm2 save
```

Check status:
```bash
pm2 status
pm2 logs acp-checkout
```

### Step 6: Configure Reverse Proxy (Nginx)

This exposes your Node.js app on port 80/443 with your domain.

```bash
# Install Nginx
sudo apt install -y nginx

# Create config file
sudo nano /etc/nginx/sites-available/acp-checkout
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/acp-checkout /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Enable HTTPS with Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is enabled by default
```

### Step 8: Test Your Deployment

From your local machine:
```bash
curl https://your-domain.com/health
```

Response should be:
```json
{"status":"ok","timestamp":"2024-05-06T12:00:00.000Z"}
```

## Project Structure

```
acp-server/
├── acp-server.js          # Main Express server
├── package.json           # Dependencies
├── .env                   # Environment variables (add to .gitignore)
├── .gitignore            # Git ignore file
├── README.md             # This file
└── tests/
    └── acp.test.js       # Integration tests (optional)
```

## Customization

### Add Your Products

Edit the `productCatalog` in `acp-server.js`:

```javascript
const productCatalog = {
  item_your_id: {
    id: 'item_your_id',
    name: 'Your Product Name',
    price: 2000, // in cents ($20.00)
    inventory: 100,
  },
};
```

### Customize Shipping Options

Modify the `shippingOptions` array to add your carriers and rates:

```javascript
const shippingOptions = [
  {
    type: 'shipping',
    id: 'shipping_standard',
    title: 'Standard Shipping',
    subtitle: '5-7 business days',
    carrier: 'USPS',
    subtotal: 0,
    tax: 0,
    total: 0,
  },
  // Add more options...
];
```

### Connect to Database

Replace in-memory `checkoutSessions` Map with a database:

```javascript
// Instead of: const checkoutSessions = new Map();

// Use Supabase:
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Or use MongoDB:
const mongoose = require('mongoose');
const CheckoutSchema = new mongoose.Schema({...});
```

### Integrate Real Stripe Payments

In the `/complete` endpoint, process actual payments:

```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount: session.totals.find(t => t.type === 'total').amount,
  currency: 'usd',
  payment_method: payment_data.token,
  confirm: true,
});
```

## Monitoring & Logs

Check logs in real-time:
```bash
pm2 logs acp-checkout
```

View logs from past day:
```bash
pm2 logs acp-checkout --lines 100
```

View resource usage:
```bash
pm2 monit
```

## Troubleshooting

### Server won't start

Check logs:
```bash
pm2 logs acp-checkout --err
```

Common issues:
- Port 3000 already in use: Change `PORT` in `.env`
- Missing Stripe key: Verify `STRIPE_SECRET_KEY` in `.env`
- Node not found: Run `which node` and check PATH

### Nginx 502 Bad Gateway

Ensure:
1. Node server is running: `pm2 status`
2. Server listening on port 3000: Check `.env`
3. Nginx can access localhost: `curl http://127.0.0.1:3000/health`

### SSL/HTTPS Issues

Renew certificates:
```bash
sudo certbot renew
```

Check expiration:
```bash
sudo certbot certificates
```

## Security Checklist

- [ ] Use strong Stripe API keys (rotate regularly)
- [ ] Enable HTTPS with SSL certificate
- [ ] Use `.env` for sensitive data (never commit)
- [ ] Add rate limiting for production
- [ ] Validate all user inputs
- [ ] Keep Node.js and npm packages updated
- [ ] Monitor logs for suspicious activity
- [ ] Use firewall rules (only allow ports 80, 443, 22)

## Next Steps

1. **Add Database Persistence** - Replace in-memory storage with PostgreSQL/MongoDB
2. **Implement Webhook Handling** - Receive Stripe events for order updates
3. **Add Authentication** - Protect endpoints with API keys or OAuth
4. **Create Admin Dashboard** - Monitor checkouts and orders
5. **Add Tests** - Write integration tests for all endpoints
6. **Set Up Monitoring** - Use tools like DataDog or New Relic

## API Response Format

All responses follow ACP spec. Success example:

```json
{
  "id": "checkout_abc123",
  "status": "ready_for_payment",
  "currency": "usd",
  "line_items": [...],
  "totals": [...],
  "fulfillment_options": [...],
  "messages": [],
  "links": [...]
}
```

Error example:

```json
{
  "type": "invalid_request",
  "code": "missing_items",
  "message": "items array is required"
}
```

## Documentation & Resources

- [ACP Specification](https://docs.stripe.com/agentic-commerce/protocol/specification)
- [Stripe API Docs](https://docs.stripe.com)
- [Express.js Guide](https://expressjs.com)
- [PM2 Documentation](https://pm2.keymetrics.io)
- [Nginx Reverse Proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)

## Support

For issues:
1. Check logs: `pm2 logs acp-checkout --err`
2. Verify `.env` configuration
3. Test with curl commands above
4. Review ACP spec for response format requirements

---

**Last updated:** May 2026  
**Status:** Production Ready
#   a c p - c h e c k o u t  
 
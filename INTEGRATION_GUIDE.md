# Integration with Your Existing Hostinger Setup

Since you already have:
- ✅ Hostinger VPS with automation projects
- ✅ `my_playground` GitHub repository structure (subfolders per project)
- ✅ Supabase project (rblossfvjirzsaduolyk)
- ✅ Experience with Claude Code & MCP servers

Here's how to integrate the ACP checkout server into your existing workflow.

---

## 📁 Repository Structure

Add the ACP server as a subfolder in your `my_playground` repo:

```
my_playground/
├── flight-tracker-bot/         (existing)
│   ├── tracker.py
│   ├── requirements.txt
│   └── README.md
├── telegram-bot-botler/         (existing)
│   ├── bot.py
│   ├── handlers.py
│   └── ...
├── whatsapp-summarizer/         (existing)
│   ├── summarizer.py
│   └── ...
└── acp-checkout/               (NEW - Agentic Commerce)
    ├── acp-server.js
    ├── package.json
    ├── test-acp-flow.js
    ├── .env.example
    ├── .gitignore
    ├── README.md
    ├── QUICK_START.md
    └── docs/
        ├── API_ENDPOINTS.md
        └── DEPLOYMENT.md
```

### Setup

```bash
cd ~/my_playground
git clone <your-repo> . || git init

mkdir acp-checkout
cd acp-checkout
cp /path/to/acp-server.js .
cp /path/to/package.json .
# ... copy other files

git add acp-checkout/
git commit -m "feat: add ACP checkout server for agentic commerce"
git push origin main
```

---

## 🔄 Deployment Workflow

### Option A: Claude Code + SSH (Recommended for You)

Since you built `hostinger-ssh-mcp`, you can deploy with Claude Code:

```javascript
// Use your existing MCP connection:
// "use run_command from hostinger-vps to run [command]"

// 1. Pull latest code
cd /home/username/my_playground/acp-checkout
git pull origin main

// 2. Install/update dependencies
npm install

// 3. Restart with PM2
pm2 restart acp-checkout
```

### Option B: Manual SSH Deployment

```bash
# SSH to VPS
ssh username@your_vps_ip

# Navigate to project
cd /home/username/my_playground/acp-checkout

# Pull latest
git pull origin main

# Install
npm install

# Restart
pm2 restart acp-checkout
```

### Option C: Systemd Service (No PM2)

Create `/etc/systemd/system/acp-checkout.service`:

```ini
[Unit]
Description=ACP Checkout Server
After=network.target

[Service]
Type=simple
User=username
WorkingDirectory=/home/username/my_playground/acp-checkout
ExecStart=/usr/bin/node acp-server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable acp-checkout
sudo systemctl start acp-checkout
```

---

## 🗄️ Database Integration

### Connect to Your Supabase Project

Your project: `rblossfvjirzsaduolyk`

#### 1. Add Supabase Schema

In Supabase dashboard, create table:

```sql
CREATE TABLE checkouts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  currency TEXT DEFAULT 'usd',
  buyer JSONB,
  line_items JSONB,
  fulfillment_address JSONB,
  fulfillment_option_id TEXT,
  totals JSONB,
  payment_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  checkout_session_id TEXT REFERENCES checkouts(id),
  status TEXT DEFAULT 'created',
  order_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Update acp-server.js

Replace in-memory storage:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// In POST /checkouts endpoint:
await supabase
  .from('checkouts')
  .insert([session]);

// In GET /checkouts/:id endpoint:
const { data } = await supabase
  .from('checkouts')
  .select('*')
  .eq('id', id)
  .single();

// In POST /checkouts/:id/complete:
const { error } = await supabase
  .from('checkouts')
  .update({ status: 'completed', completed_at: new Date() })
  .eq('id', id);
```

#### 3. Update .env

```env
PORT=3000
STRIPE_SECRET_KEY=sk_test_...
SUPABASE_URL=https://rblossfvjirzsaduolyk.supabase.co
SUPABASE_KEY=your_supabase_key
NODE_ENV=production
```

#### 4. Install Supabase SDK

```bash
npm install @supabase/supabase-js
```

---

## 💳 Stripe Integration

### 1. Get Your API Keys

https://dashboard.stripe.com/apikeys

Add to .env:
```env
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

### 2. Implement Payment Processing

In POST `/checkouts/:id/complete`:

```javascript
// Process payment using Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const paymentIntent = await stripe.paymentIntents.create({
  amount: totalAmount,
  currency: 'usd',
  payment_method: payment_data.token,
  confirm: true,
});

if (paymentIntent.status === 'succeeded') {
  // Update checkout status
  session.status = 'completed';
  
  // Create order in database
  await supabase.from('orders').insert({
    id: 'order_' + uuidv4(),
    checkout_session_id: checkoutId,
    status: 'created',
    order_data: session
  });
}
```

### 3. Webhook Handling

Listen for Stripe events:

```javascript
app.post('/stripe-webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === 'payment_intent.succeeded') {
    // Update order status
    const { payment_intent } = event.data.object;
    console.log('Payment succeeded:', payment_intent.id);
  }

  res.json({received: true});
});
```

---

## 📡 Network Configuration

Your Hostinger VPS likely has firewall rules. Ensure:

```bash
# Allow incoming HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH

# Check status
sudo ufw status
```

If using Nginx reverse proxy (recommended):

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🚀 Deployment Checklist

### Before Deploying

- [ ] Stripe account created
- [ ] Stripe API keys obtained
- [ ] Supabase project prepared
- [ ] .env configured with secrets
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Nginx config ready
- [ ] Domain points to VPS IP
- [ ] Test scripts pass locally

### Deployment Steps

```bash
# 1. SSH to VPS
ssh username@your_vps_ip

# 2. Navigate to project
cd /home/username/my_playground/acp-checkout

# 3. Pull latest code
git pull origin main

# 4. Install dependencies
npm install

# 5. Set environment variables
nano .env
# Add STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_KEY

# 6. Start server
pm2 start acp-server.js --name "acp-checkout"
pm2 save

# 7. Test
curl https://your-domain.com/health
node test-acp-flow.js https://your-domain.com
```

### Verify Deployment

```bash
# Check server status
pm2 status

# View logs
pm2 logs acp-checkout

# Test endpoints
curl https://your-domain.com/health
curl https://your-domain.com/checkouts -X POST -H "Content-Type: application/json" -d '{"items":[{"id":"item_123","quantity":1}]}'
```

---

## 🔄 Sync with Claude Code

You can integrate this with Claude Code for continuous deployment:

### 1. Create Deployment Script

Save as `deploy-acp.sh`:

```bash
#!/bin/bash

echo "🚀 Deploying ACP Checkout Server..."

# Pull latest
git pull origin main

# Install dependencies
npm install

# Run tests
npm test || exit 1

# Restart server
pm2 restart acp-checkout

# Check status
pm2 status

echo "✅ Deployment complete!"
```

### 2. Use with Claude Code

In Claude Code:
```
use run_command from hostinger-vps to run bash /home/username/my_playground/acp-checkout/deploy-acp.sh
```

---

## 📊 Monitoring

### Setup PM2 Monitoring

```bash
# Install PM2 Plus (optional - real-time dashboard)
pm2 plus

# Or use PM2 web UI
pm2 web
# Access at http://localhost:9615
```

### Check Resource Usage

```bash
# View CPU/memory
pm2 monit

# See errors
pm2 logs acp-checkout --err

# Last 100 lines
pm2 logs acp-checkout --lines 100
```

### Log Rotation

Add to PM2 config:

```bash
pm2 start acp-server.js --name "acp-checkout" --max-memory-restart 500M
```

---

## 🧪 Testing Workflow

### Local Testing

```bash
# Start server locally
npm start

# Run tests in another terminal
node test-acp-flow.js http://localhost:3000

# With verbose output
NODE_DEBUG=* node test-acp-flow.js http://localhost:3000
```

### Production Testing

```bash
# SSH to VPS
ssh username@your_vps_ip

# Run tests
cd /home/username/my_playground/acp-checkout
node test-acp-flow.js https://your-domain.com

# Monitor in real-time
pm2 logs acp-checkout --follow
```

---

## 🔐 Security Considerations

### Secrets Management

Never commit `.env` files. Your `.gitignore` handles this:

```gitignore
.env
.env.local
```

Store secrets in:
1. Local `.env` (local development)
2. VPS `.env` (production)
3. Environment variables in CI/CD (if using)

### API Key Rotation

Every 90 days:

```bash
# Generate new Stripe API key
# Update .env on VPS
nano .env

# Restart server
pm2 restart acp-checkout

# Verify
curl https://your-domain.com/health
```

### Rate Limiting

Add rate limiting middleware:

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/checkouts', limiter);
```

---

## 📈 Growth Path

### Stage 1: MVP (Current)
- ✅ ACP endpoints implemented
- ✅ In-memory checkout storage
- ✅ Basic Stripe integration

### Stage 2: Data Persistence
- [ ] Connect Supabase PostgreSQL
- [ ] Persist orders
- [ ] Add order history

### Stage 3: Full Payments
- [ ] Real Stripe payment processing
- [ ] Webhook handling
- [ ] Refund management

### Stage 4: Scale
- [ ] Redis caching
- [ ] Database connection pooling
- [ ] Multi-region deployment
- [ ] Analytics dashboard

---

## 🆘 Getting Help

### Documentation
1. README.md - Complete API reference
2. QUICK_START.md - Deployment guide
3. IMPLEMENTATION_OVERVIEW.md - High-level overview

### Debugging
```bash
# Check logs
pm2 logs acp-checkout --err

# Test endpoint directly
curl -v https://your-domain.com/health

# Check Stripe connectivity
node -e "const Stripe = require('stripe'); console.log('Stripe SDK loaded')"
```

### Resources
- Stripe Docs: https://stripe.com/docs
- ACP Spec: https://docs.stripe.com/agentic-commerce
- Express.js: https://expressjs.com

---

## ✅ You're Ready!

Your ACP checkout server integrates seamlessly with:
- ✅ Your existing Hostinger VPS setup
- ✅ Your `my_playground` repository structure
- ✅ Your Supabase project
- ✅ Claude Code via MCP SSH
- ✅ Stripe's agentic commerce platform

**Next Step:** Deploy to VPS following QUICK_START.md

---

**Integration Guide Version:** 1.0  
**Last Updated:** May 2026  
**Status:** Ready for Deployment

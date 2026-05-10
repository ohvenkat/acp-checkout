#!/usr/bin/env node

/**
 * ACP Checkout Flow Test Script
 * 
 * Demonstrates the complete Agentic Commerce Protocol checkout flow:
 * 1. Create a checkout session
 * 2. Update with buyer and address info
 * 3. Change shipping option
 * 4. Complete the payment
 * 
 * Usage: node test-acp-flow.js [base_url]
 * Example: node test-acp-flow.js http://localhost:3000
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const isHttps = BASE_URL.startsWith('https');
const client = isHttps ? https : http;

const urlObj = new URL(BASE_URL);
const baseOptions = {
  hostname: urlObj.hostname,
  port: urlObj.port,
  headers: {
    'Content-Type': 'application/json',
  },
};

let checkoutId = null;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      ...baseOptions,
      method,
      path,
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data || null });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log(`\n🚀 ACP Checkout Flow Test`);
  console.log(`📍 Server: ${BASE_URL}\n`);

  try {
    // Test 1: Health check
    console.log('1️⃣  Health Check');
    let response = await makeRequest('GET', '/health');
    if (response.status !== 200) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    console.log(`✅ Server is healthy\n`);

    // Test 2: Create checkout
    console.log('2️⃣  Create Checkout Session');
    const createPayload = {
      items: [
        { id: 'item_123', quantity: 1 },
        { id: 'item_456', quantity: 2 },
      ],
      buyer: {
        first_name: 'Alice',
        last_name: 'Agent',
        email: 'agent@example.com',
        phone_number: '+14155552671',
      },
    };

    response = await makeRequest('POST', '/checkouts', createPayload);
    if (response.status !== 201) {
      throw new Error(`Create failed: ${response.status}`);
    }

    checkoutId = response.data.id;
    console.log(`✅ Checkout created: ${checkoutId}`);
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Line items: ${response.data.line_items.length}`);
    console.log(`   Total: $${(response.data.totals.find(t => t.type === 'total').amount / 100).toFixed(2)}\n`);

    // Test 3: Retrieve checkout
    console.log('3️⃣  Retrieve Checkout');
    response = await makeRequest('GET', `/checkouts/${checkoutId}`);
    if (response.status !== 200) {
      throw new Error(`Retrieve failed: ${response.status}`);
    }
    console.log(`✅ Retrieved checkout ${checkoutId}`);
    console.log(`   Available fulfillment options: ${response.data.fulfillment_options.length}\n`);

    // Test 4: Update with address
    console.log('4️⃣  Update Checkout with Fulfillment Address');
    const updatePayload = {
      fulfillment_address: {
        name: 'Alice Agent',
        line_one: '123 Main St',
        line_two: 'Suite 100',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        postal_code: '94105',
      },
    };

    response = await makeRequest('PUT', `/checkouts/${checkoutId}`, updatePayload);
    if (response.status !== 200) {
      throw new Error(`Update failed: ${response.status}`);
    }
    console.log(`✅ Checkout updated`);
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Address: ${response.data.fulfillment_address.city}, ${response.data.fulfillment_address.state}\n`);

    // Test 5: Change shipping option
    console.log('5️⃣  Update Shipping Option');
    const shippingPayload = {
      fulfillment_option_id: 'shipping_fast',
    };

    response = await makeRequest('PUT', `/checkouts/${checkoutId}`, shippingPayload);
    if (response.status !== 200) {
      throw new Error(`Shipping update failed: ${response.status}`);
    }
    const newTotal = response.data.totals.find(t => t.type === 'total').amount;
    console.log(`✅ Shipping updated to express`);
    console.log(`   New total: $${(newTotal / 100).toFixed(2)}\n`);

    // Test 6: Complete checkout
    console.log('6️⃣  Complete Checkout (Process Payment)');
    const completePayload = {
      payment_data: {
        // token: 'spt_test_' + Math.random().toString(36).substring(7),
        token: "tok_visa",
        provider: 'stripe',
        billing_address: {
          name: 'Alice Agent',
          line_one: '123 Main St',
          line_two: 'Suite 100',
          city: 'San Francisco',
          state: 'CA',
          country: 'US',
          postal_code: '94105',
        },
      },
    };

    response = await makeRequest('POST', `/checkouts/${checkoutId}/complete`, completePayload);
    if (response.status !== 200) {
      throw new Error(`Complete failed: ${response.status}`);
    }
    console.log(`✅ Checkout completed`);
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Total charged: $${(response.data.totals.find(t => t.type === 'total').amount / 100).toFixed(2)}\n`);

    // Test 7: Create another checkout and cancel it
    console.log('7️⃣  Test Cancel Flow');
    response = await makeRequest('POST', '/checkouts', {
      items: [{ id: 'item_789', quantity: 1 }],
    });

    const cancelCheckoutId = response.data.id;
    response = await makeRequest('POST', `/checkouts/${cancelCheckoutId}/cancel`, {});
    if (response.status !== 200) {
      throw new Error(`Cancel failed: ${response.status}`);
    }
    console.log(`✅ Checkout cancelled: ${cancelCheckoutId}`);
    console.log(`   Status: ${response.data.status}\n`);

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('✅ All tests passed!');
    console.log('═══════════════════════════════════════\n');

    console.log('Summary:');
    console.log(`• Completed checkout: ${checkoutId}`);
    console.log(`• Cancelled checkout: ${cancelCheckoutId}`);
    console.log(`• All ACP endpoints working correctly\n`);

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}\n`);
    process.exit(1);
  }
}

// Run tests
runTests();

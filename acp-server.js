const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Stripe = require('stripe');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize Stripe (requires STRIPE_SECRET_KEY env var)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');

// In-memory storage for checkout sessions
// In production, use PostgreSQL, MongoDB, or similar
// In-memory storage for checkout sessions
   // In production, use PostgreSQL, MongoDB, or similar
   const checkoutSessions = new Map();
   const orders = new Map();

// Sample product catalog (replace with your actual products)
const productCatalog = {
  item_123: {
    id: 'item_123',
    name: 'Premium T-Shirt',
    price: 2000, // cents ($20.00)
    inventory: 100,
  },
  item_456: {
    id: 'item_456',
    name: 'Classic Hat',
    price: 500, // cents ($5.00)
    inventory: 50,
  },
  item_789: {
    id: 'item_789',
    name: 'Vintage Hoodie',
    price: 4500, // cents ($45.00)
    inventory: 25,
  },
};

// Shipping options
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
  {
    type: 'shipping',
    id: 'shipping_fast',
    title: 'Express Shipping',
    subtitle: '2-3 business days',
    carrier: 'FedEx',
    subtotal: 1500, // $15.00
    tax: 0,
    total: 1500,
  },
  {
    type: 'digital',
    id: 'digital_instant',
    title: 'Digital Delivery',
    subtitle: 'Instant access',
    subtotal: 0,
    tax: 0,
    total: 0,
  },
];

// Helper function to calculate line items
function calculateLineItems(items) {
  return items.map((item) => {
    const product = productCatalog[item.id];
    if (!product) {
      return null;
    }

    const baseAmount = product.price * item.quantity;
    const tax = Math.round(baseAmount * 0.08); // 8% tax
    const discount = 0;

    return {
      id: item.id,
      item,
      base_amount: baseAmount,
      discount,
      subtotal: baseAmount,
      tax,
      total: baseAmount + tax,
    };
  }).filter(Boolean);
}

// Helper function to calculate totals
function calculateTotals(lineItems, fulfillmentOption) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = lineItems.reduce((sum, item) => sum + item.tax, 0);
  const fulfillmentCost = fulfillmentOption?.subtotal || 0;
  const fulfillmentTax = fulfillmentOption?.tax || 0;
  const total = subtotal + tax + fulfillmentCost + fulfillmentTax;

  return [
    {
      type: 'subtotal',
      display_text: 'Subtotal',
      amount: subtotal,
    },
    {
      type: 'fulfillment',
      display_text: fulfillmentOption?.title || 'Shipping',
      amount: fulfillmentCost,
    },
    {
      type: 'tax',
      display_text: 'Tax',
      amount: tax + fulfillmentTax,
    },
    {
      type: 'total',
      display_text: 'Total',
      amount: total,
    },
  ];
}

// Helper function to validate items exist and have inventory
function validateItems(items) {
  const errors = [];
  for (const item of items) {
    const product = productCatalog[item.id];
    if (!product) {
      errors.push({
        type: 'error',
        code: 'missing',
        param: `$.items[?(@.id == '${item.id}')]`,
        content_type: 'plain',
        content: `Product ${item.id} not found`,
      });
    } else if (item.quantity > product.inventory) {
      errors.push({
        type: 'error',
        code: 'out_of_stock',
        param: `$.items[?(@.id == '${item.id}')]`,
        content_type: 'plain',
        content: `Only ${product.inventory} units of ${product.name} available`,
      });
    }
  }
  return errors;
}

// POST /checkouts - Create a new agentic checkout session
app.post('/checkouts', (req, res) => {
  try {
    const { items, buyer, fulfillment_address } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        type: 'invalid_request',
        code: 'missing_items',
        message: 'items array is required and must not be empty',
      });
    }

    // Validate items exist and have inventory
    const itemErrors = validateItems(items);
    if (itemErrors.length > 0) {
      return res.status(400).json({
        type: 'invalid_request',
        code: 'validation_failed',
        message: 'Item validation failed',
        messages: itemErrors,
      });
    }

    // Calculate line items and totals
    const lineItems = calculateLineItems(items);
    const defaultFulfillment = shippingOptions[0];
    const totals = calculateTotals(lineItems, defaultFulfillment);

    // Create checkout session
    const checkoutId = `checkout_${uuidv4().substring(0, 8)}`;
    const session = {
      id: checkoutId,
      buyer: buyer || {
        first_name: 'Guest',
        last_name: 'Buyer',
        email: 'guest@example.com',
      },
      payment_provider: {
        provider: 'stripe',
        supported_payment_methods: ['card'],
      },
      status: 'not_ready_for_payment',
      currency: 'usd',
      line_items: lineItems,
      fulfillment_address: fulfillment_address || null,
      fulfillment_options: shippingOptions,
      fulfillment_option_id: defaultFulfillment.id,
      totals,
      messages: [],
      links: [
        {
          type: 'terms_of_use',
          url: 'https://example.com/terms',
        },
        {
          type: 'privacy_policy',
          url: 'https://example.com/privacy',
        },
      ],
    };

    // Update status based on fulfillment address
    if (fulfillment_address && fulfillment_address.postal_code) {
      session.status = 'ready_for_payment';
    }

    checkoutSessions.set(checkoutId, session);

    res.status(201).json(session);
  } catch (error) {
    console.error('POST /checkouts error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'internal_error',
      message: error.message,
    });
  }
});

// GET /checkouts/:id - Retrieve a checkout session
app.get('/checkouts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const session = checkoutSessions.get(id);

    if (!session) {
      return res.status(404).json({
        type: 'invalid_request',
        code: 'not_found',
        message: `Checkout session ${id} not found`,
      });
    }

    res.json(session);
  } catch (error) {
    console.error('GET /checkouts/:id error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'internal_error',
      message: error.message,
    });
  }
});

// PUT /checkouts/:id - Update a checkout session
app.put('/checkouts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { items, buyer, fulfillment_address, fulfillment_option_id } = req.body;

    const session = checkoutSessions.get(id);
    if (!session) {
      return res.status(404).json({
        type: 'invalid_request',
        code: 'not_found',
        message: `Checkout session ${id} not found`,
      });
    }

    // Update items if provided
    if (items) {
      const itemErrors = validateItems(items);
      if (itemErrors.length > 0) {
        return res.status(400).json({
          type: 'invalid_request',
          code: 'validation_failed',
          message: 'Item validation failed',
          messages: itemErrors,
        });
      }
      session.line_items = calculateLineItems(items);
    }

    // Update buyer if provided
    if (buyer) {
      session.buyer = { ...session.buyer, ...buyer };
    }

    // Update fulfillment address if provided
    if (fulfillment_address) {
      session.fulfillment_address = fulfillment_address;
      session.status = 'ready_for_payment';
    }

    // Update fulfillment option if provided
    if (fulfillment_option_id) {
      const option = shippingOptions.find((opt) => opt.id === fulfillment_option_id);
      if (!option) {
        return res.status(400).json({
          type: 'invalid_request',
          code: 'invalid_fulfillment_option',
          message: `Fulfillment option ${fulfillment_option_id} not found`,
        });
      }
      session.fulfillment_option_id = fulfillment_option_id;
    }

    // Recalculate totals
    const selectedOption = shippingOptions.find(
      (opt) => opt.id === session.fulfillment_option_id
    );
    session.totals = calculateTotals(session.line_items, selectedOption);

    checkoutSessions.set(id, session);
    res.json(session);
  } catch (error) {
    console.error('PUT /checkouts/:id error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'internal_error',
      message: error.message,
    });
  }
});

// POST /checkouts/:id/complete - Complete a checkout
app.post('/checkouts/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const { payment_data } = req.body;

    const session = checkoutSessions.get(id);
    if (!session) {
      return res.status(404).json({
        type: 'invalid_request',
        code: 'not_found',
        message: `Checkout session ${id} not found`,
      });
    }

    // Validate payment data
    if (!payment_data || !payment_data.token || !payment_data.provider) {
      return res.status(400).json({
        type: 'invalid_request',
        code: 'missing_payment_data',
        message: 'payment_data with token and provider is required',
      });
    }

    // In production, process payment with Stripe using the payment token
    // For demo purposes, we'll simulate payment processing
    // Process payment with Stripe
   try {
     console.log(`Processing payment for checkout ${id} with token: ${payment_data.token}`);

     // Calculate total amount from session totals
     const totalAmount = session.totals.find(t => t.type === 'total').amount;

     // Create a payment intent with the token
     const paymentIntent = await stripe.paymentIntents.create({
       amount: totalAmount,
       currency: 'usd',
       payment_method: payment_data.token,
       confirm: true,
       description: `Checkout ${id}`,
     });

     // Check if payment was successful
     if (paymentIntent.status === 'succeeded') {
       // Update checkout status
       session.status = 'completed';
       session.messages.push({
         type: 'info',
         content_type: 'plain',
         content: 'Payment processed successfully',
       });

       // Create order record
       const orderId = `order_${uuidv4().substring(0, 8)}`;
       const order = {
         id: orderId,
         checkout_session_id: id,
         status: 'created',
         payment_intent_id: paymentIntent.id,
         amount: totalAmount,
         buyer: session.buyer,
         line_items: session.line_items,
         fulfillment_address: session.fulfillment_address,
         created_at: new Date().toISOString(),
       };

       orders.set(orderId, order);
       console.log(`Order created: ${orderId}`);

       checkoutSessions.set(id, session);
       res.json(session);
     } else if (paymentIntent.status === 'requires_action') {
       // Payment requires additional action (3D Secure, etc.)
       session.status = 'in_progress';
       session.messages.push({
         type: 'error',
         code: 'requires_3ds',
         content_type: 'plain',
         content: 'Payment requires additional authentication',
       });

       checkoutSessions.set(id, session);
       res.status(400).json(session);
     } else {
       // Payment failed
       session.status = 'in_progress';
       session.messages.push({
         type: 'error',
         code: 'payment_declined',
         content_type: 'plain',
         content: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
       });

       checkoutSessions.set(id, session);
       res.status(400).json(session);
     }
   } catch (stripeError) {
     console.error('Stripe payment error:', stripeError);
     
     session.status = 'in_progress';
     session.messages.push({
       type: 'error',
       code: 'payment_processing_failed',
       content_type: 'plain',
       content: stripeError.message,
     });

     checkoutSessions.set(id, session);

     res.status(400).json({
       type: 'processing_error',
       code: 'payment_processing_failed',
       message: stripeError.message,
     });
   }
  // ---------------------------------------------
  } catch (error) {
    console.error('POST /checkouts/:id/complete error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'payment_processing_failed',
      message: error.message,
    });
  }
});

// POST /checkouts/:id/cancel - Cancel a checkout
app.post('/checkouts/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const session = checkoutSessions.get(id);

    if (!session) {
      return res.status(404).json({
        type: 'invalid_request',
        code: 'not_found',
        message: `Checkout session ${id} not found`,
      });
    }

    session.status = 'canceled';
    session.messages.push({
      type: 'info',
      content_type: 'plain',
      content: 'Checkout cancelled',
    });

    checkoutSessions.set(id, session);
    res.json(session);
  } catch (error) {
    console.error('POST /checkouts/:id/cancel error:', error);
    res.status(500).json({
      type: 'processing_error',
      code: 'internal_error',
      message: error.message,
    });
  }
});
// GET /orders/:id - Retrieve an order
   app.get('/orders/:id', (req, res) => {
     try {
       const { id } = req.params;
       const order = orders.get(id);

       if (!order) {
         return res.status(404).json({
           type: 'invalid_request',
           code: 'not_found',
           message: `Order ${id} not found`,
         });
       }

       res.json(order);
     } catch (error) {
       console.error('GET /orders/:id error:', error);
       res.status(500).json({
         type: 'processing_error',
         code: 'internal_error',
         message: error.message,
       });
     }
   });
   
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ACP Server running on port ${PORT}`);
  console.log(`Create checkout: POST http://localhost:${PORT}/checkouts`);
  console.log(`Retrieve checkout: GET http://localhost:${PORT}/checkouts/:id`);
  console.log(`Update checkout: PUT http://localhost:${PORT}/checkouts/:id`);
  console.log(`Complete checkout: POST http://localhost:${PORT}/checkouts/:id/complete`);
  console.log(`Cancel checkout: POST http://localhost:${PORT}/checkouts/:id/cancel`);
});

module.exports = app;

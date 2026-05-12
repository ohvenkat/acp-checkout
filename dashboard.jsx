import React, { useState, useEffect } from 'react';

export default function AcpDashboard() {
  const API_BASE = 'https://acp.venkatr.cloud';

  // Product Catalog
  const products = [
    { id: 'item_123', name: 'Premium T-Shirt', price: 20.00, inventory: 100 },
    { id: 'item_456', name: 'Classic Hat', price: 5.00, inventory: 50 },
    { id: 'item_789', name: 'Vintage Hoodie', price: 45.00, inventory: 25 },
  ];

  const shippingOptions = [
    { id: 'shipping_standard', name: 'Standard (5-7 days)', cost: 0 },
    { id: 'shipping_fast', name: 'Express (2-3 days)', cost: 15.00 },
    { id: 'digital_instant', name: 'Digital Instant', cost: 0 },
  ];

  // State
  const [cart, setCart] = useState([]);
  const [checkoutId, setCheckoutId] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [step, setStep] = useState('products'); // products, cart, checkout, payment, confirmation
  const [buyerInfo, setBuyerInfo] = useState({
    first_name: '',
    last_name: '',
    email: '',
  });
  const [address, setAddress] = useState({
    name: '',
    line_one: '',
    city: '',
    state: '',
    country: 'US',
    postal_code: '',
  });
  const [selectedShipping, setSelectedShipping] = useState('shipping_standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Add to cart
  const addToCart = (productId) => {
    const existing = cart.find(item => item.id === productId);
    if (existing) {
      setCart(cart.map(item => 
        item.id === productId 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const product = products.find(p => p.id === productId);
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  // Remove from cart
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  // Update quantity
  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item =>
        item.id === productId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  // Calculate totals
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartTax = cartSubtotal * 0.08;
  const shippingCost = shippingOptions.find(s => s.id === selectedShipping)?.cost || 0;
  const cartTotal = cartSubtotal + cartTax + shippingCost;

  // Create checkout
  const createCheckout = async () => {
    setError(null);
    setLoading(true);

    try {
      const items = cart.map(item => ({
        id: item.id,
        quantity: item.quantity,
      }));

      const response = await fetch(`${API_BASE}/checkouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          buyer: buyerInfo,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create checkout');

      setCheckoutId(data.id);
      setCheckoutData(data);
      setStep('checkout');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update checkout with address
  const updateCheckout = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/checkouts/${checkoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fulfillment_address: address,
          fulfillment_option_id: selectedShipping,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update checkout');

      setCheckoutData(data);
      setStep('payment');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Complete checkout (process payment)
  const completeCheckout = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/checkouts/${checkoutId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_data: {
            token: 'tok_visa', // Stripe test card
            provider: 'stripe',
            billing_address: address,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Payment failed');

      setCheckoutData(data);
      setSuccessMessage(`✅ Order placed! Order ID: ${checkoutId}`);
      setStep('confirmation');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset
  const reset = () => {
    setCart([]);
    setCheckoutId(null);
    setCheckoutData(null);
    setStep('products');
    setBuyerInfo({ first_name: '', last_name: '', email: '' });
    setAddress({ name: '', line_one: '', city: '', state: '', country: 'US', postal_code: '' });
    setSelectedShipping('shipping_standard');
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>🛒 ACP Checkout Demo</h1>
        <p>Stripe Agentic Commerce Protocol</p>
      </header>

      {error && <div style={styles.error}>❌ {error}</div>}
      {successMessage && <div style={styles.success}>{successMessage}</div>}

      {/* Step 1: Products */}
      {step === 'products' && (
        <div style={styles.section}>
          <h2>Products</h2>
          <div style={styles.productGrid}>
            {products.map(product => (
              <div key={product.id} style={styles.productCard}>
                <h3>{product.name}</h3>
                <p style={styles.price}>${product.price.toFixed(2)}</p>
                <p style={styles.inventory}>{product.inventory} in stock</p>
                <button
                  onClick={() => addToCart(product.id)}
                  style={styles.button}
                >
                  Add to Cart
                </button>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <button
              onClick={() => setStep('cart')}
              style={{ ...styles.button, ...styles.primaryButton }}
            >
              View Cart ({cart.length} items)
            </button>
          )}
        </div>
      )}

      {/* Step 2: Cart */}
      {step === 'cart' && (
        <div style={styles.section}>
          <h2>Shopping Cart</h2>
          {cart.map(item => (
            <div key={item.id} style={styles.cartItem}>
              <div>
                <strong>{item.name}</strong> × {item.quantity}
                <p style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</p>
              </div>
              <div>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                  style={styles.input}
                />
                <button
                  onClick={() => removeFromCart(item.id)}
                  style={styles.removeButton}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div style={styles.totals}>
            <p>Subtotal: ${cartSubtotal.toFixed(2)}</p>
            <p>Tax (8%): ${cartTax.toFixed(2)}</p>
            <p>Shipping: ${shippingCost.toFixed(2)}</p>
            <h3>Total: ${cartTotal.toFixed(2)}</h3>
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={() => setStep('products')} style={styles.button}>
              Continue Shopping
            </button>
            <button
              onClick={createCheckout}
              disabled={loading}
              style={{ ...styles.button, ...styles.primaryButton }}
            >
              {loading ? 'Creating checkout...' : 'Proceed to Checkout'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Checkout */}
      {step === 'checkout' && (
        <div style={styles.section}>
          <h2>Shipping Details</h2>

          <div style={styles.form}>
            <h3>Shipping Address</h3>
            <input
              type="text"
              placeholder="Full Name"
              value={address.name}
              onChange={(e) => setAddress({ ...address, name: e.target.value })}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="Street Address"
              value={address.line_one}
              onChange={(e) => setAddress({ ...address, line_one: e.target.value })}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="City"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="State"
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="Postal Code"
              value={address.postal_code}
              onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
              style={styles.input}
            />

            <h3>Shipping Option</h3>
            {shippingOptions.map(option => (
              <label key={option.id} style={styles.radio}>
                <input
                  type="radio"
                  name="shipping"
                  value={option.id}
                  checked={selectedShipping === option.id}
                  onChange={(e) => setSelectedShipping(e.target.value)}
                />
                {option.name} (${option.cost.toFixed(2)})
              </label>
            ))}
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={() => setStep('cart')} style={styles.button}>
              Back to Cart
            </button>
            <button
              onClick={updateCheckout}
              disabled={loading || !address.name || !address.line_one || !address.city || !address.state || !address.postal_code}
              style={{ ...styles.button, ...styles.primaryButton }}
            >
              {loading ? 'Processing...' : 'Continue to Payment'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Payment */}
      {step === 'payment' && checkoutData && (
        <div style={styles.section}>
          <h2>Order Summary</h2>

          <div style={styles.summary}>
            <h3>Items</h3>
            {checkoutData.line_items.map(item => (
              <p key={item.id}>
                {item.item.quantity}x {products.find(p => p.id === item.id)?.name}
                <span style={styles.price}>${(item.total / 100).toFixed(2)}</span>
              </p>
            ))}

            <h3>Totals</h3>
            {checkoutData.totals.map(total => (
              <p key={total.type}>
                {total.display_text}
                <span style={total.type === 'total' ? styles.totalPrice : styles.price}>
                  ${(total.amount / 100).toFixed(2)}
                </span>
              </p>
            ))}
          </div>

          <div style={styles.paymentInfo}>
            <h3>💳 Payment</h3>
            <p>Using Stripe test card: <code>tok_visa</code></p>
            <p style={styles.testWarning}>⚠️ This is a test environment. No real charges will be made.</p>
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={() => setStep('checkout')} style={styles.button}>
              Back
            </button>
            <button
              onClick={completeCheckout}
              disabled={loading}
              style={{ ...styles.button, ...styles.primaryButton, ...styles.successButton }}
            >
              {loading ? 'Processing Payment...' : '✅ Complete Purchase'}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Confirmation */}
      {step === 'confirmation' && checkoutData && (
        <div style={styles.section}>
          <div style={styles.confirmationBox}>
            <h2>✅ Order Confirmed!</h2>
            <p>Your order has been placed successfully.</p>

            <div style={styles.confirmationDetails}>
              <p><strong>Order ID:</strong> {checkoutId}</p>
              <p><strong>Status:</strong> {checkoutData.status}</p>
              <p><strong>Total:</strong> ${(checkoutData.totals.find(t => t.type === 'total').amount / 100).toFixed(2)}</p>
              <p><strong>Shipping To:</strong></p>
              <p>
                {checkoutData.fulfillment_address.name}<br />
                {checkoutData.fulfillment_address.line_one}<br />
                {checkoutData.fulfillment_address.city}, {checkoutData.fulfillment_address.state} {checkoutData.fulfillment_address.postal_code}
              </p>
            </div>

            <button
              onClick={reset}
              style={{ ...styles.button, ...styles.primaryButton }}
            >
              Start New Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  error: {
    backgroundColor: '#fee',
    border: '1px solid #f88',
    color: '#c00',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  success: {
    backgroundColor: '#efe',
    border: '1px solid #8f8',
    color: '#060',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  productCard: {
    border: '1px solid #ddd',
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center',
    backgroundColor: '#fafafa',
  },
  price: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#007bff',
    margin: '10px 0',
  },
  totalPrice: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#007bff',
  },
  inventory: {
    color: '#666',
    fontSize: '14px',
  },
  button: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#eee',
    cursor: 'pointer',
    fontSize: '14px',
    marginRight: '10px',
    marginTop: '10px',
  },
  primaryButton: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  successButton: {
    backgroundColor: '#28a745',
  },
  removeButton: {
    padding: '5px 10px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#dc3545',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px',
    marginLeft: '10px',
  },
  cartItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    borderBottom: '1px solid #eee',
  },
  itemPrice: {
    color: '#007bff',
    fontWeight: 'bold',
    marginTop: '5px',
  },
  totals: {
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '4px',
    marginTop: '20px',
    textAlign: 'right',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  input: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  radio: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    cursor: 'pointer',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
  },
  summary: {
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  paymentInfo: {
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d9ff',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  testWarning: {
    color: '#ff6600',
    fontWeight: 'bold',
  },
  confirmationBox: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#f0f8f0',
    borderRadius: '8px',
    border: '2px solid #28a745',
  },
  confirmationDetails: {
    textAlign: 'left',
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '4px',
    margin: '20px 0',
    border: '1px solid #ddd',
  },
};
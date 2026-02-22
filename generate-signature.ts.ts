import crypto from 'crypto';

// Replace these values
const orderId = 'order_SIO6MuA6ltjseS';
const paymentId = 'pay_hello123';

// IMPORTANT: use your TEST key secret
const razorpayKeySecret = 'mwGxtSoju5bnipMYDHXCAMrK';

if (!orderId || !paymentId) {
  throw new Error('orderId and paymentId are required');
}

const body = `${orderId}|${paymentId}`;

const signature = crypto.createHmac('sha256', razorpayKeySecret).update(body).digest('hex');

console.log('----------------------------------');
console.log('Order ID   :', orderId);
console.log('Payment ID :', paymentId);
console.log('Signature  :', signature);
console.log('----------------------------------');

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const app = express();
const db = new Database('shop.db');

db.exec(`
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, stock INTEGER NOT NULL DEFAULT 0, category TEXT, emoji TEXT);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT, role TEXT NOT NULL DEFAULT 'customer');
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, total REAL NOT NULL, status TEXT DEFAULT 'confirmed', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_name TEXT, quantity INTEGER NOT NULL, price REAL NOT NULL);
`);

if (db.prepare('SELECT COUNT(*) as c FROM products').get().c === 0) {
  const ins = db.prepare('INSERT INTO products (name, description, price, stock, category, emoji) VALUES (?,?,?,?,?,?)');
  [['Dell XPS 15 Laptop','High-performance laptop with RTX graphics',1899,5,'Laptops','💻'],
   ['MacBook Air M3','Thin, light, incredibly fast',1299,3,'Laptops','💻'],
   ['HP LaserJet Printer','Reliable office printer',349,0,'Printers','🖨️'],
   ['Logitech MX Master 3','Ergonomic wireless mouse',99,12,'Accessories','🖱️'],
   ['Keychron K2 Keyboard','Compact mechanical keyboard',89,8,'Accessories','⌨️'],
   ['Sony WH-1000XM5','Industry-leading noise cancellation',399,4,'Audio','🎧'],
   ['iPad Pro 12.9"','Powerful tablet with M2 chip',1099,6,'Tablets','📱'],
   ['Samsung 4K Monitor','32-inch UHD display',599,2,'Monitors','🖥️']].forEach(r => ins.run(...r));
  db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)')
    .run('admin@lexdemo.com', bcrypt.hashSync('admin123',10), 'Admin', 'admin');
  db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)')
    .run('customer@lexdemo.com', bcrypt.hashSync('customer123',10), 'Test Customer', 'customer');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'lexdemo', resave: false, saveUninitialized: true }));

function getUser(req) {
  if (!req.session.userId) return null;
  return db.prepare('SELECT id,email,name,role FROM users WHERE id=?').get(req.session.userId);
}
function requireLogin(req,res,next){ if(!req.session.userId) return res.redirect('/login'); next(); }

function layout(title, body, user, wishlistCount = 0) {
  return `<!DOCTYPE html><html><head><title>${title} — LexDemo</title><style>/* CSS omitted */</style></head><body>
<nav><div><a href="/" class="brand">🛒 LexDemo</a></div><div>
<a href="/">Home</a><a href="/products">Products</a>
${user ? `<a href="/orders">My Orders</a>${user.role==='admin'?'<a href="/admin">Admin</a>':''}<a href="/logout">Logout (${user.name})</a>` : `<a href="/login">Login</a><a href="/register">Register</a>`}
<a href="/wishlist">Wishlist (${wishlistCount})</a>
<a href="/cart">Cart</a>
</div></nav><div class="container">${body}</div></body></html>`;
}

function renderCard(p){
  return `<div class="card" data-testid="product-${p.id}"><div class="emoji">${p.emoji}</div><div class="name">${p.name}</div><div class="desc">${p.description}</div><div class="price">$${p.price}</div><div class="stock">${p.stock>0?p.stock+' in stock':'Out of stock'}</div><form method="POST" action="/cart/add" style="margin-top:12px"><input type="hidden" name="productId" value="${p.id}"/><button ${p.stock===0?'disabled':''} data-testid="add-${p.id}">${p.stock===0?'Out of stock':'Add to Cart'}</button></form><form method="POST" action="/wishlist/toggle" style="margin-top:4px"><input type="hidden" name="productId" value="${p.id}"/><button type="submit" data-testid="wishlist-${p.id}">❤️</button></form><a href="/products/${p.id}" style="font-size:13px;color:#00b48b;margin-top:8px;text-decoration:none">View details →</a></div>`;
}

app.get('/', (req,res)=>{
  const u=getUser(req);
  const wCount=(req.session.wishlist||[]).length;
  res.send(layout('Home',`<div class="hero"><h1>Welcome to LexDemo Shop</h1><p>Premium tech gear for modern professionals</p></div><h2>Featured Products</h2><div class="grid">${db.prepare('SELECT * FROM products LIMIT 4').all().map(renderCard).join('')}</div>`,u,wCount));
});

app.get('/products',(req,res)=>{
  const u=getUser(req);
  const wCount=(req.session.wishlist||[]).length;
  const q=req.query.q||'';
  const list=q?db.prepare('SELECT * FROM products WHERE name LIKE ? OR category LIKE ?').all(`%${q}%`,`%${q}%`):db.prepare('SELECT * FROM products').all();
  res.send(layout('Products',`<h1>All Products (${list.length})</h1><form class="search-bar" method="GET"><input name="q" placeholder="Search products..." value="${q}" data-testid="search-input"/><button data-testid="search-btn">Search</button></form>${list.length===0?'<div class="empty">No products found</div>':`<div class="grid" data-testid="product-grid">${list.map(renderCard).join('')}</div>`}`,u,wCount));
});

app.get('/products/:id',(req,res)=>{
  const u=getUser(req);
  const wCount=(req.session.wishlist||[]).length;
  const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if(!p) return res.status(404).send(layout('Not Found','<div class="empty">Not found</div>',u,wCount));
  res.send(layout(p.name,`<div class="detail" data-testid="product-detail"><div class="emoji">${p.emoji}</div><div><h1 data-testid="product-name">${p.name}</h1><div style="color:#5a6b7b;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-top:8px">${p.category}</div><div class="price" data-testid="product-price">$${p.price}</div><p class="desc">${p.description}</p><p style="margin-bottom:24px;color:#5a6b7b">${p.stock>0?p.stock+' in stock':'Out of stock'}</p><form method="POST" action="/cart/add"><input type="hidden" name="productId" value="${p.id}"/><button ${p.stock===0?'disabled':''} data-testid="add-to-cart">${p.stock===0?'Out of stock':'Add to Cart'}</button></form><form method="POST" action="/wishlist/toggle" style="margin-top:8px"><input type="hidden" name="productId" value="${p.id}"/><button type="submit" data-testid="wishlist-${p.id}">❤️</button></form></div></div>`,u,wCount));
});

app.post('/cart/add',(req,res)=>{
  const pid=parseInt(req.body.productId);
  const p=db.prepare('SELECT * FROM products WHERE id=?').get(pid);
  if(!p||p.stock===0) return res.redirect('/products');
  req.session.cart=req.session.cart||[];
  const ex=req.session.cart.find(i=>i.productId===pid);
  if(ex) ex.quantity+=1; else req.session.cart.push({productId:pid,quantity:1});
  res.redirect('/cart');
});

app.get('/cart',(req,res)=>{
  const u=getUser(req);
  const wCount=(req.session.wishlist||[]).length;
  const cart=req.session.cart||[];
  const items=cart.map(i=>{ const p=db.prepare('SELECT * FROM products WHERE id=?').get(i.productId); return {...i,product:p,subtotal:p.price*i.quantity}; });
  const total=items.reduce((s,i)=>s+i.subtotal,0);
  res.send(layout('Cart',`<h1>Your Cart</h1>${items.length===0?'<div class="empty"><p>Your cart is empty</p><a href="/products" class="btn" style="margin-top:16px">Browse products</a></div>':`<table data-testid="cart-table"><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead><tbody>${items.map(i=>`<tr><td>${i.product.emoji} ${i.product.name}</td><td>$${i.product.price}</td><td>${i.quantity}</td><td>$${i.subtotal.toFixed(2)}</td><td><form method="POST" action="/cart/remove" style="display:inline"><input type="hidden" name="productId" value="${i.product.id}"/><button class="danger" style="padding:6px 12px;font-size:12px">Remove</button></form></td></tr>`).join('')}</tbody></table><div style="text-align:right;margin-top:24px;font-size:20px"><strong>Total: $<span data-testid="cart-total">${total.toFixed(2)}</span></strong></div><div style="text-align:right;margin-top:16px"><a href="/checkout" class="btn" data-testid="checkout-btn">Proceed to Checkout</a></div>`}`,u,wCount));
});

app.post('/cart/remove',(req,res)=>{
  const pid=parseInt(req.body.productId);
  req.session.cart=(req.session.cart||[]).filter(i=>i.productId!==pid);
  res.redirect('/cart');
});

app.get('/checkout',requireLogin,(req,res)=>{
  const u=getUser(req);
  const wCount=(req.session.wishlist||[]).length;
  const cart=req.session.cart||[];
  if(cart.length===0) return res.redirect('/cart');
  const items=cart.map(i=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(i.productId);return{...i,product:p,subtotal:p.price*i.quantity};});
  const total=items.reduce((s,i)=>s+i.subtotal,0);
  res.send(layout('Checkout',`<h1>Checkout</h1><form method="POST" action="/checkout" class="form-card" style="max-width:600px"><div class="form-group"><label>Full Name</label><input name="name" value="${u.name}" required data-testid="checkout-name"/></div><div class="form-group"><label>Shipping Address</label><textarea name="address" rows="3" required data-testid="checkout-address">123 Main Street, Springfield</textarea></div><div class="form-group"><label>Payment Method</label><select name="payment" data-testid="checkout-payment"><option>Credit Card</option><option>PayPal</option></select></div><div style="border-top:1px solid #eef2f5;padding-top:16px;margin-top:16px;display:flex;justify-content:space-between;font-size:18px"><strong>Total</strong><strong style="color:#00b48b">$${total.toFixed(2)}</strong></div><button style="width:100%;margin-top:20px" data-testid="place-order-btn">Place Order</button></form>`,u,wCount));
});

app.post('/checkout',requireLogin,(req,res)=>{
  const u=getUser(req);
  const cart=req.session.cart||[];
  if(cart.length===0) return
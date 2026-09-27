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

function layout(title, body, user) {
  return `<!DOCTYPE html><html><head><title>${title} — LexDemo</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;color:#1a2332;min-height:100vh}
nav{background:#0f2027;color:white;padding:16px 32px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.1);position:sticky;top:0;z-index:100}
nav a{color:white;text-decoration:none;margin-left:20px;font-size:14px}
nav a:hover{color:#00b48b}
nav .brand{font-size:20px;font-weight:700;color:#00b48b}
nav .cart-badge{background:#00b48b;padding:2px 8px;border-radius:12px;font-size:12px;margin-left:4px}
.container{max-width:1200px;margin:0 auto;padding:32px}
h1{font-size:28px;margin-bottom:24px;color:#0f2027}h2{font-size:22px;margin:24px 0 16px;color:#0f2027}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}
.card{background:white;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);transition:transform .15s;display:flex;flex-direction:column}
.card:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.1)}
.card .emoji{font-size:48px;text-align:center;margin:12px 0}
.card .name{font-size:16px;font-weight:600;margin-bottom:6px}
.card .desc{font-size:13px;color:#5a6b7b;margin-bottom:12px;flex:1}
.card .price{font-size:20px;font-weight:700;color:#00b48b}
.card .stock{font-size:12px;color:#5a6b7b;margin-top:4px}
.card button{margin-top:12px}
button,.btn{background:#00b48b;color:white;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;text-decoration:none;display:inline-block}
button:hover{background:#009978}button:disabled{background:#ccc;cursor:not-allowed}
button.danger{background:#d9534f}
input,textarea,select{padding:10px 14px;border:1px solid #d0d8df;border-radius:8px;font-size:14px;width:100%;font-family:inherit}
input:focus{outline:none;border-color:#00b48b}
.search-bar{display:flex;gap:8px;margin-bottom:24px}.search-bar input{flex:1;font-size:16px}
table{width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)}
th{background:#0f2027;color:white;text-align:left;padding:12px 16px;font-size:13px;text-transform:uppercase;letter-spacing:.5px}
td{padding:12px 16px;border-bottom:1px solid #eef2f5;font-size:14px}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase}
.badge.green{background:#d4f4ea;color:#00856a}
.form-card{background:white;padding:32px;border-radius:12px;max-width:420px;margin:40px auto;box-shadow:0 4px 16px rgba(0,0,0,.08)}
.form-card h1{text-align:center;margin-bottom:24px}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#5a6b7b}
.error{background:#fde8e8;color:#c43d38;padding:12px;border-radius:8px;margin-bottom:16px;font-size:14px}
.success{background:#d4f4ea;color:#00856a;padding:12px;border-radius:8px;margin-bottom:16px;font-size:14px}
.empty{text-align:center;padding:60px 20px;color:#8899a6}
.hero{background:linear-gradient(135deg,#00b48b,#007a5e);color:white;padding:60px 32px;border-radius:16px;margin-bottom:32px;text-align:center}
.free-shipping-banner{background:#00856a;color:#d4f4ea;padding:8px 16px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;margin-top:16px}
.hero-badge{display:inline-block;background:#d4f4ea;color:#00856a;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600;margin-top:16px}
.hero h1{color:white;font-size:36px;margin-bottom:12px}.hero p{font-size:16px;opacity:.9}
.detail{display:grid;grid-template-columns:1fr 1fr;gap:40px;background:white;padding:32px;border-radius:12px}
.detail .emoji{font-size:200px;text-align:center}
.detail h1{font-size:32px}.detail .price{font-size:36px;color:#00b48b;font-weight:700;margin:16px 0}
.detail .desc{color:#5a6b7b;line-height:1.6;margin-bottom:24px}
</style></head><body>
<nav><div><a href="/" class="brand">🛒 LexDemo</a></div><div>
<a href="/">Home</a><a href="/products">Products</a>
${user ? `<a href="/orders">My Orders</a>${user.role==='admin'?'<a href="/admin">Admin</a>':''}<a href="/logout">Logout (${user.name})</a>` : `<a href="/login">Login</a><a href="/register">Register</a>`}
<a href="/cart">Cart</a>
</div></nav><div class="container">${body}</div></body></html>`;
}

function renderCard(p){
  return `<div class="card" data-testid="product-${p.id}"><div class="emoji">${p.emoji}</div><div class="name">${p.name}</div><div class="desc">${p.description}</div><div class="price">$${p.price}</div><div class="stock">${p.stock>0?p.stock+' in stock':'Out of stock'}</div><form method="POST" action="/cart/add" style="margin-top:12px"><input type="hidden" name="productId" value="${p.id}"/><button ${p.stock===0?'disabled':''} data-testid="add-${p.id}">${p.stock===0?'Out of stock':'Add to Cart'}</button></form><a href="/products/${p.id}" style="font-size:13px;color:#00b48b;margin-top:8px;text-decoration:none">View details →</a></div>`;
}

app.get('/', (req,res)=>{ const u=getUser(req); res.send(layout('Home',`<div class="hero"><h1>Welcome to LexDemo Shop</h1><p>Premium tech gear for modern professionals</p><div class="free-shipping-banner" data-testid="free-shipping-banner">Free shipping on orders over $50</div><div class="hero-badge" data-testid="shipping-badge">Free shipping on orders over $50</div></div><h2>Featured Products</h2><div class="grid">${db.prepare('SELECT * FROM products LIMIT 4').all().map(renderCard).join('')}</div>`,u)); });

app.get('/products',(req,res)=>{ const u=getUser(req); const q=req.query.q||''; const list=q?db.prepare('SELECT * FROM products WHERE name LIKE ? OR category LIKE ?').all(`%${q}%`,`%${q}%`):db.prepare('SELECT * FROM products').all(); res.send(layout('Products',`<h1>All Products (${list.length})</h1><form class="search-bar" method="GET"><input name="q" placeholder="Search products..." value="${q}" data-testid="search-input"/><button data-testid="search-btn">Search</button></form>${list.length===0?'<div class="empty">No products found</div>':`<div class="grid" data-testid="product-grid">${list.map(renderCard).join('')}</div>`}`,u)); });

app.get('/products/:id',(req,res)=>{ const u=getUser(req); const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id); if(!p) return res.status(404).send(layout('Not Found','<div class="empty">Not found</div>',u)); res.send(layout(p.name,`<div class="detail" data-testid="product-detail"><div class="emoji">${p.emoji}</div><div><h1 data-testid="product-name">${p.name}</h1><div style="color:#5a6b7b;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-top:8px">${p.category}</div><div class="price" data-testid="product-price">$${p.price}</div><p class="desc">${p.description}</p><p style="margin-bottom:24px;color:#5a6b7b">${p.stock>0?p.stock+' in stock':'Out of stock'}</p><form method="POST" action="/cart/add"><input type="hidden" name="productId" value="${p.id}"/><button ${p.stock===0?'disabled':''} data-testid="add-to-cart">${p.stock===0?'Out of stock':'Add to Cart'}</button></form></div></div>`,u)); });

app.post('/cart/add',(req,res)=>{ const pid=parseInt(req.body.productId); const p=db.prepare('SELECT * FROM products WHERE id=?').get(pid); if(!p||p.stock===0) return res.redirect('/products'); req.session.cart=req.session.cart||[]; const ex=req.session.cart.find(i=>i.productId===pid); if(ex) ex.quantity+=1; else req.session.cart.push({productId:pid,quantity:1}); res.redirect('/cart'); });

app.get('/cart',(req,res)=>{ const u=getUser(req); const cart=req.session.cart||[]; const items=cart.map(i=>{ const p=db.prepare('SELECT * FROM products WHERE id=?').get(i.productId); return {...i,product:p,subtotal:p.price*i.quantity}; }); const total=items.reduce((s,i)=>s+i.subtotal,0); res.send(layout('Cart',`<h1>Your Cart</h1>${items.length===0?'<div class="empty"><p>Your cart is empty</p><a href="/products" class="btn" style="margin-top:16px">Browse products</a></div>':`<table data-testid="cart-table"><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead><tbody>${items.map(i=>`<tr><td>${i.product.emoji} ${i.product.name}</td><td>$${i.product.price}</td><td>${i.quantity}</td><td>$${i.subtotal.toFixed(2)}</td><td><form method="POST" action="/cart/remove" style="display:inline"><input type="hidden" name="productId" value="${i.product.id}"/><button class="danger" style="padding:6px 12px;font-size:12px">Remove</button></form></td></tr>`).join('')}</tbody></table><div style="text-align:right;margin-top:24px;font-size:20px"><strong>Total: $<span data-testid="cart-total">${total.toFixed(2)}</span></strong></div><div style="text-align:right;margin-top:16px"><a href="/checkout" class="btn" data-testid="checkout-btn">Proceed to Checkout</a></div>`}`,u)); });

app.post('/cart/remove',(req,res)=>{ const pid=parseInt(req.body.productId); req.session.cart=(req.session.cart||[]).filter(i=>i.productId!==pid); res.redirect('/cart'); });

app.get('/checkout',requireLogin,(req,res)=>{ const u=getUser(req); const cart=req.session.cart||[]; if(cart.length===0) return res.redirect('/cart'); const items=cart.map(i=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(i.productId);return{...i,product:p,subtotal:p.price*i.quantity};}); const total=items.reduce((s,i)=>s+i.subtotal,0); res.send(layout('Checkout',`<h1>Checkout</h1><form method="POST" action="/checkout" class="form-card" style="max-width:600px"><div class="form-group"><label>Full Name</label><input name="name" value="${u.name}" required data-testid="checkout-name"/></div><div class="form-group"><label>Shipping Address</label><textarea name="address" rows="3" required data-testid="checkout-address">123 Main Street, Springfield</textarea></div><div class="form-group"><label>Payment Method</label><select name="payment" data-testid="checkout-payment"><option>Credit Card</option><option>PayPal</option></select></div><div style="border-top:1px solid #eef2f5;padding-top:16px;margin-top:16px;display:flex;justify-content:space-between;font-size:18px"><strong>Total</strong><strong style="color:#00b48b">$${total.toFixed(2)}</strong></div><button style="width:100%;margin-top:20px" data-testid="place-order-btn">Place Order</button></form>`,u)); });

app.post('/checkout',requireLogin,(req,res)=>{ const u=getUser(req); const cart=req.session.cart||[]; if(cart.length===0) return res.redirect('/cart'); const items=cart.map(i=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(i.productId);return{...i,product:p,subtotal:p.price*i.quantity};}); const total=items.reduce((s,i)=>s+i.subtotal,0); const r=db.prepare('INSERT INTO orders (user_id,total,status) VALUES (?,?,?)').run(u.id,total,'confirmed'); const oid=r.lastInsertRowid; const ins=db.prepare('INSERT INTO order_items (order_id,product_id,product_name,quantity,price) VALUES (?,?,?,?,?)'); for(const it of items){ ins.run(oid,it.product.id,it.product.name,it.quantity,it.product.price); db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(it.quantity,it.product.id); } req.session.cart=[]; res.redirect('/orders/'+oid); });

app.get('/orders',requireLogin,(req,res)=>{ const u=getUser(req); const list=db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(u.id); res.send(layout('My Orders',`<h1>My Orders (${list.length})</h1>${list.length===0?'<div class="empty">No orders yet</div>':`<table data-testid="orders-table"><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${list.map(o=>`<tr><td>#${o.id}</td><td>${new Date(o.created_at).toLocaleDateString()}</td><td>$${o.total.toFixed(2)}</td><td><span class="badge green">${o.status}</span></td><td><a href="/orders/${o.id}">View →</a></td></tr>`).join('')}</tbody></table>`}`,u)); });

app.get('/orders/:id',requireLogin,(req,res)=>{ const u=getUser(req); const o=db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id); if(!o||(o.user_id!==u.id&&u.role!=='admin')) return res.status(404).send(layout('Not Found','<div class="empty">Not found</div>',u)); const items=db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id); res.send(layout('Order #'+o.id,`<div class="success" style="font-size:18px;padding:20px">✅ Order #${o.id} confirmed!</div><h2>Order Details</h2><table><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead><tbody>${items.map(i=>`<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>$${i.price}</td><td>$${(i.quantity*i.price).toFixed(2)}</td></tr>`).join('')}</tbody></table><div style="text-align:right;margin-top:24px;font-size:20px"><strong>Total: $<span data-testid="order-total">${o.total.toFixed(2)}</span></strong></div>`,u)); });

app.get('/login',(req,res)=>{ const e=req.query.error; res.send(layout('Sign In',`<div class="form-card"><h1>Sign In</h1>${e?`<div class="error">${e}</div>`:''}<form method="POST" action="/login"><div class="form-group"><label>Email</label><input name="email" type="email" required data-testid="login-email"/></div><div class="form-group"><label>Password</label><input name="password" type="password" required data-testid="login-password"/></div><button style="width:100%" data-testid="login-submit">Sign In</button></form><p style="text-align:center;margin-top:20px;font-size:13px;color:#5a6b7b">customer@lexdemo.com / customer123<br>admin@lexdemo.com / admin123</p><p style="text-align:center;margin-top:12px;font-size:13px">No account? <a href="/register" style="color:#00b48b">Register</a></p></div>`,null)); });

app.post('/login',(req,res)=>{ const {email,password}=req.body; const u=db.prepare('SELECT * FROM users WHERE email=?').get(email); if(!u||!bcrypt.compareSync(password,u.password_hash)) return res.redirect('/login?error=Invalid+credentials'); req.session.userId=u.id; res.redirect('/'); });

app.get('/register',(req,res)=>{ res.send(layout('Register',`<div class="form-card"><h1>Create Account</h1><form method="POST" action="/register"><div class="form-group"><label>Name</label><input name="name" required data-testid="register-name"/></div><div class="form-group"><label>Email</label><input name="email" type="email" required data-testid="register-email"/></div><div class="form-group"><label>Password</label><input name="password" type="password" required minlength="6" data-testid="register-password"/></div><button style="width:100%" data-testid="register-submit">Create Account</button></form></div>`,null)); });

app.post('/register',(req,res)=>{ const {name,email,password}=req.body; try{ const r=db.prepare('INSERT INTO users (email,password_hash,name,role) VALUES (?,?,?,?)').run(email,bcrypt.hashSync(password,10),name,'customer'); req.session.userId=r.lastInsertRowid; res.redirect('/'); }catch(e){ res.redirect('/register?error=Email+exists'); } });

app.get('/logout',(req,res)=>{ req.session.destroy(); res.redirect('/'); });

app.get('/admin',requireLogin,(req,res)=>{ const u=getUser(req); if(u.role!=='admin') return res.status(403).send(layout('Forbidden','<div class="empty">Admin only</div>',u)); const orders=db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all(); const products=db.prepare('SELECT * FROM products').all(); const rev=orders.reduce((s,o)=>s+o.total,0); res.send(layout('Admin',`<h1>Admin Dashboard</h1><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:32px"><div class="card"><div style="font-size:32px;font-weight:700;color:#00b48b">${orders.length}</div><div style="color:#5a6b7b;font-size:13px">Total Orders</div></div><div class="card"><div style="font-size:32px;font-weight:700;color:#00b48b">$${rev.toFixed(2)}</div><div style="color:#5a6b7b;font-size:13px">Revenue</div></div><div class="card"><div style="font-size:32px;font-weight:700;color:#00b48b">${products.length}</div><div style="color:#5a6b7b;font-size:13px">Products</div></div></div>`,u)); });

app.post('/api/_test/reset',(req,res)=>{ req.session.cart=[]; db.prepare('DELETE FROM order_items').run(); db.prepare('DELETE FROM orders').run(); const stocks={1:5,2:3,3:0,4:12,5:8,6:4,7:6,8:2}; for(const [id,st] of Object.entries(stocks)) db.prepare('UPDATE products SET stock=? WHERE id=?').run(st,id); res.json({ok:true}); });
app.post('/api/_test/break',(req,res)=>{ db.prepare('UPDATE products SET stock=0').run(); res.json({ok:true}); });
app.post('/api/_test/fix',(req,res)=>{ const s={1:5,2:3,3:0,4:12,5:8,6:4,7:6,8:2}; for(const [id,st] of Object.entries(s)) db.prepare('UPDATE products SET stock=? WHERE id=?').run(st,id); res.json({ok:true}); });
app.get('/health',(req,res)=>res.json({status:'ok'}));

const PORT=process.env.PORT||4000;
app.listen(PORT,()=>console.log(`🛒 LexDemo Shop running at http://localhost:${PORT}`));

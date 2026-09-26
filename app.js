const express = require('express');
const {session} = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({secret:'lexdemo',resave:false,saveUninitialized:true}));
app.use((req,res,next)=>{ req.user=req.session.userId?db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId):null; next(); });

const getUser = (req) => { if(!req.user||!req.user.email) return null; return req.user; };
const requireLogin = (req, res, next) => { if(!req.session.userId) return res.status(401).send('Unauthorized'); next(); };

const layout = (title, body, user, wishlistCount = 0) => {
    return `<html><head><title>${title}</title><style>body{font-family:sans-serif;padding:20px;max-width:1200px;margin:0 auto} .card{border:1px solid #ddd;padding:16px;border-radius:8px} nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:10px;background:#f8f9fa}</style></head><body><nav><strong>LexDemo Shop</strong><div>${user ? `<span>Welcome, ${user.email}</span>` : ''} <a href="/" style="margin-left:10px">❤️ Wishlist (${wishlistCount})</a></div></nav>${body}<script>
    async function addToCart(id){ await fetch('/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:id,quantity:1})}); location.reload(); }
    async function removeFromCart(id){ await fetch('/api/cart/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:id})}); location.reload(); }
    async function toggleWishlist(id){ await fetch('/api/wishlist/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:id})}); location.reload(); }
    function showCart(){ location.href='/cart'; }
    async function checkout(){ await fetch('/api/cart/checkout',{method:'POST'}); location.href='/orders'; }
    </script></body></html>`;
};

app.get('/',requireLogin,(req,res)=>{ const u=getUser(req); const cart=req.session.cart||[]; const items=db.prepare('SELECT * FROM products').all(); const wishlisted=u?db.prepare('SELECT product_id FROM wishlists WHERE user_id=?').all(u.id).map(w=>w.product_id):[]; const wCount=wishlisted.length; res.send(layout('Home',`<h1>Welcome to LexDemo Shop</h1><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px">${items.map(i=>`<div class="card" data-testid="product-card-${i.id}"><img src="/images/products/${i.image}" alt="${i.name}"/><h3>${i.name}</h3><p style="color:#5a6b7b">${i.description.substring(0,100)}...</p><div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span style="font-size:24px;font-weight:700;color:#00b48b">$${i.price.toFixed(2)}</span><div style="display:flex;gap:8px"><button data-testid="wishlist-${i.id}" onclick="toggleWishlist(${i.id})">${wishlisted.includes(i.id)?'❤️':'🤍'}</button><button data-testid="add-to-cart-${i.id}" onclick="addToCart(${i.id})">Add to Cart</button></div></div><p style="color:#5a6b7b;font-size:13px;margin-top:8px">Stock: ${i.stock}</p></div>`).join('')}</div>${cart.length?`<div style="position:fixed;bottom:20px;right:20px;z-index:100"><button data-testid="view-cart" onclick="showCart()">🛒 Cart (${cart.length})</button></div>`:''}`,u,wCount)); });

app.get('/cart',requireLogin,(req,res)=>{ const u=getUser(req); const cart=req.session.cart||[]; const items=db.prepare('SELECT * FROM products WHERE id IN (?)').all(cart.map(i=>i.product_id)); const wCount=u?db.prepare('SELECT count(*) as cnt FROM wishlists WHERE user_id=?').get(u.id).cnt:0; res.send(layout('Cart',`<h1>Shopping Cart</h1><div style="display:grid;grid-template-columns:2fr 1fr;gap:32px"><div><table data-testid="cart-table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead><tbody>${items.map(i=>`<tr><td>${i.name}</td><td>$${i.price.toFixed(2)}</td><td>${i.stock}</td><td><button data-testid="remove-cart-${i.id}" onclick="removeFromCart(${i.id})">Remove</button></td></tr>`).join('')}</tbody></table></div><div style="background:#f5f5f5;padding:24px;border-radius:8px"><h3>Order Summary</h3><p data-testid="cart-total">Total: $${(items.reduce((s,i)=>s+i.price*i.quantity,0)).toFixed(2)}</p><button data-testid="checkout" onclick="checkout()">Checkout</button></div></div>`,u,wCount)); });

app.post('/api/cart/add',(req,res)=>{ const {product_id,quantity}=req.body; if(!getUser(req)) return res.status(401).send('Unauthorized'); const u=getUser(req); const p=db.prepare('SELECT * FROM products WHERE id=?').get(product_id); if(!p||p.stock<quantity) return res.status(400).send('Product out of stock'); const cart=req.session.cart||[]; const idx=cart.findIndex(i=>i.product_id===product_id); if(idx!==-1){ cart[idx].quantity+=quantity; }else{ cart.push({product_id,quantity}); } req.session.cart=cart; res.json({ok:true}); });

app.post('/api/cart/remove',(req,res)=>{ const {product_id}=req.body; if(!getUser(req)) return res.status(401).send('Unauthorized'); const u=getUser(req); const cart=req.session.cart||[]; const idx=cart.findIndex(i=>i.product_id===product_id); if(idx!==-1){ cart.splice(idx,1); }req.session.cart=cart; res.json({ok:true}); });

app.post('/api/cart/checkout',(req,res)=>{ const u=getUser(req); if(!u) return res.status(401).send('Unauthorized'); const cart=req.session.cart||[]; if(cart.length===0) return res.status(400).send('Cart is empty'); const items=cart.map(i=>db.prepare('SELECT * FROM products WHERE id=?').get(i.product_id)); const total=items.reduce((s,i)=>s+i.price*i.quantity,0); const o=db.prepare('INSERT INTO orders (user_id,total,status) VALUES (?,?,?)').run(u.id,total,'pending'); const oid=o.lastInsertRowid; const ins=db.prepare('INSERT INTO order_items (order_id,product_id,product_name,quantity,price) VALUES (?,?,?,?,?)'); for(const it of items){ ins.run(oid,it.id,it.name,it.quantity,it.price); db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(it.quantity,it.id); } req.session.cart=[]; res.redirect('/orders/'+oid); });

app.get('/orders',requireLogin,(req,res)=>{ const u=getUser(req); const list=db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(u.id); const wCount=db.prepare('SELECT count(*) as cnt FROM wishlists WHERE user_id=?').get(u.id).cnt; res.send(layout('Orders',`<h1>Your Orders</h1>${list.map(o=>`<div style="border:1px solid #ddd;padding:10px;margin-bottom:10px">Order #${o.id} - ${o.status} - Total: $${o.total.toFixed(2)}</div>`).join('')}`,u,wCount)); });

app.post('/api/wishlist/toggle',(req,res)=>{ const {product_id}=req.body; const u=getUser(req); if(!u) return res.status(401).send('Unauthorized'); const existing=db.prepare('SELECT * FROM wishlists WHERE user_id=? AND product_id=?').get(u.id,product_id); if(existing){ db.prepare('DELETE FROM wishlists WHERE user_id=? AND product_id=?').run(u.id,product_id); }else{ db.prepare('INSERT INTO wishlists (user_id, product_id) VALUES (?,?)').run(u.id,product_id); } res.json({ok:true}); });

app.post('/api/_test/reset', (req, res) => { db.prepare('DELETE FROM wishlists').run(); db.prepare('DELETE FROM order_items').run(); db.prepare('DELETE FROM orders').run(); res.json({ok: true}); });
app.post('/api/_test/break', (req, res) => { res.status(500).send('Broken'); });
app.post('/api/_test/fix', (req, res) => { res.json({ok: true}); });
app.get('/health', (req, res) => { res.send('OK'); });

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {});
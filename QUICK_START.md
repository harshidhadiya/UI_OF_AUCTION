# Quick Start Guide

## 1️⃣ Installation (2 minutes)

```bash
# Install dependencies
npm install
# or
pnpm install

# Start development server
npm run dev
```

Visit: **http://localhost:3000**

---

## 2️⃣ Test the App (5 minutes)

### Create User Account
```
Email: testuser@example.com
Password: TestPass123!
Name: Test User
```

Click "Register" → Auto-logs in → See home page ✅

### Create a Product
1. Click "Create Product" tab
2. Fill form:
   - Name: "Vintage Watch"
   - Description: "Swiss automatic, 1960s"
   - Base Price: 500
   - Category: 1
3. Click "Create Product"
4. Go to "My Products" → See product with "⏳ Pending" badge ✅

---

## 3️⃣ Admin Verification (5 minutes)

### Login as Admin
```
Email: admin@example.com
Password: adminpass
```

1. Click "Dashboard" tab → See stats
2. Click "Verify Products" tab
3. Click "Verify" on the pending product
4. Product moves to "Verified" tab ✅

### Switch back to User
- Logout
- Login as user
- "My Products" now shows "✓ Verified" ✅

---

## 4️⃣ Create & Bid on Auction (10 minutes)

### Create Auction (as User with Verified Product)
1. Go to "Create Product" → Already have verified product
2. In real app: Click "Create Auction" button on product
   - Starting Price: $500
   - Reserve Price: $1000
   - Min Increment: $50
   - Duration: 24 hours
3. Auction goes to "Upcoming" status ✅

### Browse Auctions (as any user)
1. Click "Auctions" tab
2. See all auctions with status badges
3. Click "View Details" on any Live auction ✅

### Place a Bid (Real-Time!)
1. Open auction detail
2. SignalR connects → See "Connected" status
3. Enter bid amount
4. Click "Place Bid"
5. See bid appear in history instantly ✅
6. Open same auction in another browser → See bid update in real-time ✅

---

## 5️⃣ Real-Time Features (3 minutes)

### Test Live Viewer Count
1. Open auction in 2 browser tabs
2. See viewer count: "2 people watching"
3. Close one tab
4. See viewer count update to: "1 person watching" ✅

### Test Bid Updates
1. Place bid in Tab A
2. Watch Tab B update automatically (no refresh!) ✅
3. See bid history update in real-time ✅

### Test Messages
1. When bid placed in last 2 min
2. See auto-extend message
3. See timer reset ✅

---

## 🏗️ What's Under the Hood

### Frontend Files
```
components/
  ├── auth/               Login, Register
  ├── products/           Create & List Products
  ├── auctions/           Browse & Detail Auctions
  ├── admin/              Verify Products & Admins
  └── user/               User Profile

hooks/
  ├── useAuthStore.ts     Auth state + login/logout
  └── useAuction.ts       Real-time SignalR connection

lib/
  └── api-client.ts       All 50+ API endpoints

types/
  └── index.ts            Complete TypeScript interfaces
```

### Backend Services
```
API Gateway (5000)
  ├─ User Service (8080)
  ├─ Admin Service (5087)
  ├─ Product Service (5088)
  └─ Verify Service (5089)

Auction Service (5001)
  └─ SignalR Hub
     └─ Real-time bid updates
```

---

## 📋 Feature Checklist

### User Features
- [x] Register & Login
- [x] Create Products
- [x] List Products
- [x] Browse Auctions
- [x] Place Bids
- [x] Real-time Bid Updates
- [x] View Bid History
- [x] Watch Auctions
- [x] Edit Profile

### Admin Features
- [x] Admin Login
- [x] View Statistics
- [x] Verify Products
- [x] Verify Admin Requests
- [x] Manage Admin Rights

### Real-Time Features
- [x] SignalR Connection
- [x] Live Viewer Count
- [x] Real-time Bids
- [x] Auto-extend Timer
- [x] Notifications

---

## 🔧 API Endpoints Used

### Auth (5 endpoints)
```
POST   /api/user/create              → Register
POST   /api/user/login               → User Login
POST   /api/admin/Login              → Admin Login
GET    /api/user/profile/{id}        → Get Profile
PATCH  /api/user/profile             → Update Profile
```

### Products (6 endpoints)
```
POST   /api/product                  → Create
GET    /api/product/all              → List My Products
PATCH  /api/product/{id}             → Update
DELETE /api/product/{id}             → Delete
POST   /api/product/images           → Upload Images
```

### Auctions (15+ endpoints)
```
GET    /api/auctions                 → List Auctions
GET    /api/auctions/{id}            → Get Details
POST   /api/auctions                 → Create
POST   /api/auctions/{id}/bids       → Place Bid
GET    /api/auctions/{id}/bids       → Bid History
POST   /api/auctions/{id}/watch      → Watch
```

### Admin (14+ endpoints)
```
POST   /api/verify/product           → Verify Product
GET    /api/verify/unverified-products
GET    /api/admin-request/verify/{id}
GET    /api/admin-request/grant-rights/{id}
```

### Real-Time (WebSocket)
```
WS     /hubs/auction                 → SignalR Hub
  ├─ JoinAuction(auctionId)
  ├─ LeaveAuction(auctionId)
  └─ Events: BidPlaced, ViewerCountUpdated, etc.
```

---

## 🐛 Troubleshooting

### "Can't connect to API Gateway"
```bash
✓ Check backend services running
✓ Verify ports: 5000 (gateway), 5001 (auction)
✓ Check network/firewall
```

### "SignalR connection failed"
```bash
✓ Ensure Auction Service running on :5001
✓ Check JWT token valid (in localStorage)
✓ WebSocket should work in all browsers
```

### "Product won't verify"
```bash
✓ Must be logged in as ADMIN
✓ Product must be created (status: Pending)
✓ Check server logs for errors
```

### "Bid rejected"
```bash
✓ Bid must be >= currentHighestBid + minIncrement
✓ Auction must be "Live" (not Upcoming/Ended)
✓ 5-second cooldown between your bids
```

---

## 📖 Documentation

- **README.md** - Full project overview
- **SETUP.md** - Detailed setup instructions
- **ARCHITECTURE.md** - System design & data flow
- **IMPLEMENTATION_SUMMARY.md** - What's been built

---

## 🎯 Next Steps

### For Testing
1. ✅ Create multiple products
2. ✅ Have admin verify them
3. ✅ Create auctions
4. ✅ Place bids from different users
5. ✅ Watch real-time updates

### For Development
1. 📝 Enhance UI styling (Tailwind)
2. 🔍 Add search & filters
3. 🖼️ Add image gallery
4. 📱 Make responsive
5. ⏰ Add more validations
6. 🎨 Add dark mode
7. 📊 Add analytics
8. 🔔 Add toast notifications

---

## 💡 Pro Tips

### View Network Requests
```
Open DevTools → Network tab
Watch API calls happen in real-time
```

### View Real-Time Events
```
Open DevTools → Console tab
Search for "BidPlaced", "ViewerCountUpdated"
See all SignalR events logged
```

### Test Multiple Users
```
Open browser → http://localhost:3000
Open incognito → http://localhost:3000
Login as different users
Place bids simultaneously
Watch them sync in real-time!
```

### Debug State
```
In any component:
const auth = useAuthStore();
console.log(auth);  // See all auth state

const hub = useAuctionHub(1);
console.log(hub);   // See all auction state
```

---

## ✨ You're Ready!

The entire auction platform is wired up and working. Everything from authentication to real-time bidding is functional. 

**Now go test it out!** 🚀

Questions? Check the documentation files for detailed explanations.

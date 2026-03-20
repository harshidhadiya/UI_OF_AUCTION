# Auction Platform - Frontend

A complete React/Next.js auction platform frontend with real-time bidding, product verification, and admin management.

## Overview

This is a **functional, wired-up** auction platform frontend that connects to a microservices backend. The focus is on **working business logic** rather than aesthetic styling - you can polish the UI later!

### Architecture

```
Frontend (React/Next.js)
    ↓
API Gateway (localhost:5000)
    ├─ User Service (8080)
    ├─ Admin Service (5087)
    ├─ Product Service (5088)
    └─ Verify Service (5089)

Auction Service (localhost:5001 - Direct)
    └─ SignalR Hub (ws://localhost:5001/hubs/auction)
```

---

## Core Functionality

### 1. Authentication System

**Files:**
- `hooks/useAuthStore.ts` - State management for auth
- `components/auth/LoginForm.tsx` - Login UI
- `components/auth/RegisterForm.tsx` - Registration UI

**Features:**
- User registration & login
- Admin login with separate endpoint
- JWT token management
- Profile management
- Role-based access (USER, ADMIN, SELLER)

**How it works:**
```typescript
const auth = useAuthStore();
await auth.login(email, password, isAdmin);
// Token auto-saved to localStorage
// User profile fetched automatically
```

---

### 2. Product Management

**Files:**
- `components/products/ProductForm.tsx` - Create products
- `components/products/ProductList.tsx` - View products

**Features:**
- Create products with name, description, base price
- List user's products with verification status
- Pagination support
- Image upload ready (API prepared, UI not yet)

**Workflow:**
```
Create Product → Awaiting Verification → Admin Verifies → Can Create Auction
```

---

### 3. Auction System

**Files:**
- `components/auctions/AuctionList.tsx` - Browse auctions
- `components/auctions/AuctionDetail.tsx` - Full auction details
- `hooks/useAuction.ts` - SignalR real-time connection

**Features:**
- List auctions by status (Upcoming, Live, Ended)
- Real-time bid updates via SignalR
- Live viewer count
- Bid placement with validation
- Auto-extend auction on last 2 minutes bid
- Bid history
- Watch auctions

**Real-time Events:**
- `BidPlaced` - New bid received
- `ViewerCountUpdated` - Viewer count changed
- `AuctionStarted` - Auction went live
- `AuctionClosed` - Auction ended
- `TimerTick` - Countdown sync (every 30s)
- `AuctionEndingSoon` - Warning when < 5 min left
- `AuctionMessage` - Info notifications

**How SignalR works:**
```typescript
const hub = useAuctionHub(auctionId);

// Listen to bid placed event
hub.addBidPlacedListener((data) => {
  console.log(`New bid: ${data.maskedBidder} bid ${data.amount}`);
});

// Messages are automatically accumulated in hub.messages
```

---

### 4. Admin Features

**Files:**
- `components/admin/AdminDashboard.tsx` - Stats and overview
- `components/admin/AdminVerification.tsx` - Verify admin requests
- `components/admin/AdminProductVerification.tsx` - Verify products

**Features:**
- View verification request statistics
- Approve/reject admin verification requests
- Grant/revoke admin rights
- Verify products for auctions
- Un-verify products if needed
- See all verified admins and products

**Admin Workflow:**
```
New Admin Request → Admin Verifies → Grant Rights → Admin Can Verify Products
                 → Verify Products → Products Can Be Listed in Auctions
```

---

## API Client (`lib/api-client.ts`)

All API calls are centralized and organized by feature:

### Auth Endpoints
```typescript
authApi.register()       // POST /api/user/create
authApi.login()          // POST /api/user/login
authApi.adminLogin()     // POST /api/admin/Login
authApi.getProfile()     // GET /api/user/profile/{id}
authApi.updateProfile()  // PATCH /api/user/profile
```

### Product Endpoints
```typescript
productApi.create()         // POST /api/product
productApi.getMyProducts()  // GET /api/product/all
productApi.update()         // PATCH /api/product/{id}
productApi.delete()         // DELETE /api/product/{id}
productApi.addImages()      // POST /api/product/images
```

### Auction Endpoints
```typescript
auctionApi.list()           // GET /api/auctions
auctionApi.getDetail()      // GET /api/auctions/{id}
auctionApi.create()         // POST /api/auctions
auctionApi.placeBid()       // POST /api/auctions/{id}/bids
auctionApi.getBids()        // GET /api/auctions/{id}/bids
auctionApi.watchAuction()   // POST /api/auctions/{id}/watch
auctionApi.getWatched()     // GET /api/auctions/watched
```

### Admin Endpoints
```typescript
adminApi.verifyProduct()       // POST /api/verify/product
adminApi.unverifyProduct()     // DELETE /api/verify/product/{id}
adminApi.verifyRequest()       // GET /api/admin-request/verify/{id}
adminApi.grantRights()         // GET /api/admin-request/grant-rights/{id}
adminApi.getPendingRequests()  // GET /api/admin-request/pending
adminApi.getVerifiedRequests() // GET /api/admin-request/verified
```

---

## Type System (`types/index.ts`)

Complete TypeScript interfaces for all entities:

```typescript
// User
interface User {
  id: number;
  name: string;
  email: string;
  role: "USER" | "ADMIN" | "SELLER";
  isVerified: boolean;
}

// Product
interface Product {
  id: number;
  name: string;
  description: string;
  basePrice: number;
  userId: number;
  isVerified: boolean;
  images: ProductImage[];
}

// Auction
interface Auction {
  id: number;
  productId: number;
  status: "Upcoming" | "Live" | "Ended" | "Cancelled";
  currentHighestBid: number;
  timeRemainingSeconds: number;
  // ... more fields
}

// Bid
interface Bid {
  id: number;
  auctionId: number;
  maskedBidder: string;
  amount: number;
  placedAt: string;
}
```

---

## Data Flow Examples

### User Creates Product
```
1. User fills ProductForm
2. ProductForm calls productApi.create()
3. Backend creates product (isVerified: false)
4. Product appears in ProductList with "⏳ Pending" badge
5. Admin sees in AdminProductVerification
6. Admin clicks "Verify" → calls adminApi.verifyProduct()
7. Backend marks product as verified
8. User can now create auction with this product
```

### User Places Bid
```
1. User opens AuctionDetail for Auction #42
2. Hub connects via SignalR & joins "auction_42" room
3. User enters bid amount & clicks "Place Bid"
4. Calls auctionApi.placeBid(42, 850)
5. Backend validates:
   - Is auction Live?
   - Is bid >= currentHighestBid + minIncrement?
   - 5s cooldown per user?
6. If valid: saves bid, publishes "BidPlaced" event
7. SignalR pushes "BidPlaced" to all users in room
8. All clients update UI with new bid
9. If bid in last 2 min: auction extended, "TimerTick" pushed
```

### Admin Verifies Product
```
1. Admin views AdminProductVerification
2. Loads unverified products via adminApi.getUnverifiedProducts()
3. Admin clicks "Verify" on product
4. Calls adminApi.verifyServiceVerifyProduct(productId, "description")
5. Backend updates product.isVerified = true
6. RabbitMQ event "ProductVerified" published
7. Auction service receives event
8. Page refreshes, product moves to "Verified" tab
```

---

## Setup & Running

### 1. Install Dependencies
```bash
npm install
# or
pnpm install
```

### 2. Ensure Backend Services Running
- API Gateway: `http://localhost:5000`
- Auction Service: `http://localhost:5001`
- All microservices on their ports

### 3. Start Dev Server
```bash
npm run dev
# or
pnpm dev
```

### 4. Open Browser
```
http://localhost:3000
```

---

## Current Implementation Status

### ✅ Completed
- [x] Complete type system
- [x] API client with all endpoints
- [x] Authentication (login, register, profile)
- [x] Product creation & listing
- [x] Auction browsing & details
- [x] Real-time bidding with SignalR
- [x] Admin dashboard
- [x] Product verification
- [x] Admin request verification
- [x] Pagination
- [x] Error handling

### 🚀 Ready to Add (UI/Polish)
- [ ] Better styling (use Tailwind/shadcn components)
- [ ] Image uploads & gallery
- [ ] Search & filters
- [ ] Sorting options
- [ ] Toast notifications
- [ ] Loading skeletons
- [ ] Responsive design
- [ ] Dark mode
- [ ] User watchlist UI
- [ ] Auction creation form with dates
- [ ] Bid counter & notifications
- [ ] User history pages
- [ ] Category system
- [ ] Reviews/ratings

---

## Component Structure

```
app/
  ├── page.tsx (Main router/layout)
  ├── layout.tsx
  └── globals.css

components/
  ├── auth/
  │   ├── LoginForm.tsx
  │   └── RegisterForm.tsx
  ├── products/
  │   ├── ProductForm.tsx
  │   └── ProductList.tsx
  ├── auctions/
  │   ├── AuctionList.tsx
  │   └── AuctionDetail.tsx
  ├── admin/
  │   ├── AdminDashboard.tsx
  │   ├── AdminVerification.tsx
  │   └── AdminProductVerification.tsx
  ├── user/
  │   └── UserProfile.tsx
  └── ui/
      └── (shadcn components)

hooks/
  ├── useAuthStore.ts
  └── useAuction.ts

lib/
  ├── api-client.ts
  └── utils.ts

types/
  └── index.ts
```

---

## Key Hooks & Utilities

### useAuthStore()
Central auth state management:
```typescript
const auth = useAuthStore();

// Properties
auth.user          // Current user object
auth.token         // JWT token
auth.isLoading     // Loading state
auth.error         // Error message
auth.isAuthenticated

// Methods
await auth.login(email, password, isAdmin)
await auth.register(name, email, password)
auth.logout()
await auth.updateProfile({ name, bio })
```

### useAuctionHub()
Real-time auction connection:
```typescript
const hub = useAuctionHub(auctionId);

// Properties
hub.isConnected
hub.viewerCount
hub.timerSeconds
hub.recentBids    // Last 10 bids
hub.messages      // Info messages
hub.status        // 'connected' | 'disconnected' | 'connecting'

// Methods
hub.addBidPlacedListener(callback)
hub.addAuctionClosedListener(callback)
hub.addAuctionStartedListener(callback)
hub.addAuctionEndingSoonListener(callback)
```

---

## Environment Variables

Currently configured to connect to:
- API Gateway: `http://localhost:5000`
- Auction Service: `http://localhost:5001`

To change, modify constants in `lib/api-client.ts`:
```typescript
const GATEWAY_URL = "http://localhost:5000";
const AUCTION_URL = "http://localhost:5001";
```

---

## Testing Credentials

### User Account
- Email: `user@example.com`
- Password: `password123`

### Admin Account
- Email: `admin@example.com`
- Password: `adminpass`

---

## Common Issues & Solutions

### "Failed to connect to auction hub"
- Ensure Auction Service is running on :5001
- Check that JWT token is valid
- Verify WebSocket is not blocked

### "Product not verified" when creating auction
- Admin must first verify the product
- Go to Admin → Verify Products → click "Verify"

### "Bid rejected" errors
- Ensure bid >= currentHighestBid + minIncrement
- Wait 5 seconds between bids (cooldown)
- Ensure auction status is "Live"

### API 403 errors
- Token may be expired
- User role may lack permission (e.g., ADMIN required)
- Refresh page to re-authenticate

---

## Next Steps

This is a **fully functional backend** ready for UI improvements. Recommended order:

1. **Polish Components** - Better spacing, colors, typography
2. **Add Notifications** - Toast messages for actions
3. **Better Forms** - Form validation, better UX
4. **User Watchlist** - Display watched auctions
5. **Auction Creation** - Form to create auctions with date pickers
6. **Image Gallery** - Show product images in auctions
7. **Search & Filters** - Search auctions, filter by category
8. **User History** - Past auctions, won auctions
9. **Responsive Design** - Mobile-friendly layout
10. **Loading States** - Skeleton screens while loading

---

## Stack

- **Framework**: Next.js 16.1
- **Language**: TypeScript
- **UI**: shadcn/ui components + Tailwind CSS
- **Real-time**: @microsoft/signalr
- **State**: Custom hooks (useAuthStore)
- **API**: Fetch API with custom client

---

## License

This is a learning project for the Macution auction platform.

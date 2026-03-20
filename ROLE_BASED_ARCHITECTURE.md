# Role-Based Architecture - Complete Separation

## Overview
This auction platform has **THREE COMPLETELY SEPARATE UIs** based on user roles:
- **USER** - Auction participants
- **ADMIN** - Multiple admins verifying products and other admins
- **SUPER_ADMIN** - System-level management (future implementation)

---

## USER INTERFACE (`/components/user/`)

### Access
- Only users with role = "USER"
- Routed via `UserLayout.tsx`

### Features

#### 1. **Browse Auctions** (`UserAuctionBrowse.tsx`)
- View all LIVE auctions
- Search and filter by status
- See real-time bid info
- Watch auction count
- Live viewer count
- Time remaining

#### 2. **Auction Detail Modal** (`AuctionDetailModal.tsx`)
- Full auction details
- Real-time countdown timer
- Current highest bid
- Bid history (recent bids)
- **PLACE BID** functionality
- Add to watchlist
- Masked bidder names (privacy)

#### 3. **Watchlist** (`UserWatchlist.tsx`)
- Add/remove auctions from watchlist
- Monitor auctions without bidding
- See status changes in real-time
- Quick access to bid on watched items

#### 4. **Create Products** (`UserProductCreate.tsx`)
- Submit products for auction
- Fill: Name, Description, Base Price, Category
- Products go to "PENDING" status
- Admin must verify before creating auction
- View all own products
- See verification status

#### 5. **User Profile** (`UserProfileEdit.tsx`)
- Edit profile info (name, bio, phone, address)
- View verification status
- See account details

### Data Flow
```
USER creates PRODUCT 
    ↓
Product status = "PENDING"
    ↓
ADMIN verifies it
    ↓
Product status = "VERIFIED"
    ↓
USER can now create AUCTION from this product
    ↓
USER browses and bids on AUCTIONS
```

---

## ADMIN INTERFACE (`/components/admin/`)

### Access
- Only users with role = "ADMIN"
- Routed via `AdminLayout.tsx`
- Each admin is independent

### Features

#### 1. **Verify Products** (`AdminProductVerification.tsx`)
**Tabs:**
- **Pending Products** - Products waiting verification
  - View product details
  - Images
  - Price
  - Click to VERIFY or REJECT
  
- **Verified by Me** - Products this admin verified
  - Shows all products verified by this specific admin
  - Read-only view

**What admins do:**
- See pending products from users
- Review product info and images
- VERIFY → Product becomes available for auction
- REJECT → Product is rejected

#### 2. **Verify Other Admins** (`AdminVerifyAdmins.tsx`) *Only if `rightToAdd = true`*

**Tabs:**
- **Pending Admins** - New admin verification requests
  - See admin name, email
  - Two verification options:
    1. "Verify User Only" - Verify but no admin rights
    2. "Verify + Grant Rights" - Verify AND grant `rightToAdd` permission
  - Can REJECT requests
  
- **Verified by Me** - Admins verified by this admin
  - Shows admins verified by this specific admin
  - Shows which ones have admin verification rights

**Admin Hierarchy:**
```
SUPER_ADMIN (system-level, verifies all admins)
    ↓
ADMIN with rightToAdd = true (can verify other admins)
    ↓
ADMIN with rightToAdd = false (can only verify products)
```

#### 3. **Verification History** (`AdminVerifiedHistory.tsx`)
- **Products Verified by Me** - All products verified by this admin
- **Admins Verified by Me** - All admins verified by this admin (if they have rights)
- Full audit trail

### Admin Capabilities

| Capability | All Admins | Admins with `rightToAdd` |
|-----------|-----------|----------------------|
| Verify Products | ✅ | ✅ |
| See Pending Products | ✅ | ✅ |
| See Own Verification History | ✅ | ✅ |
| Verify Other Admins | ❌ | ✅ |
| Grant Admin Rights | ❌ | ✅ |
| See Pending Admin Requests | ❌ | ✅ |

---

## DATABASE STRUCTURE

### User Table
```
Users:
- id (PK)
- name
- email
- role: "USER" | "ADMIN" | "SUPER_ADMIN"
- isVerified (boolean)
- createdAt
- (USER fields) bio, phone, address, profileImage
- (ADMIN fields) rightToAdd, verifiedBy (Super Admin ID), verifiedAt
```

### Products Table
```
Products:
- id (PK)
- name
- description
- basePrice
- userId (FK) - User who created it
- isVerified (boolean)
- verifiedBy (FK) - Admin ID who verified
- verifiedAt (timestamp)
- categoryId
- createdAt
```

### Admin Verification Table
```
AdminVerificationRequests:
- id (PK)
- adminId (FK) - Admin being verified
- status: "Pending" | "Verified" | "Rejected"
- rightToAdd (boolean) - Can they verify other admins?
- isVerified
- verifiedBySuperId (FK) - Super Admin who verified
- requestedAt
- verifiedAt
```

### Auctions Table
```
Auctions:
- id (PK)
- productId (FK) - Must be VERIFIED product
- status: "Upcoming" | "Live" | "Ended"
- startingPrice
- reservePrice
- currentHighestBid
- totalBids
- watcherCount
- liveViewerCount
- timeRemainingSeconds
- startDate / endDate
```

### Bids Table
```
Bids:
- id (PK)
- auctionId (FK)
- userId (FK) - USER who placed bid
- maskedBidder (string) - Privacy: "Bidder #123"
- amount
- status: "Active" | "Outbid"
- placedAt
```

### Watchlist Table
```
Watchlist:
- id (PK)
- userId (FK) - USER watching
- auctionId (FK) - Auction being watched
- addedAt
```

---

## API ENDPOINTS (Grouped by Role)

### USER Endpoints
```
GET  /products/user/{userId}           - Get my products
POST /products/create                   - Create new product
GET  /auctions/live                     - Get live auctions
POST /auctions/{id}/bid                 - Place bid
GET  /auctions/{id}/bids                - Get bid history
POST /watchlist                         - Add to watchlist
GET  /watchlist/{userId}                - Get my watchlist
DELETE /watchlist/{id}                  - Remove from watchlist
PUT  /users/{id}                        - Update profile
```

### ADMIN Endpoints
```
GET  /products/pending                  - Get unverified products
GET  /products/verified-by/{adminId}    - Get products I verified
POST /products/verify                   - Verify/reject product
GET  /admins/pending                    - Get pending admin requests (if rightToAdd)
GET  /admins/verified-by/{adminId}      - Get admins I verified (if rightToAdd)
POST /admins/verify                     - Verify/reject admin (if rightToAdd)
```

---

## Authentication Flow

### Login Process
1. User submits email + password
2. Server validates credentials
3. Returns token + role
4. App checks role:
   - role = "USER" → Show UserLayout
   - role = "ADMIN" → Show AdminLayout
   - role = "SUPER_ADMIN" → Show SuperAdminLayout
   - Not authenticated → Show Login/Register

### Token Storage
- Stored in Zustand store (useAuthStore)
- Included in all API requests

---

## Key Differences Between Roles

### USER
- ✅ Create products
- ✅ Browse auctions
- ✅ Place bids
- ✅ Manage watchlist
- ✅ Edit profile
- ❌ Verify anything
- ❌ See admin panel

### ADMIN
- ❌ Create products (not allowed)
- ❌ Browse auctions as buyer
- ❌ Place bids
- ✅ Verify products (ALL admins)
- ✅ Verify other admins (only if `rightToAdd = true`)
- ✅ See verification history
- ✅ Full admin dashboard

### SUPER_ADMIN
- All admin capabilities
- ✅ Manage all admin verifications globally
- ✅ System-wide settings (future)
- ✅ User management (future)

---

## File Structure Summary

```
/components/
├── /admin/                    # ADMIN UI ONLY
│   ├── AdminLayout.tsx        # Main admin dashboard router
│   ├── AdminProductVerification.tsx
│   ├── AdminVerifyAdmins.tsx
│   └── AdminVerifiedHistory.tsx
├── /user/                     # USER UI ONLY
│   ├── UserLayout.tsx         # Main user dashboard router
│   ├── UserAuctionBrowse.tsx
│   ├── AuctionDetailModal.tsx
│   ├── UserWatchlist.tsx
│   ├── UserProductCreate.tsx
│   └── UserProfileEdit.tsx
├── /auth/
│   ├── LoginForm.tsx
│   └── RegisterForm.tsx
└── /ui/                       # Shared UI components
    └── ... (button, card, dialog, etc.)

/types/
└── index.ts                   # Shared types for all roles

/hooks/
├── useAuthStore.ts           # Global auth state
└── useAuction.ts             # Auction operations

/lib/
└── api-client.ts             # API calls for all roles

/app/
└── page.tsx                  # Main router - routes by role
```

---

## Workflow Examples

### Workflow 1: User Selling Product
1. USER logs in → UserLayout shown
2. USER creates product → Goes to "PENDING"
3. ADMIN sees pending product → Verifies or rejects
4. If verified → USER can create auction
5. USER creates auction from verified product
6. OTHER USERS browse and bid

### Workflow 2: Admin Verification Chain
1. NEW ADMIN registers → Status "PENDING"
2. ADMIN with `rightToAdd = true` sees pending admin
3. This admin verifies new admin + grants rights
4. NEW ADMIN now has `rightToAdd = true`
5. NEW ADMIN can now verify other admins

### Workflow 3: Live Bidding
1. USER browses auctions
2. USER sees live auction with timer
3. USER clicks "Place Bid"
4. Modal opens with bid form
5. USER enters bid amount > current bid + increment
6. Bid is placed, sent via WebSocket
7. All viewers see new highest bid (masked bidder)
8. Previous highest bidder marked as "Outbid"

---

## Important Notes

- **No Role Mixing**: A user can only have ONE role
- **Admin Independence**: Each admin verifies independently
- **Admin Rights**: `rightToAdd` determines if admin can verify other admins
- **Product Verification**: Required before creating auction
- **Bid Privacy**: Bidder names are masked (Bidder #123)
- **Real-time Updates**: SignalR handles live bids, timers, viewer counts
- **Admin Audit**: Complete history of who verified what


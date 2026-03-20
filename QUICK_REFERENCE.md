# Quick Reference - Role-Based Auction Platform

## 🎯 Three Completely Separate Interfaces

### USER Interface
**Access:** Role = "USER"  
**Location:** `/components/user/`  
**Entry:** `UserLayout.tsx`

**What Users Do:**
- Create products
- Browse auctions
- Place bids in real-time
- Manage watchlist
- Edit profile

**Main Screens:**
1. Browse Auctions - Search, filter, view live stats
2. Auction Details - Timer, bid history, place bids
3. Watchlist - Tracked auctions
4. Create Products - Submit products for verification
5. My Products - View own products, check verification status
6. Profile - Edit account info

---

### ADMIN Interface
**Access:** Role = "ADMIN"  
**Location:** `/components/admin/`  
**Entry:** `AdminLayout.tsx`

**What Admins Do:**
- Verify products from users
- Verify other admins (if `rightToAdd = true`)
- Track verification history
- Manage permissions

**Main Screens:**
1. Verify Products
   - Pending Products tab - Unverified products
   - Verified by Me tab - Products this admin verified
   
2. Verify Admins (conditional)
   - Pending Admins tab - New admin requests
   - Verified by Me tab - Admins this admin verified
   
3. My Verified - Complete verification history

---

## 📁 File Structure

### Admin Components
```
/components/admin/
├── AdminLayout.tsx                    (Main router - 106 lines)
├── AdminProductVerification.tsx        (198 lines)
├── AdminVerifyAdmins.tsx              (195 lines)
└── AdminVerifiedHistory.tsx           (153 lines)
```

### User Components
```
/components/user/
├── UserLayout.tsx                     (Main router - 115 lines)
├── UserAuctionBrowse.tsx              (183 lines)
├── AuctionDetailModal.tsx             (209 lines)
├── UserWatchlist.tsx                  (150 lines)
├── UserProductCreate.tsx              (258 lines)
└── UserProfileEdit.tsx                (212 lines)
```

---

## 🔑 Key Concepts

### Admin `rightToAdd` Field
```
rightToAdd = false
  ✅ Can verify products
  ❌ Cannot verify other admins

rightToAdd = true
  ✅ Can verify products
  ✅ Can verify other admins
  ✅ Can grant admin rights
```

### Product Lifecycle
```
USER creates product
  ↓
Product.isVerified = false
  ↓
ADMIN verifies it
  ↓
Product.isVerified = true
  ↓
USER can create auction
```

### Admin Verification Chain
```
Super Admin verifies Admin A, grants rightToAdd = true
  ↓
Admin A can now verify other admins
  ↓
Admin A verifies Admin B, can choose to grant rightToAdd
  ↓
Admin B now has the permissions Admin A granted
```

---

## 🛠️ Component Props & API

### AdminProductVerification
```typescript
// No props - reads from Zustand store
// Uses:
- useAuthStore() - Get current admin
- apiClient.getRequest('/products/pending')
- apiClient.postRequest('/products/verify')
```

### AdminVerifyAdmins
```typescript
// Only shown if user.rightToAdd === true
// Uses:
- useAuthStore() - Get current admin
- apiClient.getRequest('/admins/pending')
- apiClient.postRequest('/admins/verify')
```

### UserAuctionBrowse
```typescript
// No props - reads from Zustand store
// Uses:
- useAuthStore() - Get current user
- apiClient.getRequest('/auctions/live')
// Displays AuctionDetailModal on click
```

### AuctionDetailModal
```typescript
interface Props {
  auction: Auction
  onClose: () => void
}
// Uses:
- useAuction() hook - placeBid, addToWatchlist
- Real-time countdown timer
- Bid history loading
```

### UserProductCreate
```typescript
// Two tabs: Create & My Products
// Uses:
- useAuthStore() - Get current user
- apiClient.postRequest('/products/create')
- apiClient.getRequest(`/products/user/{userId}`)
```

---

## 🔌 API Endpoints (Summary)

### Admin Endpoints
```
GET /products/pending
GET /products/verified-by/{adminId}
POST /products/verify
GET /admins/pending
GET /admins/verified-by/{adminId}
POST /admins/verify
```

### User Endpoints
```
GET /auctions/live
GET /auctions/{id}/bids
POST /auctions/{id}/bid
POST /watchlist
GET /watchlist/{userId}
DELETE /watchlist/{id}
GET /products/user/{userId}
POST /products/create
PUT /users/{id}
```

---

## 🎨 Styling Notes

All components use:
- shadcn/ui components (Button, Card, Dialog, etc.)
- Tailwind CSS utilities
- Consistent spacing: p-4, p-6, gap-4, gap-6
- Color scheme: blue primary, gray neutral
- Responsive: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

### Badge Colors by Status
```
VERIFIED → bg-green-100 text-green-800
PENDING → bg-orange-100 text-orange-800
REJECTED → bg-red-100 text-red-800
LIVE → bg-green-100 text-green-800
UPCOMING → bg-blue-100 text-blue-800
ENDED → bg-gray-100 text-gray-800
```

---

## 🚀 How to Test

### Test as USER
1. Login: user@example.com / password123
2. Should see UserLayout
3. Browse Auctions tab → See live auctions
4. Click auction → See AuctionDetailModal
5. My Products tab → Create new product
6. Check verification status
7. Watchlist tab → Add/remove auctions

### Test as ADMIN
1. Login: admin@example.com / password123
2. Should see AdminLayout
3. Verify Products tab → See pending products
4. Try to verify one
5. Verify Admins tab → Only if rightToAdd = true
6. My Verified tab → See history

---

## 🔐 Access Control

All layouts have access checks:

```typescript
if (user?.role !== 'ADMIN') {
  // Show access denied
}

if (user?.role !== 'USER') {
  // Show access denied
}
```

---

## 📊 Real-Time Features (Ready)

These are wired and ready, just need WebSocket connection:

- Live countdown timer
- Real-time bid updates
- Viewer count changes
- Bid history updates
- New highest bidder notifications

SignalR integration is in place - just needs server connection.

---

## 🎯 Next Steps for Styling

1. Define color palette (3-5 colors)
2. Add gradients to headers
3. Enhance card shadows & borders
4. Add loading skeletons
5. Improve spacing & typography
6. Responsive design tweaks
7. Add hover effects
8. Animations for modals

---

## ❓ FAQ

**Q: Can a USER see the ADMIN panel?**
A: No. If they try to access /admin, they see "Access Denied" message.

**Q: Can an ADMIN place bids?**
A: No. Admin interface is completely separate from auction browsing.

**Q: What happens to products that are rejected?**
A: They stay in PENDING state and can be verified later by another admin.

**Q: Can an admin verify their own admin request?**
A: No. Admin verification only done by Super Admin or admins with higher rights.

**Q: Are bidder names visible?**
A: No. Users see masked names like "Bidder #123" for privacy.

**Q: What if an admin loses rightToAdd permission?**
A: They can still verify products, but cannot access the "Verify Admins" tab.

**Q: Can a user create multiple products?**
A: Yes. All will be pending verification initially.

---

## 📞 Support

For issues or questions:
1. Check ROLE_BASED_ARCHITECTURE.md for detailed docs
2. Check COMPLETION_STATUS.md for what's implemented
3. Review component comments in source files
4. Check types/index.ts for data structures

---

**Build Date:** March 2026  
**Last Updated:** Complete Separation Implemented  
**Status:** ✅ FULLY FUNCTIONAL - Ready for UI Polish

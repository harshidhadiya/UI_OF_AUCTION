# Component Map - Complete Dependency Tree

## Main Entry Point

### `/app/page.tsx` (Router)
```typescript
import { useAuthStore } from '@/hooks/useAuthStore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LoginForm from '@/components/auth/LoginForm'
import RegisterForm from '@/components/auth/RegisterForm'
import AdminLayout from '@/components/admin/AdminLayout'
import UserLayout from '@/components/user/UserLayout'

// Decision Tree:
if (!user) {
  // Show: LoginForm + RegisterForm
}
if (user.role === 'ADMIN') {
  // Show: AdminLayout
}
if (user.role === 'USER') {
  // Show: UserLayout
}
```

---

## ADMIN INTERFACE COMPONENT TREE

### `/components/admin/AdminLayout.tsx`
```
AdminLayout
├── Imports:
│   ├── useAuthStore from '@/hooks/useAuthStore'
│   ├── Button from '@/components/ui/button'
│   ├── Card from '@/components/ui/card'
│   ├── Tabs from '@/components/ui/tabs'
│   ├── Badge from '@/components/ui/badge'
│   ├── AdminProductVerification from './AdminProductVerification'
│   ├── AdminVerifyAdmins from './AdminVerifyAdmins'
│   └── AdminVerifiedHistory from './AdminVerifiedHistory'
│
├── Renders:
│   ├── Header
│   │   ├── Title "Admin Dashboard"
│   │   ├── User name greeting
│   │   ├── Role badge
│   │   ├── Rights badge (conditional)
│   │   └── Logout button
│   │
│   └── Tabs:
│       ├── Tab 1: Verify Products
│       │   └── <AdminProductVerification />
│       ├── Tab 2: Verify Admins (conditional: if rightToAdd)
│       │   └── <AdminVerifyAdmins />
│       └── Tab 3: My Verified
│           └── <AdminVerifiedHistory />
│
└── Access Control:
    └── if (user.role !== 'ADMIN') → Show "Access Denied"
```

#### AdminLayout Usage
```typescript
// In page.tsx:
if (user && user.role === 'ADMIN') {
  return <AdminLayout />
}
```

---

### `/components/admin/AdminProductVerification.tsx`
```
AdminProductVerification
├── Imports:
│   ├── useAuthStore, useEffect, useState
│   ├── apiClient from '@/lib/api-client'
│   ├── Product, Bid from '@/types'
│   ├── UI: Button, Card, Tabs, Badge, Spinner
│   └── Image from 'next/image'
│
├── State:
│   ├── pendingProducts: Product[]
│   ├── verifiedProducts: Product[]
│   ├── loading: boolean
│   ├── verifyingId: number | null
│   └── selectedTab: 'pending' | 'verified'
│
├── Effects:
│   ├── Load pending products on mount
│   └── Load verified products on mount
│
├── Functions:
│   ├── loadProducts() → API calls
│   │   ├── GET /products/pending
│   │   └── GET /products/verified-by/{adminId}
│   │
│   └── handleVerifyProduct(id, status)
│       └── POST /products/verify
│
├── Tabs:
│   ├── Pending Products Tab:
│   │   └── For each product:
│   │       ├── Image placeholder
│   │       ├── Name, description, price
│   │       ├── Verify button
│   │       └── Reject button
│   │
│   └── Verified by Me Tab:
│       └── For each product:
│           ├── Image placeholder
│           ├── Name, description, price
│           ├── VERIFIED badge
│           └── Verification date
│
└── Returns: JSX (Tabs component)
```

#### AdminProductVerification Usage
```typescript
// In AdminLayout.tsx:
<TabsContent value="products">
  <AdminProductVerification />
</TabsContent>
```

#### API Calls
```typescript
// GET /products/pending
Response: Product[]

// GET /products/verified-by/{adminId}
Response: Product[]

// POST /products/verify
Body: {
  productId: number
  verifierId: number (admin ID)
  status: 'Verified' | 'Rejected'
  reason?: string
}
```

---

### `/components/admin/AdminVerifyAdmins.tsx`
```
AdminVerifyAdmins
├── Imports:
│   ├── useAuthStore, useState, useEffect
│   ├── apiClient from '@/lib/api-client'
│   ├── Admin, AdminVerificationRequest from '@/types'
│   ├── UI: Button, Card, Badge, Spinner, Tabs
│   └── Types
│
├── State:
│   ├── pendingAdmins: Admin[]
│   ├── verifiedAdmins: Admin[]
│   ├── loading: boolean
│   ├── verifyingId: number | null
│   └── selectedTab: 'pending' | 'verified'
│
├── Effects:
│   └── Load admins on mount
│
├── Functions:
│   ├── loadAdmins() → API calls
│   │   ├── GET /admins/pending
│   │   └── GET /admins/verified-by/{adminId}
│   │
│   └── handleVerifyAdmin(id, status, grantRightToAdd)
│       └── POST /admins/verify
│
├── Tabs:
│   ├── Pending Admins Tab:
│   │   └── For each admin request:
│   │       ├── Name, email
│   │       ├── "Verify User Only" button
│   │       ├── "Verify + Grant Rights" button
│   │       └── Reject button
│   │
│   └── Verified by Me Tab:
│       └── For each verified admin:
│           ├── Name, email
│           ├── VERIFIED badge
│           ├── Admin rights badge (conditional)
│           └── Verification date
│
├── Conditional Rendering:
│   └── Only shown if user.rightToAdd === true
│
└── Returns: JSX (Tabs component)
```

#### AdminVerifyAdmins Usage
```typescript
// In AdminLayout.tsx:
{user.rightToAdd && (
  <TabsContent value="admins">
    <AdminVerifyAdmins />
  </TabsContent>
)}
```

#### API Calls
```typescript
// GET /admins/pending
Response: Admin[]

// GET /admins/verified-by/{adminId}
Response: Admin[]

// POST /admins/verify
Body: {
  adminId: number
  verifierId: number (admin ID verifying)
  status: 'Verified' | 'Rejected'
  rightToAdd: boolean
}
```

---

### `/components/admin/AdminVerifiedHistory.tsx`
```
AdminVerifiedHistory
├── Imports:
│   ├── useState, useEffect, useAuthStore
│   ├── apiClient from '@/lib/api-client'
│   ├── Product, Admin from '@/types'
│   ├── UI: Card, Tabs, Badge, Spinner
│   └── Image
│
├── State:
│   ├── verifiedProducts: Product[]
│   ├── verifiedAdmins: Admin[]
│   ├── loading: boolean
│   └── selectedTab: 'products' | 'admins'
│
├── Effects:
│   └── loadHistory() → Load data
│
├── Tabs:
│   ├── Products Verified by Me Tab:
│   │   └── Read-only list:
│   │       ├── Product image
│   │       ├── Name, description, price
│   │       ├── VERIFIED badge
│   │       ├── Created & verified dates
│   │
│   └── Admins Verified by Me Tab (conditional):
│       └── Read-only list:
│           ├── Admin name, email
│           ├── VERIFIED badge
│           ├── Admin rights badge (if granted)
│           └── Verified date
│
└── Returns: JSX (Tabs component)
```

#### AdminVerifiedHistory Usage
```typescript
// In AdminLayout.tsx:
<TabsContent value="history">
  <AdminVerifiedHistory />
</TabsContent>
```

---

## USER INTERFACE COMPONENT TREE

### `/components/user/UserLayout.tsx`
```
UserLayout
├── Imports:
│   ├── useState, useAuthStore
│   ├── Button from '@/components/ui/button'
│   ├── Card, Tabs
│   ├── Badge from '@/components/ui/badge'
│   ├── UserAuctionBrowse from './UserAuctionBrowse'
│   ├── UserProductCreate from './UserProductCreate'
│   ├── UserWatchlist from './UserWatchlist'
│   └── UserProfileEdit from './UserProfileEdit'
│
├── Renders:
│   ├── Header:
│   │   ├── Title "Auction Platform"
│   │   ├── User name greeting
│   │   ├── Role badge
│   │   ├── Verification status badge
│   │   └── Logout button
│   │
│   └── Four Tabs:
│       ├── Tab 1: Browse Auctions
│       │   └── <UserAuctionBrowse />
│       ├── Tab 2: My Watchlist
│       │   └── <UserWatchlist />
│       ├── Tab 3: My Products
│       │   └── <UserProductCreate />
│       └── Tab 4: Profile
│           └── <UserProfileEdit />
│
└── Access Control:
    └── if (user.role !== 'USER') → Show "Access Denied"
```

#### UserLayout Usage
```typescript
// In page.tsx:
if (user && user.role === 'USER') {
  return <UserLayout />
}
```

---

### `/components/user/UserAuctionBrowse.tsx`
```
UserAuctionBrowse
├── Imports:
│   ├── useState, useEffect, useAuthStore
│   ├── useAuction from '@/hooks/useAuction'
│   ├── apiClient from '@/lib/api-client'
│   ├── Auction from '@/types'
│   ├── UI: Button, Card, Badge, Input, Spinner
│   └── AuctionDetailModal from './AuctionDetailModal'
│
├── State:
│   ├── auctions: Auction[]
│   ├── filteredAuctions: Auction[]
│   ├── loading: boolean
│   ├── searchTerm: string
│   ├── statusFilter: string
│   └── selectedAuction: Auction | null
│
├── Effects:
│   ├── loadAuctions() on mount
│   └── filterAuctions() when filters change
│
├── Functions:
│   ├── loadAuctions()
│   │   └── GET /auctions/live
│   │
│   ├── filterAuctions()
│   │   ├── Filter by search term
│   │   └── Filter by status
│   │
│   └── getStatusColor(status)
│       └── Return color class
│
├── Render:
│   ├── Search input
│   ├── Status filter select
│   └── Grid of auction cards:
│       ├── Image placeholder
│       ├── Auction ID
│       ├── Product ID
│       ├── Starting price
│       ├── Current bid
│       ├── Bid count
│       ├── Watcher count
│       ├── Status badge
│       ├── Time remaining (if live)
│       ├── "View & Bid" button
│       │   └── Opens <AuctionDetailModal />
│
├── Conditional Modal:
│   └── {selectedAuction && <AuctionDetailModal ... />}
│
└── Returns: JSX (Grid of auctions)
```

#### UserAuctionBrowse Usage
```typescript
// In UserLayout.tsx:
<TabsContent value="auctions">
  <UserAuctionBrowse />
</TabsContent>
```

#### API Calls
```typescript
// GET /auctions/live
Response: Auction[]
```

---

### `/components/user/AuctionDetailModal.tsx`
```
AuctionDetailModal (Modal Dialog)
├── Props:
│   ├── auction: Auction
│   └── onClose: () => void
│
├── Imports:
│   ├── useState, useEffect
│   ├── Auction, Bid from '@/types'
│   ├── apiClient from '@/lib/api-client'
│   ├── useAuction from '@/hooks/useAuction'
│   ├── UI: Button, Card, Dialog, Input, Badge, Spinner
│
├── State:
│   ├── bidAmount: string
│   ├── recentBids: Bid[]
│   ├── loading: boolean
│   ├── timeRemaining: number (updates every second)
│   └── liveViewers: number
│
├── Effects:
│   ├── loadBidHistory() on mount
│   └── Countdown timer (setInterval)
│
├── Functions:
│   ├── loadBidHistory()
│   │   └── GET /auctions/{id}/bids
│   │
│   ├── handlePlaceBid()
│   │   ├── Validate bid amount
│   │   ├── placeBid(auctionId, amount)
│   │   └── Reload bid history
│   │
│   ├── handleAddToWatchlist()
│   │   └── addToWatchlist(auctionId)
│   │
│   └── formatTime(seconds)
│       └── Return formatted timer
│
├── Render (Modal Content):
│   ├── Image placeholder
│   ├── Stats cards:
│   │   ├── Status
│   │   ├── Current Bid
│   │   ├── Total Bids
│   │   └── Viewers
│   ├── Timer card (if live)
│   │   └── Shows MM:SS:HH countdown
│   ├── Bid placement section (if live)
│   │   ├── Bid input field
│   │   └── Place bid button
│   ├── Add to watchlist button
│   └── Bid history section
│       └── List of recent bids with masked names
│
└── Returns: Dialog component
```

#### AuctionDetailModal Usage
```typescript
// In UserAuctionBrowse.tsx:
{selectedAuction && (
  <AuctionDetailModal
    auction={selectedAuction}
    onClose={() => setSelectedAuction(null)}
  />
)}
```

#### API Calls
```typescript
// GET /auctions/{auctionId}/bids
Response: Bid[]

// Uses useAuction hook for:
// - placeBid(auctionId, amount)
// - addToWatchlist(auctionId)
```

---

### `/components/user/UserWatchlist.tsx`
```
UserWatchlist
├── Imports:
│   ├── useState, useEffect, useAuthStore
│   ├── apiClient from '@/lib/api-client'
│   ├── WatchlistItem, Auction from '@/types'
│   ├── UI: Button, Card, Badge, Spinner
│   └── AuctionDetailModal from './AuctionDetailModal'
│
├── State:
│   ├── watchlist: WatchlistItem[]
│   ├── loading: boolean
│   └── selectedAuction: Auction | null
│
├── Effects:
│   └── loadWatchlist() on mount
│
├── Functions:
│   ├── loadWatchlist()
│   │   └── GET /watchlist/{userId}
│   │
│   ├── handleRemoveFromWatchlist(id)
│   │   └── DELETE /watchlist/{id}
│   │
│   └── getStatusColor(status)
│       └── Return color class
│
├── Render:
│   ├── Empty state (if no items)
│   └── For each watchlist item:
│       ├── Image placeholder
│       ├── Auction & product ID
│       ├── Current bid
│       ├── Status badge
│       ├── Bid count, watchers, viewers
│       ├── Time remaining (if live)
│       ├── Added date
│       ├── "Place Bid" button
│       │   └── Opens <AuctionDetailModal />
│       └── "Remove" button
│
├── Conditional Modal:
│   └── {selectedAuction && <AuctionDetailModal ... />}
│
└── Returns: JSX (List of watchlist items)
```

#### UserWatchlist Usage
```typescript
// In UserLayout.tsx:
<TabsContent value="watchlist">
  <UserWatchlist />
</TabsContent>
```

#### API Calls
```typescript
// GET /watchlist/{userId}
Response: WatchlistItem[]

// DELETE /watchlist/{watchlistId}
```

---

### `/components/user/UserProductCreate.tsx`
```
UserProductCreate
├── Imports:
│   ├── useState, useAuthStore
│   ├── apiClient from '@/lib/api-client'
│   ├── Product from '@/types'
│   ├── UI: Button, Card, Input, Textarea, Tabs, Badge, Spinner
│
├── State:
│   ├── formData: ProductFormData
│   │   ├── name: string
│   │   ├── description: string
│   │   ├── basePrice: string
│   │   └── categoryId: string
│   ├── myProducts: Product[]
│   ├── loading, submitLoading: boolean
│   └── activeTab: 'create' | 'my-products'
│
├── Functions:
│   ├── handleInputChange(e)
│   │   └── Update form state
│   │
│   ├── handleSubmit(e)
│   │   ├── Validate form
│   │   ├── POST /products/create
│   │   ├── Reset form
│   │   └── Load products
│   │
│   └── loadMyProducts()
│       └── GET /products/user/{userId}
│
├── Tabs:
│   ├── Create Product Tab:
│   │   ├── Product name input
│   │   ├── Description textarea
│   │   ├── Category dropdown
│   │   ├── Base price input
│   │   ├── Image upload placeholder
│   │   └── Submit button
│   │
│   └── My Products Tab:
│       ├── Refresh button
│       └── For each product:
│           ├── Name, description
│           ├── Price
│           ├── Status badge (PENDING/VERIFIED)
│           ├── Created date
│           ├── "View Details" button
│           └── "Create Auction" button (enabled if verified)
│
└── Returns: JSX (Tabs component)
```

#### UserProductCreate Usage
```typescript
// In UserLayout.tsx:
<TabsContent value="products">
  <UserProductCreate />
</TabsContent>
```

#### API Calls
```typescript
// POST /products/create
Body: {
  name: string
  description: string
  basePrice: number
  categoryId: number
}

// GET /products/user/{userId}
Response: Product[]
```

---

### `/components/user/UserProfileEdit.tsx`
```
UserProfileEdit
├── Imports:
│   ├── useState, useEffect, useAuthStore
│   ├── apiClient from '@/lib/api-client'
│   ├── User from '@/types'
│   ├── UI: Button, Card, Input, Textarea, Badge, Spinner
│
├── State:
│   ├── formData: Partial<User>
│   ├── loading: boolean
│   └── message: string
│
├── Effects:
│   └── Initialize form with user data on mount
│
├── Functions:
│   ├── handleInputChange(e)
│   │   └── Update form state
│   │
│   └── handleSubmit(e)
│       ├── Validate
│       ├── PUT /users/{id}
│       ├── Update auth store
│       └── Show success message
│
├── Render:
│   ├── Account status card:
│   │   ├── Verification badge
│   │   └── Info text
│   │
│   ├── Edit profile form:
│   │   ├── Full name input
│   │   ├── Email input (read-only)
│   │   ├── Bio textarea
│   │   ├── Phone input
│   │   ├── Address textarea
│   │   ├── Success/error message
│   │   └── Submit button
│   │
│   └── Account details card:
│       ├── User ID (read-only)
│       ├── Role (read-only)
│       └── Join date (read-only)
│
└── Returns: JSX (Profile form)
```

#### UserProfileEdit Usage
```typescript
// In UserLayout.tsx:
<TabsContent value="profile">
  <UserProfileEdit />
</TabsContent>
```

#### API Calls
```typescript
// PUT /users/{userId}
Body: {
  name: string
  bio?: string
  phone?: string
  address?: string
}
```

---

## SHARED UTILITIES & HOOKS

### `/hooks/useAuthStore.ts`
```typescript
// Global auth state using Zustand
useAuthStore() returns: {
  user: User | Admin | SuperAdmin | null
  isLoading: boolean
  login: (email, password) => Promise<void>
  logout: () => void
  setUser: (user) => void
}
```

**Used By:** Every layout and form component

---

### `/hooks/useAuction.ts`
```typescript
// Auction operations
useAuction() returns: {
  placeBid: (auctionId, amount) => Promise<void>
  addToWatchlist: (auctionId) => Promise<void>
  connectToAuction: (auctionId) => void // SignalR
  disconnectFromAuction: (auctionId) => void // SignalR
}
```

**Used By:** UserAuctionBrowse, AuctionDetailModal, UserWatchlist

---

### `/lib/api-client.ts`
```typescript
// API client with all endpoints
apiClient methods:
  - getRequest(endpoint)
  - postRequest(endpoint, body)
  - putRequest(endpoint, body)
  - deleteRequest(endpoint)
  - All include auth header
```

**Used By:** All components that make API calls

---

## SHARED UI COMPONENTS

All from `@/components/ui/`:
- `Button` - Standard button
- `Card` - Container card
- `Dialog` - Modal dialog
- `Tabs` - Tab navigation
- `Badge` - Status badge
- `Input` - Text input
- `Textarea` - Text area
- `Spinner` - Loading spinner
- `Select` - Dropdown select
- `Image` - Next.js Image (optimized)

**Used By:** All custom components

---

## AUTHENTICATION COMPONENTS

### `/components/auth/LoginForm.tsx`
- Email/password form
- Submit to API
- Set auth token
- Redirect on success

**Used By:** page.tsx (when not logged in)

### `/components/auth/RegisterForm.tsx`
- Email, password, name form
- Create new user
- Auto-login on success
- Redirect to dashboard

**Used By:** page.tsx (when not logged in)

---

## COMPONENT DEPENDENCY SUMMARY

```
page.tsx (Root Router)
├── LoginForm.tsx
├── RegisterForm.tsx
├── AdminLayout.tsx (if role === ADMIN)
│   ├── AdminProductVerification.tsx
│   │   └── (API calls via apiClient)
│   ├── AdminVerifyAdmins.tsx (if rightToAdd)
│   │   └── (API calls via apiClient)
│   └── AdminVerifiedHistory.tsx
│       └── (API calls via apiClient)
│
└── UserLayout.tsx (if role === USER)
    ├── UserAuctionBrowse.tsx
    │   ├── AuctionDetailModal.tsx
    │   │   ├── useAuction hook
    │   │   └── (API calls via apiClient)
    │   └── (API calls via apiClient)
    ├── UserWatchlist.tsx
    │   ├── AuctionDetailModal.tsx
    │   └── (API calls via apiClient)
    ├── UserProductCreate.tsx
    │   └── (API calls via apiClient)
    └── UserProfileEdit.tsx
        └── (API calls via apiClient)

All components use:
├── useAuthStore() hook
├── UI components from @/components/ui/
├── Types from @/types/index.ts
└── apiClient from @/lib/api-client.ts
```

---

## IMPORT PATTERNS

### Typical Component Imports
```typescript
'use client'

// State
import { useState, useEffect } from 'react'

// Hooks
import { useAuthStore } from '@/hooks/useAuthStore'
import { useAuction } from '@/hooks/useAuction' // (if auction-related)

// API
import { apiClient } from '@/lib/api-client'

// Types
import { ComponentType } from '@/types'

// UI Components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Other Components
import ChildComponent from './ChildComponent' // (if parent)

// Next
import Image from 'next/image' // (if using images)
```

---

## COMPONENT INSTANTIATION EXAMPLES

### Admin Component
```typescript
<AdminProductVerification />
```

### User Component with Props
```typescript
<AuctionDetailModal
  auction={selectedAuction}
  onClose={() => setSelectedAuction(null)}
/>
```

### Conditional Component
```typescript
{user.rightToAdd && (
  <AdminVerifyAdmins />
)}
```

### Within Tabs
```typescript
<TabsContent value="products">
  <AdminProductVerification />
</TabsContent>
```

---

## COMPLETE DEPENDENCY LIST

### Direct Dependencies
- react
- react-dom
- zustand (state management)
- next (framework)
- @hookform/resolvers
- zod (validation)

### UI Dependencies
- @radix-ui/* (all UI components)
- tailwindcss (styling)
- class-variance-authority
- clsx

### Type Dependencies
- TypeScript

### API Dependencies
- Built-in fetch (in browsers)
- @microsoft/signalr (real-time, future)

---

## HOW COMPONENTS CONNECT

### Flow: USER BROWSING AUCTIONS
```
UserLayout (renders browse auctions tab)
  ↓
UserAuctionBrowse.tsx
  ├─ API: GET /auctions/live → Display auctions
  ├─ User clicks auction
  ↓
  AuctionDetailModal.tsx opens
  ├─ API: GET /auctions/{id}/bids → Show bid history
  ├─ User places bid
  └─ API via useAuction: POST /auctions/{id}/bid
```

### Flow: ADMIN VERIFYING PRODUCTS
```
AdminLayout (renders verify products tab)
  ↓
AdminProductVerification.tsx
  ├─ API: GET /products/pending → Show pending products
  ├─ Admin clicks "Verify"
  └─ API: POST /products/verify → Update product
```

---

**All components are independent but work together through:**
- Shared hooks (useAuthStore)
- Shared types
- Shared API client
- Shared UI components
- Page routing


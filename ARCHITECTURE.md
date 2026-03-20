# Auction Platform Architecture

## High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    React Components                         │ │
│  │  - Auth Forms, Product Forms, Auction Detail, Admin Panels │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│                         │                                        │
│  ┌──────────────────────▼─────────────────────────────────────┐ │
│  │                    Custom Hooks                            │ │
│  │  - useAuthStore (state management)                        │ │
│  │  - useAuction (SignalR connection)                        │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│                         │                                        │
│  ┌──────────────────────▼─────────────────────────────────────┐ │
│  │                    API Client Layer                        │ │
│  │  - authApi, productApi, auctionApi, adminApi             │ │
│  │  - Fetch wrapper with JWT auth                           │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
└─────────────────────────┼──────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
    ┌────────────┐  ┌──────────────┐  ┌──────────────┐
    │ API        │  │ API          │  │ WebSocket    │
    │ Gateway    │  │ Gateway      │  │ Auction      │
    │ (5000)     │  │ (5000)       │  │ Service      │
    │            │  │              │  │ (5001)       │
    └──┬────┬────┘  └───────┬──────┘  └──────┬───────┘
       │    │                │                │
    ┌──▼───▼───┐      ┌──────▼──────┐    ┌───▼────────┐
    │ User     │      │ Admin       │    │ SignalR    │
    │ Service  │      │ Service     │    │ Hub        │
    │ (8080)   │      │ (5087)      │    │ (/hubs/    │
    │          │      │             │    │  auction)  │
    └──────────┘      └──────────────┘    └────────────┘
    
    ┌──────────────┐   ┌──────────────┐
    │ Product      │   │ Verify       │
    │ Service      │   │ Service      │
    │ (5088)       │   │ (5089)       │
    └──────────────┘   └──────────────┘
```

---

## Data Flow Examples

### 1. User Registration & First Login

```
Frontend                          Backend
  │                                 │
  ├─ Enter email, password ──────►  │
  │                           POST /api/user/create
  │                                 │
  │  ◄─── Returns { id, name } ───  │ (User Service)
  │                                 │
  ├─ Auto-login with credentials─► │
  │                           POST /api/user/login
  │                                 │
  │  ◄─── Returns { token, userId, role } ─
  │                                 │
  ├─ Store token in localStorage    │
  │                                 │
  ├─ Fetch profile ──────────────► │
  │                           GET /api/user/profile/0
  │                                 │
  │  ◄─── Returns { User } ────────  │
  │                                 │
  └─ Redirect to home              │
```

---

### 2. Creating & Verifying a Product

```
USER WORKFLOW                       ADMIN WORKFLOW
        │                                  │
        │  Create Product                 │
        ├──────────────────┐              │
        │  POST /api/product              │
        │  { name, desc, price }          │
        │         │                       │
        │         ├──────────────────────►│ (Awaiting Verification)
        │                                 │
        │                    Load Pending Products
        │                    GET /api/verify/unverified-products
        │                                 │
        │                    Admin clicks "Verify"
        │                    POST /api/verify/product
        │                    { productId, description }
        │                                 │
        │  ◄────────── Product is now verified
        │                                 │
        └─ Now can create auction        │
```

**Database State Changes:**
```
Product Table:
  id: 1, name: "Watch", basePrice: 100, isVerified: false
           ↓
  (after admin verifies)
           ↓
  id: 1, name: "Watch", basePrice: 100, isVerified: true

Verification Table:
  + New record: { productId: 1, verifierId: 2, status: "Verified" }
```

---

### 3. Auction Lifecycle with Real-Time Bidding

```
TIMELINE VIEW:

T=0         Product verified
            └─ User creates auction
               POST /api/auctions
               { productId: 1, startingPrice: 100, endDate: T+24h }
               └─ Auction status: "Upcoming"

T=10h       Auction start time reached
            └─ Scheduler starts auction
               └─ RabbitMQ event: AuctionStarted
               └─ Auction status: "Live"
               └─ SignalR broadcasts to all connected clients

T=12h       User opens auction detail
            └─ Frontend connects to SignalR hub
               useAuctionHub(auctionId)
               └─ Joins "auction_1" room
               └─ ViewerCountUpdated signal sent to all viewers

T=12:15h    User places bid
            
            ┌─────────────────────────────────────────┐
            │  Frontend                  Backend      │
            │                                         │
            │  Input: $150 ──────────────────────────►│
            │                 POST /api/auctions/1/bids
            │                 { amount: 150 }         │
            │                                         │
            │         Validation:                     │
            │         - 150 >= 100 + 10? ✓            │
            │         - Is Live? ✓                    │
            │         - No cooldown? ✓                │
            │                                         │
            │  ◄────────────────────── Bid accepted  │
            │       { bidId: 5, amount: 150 }        │
            │                                         │
            │  ◄─── BidPlaced event (SignalR) ────   │
            │  {                                      │
            │    bidId: 5,                           │
            │    maskedBidder: "2***5",              │
            │    amount: 150,                        │
            │    placedAt: "2026-03-17T12:15:00Z"    │
            │  }                                      │
            │                                         │
            │  Update UI:                             │
            │  - Current highest bid: $150            │
            │  - Bid count: 2                         │
            │  - Add to bid history                   │
            └─────────────────────────────────────────┘

T=23:55h    Auction ending soon (< 5 min left)
            └─ Scheduler broadcasts AuctionEndingSoon
               └─ SignalR: { minutesRemaining: 5 }
               └─ Frontend shows warning banner

T=23:58h    User places another bid (last 2 min!)
            
            ┌─────────────────────────────────────────┐
            │  Bid in last 2 min triggers auto-extend │
            │                                         │
            │  New endDate = now + 2 minutes          │
            │  └─ TimerTick: { secondsRemaining: 120}│
            │  └─ AuctionMessage: "Extended by 2 min" │
            │  └─ All viewers get updated timer      │
            └─────────────────────────────────────────┘

T=24h       Original end time reached
            └─ But auction extended (still 2 min left)
               └─ TimerTick keeps broadcasting
               └─ Countdown continues for all viewers

T=24:02h    Auction closes
            └─ Scheduler broadcasts AuctionClosed
               └─ SignalR: {
                    auctionId: 1,
                    winnerUserId: 5,
                    finalPrice: 200,
                    closedAt: "2026-03-17T24:02:00Z"
                  }
               └─ Frontend:
                  - Disable bid input
                  - Show winner banner
                  - Bid field becomes read-only
```

---

## Component Interaction Flow

### Auction Detail Component Tree

```
AuctionDetail
  ├─ useAuctionHub(auctionId) ──────┐
  │                                  │
  │  Listeners:                      │
  │  - addBidPlacedListener ────────┐│
  │  - addAuctionClosedListener ────┐││
  │  - addAuctionStartedListener ───┐│││
  │  - addAuctionEndingSoonListener ┐││││
  │                                  │││││
  ├─ State: auction, bids           │││││
  │ auction.currentHighestBid ◄──────┘│││
  │ bids.push(newBid) ◄──────────────┘││
  │ auction.status = "Ended" ◄────────┘│
  │ showWarning = true ◄───────────────┘
  │
  ├─ auctionApi.getDetail()
  │  └─ Load initial auction data
  │
  ├─ auctionApi.getBids()
  │  └─ Load bid history
  │
  ├─ handlePlaceBid()
  │  └─ auctionApi.placeBid(auctionId, amount)
  │     └─ Success: reload auction data
  │     └─ Error: display error message
  │
  └─ Render
     ├─ Auction details (price, timer)
     ├─ Live bid input (if status === "Live")
     ├─ Bid history list
     └─ Messages (from SignalR)
```

---

## State Management Flow

### useAuthStore Hook

```
Persistent State (localStorage)
           ▲
           │
           └─ authToken
              └─ Sent in header: Authorization: Bearer {token}

Runtime State (memory)
      │
      ├─ user { id, name, email, role, isVerified }
      ├─ token
      ├─ isLoading
      ├─ error
      │
      └─ Methods:
         ├─ login() ──┐
         │            ├──► API call
         │            └──► Store token + fetch profile
         │
         ├─ register() ─┐
         │              ├──► API call
         │              └──► Auto-login
         │
         ├─ logout() ──┐
         │             └──► Clear token + reset state
         │
         └─ updateProfile() ─┐
                             └──► API call + update user object
```

---

## API Authentication

### JWT Token Flow

```
1. Login Success
   └─ Backend returns: { token: "eyJ...", userId: 1, role: "USER" }
   
2. Frontend stores token
   └─ localStorage.setItem("token", "eyJ...")
   
3. Every API request
   └─ getAuthToken() retrieves from localStorage
   └─ Request headers: Authorization: Bearer eyJ...
   
4. SignalR WebSocket
   └─ Can't set custom headers in browser
   └─ Pass as query string: ?access_token=eyJ...
   
5. Token expires
   └─ Backend returns 401 Unauthorized
   └─ Frontend catches error
   └─ Clear token + redirect to login
```

---

## Real-Time Auction Hub

### SignalR Connection Lifecycle

```
1. AuctionDetail mounts
   └─ useAuctionHub(auctionId) called
   
2. Register event listeners
   └─ connection.on("BidPlaced", callback)
   └─ connection.on("ViewerCountUpdated", callback)
   └─ etc...
   
3. Start connection
   └─ HubConnectionBuilder()
      .withUrl("http://localhost:5001/hubs/auction", {
        accessTokenFactory: () => getAuthToken()
      })
      .withAutomaticReconnect([0, 1000, 3000, 5000])
      .build()
      
4. Join room
   └─ connection.start()
   └─ connection.invoke("JoinAuction", String(auctionId))
   └─ Redis increments viewer count
   └─ Server broadcasts ViewerCountUpdated to all in room
   
5. Listen for events
   └─ BidPlaced: Update current highest bid + bid history
   └─ ViewerCountUpdated: Update viewer count UI
   └─ TimerTick: Sync countdown timer
   └─ AuctionClosed: Disable bidding + show winner
   
6. Component unmounts
   └─ connection.invoke("LeaveAuction", String(auctionId))
   └─ connection.stop()
   └─ Redis decrements viewer count
```

---

## Error Handling Strategy

### API Errors

```
API Call
   │
   ├─ Success (200-299)
   │  └─ Parse JSON response
   │     └─ Return data
   │
   └─ Failure (400+)
      └─ Throw Error with message
         └─ Component catches
            └─ Display error toast/message
            └─ Log to console
            └─ Optional: Retry logic
```

### Component Error Handling

```
Form Submit
   │
   ├─ Set isLoading = true
   │
   ├─ Try:
   │  └─ Call API
   │     └─ Update state
   │     └─ Reset form
   │     └─ Redirect/refresh
   │
   └─ Catch:
      ├─ Set error message
      ├─ Display error UI
      └─ Set isLoading = false

User sees:
  - Loading spinner while submitting
  - Error message if fails
  - Success message (via toast) if succeeds
```

---

## Database Schema Relationships

```
Users Table
├─ id (PK)
├─ name
├─ email
├─ passwordHash
├─ role: "USER" | "ADMIN" | "SELLER"
└─ isVerified: boolean

Products Table
├─ id (PK)
├─ userId (FK → Users)
├─ name
├─ description
├─ basePrice
├─ isVerified: boolean
└─ createdAt

ProductImages Table
├─ id (PK)
├─ productId (FK → Products)
├─ imageUrl
└─ createdAt

Auctions Table
├─ id (PK)
├─ productId (FK → Products)
├─ status: "Upcoming" | "Live" | "Ended"
├─ startingPrice
├─ reservePrice
├─ minBidIncrement
├─ startDate
├─ endDate
└─ createdAt

Bids Table
├─ id (PK)
├─ auctionId (FK → Auctions)
├─ userId (FK → Users)
├─ amount
├─ status: "Active" | "Outbid"
└─ placedAt

VerificationRequests Table
├─ id (PK)
├─ userId (FK → Users)
├─ status: "Pending" | "Verified"
├─ rightToAdd: boolean
├─ isVerified: boolean
├─ verifierId (FK → Users, nullable)
└─ createdAt
```

---

## Async Operation Timeline

### Creating Auction Example

```
Time    Frontend                         Backend
────────────────────────────────────────────────────
0ms     User clicks Create
100ms   Form validation
200ms   ├─ POST /api/auctions ────────► 
300ms   │  { productId, startDate... }
        │                          ├─ Verify user is authenticated
400ms   │                          ├─ Check product is verified
        │                          ├─ Validate dates
500ms   │                          ├─ Save to DB
        │                          ├─ Publish RabbitMQ event
600ms   │  ◄────── 201 Created ───────
700ms   ├─ Close form
800ms   ├─ Navigate to auction list
900ms   ├─ Reload auctions ────────────►
        │                          └─ SELECT * FROM auctions
1000ms  │  ◄────── New auction ────────
1100ms  ├─ Render new auction in list
1200ms  └─ Done (0.2 seconds total)
```

---

## Authentication State Diagram

```
                    ┌─────────────────┐
                    │  Unauthenticated│
                    └────────┬────────┘
                             │
                             │ Login/Register
                             │
                    ┌────────▼────────┐
                    │   Authenticating│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Authenticated │◄─────┐
                    └────────┬────────┘       │
                             │                │
                             │ On each page   │
                             │ load/refresh   │
                             │                │
                    ┌────────▼────────┐       │
                    │  Check if token │───────┘
                    │  in localStorage│ (Valid)
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Fetch profile  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Fully loaded  │
                    └─────────────────┘
```

---

## Notes for Implementation

1. **Timestamps**: Always use ISO 8601 format from backend
2. **Numbers**: Use JavaScript `number` type (careful with precision)
3. **Pagination**: Implement with `page` and `pageSize` params
4. **Sorting**: Backend handles sorting, frontend just asks
5. **Caching**: Don't cache auction details (always refetch)
6. **Validation**: Validate on frontend for UX, backend validates for security
7. **Errors**: Show user-friendly messages, log technical errors
8. **Retry**: Implement exponential backoff for network errors
9. **Offline**: Can't work offline - all data on backend
10. **Performance**: Use React.memo for bid list items (can be long)

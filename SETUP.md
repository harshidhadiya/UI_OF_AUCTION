# Auction Platform Setup

## Quick Start

### Prerequisites
- API Gateway running on `http://localhost:5000`
- Auction Service running on `http://localhost:5001`
- All backend services running (User, Admin, Product, Verify, Auction)

### Installation

```bash
npm install
# or
pnpm install
```

### Development

```bash
npm run dev
# or
pnpm dev
```

Visit http://localhost:3000

---

## Project Structure

### Core Files

- **`types/index.ts`** - All TypeScript interfaces and types
- **`lib/api-client.ts`** - API client with all endpoints
- **`hooks/useAuthStore.ts`** - Authentication state management
- **`hooks/useAuction.ts`** - SignalR auction hub connection

### Components

#### Authentication
- `components/auth/LoginForm.tsx` - User/Admin login
- `components/auth/RegisterForm.tsx` - User registration

#### Products
- `components/products/ProductForm.tsx` - Create products
- `components/products/ProductList.tsx` - View user products

#### Auctions
- `components/auctions/AuctionList.tsx` - Browse auctions
- `components/auctions/AuctionDetail.tsx` - View auction with bidding

#### Admin
- `components/admin/AdminDashboard.tsx` - Admin stats
- `components/admin/AdminVerification.tsx` - Verify other admins
- `components/admin/AdminProductVerification.tsx` - Verify products

---

## Features Implemented

### User Features
✅ Register/Login  
✅ Create products  
✅ View products  
✅ Browse auctions  
✅ Place bids  
✅ Real-time auction updates (SignalR)  
✅ Watch auctions  
✅ View bid history  
✅ Update profile  

### Admin Features
✅ Login  
✅ Verify products  
✅ Un-verify products  
✅ Verify admin requests  
✅ Grant/Revoke admin rights  
✅ View statistics  
✅ View verified products  
✅ View pending verifications  

---

## API Endpoints Used

### Authentication
- `POST /api/user/create` - Register
- `POST /api/user/login` - User login
- `POST /api/admin/Login` - Admin login
- `GET /api/user/profile/{id}` - Get profile
- `PATCH /api/user/profile` - Update profile

### Products
- `POST /api/product` - Create
- `GET /api/product/all` - List my products
- `PATCH /api/product/{id}` - Update
- `DELETE /api/product/{id}` - Delete
- `POST /api/product/images` - Add images

### Auctions
- `GET /api/auctions` - List auctions
- `GET /api/auctions/{id}` - Get details
- `POST /api/auctions` - Create
- `POST /api/auctions/{id}/bids` - Place bid
- `GET /api/auctions/{id}/bids` - Get bid history
- `POST /api/auctions/{id}/watch` - Watch auction

### Admin/Verification
- `POST /api/verify/product` - Verify product
- `DELETE /api/verify/product/{id}` - Un-verify product
- `GET /api/verify/my-products` - My verified products
- `GET /api/verify/unverified-products` - Pending products
- `GET /api/admin-request/verify/{id}` - Verify request
- `GET /api/admin-request/grant-rights/{id}` - Grant admin rights
- `GET /api/admin-request/revoke-verification/{id}` - Revoke verification

### SignalR Hub
- `ws://localhost:5001/hubs/auction`
- Methods: `JoinAuction`, `LeaveAuction`
- Events: `BidPlaced`, `ViewerCountUpdated`, `AuctionStarted`, `AuctionClosed`, `TimerTick`, `AuctionMessage`

---

## Next Steps to Complete UI

1. **Add styling** - Use Tailwind CSS for better design
2. **Add loading states** - Implement skeleton loaders
3. **Add error handling** - Better error messages and retry logic
4. **Add pagination** - Better pagination UI
5. **Add filters** - Auction filters by status, category, etc.
6. **Add user profile page** - Edit profile, view history
7. **Add auction creation form** - Full auction setup
8. **Add image uploads** - Product image gallery
9. **Add notifications** - Toast notifications for bid updates
10. **Add responsive design** - Mobile-friendly layout

---

## Testing

### Test User Login
- Email: `user@example.com`
- Password: `password123`

### Test Admin Login
- Email: `admin@example.com`
- Password: `adminpass`

---

## Troubleshooting

### Connection Issues
- Ensure all backend services are running on correct ports
- Check CORS settings on backend
- Verify JWT token is being sent correctly

### Auction Hub Connection
- SignalR requires WebSocket support
- Check browser console for connection errors
- Ensure token is valid (check localStorage)

### API Errors
- Check console for detailed error messages
- Verify request format matches API documentation
- Check authentication token is still valid

# Application API Endpoints

This document enlists all the backend API endpoints currently consumed by the BidSphere frontend application.

## 1. Authentication & Profiles
- `POST /api/user/create`
- `POST /api/user/login`
- `GET/PATCH /api/user/profile`
- `GET /api/user/profile/0`
- `GET /api/user/profile/${userId}`

## 2. Admin Portal
- `POST /api/admin/Login`
- `POST /api/admin/signup`
- `GET /api/admin/profile?userid=${userid}`
- `GET /api/admin-request/details/${verifierId}`
- `POST /api/admin-request/filter`
- `GET ${endpoint}` *(dynamic report fetching)*

## 3. Auctions
- `GET /api/auctions?${queryParams}`
- `GET /api/auctions/${id}`
- `PATCH /api/auctions/${auctionId}`
- `DELETE /api/auctions/${auctionId}`
- `GET /api/auctions/created`
- `GET /api/auctions/participated?${queryParams}`
- `GET /api/auctions?queryproductId=${productId}`

## 4. Bidding
- `GET /api/auctions/${id}/bids`
- `POST /api/auctions/${id}/bids`

## 5. Products
- `GET/POST /api/Product`
- `GET/POST /api/Product/all` 
- `PATCH /api/Product/${productId}`
- `DELETE /api/Product/${productId}`
- `POST /api/Product/images`
- `DELETE /api/Product/${productId}/images/${imageId}`

## 6. Verifications
- `POST /api/verify/auction`
- `POST/PATCH /api/verify/product`
- `POST /api/verify/products`

## 7. Watchlist
- `GET /api/Watchlist/watched`
- `POST /api/Watchlist/${auctionId}/watch`
- `DELETE /api/Watchlist/${auctionId}/watch`

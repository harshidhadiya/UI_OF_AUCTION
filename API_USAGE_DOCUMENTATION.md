# API Usage Documentation

This document provides a comprehensive map of all backend API endpoints used by the frontend application, categorized by the pages that consume them.

## [Authentication & User Management]

### 1. Register Page (`/register`)
-   **Endpoint**: `/api/user/create`
-   **Method**: `POST`
-   **Trigger**: Form submission.
-   **Payload**: User registration details (Name, Email, Password, etc.) via `FormData`.
-   **Purpose**: Creates a new user account.

### 2. Login Page (`/login`)
-   **Endpoint**: `/api/user/login`
-   **Method**: `POST`
-   **Trigger**: Form submission.
-   **Payload**: Credentials (Email, Password).
-   **Purpose**: Authenticates the user and retrieves a JWT token.

### 3. Profile Page (`/profile`)
-   **Endpoint**: `/api/user/profile/0`
-   **Method**: `GET`
-   **Trigger**: Page load.
-   **Purpose**: Fetches the current logged-in user's profile information.
-   **Endpoint**: `/api/user/profile`
-   **Method**: `PATCH`
-   **Trigger**: Update profile button.
-   **Payload**: Updated profile fields or profile image via `FormData`.
-   **Purpose**: Updates user profile details.
-   **Endpoint**: `/api/admin/profile?userid={id}`
-   **Method**: `GET`
-   **Trigger**: Loaded on profile view if user is an Admin.
-   **Purpose**: Fetches admin-specific profile data.

---

## [Product Management]

### 1. Products Hub (`/products`)
-   **Endpoint**: `/api/Product/all` (List)
-   **Method**: `POST`
-   **Trigger**: Page load / Search / Filter.
-   **Payload**: `currentPage`, `pageSize`, `searchName`, `verifiedFilter` (Boolean), `buyFrom`, `buyTo`.
-   **Purpose**: Fetches a paginated list of products.
-   **Endpoint**: `/api/Product`
-   **Method**: `POST`
-   **Trigger**: Create Product modal submission.
-   **Payload**: Product details and images via `FormData`.
-   **Purpose**: Adds a new product to the platform.
-   **Endpoint**: `/api/Product/{id}`
-   **Method**: `PATCH`
-   **Trigger**: Update Product modal submission.
-   **Payload**: Changed product fields.
-   **Purpose**: Updates an existing product.
-   **Endpoint**: `/api/Product/{id}`
-   **Method**: `DELETE`
-   **Trigger**: Delete button in Product Details modal.
-   **Purpose**: Removes a product from the database.
-   **Endpoint**: `/api/Product/images`
-   **Method**: `POST`
-   **Trigger**: Adding images during product update.
-   **Payload**: Image files.
-   **Purpose**: Adds new images to an existing product.
-   **Endpoint**: `/api/Product/{productId}/images/{imageId}`
-   **Method**: `DELETE`
-   **Trigger**: Removing an image during product update.
-   **Purpose**: Deletes a specific product image.

---

## [Auction Management]

### 1. Auctions Hall (`/auctions`)
-   **Endpoint**: `/api/auctions`
-   **Method**: `GET`
-   **Trigger**: Page load / Search / Filter.
-   **Payload**: `Page`, `PageSize`, `Status`, `MinPrice`, `MaxPrice`, `name`, `mine`.
-   **Purpose**: Fetches a paginated list of all auctions.
-   **Endpoint**: `/api/verify/auction`
-   **Method**: `POST`
-   **Trigger**: Launch Auction button (status "Verified" -> "Upcoming").
-   **Payload**: Auction settings (Prices, Dates).
-   **Purpose**: Moves an auction from verification stage to active/scheduled.
-   **Endpoint**: `/api/auctions/{id}`
-   **Method**: `PATCH`
-   **Trigger**: Update Auction modal submission.
-   **Payload**: Modified prices or dates.
-   **Purpose**: Updates auction parameters.
-   **Endpoint**: `/api/auctions/{id}`
-   **Method**: `DELETE`
-   **Trigger**: Cancel Auction button.
-   **Purpose**: Cancels an upcoming or scheduled auction.

### 2. Live Auction Room (`/auction/[id]`)
-   **Endpoint**: `/api/auctions/{id}`
-   **Method**: `GET`
-   **Trigger**: Page load.
-   **Purpose**: Fetches real-time status and details for a specific auction.
-   **Endpoint**: `/api/auctions/{id}/bids` (Paginated)
-   **Method**: `GET`
-   **Trigger**: Page load / Scroll for history.
-   **Payload**: `page`, `pageSize`, `mine` (toggle between All Bids and My Bids).
-   **Purpose**: Fetches paginated bid history for the auction.
-   **Endpoint**: `/api/auctions/{id}/bids`
-   **Method**: `POST`
-   **Trigger**: "Place Bid" button.
-   **Payload**: `amount`.
-   **Purpose**: Submits a new bid for the current user.
-   **Endpoint**: `/api/User/profile/{winnerId}`
-   **Method**: `GET`
-   **Trigger**: When auction ends, if the user is owner/winner.
-   **Purpose**: Fetches winner's contact details (Protected action).

### 3. My Auctions (`/my-auctions`)
-   **Endpoint**: `/api/auctions/created`
-   **Method**: `GET`
-   **Trigger**: Page load.
-   **Purpose**: Lists all auctions created by the current user.

### 4. Participations (`/participations`)
-   **Endpoint**: `/api/auctions/participated`
-   **Method**: `GET`
-   **Trigger**: Page load / Search / Filter.
-   **Payload**: Similar to `/api/auctions` (status, price range, dates).
-   **Purpose**: Lists auctions where the user has placed at least one bid.

---

## [Watchlist & Social]

### 1. Watchlist Page (`/watchlist`) & Dashboard
-   **Endpoint**: `/api/Watchlist/watched`
-   **Method**: `GET`
-   **Trigger**: Page load.
-   **Purpose**: Fetches the list of auctions the user is watching.
-   **Endpoint**: `/api/Watchlist/{id}/watch`
-   **Method**: `POST`
-   **Trigger**: "Watch" button on any Auction card.
-   **Purpose**: Adds an auction to the user's watchlist.
-   **Endpoint**: `/api/Watchlist/{id}/watch`
-   **Method**: `DELETE`
-   **Trigger**: "Unwatch" button.
-   **Purpose**: Removes an auction from the user's watchlist.

---

## [Admin Management]

### 1. Admin Dashboard (`/admin/dashboard`)
-   **Endpoint**: `/api/admin-request/filter`
-   **Method**: `POST`
-   **Trigger**: Page load / Search.
-   **Payload**: `name`, `email`, `from`, `to`, `pending`, `mine`, `page`, `pageSize`.
-   **Purpose**: Lists and filters user identity verification requests.
-   **Endpoint**: `/api/admin/profile?userid={userid}`
-   **Method**: `GET`
-   **Trigger**: Clicking "View Full Details" on a verification card.
-   **Purpose**: Fetches detailed profile of the verification requester.
-   **Endpoint**: `/api/admin-request/verify/{id}`
-   **Method**: `GET`
-   **Trigger**: "Verify Identity" button in the review modal.
-   **Purpose**: Approves the user's identity verification.
-   **Endpoint**: `/api/admin-request/grant-rights/{id}`
-   **Method**: `GET`
-   **Trigger**: "Grant Rights" button in the review modal.
-   **Purpose**: Grants the user rights to post items (Can Post).
-   **Endpoint**: `/api/admin-request/revoke-rights/{id}`
-   **Method**: `GET`
-   **Trigger**: "Revoke Rights" button.
-   **Purpose**: Removes the user's posting rights.
-   **Endpoint**: `/api/admin-request/revoke-verification/{id}`
-   **Method**: `GET`
-   **Trigger**: "Revoke Verification" button.
-   **Purpose**: Cancels a previously approved verification.
-   **Endpoint**: `/api/admin-request/details/{verifierId}`
-   **Method**: `GET`
-   **Trigger**: Fetching details of the admin who verified a user.
-   **Purpose**: Shows who performed the verification.

### 2. Admin Product Verification (`/admin/products`)
-   **Endpoint**: `/api/verify/products`
-   **Method**: `POST`
-   **Trigger**: Page load / Search.
-   **Payload**: `name`, `pending`, `mine`, `verified`, `page`, `pagesize`.
-   **Purpose**: Lists products awaiting or completed verification by admins.
-   **Endpoint**: `/api/verify/product`
-   **Method**: `POST`
-   **Trigger**: "Approve & Verify Product" button.
-   **Payload**: `ProductId`, `SellerId`, `description` (remarks).
-   **Purpose**: Formally verifies a seller's product for the marketplace.
-   **Endpoint**: `/api/verify/product`
-   **Method**: `PATCH`
-   **Trigger**: "Unverify Product" button.
-   **Payload**: `ProductId`, `description` (reason).
-   **Purpose**: Revokes verification for a product.

### 3. Admin Authentication
-   **Endpoint**: `/api/admin/Login`
-   **Method**: `POST`
-   **Trigger**: Admin login form.
-   **Purpose**: Admin-specific authentication.
-   **Endpoint**: `/api/admin/signup`
-   **Method**: `POST`
-   **Trigger**: Admin registration.
-   **Purpose**: Creates a new admin account.

---

## [Utility Endpoints (Used Globally)]

-   **Endpoint**: `/api/User/profile/{id}`
    -   **Context**: Used in `ProductDetailsModal.tsx`, `AuctionCard.tsx`, `ParticipationCard.tsx`, `LiveAuctionPage.tsx`.
    -   **Trigger**: Fetching owner info, winner info, or seller info.
    -   **Purpose**: Displays user details like Name, Email, and Phone number.
-   **Endpoint**: `/api/Product/all` (with Single `productId`)
    -   **Context**: `handleViewProduct` or `handleQuickView` functions on various pages.
    -   **Trigger**: Clicking a product image or title.
    -   **Purpose**: Fetches the full product object for display in a detail modal.
-   **Endpoint**: `/api/auctions?productId={id}`
    -   **Context**: `ProductDetailsModal.tsx` and `app/products/page.tsx`.
    -   **Trigger**: Checking if an auction already exists for a specific product.
    -   **Purpose**: Determines whether to show "Launch Auction" or "Auction Scheduled".
-   **Endpoint**: `/api/auctions?mine=true`
    -   **Context**: `app/auctions/page.tsx`.
    -   **Trigger**: Fetching auctions created by the current user for internal checks.

# Complete API Endpoints Documentation

This document provides a comprehensive list of all API endpoints and SignalR hub methods used across the entire application's frontend.

---

## 👤 User & Authentication
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| **POST** | `/api/user/create` | User registration / signup. |
| **POST** | `/api/user/login` | User authentication / login. |
| **GET** | `/api/user/profile/0` | Fetch the current authenticated user's profile. |
| **GET** | `/api/user/profile/{userId}` | Fetch a specific user's public profile details. |
| **PATCH** | `/api/user/profile` | Update the current user's profile information. |

---

## 🛡️ Admin & Moderation
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| **POST** | `/api/admin/signup` | Administrator account registration. |
| **POST** | `/api/admin/Login` | Administrator authentication. |
| **GET** | `/api/admin/profile?userid={id}` | Fetch detailed admin profile metadata. |
| **POST** | `/api/admin-request/filter` | Filter and search through administrative requests. |
| **GET** | `/api/admin-request/details/{id}` | Fetch specific details for a verification or admin request. |
| **POST** | `/api/verify/products` | Admin endpoint to filter products pending verification. |
| **POST** | `/api/verify/product` | Submit a verification decision for a product. |
| **PATCH** | `/api/verify/product` | Update an existing product verification status. |
| **POST** | `/api/verify/auction` | Approve or reject an auction launch request. |

---

## 📦 Product Management
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| **POST** | `/api/Product` | Create a new product entry. |
| **PATCH** | `/api/Product/{id}` | Update existing product details. |
| **DELETE** | `/api/Product/{id}` | Remove a product from the system. |
| **POST** | `/api/Product/all` | Search and filter all available products. |
| **POST** | `/api/Product/images` | Upload new images for a product. |
| **DELETE** | `/api/Product/{pid}/images/{iid}`| Remove a specific image from a product. |

---

## 🔨 Auctions & Bidding
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| **GET** | `/api/auctions` | List all auctions (supports paged/filtered results). |
| **GET** | `/api/auctions/{id}` | Fetch full details for a single auction. |
| **GET** | `/api/auctions/participated` | Fetch auctions where the user has placed at least one bid. |
| **GET** | `/api/auctions/watched` | Fetch the user's current watchlist. | here replace auctions to watchlist
| **GET** | `/api/auctions/created` | Fetch auctions created by the current user. | 
| **POST** | `/api/auctions/{id}/watch` | Add an auction to the user's watchlist. |here replace auctions to watchlist
| **DELETE** | `/api/auctions/{id}/watch` | Remove an auction from the user's watchlist. |here replace auctions to watchlist
| **PATCH** | `/api/auctions/{id}` | Update auction parameters (for upcoming auctions). |
| **GET** | `/api/auctions/{id}/bids` | Fetch the bid history for a specific auction. |
| **POST** | `/api/auctions/{id}/bids` | Place a new bid on an auction. |

---

## 📡 SignalR Hub (`/auctionHub`)
| Action | Hub Method | Description |
|:-------|:-----------|:------------|
| **Invoke** | `JoinAuction` | Join a room as an active viewer (affects viewer count). |
| **Invoke** | `ListenToAuction` | Join a group for updates without being counted as a viewer. |
| **Invoke** | `LeaveAuction` | Exit a specific auction room entirely. |
| **Invoke** | `StopViewing` | Downgrade from 'Viewer' to 'Listener' status. |
| **Listen** | `BidPlaced` | Real-time notification of a new high bid. |
| **Listen** | `TimerTick` | Per-second synchronization of the auction clock. |
| **Listen** | `ViewerCountUpdated` | Updates the live viewer statistic on the card/page. |
| **Listen** | `AuctionStarted` | Global signal that an auction has moved to the 'Live' state. |
| **Listen** | `AuctionClosed` | Final signal containing winner and closing price details. |

---

> [!TIP]
> All endpoints are prefixed with the base API URL (e.g., `http://localhost:5000`).
> Token authentication is required for all endpoints except Login and Register.

'use client';

/**
 * Global singleton SignalR connection for the auction hub.
 * Used by:
 *   - Watchlist page: JoinAuction / LeaveAuction + event listeners
 *   - Any page: AuctionStarted global notification
 */

import * as signalR from '@microsoft/signalr';

const SIGNALR_HUB_URL = 'http://localhost:5000/hubs/auction';

let connection: signalR.HubConnection | null = null;

/** Returns an existing Connected connection, or builds + starts a new one. */
export async function getAuctionConnection(token: string): Promise<signalR.HubConnection | null> {
  // Reuse if already connected
  if (connection && connection.state === signalR.HubConnectionState.Connected) {
    return connection;
  }

  // Stop a stale connection before re-creating
  if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
    try { await connection.stop(); } catch { /* ignore */ }
  }

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${SIGNALR_HUB_URL}?access_token=${token}`, {
      skipNegotiation: true,
      transport: signalR.HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  try {
    await connection.start();
    console.log(`[SignalR] ✅ Connected to AuctionHub — state: ${connection.state}, connectionId: ${connection.connectionId}`);
    return connection;
  } catch (err) {
    console.error('[SignalR] ❌ Connection failed:', err);
    connection = null;
    return null;
  }
}

/** Cleanly stop and dispose the connection. */
export async function stopAuctionConnection() {
  if (connection) {
    try { await connection.stop(); } catch { /* ignore */ }
    connection = null;
  }
}

// Map to track how many components on the client currently "need" this room
const roomRefCounts = new Map<string, number>();

export async function listenToAuctionSafe(conn: signalR.HubConnection, auctionId: string) {
  const currentCount = roomRefCounts.get(auctionId) || 0;
  roomRefCounts.set(auctionId, currentCount + 1);
  if (currentCount === 0) {
    try {
      await conn.invoke('ListenToAuction', auctionId);
      console.log(`[SignalR] 👂 Listening to room auction_${auctionId}`);
    } catch (err) {
      console.error(`[SignalR] ❌ ListenToAuction failed for ${auctionId}:`, err);
      roomRefCounts.delete(auctionId);
    }
  }
}

export async function joinAuctionRoomSafe(conn: signalR.HubConnection, auctionId: string) {
  const currentCount = roomRefCounts.get(auctionId) || 0;
  roomRefCounts.set(auctionId, currentCount + 1);
  if (currentCount === 0) {
    try {
      await conn.invoke('JoinAuction', auctionId);
      console.log(`[SignalR] ✅ Globally joined room auction_${auctionId} (Active Viewer)`);
    } catch (err) {
      console.error(`[SignalR] ❌ JoinAuction failed for ${auctionId}:`, err);
      roomRefCounts.delete(auctionId); // revert if failed
    }
  } else {
    // If we're already listening but now want to 'Join' as a viewer, we should elevate it
    // However, for simplicity if count > 0 we assume we are at least listening.
    // To be safe, we can re-invoke JoinAuction if we need to ensure the server counts us.
    try {
      await conn.invoke('JoinAuction', auctionId);
    } catch (err) {
      console.error(`[SignalR] ❌ Elevation to JoinAuction failed for ${auctionId}:`, err);
    }
    console.log(`[SignalR] ℹ️ Already in room auction_${auctionId} (refs: ${currentCount + 1})`);
  }
}

export async function leaveAuctionRoomSafe(conn: signalR.HubConnection, auctionId: string) {
  const currentCount = roomRefCounts.get(auctionId) || 0;
  if (currentCount <= 1) {
    roomRefCounts.delete(auctionId);
    if (conn.state === signalR.HubConnectionState.Connected) {
      try {
        await conn.invoke('LeaveAuction', auctionId);
        console.log(`[SignalR] 🛑 Globally left room auction_${auctionId}`);
      } catch (err) {
        console.error(`[SignalR] ❌ LeaveAuction failed for ${auctionId}:`, err);
      }
    }
  } else {
    // If we're dropping from N > 1 to N-1, we should 'StopViewing' 
    // in case the caller was a viewer (joinAuctionRoomSafe) 
    // but the remaining refs are listeners.
    roomRefCounts.set(auctionId, currentCount - 1);
    if (conn.state === signalR.HubConnectionState.Connected) {
      try {
        await conn.invoke('StopViewing', auctionId);
        console.log(`[SignalR] 📉 Stopped viewing auction_${auctionId} (remain refs: ${currentCount - 1})`);
      } catch (err) {
        console.error(`[SignalR] ❌ StopViewing failed for ${auctionId}:`, err);
      }
    }
  }
}

export { signalR };

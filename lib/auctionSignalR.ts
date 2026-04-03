'use client';

/**
 * Global singleton SignalR connection for the auction hub.
 * Automatically refreshes session cookies on connection failure.
 */

import * as signalR from '@microsoft/signalr';
import { auth } from './auth';

const SIGNALR_HUB_URL = 'http://localhost:5000/hubs/auction';

let connection: signalR.HubConnection | null = null;
let connectionPromise: Promise<signalR.HubConnection | null> | null = null;

/**
 * Returns a Connected SignalR HubConnection using session cookies.
 * - If the connection fails (401 / Session Expired), refreshes cookies via auth and retries once.
 */
export async function getAuctionConnection(): Promise<signalR.HubConnection | null> {
  // If already connecting, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // If already connected, reuse
  if (connection && connection.state === signalR.HubConnectionState.Connected) {
    return connection;
  }

  // Start a new connection
  connectionPromise = buildAndConnect();
  return connectionPromise;
}

/**
 * Build a new SignalR connection and start it using browser-managed cookies.
 */
async function buildAndConnect(): Promise<signalR.HubConnection | null> {
  try {
    if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
      try { await connection.stop(); } catch { /* ignore */ }
    }

    connection = createConnection();
    await connection.start();
    console.log(`[SignalR] ✅ Connected via Session Cookies — id: ${connection.connectionId}`);
    return connection;
  } catch (err) {
    console.warn('[SignalR] ⚠️ Connection failed, attempting session refresh...', err);
    connection = null;

    // ── Session refresh + retry ────────────────────────────────────
    try {
      const refreshed = await auth.tryRefresh(auth.getIsAdmin());

      if (!refreshed) {
        console.error('[SignalR] ❌ Session refresh failed — cannot connect');
        return null;
      }

      console.log('[SignalR] 🔄 Session refreshed — retrying connection...');
      connection = createConnection();
      await connection.start();
      console.log(`[SignalR] ✅ Connected after refresh — id: ${connection.connectionId}`);
      return connection;
    } catch (retryErr) {
      console.error('[SignalR] ❌ Connection failed even after session refresh:', retryErr);
      connection = null;
      return null;
    }
  } finally {
    connectionPromise = null;
  }
}

/** 
 * Create a HubConnection instance. 
 * Browser cookies are automatically sent with withCredentials: true (standard behavior).
 */
function createConnection(): signalR.HubConnection {
  const conn = new signalR.HubConnectionBuilder()
    .withUrl(SIGNALR_HUB_URL, {
      skipNegotiation: true,
      transport: signalR.HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  conn.onreconnected(async (connectionId) => {
    console.log(`[SignalR] 🔄 Reconnected with new ID: ${connectionId}. Restoring rooms...`);
    for (const [auctionId, count] of roomRefCounts.entries()) {
      if (count > 0) {
        try {
          await conn.invoke('JoinAuction', auctionId);
          console.log(`[SignalR] 🔄 Restored JoinAuction for ${auctionId}`);
        } catch (e) {
          console.error(`[SignalR] ❌ Failed to restore JoinAuction for ${auctionId}`, e);
        }
      }
    }
  });

  return conn;
}

/** Cleanly stop and dispose the connection. */
export async function stopAuctionConnection() {
  if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
    try { await connection.stop(); } catch { /* ignore */ }
    connection = null;
  }
}

// Map to track how many components currently "need" this room
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
      await conn.invoke('ListenToAuction', auctionId);
      await conn.invoke('JoinAuction', auctionId);
      console.log(`[SignalR] ✅ Globally joined room auction_${auctionId} (Active Viewer)`);
    } catch (err) {
      console.error(`[SignalR] ❌ JoinAuction failed for ${auctionId}:`, err);
      roomRefCounts.delete(auctionId);
    }
  } else {
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

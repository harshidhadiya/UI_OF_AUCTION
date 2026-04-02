'use client';

import { api } from './api';

// ── In-memory storage (no localStorage) ──────────────────────────────
// Token is now handled by HttpOnly cookies (browser automated).
let _user: any | null = null;
let _isAdmin: boolean = false;

// Prevent duplicate refresh calls per role
let _userRefreshPromise: Promise<boolean> | null = null;
let _adminRefreshPromise: Promise<boolean> | null = null;

export const auth = {
  // ── User ─────────────────────────────────────────────────────────
  setUser(user: any) {
    _user = user;
    if (user && typeof window !== 'undefined' && user.role) {
      localStorage.setItem('last-role', user.role);
    }
  },
  getUser(): any | null {
    return _user;
  },

  // ── Admin flag ───────────────────────────────────────────────────
  setIsAdmin(isAdmin: boolean) {
    _isAdmin = isAdmin;
  },
  getIsAdmin(): boolean {
    return _isAdmin;
  },

  // ── Logout ───────────────────────────────────────────────────────
  async logout() {
    try {
      if (_isAdmin) {
        await api.delete('/api/admin/refresh/logout');
      } else {
        await api.delete('/api/user/refresh/logout');
      }
    } catch (err) {
      console.error('[Auth] Server-side logout failed:', err);
    }

    _user = null;
    _isAdmin = false;
    _userRefreshPromise = null;
    _adminRefreshPromise = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('last-role');
      window.location.href = '/login';
    }
  },

  async logoutUser() {
    try {
      await api.delete('/api/user/refresh/logout');
    } catch (err) {
      console.error('[Auth] Server-side user logout failed:', err);
    }

    _user = null;
    _isAdmin = false;
    _userRefreshPromise = null;
    _adminRefreshPromise = null;
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  async logoutAdmin() {
    try {
      await api.delete('/api/admin/refresh/logout');
    } catch (err) {
      console.error('[Auth] Server-side admin logout failed:', err);
    }

    _user = null;
    _isAdmin = false;
    _userRefreshPromise = null;
    _adminRefreshPromise = null;
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  // ── Refresh: User side ───────────────────────────────────────────
  // We no longer need to extract or store a 'token' string.
  // We just call the endpoints to trigger cookie updates and re-hydrate UI state.
  async refreshUser(): Promise<boolean> {
    if (_userRefreshPromise) return _userRefreshPromise;

    _userRefreshPromise = (async () => {
      try {
        console.log('[Auth] Refreshing user session (Cookies)...');
        await api.get<any>('/api/user/refresh');

        console.log('[Auth] Refresh successful, fetching profile...');

        // Fetch user profile (Backend reads identity from cookie automatically)
        const profileRes = await api.get<any>('/api/user/profile/0');
        
        const d = profileRes?.data ?? profileRes;
        if (d && (d.id || d.Id || d.email || d.Email)) {
          _user = {
            id: d.id ?? d.Id,
            name: d.name ?? d.Name,
            email: d.email ?? d.Email,
            phone: d.phone ?? d.Phone,
            address: d.address ?? d.Address,
            imageUrl: d.imageUrl ?? d.ImageUrl,
            role: d.role ?? d.Role,
          };
          _isAdmin = false;
          console.log('[Auth] Profile restored:', _user.email);
          return true;
        }

        console.error('[Auth] Profile data missing after refresh');
        return false;
      } catch (err) {
        console.error('[Auth] User refresh failed:', err);
        return false;
      } finally {
        _userRefreshPromise = null;
      }
    })();

    return _userRefreshPromise;
  },

  // ── Refresh: Admin side ──────────────────────────────────────────
  async refreshAdmin(): Promise<boolean> {
    if (_adminRefreshPromise) return _adminRefreshPromise;

    _adminRefreshPromise = (async () => {
      try {
        console.log('[Auth] Refreshing admin session (Cookies)...');
        await api.get<any>('/api/admin/refresh');

        console.log('[Auth] Refresh successful, fetching admin profile...');

        const profileRes = await api.get<any>('/api/admin/profile');

        const d = profileRes?.data ?? profileRes;
        if (d && (d.id || d.Id || d.email || d.Email)) {
          _user = {
            id: d.id ?? d.Id,
            name: d.name ?? d.Name,
            email: d.email ?? d.Email,
            phone: d.phone ?? d.Phone,
            address: d.address ?? d.Address,
            imageUrl: d.imageUrl ?? d.ImageUrl,
            role: d.role ?? d.Role ?? 'ADMIN',
            requestObj: (d.obj || d.Obj) ? (() => {
              const o = d.obj ?? d.Obj;
              return {
                id: o.id ?? o.Id,
                name: o.name ?? o.Name,
                email: o.email ?? o.Email,
                requestUserId: o.requestUserId ?? o.RequestUserId,
                verifierId: o.verifierId ?? o.VerifierId,
                verifiedByAdmin: o.verifiedByAdmin ?? o.VerifiedByAdmin,
                hasRightToAdd: o.hasRightToAdd ?? o.HasRightToAdd,
                createdAt: o.createdAt ?? o.CreatedAt,
                verifiedAt: o.verifiedAt ?? o.VerifiedAt,
                rightsGrantedAt: o.rightsGrantedAt ?? o.RightsGrantedAt,
              };
            })() : undefined,
          };
          _isAdmin = true;
          console.log('[Auth] Admin profile restored:', _user.email);
          return true;
        }

        console.error('[Auth] Admin profile missing after refresh');
        return false;
      } catch (err) {
        console.error('[Auth] Admin refresh failed:', err);
        return false;
      } finally {
        _adminRefreshPromise = null;
      }
    })();

    return _adminRefreshPromise;
  },

  async tryRefresh(preferAdmin?: boolean): Promise<boolean> {
    try {
      const lastRole = typeof window !== 'undefined' ? localStorage.getItem('last-role') : null;
      const shouldPreferAdmin = preferAdmin ?? (lastRole === 'ADMIN');

      if (shouldPreferAdmin) {
        const ok = await auth.refreshAdmin();
        if (ok) return true;
        return auth.refreshUser();
      }
      
      const ok = await auth.refreshUser();
      if (ok) return true;
      return auth.refreshAdmin();
    } catch (err) {
      console.error('[Auth] Global refresh error:', err);
      return false;
    }
  },

  // For migration compatibility
  getToken() { return null; }
};

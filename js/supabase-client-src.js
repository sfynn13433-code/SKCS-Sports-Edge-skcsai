import { createClient } from '@supabase/supabase-js';

const supabaseUrl = window.SUPABASE_URL || 'https://ghzjntdvaptuxfpvhybb.supabase.co';
const supabaseAnonKey = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoempudGR2YXB0dXhmcHZoeWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDAzNzIsImV4cCI6MjA4NzgxNjM3Mn0.nWxOY0lDIDDvexELk9De2aEfPfM5iJjoaW91tbL7YQk';

class SafeStorageAdapter {
  constructor() {
    this.memoryStorage = new Map();
    this.isLocalStorageAvailable = this._checkStorageAvailability('localStorage');
  }

  _checkStorageAvailability(type) {
    try {
      const storage = window[type];
      const testKey = '__storage_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn(`[Storage] ${type} not available:`, e.message);
      return false;
    }
  }

  getItem(key) {
    try {
      if (this.isLocalStorageAvailable) {
        return localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('[Storage] localStorage getItem failed');
    }
    return this.memoryStorage.get(key) || null;
  }

  setItem(key, value) {
    try {
      if (this.isLocalStorageAvailable) {
        localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn('[Storage] localStorage setItem failed');
    }
    this.memoryStorage.set(key, value);
  }

  removeItem(key) {
    try {
      if (this.isLocalStorageAvailable) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('[Storage] localStorage removeItem failed');
    }
    this.memoryStorage.delete(key);
  }
}

const safeStorage = new SafeStorageAdapter();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'skcs-auth-token',
    storage: safeStorage
  }
});

window.supabase = supabase;
console.log('[Supabase] Initialized with local bundle and safe storage');

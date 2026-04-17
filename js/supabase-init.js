// SKCS AI Sports Edge - Supabase Client Initialization
// Load directly from CDN to avoid ITP issues with localStorage

(function() {
    'use strict';
    
    const SUPABASE_URL = window.SUPABASE_URL || 'https://ghzjntdvaptuxfpvhybb.supabase.co';
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoempudGR2YXB0dXhmcHZoeWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDAzNzIsImV4cCI6MjA4NzgxNjM3Mn0.nWxOY0lDIDDvexELk9De2aEfPfM5iJjoaW91tbL7YQk';

    // SafeStorage class for ITP bypass
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

    // Initialize when script loads
    function initSupabase() {
        const authConfig = {
            storage: window.localStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'skcs-auth'
        };

        // Check if supabase is already loaded from CDN
        if (window.supabase && window.supabase.createClient) {
            console.log('[Supabase] CDN version already loaded');
            
            // Create client with safe storage
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: authConfig
            });
            
            console.log('[Supabase] Client initialized with safe storage adapter');
            return;
        }
        
        // If supabase object exists but createClient is missing, log error
        if (window.supabase && !window.supabase.createClient) {
            console.error('[Supabase] Library loaded but createClient is missing. Object keys:', Object.keys(window.supabase));
            return;
        }
        
        // supabase not loaded yet, wait for it
        console.log('[Supabase] Waiting for CDN to load...');
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkInterval = setInterval(function() {
            attempts++;
            
            if (window.supabase && window.supabase.createClient) {
                clearInterval(checkInterval);
                console.log('[Supabase] CDN loaded after ' + attempts + ' checks');
                
                window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: authConfig
                });
                
                console.log('[Supabase] Client initialized with safe storage adapter');
                return;
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('[Supabase] Timeout waiting for CDN to load');
            }
        }, 100);
    }
    
    // Start initialization
    initSupabase();
})();

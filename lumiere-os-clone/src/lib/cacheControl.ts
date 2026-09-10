import { APP_INFO } from '../config/appInfo';

/**
 * Safely clears all Cache API storages associated with LumiereOS
 */
export async function clearLumiereCaches() {
  if (typeof window === 'undefined' || !window.caches) return;
  try {
    const keys = await window.caches.keys();
    let clearedCount = 0;
    await Promise.all(
      keys
        .filter(key => {
          const lowerKey = key.toLowerCase();
          return (
            lowerKey.includes('lumiere') ||
            lowerKey.includes('workbox') ||
            lowerKey.includes('vite') ||
            lowerKey.includes('precache') ||
            lowerKey.includes('runtime')
          );
        })
        .map(key => {
          clearedCount++;
          return window.caches.delete(key);
        })
    );
    console.info(`[LumiereOS] ${clearedCount} caches cleared successfully.`);
  } catch (error) {
    console.error('[LumiereOS] Error clearing Cache API caches:', error);
  }
}

/**
 * Unregisters all registered Service Workers safely
 */
export async function unregisterOldServiceWorkers() {
  if (typeof window === 'undefined' || !navigator.serviceWorker) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    let count = 0;
    for (const registration of registrations) {
      await registration.unregister();
      count++;
      console.info('[LumiereOS] Unregistered old service worker registration:', registration);
    }
    console.info(`[LumiereOS] ${count} service workers unregistered.`);
  } catch (error) {
    console.error('[LumiereOS] Error unregistering old service workers:', error);
  }
}

/**
 * Recovers and reloads the current page with a date timestamp query parameter to bypass cache
 */
export function forceFreshReload(path?: string) {
  if (typeof window === 'undefined') return;
  const currentPath = path || window.location.pathname + window.location.search;
  
  // Strip any existing "fresh" parameter
  let cleanPath = currentPath;
  try {
    const url = new URL(window.location.origin + currentPath);
    url.searchParams.delete('fresh');
    cleanPath = url.pathname + url.search;
  } catch (e) {
    // Basic fallback if URL constructor fails
    cleanPath = currentPath.replace(/[?&]fresh=[^&]+/g, '');
  }

  const separator = cleanPath.includes('?') ? '&' : '?';
  const freshUrl = `${cleanPath}${separator}fresh=${Date.now()}`;
  
  console.info(`[LumiereOS] Triggering a force fresh reload to: ${freshUrl}`);
  window.location.replace(freshUrl);
}

/**
 * Checks if the cached app version is different from the current compiled version
 * and triggers automated recovery if a mismatch is detected, with loop protection.
 */
export async function checkAppVersionAndRefresh() {
  if (typeof window === 'undefined') return;

  const currentVersion = APP_INFO.version;
  console.info("[LumiereVersion]", currentVersion);

  try {
    const cachedVersion = localStorage.getItem('lumiere_app_version');
    
    // If there is a version mismatch, or no version is recorded at all
    if (cachedVersion && cachedVersion !== currentVersion) {
      const now = Date.now();
      const lastRefreshStr = localStorage.getItem('lumiere_cache_refresh_time');
      
      if (lastRefreshStr) {
        const lastRefresh = parseInt(lastRefreshStr, 10);
        // Loop protection: do not auto-refresh inside 60 seconds
        if (now - lastRefresh < 60000) {
          console.warn('[LumiereOS] Version mismatch detected, but a fresh update was triggered in the last 60 seconds. Restricting reload loop.');
          localStorage.setItem('lumiere_app_version', currentVersion);
          return;
        }
      }

      console.info(`[LumiereOS] Version mismatch detected! App: ${currentVersion}, Cached: ${cachedVersion}. Clearing caches...`);
      
      // Store safety indicators before acting
      localStorage.setItem('lumiere_cache_refresh_time', String(now));
      localStorage.setItem('lumiere_app_version', currentVersion);

      // Perform cleanups
      await clearLumiereCaches();
      await unregisterOldServiceWorkers();
      
      // Trigger reload
      forceFreshReload();
    } else if (!cachedVersion) {
      // First boot or cleared state: set current version and continue normally without reload
      localStorage.setItem('lumiere_app_version', currentVersion);
    }
  } catch (e) {
    console.error('[LumiereOS] Error in app version validator:', e);
  }
}

/**
 * Executes a thorough cleanup. It clears caches, active service workers,
 * version flags, and keeps Firebase authentication keys intact to prevent logouts.
 */
export async function executeManualCachePurge() {
  if (typeof window === 'undefined') return;
  try {
    console.info('[LumiereOS] Manual cache purge requested.');

    // Clear Cache storage API
    await clearLumiereCaches();

    // Clear service workers
    await unregisterOldServiceWorkers();

    // Safe localStorage clear: keep Firebase auth state
    const keysToPreserve: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('firebase:authUser:') || key.includes('firebase:Auth') || key.includes('firebase'))) {
        keysToPreserve.push(key);
      }
    }

    const salvagedData: Record<string, string | null> = {};
    keysToPreserve.forEach(key => {
      salvagedData[key] = localStorage.getItem(key);
    });

    // Clear localStorage completely
    localStorage.clear();

    // Restore salvaged auth keys
    Object.entries(salvagedData).forEach(([key, val]) => {
      if (val !== null) localStorage.setItem(key, val);
    });

    // Also clear session storage safely
    sessionStorage.clear();

    // Clean up cache refresh timestamp as we're doing a manual wipe
    localStorage.removeItem('lumiere_cache_refresh_time');
    localStorage.setItem('lumiere_app_version', APP_INFO.version);

    console.log('[LumiereOS] Cache purge finalized. Preserved auth session.');
    
    // Force reload on current path with fresh query parameter
    forceFreshReload();
  } catch (e) {
    console.error('[LumiereOS] Failed to clear manual cache safely:', e);
    // Hard fallback reload
    window.location.replace('/');
  }
}

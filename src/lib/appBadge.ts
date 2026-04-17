// App icon badge using the Badging API.
// Supported on: Chrome/Edge desktop (always), Android Chrome (installed PWA only),
// Windows taskbar PWA. iOS Safari does not support it yet.
// Silently no-ops on unsupported browsers.

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function isBadgingSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return "setAppBadge" in navigator;
}

export async function setAppBadge(count: number): Promise<void> {
  const nav = navigator as BadgeNavigator;
  try {
    if (count > 0 && nav.setAppBadge) {
      await nav.setAppBadge(count);
    } else if (nav.clearAppBadge) {
      await nav.clearAppBadge();
    }
  } catch {
    // Some platforms throw if the app is not installed — safe to ignore
  }

  // Forward to service worker so it can also set the badge from background
  // push events (when no tab is open).
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.active?.postMessage({ type: "SET_APP_BADGE", count });
  } catch {
    // ignore
  }
}

export async function clearAppBadge(): Promise<void> {
  await setAppBadge(0);
}

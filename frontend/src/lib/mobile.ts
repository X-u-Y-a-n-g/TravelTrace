import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

const API_BASE_KEY = "traveltrace-api-base";

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getStoredApiBase(): string | null {
  try {
    return window.localStorage.getItem(API_BASE_KEY);
  } catch {
    return null;
  }
}

export function saveApiBase(base: string): void {
  window.localStorage.setItem(API_BASE_KEY, base);
}

export function clearStoredApiBase(): void {
  try {
    window.localStorage.removeItem(API_BASE_KEY);
  } catch {
    // Storage can be unavailable in restricted WebViews.
  }
}

/**
 * Normalise a self-hosted server address into an API base.
 *
 * Accepts `example.com`, `https://example.com`, `https://example.com/` and
 * `https://example.com/api/v1`. A subpath is preserved, so
 * `https://example.com/traveltrace` becomes
 * `https://example.com/traveltrace/api/v1`.
 */
export function normalizeApiBase(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  let path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/api/v1")) {
    path = `${path}/api/v1`;
  }
  return `${url.origin}${path}`;
}

export function serverLabel(apiBase: string): string {
  return apiBase.replace(/\/api\/v1$/, "") || apiBase;
}

/**
 * In a Capacitor WebView, downloads and external links do not behave like a
 * browser. Route them through the system browser, where the ZIP download and
 * OAuth-free documentation links work normally.
 */
export function installNativeLinkHandling(): void {
  if (!isNativeApp()) return;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;

    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    const download = anchor.hasAttribute("download");
    const external = url.origin !== window.location.origin;
    if (!download && !external) return;

    event.preventDefault();
    void Browser.open({ url: url.toString() }).catch(() => {
      window.location.href = url.toString();
    });
  });
}

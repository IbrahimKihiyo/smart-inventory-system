import { Platform } from 'react-native';

// On web, wire up the pieces Chrome needs to offer "Install app":
// a linked manifest, a theme colour, an apple-touch-icon, and a service worker.
export function registerPWA() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const head = document.head;
  const addOnce = (selector, build) => {
    if (!document.querySelector(selector)) head.appendChild(build());
  };

  addOnce('link[rel="manifest"]', () => {
    const el = document.createElement('link');
    el.rel = 'manifest';
    el.href = '/manifest.json';
    return el;
  });

  addOnce('meta[name="theme-color"]', () => {
    const el = document.createElement('meta');
    el.name = 'theme-color';
    el.content = '#4f46e5';
    return el;
  });

  addOnce('link[rel="apple-touch-icon"]', () => {
    const el = document.createElement('link');
    el.rel = 'apple-touch-icon';
    el.href = '/apple-touch-icon.png';
    return el;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

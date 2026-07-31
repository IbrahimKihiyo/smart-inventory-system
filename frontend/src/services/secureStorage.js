import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Cross-platform secure storage wrapper.
 *
 * expo-secure-store is not available on the web, so on web we fall back to the
 * browser's localStorage. On real devices (Android/iOS) it uses the encrypted
 * SecureStore as before. The API mirrors expo-secure-store so the rest of the
 * app can use it as a drop-in replacement.
 */

const isWeb = Platform.OS === 'web';

export async function getItemAsync(key) {
  if (isWeb) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key, value) {
  if (isWeb) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key) {
  if (isWeb) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

import Constants from 'expo-constants'

/**
 * Resolves the base URL of the API.
 *
 * During development the app is loaded from the Metro bundler, which runs on
 * the same computer as the API server. The host is therefore taken from the
 * bundler address, so the app keeps working when the computer receives a
 * different IP address on another network.
 *
 * Release builds fall back to the fixed URL configured in app.json.
 */

const API_PORT = 8000

const configured = Constants.expoConfig?.extra?.API_URL

const hostUri =
  Constants.expoConfig?.hostUri ||
  Constants.expoGoConfig?.debuggerHost ||
  ''

const developmentHost = hostUri.split(':')[0]

const API_URL =
  typeof __DEV__ !== 'undefined' && __DEV__ && developmentHost
    ? `http://${developmentHost}:${API_PORT}/api`
    : configured

if (!API_URL) {
  console.warn('API_URL could not be resolved')
}

export default API_URL

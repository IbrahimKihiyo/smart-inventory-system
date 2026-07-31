import axios from 'axios'
import Constants from 'expo-constants'

const API_URL =
  Constants.expoConfig?.extra?.API_URL 

console.log('API URL:', API_URL)

export const API = axios.create({
  baseURL: API_URL,
})
import React, { createContext, useContext, useState, useEffect } from 'react'
import * as storage from '../services/secureStorage'
import { translations } from '../i18n/translations'

export const LanguageContext = createContext()

const STORAGE_KEY = 'app_language'

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState('en')

  // Load the saved language once on startup
  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.getItemAsync(STORAGE_KEY)
        if (saved === 'en' || saved === 'sw') setLanguageState(saved)
      } catch {}
    })()
  }, [])

  const setLanguage = async (lang) => {
    setLanguageState(lang)
    try { await storage.setItemAsync(STORAGE_KEY, lang) } catch {}
  }

  // Translate a key, with optional {placeholder} substitution.
  const t = (key, vars) => {
    const dict = translations[language] || translations.en
    let str = dict[key] ?? translations.en[key] ?? key
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k])
      })
    }
    return str
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)

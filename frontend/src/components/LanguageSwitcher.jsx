import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLanguage } from '../context/LanguageContext'
import { LANGUAGES } from '../i18n/translations'

/**
 * A small English / Kiswahili language toggle. Used on the auth screens and in
 * the drawer so users can switch the whole app's language at any time.
 */
const LanguageSwitcher = ({ style, showIcon = true }) => {
  const { language, setLanguage } = useLanguage()

  return (
    <View style={[styles.container, style]}>
      {showIcon && <Ionicons name="globe-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />}
      {LANGUAGES.map(({ code, label }) => {
        const active = language === code
        return (
          <TouchableOpacity
            key={code}
            onPress={() => setLanguage(code)}
            style={[styles.pill, active && styles.pillActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default LanguageSwitcher

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#F1F5F9',
    marginLeft: 6,
  },
  pillActive: { backgroundColor: '#4F46E5' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  pillTextActive: { color: '#FFFFFF' },
})

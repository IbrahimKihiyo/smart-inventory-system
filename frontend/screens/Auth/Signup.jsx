// screens/auth/Signup.jsx

import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView, KeyboardAvoidingView
} from 'react-native'
import React, { useState, useContext, useRef } from 'react'
import { AuthContext } from '../../src/context/AuthContext'
import { useLanguage } from '../../src/context/LanguageContext'
import Toast from 'react-native-toast-message'
import { Ionicons } from '@expo/vector-icons'

const Signup = ({ navigation }) => {
  const [tenantSlug,          setTenantSlug]          = useState('')
  const [name,                setName]                = useState('')
  const [email,               setEmail]               = useState('')
  const [password,            setPassword]            = useState('')
  const [confirmPassword,     setConfirmPassword]     = useState('')
  const [isSubmitting,        setIsSubmitting]        = useState(false)
  const [showPassword,        setShowPassword]        = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const { register } = useContext(AuthContext)
  const { t } = useLanguage()
  const scrollViewRef = useRef(null)

  const handleSignup = async () => {
    if (!tenantSlug || !name || !email || !password || !confirmPassword) {
      Toast.show({ type: 'error', text1: t('login.missingFields'), text2: t('signup.fillAll') })
      return
    }
    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: t('toast.passwordError'), text2: t('toast.passwordsNoMatch') })
      return
    }

    setIsSubmitting(true)
    try {
      await register(tenantSlug.toLowerCase().trim(), name, email, password)
      Toast.show({ type: 'success', text1: t('toast.welcome'), text2: t('toast.accountCreated') })
      navigation.replace('Login')
    } catch (err) {
      console.error('Signup error:', err)
      let errorMsg = t('toast.somethingWrong')

      if (err.response?.status === 422) {
        const validationErrors = err.response.data.errors
        if (validationErrors) {
          const firstKey = Object.keys(validationErrors)[0]
          errorMsg = validationErrors[firstKey][0]
        } else {
          errorMsg = err.response.data.message || errorMsg
        }
      } else if (err.response?.status === 404) {
        errorMsg = t('toast.workspaceNotFound')
      } else if (err.message === 'Network Error') {
        errorMsg = t('toast.connError')
      }

      Toast.show({ type: 'error', text1: t('toast.signupFailed'), text2: errorMsg })
    } finally {
      setIsSubmitting(false)
      setTenantSlug('')
      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-slate-50" behavior="padding">
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{
          flexGrow: 1, justifyContent: 'center',
          paddingHorizontal: 32, paddingVertical: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-extrabold text-slate-800 tracking-tight">{t('signup.title')}</Text>
          <Text className="text-base text-slate-500 mt-2">{t('signup.subtitle')}</Text>
        </View>

        <View className="mb-6">

          {/* Workspace Slug */}
          <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
            {t('login.workspaceSlug')}
          </Text>
          <TextInput
            className="bg-white border border-slate-200 rounded-2xl px-4 py-4 mb-4 text-slate-800"
            autoCapitalize="none"
            value={tenantSlug}
            onChangeText={setTenantSlug}
            editable={!isSubmitting}
            returnKeyType="next"
          />

          {/* Full Name */}
          <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
            {t('signup.fullName')}
          </Text>
          <TextInput
            className="bg-white border border-slate-200 rounded-2xl px-4 py-4 mb-4 text-slate-800"
            value={name}
            onChangeText={setName}
            editable={!isSubmitting}
            returnKeyType="next"
          />

          {/* Email */}
          <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
            {t('login.email')}
          </Text>
          <TextInput
            className="bg-white border border-slate-200 rounded-2xl px-4 py-4 mb-4 text-slate-800"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!isSubmitting}
            returnKeyType="next"
          />

          {/* Password */}
          <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
            {t('login.password')}
          </Text>
          <View className="bg-white border border-slate-200 rounded-2xl mb-4 flex-row items-center px-4">
            <TextInput
              className="flex-1 py-4 text-slate-800"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={!isSubmitting}
              returnKeyType="next"
              onFocus={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            />
            <TouchableOpacity onPress={() => setShowPassword(prev => !prev)} activeOpacity={0.7}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20} color="#94a3b8"
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
            {t('register.confirmPassword')}
          </Text>
          <View className="bg-white border border-slate-200 rounded-2xl flex-row items-center px-4">
            <TextInput
              className="flex-1 py-4 text-slate-800"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isSubmitting}
              returnKeyType="done"
              onFocus={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(prev => !prev)} activeOpacity={0.7}>
              <Ionicons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20} color="#94a3b8"
              />
            </TouchableOpacity>
          </View>

        </View>

        {/* Signup Button */}
        <TouchableOpacity
          className={`py-4 rounded-2xl shadow-lg mt-2 active:bg-indigo-700 ${
            isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600 shadow-indigo-200'
          }`}
          onPress={handleSignup}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-center font-bold text-lg">{t('signup.submit')}</Text>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <View className="flex-row justify-center items-center mt-8">
          <Text className="text-slate-500 text-sm font-medium">{t('signup.haveAccount')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isSubmitting}>
            <Text className="text-indigo-600 font-bold text-sm">{t('signup.login')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

export default Signup

const styles = StyleSheet.create({})
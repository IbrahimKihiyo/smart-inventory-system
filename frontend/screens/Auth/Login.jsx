// screens/auth/Login.jsx

import React, { useState, useContext, useRef } from 'react';
import {
  Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { AuthContext } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import LanguageSwitcher from '../../src/components/LanguageSwitcher';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const Login = ({ navigation }) => {
  const [tenantSlug,   setTenantSlug]   = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useContext(AuthContext);
  const { t } = useLanguage();
  const scrollViewRef = useRef(null);

  const handleLogin = async () => {
    if (!tenantSlug || !email || !password) {
      Toast.show({ type: 'error', text1: t('login.missingFields'), text2: t('login.fillAll') });
      return;
    }

    setIsSubmitting(true);
    try {
      await login(tenantSlug.toLowerCase().trim(), email, password);
    } catch (err) {
      console.error('Login error:', err);
      let errorMsg = 'Something went wrong. Please try again.';

      if (err.response?.status === 429) {
        errorMsg = t('login.tooMany');
      } else if (err.response?.status === 401) {
        errorMsg = 'Invalid email or password.';
      } else if (err.response?.status === 404) {
        errorMsg = 'Workspace not found. Check your company slug.';
      } else if (err.response?.status === 422) {
        const errs = err.response.data.errors;
        if (errs) {
          const firstKey = Object.keys(errs)[0];
          errorMsg = errs[firstKey][0];
        } else {
          errorMsg = err.response.data.message || errorMsg;
        }
      } else if (err.message === 'Network Error') {
        errorMsg = 'Network error. Please check your connection.';
      }

      Toast.show({ type: 'error', text1: 'Login Failed', text2: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <View className="flex-row justify-end mb-4">
          <LanguageSwitcher />
        </View>

        <View className="mb-10">
          <Text className="text-4xl font-extrabold text-slate-800 tracking-tight">{t('login.welcome')}</Text>
          <Text className="text-base text-slate-500 mt-2">{t('login.subtitle')}</Text>
        </View>

        {/* Workspace Slug */}
        <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
          {t('login.workspaceSlug')}
        </Text>
        <TextInput
          className="bg-white border border-slate-200 rounded-2xl px-4 py-4 mb-5 text-slate-800"
          autoCapitalize="none"
          value={tenantSlug}
          onChangeText={setTenantSlug}
          editable={!isSubmitting}
          returnKeyType="next"
        />

        {/* Email */}
        <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
          {t('login.email')}
        </Text>
        <TextInput
          className="bg-white border border-slate-200 rounded-2xl px-4 py-4 mb-5 text-slate-800"
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
        <View className="bg-white border border-slate-200 rounded-2xl flex-row items-center px-4">
          <TextInput
            className="flex-1 py-4 text-slate-800"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            editable={!isSubmitting}
            returnKeyType="done"
            onFocus={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          />
          <TouchableOpacity onPress={() => setShowPassword(p => !p)} activeOpacity={0.7}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20} color="#94a3b8"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="self-end mt-3">
          <Text className="text-sm font-semibold text-indigo-600">{t('login.forgot')}</Text>
        </TouchableOpacity>

        {/* Login Button */}
        <TouchableOpacity
          className={`mt-6 py-4 rounded-2xl shadow-lg active:bg-indigo-700 ${
            isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600 shadow-indigo-200'
          }`}
          onPress={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-center font-bold text-lg">{t('login.signIn')}</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center items-center mt-4">
          <Text className="text-slate-500 text-sm font-medium">{t('login.needWorkspace')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TenantRegister')} disabled={isSubmitting}>
            <Text className="text-indigo-600 font-bold text-sm">{t('login.createOne')}</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center items-center mt-4">
          <Text className="text-slate-500 text-sm font-medium">{t('login.noAccount')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')} disabled={isSubmitting}>
            <Text className="text-indigo-600 font-bold text-sm">{t('login.register')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default Login;
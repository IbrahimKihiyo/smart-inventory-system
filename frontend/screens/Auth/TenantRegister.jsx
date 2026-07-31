// screens/auth/TenantRegister.jsx

import React, { useState, useContext, useRef } from 'react';
import {
  Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import LanguageSwitcher from '../../src/components/LanguageSwitcher';

const TenantRegister = ({ navigation }) => {
  const [companyName,   setCompanyName]   = useState('');
  const [adminName,     setAdminName]     = useState('');
  const [adminEmail,    setAdminEmail]    = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPass,   setConfirmPass]   = useState('');
  const [showPass,      setShowPass]      = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  const { registerTenant } = useContext(AuthContext);
  const { t } = useLanguage();
  const scrollRef = useRef(null);

  const handleRegister = async () => {
    if (!companyName || !adminName || !adminEmail || !adminPassword || !confirmPass) {
      Toast.show({ type: 'error', text1: t('login.missingFields'), text2: t('login.fillAll') });
      return;
    }
    if (adminPassword !== confirmPass) {
      Toast.show({ type: 'error', text1: 'Password Mismatch', text2: 'Passwords do not match.' });
      return;
    }
    if (adminPassword.length < 8) {
      Toast.show({ type: 'error', text1: 'Weak Password', text2: 'Password must be at least 8 characters.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await registerTenant(companyName, adminName, adminEmail, adminPassword);
      Toast.show({
        type: 'success',
        text1: 'Company Registered!',
        text2: `Welcome, ${data.admin.name}. Your workspace is ready.`,
      });
      // Navigate to main app — adjust to your navigator structure
      navigation.replace('Login'); 
    } catch (err) {
      console.error('Tenant registration error:', err);
      console.error('Response data:', JSON.stringify(err.response?.data, null, 2));
      console.error('Status:', err.response?.status);
    
      let msg = 'Registration failed. Please try again.';
      if (err.response?.status === 422) {
        const errs = err.response.data.errors;
        if (errs) {
          const key = Object.keys(errs)[0];
          msg = errs[key][0];
        } else {
          msg = err.response.data.message || msg;
        }
      } else if (err.message === 'Network Error') {
        msg = 'Cannot reach server. Check your connection.';
      }
      Toast.show({ type: 'error', text1: 'Registration Failed', text2: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-slate-50" behavior="padding">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          flexGrow: 1, justifyContent: 'center',
          paddingHorizontal: 32, paddingVertical: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Language toggle */}
        <View className="flex-row justify-end mb-4">
          <LanguageSwitcher />
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-extrabold text-slate-800 tracking-tight">
            {t('register.title')}
          </Text>
          <Text className="text-base text-slate-500 mt-2">
            {t('register.subtitle')}
          </Text>
        </View>

        {/* Company Name */}
        <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
          {t('register.companyName')}
        </Text>
        <TextInput
          className="bg-white border border-slate-200 rounded-2xl px-4 py-4 mb-4 text-slate-800"
          placeholder="Acme Corporation"
          placeholderTextColor="#94a3b8"
          value={companyName}
          onChangeText={setCompanyName}
          editable={!isSubmitting}
          returnKeyType="next"
        />

        {/* Admin Name */}
        <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
          {t('register.fullName')}
        </Text>
        <TextInput
          className="bg-white border border-slate-200 rounded-2xl px-4 py-4 mb-4 text-slate-800"
          placeholder="John Doe"
          placeholderTextColor="#94a3b8"
          value={adminName}
          onChangeText={setAdminName}
          editable={!isSubmitting}
          returnKeyType="next"
        />

        {/* Admin Email */}
        <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
          {t('register.adminEmail')}
        </Text>
        <TextInput
          className="bg-white border border-slate-200 rounded-2xl px-4 py-4 mb-4 text-slate-800"
          placeholder="admin@company.com"
          placeholderTextColor="#94a3b8"
          keyboardType="email-address"
          autoCapitalize="none"
          value={adminEmail}
          onChangeText={setAdminEmail}
          editable={!isSubmitting}
          returnKeyType="next"
        />

        {/* Password */}
        <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
          {t('register.password')}
        </Text>
        <View className="bg-white border border-slate-200 rounded-2xl mb-4 flex-row items-center px-4">
          <TextInput
            className="flex-1 py-4 text-slate-800"
            placeholder={t('register.passwordHint')}
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showPass}
            value={adminPassword}
            onChangeText={setAdminPassword}
            editable={!isSubmitting}
            returnKeyType="next"
            onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
          />
          <TouchableOpacity onPress={() => setShowPass(p => !p)} activeOpacity={0.7}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Confirm Password */}
        <Text className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
          {t('register.confirmPassword')}
        </Text>
        <View className="bg-white border border-slate-200 rounded-2xl mb-6 flex-row items-center px-4">
          <TextInput
            className="flex-1 py-4 text-slate-800"
            placeholder={t('register.repeatPassword')}
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showConfirm}
            value={confirmPass}
            onChangeText={setConfirmPass}
            editable={!isSubmitting}
            returnKeyType="done"
            onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
          />
          <TouchableOpacity onPress={() => setShowConfirm(p => !p)} activeOpacity={0.7}>
            <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          className={`py-4 rounded-2xl shadow-lg active:bg-emerald-700 ${
            isSubmitting ? 'bg-emerald-400' : 'bg-emerald-600 shadow-emerald-200'
          }`}
          onPress={handleRegister}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-center font-bold text-lg">{t('register.submit')}</Text>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-slate-500 text-sm">{t('register.haveWorkspace')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isSubmitting}>
            <Text className="text-indigo-600 font-bold text-sm">{t('register.signIn')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default TenantRegister;
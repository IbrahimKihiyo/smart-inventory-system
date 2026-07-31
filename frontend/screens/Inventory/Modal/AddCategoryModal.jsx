import React, { useState } from 'react'
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native'
import Toast from 'react-native-toast-message'
import axiosClient from '../../../src/services/axiosClient'
import { useLanguage } from '../../../src/context/LanguageContext'

// On web, wrapping the modal in TouchableWithoutFeedback+Keyboard.dismiss steals
// focus from text inputs (you can't type). Only wrap on native.
const DismissKeyboardWrapper = ({ children }) =>
  Platform.OS === 'web'
    ? children
    : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{children}</TouchableWithoutFeedback>

const AddCategoryModal = ({ visible, onClose }) => {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [isNameFocused, setIsNameFocused] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    
    if (!trimmedName) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Category name cannot be empty. ⚠️',
        position: 'top',
      })
      return 
    }

    setIsSubmitting(true)

    try {
      const response = await axiosClient.post('/categories', {
        name: trimmedName,
      })

      // Success Toast using Laravel's message key
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: response.data.message || 'Category created successfully! 🎉',
        position: 'top',
      })

      setName('')
      onClose()
    } catch (error) {
      console.error('Category creation error:', error.response?.data || error.message)
      
      // Catch validation errors thrown by Laravel's $request->validate() (Status 422)
      if (error.response && error.response.status === 422) {
        const validationErrors = error.response.data.errors
        const firstErrorKey = Object.keys(validationErrors)[0]
        const errorMessage = validationErrors[firstErrorKey][0]
        
        Toast.show({
          type: 'error',
          text1: 'Validation Failed',
          text2: errorMessage,
          position: 'top',
        })
      } else {
        // Handle alternative backend errors or timeout errors
        Toast.show({
          type: 'error',
          text1: 'Network Error',
          text2: error.response?.data?.message || 'Could not connect to database.',
          position: 'top',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <DismissKeyboardWrapper>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.modalContainer}>
              <Text style={styles.heading}>{t('cat.addTitle')}</Text>
              <Text style={styles.subheading}>
                {t('cat.subtitle')}
              </Text>

              {/* Category Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('cat.name')}</Text>
                <TextInput
                  placeholder={t('cat.namePlaceholder')}
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                  editable={!isSubmitting}
                  maxLength={100}
                  onFocus={() => setIsNameFocused(true)}
                  onBlur={() => setIsNameFocused(false)}
                  style={[
                    styles.input, 
                    isNameFocused && styles.inputFocused,
                    isSubmitting && styles.inputDisabled
                  ]}
                />
              </View>

              {/* Form Action Controls */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  activeOpacity={0.7}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
                  activeOpacity={0.8}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>{t('cat.create')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </DismissKeyboardWrapper>
    </Modal>
  )
}

export default AddCategoryModal

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  keyboardView: {
    width: '100%',
    justifyContent: 'center',
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: '#0F172A',
  },
  inputFocused: {
    borderColor: '#4F46E5',
    backgroundColor: '#FFFFFF',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputDisabled: {
    backgroundColor: '#E2E8F0',
    color: '#64748B',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 15,
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    minHeight: 48,
  },
  saveButtonDisabled: {
    backgroundColor: '#818CF8',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
})
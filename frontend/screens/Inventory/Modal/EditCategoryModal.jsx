// EditCategoryModal.jsx
import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import axiosClient from '../../../src/services/axiosClient' // Adjust this relative path to match your folder nesting
import Toast from 'react-native-toast-message'
import { useLanguage } from '../../../src/context/LanguageContext'

const EditCategoryModal = ({ visible, category, onClose, onCategoryUpdated }) => {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pre-populate input field when the category prop changes or modal opens
  useEffect(() => {
    if (category) {
      setName(category.name)
    } else {
      setName('')
    }
  }, [category, visible])

  const handleUpdate = async () => {
    const trimmedName = name.trim()
    
    if (!trimmedName) {
      Alert.alert('Validation Error', 'Category name cannot be empty.')
      return
    }

    try {
      setIsSubmitting(true)
      
      // Hit your Laravel PATCH/PUT route: /api/categories/{id}
      const response = await axiosClient.put(`/categories/${category.id}`, {
        name: trimmedName,
      })

      // Notify parent component to update its local state array
      if (onCategoryUpdated) {
        onCategoryUpdated(response.data)
      }

      Toast.show({
        type: 'success',
        text1: 'Updated',
        text2: 'Category updated successfully.',
      })
      
      onClose() // Close modal
    } catch (error) {
      console.error(error.response?.data || error.message)
      Alert.alert(
        'Update Failed',
        error.response?.data?.message || 'Something went wrong while updating the category.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('cat.editTitle')}</Text>
            <TouchableOpacity onPress={onClose} disabled={isSubmitting} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Form Input Group */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>{t('cat.name')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('cat.namePlaceholder')}
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              editable={!isSubmitting}
              autoFocus={true}
            />
          </View>

          {/* Action Footer Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, isSubmitting && styles.disabledButton]}
              onPress={handleUpdate}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>{t('common.saveChanges')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export default EditCategoryModal

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Dimmed slate overlay
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  formGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#4F46E5', // Shared indigo profile
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.7,
  },
})
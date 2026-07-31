import React, { useState, useEffect } from 'react'
import {
  Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  Keyboard, ScrollView, ActivityIndicator
} from 'react-native'
import Toast from 'react-native-toast-message'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import axiosClient from '../../../src/services/axiosClient'
import { useLanguage } from '../../../src/context/LanguageContext'

/**
 * Record a new purchase (restock) for a product.
 *
 * Saves the price paid into the product's purchase-price history (FR12) and
 * adds the quantity bought to the current stock, all in one step.
 */
// On web, wrapping the modal in TouchableWithoutFeedback+Keyboard.dismiss steals
// focus from text inputs (you can't type). Only wrap on native.
const DismissKeyboardWrapper = ({ children }) =>
  Platform.OS === 'web'
    ? children
    : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{children}</TouchableWithoutFeedback>

const RecordPurchaseModal = ({ visible, product, onClose, onPurchaseRecorded }) => {
  const { t } = useLanguage()
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const allowDecimal = !!product?.allow_decimal

  // Reset the form each time the modal opens for a product
  useEffect(() => {
    if (visible && product) {
      setPrice('')
      setQuantity('')
      setNote('')
      setPurchaseDate(new Date())
      setShowDatePicker(false)
    }
  }, [visible, product])

  const handleQuantityChange = (text) => {
    if (!allowDecimal) {
      setQuantity(text.replace(/[^0-9]/g, ''))
    } else {
      setQuantity(text)
    }
  }

  const openDatePicker = () => {
    Keyboard.dismiss()
    setShowDatePicker(true)
  }

  const handleDateChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(false)
      return
    }
    setPurchaseDate(selectedDate || purchaseDate)
    if (Platform.OS === 'android') setShowDatePicker(false)
  }

  const formatForPayload = (dateObj) => {
    if (!dateObj) return null
    const pad = (n) => (n < 10 ? '0' + n : n)
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:00`
  }

  const formatForDisplay = (dateObj) => {
    if (!dateObj) return 'Select date'
    return dateObj.toLocaleDateString()
  }

  // YYYY-MM-DD for the web date input
  const toYMD = (dateObj) => {
    if (!dateObj) return ''
    const pad = (n) => (n < 10 ? '0' + n : n)
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`
  }

  const handleSubmit = async () => {
    if (!price.trim() || !quantity.trim()) {
      Toast.show({
        type: 'error',
        text1: t('prod.missingTitle'),
        text2: t('prod.purchaseMissingMsg'),
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await axiosClient.post(`/products/${product.id}/purchases`, {
        price: parseFloat(price),
        currency: product.currency,
        quantity: allowDecimal ? parseFloat(quantity) : parseInt(quantity, 10),
        note: note.trim() || null,
        purchased_at: formatForPayload(purchaseDate),
      })

      const updatedProduct = response.data.product || null
      if (updatedProduct) {
        onPurchaseRecorded(updatedProduct)
      }

      Toast.show({
        type: 'success',
        text1: 'Purchase recorded',
        text2: `${product.name} stock topped up and price saved.`,
      })
      onClose()
    } catch (error) {
      const msg = error.response?.data?.message || error.message
      Toast.show({
        type: 'error',
        text1: 'Failed to record purchase',
        text2: msg,
      })
      console.error('Error recording purchase:', error.response?.data || error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!product) return null

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <DismissKeyboardWrapper>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.modalContainer}>
              <Text style={styles.heading}>{t('prod.recordTitle')}</Text>
              <Text style={styles.subheading} numberOfLines={1}>
                {product.name}
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.formContainer}
                contentContainerStyle={styles.scrollContent}
              >
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>{t('prod.pricePaid')}</Text>
                    <TextInput
                      placeholder="0.00"
                      placeholderTextColor="#94A3B8"
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="decimal-pad"
                      onFocus={() => setFocusedField('price')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.input, focusedField === 'price' && styles.inputFocused]}
                    />
                    <Text style={styles.hint}>{t('prod.per')} {product.unit || 'unit'} · {product.currency}</Text>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>{t('prod.qtyBought')}</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      value={quantity}
                      onChangeText={handleQuantityChange}
                      keyboardType={allowDecimal ? 'decimal-pad' : 'numeric'}
                      onFocus={() => setFocusedField('quantity')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.input, focusedField === 'quantity' && styles.inputFocused]}
                    />
                    <Text style={styles.hint}>{t('prod.addedToStock')}</Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('prod.purchaseDate')}</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={toYMD(purchaseDate)}
                      max={toYMD(new Date())}
                      onChange={(e) =>
                        setPurchaseDate(e.target.value ? new Date(e.target.value + 'T12:00:00') : new Date())
                      }
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: 12,
                        padding: '12px 16px',
                        fontSize: 15,
                        color: '#0F172A',
                        fontFamily: 'inherit',
                      }}
                    />
                  ) : (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={openDatePicker}
                        style={[styles.input, styles.dropdownSelector, showDatePicker && styles.inputFocused]}
                      >
                        <Text style={{ color: '#0F172A', fontSize: 15 }}>
                          {formatForDisplay(purchaseDate)}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color="#64748B" />
                      </TouchableOpacity>

                      {showDatePicker && (
                        <View style={Platform.OS === 'ios' ? styles.iosPickerBox : undefined}>
                          <DateTimePicker
                            value={purchaseDate || new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            maximumDate={new Date()}
                            onChange={handleDateChange}
                          />
                          {Platform.OS === 'ios' && (
                            <TouchableOpacity
                              style={styles.iosPickerDone}
                              onPress={() => setShowDatePicker(false)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.iosPickerDoneText}>Done</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('prod.note')}</Text>
                  <TextInput
                    placeholder={t('prod.notePlaceholder')}
                    placeholderTextColor="#94A3B8"
                    value={note}
                    onChangeText={setNote}
                    onFocus={() => setFocusedField('note')}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.input, focusedField === 'note' && styles.inputFocused]}
                  />
                </View>
              </ScrollView>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} activeOpacity={0.7} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
                  activeOpacity={0.8}
                  onPress={handleSubmit}
                  disabled={isSaving}
                >
                  {isSaving
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Text style={styles.saveButtonText}>{t('prod.savePurchase')}</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </DismissKeyboardWrapper>
    </Modal>
  )
}

export default RecordPurchaseModal

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  keyboardView: { width: '100%', maxHeight: '85%', justifyContent: 'center' },
  modalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 },
  heading: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subheading: { fontSize: 14, color: '#64748B', marginTop: 2, marginBottom: 8 },
  formContainer: { marginBottom: 12 },
  scrollContent: { paddingBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 14 : 10, fontSize: 15, color: '#0F172A' },
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputFocused: { borderColor: '#4F46E5', backgroundColor: '#FFFFFF' },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  buttonContainer: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  cancelButtonText: { color: '#64748B', fontWeight: '600' },
  saveButton: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4F46E5' },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700' },
  iosPickerBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginTop: 8, paddingBottom: 8 },
  iosPickerDone: { alignSelf: 'flex-end', backgroundColor: '#4F46E5', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8, marginRight: 8 },
  iosPickerDoneText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
})

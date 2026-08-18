import React, { useState, useEffect } from 'react'
import {
  Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  Keyboard, ScrollView, ActivityIndicator, FlatList, Image, Switch
} from 'react-native'
import Toast from 'react-native-toast-message'
import axiosClient from '../../../src/services/axiosClient'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'

import { Ionicons } from '@expo/vector-icons'
import currenciesData from '../../../src/currencies.json'
import { useLanguage } from '../../../src/context/LanguageContext'

const UNIT_OPTIONS = ['pcs', 'kg', 'g', 'l', 'ml', 'box']

// Suggested profit margins used to recommend a selling price from the buying price
const MARGIN_SUGGESTIONS = [20, 30, 50]

// On the web, wrapping the modal in TouchableWithoutFeedback+Keyboard.dismiss
// steals focus from text inputs (you can't type). Only wrap on native.
const DismissKeyboardWrapper = ({ children }) =>
  Platform.OS === 'web'
    ? children
    : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{children}</TouchableWithoutFeedback>

const AddProductModal = ({ visible, onClose, onProductSaved }) => {

  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(null)
  const [selectedCategoryName, setSelectedCategoryName] = useState('Select category')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [buying_price, setBuying_price] = useState('')
  const [stock, setStock] = useState('')

  // Unit / Decimal states
  const [unit, setUnit] = useState('pcs')
  const [showUnitDropdown, setShowUnitDropdown] = useState(false)
  const [allowDecimal, setAllowDecimal] = useState(false)

  // Image states
  const [imageUri, setImageUri] = useState(null)
  const [imageAsset, setImageAsset] = useState(null)

  // Currency States
  const [currencyCode, setCurrencyCode] = useState(null)
  const [selectedCurrencyName, setSelectedCurrencyName] = useState('Select currency')
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false)
  const [currencySearchQuery, setCurrencySearchQuery] = useState('')

  // Expiry Date States
  const [expiryDate, setExpiryDate] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerMode, setPickerMode] = useState('date')

  const [categories, setCategories] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (visible) fetchCategories()
  }, [visible])

  const fetchCategories = async () => {
    setIsLoadingCategories(true)
    try {
      const response = await axiosClient.get('/categories')
      setCategories(response.data)
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('toast.failedLoadCategories'),
        text2: error.response?.data?.message || error.message,
      })
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const filteredCategories = categories.filter(category =>
    category.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredCurrencies = currenciesData.filter(item =>
    item.currency.toLowerCase().includes(currencySearchQuery.toLowerCase()) ||
    item.currency_code.toLowerCase().includes(currencySearchQuery.toLowerCase())
  )

  const openPicker = () => {
    Keyboard.dismiss()
    if (Platform.OS === 'ios') {
      setPickerMode('datetime')
      setShowDatePicker(true)
    } else {
      setPickerMode('date')
      setShowDatePicker(true)
    }
  }

  const handleDateChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(false)
      return
    }

    const currentDate = selectedDate || expiryDate || new Date()
    setExpiryDate(currentDate)

    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        setShowDatePicker(false)
        setPickerMode('time')
        setTimeout(() => setShowDatePicker(true), 50)
      } else {
        setShowDatePicker(false)
      }
    }
  }

  const formatForPayload = (dateObj) => {
    if (!dateObj) return null
    const pad = (n) => (n < 10 ? '0' + n : n)
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:00`
  }

  const formatForDisplay = (dateObj) => {
    if (!dateObj) return t('prod.selectExpiry')
    const datePart = dateObj.toLocaleDateString()
    const timePart = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return `${datePart} at ${timePart}`
  }

  // YYYY-MM-DD for the web date input
  const toYMD = (dateObj) => {
    if (!dateObj) return ''
    const pad = (n) => (n < 10 ? '0' + n : n)
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`
  }

  // Ask permission + open picker for image
  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Toast.show({
        type: 'error',
        text1: t('toast.permissionRequired'),
        text2: t('toast.photoAccessAdd'),
      })
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0]
      setImageUri(asset.uri)
      setImageAsset(asset)
    }
  }

  const handleRemoveImage = () => {
    setImageUri(null)
    setImageAsset(null)
  }

  // Toggle stock keyboard type based on allowDecimal
  const handleStockChange = (text) => {
    if (!allowDecimal) {
      // Strip any decimal input if decimals are disallowed
      setStock(text.replace(/[^0-9]/g, ''))
    } else {
      setStock(text)
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || !price.trim() || !buying_price.trim() || !currencyCode || !stock.trim()) {
      Toast.show({
        type: 'error',
        text1: t('prod.missingTitle'),
        text2: t('prod.missingMsg'),
      })
      return
    }

    setIsSaving(true)
    try {
      let response

      // Only use multipart/form-data when actually uploading an image on a
      // device. On the web, the image object from the picker isn't a real file
      // and a manual multipart Content-Type drops the boundary, so we send JSON.
      if (imageAsset && Platform.OS !== 'web') {
        const formData = new FormData()
        formData.append('name', name.trim())
        if (categoryId) formData.append('category_id', categoryId)
        formData.append('description', description.trim())
        formData.append('price', parseFloat(price))
        formData.append('buying_price', parseFloat(buying_price))
        formData.append('currency', currencyCode)
        formData.append('unit', unit)
        formData.append('allow_decimal', allowDecimal ? '1' : '0')
        formData.append('stock', allowDecimal ? parseFloat(stock) : parseInt(stock, 10))
        if (expiryDate) formData.append('expiry_date', formatForPayload(expiryDate))

        const uriParts = imageAsset.uri.split('.')
        const fileType = uriParts[uriParts.length - 1]
        formData.append('image', {
          uri: imageAsset.uri,
          name: `product.${fileType}`,
          type: `image/${fileType}`,
        })

        response = await axiosClient.post('/products', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        const payload = {
          name: name.trim(),
          description: description.trim(),
          price: parseFloat(price),
          buying_price: parseFloat(buying_price),
          currency: currencyCode,
          unit,
          allow_decimal: allowDecimal,
          stock: allowDecimal ? parseFloat(stock) : parseInt(stock, 10),
        }
        if (categoryId) payload.category_id = categoryId
        if (expiryDate) payload.expiry_date = formatForPayload(expiryDate)

        response = await axiosClient.post('/products', payload)
      }

      onProductSaved(response.data.data)

      Toast.show({
        type: 'success',
        text1: t('toast.productSaved'),
        text2: `${response.data.data.name} added to inventory.`,
      })

      // Reset form states
      setName('')
      setCategoryId(null)
      setSelectedCategoryName('Select category')
      setDescription('')
      setPrice('')
      setBuying_price('')
      setCurrencyCode(null)
      setSelectedCurrencyName('Select currency')
      setUnit('pcs')
      setAllowDecimal(false)
      setStock('')
      setExpiryDate(null)
      setShowDatePicker(false)
      setImageUri(null)
      setImageAsset(null)
      onClose()
    } catch (error) {
      const msg = error.response?.data?.message || error.message
      Toast.show({
        type: 'error',
        text1: t('toast.failedSaveProduct'),
        text2: msg,
      })
      console.error('Error saving product:', error.response?.data || error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCloseDropdown = () => {
    setShowDropdown(false)
    setSearchQuery('')
  }

  const handleCloseCurrencyDropdown = () => {
    setShowCurrencyDropdown(false)
    setCurrencySearchQuery('')
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
              <Text style={styles.heading}>{t('prod.addTitle')}</Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.formContainer}
                contentContainerStyle={styles.scrollContent}
              >
                {/* Image Picker */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('prod.image')}</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handlePickImage}
                    style={styles.imagePicker}
                  >
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons name="camera-outline" size={26} color="#94A3B8" />
                        <Text style={styles.imagePlaceholderText}>{t('prod.tapImage')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {imageUri && (
                    <TouchableOpacity onPress={handleRemoveImage} style={styles.removeImageBtn}>
                      <Text style={styles.removeImageText}>Remove image</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('prod.name')}</Text>
                  <TextInput
                    placeholder={t('prod.name')}
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.input, focusedField === 'name' && styles.inputFocused]}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('prod.category')}</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { Keyboard.dismiss(); setShowDropdown(true) }}
                    style={[styles.input, styles.dropdownSelector, showDropdown && styles.inputFocused]}
                  >
                    <Text style={{ color: categoryId ? '#0F172A' : '#94A3B8', fontSize: 15 }} numberOfLines={1}>
                      {categoryId ? selectedCategoryName : t('prod.selectCategory')}
                    </Text>
                    {isLoadingCategories
                      ? <ActivityIndicator size="small" color="#4F46E5" />
                      : <Text style={styles.dropdownArrow}>▼</Text>
                    }
                  </TouchableOpacity>
                </View>

                {/* Currency Dropdown */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('prod.currency')}</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { Keyboard.dismiss(); setShowCurrencyDropdown(true) }}
                    style={[styles.input, styles.dropdownSelector, showCurrencyDropdown && styles.inputFocused]}
                  >
                    <Text
                      style={[{ color: currencyCode ? '#0F172A' : '#94A3B8', fontSize: 15 }, styles.flexText]}
                      numberOfLines={1}
                    >
                      {currencyCode ? selectedCurrencyName : t('prod.selectCurrency')}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Unit Dropdown */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('prod.unit')}</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { Keyboard.dismiss(); setShowUnitDropdown(true) }}
                    style={[styles.input, styles.dropdownSelector, showUnitDropdown && styles.inputFocused]}
                  >
                    <Text style={{ color: '#0F172A', fontSize: 15 }}>{unit}</Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Allow Decimal Switch */}
                <View style={[styles.inputGroup, styles.switchRow]}>
                  <View>
                    <Text style={styles.label}>{t('prod.allowDecimal')}</Text>
                    <Text style={styles.switchHint}>{t('prod.allowDecimalHint')}</Text>
                  </View>
                  <Switch
                    value={allowDecimal}
                    onValueChange={(val) => {
                      setAllowDecimal(val)
                      if (!val) setStock(stock.replace(/[^0-9]/g, ''))
                    }}
                    trackColor={{ false: '#E2E8F0', true: '#C7D2FE' }}
                    thumbColor={allowDecimal ? '#4F46E5' : '#F1F5F9'}
                  />
                </View>

                {/* Price, Buying Price and Stock */}
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>{t('prod.unitPrice')}</Text>
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
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>{t('prod.buyingPrice')}</Text>
                    <TextInput
                      placeholder="0.00"
                      placeholderTextColor="#94A3B8"
                      value={buying_price}
                      onChangeText={setBuying_price}
                      keyboardType="decimal-pad"
                      onFocus={() => setFocusedField('buying_price')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.input, focusedField === 'buying_price' && styles.inputFocused]}
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>{t('prod.stock')}</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      value={stock}
                      onChangeText={handleStockChange}
                      keyboardType={allowDecimal ? 'decimal-pad' : 'numeric'}
                      onFocus={() => setFocusedField('stock')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.input, focusedField === 'stock' && styles.inputFocused]}
                    />
                  </View>
                </View>

                {/* Suggested selling price based on the buying price */}
                {buying_price.trim() !== '' && !isNaN(parseFloat(buying_price)) && parseFloat(buying_price) > 0 && (
                  <View style={styles.suggestionBox}>
                    <Text style={styles.suggestionLabel}>{t('prod.suggestedPrice')}</Text>
                    <View style={styles.suggestionRow}>
                      {MARGIN_SUGGESTIONS.map((m) => {
                        const suggested = Math.round(parseFloat(buying_price) * (1 + m / 100))
                        const active = price === String(suggested)
                        return (
                          <TouchableOpacity
                            key={m}
                            style={[styles.suggestionChip, active && styles.suggestionChipActive]}
                            onPress={() => setPrice(String(suggested))}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.suggestionMargin, active && styles.suggestionTextActive]}>+{m}%</Text>
                            <Text style={[styles.suggestionPrice, active && styles.suggestionTextActive]}>
                              {suggested.toLocaleString()}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                    <Text style={styles.suggestionHint}>{t('prod.tapMargin')}</Text>
                  </View>
                )}

                {/* Expiry date. Native picker on device, HTML date input on web. */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('prod.expiryDate')}</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={toYMD(expiryDate)}
                      min={toYMD(new Date())}
                      onChange={(e) =>
                        setExpiryDate(e.target.value ? new Date(e.target.value + 'T12:00:00') : null)
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
                        onPress={openPicker}
                        style={[styles.input, styles.dropdownSelector, showDatePicker && styles.inputFocused]}
                      >
                        <Text style={{ color: expiryDate ? '#0F172A' : '#94A3B8', fontSize: 15 }}>
                          {formatForDisplay(expiryDate)}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color="#64748B" />
                      </TouchableOpacity>

                      {Platform.OS === 'android' && showDatePicker && (
                        <DateTimePicker
                          value={expiryDate || new Date()}
                          mode={pickerMode}
                          display="default"
                          minimumDate={new Date()}
                          onChange={handleDateChange}
                        />
                      )}

                      {Platform.OS === 'ios' && (
                        <Modal
                          transparent
                          visible={showDatePicker}
                          animationType="slide"
                          onRequestClose={() => setShowDatePicker(false)}
                        >
                          <View style={styles.datePickerRoot}>
                            <TouchableOpacity
                              style={{ flex: 1 }}
                              activeOpacity={1}
                              onPress={() => setShowDatePicker(false)}
                            />
                            <View style={styles.datePickerSheet}>
                              <DateTimePicker
                                value={expiryDate || new Date()}
                                mode="date"
                                display="spinner"
                                minimumDate={new Date()}
                                onChange={handleDateChange}
                                style={{ height: 216, alignSelf: 'stretch' }}
                              />
                              <TouchableOpacity
                                style={styles.iosPickerDone}
                                onPress={() => setShowDatePicker(false)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.iosPickerDoneText}>{t('common.done')}</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </Modal>
                      )}
                    </>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('prod.description')}</Text>
                  <TextInput
                    placeholder={t('prod.description')}
                    placeholderTextColor="#94A3B8"
                    value={description}
                    onChangeText={setDescription}
                    multiline={true}
                    numberOfLines={3}
                    onFocus={() => setFocusedField('description')}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.input, styles.textArea, focusedField === 'description' && styles.inputFocused]}
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
                    : <Text style={styles.saveButtonText}>{t('prod.save')}</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </DismissKeyboardWrapper>

      {/* Category Dropdown Modal */}
      <Modal visible={showDropdown} transparent={true} animationType="slide" onRequestClose={handleCloseDropdown}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.dropdownOverlay}
        >
          <View style={styles.dropdownSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('prod.selectCategoryTitle')}</Text>
              <TouchableOpacity onPress={handleCloseDropdown}>
                <Text style={styles.sheetCloseButton}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder={t('prod.searchCategories')}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              clearButtonMode="while-editing"
            />

            {filteredCategories.length === 0 && !isLoadingCategories ? (
              <Text style={styles.emptyCategoriesText}>{t('prod.noCategories')}</Text>
            ) : (
              <FlatList
                data={filteredCategories}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.categoryOptionItem, categoryId === item.id && styles.categoryOptionSelected]}
                    onPress={() => {
                      setCategoryId(item.id);
                      setSelectedCategoryName(item.name);
                      handleCloseDropdown();
                    }}
                  >
                    <Text style={[styles.categoryOptionText, categoryId === item.id && styles.categoryOptionTextSelected]}>
                      {item.name}
                    </Text>
                    {categoryId === item.id && <Text style={{ color: '#4F46E5' }}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Currency Dropdown Modal */}
      <Modal visible={showCurrencyDropdown} transparent={true} animationType="slide" onRequestClose={handleCloseCurrencyDropdown}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.dropdownOverlay}
        >
          <View style={styles.dropdownSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('prod.selectCurrencyTitle')}</Text>
              <TouchableOpacity onPress={handleCloseCurrencyDropdown}>
                <Text style={styles.sheetCloseButton}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder={t('prod.searchCurrencies')}
              placeholderTextColor="#94A3B8"
              value={currencySearchQuery}
              onChangeText={setCurrencySearchQuery}
              style={styles.searchInput}
              clearButtonMode="while-editing"
            />

            {filteredCurrencies.length === 0 ? (
              <Text style={styles.emptyCategoriesText}>No currencies found matching "{currencySearchQuery}".</Text>
            ) : (
              <FlatList
                data={filteredCurrencies}
                keyExtractor={(item) => item.currency_code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.categoryOptionItem, currencyCode === item.currency_code && styles.categoryOptionSelected]}
                    onPress={() => {
                      setCurrencyCode(item.currency_code);
                      setSelectedCurrencyName(item.currency);
                      handleCloseCurrencyDropdown();
                    }}
                  >
                    <Text style={[styles.categoryOptionText, currencyCode === item.currency_code && styles.categoryOptionTextSelected]}>
                      {item.currency} ({item.currency_code})
                    </Text>
                    {currencyCode === item.currency_code && <Text style={{ color: '#4F46E5' }}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Unit Dropdown Modal */}
      <Modal visible={showUnitDropdown} transparent={true} animationType="slide" onRequestClose={() => setShowUnitDropdown(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.dropdownOverlay}
        >
          <View style={styles.dropdownSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('prod.selectUnitTitle')}</Text>
              <TouchableOpacity onPress={() => setShowUnitDropdown(false)}>
                <Text style={styles.sheetCloseButton}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={UNIT_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryOptionItem, unit === item && styles.categoryOptionSelected]}
                  onPress={() => {
                    setUnit(item)
                    setShowUnitDropdown(false)
                  }}
                >
                  <Text style={[styles.categoryOptionText, unit === item && styles.categoryOptionTextSelected]}>
                    {item}
                  </Text>
                  {unit === item && <Text style={{ color: '#4F46E5' }}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </Modal>
  )
}

export default AddProductModal

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  keyboardView: { width: '100%', maxHeight: '85%', justifyContent: 'center' },
  modalContainer: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 },
  heading: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  formContainer: { maxHeight: 420, marginBottom: 12 },
  scrollContent: { paddingBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 14 : 10, fontSize: 15, color: '#0F172A' },
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownArrow: { fontSize: 12, color: '#64748B', marginLeft: 6 },
  flexText: { flex: 1, paddingRight: 4 },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  inputFocused: { borderColor: '#4F46E5', backgroundColor: '#FFFFFF' },
  buttonContainer: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  cancelButtonText: { color: '#64748B', fontWeight: '600' },
  saveButton: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4F46E5' },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700' },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  dropdownSheetContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, maxHeight: '60%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetCloseButton: { color: '#4F46E5', fontWeight: '700' },
  searchInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 15, color: '#0F172A', marginBottom: 12 },
  categoryOptionItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 8 },
  categoryOptionSelected: { backgroundColor: '#EEF2F6', borderRadius: 8 },
  categoryOptionText: { fontSize: 15, color: '#334155' },
  categoryOptionTextSelected: { color: '#4F46E5', fontWeight: '700' },
  emptyCategoriesText: { textAlign: 'center', marginTop: 20, color: '#64748B', fontSize: 15 },
  imagePicker: { width: '100%', height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imagePlaceholderText: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },
  removeImageBtn: { marginTop: 8, alignSelf: 'flex-start' },
  removeImageText: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchHint: { fontSize: 12, color: '#94A3B8', marginTop: 2, maxWidth: 220 },
  suggestionBox: { marginBottom: 16, backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#DDD6FE' },
  suggestionLabel: { fontSize: 12, fontWeight: '700', color: '#5B21B6', marginBottom: 8 },
  suggestionRow: { flexDirection: 'row', gap: 8 },
  suggestionChip: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6FE', paddingVertical: 8, alignItems: 'center' },
  suggestionChipActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  suggestionMargin: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },
  suggestionPrice: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  suggestionTextActive: { color: '#FFFFFF' },
  suggestionHint: { fontSize: 11, color: '#8B5CF6', marginTop: 8 },
  iosPickerBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginTop: 8, paddingBottom: 8 },
  datePickerRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  datePickerSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  iosPickerDone: { alignSelf: 'stretch', backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  iosPickerDoneText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
})
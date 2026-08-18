import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import axiosClient from '../../../src/services/axiosClient';

const COUNTRIES = [
  { label: 'Tanzania', value: 'TZA', currency: 'TZS' },
  { label: 'Benin', value: 'BEN', currency: 'XOF' },
  { label: 'Burkina Faso', value: 'BFA', currency: 'XOF' },
  { label: 'Cameroon', value: 'CMR', currency: 'XAF' },
  { label: "Côte d'Ivoire (Ivory Coast)", value: 'CIV', currency: 'XOF' },
  { label: 'Democratic Republic of the Congo', value: 'COD', currency: 'CDF' },
  { label: 'Ethiopia', value: 'ETH', currency: 'ETB' },
  { label: 'Gabon', value: 'GAB', currency: 'XAF' },
  { label: 'Ghana', value: 'GHA', currency: 'GHS' },
  { label: 'Kenya', value: 'KEN', currency: 'KES' },
  { label: 'Lesotho', value: 'LSO', currency: 'LSL' },
  { label: 'Malawi', value: 'MWI', currency: 'MWK' },
  { label: 'Mozambique', value: 'MOZ', currency: 'MZN' },
  { label: 'Nigeria', value: 'NGA', currency: 'NGN' },
  { label: 'Republic of the Congo', value: 'COG', currency: 'XAF' },
  { label: 'Rwanda', value: 'RWA', currency: 'RWF' },
  { label: 'Senegal', value: 'SEN', currency: 'XOF' },
  { label: 'Sierra Leone', value: 'SLE', currency: 'SLE' },
  { label: 'Uganda', value: 'UGA', currency: 'UGX' },
  { label: 'Zambia', value: 'ZMB', currency: 'ZMW' },
];

const RNSearchableSelect = ({ value, onValueChange, options, placeholder, getLabel = (o) => o.label, getValue = (o) => o.value }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selectedOption = options.find((o) => String(getValue(o)) === String(value));
  const filtered = options.filter((o) => getLabel(o).toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <TouchableOpacity style={styles.selectButton} onPress={() => setModalVisible(true)}>
        <Text style={selectedOption ? styles.selectText : styles.placeholderText}>
          {selectedOption ? getLabel(selectedOption) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#94A3B8" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{placeholder}</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(getValue(item))}
            renderItem={({ item }) => {
              const isSelected = String(value) === String(getValue(item));
              return (
                <TouchableOpacity
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => {
                    onValueChange(String(getValue(item)));
                    setModalVisible(false);
                    setSearch('');
                  }}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {getLabel(item)}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color="#2563EB" />}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

const PawaPayModal = ({ visible, onClose, onSuccess, cart = {}, products = [] }) => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [provider, setProvider] = useState('');
  const [providers, setProviders] = useState([]);
  
  const [convertedItems, setConvertedItems] = useState([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [isCalculatingAmount, setIsCalculatingAmount] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('country');

  // Recalculate amount & convert items dynamically when the target currency changes
  useEffect(() => {
    if (!currency || !visible) return;

    const performConversion = async () => {
      setIsCalculatingAmount(true);
      let total = 0;
      const newItems = [];

      try {
        const promises = Object.entries(cart).map(async ([productId, quantity]) => {
          const product = products.find((p) => String(p.id) === String(productId));
          const originalSubtotal = product.price * quantity;
          const productCurrency = product.currency; 
          
          let convertedSubtotal = originalSubtotal;
          let convertedPrice = product.price;

          if (productCurrency !== currency) {
            const res = await axiosClient.get('/exchange-rate', {
              params: {
                from: productCurrency,
                to: currency,
                amount: originalSubtotal
              }
            });
            convertedSubtotal = parseFloat(res.data.converted_amount);
            convertedPrice = convertedSubtotal / quantity;
          }

          newItems.push({
            product_id: product.id,
            quantity: quantity,
            unit_price: convertedPrice,
            subtotal: convertedSubtotal,
            original_currency: productCurrency
          });

          return convertedSubtotal;
        });

        const results = await Promise.all(promises);
        total = results.reduce((acc, val) => acc + val, 0);
        
        // --- Rounded to nearest integer ---
        setAmount(Math.ceil(total).toString());
        setConvertedItems(newItems);
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Currency conversion failed', text2: 'Please try selecting the country again.' });
        setAmount('');
        setConvertedItems([]);
      } finally {
        setIsCalculatingAmount(false);
      }
    };

    performConversion();
  }, [currency, cart, products, visible]);

  // Fetch PawaPay providers when country changes
  useEffect(() => {
    if (!country) return;
    const selectedCountry = COUNTRIES.find((c) => c.value === country);
    setCurrency(selectedCountry?.currency || '');
    setProvider('');
    setProviders([]);
    setMobileNumber('');
    setStep('provider');

    const fetchProviders = async () => {
      setIsLoadingProviders(true);
      try {
        const response = await axiosClient.get(`/pawapay/availability/?country=${country}&operationType=DEPOSIT`);
        const countryData = response.data?.find?.((d) => d.country === country) || response.data?.[0];
        const operational = (countryData?.providers || [])
          .filter((p) => p.operationTypes?.DEPOSIT === 'OPERATIONAL')
          .map((p) => ({ label: formatProviderLabel(p.provider), value: p.provider }));

        setProviders(operational);
        if (operational.length === 0) Toast.show({ type: 'info', text1: 'No providers found.' });
      } catch (err) {
        Toast.show({ type: 'error', text1: 'Failed to load providers' });
        console.error('Provider fetch error:', err);
        setStep('country');
      } finally {
        setIsLoadingProviders(false);
      }
    };
    fetchProviders();
  }, [country]);

  const handleProviderChange = (val) => {
    setProvider(val);
    if (!val) return;
    setStep('details');
  };

  const formatProviderLabel = (code) => {
    const map = {
      AIRTEL_TZA: 'Airtel Tanzania', VODACOM_TZA: 'M-Pesa Tanzania', TIGO_TZA: 'Mixx by Yas Tanzania', HALOTEL_TZA: 'HaloPesa Tanzania',
      MTN_MOMO_BEN: 'MTN Benin', MOOV_BEN: 'Moov Benin', MOOV_BFA: 'Moov Burkina Faso', ORANGE_BFA: 'Orange Burkina Faso',
      MTN_MOMO_CMR: 'MTN Cameroon', ORANGE_CMR: 'Orange Cameroon', MTN_MOMO_CIV: 'MTN Ivory Coast', ORANGE_CIV: 'Orange Ivory Coast',
      WAVE_CIV: 'Wave Ivory Coast', VODACOM_MPESA_COD: 'Vodacom DRC', AIRTEL_COD: 'Airtel DRC', ORANGE_COD: 'Orange DRC',
      MPESA_ETH: 'Safaricom M-Pesa Ethiopia', AIRTEL_GAB: 'Airtel Gabon', MTN_MOMO_GHA: 'MTN Ghana', AIRTELTIGO_GHA: 'AT Ghana',
      VODAFONE_GHA: 'Vodafone Ghana', MPESA_KEN: 'M-Pesa Kenya', MPESA_LSO: 'M-Pesa Lesotho', AIRTEL_MWI: 'Airtel Malawi',
      TNM_MWI: 'TNM Malawi', MOVITEL_MOZ: 'Movitel Mozambique', VODACOM_MOZ: 'Vodacom Mozambique', AIRTEL_NGA: 'Airtel Nigeria',
      MTN_MOMO_NGA: 'MTN Nigeria', AIRTEL_COG: 'Airtel Republic of the Congo', MTN_MOMO_COG: 'MTN Republic of the Congo',
      AIRTEL_RWA: 'Airtel Rwanda', MTN_MOMO_RWA: 'MTN Rwanda', FREE_SEN: 'Free Senegal', ORANGE_SEN: 'Orange Senegal',
      WAVE_SEN: 'Wave Senegal', ORANGE_SLE: 'Orange Sierra Leone', AIRTEL_OAPI_UGA: 'Airtel Uganda', MTN_MOMO_UGA: 'MTN Uganda',
      AIRTEL_OAPI_ZMB: 'Airtel Zambia', MTN_MOMO_ZMB: 'MTN Zambia', ZAMTEL_ZMB: 'Zamtel Zambia',
    };
    return map[code] || code.replace(/_/g, ' ');
  };

  const handleMobileChange = (text) => {
    const raw = text.replace(/\D/g, '');
    const formatted = raw.replace(/(\d{3})(?=\d)/g, '$1 ');
    setMobileNumber(formatted);
  };

  const resetState = () => {
    setMobileNumber('');
    setAmount('');
    setCountry('');
    setCurrency('');
    setProvider('');
    setProviders([]);
    setConvertedItems([]);
    setStep('country');
    setIsLoading(false);
    setIsLoadingProviders(false);
    setIsCalculatingAmount(false);
  };

  const handleSubmit = async () => {
    if (!mobileNumber || !amount || !provider) {
      Toast.show({ type: 'error', text1: 'Fill in all details' });
      return;
    }

    if (convertedItems.length === 0) {
      Toast.show({ type: 'error', text1: 'Cart is empty or still converting' });
      return;
    }

    setIsLoading(true);
    try {
      const payload = { 
        amount,  
        currency, 
        provider, 
        mobileNumber: mobileNumber.replace(/\s/g, ''),
        items: convertedItems 
      };
      
      const response = await axiosClient.post('/pawapay/mobile_initialize_deposit/', payload);
      const failureMessage = response.data?.data?.failureReason?.failureMessage;

      if (failureMessage) {
        Toast.show({ type: 'info', text1: failureMessage });
        console.error('PawaPay initialization warning:', failureMessage);
        resetState();
        onClose();
      } else {
        Toast.show({ type: 'success', text1: 'Payment initialized', text2: 'Awaiting confirmation...' });
        
        const depositId = response.data?.data?.depositId;
        if (depositId) {
          setTimeout(async () => {
            try {
              const statusRes = await axiosClient.get(`/pawapay/deposit-status/${depositId}/`);
              Toast.show({
                type: 'info',
                text1: `Status: ${statusRes.data?.data?.data?.status || 'Unknown'}`,
              });
            } catch (e) {
              console.error('Status check error:', e);
            }
          }, 5000);
        }
        resetState();
        
        if (onSuccess) {
          onSuccess();
        } else {
          onClose();
        }
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Something went wrong' });
      console.error('PawaPay error:', error);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeIcon} onPress={() => { resetState(); onClose(); }}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name="phone-portrait-outline" size={22} color="#4F46E5" />
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Mobile Money</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>COUNTRY</Text>
            <RNSearchableSelect value={country} onValueChange={setCountry} options={COUNTRIES} placeholder="Select Country..." />
          </View>

          {step !== 'country' && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>PROVIDER</Text>
              {isLoadingProviders ? (
                <View style={styles.loadingBox}><ActivityIndicator size="small" color="#4F46E5" /></View>
              ) : (
                <RNSearchableSelect value={provider} onValueChange={handleProviderChange} options={providers} placeholder="Select Provider..." />
              )}
            </View>
          )}

          {step === 'details' && (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>MOBILE NUMBER</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholder="xxx xxx xxx xxx"
                  value={mobileNumber}
                  onChangeText={handleMobileChange}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>CURRENCY</Text>
                  <TextInput style={[styles.input, styles.disabledInput]} value={currency} editable={false} />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>AMOUNT</Text>
                  <View style={[styles.input, styles.disabledInput, { justifyContent: 'center' }]}>
                    {isCalculatingAmount ? (
                      <ActivityIndicator size="small" color="#4F46E5" />
                    ) : (
                      <Text style={{ color: '#0F172A' }}>{amount}</Text>
                    )}
                  </View>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, (isLoading || isCalculatingAmount) && { opacity: 0.7 }]} 
                onPress={handleSubmit} 
                disabled={isLoading || isCalculatingAmount}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Continue to payment</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default PawaPayModal;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  closeIcon: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  logo: { height: 40, alignSelf: 'center', marginBottom: 24 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#0F172A' },
  disabledInput: { backgroundColor: '#F8FAFC', color: '#94A3B8' },
  selectButton: { height: 48, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontSize: 14, color: '#0F172A' },
  placeholderText: { fontSize: 14, color: '#94A3B8' },
  loadingBox: { height: 48, backgroundColor: '#F8FAFC', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  submitButton: { height: 48, backgroundColor: '#6D28D9', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, paddingHorizontal: 12, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#0F172A' },
  optionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  optionItemSelected: { backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 14, color: '#1E293B' },
  optionTextSelected: { color: '#2563EB', fontWeight: '500' },
});
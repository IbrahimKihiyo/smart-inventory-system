import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker'; // Import
import axiosClient from '../../../src/services/axiosClient';

const PURPLE = '#7C3AED';
const DEFAULT_CURRENCY = 'TZS';

const CreditModal = ({
  visible,
  onClose,
  onSuccess,
  cart,
  products,
  totalAmount,
  currency,
}) => {
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [payBefore, setPayBefore] = useState(new Date()); // New State
  const [showPicker, setShowPicker] = useState(false); // New State
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [displayTotalAmount, setDisplayTotalAmount] = useState(0);
  const [errors, setErrors] = useState({});

  // ... (Keep existing helper functions: normalizeCurrency, convertAmount, buildTransactionItems)
  const normalizeCurrency = (value) => {
    return (value || DEFAULT_CURRENCY).toString().trim().toUpperCase();
  };

  const convertAmount = async (amount, fromCurrency, toCurrency = DEFAULT_CURRENCY) => {
    const from = normalizeCurrency(fromCurrency);
    const to = normalizeCurrency(toCurrency);
    const numericAmount = Number(amount) || 0;
    if (from === to) return numericAmount;
    const res = await axiosClient.get('/exchange-rate', { params: { from, to, amount: numericAmount } });
    const data = res.data || {};
    const converted = data.converted_amount ?? data.convertedAmount ?? data.amount ?? data.result ?? data.data?.converted_amount ?? data.data?.convertedAmount ?? numericAmount;
    return Number(converted) || 0;
  };

  const cartProducts = products.filter((p) => cart[p.id] > 0);
  const cartCurrencies = [...new Set(cartProducts.map((p) => normalizeCurrency(p.currency || currency)))];
  const isMixedCurrency = cartCurrencies.length > 1;
  const transactionCurrency = isMixedCurrency ? DEFAULT_CURRENCY : (cartCurrencies[0] || normalizeCurrency(currency));

  const buildTransactionItems = async (convertToTzs) => {
    const items = await Promise.all(
      cartProducts.map(async (p) => {
        const quantity = Number(cart[p.id]) || 0;
        const itemCurrency = normalizeCurrency(p.currency || currency);
        const subtotal = Number(p.price) * quantity;
        const finalSubtotal = convertToTzs ? await convertAmount(subtotal, itemCurrency, DEFAULT_CURRENCY) : subtotal;
        const finalUnitPrice = quantity > 0 ? finalSubtotal / quantity : finalSubtotal;
        return { product_id: p.id, quantity, unit_price: Number(finalUnitPrice.toFixed(2)), currency: convertToTzs ? DEFAULT_CURRENCY : itemCurrency };
      })
    );
    const total = items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
    return { items, total: Number(total.toFixed(2)) };
  };

  useEffect(() => {
    let cancelled = false;
    const prepareSummary = async () => {
      if (!visible) return;
      if (cartProducts.length === 0) { setDisplayTotalAmount(0); setSummaryLoading(false); return; }
      if (!isMixedCurrency) { setDisplayTotalAmount(Number(totalAmount) || 0); setSummaryLoading(false); return; }
      setSummaryLoading(true);
      try {
        const { total } = await buildTransactionItems(true);
        if (!cancelled) setDisplayTotalAmount(total);
      } catch (error) {
        console.error(error.response?.data || error.message);
        if (!cancelled) setDisplayTotalAmount(Number(totalAmount) || 0);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };
    prepareSummary();
    return () => { cancelled = true; };
  }, [visible, cartProducts.length, totalAmount, isMixedCurrency, currency]);

  const validate = () => {
    const newErrors = {};
    if (!borrowerName.trim()) newErrors.name = 'Borrower name is required.';
    if (!borrowerPhone.trim()) {
      newErrors.phone = 'Mobile number is required.';
    } else if (!/^\+?\d{9,15}$/.test(borrowerPhone.trim())) {
      newErrors.phone = 'Enter a valid mobile number.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { items, total } = await buildTransactionItems(isMixedCurrency);
      await axiosClient.post('/transactions/credit', {
        borrower_name: borrowerName.trim(),
        borrower_phone: borrowerPhone.trim(),
        pay_before: payBefore.toISOString(), // Sent as ISO string
        items,
        amount: total,
        currency: transactionCurrency,
      });

      handleClose(); // Use internal reset
      onSuccess();
    } catch (error) {
      console.error(error.response?.data || error.message);
      setErrors({ submit: 'Could not record credit sale.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setBorrowerName('');
    setBorrowerPhone('');
    setPayBefore(new Date()); // Reset date
    setErrors({});
    setDisplayTotalAmount(0);
    setSummaryLoading(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBadge}><Ionicons name="person-outline" size={20} color={PURPLE} /></View>
              <View>
                <Text style={styles.title}>Credit Sale</Text>
                <Text style={styles.subtitle}>Borrower pays later</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} disabled={loading}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* ... Summary Section ... */}
            <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Items being credited</Text>
                {cartProducts.map((p) => (
                    <View key={p.id} style={styles.summaryRow}>
                        <Text style={styles.summaryItem} numberOfLines={1}>{p.name} × {cart[p.id]}</Text>
                        <Text style={styles.summaryPrice}>{p.currency || currency} {(p.price * cart[p.id]).toLocaleString()}</Text>
                    </View>
                ))}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryTotal}>Total Owed</Text>
                    <Text style={styles.summaryTotalAmount}>{isMixedCurrency ? (summaryLoading ? '...' : `${DEFAULT_CURRENCY} ${displayTotalAmount.toLocaleString()}`) : `${transactionCurrency} ${Number(totalAmount || 0).toLocaleString()}`}</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Borrower Information</Text>

            {/* Input Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
                <Ionicons name="person-outline" size={16} color="#94A3B8" />
                <TextInput style={styles.input} placeholder="e.g. John Doe" value={borrowerName} onChangeText={setBorrowerName} editable={!loading} />
              </View>
            </View>

            {/* Input Phone */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Mobile Number *</Text>
              <View style={[styles.inputWrapper, errors.phone && styles.inputError]}>
                <Ionicons name="call-outline" size={16} color="#94A3B8" />
                <TextInput style={styles.input} placeholder="e.g. +255712345678" value={borrowerPhone} onChangeText={setBorrowerPhone} keyboardType="phone-pad" editable={!loading} />
              </View>
            </View>

            {/* Pay Before Date Picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Pay Before Date *</Text>
              <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowPicker(true)}>
                <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
                <Text style={styles.input}>{payBefore.toLocaleDateString()}</Text>
              </TouchableOpacity>
              {showPicker && (
                <DateTimePicker
                    value={payBefore}
                    mode="date"
                    display="default"
                    minimumDate={new Date()} // Add this line to block past dates
                    onChange={(event, date) => {
                    setShowPicker(false);
                    if (date) {
                        setPayBefore(date);
                    }
                    }}
                />
               )}
              
            </View>

            {/* ... Submit / Action Section ... */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={loading}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={styles.confirmBtnText}>Record Credit Sale</Text></>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CreditModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryItem: { fontSize: 14, color: '#334155', flex: 1, paddingRight: 8 },
  summaryPrice: { fontSize: 14, color: '#334155', fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 10 },
  summaryTotal: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  summaryTotalAmount: { fontSize: 16, fontWeight: '800', color: PURPLE },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  inputError: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  input: { flex: 1, fontSize: 14, color: '#0F172A' },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  submitError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  submitErrorText: { fontSize: 13, color: '#DC2626', flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PURPLE,
    gap: 8,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
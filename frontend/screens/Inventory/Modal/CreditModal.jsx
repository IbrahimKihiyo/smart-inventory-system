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
import DateTimePicker from '@react-native-community/datetimepicker';
import axiosClient from '../../../src/services/axiosClient';
import { useLanguage } from '../../../src/context/LanguageContext';

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
  const { t } = useLanguage();
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [payBefore, setPayBefore] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [displayTotalAmount, setDisplayTotalAmount] = useState(0);
  const [errors, setErrors] = useState({});

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

  // YYYY-MM-DD for the web date input
  const toYMD = (dateObj) => {
    if (!dateObj) return '';
    const pad = (n) => (n < 10 ? '0' + n : n);
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  };

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
    if (!borrowerName.trim()) newErrors.name = t('credit.nameRequired');
    if (!borrowerPhone.trim()) {
      newErrors.phone = t('credit.phoneRequired');
    } else if (!/^\+?\d{9,15}$/.test(borrowerPhone.trim())) {
      newErrors.phone = t('credit.phoneInvalid');
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
        pay_before: payBefore.toISOString(),
        items,
        amount: total,
        currency: transactionCurrency,
      });

      handleClose();
      onSuccess();
    } catch (error) {
      console.error(error.response?.data || error.message);
      setErrors({ submit: t('credit.submitError') });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setBorrowerName('');
    setBorrowerPhone('');
    setPayBefore(new Date());
    setShowPicker(false);
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
                <Text style={styles.title}>{t('credit.title')}</Text>
                <Text style={styles.subtitle}>{t('credit.subtitle')}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} disabled={loading}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>{t('credit.itemsCredited')}</Text>
                {cartProducts.map((p) => (
                    <View key={p.id} style={styles.summaryRow}>
                        <Text style={styles.summaryItem} numberOfLines={1}>{p.name} × {cart[p.id]}</Text>
                        <Text style={styles.summaryPrice}>{p.currency || currency} {(p.price * cart[p.id]).toLocaleString()}</Text>
                    </View>
                ))}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryTotal}>{t('credit.totalOwed')}</Text>
                    <Text style={styles.summaryTotalAmount}>{isMixedCurrency ? (summaryLoading ? '...' : `${DEFAULT_CURRENCY} ${displayTotalAmount.toLocaleString()}`) : `${transactionCurrency} ${Number(totalAmount || 0).toLocaleString()}`}</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>{t('credit.borrowerInfo')}</Text>

            {/* Input Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('credit.fullName')}</Text>
              <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
                <Ionicons name="person-outline" size={16} color="#94A3B8" />
                <TextInput style={styles.input} value={borrowerName} onChangeText={setBorrowerName} editable={!loading} />
              </View>
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            {/* Input Phone */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('credit.mobile')}</Text>
              <View style={[styles.inputWrapper, errors.phone && styles.inputError]}>
                <Ionicons name="call-outline" size={16} color="#94A3B8" />
                <TextInput style={styles.input} value={borrowerPhone} onChangeText={setBorrowerPhone} keyboardType="phone-pad" editable={!loading} />
              </View>
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            {/* Pay Before Date — HTML date input on web, native picker on device */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('credit.payBefore')}</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={toYMD(payBefore)}
                  min={toYMD(new Date())}
                  onChange={(e) => e.target.value && setPayBefore(new Date(e.target.value + 'T12:00:00'))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    padding: '13px 12px',
                    fontSize: 14,
                    color: '#0F172A',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowPicker(true)}>
                    <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
                    <Text style={styles.input}>{payBefore.toLocaleDateString()}</Text>
                  </TouchableOpacity>

                  {Platform.OS === 'android' && showPicker && (
                    <DateTimePicker
                      value={payBefore}
                      mode="date"
                      display="default"
                      minimumDate={new Date()}
                      onChange={(event, date) => { setShowPicker(false); if (date) setPayBefore(date); }}
                    />
                  )}

                  {Platform.OS === 'ios' && (
                    <Modal transparent visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
                      <View style={styles.pickerRoot}>
                        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPicker(false)} />
                        <View style={styles.pickerSheet}>
                          <View style={styles.pickerHeader}>
                            <TouchableOpacity onPress={() => setShowPicker(false)}>
                              <Text style={styles.pickerDone}>{t('credit.done')}</Text>
                            </TouchableOpacity>
                          </View>
                          <DateTimePicker
                            value={payBefore}
                            mode="date"
                            display="spinner"
                            minimumDate={new Date()}
                            onChange={(event, date) => { if (date) setPayBefore(date); }}
                            style={{ height: 216 }}
                          />
                        </View>
                      </View>
                    </Modal>
                  )}
                </>
              )}
            </View>

            {errors.submit ? (
              <View style={styles.submitError}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.submitErrorText}>{errors.submit}</Text>
              </View>
            ) : null}

            {/* Submit / Action Section */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={loading}><Text style={styles.cancelBtnText}>{t('credit.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={styles.confirmBtnText}>{t('credit.record')}</Text></>}
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
  pickerRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  pickerHeader: { alignItems: 'flex-end', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pickerDone: { fontSize: 15, fontWeight: '700', color: PURPLE },
});

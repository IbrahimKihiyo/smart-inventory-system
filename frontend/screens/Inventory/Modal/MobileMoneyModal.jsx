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
import axiosClient from '../../../src/services/axiosClient';
import { useLanguage } from '../../../src/context/LanguageContext';

const PURPLE = '#4F46E5';

// Simple mobile money payment. The shop is in Tanzania and prices are in TZS,
// so there is no country or provider to pick. We just record the amount paid.
const MobileMoneyModal = ({ visible, onClose, onSuccess, cart, products }) => {
  const { t } = useLanguage();
  const [payerPhone, setPayerPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const cartProducts = products.filter((p) => cart[p.id] > 0);

  const items = cartProducts.map((p) => {
    const quantity = Number(cart[p.id]) || 0;
    const subtotal = Math.ceil(Number(p.price) * quantity);
    return {
      product_id: p.id,
      quantity,
      unit_price: Number(p.price),
      currency: 'TZS',
      subtotal_tzs: subtotal,
    };
  });

  const total = items.reduce((sum, i) => sum + i.subtotal_tzs, 0);

  // Prefill the amount with the cart total each time the modal opens.
  useEffect(() => {
    if (visible) setAmount(String(total));
  }, [visible]);

  const handleClose = () => {
    setPayerPhone('');
    setAmount('');
    setErrors({});
    onClose();
  };

  const handleSubmit = async () => {
    const paid = Number(amount);
    if (!paid || paid <= 0) {
      setErrors({ amount: t('mobile.amountRequired') });
      return;
    }
    setLoading(true);
    try {
      await axiosClient.post('/transactions/mobile', {
        items,
        amount: paid,
        currency: 'TZS',
        payer_phone: payerPhone.trim(),
      });
      handleClose();
      onSuccess();
    } catch (error) {
      console.error(error.response?.data || error.message);
      setErrors({ submit: t('mobile.submitError') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBadge}><Ionicons name="phone-portrait-outline" size={20} color={PURPLE} /></View>
              <View>
                <Text style={styles.title}>{t('mobile.title')}</Text>
                <Text style={styles.subtitle}>{t('mobile.subtitle')}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} disabled={loading}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>{t('mobile.itemsSold')}</Text>
              {cartProducts.map((p) => (
                <View key={p.id} style={styles.summaryRow}>
                  <Text style={styles.summaryItem} numberOfLines={1}>{p.name} × {cart[p.id]}</Text>
                  <Text style={styles.summaryPrice}>TZS {(p.price * cart[p.id]).toLocaleString()}</Text>
                </View>
              ))}
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTotal}>{t('mobile.total')}</Text>
                <Text style={styles.summaryTotalAmount}>TZS {total.toLocaleString()}</Text>
              </View>
            </View>

            {/* Phone number (optional) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('mobile.phone')}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={16} color="#94A3B8" />
                <TextInput style={styles.input} value={payerPhone} onChangeText={setPayerPhone} keyboardType="phone-pad" editable={!loading} />
              </View>
            </View>

            {/* Amount paid */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('mobile.amount')}</Text>
              <View style={[styles.inputWrapper, errors.amount && styles.inputError]}>
                <Ionicons name="cash-outline" size={16} color="#94A3B8" />
                <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" editable={!loading} />
              </View>
              {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
            </View>

            {errors.submit ? (
              <View style={styles.submitError}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.submitErrorText}>{errors.submit}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={loading}><Text style={styles.cancelBtnText}>{t('mobile.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={styles.confirmBtnText}>{t('mobile.confirm')}</Text></>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default MobileMoneyModal;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  summaryBox: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryItem: { fontSize: 14, color: '#334155', flex: 1, paddingRight: 8 },
  summaryPrice: { fontSize: 14, color: '#334155', fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 10 },
  summaryTotal: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  summaryTotalAmount: { fontSize: 16, fontWeight: '800', color: PURPLE },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, height: 48, gap: 10 },
  inputError: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  input: { flex: 1, fontSize: 14, color: '#0F172A' },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  submitError: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 16 },
  submitErrorText: { fontSize: 13, color: '#DC2626', flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  confirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: PURPLE, gap: 8 },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

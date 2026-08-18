import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../../src/services/axiosClient';
import { useLanguage } from '../../src/context/LanguageContext';
import DateField from '../../src/components/DateField';
import Toast from 'react-native-toast-message';

const PRIMARY = '#4F46E5';

const ExpensesList = () => {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());

  const money = (n) => `TZS ${Number(n || 0).toLocaleString()}`;
  const ymd = (d) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/expenses');
      setExpenses(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      console.error(error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('');
    setDate(new Date());
  };

  const handleSave = async () => {
    if (!description.trim() || !Number(amount)) {
      Toast.show({ type: 'error', text1: t('expense.fillRequired') });
      return;
    }
    setSaving(true);
    try {
      await axiosClient.post('/expenses', {
        description: description.trim(),
        category: category.trim() || null,
        amount: Number(amount),
        currency: 'TZS',
        expense_date: ymd(date),
      });
      setModalVisible(false);
      resetForm();
      Toast.show({ type: 'success', text1: t('expense.saved') });
      fetchExpenses();
    } catch (error) {
      console.error(error.response?.data || error.message);
      Toast.show({ type: 'error', text1: t('expense.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await axiosClient.delete(`/expenses/${id}`);
      fetchExpenses();
    } catch (error) {
      Toast.show({ type: 'error', text1: t('expense.deleteFailed') });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('expense.title')}</Text>
          <Text style={styles.subtitle}>{t('expense.subtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>{t('expense.add')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>{t('expense.totalLabel')}</Text>
        <Text style={styles.totalValue}>{money(total)}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {expenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={styles.emptyTitle}>{t('expense.none')}</Text>
              <Text style={styles.emptyDesc}>{t('expense.noneDesc')}</Text>
            </View>
          ) : (
            expenses.map((e) => (
              <View key={e.id} style={styles.card}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.cardDesc} numberOfLines={1}>{e.description}</Text>
                  <Text style={styles.cardMeta}>{(e.category ? e.category + ' · ' : '') + String(e.expense_date).slice(0, 10)}</Text>
                </View>
                <Text style={styles.cardAmount}>{money(e.amount)}</Text>
                <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(e.id)} disabled={deletingId === e.id}>
                  {deletingId === e.id ? <ActivityIndicator size="small" color="#DC2626" /> : <Ionicons name="trash-outline" size={16} color="#DC2626" />}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('expense.add')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={20} color="#64748B" /></TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('expense.description')}</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.input} value={description} onChangeText={setDescription} editable={!saving} />
            </View>

            <Text style={styles.label}>{t('expense.amount')}</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" editable={!saving} />
            </View>

            <Text style={styles.label}>{t('expense.category')}</Text>
            <View style={styles.inputWrap}>
              <TextInput style={styles.input} value={category} onChangeText={setCategory} editable={!saving} />
            </View>

            <Text style={styles.label}>{t('expense.date')}</Text>
            <DateField
              value={date}
              valueText={date ? date.toLocaleDateString() : ''}
              onChange={setDate}
              maximumDate={new Date()}
              containerStyle={styles.inputWrap}
              valueStyle={styles.input}
            />

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{t('expense.save')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default ExpensesList;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 20, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 26, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  addBtn: { flexDirection: 'row', backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignItems: 'center', gap: 6 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  totalCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 18 },
  totalLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 4 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 36, alignItems: 'center', marginTop: 10 },
  emptyIcon: { fontSize: 34, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardDesc: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  cardMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  cardAmount: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  delBtn: { backgroundColor: '#FEE2E2', padding: 8, borderRadius: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 4 },
  inputWrap: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, height: 48, justifyContent: 'center', marginBottom: 8 },
  input: { flex: 1, fontSize: 14, color: '#0F172A' },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

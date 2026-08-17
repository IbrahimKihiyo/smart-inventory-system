import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, SafeAreaView,
  ActivityIndicator, TouchableOpacity, Modal, Platform, TextInput, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../../src/services/axiosClient';
import Toast from 'react-native-toast-message';
import { useLanguage } from '../../src/context/LanguageContext';
import DateField from '../../src/components/DateField';

const ITEMS_PER_PAGE = 10;

const CreditorsList = () => {
  const { t } = useLanguage();
  const [creditors, setCreditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPaying, setIsPaying] = useState(false);
  const [payAmount, setPayAmount] = useState('');

  const [selectedCreditor, setSelectedCreditor] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    fetchCreditors();
  }, []);

  const fetchCreditors = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosClient.get('/transactions');
      const allTransactions = response.data;
      const filtered = allTransactions.filter(t => t.payment_method === 'CREDIT');
      setCreditors(filtered);
    } catch (err) {
      console.error('Error fetching creditors:', err);
      setError('Failed to load creditors.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreditorPress = async (id) => {
    setModalVisible(true);
    setDetailsLoading(true);
    try {
      const response = await axiosClient.get(`/transactions/${id}`);
      setSelectedCreditor(response.data);
    } catch (err) {
      console.error('Error fetching creditor details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Record a repayment. Pass an amount for a partial payment, or null to
  // settle the whole remaining balance at once.
  const handleRecordPayment = async (id, amount) => {
    setIsPaying(true);
    try {
      const body = amount != null ? { amount } : {};
      const res = await axiosClient.patch(`/transactions/credit/${id}/repay`, body);
      const fullyPaid = res.data?.transaction?.status === 'COMPLETED';
      Toast.show({
        type: 'success',
        text1: t('cred.paymentDone'),
        text2: fullyPaid ? t('cred.fullyPaidMsg') : t('cred.partialMsg'),
      });
      setPayAmount('');
      // Refresh the open details and the list so the balance updates
      const refreshed = await axiosClient.get(`/transactions/${id}`);
      setSelectedCreditor(refreshed.data);
      fetchCreditors();
    } catch (err) {
      console.error('Error processing payment:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: t('cred.paymentFailed') });
    } finally {
      setIsPaying(false);
    }
  };

  // Record the amount typed in the box (used by the button and the keyboard Done key)
  const recordTypedPayment = () => {
    if (!selectedCreditor) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      Toast.show({ type: 'error', text1: t('cred.enterValidAmount') });
      return;
    }
    handleRecordPayment(selectedCreditor.id, amt);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatDate = (iso, opts) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, opts)
      : null;

  const formatDateLabel = (date) =>
    date
      ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setCurrentPage(1);
  };

  const isOverdue = (pay_before) => {
    if (!pay_before) return false;
    return new Date(pay_before) < new Date();
  };

  // Whole days a debt is past its due date (0 if not overdue)
  const daysOverdue = (pay_before) => {
    if (!pay_before) return 0;
    const due = new Date(pay_before);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - due) / 86400000);
    return Math.max(0, diff);
  };

  // ─── Filter & paginate ────────────────────────────────────────────────────

  const filteredCreditors = creditors.filter((item) => {
    if (!item.created_at) return true;
    const created = new Date(item.created_at);
    if (startDate && created < new Date(startDate.setHours(0, 0, 0, 0))) return false;
    if (endDate && created > new Date(endDate.setHours(23, 59, 59, 999))) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredCreditors.length / ITEMS_PER_PAGE);

  const paginatedCreditors = filteredCreditors.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ─── Status badge helpers ─────────────────────────────────────────────────

  const getStatusStyles = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return { bg: '#E0F2E9', text: '#0A7A5F' };
      case 'partial':   return { bg: '#E7EDFB', text: '#3A56C4' };
      case 'pending':   return { bg: '#FEF0E6', text: '#B86016' };
      default:          return { bg: '#E5E5EA', text: '#666666' };
    }
  };

  // Human, translated label for a debt status
  const statusLabel = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED': return t('status.completed');
      case 'PARTIAL':   return t('status.partial');
      case 'PENDING':   return t('status.pending');
      default:          return t('status.pending');
    }
  };

  // ─── List card ────────────────────────────────────────────────────────────

  const renderCreditorItem = ({ item }) => {
    const statusStyle = getStatusStyles(item.status);
    const initial = item.borrower_name ? item.borrower_name.charAt(0).toUpperCase() : 'C';

    const timeString = formatDate(item.created_at, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }) ?? 'Unknown Date';

    const payBeforeLabel = formatDate(item.pay_before, {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    const overdue = item.status !== 'COMPLETED' && isOverdue(item.pay_before);

    return (
      <TouchableOpacity style={styles.card} onPress={() => handleCreditorPress(item.id)}>
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        {/* Middle: name, created date, pay_before */}
        <View style={styles.detailsContainer}>
          <Text style={styles.providerText}>{item.borrower_name || t('cred.anonymous')}</Text>
          <Text style={styles.subText}>{timeString}</Text>

          {payBeforeLabel && (
            <View style={styles.payBeforeRow}>
              <Ionicons
                name={overdue ? 'alert-circle-outline' : 'time-outline'}
                size={13}
                color={overdue ? '#C0392B' : '#B86016'}
              />
              <Text style={[styles.payBeforeText, overdue && styles.payBeforeTextOverdue]}>
                {overdue
                  ? t('cred.overdueBy', { n: daysOverdue(item.pay_before) })
                  : t('cred.payBy')}
                {payBeforeLabel}
              </Text>
            </View>
          )}
        </View>

        {/* Right: amount + status */}
        <View style={styles.amountContainer}>
          <Text style={styles.amountText}>
            {item.currency || 'TZS'} {parseFloat(item.amount).toLocaleString()}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {statusLabel(item.status)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Date filter UI ───────────────────────────────────────────────────────

  const renderDateFilter = () => (
    <View style={styles.filterContainer}>
      <DateField
        label={t('dash.from')}
        value={startDate}
        valueText={formatDateLabel(startDate)}
        onChange={(d) => { setStartDate(d); setCurrentPage(1); }}
        maximumDate={endDate || new Date()}
        containerStyle={styles.dateBtn}
        labelStyle={styles.dateBtnLabel}
        valueStyle={styles.dateBtnValue}
      />

      <DateField
        label={t('dash.to')}
        value={endDate}
        valueText={formatDateLabel(endDate)}
        onChange={(d) => { setEndDate(d); setCurrentPage(1); }}
        minimumDate={startDate || undefined}
        maximumDate={new Date()}
        containerStyle={styles.dateBtn}
        labelStyle={styles.dateBtnLabel}
        valueStyle={styles.dateBtnValue}
      />

      {(startDate || endDate) && (
        <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
          <Ionicons name="close-circle" size={20} color="#D32F2F" />
        </TouchableOpacity>
      )}
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('cred.title')}</Text>
        <Text style={styles.pageSubtitle}>{t('cred.records', { n: creditors.length })}</Text>
      </View>

      {renderDateFilter()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          data={paginatedCreditors}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCreditorItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('cred.noRecords')}</Text>
          }
        />
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            disabled={currentPage === 1}
            onPress={() => setCurrentPage(p => p - 1)}
            style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={18} color={currentPage === 1 ? '#C7C7CC' : '#4F46E5'} />
          </TouchableOpacity>
          <Text style={styles.pageInfo}>{currentPage} / {totalPages}</Text>
          <TouchableOpacity
            disabled={currentPage === totalPages}
            onPress={() => setCurrentPage(p => p + 1)}
            style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
          >
            <Ionicons name="chevron-forward" size={18} color={currentPage === totalPages ? '#C7C7CC' : '#4F46E5'} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Detail Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>

            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('cred.details')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666666" />
              </TouchableOpacity>
            </View>

            {detailsLoading ? (
              <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 24 }} />
            ) : selectedCreditor ? (
              <>
                {/* Borrower name */}
                <View style={styles.modalInfoRow}>
                  <Ionicons name="person-outline" size={16} color="#666666" />
                  <Text style={styles.modalInfoText}>
                    {selectedCreditor.borrower_name || t('cred.anonymous')}
                  </Text>
                </View>

                {/* Pay Before banner */}
                {selectedCreditor.pay_before && (() => {
                  const overdue =
                    selectedCreditor.status !== 'COMPLETED' &&
                    isOverdue(selectedCreditor.pay_before);
                  const label = formatDate(selectedCreditor.pay_before, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  });
                  return (
                    <View style={[
                      styles.modalPayBeforeRow,
                      overdue && styles.modalPayBeforeRowOverdue,
                    ]}>
                      <Ionicons
                        name={overdue ? 'alert-circle-outline' : 'alarm-outline'}
                        size={16}
                        color={overdue ? '#C0392B' : '#B86016'}
                      />
                      <Text style={[
                        styles.modalPayBeforeText,
                        overdue && styles.modalPayBeforeTextOverdue,
                      ]}>
                        {overdue
                          ? t('cred.overdueBy', { n: daysOverdue(selectedCreditor.pay_before) })
                          : t('cred.payBy')}
                        {label}
                      </Text>
                    </View>
                  );
                })()}

                {/* Items list */}
                <FlatList
                  data={selectedCreditor.items || []}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <View style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.product?.name}</Text>
                      <Text style={styles.itemAmount}>
                        {parseFloat(item.subtotal).toLocaleString()}
                      </Text>
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>{t('tx.noItems')}</Text>
                  }
                  style={{ maxHeight: 220 }}
                />

                {/* Total row */}
                {selectedCreditor.amount && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{t('cred.total')}</Text>
                    <Text style={styles.totalAmount}>
                      {selectedCreditor.currency || 'TZS'}{' '}
                      {parseFloat(selectedCreditor.amount).toLocaleString()}
                    </Text>
                  </View>
                )}

                {/* Repayment section — shows what is paid, what remains, and lets
                    the owner record a partial or full payment */}
                {selectedCreditor.amount != null && (() => {
                  const total     = parseFloat(selectedCreditor.amount) || 0;
                  const paid      = parseFloat(selectedCreditor.amount_paid) || 0;
                  const remaining = Math.max(0, total - paid);
                  const currency  = selectedCreditor.currency || 'TZS';
                  const settled   = selectedCreditor.status === 'COMPLETED' || remaining <= 0;
                  const lastPaid  = selectedCreditor.last_paid_at
                    ? formatDate(selectedCreditor.last_paid_at, {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true,
                      })
                    : null;

                  return (
                    <View style={styles.paySection}>
                      {paid > 0 && (
                        <>
                          <View style={styles.payRow}>
                            <Text style={styles.payRowLabel}>{t('cred.amountPaid')}</Text>
                            <Text style={styles.payRowValue}>{currency} {paid.toLocaleString()}</Text>
                          </View>
                          {lastPaid && (
                            <View style={styles.payRow}>
                              <Text style={styles.payRowLabel}>{t('cred.lastPaid')}</Text>
                              <Text style={styles.payRowMuted}>{lastPaid}</Text>
                            </View>
                          )}
                        </>
                      )}

                      <View style={styles.payRow}>
                        <Text style={[styles.payRowLabel, { fontWeight: '700' }]}>{t('cred.remaining')}</Text>
                        <Text style={[styles.payRowValue, { fontWeight: '800', color: settled ? '#0A7A5F' : '#C0392B' }]}>
                          {currency} {remaining.toLocaleString()}
                        </Text>
                      </View>

                      {!settled && (
                        <>
                          <View style={styles.payInputRow}>
                            <TextInput
                              style={styles.payInput}
                              placeholder={t('cred.enterAmount')}
                              placeholderTextColor="#94A3B8"
                              keyboardType="decimal-pad"
                              value={payAmount}
                              onChangeText={(v) => {
                                let cleaned = v.replace(/[^0-9.]/g, '');
                                const num = parseFloat(cleaned);
                                // Never allow more than what is still owed
                                if (!isNaN(num) && num > remaining) cleaned = String(remaining);
                                setPayAmount(cleaned);
                              }}
                              returnKeyType="done"
                              onSubmitEditing={recordTypedPayment}
                            />
                            <TouchableOpacity
                              style={styles.recordBtn}
                              disabled={isPaying}
                              onPress={recordTypedPayment}
                            >
                              <Text style={styles.recordBtnText}>{t('cred.recordPayment')}</Text>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            style={styles.payButton}
                            onPress={() => handleRecordPayment(selectedCreditor.id, null)}
                            disabled={isPaying}
                          >
                            {isPaying ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons name="cash-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                <Text style={styles.payButtonText}>{t('cred.payFull')}</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  );
                })()}
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default CreditorsList;

const styles = StyleSheet.create({
  // ── Layout ────────────────────────────────────────────────────────────────
  container:       { flex: 1, backgroundColor: '#F2F2F7' },
  pageHeader:      { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10 },
  pageTitle:       { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E', letterSpacing: 0.5 },
  pageSubtitle:    { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  listContent:     { padding: 16, paddingBottom: 32 },
  emptyText:       { textAlign: 'center', color: '#666666', marginTop: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Date filter ───────────────────────────────────────────────────────────
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateBtnLabel: { fontSize: 10, color: '#8E8E93', fontWeight: '600', marginBottom: 2 },
  dateBtnValue: { fontSize: 13, color: '#1C1C1E', fontWeight: '600' },
  clearBtn:     { padding: 4, justifyContent: 'center', alignItems: 'center' },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  avatar: {
    width: 42, height: 42,
    borderRadius: 10,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText:       { fontSize: 18, fontWeight: 'bold' },
  detailsContainer: { flex: 1, justifyContent: 'center' },
  providerText:     { fontSize: 16, fontWeight: '700' },
  subText:          { fontSize: 13, color: '#666666', marginTop: 2 },

  // pay_before — list card
  payBeforeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 4,
  },
  payBeforeText: {
    fontSize: 12,
    color: '#B86016',
    fontWeight: '600',
  },
  payBeforeTextOverdue: {
    color: '#C0392B',
  },

  // amount / status
  amountContainer:  { alignItems: 'flex-end', justifyContent: 'center' },
  amountText:       { fontSize: 15, fontWeight: '700' },
  statusBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 6 },
  statusText:       { fontSize: 11, fontWeight: '700' },

  // ── Pagination ────────────────────────────────────────────────────────────
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  pageBtn:         { padding: 8 },
  pageBtnDisabled: { opacity: 0.4 },
  pageInfo:        { fontSize: 14, color: '#666666' },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },

  // borrower row
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalInfoText: { fontSize: 15, color: '#333333', fontWeight: '600' },

  // pay_before — modal banner
  modalPayBeforeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF0E6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalPayBeforeRowOverdue: {
    backgroundColor: '#FDECEA',
  },
  modalPayBeforeText: {
    fontSize: 14,
    color: '#B86016',
    fontWeight: '700',
  },
  modalPayBeforeTextOverdue: {
    color: '#C0392B',
  },

  // items list
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  itemName:   { fontSize: 14, color: '#333333', flex: 1 },
  itemAmount: { fontSize: 14, fontWeight: '600', color: '#333333' },

  // total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1.5,
    borderColor: '#E5E5EA',
    marginTop: 2,
  },
  totalLabel:  { fontSize: 15, fontWeight: '700', color: '#333333' },
  totalAmount: { fontSize: 15, fontWeight: '700', color: '#333333' },

  // repayment section
  paySection: { marginTop: 12 },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  payRowLabel: { fontSize: 14, color: '#475569' },
  payRowValue: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  payRowMuted: { fontSize: 13, color: '#8E8E93' },
  payInputRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  payInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  recordBtn: {
    backgroundColor: '#0A7A5F',
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // pay button
  payButton: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
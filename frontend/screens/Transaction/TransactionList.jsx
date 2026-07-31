import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, SafeAreaView,
  ActivityIndicator, TouchableOpacity, Platform, Modal
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../../src/services/axiosClient';
import { useLanguage } from '../../src/context/LanguageContext';

const ITEMS_PER_PAGE = 10;

const TransactionList = () => {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Added state for Modal
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Date filter state
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axiosClient.get('/transactions');
        setTransactions(response.data);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError('Failed to load transactions. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  // Function to handle click
  const handleTransactionPress = async (id) => {
    setModalVisible(true);
    setDetailsLoading(true);
    try {
      const response = await axiosClient.get(`/transactions/${id}`);
      setSelectedTransaction(response.data);
    } catch (err) {
      console.error('Error fetching transaction details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Filter transactions by date range
  const filteredTransactions = transactions.filter((item) => {
    if (!item.created_at) return true;

    const created = new Date(item.created_at);

    if (startDate && created < new Date(startDate.setHours(0, 0, 0, 0))) return false;
    if (endDate && created > new Date(endDate.setHours(23, 59, 59, 999))) return false;

    return true;
  });

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatDateLabel = (date) =>
    date
      ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

  // Translated status and payment-method labels
  const statusLabel = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
      case 'SUCCESS':    return t('status.completed');
      case 'PARTIAL':    return t('status.partial');
      case 'PENDING':    return t('status.pending');
      default:           return t('status.unknown');
    }
  };

  const providerLabel = (provider) => {
    switch (provider?.toUpperCase()) {
      case 'CASH':   return t('method.cash');
      case 'CREDIT': return t('method.credit');
      default:       return provider;
    }
  };

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setCurrentPage(1);
  };

  const getStatusStyles = (status) => {
    if (!status) return { bg: '#E5E5EA', text: '#666666' };

    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return { bg: '#E0F2E9', text: '#0A7A5F' };
      case 'partial':
        return { bg: '#E7EDFB', text: '#3A56C4' };
      case 'pending':
        return { bg: '#FEF0E6', text: '#B86016' };
      case 'failed':
        return { bg: '#FCE4E4', text: '#D32F2F' };
      default:
        return { bg: '#E5E5EA', text: '#666666' };
    }
  };

  const renderTransactionItem = ({ item }) => {
    const statusStyle = getStatusStyles(item.status);
    const initial = item.mmo_provider ? item.mmo_provider.charAt(0).toUpperCase() : '?';

    const timeString = item.created_at
      ? new Date(item.created_at).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : 'Unknown Date & Time';

    return (
      <TouchableOpacity style={styles.card} onPress={() => handleTransactionPress(item.id)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.providerText}>{providerLabel(item.mmo_provider)}</Text>

          {item.payer_phone ? (
            <Text style={styles.subText}>
              <Ionicons name="call-outline" size={12} color="#666666" />{' '}
              {item.payer_phone}
            </Text>
          ) : null}

          <Text style={styles.subText}>
            <Ionicons name="time-outline" size={12} color="#666666" /> {timeString}
          </Text>

          <Text style={[styles.subText, { fontStyle: 'italic', color: '#4F46E5' }]}>
            {item.internal_reference_id}
          </Text>
        </View>

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

  const renderPagination = () => (
    <View style={styles.pagination}>
      <TouchableOpacity
        style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
        onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
        disabled={currentPage === 1}
      >
        <Ionicons name="arrow-back" size={16} color={currentPage === 1 ? '#AEAEB2' : '#FFFFFF'} />
      </TouchableOpacity>

      <Text style={styles.pageInfo}>
        {t('tx.page', { current: currentPage, total: totalPages })}
      </Text>

      <TouchableOpacity
        style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
        onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
      >
        <Ionicons name="arrow-forward" size={16} color={currentPage === totalPages ? '#AEAEB2' : '#FFFFFF'} />
      </TouchableOpacity>
    </View>
  );

  const renderDateFilter = () => (
    <View style={styles.filterContainer}>
      <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
        <Text style={styles.dateBtnLabel}>{t('dash.from')}</Text>
        <Text style={styles.dateBtnValue}>{formatDateLabel(startDate)}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
        <Text style={styles.dateBtnLabel}>{t('dash.to')}</Text>
        <Text style={styles.dateBtnValue}>{formatDateLabel(endDate)}</Text>
      </TouchableOpacity>

      {(startDate || endDate) && (
        <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
          <Ionicons name="close-circle" size={20} color="#D32F2F" />
        </TouchableOpacity>
      )}

      {showStartPicker && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={endDate || new Date()}
          onChange={(event, date) => {
            setShowStartPicker(false);
            if (date) {
              setStartDate(date);
              setCurrentPage(1);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={startDate || undefined}
          maximumDate={new Date()}
          onChange={(event, date) => {
            setShowEndPicker(false);
            if (date) {
              setEndDate(date);
              setCurrentPage(1);
            }
          }}
        />
      )}
    </View>
  );

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('tx.title')}</Text>
        <Text style={styles.pageSubtitle}>
          {t('cred.records', { n: transactions.length })}
        </Text>
      </View>

      {renderDateFilter()}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          data={paginatedTransactions}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          renderItem={renderTransactionItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('tx.none')}</Text>
          }
          ListFooterComponent={totalPages > 1 ? renderPagination : null}
        />
      )}

      {/* Modal to show items */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            
            {/* Updated Modal Header with Single Reference ID */}
            <View style={styles.modalHeader}>
                <View>
                <Text style={styles.modalTitle}>{t('tx.items')}</Text>
                {selectedTransaction && (
                    <Text style={{ fontSize: 13, color: '#4F46E5', fontStyle: 'italic', marginTop: 4 }}>
                    {t('tx.ref')}: {selectedTransaction.internal_reference_id}
                    </Text>
                )}
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666666" />
                </TouchableOpacity>
            </View>

            {detailsLoading ? (
                <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4F46E5" />
                </View>
            ) : selectedTransaction ? (
                <FlatList
                data={selectedTransaction.items || []}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <View style={styles.itemRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.itemText}>{item.product?.name || 'Item'}</Text>
                        
                        <Text style={styles.itemSubText}>
                        {item.quantity} x {parseFloat(item.unit_price).toLocaleString()}
                        </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}> 
                        {/* Displaying Item Subtotal */}
                        <Text style={[styles.itemText, { fontWeight: '700', color: '#1C1C1E' }]}>
                        {selectedTransaction.currency} {parseFloat(item.subtotal).toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#8E8E93' }}>{t('tx.subtotal')}</Text>
                    </View>
                    </View>
                )}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>{t('tx.noItems')}</Text>
                }
                />
            ) : null}
            </View>
        </View>
      </Modal>
      
    </SafeAreaView>
  );
};

export default TransactionList;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#D32F2F', fontSize: 16, textAlign: 'center' },
  pageHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10, backgroundColor: '#F2F2F7' },
  pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E', letterSpacing: 0.5 },
  pageSubtitle: { fontSize: 13, color: '#8E8E93', marginTop: 2 },

  // Date filter
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
  clearBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: { padding: 16, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  avatar: {
    width: 42, height: 42, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14, backgroundColor: '#E5E5EA',
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E' },
  detailsContainer: { flex: 1, justifyContent: 'center' },
  providerText: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  subText: { fontSize: 13, color: '#666666', marginBottom: 2, flexDirection: 'row', alignItems: 'center' },
  amountContainer: { alignItems: 'flex-end', justifyContent: 'space-between' },
  amountText: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 15, color: '#666666' },
  pagination: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4, marginTop: 4,
  },
  pageBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  pageBtnDisabled: { backgroundColor: '#E5E5EA' },
  pageInfo: { fontSize: 14, color: '#3C3C43', fontWeight: '500' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: '50%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E5EA' },
  itemText: { fontSize: 16, color: '#1C1C1E' },
  itemSubText: { fontSize: 14, color: '#666666' },
});
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import axiosClient from '../../src/services/axiosClient';
import { useLanguage } from '../../src/context/LanguageContext';

const PRIMARY = '#4F46E5';

/**
 * Expiry Alerts screen (FR06).
 *
 * Lists products that are already expired or expiring within the threshold
 * (7 days), grouped and colour-coded, so the shop owner can act before
 * losing money or selling expired goods.
 */
const ExpiryAlerts = () => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await axiosClient.get('/products/expiry-alerts');
      setData(response.data);
    } catch (error) {
      console.error(error.response?.data || error.message);
      Toast.show({
        type: 'error',
        text1: 'Failed to load alerts',
        text2: error.response?.data?.message || error.message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const formatExpiryDate = (dateString) => {
    if (!dateString) return '';
    const datePart = dateString.split(/[T ]/)[0];
    const [year, month, day] = datePart.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const monthName = date.toLocaleString('en-US', { month: 'short' });
    return `${monthName} ${String(day).padStart(2, '0')}, ${year}`;
  };

  // Turn the signed day count into a human label
  const daysLabel = (daysDiff) => {
    if (daysDiff === 0) return t('alerts.today');
    if (daysDiff > 0) return t('alerts.inDays', { n: daysDiff });
    return t('alerts.daysAgo', { n: Math.abs(daysDiff) });
  };

  const formatQuantity = (value) => parseFloat((Number(value) || 0).toFixed(2)).toString();

  const renderItem = (item, expired) => (
    <View
      key={item.id}
      style={[styles.itemCard, expired ? styles.itemExpired : styles.itemSoon]}
    >
      <View style={styles.itemLeft}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.itemMetaRow}>
          <Ionicons name="calendar-outline" size={12} color="#64748B" />
          <Text style={styles.itemMeta}>{t('alerts.exp')}: {formatExpiryDate(item.expiry_date)}</Text>
        </View>
        <Text style={styles.itemStock}>
          {formatQuantity(item.stock)} {item.unit || 'pcs'} {t('alerts.inStock')}
        </Text>
      </View>
      <View style={[styles.dayBadge, expired ? styles.dayBadgeExpired : styles.dayBadgeSoon]}>
        <Text style={[styles.dayBadgeText, expired ? styles.dayTextExpired : styles.dayTextSoon]}>
          {daysLabel(item.days_diff)}
        </Text>
      </View>
    </View>
  );

  const expired = data?.expired || [];
  const soon = data?.expiring_soon || [];
  const nothing = !loading && expired.length === 0 && soon.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('alerts.title')}</Text>
        <Text style={styles.subtitle}>
          {t('alerts.subtitle', { days: data?.threshold_days || 7 })}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {nothing ? (
            <View style={styles.emptyCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="checkmark-circle-outline" size={34} color="#16A34A" />
              </View>
              <Text style={styles.emptyTitle}>{t('alerts.allGood')}</Text>
              <Text style={styles.emptyDescription}>
                {t('alerts.allGoodDesc', { days: data?.threshold_days || 7 })}
              </Text>
            </View>
          ) : (
            <>
              {expired.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>
                      {t('alerts.expired')} ({expired.length})
                    </Text>
                  </View>
                  {expired.map((item) => renderItem(item, true))}
                </View>
              )}

              {soon.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="time-outline" size={18} color="#CA8A04" />
                    <Text style={[styles.sectionTitle, { color: '#CA8A04' }]}>
                      {t('alerts.expiringSoon')} ({soon.length})
                    </Text>
                  </View>
                  {soon.map((item) => renderItem(item, false))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default ExpiryAlerts;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 20, paddingTop: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    marginTop: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  emptyDescription: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  itemExpired: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  itemSoon: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  itemLeft: { flex: 1, paddingRight: 12 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  itemMeta: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  itemStock: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  dayBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  dayBadgeExpired: { backgroundColor: '#FEE2E2' },
  dayBadgeSoon: { backgroundColor: '#FEF3C7' },
  dayBadgeText: { fontSize: 12, fontWeight: '700' },
  dayTextExpired: { color: '#DC2626' },
  dayTextSoon: { color: '#CA8A04' },
});

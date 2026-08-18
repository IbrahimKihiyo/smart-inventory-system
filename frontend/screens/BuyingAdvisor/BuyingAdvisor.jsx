import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import axiosClient from '../../src/services/axiosClient';
import { useLanguage } from '../../src/context/LanguageContext';

const PRIMARY = '#4F46E5';


const BuyingAdvisor = () => {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Keyed by product_id
  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState({});
  const [checkingId, setCheckingId] = useState(null);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const response = await axiosClient.get('/purchase-recommendations');
      setItems(response.data);
    } catch (error) {
      console.error(error.response?.data || error.message);
      Toast.show({
        type: 'error',
        text1: t('toast.failedLoadProducts'),
        text2: error.response?.data?.message || error.message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setResults({});
    fetchRecommendations();
  };

  const setInput = (productId, value) => {
    // Allow digits and a single decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    setInputs((prev) => ({ ...prev, [productId]: cleaned }));
  };

  const handleCheck = async (item) => {
    const raw = inputs[item.product_id];
    if (!raw || isNaN(parseFloat(raw))) {
      Toast.show({
        type: 'error',
        text1: t('advisor.enterPrice'),
        text2: t('advisor.enterPriceMsg'),
      });
      return;
    }

    setCheckingId(item.product_id);
    try {
      const response = await axiosClient.post('/purchase-check', {
        product_id: item.product_id,
        market_price: parseFloat(raw),
      });
      setResults((prev) => ({ ...prev, [item.product_id]: response.data }));
    } catch (error) {
      console.error(error.response?.data || error.message);
      Toast.show({
        type: 'error',
        text1: t('toast.couldNotCheckPrice'),
        text2: error.response?.data?.message || error.message,
      });
    } finally {
      setCheckingId(null);
    }
  };

  const renderResult = (item) => {
    const result = results[item.product_id];
    if (!result) return null;

    if (result.suggestion === 'INSUFFICIENT_DATA') {
      return (
        <View style={[styles.resultBox, styles.resultNeutral]}>
          <Ionicons name="information-circle-outline" size={18} color="#64748B" />
          <Text style={styles.resultNeutralText}>{t('advisor.insufficient')}</Text>
        </View>
      );
    }

    const isBuy = result.suggestion === 'BUY';
    return (
      <View style={[styles.resultBox, isBuy ? styles.resultBuy : styles.resultWait]}>
        <View style={styles.resultHeader}>
          <Ionicons
            name={isBuy ? 'trending-down' : 'trending-up'}
            size={18}
            color={isBuy ? '#16A34A' : '#CA8A04'}
          />
          <Text style={[styles.resultBadge, isBuy ? styles.buyText : styles.waitText]}>
            {isBuy ? t('advisor.buyNow') : t('advisor.wait')}
          </Text>
          {isBuy && result.percent_diff > 0 && (
            <Text style={styles.savingText}>{t('advisor.belowAvg', { pct: result.percent_diff })}</Text>
          )}
        </View>
        <Text style={styles.resultMessage}>{isBuy ? t('advisor.buyMsg') : t('advisor.waitMsg')}</Text>

        <View style={styles.analysisBox}>
          {result.trend ? (
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>{t('advisor.trend')}</Text>
              <Text style={styles.analysisValue}>{t('advisor.trend' + result.trend)}</Text>
            </View>
          ) : null}
          {result.margin_at_market_price != null ? (
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>{t('advisor.marginAtPrice')}</Text>
              <Text style={styles.analysisValue}>{result.margin_at_market_price}%</Text>
            </View>
          ) : null}
          {result.recommended_max_price != null ? (
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>{t('advisor.maxBuy')}</Text>
              <Text style={styles.analysisValue}>{result.currency} {Number(result.recommended_max_price).toLocaleString()}</Text>
            </View>
          ) : null}
          {result.min_price != null ? (
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>{t('advisor.range')}</Text>
              <Text style={styles.analysisValue}>{result.currency} {Number(result.min_price).toLocaleString()} - {Number(result.max_price).toLocaleString()}</Text>
            </View>
          ) : null}
        </View>

        {result.warning ? (
          <View style={styles.warnRow}>
            <Ionicons name="alert-circle" size={15} color="#DC2626" />
            <Text style={styles.warnText}>{t('advisor.warn' + result.warning)}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('advisor.title')}</Text>
        <Text style={styles.subtitle}>
          {t('advisor.subtitle')}
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
          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>📈</Text>
              </View>
              <Text style={styles.emptyTitle}>{t('advisor.noProducts')}</Text>
              <Text style={styles.emptyDescription}>
                {t('advisor.noProductsDesc')}
              </Text>
            </View>
          ) : (
            items.map((item) => {
              const hasHistory = item.has_enough_history;
              const checking = checkingId === item.product_id;

              return (
                <View key={item.product_id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.countBadge}>
                      {item.purchase_count} {t('advisor.purchases')}
                    </Text>
                  </View>

                  <View style={styles.benchmarkRow}>
                    <View style={styles.benchmarkItem}>
                      <Text style={styles.benchmarkLabel}>{t('advisor.avgLast3')}</Text>
                      <Text style={styles.benchmarkValue}>
                        {item.average_last_three != null
                          ? `${item.currency} ${Number(item.average_last_three).toLocaleString()}`
                          : ''}
                      </Text>
                    </View>
                    <View style={styles.benchmarkDivider} />
                    <View style={styles.benchmarkItem}>
                      <Text style={styles.benchmarkLabel}>{t('advisor.lastPaid')}</Text>
                      <Text style={styles.benchmarkValue}>
                        {item.latest_price != null
                          ? `${item.currency} ${Number(item.latest_price).toLocaleString()}`
                          : ''}
                      </Text>
                    </View>
                  </View>

                  {hasHistory ? (
                    <>
                      <View style={styles.checkRow}>
                        <TextInput
                          style={styles.checkInput}
                          placeholder={t('advisor.todayPrice')}
                          placeholderTextColor="#94A3B8"
                          keyboardType="decimal-pad"
                          value={inputs[item.product_id] || ''}
                          onChangeText={(val) => setInput(item.product_id, val)}
                        />
                        <TouchableOpacity
                          style={styles.checkButton}
                          onPress={() => handleCheck(item)}
                          disabled={checking}
                          activeOpacity={0.8}
                        >
                          {checking ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.checkButtonText}>{t('advisor.check')}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                      {renderResult(item)}
                    </>
                  ) : (
                    <View style={[styles.resultBox, styles.resultNeutral]}>
                      <Ionicons name="information-circle-outline" size={18} color="#64748B" />
                      <Text style={styles.resultNeutralText}>
                        {t('advisor.needMore', { n: 3 - item.purchase_count })}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default BuyingAdvisor;

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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: { fontSize: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  emptyDescription: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  productName: { fontSize: 16, fontWeight: '700', color: '#1E293B', flex: 1, paddingRight: 8 },
  countBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  benchmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  benchmarkItem: { flex: 1, alignItems: 'center' },
  benchmarkDivider: { width: 1, height: 28, backgroundColor: '#E2E8F0' },
  benchmarkLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 4 },
  benchmarkValue: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  checkRow: { flexDirection: 'row', gap: 10 },
  checkInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  checkButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  resultBox: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  resultBuy: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  resultWait: { backgroundColor: '#FEF9C3', borderColor: '#FDE68A' },
  resultNeutral: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  resultBadge: { fontSize: 14, fontWeight: '800' },
  buyText: { color: '#16A34A' },
  waitText: { color: '#CA8A04' },
  savingText: { fontSize: 12, color: '#16A34A', fontWeight: '600', marginLeft: 'auto' },
  resultMessage: { fontSize: 13, color: '#475569', lineHeight: 19 },
  resultNeutralText: { fontSize: 13, color: '#64748B', flex: 1, lineHeight: 19 },
  analysisBox: { marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(15,23,42,0.06)', paddingTop: 8, gap: 5 },
  analysisRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  analysisLabel: { fontSize: 12, color: '#64748B' },
  analysisValue: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  warnText: { fontSize: 12, color: '#DC2626', flex: 1, fontWeight: '600' },
});

import React, { useContext, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import axiosClient from '../../src/services/axiosClient';
import DateField from '../../src/components/DateField';

const Dashboard = ({ onNavigate }) => {
  const { user } = useContext(AuthContext);
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertSummary, setAlertSummary] = useState(null);
  const [creditReminders, setCreditReminders] = useState(null);

  // Default to current date (today -> today)
  const today = new Date();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, [startDate, endDate]);

  // Load expiry alerts and credit reminders once on mount so the banners
  // appear right after login (FR06 / FR10 / NFR02)
  useEffect(() => {
    fetchAlertSummary();
    fetchCreditReminders();
  }, []);

  const fetchAlertSummary = async () => {
    try {
      const response = await axiosClient.get('/products/expiry-alerts');
      setAlertSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch expiry alerts:', error.response?.data || error.message);
    }
  };

  const fetchCreditReminders = async () => {
    try {
      const response = await axiosClient.get('/credit-reminders');
      setCreditReminders(response.data);
    } catch (error) {
      console.error('Failed to fetch credit reminders:', error.response?.data || error.message);
    }
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateLabel = (date) =>
    date
      ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

  const resetToToday = () => {
    const now = new Date();
    setStartDate(now);
    setEndDate(now);
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      const params = {};
      if (startDate) params.start_date = formatDate(startDate);
      if (endDate) params.end_date = formatDate(endDate);

      const response = await axiosClient.get('/dashboard/metrics', { params });
      if (response.data.status === 'success') {
        setMetrics(response.data.metrics);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dash.goodMorning');
    if (hour < 17) return t('dash.goodAfternoon');
    return t('dash.goodEvening');
  };

  const formatCurrency = (amount) => {
    return `TZS ${Number(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const renderDateFilter = () => (
    <View style={styles.filterContainer}>
      <DateField
        label={t('dash.from')}
        value={startDate}
        valueText={formatDateLabel(startDate)}
        onChange={setStartDate}
        maximumDate={endDate || new Date()}
        containerStyle={styles.dateBtn}
        labelStyle={styles.dateBtnLabel}
        valueStyle={styles.dateBtnValue}
      />

      <DateField
        label={t('dash.to')}
        value={endDate}
        valueText={formatDateLabel(endDate)}
        onChange={setEndDate}
        minimumDate={startDate || undefined}
        maximumDate={new Date()}
        containerStyle={styles.dateBtn}
        labelStyle={styles.dateBtnLabel}
        valueStyle={styles.dateBtnValue}
      />

      <TouchableOpacity style={styles.clearBtn} onPress={resetToToday}>
        <Ionicons name="refresh-circle" size={22} color="#4f46e5" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>

        {/* Header */}
        <View className="bg-[#4f46e5] px-6 pt-16 pb-12 rounded-b-[34px]">
          <Text className="text-indigo-100 text-xs font-bold uppercase tracking-[3px]">
            {getGreeting()}
          </Text>

          <Text className="text-white text-3xl font-black mt-1 tracking-tight">
            {user?.name || 'User'}
          </Text>
        </View>

        {/* Date Range Filter */}
        <View className="-mt-6 px-0">
          {renderDateFilter()}
        </View>

        {/* Expiry alert banner (FR06). Shows on login when stock is expired or expiring soon. */}
        {alertSummary && (alertSummary.expired_count + alertSummary.expiring_soon_count) > 0 && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onNavigate?.('Alerts')}
            className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex-row items-center"
          >
            <View className="w-10 h-10 rounded-xl bg-red-100 items-center justify-center mr-3">
              <Ionicons name="alert-circle" size={22} color="#DC2626" />
            </View>
            <View className="flex-1">
              <Text className="text-red-600 text-[10px] font-bold uppercase tracking-wider">
                {t('dash.expiryAlerts')}
              </Text>
              <Text className="text-slate-900 font-black text-sm mt-1">
                {t('dash.expiredExpiring', { expired: alertSummary.expired_count, soon: alertSummary.expiring_soon_count })}
              </Text>
              <Text className="text-slate-500 text-xs mt-1">
                {t('dash.tapReviewStock')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* Credit reminder banner (FR10). Reminds the owner of overdue debts on login. */}
        {creditReminders && (creditReminders.overdue_count + creditReminders.due_soon_count) > 0 && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onNavigate?.('Creditors')}
            className="mx-6 mt-4 bg-orange-50 border border-orange-200 rounded-2xl p-4 flex-row items-center"
          >
            <View className="w-10 h-10 rounded-xl bg-orange-100 items-center justify-center mr-3">
              <Ionicons name="cash-outline" size={22} color="#B45309" />
            </View>
            <View className="flex-1">
              <Text className="text-orange-600 text-[10px] font-bold uppercase tracking-wider">
                {t('dash.creditReminders')}
              </Text>
              <Text className="text-slate-900 font-black text-sm mt-1">
                {t('dash.overdueDueSoon', { overdue: creditReminders.overdue_count, soon: creditReminders.due_soon_count })}
              </Text>
              <Text className="text-slate-500 text-xs mt-1">
                {t('dash.tapFollowUp')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* Loading */}
        {loading ? (
          <View className="pt-24 items-center justify-center">
            <ActivityIndicator size="small" color="#4f46e5" />
          </View>
        ) : (
          metrics && (
            <View className="mt-2">

              {/* ================= PURCHASE CARD ================= */}
              <View className="mx-6 bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      {t('dash.totalSales')}
                    </Text>
                    <Text className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
                      {formatCurrency(metrics.total_amount_tzs)}
                    </Text>
                  </View>

                  <View className="w-12 h-12 rounded-2xl bg-indigo-50 items-center justify-center">
                    <View className="w-4 h-4 rounded-full bg-[#4f46e5]" />
                  </View>
                </View>
              </View>

              {/* ================= PROFIT CARD (FIXED POSITION) ================= */}
              <View className="mx-6 mt-4 bg-white rounded-[28px] p-6 border border-green-100 shadow-sm">
                <Text className="text-green-600 text-[10px] font-bold uppercase tracking-wider">
                  {t('dash.totalProfit')}
                </Text>

                <Text className="text-3xl font-black text-slate-900 mt-2">
                  {formatCurrency(metrics.total_profit)}
                </Text>

                <Text className="text-slate-400 text-xs mt-2">
                  {t('dash.profitSub')}
                </Text>
              </View>

              {/* ================= NET PROFIT CARD ================= */}
              <View className="mx-6 mt-4 bg-white rounded-[28px] p-6 border border-indigo-100 shadow-sm">
                <Text className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider">
                  {t('dash.netProfit')}
                </Text>
                <Text className="text-3xl font-black text-slate-900 mt-2">
                  {formatCurrency(metrics.net_profit)}
                </Text>
                <View className="flex-row justify-between mt-3">
                  <Text className="text-slate-400 text-xs">{t('dash.netProfitSub')}</Text>
                  <Text className="text-slate-500 text-xs font-semibold">
                    {t('dash.totalExpenses')}: {formatCurrency(metrics.total_expenses)}
                  </Text>
                </View>
              </View>

              {/* ================= STATS CARDS ================= */}
              <View className="px-6 mt-6 flex-row justify-between">
                <View className="w-[48%] bg-white rounded-2xl border border-slate-100 p-4">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    {t('dash.volumeSold')}
                  </Text>
                  <Text className="text-2xl font-black text-slate-900 mt-2">
                    {metrics.total_quantity_sold.toLocaleString()}
                  </Text>
                  <Text className="text-slate-500 text-xs mt-2">
                    {t('dash.unitsMoved')}
                  </Text>
                </View>

                <View className="w-[48%] bg-white rounded-2xl border border-slate-100 p-4">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    {t('dash.totalOrders')}
                  </Text>
                  <Text className="text-2xl font-black text-slate-900 mt-2">
                    {metrics.total_transactions.toLocaleString()}
                  </Text>
                  <Text className="text-slate-500 text-xs mt-2">
                    {t('dash.completedTx')}
                  </Text>
                </View>
              </View>

              {/* ================= PENDING CREDIT ================= */}
              <View className="px-6 mt-4">
                <View className="bg-white rounded-2xl border border-orange-100 p-4 shadow-sm">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-orange-500 text-[10px] font-bold uppercase tracking-wider">
                        {t('dash.pendingCredit')}
                      </Text>
                      <Text className="text-2xl font-black text-slate-900 mt-1">
                        {formatCurrency(metrics.pending_credit_amount_tzs || 0)}
                      </Text>
                      <Text className="text-slate-500 text-xs mt-1">
                        {t('dash.pendingCreditSub')}
                      </Text>
                    </View>

                    <View className="w-10 h-10 rounded-xl bg-orange-50 items-center justify-center">
                      <View className="w-3 h-3 rounded-full bg-orange-500" />
                    </View>
                  </View>
                </View>
              </View>

              {/* ================= TOP PRODUCTS ================= */}
              <View className="px-6 mt-8">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-slate-900 text-lg font-black tracking-tight">
                    {t('dash.topProducts')}
                  </Text>
                  <View className="h-2 w-2 rounded-full bg-[#4f46e5]" />
                </View>

                {metrics.top_products.length > 0 ? (
                  <View className="space-y-3">
                    {metrics.top_products.map((product, index) => (
                      <View
                        key={index}
                        className="bg-white rounded-2xl border border-slate-100 px-4 py-4"
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center flex-1 pr-3">
                            <View className="w-10 h-10 rounded-2xl bg-indigo-50 items-center justify-center mr-3">
                              <Text className="text-[#4f46e5] font-black text-xs">
                                {index + 1}
                              </Text>
                            </View>

                            <View className="flex-1">
                              <Text className="text-slate-800 font-semibold text-sm" numberOfLines={1}>
                                {product.name}
                              </Text>
                              <Text className="text-slate-400 text-xs mt-1">
                                {t('dash.topSelling')}
                              </Text>
                            </View>
                          </View>

                          <View className="items-end">
                            <Text className="text-slate-900 font-black text-sm">
                              {product.total_sold.toLocaleString()}
                            </Text>
                            <Text className="text-slate-500 text-xs mt-1">
                              {t('dash.units')}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="bg-white rounded-2xl border border-slate-100 py-8 items-center">
                    <Text className="text-slate-400 text-xs font-medium">
                      {t('dash.noMetrics')}
                    </Text>
                  </View>
                )}
              </View>

            </View>
          )
        )}

      </ScrollView>
    </View>
  );
};

export default Dashboard;

const styles = StyleSheet.create({
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dateBtn: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateBtnLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 4,
  },
  dateBtnValue: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  clearBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
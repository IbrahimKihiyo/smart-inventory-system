import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../../src/services/axiosClient';
import { useLanguage } from '../../src/context/LanguageContext';

const PRIMARY = '#4F46E5';
const LOW_STOCK_LEVEL = 10;

// A simple bilingual assistant. It reads the shop's own data through the
// existing endpoints and answers common questions, so the owner can make
// quick decisions without opening several screens.
export default function AssistantChat() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    setMessages([{ id: 'welcome', from: 'bot', text: t('bot.greeting') }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, busy]);

  const push = (from, text) =>
    setMessages((prev) => [...prev, { id: String(Date.now()) + Math.random(), from, text }]);

  const money = (n) => `TZS ${Number(n || 0).toLocaleString()}`;

  const asList = (data) =>
    Array.isArray(data) ? data : data?.data || data?.products || data?.categories || [];

  // Pull the shop's key figures together so advice can reason across them.
  const gatherContext = async () => {
    const [mRes, eRes, pRes] = await Promise.all([
      axiosClient.get('/dashboard/metrics'),
      axiosClient.get('/products/expiry-alerts'),
      axiosClient.get('/products'),
    ]);
    const metrics = mRes.data.metrics || {};
    const expired = eRes.data.expired || [];
    const soon = eRes.data.expiring_soon || [];
    const products = asList(pRes.data);
    const lowStock = products.filter((p) => Number(p.stock) <= LOW_STOCK_LEVEL);
    const thinMargin = products.filter((p) => {
      const price = Number(p.price) || 0;
      const buy = Number(p.buying_price) || 0;
      return price > 0 && buy > 0 && (price - buy) / price < 0.2;
    });
    const bestSeller = (metrics.top_products || [])[0];
    return { metrics, expired, soon, products, lowStock, thinMargin, bestSeller };
  };

  // Smart analytics computed on the server: demand forecast, reorder point,
  // and anomaly detection, all from the shop's own sales history.
  const getAnalytics = async () => (await axiosClient.get('/analytics/insights')).data.analytics;

  // Turn the figures into concrete, ranked actions the owner can take.
  const buildAdvice = (ctx) => {
    const tips = [];
    if (ctx.bestSeller) tips.push(t('advice.pushBestSeller', { name: ctx.bestSeller.name, sold: ctx.bestSeller.total_sold }));
    if (ctx.soon.length) tips.push(t('advice.sellExpiring', { count: ctx.soon.length, items: ctx.soon.map((p) => p.name).join(', ') }));
    if (ctx.expired.length) tips.push(t('advice.removeExpired', { count: ctx.expired.length, items: ctx.expired.map((p) => p.name).join(', ') }));
    if (ctx.lowStock.length) tips.push(t('advice.restockLow', { count: ctx.lowStock.length, items: ctx.lowStock.map((p) => p.name).join(', ') }));
    if (Number(ctx.metrics.pending_credit_amount_tzs) > 0) tips.push(t('advice.collectCredit', { amount: money(ctx.metrics.pending_credit_amount_tzs) }));
    if (ctx.thinMargin.length) tips.push(t('advice.thinMargin', { items: ctx.thinMargin.slice(0, 5).map((p) => p.name).join(', ') }));
    if (tips.length === 0) tips.push(t('advice.allGood'));
    return t('advice.header') + '\n' + tips.join('\n');
  };

  const detectIntent = (raw) => {
    const s = (raw || '').toLowerCase();
    const has = (...keys) => keys.some((k) => s.includes(k));
    if (has('help', 'what can you', 'msaada', 'unaweza', 'unafanya', 'nisaidie')) return 'help';
    if (has('hello', 'hi ', 'hey', 'habari', 'mambo', 'vipi', 'hujambo', 'salama', 'shikamoo')) return 'greeting';
    if (has('forecast', 'predict', 'future', 'next week', 'demand', 'expect', 'will i sell', 'utabiri', 'baadaye', 'wiki ijayo', 'mahitaji', 'nitauza', 'matarajio')) return 'forecast';
    if (has('anomaly', 'unusual', 'abnormal', 'strange', 'spike', 'sudden', 'odd day', 'isiyo ya kawaida', 'isivyo kawaida', 'ghafla', 'mshtuko', 'tofauti kubwa')) return 'anomaly';
    if (has('buy', 'purchase', 'buying advice', 'should i buy', 'worth buying', 'good price', 'market price', 'nunua', 'kununua', 'manunuzi', 'bei ya soko', 'wakati wa kununua')) return 'buying';
    if (has('most profit', 'most profitable', 'highest profit', 'best margin', 'faida zaidi', 'faida kubwa', 'inayoleta faida', 'zenye faida')) return 'mostProfitable';
    if (has('how is my business', 'business doing', 'business summary', 'how is business', 'hali ya biashara', 'biashara inaendelea', 'biashara yangu', 'muhtasari')) return 'businessHealth';
    if (has('increase', 'improve', 'grow', 'more profit', 'more sales', 'boost', 'how do i', 'how can i', 'how to', 'what should i do', 'what do i do', 'advice', 'recommend', 'suggest', 'kuongeza', 'ongeza faida', 'ongeza mauzo', 'boresha', 'nifanyaje', 'nifanye nini', 'ushauri', 'nishauri', 'pendekezo', 'nikuze')) return 'advice';
    if (has('slow', 'not selling', 'not sold', 'dead stock', 'unsold', 'stuck', 'hazitembei', 'hazijauzwa', 'zisizouzwa', 'mtaji uliolala', 'zilizokwama')) return 'slowMovers';
    if (has('reorder', 're-order', 'how much to order', 'how much to restock', 'restock', 'order more', 'niagize', 'kiasi cha kuagiza', 'ninunue kiasi', 'niongeze stoo')) return 'reorder';
    if (has('expir', 'expire', 'kuisha', 'zinazoisha', 'muda wa')) return 'expiry';
    if (has('low stock', 'out of stock', 'running low', 'hisa', 'stoo', 'pungufu', 'zinakwisha')) return 'lowstock';
    if (has('debt', 'credit', 'owe', 'borrow', 'deni', 'madeni', 'wadeni', 'mkopo', 'nadai', 'ananidai')) return 'creditors';
    if (has('spend', 'spent', 'expense', 'expenses', 'matumizi', 'nimetumia', 'nilitumia', 'gharama')) return 'expenses';
    if (has('profit', 'faida')) return 'profit';
    if (has('sale', 'sales', 'sold', 'revenue', 'mauzo', 'uza')) return 'sales';
    if (has('top', 'best', 'most sold', 'popular', 'zaidi', 'bora', 'inayouzwa')) return 'top';
    if (has('how many product', 'number of product', 'bidhaa ngapi', 'idadi', 'product', 'bidhaa', 'categor', 'kategoria')) return 'inventory';
    return 'fallback';
  };

  const answer = async (intent, userText = '') => {
    switch (intent) {
      case 'help':
        return t('bot.help');
      case 'greeting':
        return t('bot.greetingReply');
      case 'sales': {
        const m = (await axiosClient.get('/dashboard/metrics')).data.metrics;
        return t('bot.salesAnswer', {
          amount: money(m.total_amount_tzs),
          count: m.total_transactions,
          qty: m.total_quantity_sold,
        });
      }
      case 'profit': {
        const m = (await axiosClient.get('/dashboard/metrics')).data.metrics;
        return t('bot.profitAnswer', { profit: money(m.total_profit) });
      }
      case 'expenses': {
        const m = (await axiosClient.get('/dashboard/metrics')).data.metrics;
        return t('bot.expensesAnswer', { spent: money(m.total_expenses), net: money(m.net_profit) });
      }
      case 'creditors': {
        const m = (await axiosClient.get('/dashboard/metrics')).data.metrics;
        return t('bot.creditAnswer', { amount: money(m.pending_credit_amount_tzs) });
      }
      case 'expiry': {
        const d = (await axiosClient.get('/products/expiry-alerts')).data;
        const expired = d.expired || [];
        const soon = d.expiring_soon || [];
        if (expired.length === 0 && soon.length === 0) return t('bot.noExpiry');
        const parts = [];
        if (expired.length) parts.push(t('bot.expiredList', { items: expired.map((p) => p.name).join(', ') }));
        if (soon.length) parts.push(t('bot.soonList', { items: soon.map((p) => `${p.name} (${p.days_diff})`).join(', ') }));
        return parts.join('\n');
      }
      case 'lowstock': {
        const products = asList((await axiosClient.get('/products')).data);
        const low = products.filter((p) => Number(p.stock) <= LOW_STOCK_LEVEL);
        if (low.length === 0) return t('bot.noLowStock');
        return t('bot.lowStockList', { items: low.map((p) => `${p.name} (${p.stock})`).join(', ') });
      }
      case 'top': {
        const m = (await axiosClient.get('/dashboard/metrics')).data.metrics;
        const top = m.top_products || [];
        if (top.length === 0) return t('bot.noTop');
        return t('bot.topList', { items: top.slice(0, 5).map((p) => `${p.name} (${p.total_sold})`).join(', ') });
      }
      case 'inventory': {
        const products = asList((await axiosClient.get('/products')).data);
        const categories = asList((await axiosClient.get('/categories')).data);
        return t('bot.inventoryAnswer', { products: products.length, categories: categories.length });
      }
      case 'advice':
        return buildAdvice(await gatherContext());
      case 'mostProfitable': {
        const ranked = asList((await axiosClient.get('/products')).data)
          .map((p) => ({ name: p.name, margin: (Number(p.price) || 0) - (Number(p.buying_price) || 0) }))
          .filter((p) => p.margin > 0)
          .sort((a, b) => b.margin - a.margin)
          .slice(0, 5);
        if (!ranked.length) return t('advice.noMargin');
        return t('advice.marginHeader', { items: ranked.map((p) => `${p.name} (${money(p.margin)})`).join(', ') });
      }
      case 'businessHealth': {
        const ctx = await gatherContext();
        const m = ctx.metrics;
        const summary = t('advice.health', {
          sales: money(m.total_amount_tzs),
          profit: money(m.total_profit),
          credit: money(m.pending_credit_amount_tzs),
          low: ctx.lowStock.length,
          expiring: ctx.soon.length + ctx.expired.length,
        });
        return summary + (Number(m.total_profit) > 0 ? t('advice.healthGood') : t('advice.healthWatch'));
      }
      case 'reorder': {
        // Reorder point = average daily demand x lead time + safety stock (server side).
        const a = await getAnalytics();
        const list = a?.reorder || [];
        if (!list.length) return t('advice.noReorder');
        const items = list
          .slice(0, 8)
          .map((p) => `${p.name}: ${p.suggested_order_qty}`)
          .join(', ');
        return t('advice.reorder', { items });
      }
      case 'forecast': {
        const a = await getAnalytics();
        const list = a?.forecasts || [];
        if (!list.length) return t('advice.noForecast');
        const items = list
          .slice(0, 6)
          .map((p) => t('advice.forecastItem', { name: p.name, qty: p.forecast_next_7, days: p.days_cover }))
          .join('\n');
        return t('advice.forecastHeader', { days: a.period_days }) + '\n' + items;
      }
      case 'anomaly': {
        const a = await getAnalytics();
        const days = a?.anomalies?.days || [];
        if (!days.length) return t('advice.noAnomaly');
        const items = days
          .map((d) => t('advice.anomalyItem', {
            date: d.date,
            amount: money(d.amount),
            pct: d.deviation_pct,
            kind: t(d.type === 'HIGH' ? 'advice.anomalyHigh' : 'advice.anomalyLow'),
          }))
          .join('\n');
        return t('advice.anomalyHeader') + '\n' + items;
      }
      case 'buying': {
        // Buying advice (the former Buying Advisor, now inside the assistant).
        // If the message names a product and a price, run the decision engine;
        // otherwise show the recent buying benchmarks for all products.
        const products = asList((await axiosClient.get('/products')).data);
        const lower = (userText || '').toLowerCase();
        const nums = (userText.match(/[\d][\d,]*(?:\.\d+)?/g) || [])
          .map((s) => parseFloat(s.replace(/,/g, '')))
          .filter((n) => !isNaN(n) && n > 0);
        const price = nums.length ? Math.max(...nums) : null;
        const match = products.find((p) => p.name && lower.includes(String(p.name).toLowerCase()));

        if (match && price) {
          const r = (await axiosClient.post('/purchase-check', { product_id: match.id, market_price: price })).data;
          if (r.suggestion === 'INSUFFICIENT_DATA') return t('buy.insufficient', { name: match.name });
          const verdict = r.suggestion === 'BUY' ? t('buy.yes') : t('buy.wait');
          const lines = [t('buy.head', { name: match.name, price: money(r.market_price), verdict })];
          lines.push(t('buy.avg', { avg: money(r.average_last_three), trend: t('buy.trend' + r.trend) }));
          if (r.recommended_max_price) lines.push(t('buy.maxbuy', { max: money(r.recommended_max_price) }));
          if (r.margin_at_market_price !== null && r.margin_at_market_price !== undefined) {
            lines.push(t('buy.margin', { pct: r.margin_at_market_price }));
          }
          if (r.warning === 'LOSS') lines.push(t('buy.warnLoss'));
          else if (r.warning === 'THIN') lines.push(t('buy.warnThin'));
          return lines.join('\n');
        }

        const recs = asList((await axiosClient.get('/purchase-recommendations')).data)
          .filter((p) => p.average_last_three);
        if (!recs.length) return t('buy.noData');
        const items = recs
          .slice(0, 8)
          .map((p) => t('buy.recItem', {
            name: p.name,
            avg: money(p.average_last_three),
            latest: p.latest_price != null ? money(p.latest_price) : '-',
          }))
          .join('\n');
        return t('buy.recHead') + '\n' + items + '\n' + t('buy.recTip');
      }
      case 'slowMovers': {
        // Look back 30 days so "not selling" is meaningful, not just today.
        const start = new Date();
        start.setDate(start.getDate() - 30);
        const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const [pRes, mRes] = await Promise.all([
          axiosClient.get('/products'),
          axiosClient.get('/dashboard/metrics', { params: { start_date: ymd(start), end_date: ymd(new Date()) } }),
        ]);
        const products = asList(pRes.data);
        const soldNames = new Set((mRes.data.metrics.top_products || []).map((x) => x.name));
        const slow = products
          .filter((p) => Number(p.stock) > 0 && !soldNames.has(p.name))
          .map((p) => ({ name: p.name, value: Number(p.stock) * (Number(p.buying_price) || 0) }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6);
        if (!slow.length) return t('advice.noSlow');
        return t('advice.slowMovers', { items: slow.map((p) => `${p.name} (${money(p.value)})`).join(', ') });
      }
      default:
        return t('bot.fallback');
    }
  };

  const respond = async (intent, userText) => {
    if (busy) return;
    push('user', userText);
    setBusy(true);
    try {
      push('bot', await answer(intent, userText));
    } catch (error) {
      console.error(error.response?.data || error.message);
      push('bot', t('bot.error'));
    } finally {
      setBusy(false);
    }
  };

  const sendTyped = () => {
    const q = input.trim();
    if (!q) return;
    setInput('');
    respond(detectIntent(q), q);
  };

  const chips = [
    { key: 'advice', label: t('bot.chipAdvice') },
    { key: 'sales', label: t('bot.chipSales') },
    { key: 'profit', label: t('bot.chipProfit') },
    { key: 'mostProfitable', label: t('bot.chipMostProfit') },
    { key: 'buying', label: t('bot.chipBuying') },
    { key: 'expiry', label: t('bot.chipExpiry') },
    { key: 'lowstock', label: t('bot.chipLowStock') },
    { key: 'forecast', label: t('bot.chipForecast') },
    { key: 'reorder', label: t('bot.chipReorder') },
    { key: 'anomaly', label: t('bot.chipAnomaly') },
    { key: 'slowMovers', label: t('bot.chipSlow') },
    { key: 'creditors', label: t('bot.chipCreditors') },
    { key: 'expenses', label: t('bot.chipExpenses') },
    { key: 'inventory', label: t('bot.chipInventory') },
    { key: 'businessHealth', label: t('bot.chipHealth') },
  ];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.messages}>
        {messages.map((m) => (
          <View key={m.id} style={[styles.row, m.from === 'user' ? styles.rowRight : styles.rowLeft]}>
            {m.from === 'bot' && (
              <View style={styles.avatar}><Ionicons name="sparkles" size={15} color="#fff" /></View>
            )}
            <View style={[styles.bubble, m.from === 'user' ? styles.userBubble : styles.botBubble]}>
              <Text style={m.from === 'user' ? styles.userText : styles.botText}>{m.text}</Text>
            </View>
          </View>
        ))}
        {busy && (
          <View style={[styles.row, styles.rowLeft]}>
            <View style={styles.avatar}><Ionicons name="sparkles" size={15} color="#fff" /></View>
            <View style={[styles.bubble, styles.botBubble]}><ActivityIndicator size="small" color={PRIMARY} /></View>
          </View>
        )}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
        {chips.map((c) => (
          <TouchableOpacity key={c.key} style={styles.chip} onPress={() => respond(c.key, c.label)} disabled={busy}>
            <Text style={styles.chipText}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t('bot.placeholder')}
          placeholderTextColor="#94A3B8"
          onSubmitEditing={sendTyped}
          editable={!busy}
          returnKeyType="send"
        />
        <TouchableOpacity style={[styles.sendBtn, busy && { opacity: 0.5 }]} onPress={sendTyped} disabled={busy}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  messages: { padding: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  avatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  botBubble: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: PRIMARY, borderBottomRightRadius: 4 },
  botText: { fontSize: 14, color: '#0F172A', lineHeight: 20 },
  userText: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
  chipsRow: { maxHeight: 46, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  chip: {
    backgroundColor: '#EEF2FF', borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  chipText: { color: PRIMARY, fontSize: 13, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 24, paddingHorizontal: 16,
    height: 44, fontSize: 14, color: '#0F172A',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
});

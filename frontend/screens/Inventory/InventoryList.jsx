import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import axiosClient from '../../src/services/axiosClient';
import AddProductModal from './Modal/AddProductModal';
import EditProductModal from './Modal/EditProductModal';
import Toast from 'react-native-toast-message';
import PawaPayModal from './Modal/PawaPayModal';
import CreditModal from './Modal/CreditModal';
import RecordPurchaseModal from './Modal/RecordPurchaseModal';
import { useLanguage } from '../../src/context/LanguageContext';

const PRIMARY = '#4F46E5';

// Step used when incrementing/decrementing quantity for decimal-enabled products (e.g. kg, l)
const DECIMAL_STEP = 0.25;

const InventoryList = () => {
  const { t } = useLanguage();
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [pawaPayVisible, setPawaPayVisible] = useState(false);
  const [creditModalVisible, setCreditModalVisible] = useState(false);
  const [cashConfirmVisible, setCashConfirmVisible] = useState(false);
  const [recordModalVisible, setRecordModalVisible] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [purchaseProduct, setPurchaseProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [qtyInputs, setQtyInputs] = useState({}); // raw text being typed per product
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const [cashLoading, setCashLoading] = useState(false);
  const [cashPreviewLoading, setCashPreviewLoading] = useState(false);
  const [cashPendingItems, setCashPendingItems] = useState([]);
  const [cashPendingTotalTZS, setCashPendingTotalTZS] = useState(0);

  const lowStockThreshold = 10;

  const formatExpiryDate = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split(/[T ]/);
    const datePart = parts[0];
    const timePart = parts[1];
    const [year, month, day] = datePart.split('-');
    const date = new Date(year, month - 1, day);
    const monthName = date.toLocaleString('en-US', { month: 'long' });
    const paddedDay = String(day).padStart(2, '0');
    const formattedDate = `${year}, ${monthName} ${paddedDay}`;
    if (timePart) {
      const [hoursStr, minutesStr] = timePart.split(':');
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const paddedMinutes = String(minutes).padStart(2, '0');
        return `${formattedDate} at ${hours}:${paddedMinutes} ${ampm}`;
      }
    }
    return formattedDate;
  };

  const checkIsExpired = (dateString) => {
    if (!dateString) return false;

    const parts = dateString.split(/[T ]/);
    const datePart = parts[0];
    const timePart = parts[1];

    if (!datePart) return false;

    const [year, month, day] = datePart.split('-').map(Number);

    let hours = 0, minutes = 0, seconds = 0;
    if (timePart) {
      const timeBits = timePart.split(':').map(Number);
      hours = timeBits[0] || 0;
      minutes = timeBits[1] || 0;
      seconds = timeBits[2] || 0;
    }

    const expiryDate = new Date(year, month - 1, day, hours, minutes, seconds);
    const currentTime = new Date();

    return expiryDate.getTime() <= currentTime.getTime();
  };

  // Format a quantity for display, trimming trailing zeros for decimal-enabled products
  const formatQuantity = (value) => {
    const num = Number(value) || 0;
    // Always parse to float to keep up to 2 decimal places
    return parseFloat(num.toFixed(2)).toString();
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get('/products');
      console.log(response.data);
      setProducts(response.data);
    } catch (error) {
      console.error(error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSaved = (newProduct) => {
    setProducts((prev) => [newProduct, ...prev]);
  };

  const handleProductUpdated = (updatedProduct) => {
    setProducts((prev) =>
      prev.map((item) => (item.id === updatedProduct.id ? updatedProduct : item))
    );
  };

  const handleEditPress = (product) => {
    setSelectedProduct(product);
    setEditModalVisible(true);
  };

  const handleRecordPurchase = (product) => {
    setPurchaseProduct(product);
    setRecordModalVisible(true);
  };

  // A purchase tops up stock, so replace the product with the fresh copy from the API
  const handlePurchaseRecorded = (updatedProduct) => {
    setProducts((prev) =>
      prev.map((item) => (item.id === updatedProduct.id ? updatedProduct : item))
    );
  };

  const confirmDelete = (id, name) => {
    Alert.alert(
      t('inv.deleteTitle'),
      t('inv.deleteMsg', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('inv.delete'), style: 'destructive', onPress: () => deleteProduct(id) },
      ]
    );
  };

  const deleteProduct = async (id) => {
    try {
      setDeletingId(id);
      await axiosClient.delete(`/products/${id}`);
      setProducts((prev) => prev.filter((item) => item.id !== id));
      setCart((prev) => {
        const newCart = { ...prev };
        delete newCart[id];
        return newCart;
      });
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Product removed successfully.' });
    } catch (error) {
      console.error(error.response?.data || error.message);
      Alert.alert('Error', 'Could not delete product. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Updates quantity, using a decimal step for products that allow decimal stock
  const updateQuantity = (product, direction) => {
    const step = product.allow_decimal ? DECIMAL_STEP : 1;
    const delta = direction * step;

    setCart((prev) => {
      const currentQty = prev[product.id] || 0;
      let newQty = currentQty + delta;

      // Round to avoid floating point artifacts (e.g. 0.1 + 0.2)
      newQty = Math.round(newQty * 100) / 100;

      // Clamp to available stock
      const maxStock = Number(product.stock) || 0;
      if (newQty > maxStock) newQty = maxStock;

      if (newQty <= 0) {
        const newCart = { ...prev };
        delete newCart[product.id];
        return newCart;
      }
      return { ...prev, [product.id]: newQty };
    });
    // A button press overrides whatever was half-typed in the field
    clearQtyInput(product.id);
  };

  const clearQtyInput = (id) =>
    setQtyInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  // Lets the user type the quantity directly, clamped to available stock
  const handleQtyInput = (product, text) => {
    const cleaned = product.allow_decimal
      ? text.replace(/[^0-9.]/g, '')
      : text.replace(/[^0-9]/g, '');

    setQtyInputs((prev) => ({ ...prev, [product.id]: cleaned }));

    if (cleaned === '' || cleaned === '.') {
      setCart((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      return;
    }

    let num = parseFloat(cleaned);
    if (isNaN(num)) return;

    const maxStock = Number(product.stock) || 0;
    if (num > maxStock) {
      num = maxStock;
      setQtyInputs((prev) => ({ ...prev, [product.id]: String(num) }));
    }
    if (!product.allow_decimal) num = Math.floor(num);

    setCart((prev) => {
      if (num <= 0) {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }
      return { ...prev, [product.id]: num };
    });
  };

  const convertAmountToTZS = async (amount, fromCurrency) => {
    if (!fromCurrency || fromCurrency === 'TZS') return amount;

    const response = await axiosClient.get('/exchange-rate', {
      params: {
        from: fromCurrency,
        to: 'TZS',
        amount,
      },
    });

    return Number(
      response.data?.converted_amount ??
        response.data?.data?.converted_amount ??
        response.data?.amount ??
        response.data?.data?.amount ??
        response.data?.result?.converted_amount ??
        amount
    );
  };

  const buildCashTransaction = async () => {
    const items = await Promise.all(
      cartProducts.map(async (p) => {
        const quantity = cart[p.id];
        const originalSubtotal = p.price * quantity;
        const productCurrency = p.currency || 'TZS';

        const subtotalTZS = await convertAmountToTZS(originalSubtotal, productCurrency);

        const convertedUnitPrice = quantity > 0 ? subtotalTZS / quantity : subtotalTZS;

        return {
          product_id: p.id,
          quantity,
          unit_price: Number(convertedUnitPrice.toFixed(2)),
          currency: 'TZS',
          subtotal_tzs: subtotalTZS,
        };
      })
    );

    const totalInTZS = items.reduce(
      (sum, item) => sum + Number(item.subtotal_tzs || 0),
      0
    );

    return { items, totalInTZS };
  };

  const handlePaymentSuccess = async () => {
    setPawaPayVisible(false);
    setCart({});
    await fetchProducts();
    Toast.show({
      type: 'success',
      text1: 'Payment Complete',
      text2: 'Cart cleared and inventory refreshed.',
    });
  };

  const handleCashSuccess = async () => {
    setCart({});
    await fetchProducts();
    Toast.show({
      type: 'success',
      text1: 'Cash Payment Recorded',
      text2: 'Cart cleared and inventory refreshed.',
    });
  };

  const handleCreditSuccess = async () => {
    setCreditModalVisible(false);
    setCart({});
    await fetchProducts();
    Toast.show({
      type: 'success',
      text1: 'Credit Sale Recorded',
      text2: 'Borrower info saved. Cart cleared.',
    });
  };

  const handleCashCheckout = async () => {
    try {
      setCashPreviewLoading(true);
      const { items, totalInTZS } = await buildCashTransaction();
      setCashPendingItems(items);
      setCashPendingTotalTZS(totalInTZS);
      setCashConfirmVisible(true);
    } catch (error) {
      console.error(error.response?.data || error.message);
      Alert.alert('Error', 'Could not prepare cash payment. Please try again.');
    } finally {
      setCashPreviewLoading(false);
    }
  };

  const handleConfirmCashPayment = async () => {
    try {
      setCashLoading(true);

      await axiosClient.post('/transactions/cash', {
        items: cashPendingItems,
        amount: cashPendingTotalTZS,
        currency: 'TZS',
      });

      setCashConfirmVisible(false);
      setCashPendingItems([]);
      setCashPendingTotalTZS(0);

      await handleCashSuccess();
    } catch (error) {
      console.error(error.response?.data || error.message);
      Alert.alert('Error', 'Could not record cash payment. Please try again.');
    } finally {
      setCashLoading(false);
    }
  };

  const closeCashModal = () => {
    if (cashLoading) return;
    setCashConfirmVisible(false);
    setCashPendingItems([]);
    setCashPendingTotalTZS(0);
  };

  const cartProducts = products.filter((p) => cart[p.id] > 0);
  const uniqueCurrenciesInCart = [...new Set(cartProducts.map((p) => p.currency || 'TZS'))];
  const isMixedCurrency = uniqueCurrenciesInCart.length > 1;
  const creditCurrency = isMixedCurrency ? 'TZS' : (uniqueCurrenciesInCart[0] || 'TZS');

  const rawTotalAmount = cartProducts.reduce((total, product) => {
    return total + product.price * cart[product.id];
  }, 0);

  const displayTotalLabel = isMixedCurrency
    ? 'Mixed Currencies → TZS'
    : `${uniqueCurrenciesInCart[0] || 'TZS'} ${rawTotalAmount.toLocaleString()}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('inv.title')}</Text>
          <Text style={styles.subtitle}>{t('inv.subtitle')}</Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.8}
          onPress={() => setProductModalVisible(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>{t('inv.product')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('inv.search')}
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>{searchQuery ? '🔍' : '📦'}</Text>
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? t('inv.noResults') : t('inv.noItems')}
              </Text>
              <Text style={styles.emptyDescription}>
                {searchQuery
                  ? t('inv.noMatch', { q: searchQuery })
                  : t('inv.emptyDesc')}
              </Text>
            </View>
          ) : (
            filteredProducts.map((item) => {
              const qty = cart[item.id] || 0;
              const isExpired = checkIsExpired(item.expiry_date);
              const canIncrement = qty < Number(item.stock) && !isExpired;

              return (
                <View key={item.id} style={styles.productCard}>
                  <View style={styles.cardHeader}>
                    {/* Product thumbnail */}
                    <View style={styles.thumbnailWrapper}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
                      ) : (
                        <View style={styles.thumbnailPlaceholder}>
                          <Ionicons name="cube-outline" size={22} color="#94A3B8" />
                        </View>
                      )}
                    </View>

                    <View style={styles.mainInfo}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.subInfoRow}>
                        <Text style={styles.productSku}>{item.sku || 'N/A'}</Text>
                        {item.expiry_date && (
                          <View style={styles.expiryContainer}>
                            <Ionicons name="calendar-outline" size={12} color={isExpired ? "#DC2626" : "#4169E1"} />
                            <Text style={[styles.expiryText, isExpired && { color: '#DC2626' }]}>
                              Exp: {formatExpiryDate(item.expiry_date)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.rightActions}>
                      <Text style={styles.productPrice}>
                        {item.currency || 'TZS'} {Number(item.price).toLocaleString()}
                      </Text>
                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                          onPress={() => handleRecordPurchase(item)}
                          activeOpacity={0.6}
                          style={styles.purchaseButton}
                          disabled={deletingId === item.id}
                        >
                          <Ionicons name="pricetags-outline" size={16} color="#0EA5E9" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleEditPress(item)}
                          activeOpacity={0.6}
                          style={styles.editButton}
                          disabled={deletingId === item.id}
                        >
                          <Ionicons name="create-outline" size={16} color={PRIMARY} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmDelete(item.id, item.name)}
                          activeOpacity={0.6}
                          style={styles.deleteButton}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <Ionicons name="trash-outline" size={16} color="#DC2626" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.badgesRow}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {item.category?.name || t('inv.uncategorized')}
                        </Text>
                      </View>

                      {isExpired && (
                        <View style={[styles.categoryBadge, styles.expiredBadge]}>
                          <Text style={[styles.categoryBadgeText, styles.expiredText]}>
                            ⚠ {t('inv.expired')}
                          </Text>
                        </View>
                      )}

                      {!isExpired && (
                        <View
                          style={[
                            styles.categoryBadge,
                            item.stock <= lowStockThreshold
                              ? styles.lowStockBadge
                              : styles.inStockBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryBadgeText,
                              item.stock <= lowStockThreshold
                                ? styles.lowStockText
                                : styles.inStockText,
                            ]}
                          >
                            {item.stock <= 0
                              ? `⚠ ${t('inv.outOfStock')}`
                              : `${formatQuantity(item.stock)} ${item.unit || 'pcs'} ${t('inv.inStock')}`}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.quantitySelector}>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => updateQuantity(item, -1)}
                        disabled={qty === 0}
                      >
                        <Ionicons
                          name="remove"
                          size={16}
                          color={qty > 0 ? '#0F172A' : '#CBD5E1'}
                        />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.qtyText}
                        value={
                          qtyInputs[item.id] !== undefined
                            ? qtyInputs[item.id]
                            : (qty > 0 ? formatQuantity(qty) : '')
                        }
                        onChangeText={(text) => handleQtyInput(item, text)}
                        onBlur={() => clearQtyInput(item.id)}
                        keyboardType={item.allow_decimal ? 'decimal-pad' : 'numeric'}
                        editable={!isExpired && Number(item.stock) > 0}
                        placeholder="0"
                        placeholderTextColor="#CBD5E1"
                        textAlign="center"
                      />
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => updateQuantity(item, 1)}
                        disabled={!canIncrement}
                      >
                        <Ionicons
                          name="add"
                          size={16}
                          color={canIncrement ? '#0F172A' : '#CBD5E1'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {cartProducts.length > 0 && !loading && (
        <View style={styles.checkoutBar}>
          <View style={styles.checkoutInfo}>
            <Text style={styles.checkoutTotalText}>{t('inv.total')}</Text>
            <Text
              style={[
                styles.checkoutAmount,
                isMixedCurrency && { fontSize: 14, color: '#FCD34D' },
              ]}
            >
              {displayTotalLabel}
            </Text>
          </View>

          <View style={styles.paymentButtonsRow}>
            <TouchableOpacity
              style={styles.cashBtn}
              onPress={handleCashCheckout}
              activeOpacity={0.8}
              disabled={cashPreviewLoading || cashLoading}
            >
              {cashPreviewLoading ? (
                <ActivityIndicator size="small" color="#166534" />
              ) : (
                <>
                  <Ionicons name="cash-outline" size={16} color="#166534" />
                  <Text style={styles.cashBtnText}>{t('inv.cash')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.creditBtn}
              onPress={() => setCreditModalVisible(true)}
              activeOpacity={0.8}
              disabled={cashPreviewLoading || cashLoading}
            >
              <Ionicons name="person-outline" size={16} color="#7C3AED" />
              <Text style={styles.creditBtnText}>{t('inv.credit')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pawaPayBtn}
              onPress={() => setPawaPayVisible(true)}
              activeOpacity={0.8}
              disabled={cashPreviewLoading || cashLoading}
            >
              <View style={styles.pawaPayContent}>
                <Ionicons name="phone-portrait-outline" size={16} color="#0F172A" />
                <Text style={styles.pawaPayBtnText}>{t('inv.mobileMoney')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        transparent
        visible={cashConfirmVisible}
        animationType="fade"
        onRequestClose={closeCashModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('inv.confirmCash')}</Text>

            <Text style={styles.modalLabel}>{t('inv.totalToPay')}</Text>
            <Text style={styles.modalAmount}>
              TZS {Number(cashPendingTotalTZS || 0).toLocaleString()}
            </Text>

            <Text style={styles.modalNote}>
              {t('inv.recordedTzs')}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closeCashModal}
                disabled={cashLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmCashPayment}
                disabled={cashLoading}
                activeOpacity={0.8}
              >
                {cashLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('inv.confirm')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AddProductModal
        visible={productModalVisible}
        onClose={() => setProductModalVisible(false)}
        onProductSaved={handleProductSaved}
      />

      <EditProductModal
        visible={editModalVisible}
        product={selectedProduct}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedProduct(null);
        }}
        onProductUpdated={handleProductUpdated}
      />

      <PawaPayModal
        visible={pawaPayVisible}
        onClose={() => setPawaPayVisible(false)}
        onSuccess={handlePaymentSuccess}
        cart={cart}
        products={products}
      />

      <CreditModal
        visible={creditModalVisible}
        onClose={() => setCreditModalVisible(false)}
        onSuccess={handleCreditSuccess}
        cart={cart}
        products={products}
        totalAmount={rawTotalAmount}
        currency={creditCurrency}
      />

      <RecordPurchaseModal
        visible={recordModalVisible}
        product={purchaseProduct}
        onClose={() => {
          setRecordModalVisible(false);
          setPurchaseProduct(null);
        }}
        onPurchaseRecorded={handlePurchaseRecorded}
      />
    </View>
  );
};

export default InventoryList;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 20, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
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
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  thumbnailWrapper: {
    marginRight: 12,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInfo: { flex: 1, paddingRight: 12 },
  productName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  productSku: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  expiryText: { fontSize: 11, color: '#4169E1', fontWeight: '600' },
  rightActions: { alignItems: 'flex-end', gap: 8 },
  productPrice: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  purchaseButton: { backgroundColor: '#E0F2FE', padding: 8, borderRadius: 8 },
  editButton: { backgroundColor: '#F1F5F9', padding: 8, borderRadius: 8 },
  deleteButton: { backgroundColor: '#FEE2E2', padding: 8, borderRadius: 8 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  categoryBadgeText: { color: '#2563EB', fontSize: 12, fontWeight: '600' },
  inStockBadge: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 },
  lowStockBadge: { backgroundColor: '#FEF9C3', borderColor: '#FDE68A', borderWidth: 1 },
  inStockText: { color: '#16A34A' },
  lowStockText: { color: '#CA8A04' },
  expiredBadge: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1 },
  expiredText: { color: '#DC2626' },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qtyButton: { padding: 6, paddingHorizontal: 10 },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 32,
    textAlign: 'center',
  },
  checkoutBar: {
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  checkoutInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkoutTotalText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  checkoutAmount: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  paymentButtonsRow: { flexDirection: 'row', gap: 8 },
  cashBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  cashBtnText: { color: '#166534', fontSize: 13, fontWeight: '700' },
  creditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE9FE',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  creditBtnText: { color: '#7C3AED', fontSize: 13, fontWeight: '700' },
  pawaPayBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pawaPayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pawaPayInlineLogo: {
    height: 18,
    width: 18,
  },
  pawaPayBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
  },
  modalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalNote: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
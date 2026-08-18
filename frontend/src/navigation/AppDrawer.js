import React, { useState, useRef, useContext } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, Dimensions, TouchableWithoutFeedback, ScrollView, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Toast from 'react-native-toast-message';

import Dashboard from '../../screens/Dashboard/Dashboard';
import InventoryList from '../../screens/Inventory/InventoryList';
import CategoryList from '../../screens/Inventory/CategoryList';
import TransactionList from '../../screens/Transaction/TransactionList';
import CreditorsList from '../../screens/Creditors/CreditorsList';
import Report from '../../screens/Report/Report';
import BuyingAdvisor from '../../screens/BuyingAdvisor/BuyingAdvisor';
import ExpiryAlerts from '../../screens/Alerts/ExpiryAlerts';

const DRAWER_WIDTH = 270;

const SCREENS = [
  { name: 'Dashboard', labelKey: 'nav.dashboard', component: Dashboard, icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'Categories', labelKey: 'nav.categories', component: CategoryList, icon: 'list-outline', iconFocused: 'list' },
  { name: 'Inventory', labelKey: 'nav.inventory', component: InventoryList, icon: 'cube-outline', iconFocused: 'cube' },
  { name: 'Alerts', labelKey: 'nav.alerts', component: ExpiryAlerts, icon: 'alert-circle-outline', iconFocused: 'alert-circle' },
  { name: 'Transactions', labelKey: 'nav.transactions', component: TransactionList, icon: 'swap-horizontal-outline', iconFocused: 'swap-horizontal' },
  { name: 'Creditors', labelKey: 'nav.creditors', component: CreditorsList, icon: 'people-outline', iconFocused: 'people' },
  { name: 'Buying Advisor', labelKey: 'nav.buyingAdvisor', component: BuyingAdvisor, icon: 'trending-up-outline', iconFocused: 'trending-up' },
  { name: 'Report', labelKey: 'nav.report', component: Report, icon: 'documents-outline', iconFocused: 'documents' },

];

export default function AppDrawer() {
  const [activeScreen, setActiveScreen] = useState('Dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false); // moved from Dashboard
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const { user, logout } = useContext(AuthContext);
  const { t } = useLanguage();

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0.5, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  const navigateTo = (screenName) => {
    setActiveScreen(screenName);
    closeDrawer();
  };

  // Logout logic moved from Dashboard
  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      Toast.show({ type: 'success', text1: 'Logged Out', text2: 'You have been logged out successfully.' })
    } catch (error) {
      console.error('Logout failed: ', error)
      Toast.show({ type: 'error', text1: 'Logout Failed', text2: 'Failed to log out. Please try again.' })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const ActiveComponent = SCREENS.find(s => s.name === activeScreen)?.component;

  return (
    <View style={{ flex: 1 }}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuButton}>
          <Ionicons name="menu" size={26} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t(SCREENS.find(s => s.name === activeScreen)?.labelKey || 'nav.dashboard')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Active Screen */}
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {ActiveComponent && <ActiveComponent onNavigate={navigateTo} />}
      </View>

      {/* Overlay */}
      {drawerOpen && (
        <TouchableWithoutFeedback onPress={closeDrawer}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </TouchableWithoutFeedback>
      )}

      {/* Drawer Panel */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>

        {/* Drawer Header */}
        <View style={[styles.drawerHeader, { paddingTop: insets.top + 24 }]}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={28} color="#fff" />
          </View>
          <Text style={styles.appName}>{user?.name ?? 'My App'}</Text>
          <Text style={styles.appSubtitle}>{user?.email ?? 'Welcome back!'}</Text>
        </View>

        {/* Scrollable Nav Items */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {SCREENS.map((screen) => {
            const focused = activeScreen === screen.name;
            return (
              <TouchableOpacity
                key={screen.name}
                style={[styles.navItem, focused && styles.navItemActive]}
                onPress={() => navigateTo(screen.name)}
              >
                <Ionicons
                  name={focused ? screen.iconFocused : screen.icon}
                  size={20}
                  color={focused ? '#4f46e5' : '#64748b'}
                />
                <Text style={[styles.navLabel, focused && styles.navLabelActive]}>
                  {t(screen.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Language selector */}
        <View style={styles.langSection}>
          <Text style={styles.langLabel}>{t('common.language')}</Text>
          <LanguageSwitcher showIcon={false} />
        </View>

        {/* Logout with loading state and Toast */}
        <TouchableOpacity
          style={[styles.logoutButton, { paddingBottom: insets.bottom + 12 }]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          )}
          <Text style={styles.logoutText}>
            {isLoggingOut ? t('nav.loggingOut') : t('nav.logout')}
          </Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#ffffff',
    zIndex: 20,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  drawerHeader: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  appSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    borderRadius: 12,
  },
  navItemActive: {
    backgroundColor: '#eef2ff',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  navLabelActive: {
    color: '#4f46e5',
  },
  langSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  langLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
});
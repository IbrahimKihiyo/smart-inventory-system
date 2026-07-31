import React, { useState } from 'react';
import { 
  View, Text, Button, ActivityIndicator, Alert, 
  StyleSheet, TouchableOpacity, Platform, SafeAreaView 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import axiosClient from '../../src/services/axiosClient';
import { useLanguage } from '../../src/context/LanguageContext';
import { Buffer } from 'buffer';

const Report = () => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);

  // Date filter state
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const formatDateLabel = (date) =>
    date
      ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const generatePdf = async () => {
    try {
      setLoading(true);

      // Pass the dates as query params if they are selected
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
      };

      // Produce the report in the language currently shown in the app
      const params = { lang: language };

      if (startDate) {
        params.start_date = formatDate(startDate);
      }

      if (endDate) {
        params.end_date = formatDate(endDate);
      }

      const response = await axiosClient.get('/invoice/pdf', { 
        params,
        responseType: 'arraybuffer' 
      });

      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      const fileUri = FileSystem.documentDirectory + `invoice-${Date.now()}.pdf`;
      
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      } else {
        Alert.alert(t('rep.saved'), `PDF saved to ${fileUri}`);
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', t('rep.failed'));
    } finally {
      setLoading(false);
    }
  };

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
            if (date) setStartDate(date);
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
            if (date) setEndDate(date);
          }}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.pageTitle}>{t('rep.title')}</Text>
        <Text style={styles.pageSubtitle}>{t('rep.subtitle')}</Text>

        {renderDateFilter()}

        <View style={styles.actionContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#4F46E5" />
          ) : (
            <Button title={t('rep.download')} onPress={generatePdf} color="#4F46E5" />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Report;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F2F2F7' 
  },
  content: {
    flex: 1,
    paddingTop: 40,
    alignItems: 'center',
  },
  pageTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#1C1C1E', 
    marginBottom: 8 
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 24
  },
  
  // Date filter styles adapted from TransactionList
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
    width: '100%',
    maxWidth: 400,
  },
  dateBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 10, // slightly thicker for better touch target
  },
  dateBtnLabel: { 
    fontSize: 11, 
    color: '#8E8E93', 
    fontWeight: '600', 
    marginBottom: 4 
  },
  dateBtnValue: { 
    fontSize: 14, 
    color: '#1C1C1E', 
    fontWeight: '600' 
  },
  clearBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContainer: {
    marginTop: 20,
    width: '100%',
    maxWidth: 200,
  }
});
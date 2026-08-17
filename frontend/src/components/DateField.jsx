import React, { useState } from 'react';
import { Platform, TouchableOpacity, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

// YYYY-MM-DD for the web <input type="date">
const toYMD = (d) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';

// A single date field that works everywhere:
//  - web: a real HTML date input (the component picker has no web build)
//  - iOS/Android: the touchable + native DateTimePicker
export default function DateField({
  label,
  value,
  valueText,
  onChange,
  minimumDate,
  maximumDate,
  containerStyle,
  labelStyle,
  valueStyle,
}) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={containerStyle}>
        {label ? <Text style={labelStyle}>{label}</Text> : null}
        <input
          type="date"
          value={toYMD(value)}
          min={minimumDate ? toYMD(minimumDate) : undefined}
          max={maximumDate ? toYMD(maximumDate) : undefined}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value + 'T12:00:00') : null)}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: 14,
            fontWeight: '700',
            color: '#0F172A',
            fontFamily: 'inherit',
            padding: 0,
            marginTop: 2,
            width: '100%',
            cursor: 'pointer',
          }}
        />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity style={containerStyle} activeOpacity={0.7} onPress={() => setShow(true)}>
        {label ? <Text style={labelStyle}>{label}</Text> : null}
        <Text style={valueStyle}>{valueText}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, date) => {
            setShow(false);
            if (date) onChange(date);
          }}
        />
      )}
    </>
  );
}

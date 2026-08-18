import React, { useEffect, useState } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import axiosClient from '../../src/services/axiosClient'
import AddCategoryModal from './Modal/AddCategoryModal'
import EditCategoryModal from './Modal/EditCategoryModal'
import Toast from 'react-native-toast-message'
import { useLanguage } from '../../src/context/LanguageContext'

const PRIMARY = '#4F46E5'

const CategoryList = () => {
  const { t } = useLanguage()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  // NEW: State to track which item is currently being deleted
  const [deletingId, setDeletingId] = useState(null) 
  
  const [categoryModalVisible, setCategoryModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCategories = categories.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await axiosClient.get('/categories')
      setCategories(response.data)
    } catch (error) {
      console.error(error.response?.data || error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCategorySaved = () => fetchCategories()

  const handleCategoryUpdated = (updatedCategory) => {
    setCategories((prev) =>
      prev.map((item) => (item.id === updatedCategory.id ? updatedCategory : item))
    )
  }

  const handleEditPress = (category) => {
    setSelectedCategory(category)
    setEditModalVisible(true)
  }

  const confirmDelete = (id, name) => {
    Alert.alert(
      t('cat.deleteTitle'),
      t('cat.deleteMsg', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('inv.delete'), style: 'destructive', onPress: () => deleteCategory(id) },
      ]
    )
  }

  const deleteCategory = async (id) => {
    try {
      setDeletingId(id) // Start spinner for this specific ID
      await axiosClient.delete(`/categories/${id}`)
      setCategories((prev) => prev.filter((item) => item.id !== id))
      Toast.show({
        type: 'success',
        text1: t('toast.deleted'),
        text2: t('toast.categoryRemoved'),
      })
    } catch (error) {
      Alert.alert('Error', 'Could not delete category')
    } finally {
      setDeletingId(null) // Stop spinner
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('cat.title')}</Text>
          <Text style={styles.subtitle}>{t('cat.manage')}</Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setCategoryModalVisible(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>{t('cat.add')}</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('cat.search')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filteredCategories.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>{t('cat.none')}</Text>
              <Text style={styles.emptyText}>{t('cat.createFirst')}</Text>
            </View>
          ) : (
            filteredCategories.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={styles.iconWrap}>
                    <Ionicons name="pricetag-outline" size={18} color={PRIMARY} />
                  </View>
                  <Text style={styles.name}>{item.name}</Text>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => handleEditPress(item)}
                    style={styles.iconBtn}
                    disabled={deletingId === item.id} // Disable edit while deleting
                  >
                    <Ionicons name="create-outline" size={18} color={PRIMARY} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => confirmDelete(item.id, item.name)}
                    style={[styles.iconBtn, styles.deleteBtn]}
                    disabled={deletingId === item.id} // Disable delete while deleting
                  >
                    {/* Conditionally render the spinner or the trash icon */}
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <AddCategoryModal
        visible={categoryModalVisible}
        onClose={() => {
          setCategoryModalVisible(false)
          handleCategorySaved()
        }}
      />

      <EditCategoryModal
        visible={editModalVisible}
        category={selectedCategory}
        onClose={() => {
          setEditModalVisible(false)
          setSelectedCategory(null)
        }}
        onCategoryUpdated={handleCategoryUpdated}
      />
    </View>
  )
}

export default CategoryList

// ... your exact styles stay the same below
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 18,
    paddingTop: 50,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
  },

  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },

  addBtn: {
    flexDirection: 'row',
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 6,
  },

  addBtnText: {
    color: '#fff',
    fontWeight: '600',
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 44,
    marginBottom: 14,
    gap: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  empty: {
    alignItems: 'center',
    marginTop: 40,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
    color: '#0F172A',
  },

  emptyText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },

  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
  },

  iconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },

  deleteBtn: {
    backgroundColor: '#FEE2E2',
  },
})
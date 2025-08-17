import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView,
  Alert,
  RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface PDFFile {
  id: string;
  name: string;
  uri: string;
  size: number;
  dateAdded: string;
  isFavorite: boolean;
  type: 'local' | 'cloud' | 'url';
}

export default function Index() {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);
  const [favorites, setFavorites] = useState<PDFFile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');

  useEffect(() => {
    loadPDFs();
    loadFavorites();
  }, []);

  const loadPDFs = async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs`);
      if (response.ok) {
        const data = await response.json();
        setPdfFiles(data);
      }
    } catch (error) {
      console.log('PDF yüklenirken hata:', error);
    }
  };

  const loadFavorites = async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/favorites`);
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
      }
    } catch (error) {
      console.log('Favoriler yüklenirken hata:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPDFs(), loadFavorites()]);
    setRefreshing(false);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newPDF: Omit<PDFFile, 'id'> = {
          name: file.name,
          uri: file.uri,
          size: file.size || 0,
          dateAdded: new Date().toISOString(),
          isFavorite: false,
          type: 'local'
        };

        // Backend'e gönder
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newPDF),
        });

        if (response.ok) {
          const savedPDF = await response.json();
          setPdfFiles(prev => [savedPDF, ...prev]);
          Alert.alert('Başarılı', 'PDF başarıyla yüklendi!');
        }
      }
    } catch (error) {
      Alert.alert('Hata', 'PDF yüklenirken bir hata oluştu.');
      console.log('Doküman seçme hatası:', error);
    }
  };

  const toggleFavorite = async (pdfId: string) => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdfId}/favorite`, {
        method: 'PATCH',
      });

      if (response.ok) {
        const updatedPDF = await response.json();
        setPdfFiles(prev => 
          prev.map(pdf => pdf.id === pdfId ? updatedPDF : pdf)
        );
        await loadFavorites();
      }
    } catch (error) {
      Alert.alert('Hata', 'Favori durumu güncellenemedi.');
    }
  };

  const openPDF = (pdf: PDFFile) => {
    // PDF görüntüleyici sayfasına yönlendir
    Alert.alert('PDF Açılıyor', `${pdf.name} açılıyor...`);
    // TODO: Navigate to PDF viewer
  };

  const deletePDF = async (pdfId: string) => {
    Alert.alert(
      'PDF Sil',
      'Bu PDF\'i silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdfId}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                setPdfFiles(prev => prev.filter(pdf => pdf.id !== pdfId));
                setFavorites(prev => prev.filter(pdf => pdf.id !== pdfId));
                Alert.alert('Başarılı', 'PDF silindi.');
              }
            } catch (error) {
              Alert.alert('Hata', 'PDF silinirken bir hata oluştu.');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  };

  const renderPDFItem = (pdf: PDFFile) => (
    <View key={pdf.id} style={styles.pdfItem}>
      <TouchableOpacity style={styles.pdfInfo} onPress={() => openPDF(pdf)}>
        <Ionicons name="document-text" size={40} color="#E53E3E" />
        <View style={styles.pdfDetails}>
          <Text style={styles.pdfName} numberOfLines={2}>{pdf.name}</Text>
          <Text style={styles.pdfMeta}>
            {formatFileSize(pdf.size)} • {formatDate(pdf.dateAdded)}
          </Text>
          <Text style={styles.pdfType}>
            {pdf.type === 'local' ? '📱 Cihaz' : pdf.type === 'cloud' ? '☁️ Cloud' : '🔗 URL'}
          </Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.pdfActions}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => toggleFavorite(pdf.id)}
        >
          <Ionicons 
            name={pdf.isFavorite ? "heart" : "heart-outline"} 
            size={24} 
            color={pdf.isFavorite ? "#E53E3E" : "#666"} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => deletePDF(pdf.id)}
        >
          <Ionicons name="trash-outline" size={24} color="#E53E3E" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const displayedPDFs = activeTab === 'all' ? pdfFiles : favorites;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>PDF Görüntüleyici</Text>
        <TouchableOpacity style={styles.addButton} onPress={pickDocument}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Tab Seçici */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            Tüm PDF'ler ({pdfFiles.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'favorites' && styles.activeTab]}
          onPress={() => setActiveTab('favorites')}
        >
          <Text style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}>
            Favoriler ({favorites.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* PDF Listesi */}
      <ScrollView 
        style={styles.pdfList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {displayedPDFs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {activeTab === 'all' 
                ? 'Henüz PDF yüklenmemiş\n"+" butonuna basarak PDF ekleyin' 
                : 'Henüz favori PDF yok\n💖 butonuna basarak favorilere ekleyin'
              }
            </Text>
          </View>
        ) : (
          displayedPDFs.map(renderPDFItem)
        )}
      </ScrollView>

      {/* Alt Bilgi */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Toplam {pdfFiles.length} PDF • {favorites.length} Favori
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#E53E3E',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  activeTab: {
    backgroundColor: '#E53E3E',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: 'white',
  },
  pdfList: {
    flex: 1,
    padding: 16,
  },
  pdfItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pdfInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfDetails: {
    flex: 1,
    marginLeft: 12,
  },
  pdfName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  pdfMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  pdfType: {
    fontSize: 11,
    color: '#888',
  },
  pdfActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  footer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
});
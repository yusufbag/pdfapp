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
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { router } from 'expo-router';

// Conditional imports for mobile-only features
let ImagePicker: any = null;
let Print: any = null;

try {
  ImagePicker = require('expo-image-picker');
} catch {
  console.log('expo-image-picker not available in web');
}

try {
  Print = require('expo-print');
} catch {
  console.log('expo-print not available in web');
}

const EXPO_PUBLIC_BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

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

  const [showAddMenu, setShowAddMenu] = useState(false);

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
    router.push(`/${pdf.id}`);
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

  const addPDFFromURL = async () => {
    router.push('/add-url');
  };

  // Kamera/Galeri PDF Çevirme Fonksiyonları
  const requestCameraPermission = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Hata', 'Kamera erişimi gerekiyor!');
        return false;
      }
      return true;
    } catch (error) {
      Alert.alert('Hata', 'Bu özellik web preview\'da çalışmaz. Mobil uygulamada deneyin.');
      return false;
    }
  };

  const requestMediaLibraryPermission = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Hata', 'Galeri erişimi gerekiyor!');
        return false;
      }
      return true;
    } catch (error) {
      Alert.alert('Hata', 'Bu özellik web preview\'da çalışmaz. Mobil uygulamada deneyin.');
      return false;
    }
  };

  const takePhotoAndConvertToPDF = async () => {
    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await convertImageToPDF(result.assets[0], 'Kamera Çekimi');
      }
    } catch (error) {
      console.error('Kamera hatası:', error);
      Alert.alert('Web Preview', 'Kamera özelliği sadece mobil uygulamada çalışır.');
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const hasPermission = await requestMediaLibraryPermission();
      if (!hasPermission) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        await convertImageToPDF(result.assets[0], 'Galeri Seçimi');
      }
    } catch (error) {
      console.error('Galeri hatası:', error);
      Alert.alert('Web Preview', 'Galeri özelliği sadece mobil uygulamada çalışır.');
    }
  };

  const convertImageToPDF = async (imageAsset: any, source: string) => {
    try {
      Alert.alert('İşleniyor', 'Resminiz PDF\'e çevriliyor...');
      
      // Resmi base64'e çevir
      const base64 = await FileSystem.readAsStringAsync(imageAsset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // HTML şablonu ile PDF oluştur
      const htmlContent = `
        <html>
          <head>
            <meta charset="utf-8">
            <title>PDF Belgesi</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                font-family: Arial, sans-serif;
              }
              .image-container {
                text-align: center;
                margin: 20px 0;
              }
              img {
                max-width: 100%;
                height: auto;
                border: 1px solid #ddd;
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
              }
              .header {
                color: #333;
                border-bottom: 2px solid #E53E3E;
                padding-bottom: 10px;
                margin-bottom: 20px;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #666;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>PDF Belgesi</h1>
              <p>Kaynak: ${source} • Tarih: ${new Date().toLocaleDateString('tr-TR')}</p>
            </div>
            <div class="image-container">
              <img src="data:image/jpeg;base64,${base64}" alt="Belgeden çevrilen resim" />
            </div>
            <div class="footer">
              <p>PDF Pocket ile oluşturuldu</p>
            </div>
          </body>
        </html>
      `;

      // PDF oluştur
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        format: Print.Format.A4,
        orientation: Print.Orientation.portrait,
      });

      console.log('PDF oluşturuldu:', uri);

      // PDF'i backend'e gönder
      await uploadGeneratedPDF(uri, `${source}_${Date.now()}.pdf`);

    } catch (error) {
      console.error('PDF çevirme hatası:', error);
      Alert.alert('Hata', 'PDF çevirme sırasında hata oluştu');
    }
  };

  const uploadGeneratedPDF = async (pdfUri: string, fileName: string) => {
    try {
      // PDF'i base64'e çevir
      const base64 = await FileSystem.readAsStringAsync(pdfUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Backend'e gönder
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: fileName,
          fileData: base64,
          type: 'local'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert('Başarılı', `PDF başarıyla oluşturuldu: ${fileName}`, [
          {
            text: 'Görüntüle',
            onPress: () => router.push(`/${result.pdf.id}`)
          },
          { text: 'Tamam' }
        ]);
        
        // PDF listesini yenile
        loadPDFs();
      } else {
        throw new Error('PDF upload edilemedi');
      }
    } catch (error) {
      console.error('PDF upload hatası:', error);
      Alert.alert('Hata', 'PDF kaydedilemedi');
    }
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
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddMenu(!showAddMenu)}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Add Menu Dropdown */}
      {showAddMenu && (
        <View style={styles.addMenuOverlay}>
          <TouchableOpacity 
            style={styles.addMenuBackdrop} 
            onPress={() => setShowAddMenu(false)}
          />
          <View style={styles.addMenu}>
            <TouchableOpacity 
              style={styles.addMenuItem} 
              onPress={() => {
                setShowAddMenu(false);
                pickDocument();
              }}
            >
              <Ionicons name="document" size={20} color="#E53E3E" />
              <Text style={styles.addMenuText}>Cihazdan PDF Seç</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.addMenuItem} 
              onPress={() => {
                setShowAddMenu(false);
                takePhotoAndConvertToPDF();
              }}
            >
              <Ionicons name="camera" size={20} color="#E53E3E" />
              <Text style={styles.addMenuText}>📷 Kamera ile Çek</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.addMenuItem} 
              onPress={() => {
                setShowAddMenu(false);
                pickImageFromGallery();
              }}
            >
              <Ionicons name="images" size={20} color="#E53E3E" />
              <Text style={styles.addMenuText}>🖼️ Galeriden Seç</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.addMenuItem} 
              onPress={() => {
                setShowAddMenu(false);
                addPDFFromURL();
              }}
            >
              <Ionicons name="link" size={20} color="#E53E3E" />
              <Text style={styles.addMenuText}>🔗 URL'den Ekle</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.addMenuItem, styles.disabledMenuItem]} 
              onPress={() => {
                setShowAddMenu(false);
                Alert.alert('Yakında', 'Cloud servisleri entegrasyonu yakında gelecek!');
              }}
            >
              <Ionicons name="cloud" size={20} color="#999" />
              <Text style={[styles.addMenuText, styles.disabledText]}>Cloud'dan PDF (Yakında)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
  // Add Menu Styles
  addMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  addMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  addMenu: {
    position: 'absolute',
    top: 70,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disabledMenuItem: {
    opacity: 0.6,
  },
  addMenuText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginLeft: 12,
  },
  disabledText: {
    color: '#999',
  },
});
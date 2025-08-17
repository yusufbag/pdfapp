import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useGlobalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface PDFFile {
  id: string;
  name: string;
  uri: string;
  size: number;
  dateAdded: string;
  isFavorite: boolean;
  type: 'local' | 'cloud' | 'url';
  fileData?: string;
}

const { width, height } = Dimensions.get('window');

export default function PDFViewer() {
  const { pdfId } = useLocalSearchParams();
  const [pdf, setPdf] = useState<PDFFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPDF();
  }, [pdfId]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdfId}`);
      if (response.ok) {
        const pdfData = await response.json();
        setPdf(pdfData);
      } else {
        Alert.alert('Hata', 'PDF bulunamadı.');
        router.back();
      }
    } catch (error) {
      console.log('PDF yüklenirken hata:', error);
      Alert.alert('Hata', 'PDF yüklenirken bir hata oluştu.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async () => {
    if (!pdf) return;
    
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdf.id}/favorite`, {
        method: 'PATCH',
      });

      if (response.ok) {
        const updatedPDF = await response.json();
        setPdf(updatedPDF);
      }
    } catch (error) {
      Alert.alert('Hata', 'Favori durumu güncellenemedi.');
    }
  };

  const openPDFInBrowser = async () => {
    if (!pdf) return;
    
    try {
      let pdfUrl = pdf.uri;
      
      // Eğer base64 data varsa, önce bir web URL'ine dönüştürmeliyiz
      if (pdf.fileData && pdfUrl.startsWith('data:')) {
        // Base64 PDF'i için özel endpoint kullan
        pdfUrl = `${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdf.id}/view`;
        
        Alert.alert(
          'PDF Tarayıcıda Açılıyor',
          `${pdf.name} varsayılan tarayıcınızda açılacak.`,
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Aç',
              onPress: async () => {
                const result = await WebBrowser.openBrowserAsync(pdfUrl);
                console.log('WebBrowser result:', result);
              }
            }
          ]
        );
      } else if (pdfUrl.startsWith('http')) {
        // External URL'ler direkt açılabilir
        const result = await WebBrowser.openBrowserAsync(pdfUrl);
        console.log('WebBrowser result:', result);
      } else {
        Alert.alert('Hata', 'Bu PDF tarayıcıda açılamaz.');
      }
    } catch (error) {
      console.error('WebBrowser hatası:', error);
      Alert.alert('Hata', 'PDF tarayıcıda açılırken bir sorun oluştu.');
    }
  };

  const goBack = () => {
    router.back();
  };

  const formatFileSize = (bytes: number): string => {
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53E3E" />
          <Text style={styles.loadingText}>PDF Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pdf) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="document-outline" size={64} color="#ccc" />
          <Text style={styles.errorText}>PDF bulunamadı</Text>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Text style={styles.backButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={styles.title} numberOfLines={1}>{pdf.name}</Text>
          <Text style={styles.subtitle}>
            {pdf.type === 'local' ? '📱 Cihaz' : pdf.type === 'cloud' ? '☁️ Cloud' : '🔗 URL'}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={toggleFavorite}>
            <Ionicons 
              name={pdf.isFavorite ? "heart" : "heart-outline"} 
              size={24} 
              color={pdf.isFavorite ? "#FFD700" : "white"} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.headerButton} onPress={openPDFInBrowser}>
            <Ionicons name="share-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* PDF Viewer Options */}
      <View style={styles.pdfContainer}>
        <View style={styles.pdfOptionsContainer}>
          <View style={styles.pdfIcon}>
            <Ionicons name="document-text" size={80} color="#E53E3E" />
          </View>
          
          <Text style={styles.pdfTitle}>{pdf.name}</Text>
          <Text style={styles.pdfInfo}>
            Boyut: {formatFileSize(pdf.size)} • {formatDate(pdf.dateAdded)}
          </Text>
          <Text style={styles.pdfTypeInfo}>
            📍 Kaynak: {pdf.type === 'local' ? 'Cihazdan Yüklenen' : pdf.type === 'cloud' ? 'Cloud' : 'URL\'den Eklenen'}
          </Text>
          
          <View style={styles.viewingOptions}>
            <Text style={styles.optionsTitle}>PDF Görüntüleme Seçenekleri</Text>
            
            {/* Tarayıcıda Aç */}
            <TouchableOpacity 
              style={styles.optionButton} 
              onPress={openPDFInBrowser}
            >
              <View style={styles.optionIconContainer}>
                <Ionicons name="globe-outline" size={24} color="#E53E3E" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Tarayıcıda Aç</Text>
                <Text style={styles.optionDescription}>
                  PDF'i varsayılan tarayıcıda görüntüle (Önerilen)
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            
            {/* Uygulama İçi Görüntüleyici (Sorunlu) */}
            <TouchableOpacity 
              style={[styles.optionButton, styles.disabledOption]} 
              onPress={() => {
                Alert.alert(
                  'Geliştirme Aşamasında',
                  'Uygulama içi PDF görüntüleyici şu anda geliştirme aşamasındadır. Lütfen "Tarayıcıda Aç" seçeneğini kullanın.',
                  [{ text: 'Tamam' }]
                );
              }}
            >
              <View style={styles.optionIconContainer}>
                <Ionicons name="phone-portrait-outline" size={24} color="#999" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, styles.disabledText]}>Uygulama İçinde Görüntüle</Text>
                <Text style={[styles.optionDescription, styles.disabledText]}>
                  PDF'i uygulama içinde aç (Geliştirme aşamasında)
                </Text>
              </View>
              <View style={styles.developmentBadge}>
                <Text style={styles.developmentText}>YAKINDA</Text>
              </View>
            </TouchableOpacity>
            
            {/* Paylaş/İndir */}
            <TouchableOpacity 
              style={styles.optionButton} 
              onPress={() => {
                Alert.alert(
                  'PDF Paylaş', 
                  'PDF paylaşım özelliği gelecek güncellemede eklenecek.',
                  [{ text: 'Tamam' }]
                );
              }}
            >
              <View style={styles.optionIconContainer}>
                <Ionicons name="share-outline" size={24} color="#E53E3E" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Paylaş / İndir</Text>
                <Text style={styles.optionDescription}>
                  PDF'i paylaş veya cihaza indir
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <Text style={styles.infoText}>
              En iyi görüntüleme deneyimi için "Tarayıcıda Aç" seçeneğini kullanın.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E53E3E',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  pdfContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E53E3E',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E53E3E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  skipButton: {
    backgroundColor: 'rgba(229, 62, 62, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E53E3E',
  },
  skipText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  // PDF Options Styles
  pdfOptionsContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  pdfIcon: {
    marginTop: 40,
    marginBottom: 20,
  },
  pdfTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  pdfInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  pdfTypeInfo: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  viewingOptions: {
    width: '100%',
    maxWidth: 400,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledOption: {
    backgroundColor: '#f8f8f8',
    opacity: 0.7,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  disabledText: {
    color: '#999',
  },
  developmentBadge: {
    backgroundColor: '#FFA500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  developmentText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EBF8FF',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    marginLeft: 12,
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#ccc',
  },
});
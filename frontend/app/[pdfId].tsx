import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
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

export default function PDFViewer() {
  const { pdfId } = useLocalSearchParams();
  const [pdf, setPdf] = useState<PDFFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnnotationMode, setShowAnnotationMode] = useState(false);
  const [annotations, setAnnotations] = useState<Array<{
    id: string;
    x: number;
    y: number;
    text: string;
    page: number;
  }>>([]);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [webViewLoading, setWebViewLoading] = useState(true);

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

  const openInAppViewer = () => {
    if (!pdf) return;
    
    console.log('PDF uygulama içinde açılıyor:', pdf.name);
    setViewMode('viewer');
    setWebViewLoading(true);
  };

  const openPDFInBrowser = async () => {
    if (!pdf) return;
    
    try {
      let pdfUrl = pdf.uri;
      
      if (pdf.fileData && pdfUrl.startsWith('data:')) {
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

  const createSimplePDFViewerHTML = (pdfUri: string, fileData?: string) => {
    // Basit iframe çözümü - direct PDF viewing
    let pdfSrc = pdfUri;
    
    // Base64 data varsa backend endpoint kullan
    if (fileData) {
      pdfSrc = `${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdf?.id}/view`;
    } else if (!pdfUri.startsWith('http')) {
      pdfSrc = `${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdf?.id}/view`;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
        <title>PDF Görüntüleyici</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #f5f5f5;
            overflow: hidden;
            height: 100vh;
          }
          
          .pdf-container {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: #f5f5f5;
          }
          
          .pdf-header {
            background: linear-gradient(135deg, #E53E3E 0%, #C53030 100%);
            color: white;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
          }
          
          .header-title {
            font-size: 16px;
            font-weight: 600;
            flex: 1;
          }
          
          .pdf-frame {
            flex: 1;
            width: 100%;
            height: calc(100vh - 50px);
            border: none;
            background: white;
          }
          
          .loading-overlay {
            position: absolute;
            top: 50px;
            left: 0;
            right: 0;
            bottom: 0;
            background: #f5f5f5;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }
          
          .loading-spinner {
            width: 48px;
            height: 48px;
            border: 3px solid rgba(229, 62, 62, 0.2);
            border-top: 3px solid #E53E3E;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .loading-text {
            font-size: 16px;
            color: #333;
            font-weight: 500;
            margin-bottom: 8px;
          }
          
          .error-container {
            background: #f5f5f5;
            text-align: center;
            padding: 40px;
            color: #333;
          }
          
          .error-title {
            font-size: 18px;
            color: #E53E3E;
            margin-bottom: 12px;
            font-weight: 600;
          }
          
          .error-text {
            font-size: 14px;
            color: #666;
            margin-bottom: 20px;
            line-height: 1.5;
          }
          
          .retry-button {
            background: #E53E3E;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .retry-button:hover {
            background: #C53030;
          }
        </style>
      </head>
      <body>
        <div class="pdf-container">
          <div class="pdf-header">
            <div class="header-title">📄 PDF Görüntüleyici</div>
          </div>
          
          <div id="loading-overlay" class="loading-overlay">
            <div class="loading-spinner"></div>
            <div class="loading-text">PDF Yükleniyor...</div>
          </div>
          
          <iframe 
            id="pdf-frame" 
            class="pdf-frame" 
            style="display: none;"
            src="${pdfSrc}"
          ></iframe>
        </div>
        
        <script type="text/javascript">
          let loadTimeout;
          let hasLoaded = false;
          
          function showPDF() {
            if (hasLoaded) return;
            hasLoaded = true;
            
            clearTimeout(loadTimeout);
            document.getElementById('loading-overlay').style.display = 'none';
            document.getElementById('pdf-frame').style.display = 'block';
            
            console.log('✅ PDF başarıyla yüklendi');
            
            // React Native'e bildir
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pdfLoaded',
                success: true
              }));
            }
          }
          
          function showError(message) {
            clearTimeout(loadTimeout);
            document.getElementById('loading-overlay').innerHTML = \`
              <div class="error-container">
                <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                <div class="error-title">PDF Görüntülenemedi</div>
                <div class="error-text">Bu PDF dosyası şu anda görüntülenemiyor. Lütfen tekrar deneyin.</div>
                <button class="retry-button" onclick="location.reload()">🔄 Tekrar Dene</button>
              </div>
            \`;
            
            console.error('❌ PDF yükleme hatası:', message);
            
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pdfError',
                success: false,
                error: message || 'PDF yüklenemedi'
              }));
            }
          }
          
          // PDF frame event listeners
          const pdfFrame = document.getElementById('pdf-frame');
          
          pdfFrame.onload = function() {
            setTimeout(showPDF, 1000); // 1 saniye bekle sonra göster
          };
          
          pdfFrame.onerror = function() {
            showError('PDF yükleme hatası');
          };
          
          // 10 saniye timeout
          loadTimeout = setTimeout(() => {
            showError('PDF yükleme zaman aşımı');
          }, 10000);
          
          // Hemen yüklenmeye başla
          setTimeout(() => {
            if (!hasLoaded) {
              showPDF(); // Yüklenmemiş olsa bile 3 saniye sonra göster
            }
          }, 3000);
          
          console.log('🚀 PDF viewer başlatıldı:', '${pdfSrc}');
        </script>
      </body>
      </html>
    `;
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'pdfLoaded':
          setWebViewLoading(false);
          console.log('✅ PDF başarıyla yüklendi');
          break;
        case 'pdfError':
          setWebViewLoading(false);
          console.log('❌ PDF yüklenemedi');
          Alert.alert(
            'PDF Yükleme Hatası', 
            'Bu PDF uygulama içinde görüntülenemiyor. Tarayıcıda açmayı deneyin.',
            [
              { text: 'Tamam' },
              { text: 'Tarayıcıda Aç', onPress: openPDFInBrowser }
            ]
          );
          break;
      }
    } catch (error) {
      console.log('WebView mesaj işleme hatası:', error);
      setWebViewLoading(false);
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
        </View>
      </View>

      {/* Content */}
      {viewMode === 'options' ? (
        <View style={styles.pdfContainer}>
          <View style={styles.pdfOptionsContainer}>
            <View style={styles.pdfIcon}>
              <Ionicons name="document-text" size={80} color="#E53E3E" />
            </View>
            
            <Text style={styles.pdfTitle}>{pdf.name}</Text>
            <Text style={styles.pdfInfo}>
              Boyut: {formatFileSize(pdf.size)} • {formatDate(pdf.dateAdded)}
            </Text>
            
            <View style={styles.viewingOptions}>
              <Text style={styles.optionsTitle}>PDF Görüntüleme</Text>
              
              <TouchableOpacity style={styles.optionButton} onPress={openInAppViewer}>
                <View style={styles.optionIconContainer}>
                  <Ionicons name="document-text" size={24} color="#E53E3E" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>PDF'i Görüntüle</Text>
                  <Text style={styles.optionDescription}>PDF'i uygulama içinde aç</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
              
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
                    PDF'i paylaş veya cihaza indir (Yakında)
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.pdfViewerContainer}>
          {webViewLoading && (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color="#E53E3E" />
              <Text style={styles.loadingText}>PDF Yükleniyor...</Text>
              
              <TouchableOpacity 
                style={styles.backToOptionsButton} 
                onPress={() => setViewMode('options')}
              >
                <Text style={styles.backToOptionsText}>← Seçeneklere Dön</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <WebView
            style={styles.webView}
            source={{ 
              html: createSimplePDFViewerHTML(pdf?.uri || '', pdf?.fileData) 
            }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            scalesPageToFit={true}
            startInLoadingState={false}
            mixedContentMode="always"
            allowsFullscreenVideo={false}
            bounces={false}
            scrollEnabled={true}
          />
          
          {!webViewLoading && (
            <TouchableOpacity 
              style={styles.floatingBackButton} 
              onPress={() => setViewMode('options')}
            >
              <Ionicons name="arrow-back" size={20} color="white" />
              <Text style={styles.floatingBackText}>Seçenekler</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
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
    backgroundColor: '#f5f5f5',
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
  pdfOptionsContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
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
  pdfViewerContainer: {
    flex: 1,
    backgroundColor: '#333',
  },
  webView: {
    flex: 1,
    backgroundColor: 'white',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(245, 245, 245, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  backToOptionsButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 24,
  },
  backToOptionsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  floatingBackButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    zIndex: 1000,
  },
  floatingBackText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
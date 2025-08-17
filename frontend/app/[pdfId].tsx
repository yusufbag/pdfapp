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
  const [viewMode, setViewMode] = useState<'options' | 'viewer'>('options');
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
    
    Alert.alert(
      'Uygulama İçi Görüntüleyici',
      'PDF uygulama içinde açılacak. Bu özellik beta aşamasındadır.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Aç',
          onPress: () => {
            console.log('PDF uygulama içinde açılıyor:', pdf.name);
            setViewMode('viewer');
            setWebViewLoading(true);
          }
        }
      ]
    );
  };
    if (!pdf) return;
    
    try {
      let pdfUrl = pdf.uri;
      
      // Eğer base64 data varsa, önce bir web URL'ine dönüştürmeliyiz
      if (pdf.fileData && pdfUrl.startsWith('data:')) {
        // Base64 PDF'i için özel endpoint kullan
        pdfUrl = `${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdf.id}/view`;
        
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

  // Basit ve etkili PDF görüntüleyici HTML
  const createSimplePDFViewerHTML = (pdfUri: string, fileData?: string) => {
    let pdfSrc = pdfUri;
    
    // Eğer base64 data varsa onu kullan
    if (fileData) {
      pdfSrc = `data:application/pdf;base64,${fileData}`;
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
            background-color: #333;
            height: 100vh;
            display: flex;
            flex-direction: column;
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
          
          .pdf-title {
            font-size: 16px;
            font-weight: 600;
            flex: 1;
            margin-right: 16px;
          }
          
          .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(245, 245, 245, 0.95);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 2000;
          }
          
          .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid #E5E5E5;
            border-top: 4px solid #E53E3E;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .loading-text {
            font-size: 18px;
            color: #333;
            font-weight: 500;
            margin-bottom: 8px;
          }
          
          .loading-subtext {
            font-size: 14px;
            color: #666;
            text-align: center;
          }
          
          .pdf-container {
            flex: 1;
            position: relative;
            background: white;
          }
          
          .pdf-iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
          }
          
          .error-container {
            flex: 1;
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
          }
          
          .error-icon {
            font-size: 64px;
            margin-bottom: 16px;
          }
          
          .error-title {
            font-size: 20px;
            color: #E53E3E;
            font-weight: bold;
            margin-bottom: 12px;
          }
          
          .error-text {
            font-size: 14px;
            color: #666;
            line-height: 20px;
            margin-bottom: 24px;
          }
          
          .retry-button {
            background: #E53E3E;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          
          .retry-button:hover {
            background: #C53030;
          }
        </style>
      </head>
      <body>
        <div class="pdf-header">
          <div class="pdf-title">📄 PDF Görüntüleyici</div>
          <div id="status" style="font-size: 12px; opacity: 0.9;">Yükleniyor...</div>
        </div>
        
        <div class="pdf-container">
          <div id="loading-overlay" class="loading-overlay">
            <div class="spinner"></div>
            <div class="loading-text">PDF hazırlanıyor...</div>
            <div class="loading-subtext">Lütfen bekleyin, bu birkaç saniye sürebilir</div>
          </div>
          
          <iframe 
            id="pdf-iframe"
            class="pdf-iframe"
            src="${pdfSrc}"
            onload="onPDFLoad()"
            onerror="onPDFError()"
            title="PDF Viewer"
          ></iframe>
          
          <div id="error-container" class="error-container">
            <div class="error-icon">❌</div>
            <div class="error-title">PDF Yüklenemedi</div>
            <div class="error-text">
              Bu PDF tarayıcıda görüntülenemiyor olabilir.<br>
              Dosya bozuk veya desteklenmiyor olabilir.
            </div>
            <button class="retry-button" onclick="retryLoad()">Tekrar Dene</button>
          </div>
        </div>
        
        <script>
          let loadTimeout = null;
          let pdfLoaded = false;
          
          function onPDFLoad() {
            clearTimeout(loadTimeout);
            pdfLoaded = true;
            
            document.getElementById('loading-overlay').style.display = 'none';
            document.getElementById('error-container').style.display = 'none';
            document.getElementById('status').textContent = '✅ PDF Yüklendi';
            
            // React Native'e bildir
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pdfLoaded',
                success: true
              }));
            }
          }
          
          function onPDFError() {
            clearTimeout(loadTimeout);
            
            document.getElementById('loading-overlay').style.display = 'none';
            document.getElementById('pdf-iframe').style.display = 'none';
            document.getElementById('error-container').style.display = 'flex';
            document.getElementById('status').textContent = '❌ Yükleme Hatası';
            
            // React Native'e bildir
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pdfError',
                success: false
              }));
            }
          }
          
          function retryLoad() {
            pdfLoaded = false;
            
            document.getElementById('loading-overlay').style.display = 'flex';
            document.getElementById('error-container').style.display = 'none';
            document.getElementById('pdf-iframe').style.display = 'block';
            document.getElementById('status').textContent = '🔄 Yeniden Yükleniyor...';
            
            // iframe'i yeniden yükle
            const iframe = document.getElementById('pdf-iframe');
            iframe.src = iframe.src + '?_retry=' + Date.now();
            
            startLoadTimeout();
          }
          
          function startLoadTimeout() {
            clearTimeout(loadTimeout);
            
            // 15 saniye timeout
            loadTimeout = setTimeout(() => {
              if (!pdfLoaded) {
                console.log('PDF yükleme timeout');
                onPDFError();
              }
            }, 15000);
          }
          
          // Sayfa yüklendiğinde timeout başlat
          window.onload = function() {
            console.log('PDF viewer HTML yüklendi');
            startLoadTimeout();
          };
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
          console.log('✅ PDF başarıyla yüklendi (uygulama içi)');
          break;
        case 'pdfError':
          setWebViewLoading(false);
          console.log('❌ PDF yüklenemedi (uygulama içi)');
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
          
          <TouchableOpacity style={styles.headerButton} onPress={openPDFInBrowser}>
            <Ionicons name="share-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* PDF Content - Options veya Viewer */}
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
            <Text style={styles.pdfTypeInfo}>
              📍 Kaynak: {pdf.type === 'local' ? 'Cihazdan Yüklenen' : pdf.type === 'cloud' ? 'Cloud' : 'URL\'den Eklenen'}
            </Text>
            
            <View style={styles.viewingOptions}>
              <Text style={styles.optionsTitle}>PDF Görüntüleme Seçenekleri</Text>
              
              {/* Uygulama İçinde Görüntüle - Artık Aktif */}
              <TouchableOpacity 
                style={styles.optionButton} 
                onPress={openInAppViewer}
              >
                <View style={styles.optionIconContainer}>
                  <Ionicons name="phone-portrait-outline" size={24} color="#E53E3E" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Uygulama İçinde Görüntüle</Text>
                  <Text style={styles.optionDescription}>
                    PDF'i uygulama içinde aç (Beta)
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
              
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
      ) : (
        // PDF Viewer Mode
        <View style={styles.pdfViewerContainer}>
          {webViewLoading && (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color="#E53E3E" />
              <Text style={styles.loadingText}>PDF Yükleniyor...</Text>
              <Text style={styles.loadingSubtext}>Uygulama içi görüntüleme</Text>
              
              <TouchableOpacity 
                style={styles.backToOptionsButton} 
                onPress={() => {
                  setViewMode('options');
                  setWebViewLoading(true);
                }}
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
            onLoadStart={() => {
              console.log('PDF WebView yükleme başladı');
            }}
            onLoadEnd={() => {
              console.log('PDF WebView yükleme tamamlandı');
            }}
            onError={(error) => {
              console.log('PDF WebView hatası:', error);
              setWebViewLoading(false);
              Alert.alert('Hata', 'PDF yüklenirken bir sorun oluştu.');
            }}
          />
          
          {/* Back to Options Button - Fixed Position */}
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
  // PDF Viewer Container Styles
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  floatingBackText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
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
  // PDF Viewer Container Styles
  pdfViewerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#f5f5f5',
  },
  backToOptionsButton: {
    backgroundColor: 'rgba(229, 62, 62, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 16,
  },
  backToOptionsText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(229, 62, 62, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingBackText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
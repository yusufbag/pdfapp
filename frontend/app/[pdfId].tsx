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
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPDF();
  }, [pdfId]);

  useEffect(() => {
    // 10 saniye timeout ekle
    if (webViewLoading) {
      const timeout = setTimeout(() => {
        console.log('PDF yükleme timeout - alternatif çözüm deneniyor');
        setWebViewLoading(false);
        setPdfError(true);
        Alert.alert(
          'PDF Yüklenemedi', 
          'PDF yüklenirken sorun oluştu. Bu PDF desteklenmiyor olabilir.',
          [
            { text: 'Tamam', style: 'default' },
            { 
              text: 'Tarayıcıda Aç', 
              onPress: () => {
                if (pdf?.uri) {
                  // External browser'da açmayı dene
                  console.log('PDF tarayıcıda açılıyor:', pdf.uri);
                }
              }
            }
          ]
        );
      }, 10000);
      
      setLoadingTimeout(timeout);
      
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    } else {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        setLoadingTimeout(null);
      }
    }
  }, [webViewLoading, pdf]);

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

  // PDF görüntüleme için HTML içeriği oluştur - PDF.js yaklaşımı (mobil uyumlu)
  const createPDFViewerHTML = (pdfUri: string, fileData?: string) => {
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
        <title>PDF Görüntüleyici</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background-color: #333;
            overflow: hidden;
          }
          
          .pdf-container {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: #333;
          }
          
          .pdf-controls {
            background: linear-gradient(135deg, #E53E3E 0%, #C53030 100%);
            color: white;
            padding: 8px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 14px;
            min-height: 44px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 1000;
          }
          
          .pdf-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: white;
            position: relative;
            overflow: hidden;
          }
          
          .loading-container {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            background: #f5f5f5;
            color: #666;
            z-index: 100;
          }
          
          .success-container {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: none;
            flex-direction: column;
            background: white;
            z-index: 50;
          }
          
          .error-container {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: none;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            background: #f5f5f5;
            color: #e53e3e;
            padding: 20px;
            text-align: center;
            z-index: 200;
          }
          
          #pdf-canvas {
            display: block;
            margin: 0 auto;
            max-width: 100%;
            max-height: 100%;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
          }
          
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #E5E5E5;
            border-top: 4px solid #E53E3E;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .status-text {
            font-size: 16px;
            font-weight: 500;
          }
          
          .page-nav {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 16px;
            padding: 8px;
            background: rgba(0,0,0,0.8);
            color: white;
          }
          
          .nav-button {
            background: rgba(255,255,255,0.2);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          
          .nav-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .page-info {
            font-size: 14px;
            color: white;
          }
          
          .retry-button {
            margin-top: 16px;
            background: #E53E3E;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="pdf-container">
          <div class="pdf-controls">
            <span id="status-text" class="status-text">📄 PDF Yükleniyor...</span>
            <div style="font-size: 12px; opacity: 0.8;" id="page-counter">PDF.js Viewer</div>
          </div>
          
          <div class="pdf-content">
            <div id="loading-container" class="loading-container">
              <div class="spinner"></div>
              <div class="status-text">PDF hazırlanıyor...</div>
              <div style="font-size: 12px; color: #999; margin-top: 8px;">PDF.js ile yükleniyor</div>
            </div>
            
            <div id="error-container" class="error-container">
              <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
              <div class="status-text">PDF Yüklenemedi</div>
              <div style="font-size: 14px; margin-top: 8px;">Bu PDF bozuk olabilir</div>
              <button class="retry-button" onclick="loadPDF()">Tekrar Dene</button>
            </div>
            
            <div id="success-container" class="success-container">
              <canvas id="pdf-canvas"></canvas>
              <div class="page-nav">
                <button id="prev-page" class="nav-button" onclick="prevPage()">◀ Önceki</button>
                <span id="page-info" class="page-info">1 / 1</span>
                <button id="next-page" class="nav-button" onclick="nextPage()">Sonraki ▶</button>
              </div>
            </div>
          </div>
        </div>
        
        <script>
          let pdfDoc = null;
          let currentPage = 1;
          let totalPages = 1;
          let scale = 1.2;
          let pdfLoaded = false;
          
          // PDF.js worker path
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          async function loadPDF() {
            try {
              document.getElementById('loading-container').style.display = 'flex';
              document.getElementById('error-container').style.display = 'none';
              document.getElementById('success-container').style.display = 'none';
              document.getElementById('status-text').textContent = '📄 PDF Yükleniyor...';
              
              console.log('PDF.js ile yükleme başlıyor...');
              
              // PDF yükle
              const loadingTask = pdfjsLib.getDocument('${pdfSrc}');
              pdfDoc = await loadingTask.promise;
              totalPages = pdfDoc.numPages;
              
              console.log('PDF başarıyla yüklendi, sayfa sayısı:', totalPages);
              
              // İlk sayfayı render et
              await renderPage(1);
              
              // UI'yi güncelle
              pdfLoaded = true;
              document.getElementById('loading-container').style.display = 'none';
              document.getElementById('success-container').style.display = 'flex';
              document.getElementById('status-text').textContent = '✅ PDF Yüklendi';
              document.getElementById('page-counter').textContent = totalPages + ' sayfa';
              
              updatePageInfo();
              
              // React Native'e bildir
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pdfLoaded',
                totalPages: totalPages
              }));
              
            } catch (error) {
              console.error('PDF yükleme hatası:', error);
              onPDFError();
            }
          }
          
          async function renderPage(pageNum) {
            try {
              const page = await pdfDoc.getPage(pageNum);
              const canvas = document.getElementById('pdf-canvas');
              const ctx = canvas.getContext('2d');
              
              // Canvas boyutunu hesapla (mobil uyumlu)
              const containerWidth = window.innerWidth - 20;
              const viewport = page.getViewport({ scale: 1 });
              const scale = Math.min(containerWidth / viewport.width, 2.0);
              const scaledViewport = page.getViewport({ scale: scale });
              
              canvas.height = scaledViewport.height;
              canvas.width = scaledViewport.width;
              
              // PDF sayfasını render et
              const renderContext = {
                canvasContext: ctx,
                viewport: scaledViewport
              };
              
              await page.render(renderContext).promise;
              currentPage = pageNum;
              updatePageInfo();
              
            } catch (error) {
              console.error('Sayfa render hatası:', error);
              onPDFError();
            }
          }
          
          function updatePageInfo() {
            document.getElementById('page-info').textContent = currentPage + ' / ' + totalPages;
            document.getElementById('prev-page').disabled = (currentPage <= 1);
            document.getElementById('next-page').disabled = (currentPage >= totalPages);
          }
          
          async function prevPage() {
            if (currentPage > 1) {
              await renderPage(currentPage - 1);
            }
          }
          
          async function nextPage() {
            if (currentPage < totalPages) {
              await renderPage(currentPage + 1);
            }
          }
          
          function onPDFError() {
            document.getElementById('loading-container').style.display = 'none';
            document.getElementById('success-container').style.display = 'none';
            document.getElementById('error-container').style.display = 'flex';
            document.getElementById('status-text').textContent = '❌ PDF Yüklenemedi';
            
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pdfError'
            }));
          }
          
          // Sayfa yüklendiğinde PDF'i başlat
          window.onload = function() {
            console.log('PDF.js HTML yüklendi');
            setTimeout(loadPDF, 500);
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
          setPdfError(false);
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            setLoadingTimeout(null);
          }
          console.log('✅ PDF başarıyla yüklendi');
          break;
        case 'pdfAlternative':
          setWebViewLoading(false);
          setPdfError(false);
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            setLoadingTimeout(null);
          }
          console.log('📄 PDF alternatif viewer ile hazır');
          break;
        case 'pdfError':
          setWebViewLoading(false);
          setPdfError(true);
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            setLoadingTimeout(null);
          }
          console.log('❌ PDF yüklenemedi');
          Alert.alert('PDF Hatası', 'PDF yüklenemedi. Bu PDF tarayıcıda desteklenmiyor olabilir.');
          break;
      }
    } catch (error) {
      console.log('WebView mesaj işleme hatası:', error);
      setWebViewLoading(false);
      setPdfError(true);
    }
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
          
          <TouchableOpacity style={styles.headerButton} onPress={sharePDF}>
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
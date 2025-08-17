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

  const createSolidPDFViewerHTML = (pdfUri: string, fileData?: string) => {
    let pdfSrc = pdfUri;
    
    if (fileData) {
      pdfSrc = `data:application/pdf;base64,${fileData}`;
    }

    // Escape the pdfSrc for JavaScript
    const escapedPdfSrc = pdfSrc.replace(/'/g, "\\'").replace(/"/g, '\\"');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
        <title>PDF Görüntüleyici</title>
        <!-- PDF.js Çalışan Stable Sürümü -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #2c2c2c;
            color: white;
            overflow: hidden;
            height: 100vh;
          }
          
          .pdf-container {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: #2c2c2c;
          }
          
          .pdf-header {
            background: linear-gradient(135deg, #E53E3E 0%, #C53030 100%);
            color: white;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 1000;
          }
          
          .header-title {
            font-size: 16px;
            font-weight: 600;
            flex: 1;
          }
          
          .page-info {
            font-size: 14px;
            color: rgba(255,255,255,0.9);
          }
          
          .pdf-content {
            flex: 1;
            position: relative;
            display: flex;
            flex-direction: column;
            background: #2c2c2c;
            overflow: hidden;
          }
          
          .canvas-container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: auto;
            background: #1a1a1a;
            padding: 20px;
          }
          
          #pdf-canvas {
            max-width: 100%;
            max-height: 100%;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            background: white;
            image-rendering: crisp-edges;
          }
          
          .pdf-controls {
            background: rgba(0,0,0,0.9);
            padding: 16px;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 16px;
            box-shadow: 0 -2px 8px rgba(0,0,0,0.3);
          }
          
          .control-button {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
            min-width: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .control-button:hover {
            background: rgba(255,255,255,0.2);
            transform: translateY(-2px);
          }
          
          .control-button:active {
            transform: translateY(0);
          }
          
          .control-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .zoom-controls {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          
          .zoom-level {
            font-size: 14px;
            color: rgba(255,255,255,0.8);
            min-width: 60px;
            text-align: center;
          }
          
          .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 2000;
          }
          
          .loading-spinner {
            width: 64px;
            height: 64px;
            border: 4px solid rgba(255,255,255,0.1);
            border-top: 4px solid #E53E3E;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 24px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .loading-text {
            font-size: 18px;
            color: white;
            font-weight: 500;
            margin-bottom: 8px;
          }
          
          .loading-subtext {
            font-size: 14px;
            color: rgba(255,255,255,0.7);
            text-align: center;
            max-width: 280px;
            line-height: 1.5;
          }
          
          .error-container {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            padding: 20px;
            text-align: center;
          }
          
          .error-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          
          .error-title {
            font-size: 20px;
            color: #E53E3E;
            font-weight: bold;
            margin-bottom: 12px;
          }
          
          .error-text {
            font-size: 14px;
            color: rgba(255,255,255,0.8);
            line-height: 1.5;
            margin-bottom: 24px;
            max-width: 320px;
          }
          
          .retry-button {
            background: #E53E3E;
            color: white;
            border: none;
            padding: 14px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .retry-button:hover {
            background: #C53030;
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="pdf-container">
          <div class="pdf-header">
            <div class="header-title">📄 PDF Görüntüleyici</div>
            <div id="page-info" class="page-info">Yükleniyor...</div>
          </div>
          
          <div class="pdf-content">
            <!-- Loading Overlay -->
            <div id="loading-overlay" class="loading-overlay">
              <div class="loading-spinner"></div>
              <div class="loading-text">PDF Hazırlanıyor</div>
              <div class="loading-subtext">PDF.js ile güvenli yükleme yapılıyor</div>
            </div>
            
            <!-- Error Container -->
            <div id="error-container" class="error-container">
              <div class="error-icon">❌</div>
              <div class="error-title">PDF Yüklenemedi</div>
              <div class="error-text">Bu PDF dosyası bozuk olabilir veya desteklenmiyor olabilir.</div>
              <button class="retry-button" onclick="retryLoad()">🔄 Tekrar Dene</button>
            </div>
            
            <!-- Canvas Container -->
            <div class="canvas-container">
              <canvas id="pdf-canvas" style="display: none;"></canvas>
            </div>
          </div>
          
          <!-- PDF Controls -->
          <div class="pdf-controls">
            <button id="prev-page" class="control-button" onclick="prevPage()">◀ Önceki</button>
            <div class="zoom-controls">
              <button class="control-button" onclick="zoomOut()">🔍−</button>
              <div id="zoom-level" class="zoom-level">100%</div>
              <button class="control-button" onclick="zoomIn()">🔍+</button>
            </div>
            <button id="next-page" class="control-button" onclick="nextPage()">Sonraki ▶</button>
          </div>
        </div>
        
        <script type="text/javascript">
          // PDF.js Configuration - UMD Build için
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js';
          
          let pdfDoc = null;
          let currentPage = 1;
          let totalPages = 1;
          let scale = 1.2;
          let isLoading = false;
          
          const canvas = document.getElementById('pdf-canvas');
          const ctx = canvas.getContext('2d');
          
          async function loadPDF() {
            if (isLoading) return;
            isLoading = true;
            
            try {
              console.log('PDF.js yükleme başladı:', '${escapedPdfSrc}');
              
              // Loading göster
              showLoading();
              
              // PDF dosyasını yükle - UMD syntax kullan
              const loadingTask = pdfjsLib.getDocument('${escapedPdfSrc}');
              pdfDoc = await loadingTask.promise;
              totalPages = pdfDoc.numPages;
              
              console.log('PDF başarıyla yüklendi. Sayfa sayısı:', totalPages);
              
              // İlk sayfayı render et
              await renderPage(1);
              
              // UI'yi güncelle
              hideLoading();
              showCanvas();
              updatePageInfo();
              
              // React Native'e bildir
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'pdfLoaded',
                  success: true,
                  totalPages: totalPages
                }));
              }
              
            } catch (error) {
              console.error('PDF yükleme hatası:', error);
              showError();
              
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'pdfError',
                  success: false,
                  error: error.message || 'PDF yüklenemedi'
                }));
              }
            } finally {
              isLoading = false;
            }
          }
          
          async function renderPage(pageNum) {
            if (!pdfDoc || pageNum < 1 || pageNum > totalPages) return;
            
            try {
              const page = await pdfDoc.getPage(pageNum);
              
              // Canvas boyutunu hesapla (mobile responsive)
              const containerWidth = Math.min(window.innerWidth - 40, 800);
              const viewport = page.getViewport({ scale: 1 });
              const actualScale = Math.min(scale, containerWidth / viewport.width);
              const scaledViewport = page.getViewport({ scale: actualScale });
              
              // Canvas boyutunu ayarla
              canvas.height = scaledViewport.height;
              canvas.width = scaledViewport.width;
              
              // Sayfayı render et
              const renderContext = {
                canvasContext: ctx,
                viewport: scaledViewport
              };
              
              await page.render(renderContext).promise;
              currentPage = pageNum;
              updatePageInfo();
              
              console.log('Sayfa render edildi:', pageNum);
              
            } catch (error) {
              console.error('Sayfa render hatası:', error);
              showError();
            }
          }
          
          function updatePageInfo() {
            document.getElementById('page-info').textContent = currentPage + ' / ' + totalPages;
            document.getElementById('prev-page').disabled = (currentPage <= 1);
            document.getElementById('next-page').disabled = (currentPage >= totalPages);
            document.getElementById('zoom-level').textContent = Math.round(scale * 100) + '%';
          }
          
          function showLoading() {
            document.getElementById('loading-overlay').style.display = 'flex';
            document.getElementById('error-container').style.display = 'none';
            document.getElementById('pdf-canvas').style.display = 'none';
          }
          
          function showError() {
            document.getElementById('loading-overlay').style.display = 'none';
            document.getElementById('error-container').style.display = 'flex';
            document.getElementById('pdf-canvas').style.display = 'none';
          }
          
          function hideLoading() {
            document.getElementById('loading-overlay').style.display = 'none';
            document.getElementById('error-container').style.display = 'none';
          }
          
          function showCanvas() {
            document.getElementById('pdf-canvas').style.display = 'block';
          }
          
          // Navigation Functions
          window.prevPage = async function() {
            if (currentPage > 1) {
              await renderPage(currentPage - 1);
            }
          };
          
          window.nextPage = async function() {
            if (currentPage < totalPages) {
              await renderPage(currentPage + 1);
            }
          };
          
          // Zoom Functions
          window.zoomIn = async function() {
            if (scale < 3) {
              scale += 0.25;
              await renderPage(currentPage);
            }
          };
          
          window.zoomOut = async function() {
            if (scale > 0.5) {
              scale -= 0.25;
              await renderPage(currentPage);
            }
          };
          
          window.retryLoad = function() {
            loadPDF();
          };
          
          // PDF.js initialization check ve auto load
          window.addEventListener('load', () => {
            console.log('PDF viewer HTML yüklendi');
            
            // PDF.js yüklenip yüklenmediğini kontrol et
            if (typeof pdfjsLib === 'undefined') {
              console.error('PDF.js kütüphanesi yüklenemedi');
              showError();
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'pdfError',
                  success: false,
                  error: 'PDF.js library yüklenemedi'
                }));
              }
              return;
            }
            
            console.log('PDF.js başarıyla yüklendi, PDF yükleme başlıyor...');
            setTimeout(loadPDF, 500);
          });
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
              html: createSolidPDFViewerHTML(pdf?.uri || '', pdf?.fileData) 
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
            scrollEnabled={false}
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
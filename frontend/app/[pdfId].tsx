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

  const sharePDF = () => {
    if (!pdf) return;
    Alert.alert('Paylaş', `${pdf.name} paylaşılıyor...`);
    // TODO: Implement sharing functionality
  };

  const goBack = () => {
    router.back();
  };

  // PDF görüntüleme için HTML içeriği oluştur - Google Drive Viewer yaklaşımı  
  const createPDFViewerHTML = (pdfUri: string, fileData?: string) => {
    let pdfSrc = pdfUri;
    
    // Eğer base64 data varsa onu kullan
    if (fileData) {
      pdfSrc = `data:application/pdf;base64,${fileData}`;
    }

    // Google Drive Viewer URL'i oluştur (eğer external URL ise)
    let viewerUrl = pdfSrc;
    if (pdfSrc.startsWith('http') && !pdfSrc.includes('drive.google.com')) {
      viewerUrl = `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(pdfSrc)}`;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
        <title>PDF Görüntüleyici</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background-color: #f5f5f5;
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
          }
          
          .pdf-viewer {
            flex: 1;
            border: none;
            width: 100%;
            background: white;
          }
          
          .loading-container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            background: #f5f5f5;
            color: #666;
          }
          
          .error-container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            background: #f5f5f5;
            color: #e53e3e;
            padding: 20px;
            text-align: center;
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
          
          .simple-viewer {
            flex: 1;
            display: none;
            flex-direction: column;
            background: white;
            padding: 20px;
            text-align: center;
          }
          
          .pdf-link {
            display: inline-block;
            background: #E53E3E;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="pdf-container">
          <div class="pdf-controls">
            <span id="status-text" class="status-text">📄 PDF Yükleniyor...</span>
            <div style="font-size: 12px; opacity: 0.8;">PDF Viewer</div>
          </div>
          
          <div id="loading-container" class="loading-container">
            <div class="spinner"></div>
            <div class="status-text">PDF hazırlanıyor...</div>
            <div style="font-size: 12px; color: #999; margin-top: 8px;">Lütfen bekleyin</div>
          </div>
          
          <div id="error-container" class="error-container" style="display: none;">
            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
            <div class="status-text">PDF Yüklenemedi</div>
            <div style="font-size: 14px; margin-top: 8px;">Dosya bozuk olabilir</div>
            <button class="retry-button" onclick="retryLoad()">Tekrar Dene</button>
          </div>
          
          <div id="simple-viewer" class="simple-viewer">
            <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
            <div class="status-text">PDF Görüntüleme</div>
            <div style="font-size: 14px; margin-top: 8px; color: #666;">Bu PDF doğrudan görüntülenemiyor</div>
            <a href="${pdfSrc}" target="_blank" class="pdf-link">PDF'i Tarayıcıda Aç</a>
          </div>
          
          <iframe 
            id="pdf-viewer"
            class="pdf-viewer"
            style="display: none;"
            onload="onPDFLoad()"
            onerror="onPDFError()"
            title="PDF Viewer"
            src="${viewerUrl}"
          ></iframe>
        </div>
        
        <script>
          let pdfLoaded = false;
          let loadTimeout = null;
          let attemptCount = 0;
          
          // PDF yükleme timeout (8 saniye)
          function startLoadTimeout() {
            clearTimeout(loadTimeout);
            loadTimeout = setTimeout(() => {
              if (!pdfLoaded) {
                attemptCount++;
                if (attemptCount < 2) {
                  // İkinci deneme: basit viewer'ı göster
                  showSimpleViewer();
                } else {
                  onPDFError();
                }
              }
            }, 8000);
          }
          
          function onPDFLoad() {
            clearTimeout(loadTimeout);
            pdfLoaded = true;
            
            document.getElementById('loading-container').style.display = 'none';
            document.getElementById('error-container').style.display = 'none';
            document.getElementById('simple-viewer').style.display = 'none';
            document.getElementById('pdf-viewer').style.display = 'block';
            document.getElementById('status-text').textContent = '✅ PDF Yüklendi';
            
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pdfLoaded'
            }));
          }
          
          function onPDFError() {
            clearTimeout(loadTimeout);
            
            document.getElementById('loading-container').style.display = 'none';
            document.getElementById('pdf-viewer').style.display = 'none';
            document.getElementById('simple-viewer').style.display = 'none';
            document.getElementById('error-container').style.display = 'flex';
            document.getElementById('status-text').textContent = '❌ PDF Yüklenemedi';
            
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pdfError'
            }));
          }
          
          function showSimpleViewer() {
            clearTimeout(loadTimeout);
            
            document.getElementById('loading-container').style.display = 'none';
            document.getElementById('error-container').style.display = 'none';
            document.getElementById('pdf-viewer').style.display = 'none';
            document.getElementById('simple-viewer').style.display = 'flex';
            document.getElementById('status-text').textContent = '📄 PDF Mevcut';
            
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pdfPartialLoad'
            }));
          }
          
          function retryLoad() {
            pdfLoaded = false;
            attemptCount = 0;
            document.getElementById('loading-container').style.display = 'flex';
            document.getElementById('error-container').style.display = 'none';
            document.getElementById('simple-viewer').style.display = 'none';
            document.getElementById('pdf-viewer').style.display = 'none';
            document.getElementById('status-text').textContent = '🔄 Yeniden Yükleniyor...';
            
            // PDF'i yeniden yükle
            const iframe = document.getElementById('pdf-viewer');
            iframe.src = iframe.src + '&_retry=' + Date.now();
            startLoadTimeout();
          }
          
          // PDF'i yükle
          function loadPDF() {
            startLoadTimeout();
          }
          
          // Sayfa yüklendiğinde PDF'i başlat
          window.onload = function() {
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
          break;
        case 'pdfError':
          setWebViewLoading(false);
          setPdfError(true);
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            setLoadingTimeout(null);
          }
          Alert.alert('Hata', 'PDF yüklenemedi. Dosya bozuk olabilir veya desteklenmiyor.');
          break;
        case 'zoomChanged':
          // Zoom değişikliği handle edilebilir
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

      {/* PDF Viewer */}
      <View style={styles.pdfContainer}>
        {webViewLoading && (
          <View style={styles.webViewLoading}>
            <ActivityIndicator size="large" color="#E53E3E" />
            <Text style={styles.loadingText}>PDF Hazırlanıyor...</Text>
            <Text style={styles.loadingSubtext}>Bu biraz zaman alabilir</Text>
          </View>
        )}
        
        {pdfError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color="#E53E3E" />
            <Text style={styles.errorTitle}>PDF Yüklenemedi</Text>
            <Text style={styles.errorText}>
              Dosya bozuk olabilir veya desteklenmiyor olabilir.
            </Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={() => {
                setPdfError(false);
                setWebViewLoading(true);
                // Force reload WebView
                const webViewRef = React.createRef<any>();
                if (webViewRef.current) {
                  webViewRef.current.reload();
                }
              }}
            >
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.retryText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {!pdfError && (
          <WebView
            style={[styles.webView, webViewLoading && { opacity: 0 }]}
            source={{ 
              html: createPDFViewerHTML(pdf?.uri || '', pdf?.fileData) 
            }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            scalesPageToFit={true}
            startInLoadingState={false}
            onLoadStart={() => {
              if (!pdfError) {
                setWebViewLoading(true);
              }
            }}
            onLoadEnd={() => {
              // Loading durumu WebView mesajları ile kontrol edilecek
            }}
            onError={(error) => {
              console.log('WebView hatası:', error);
              setWebViewLoading(false);
              setPdfError(true);
            }}
            onHttpError={(error) => {
              console.log('WebView HTTP hatası:', error);
              setWebViewLoading(false);
              setPdfError(true);
            }}
          />
        )}
      </View>

      {/* Footer Info */}
      {!webViewLoading && !pdfError && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Boyut: {formatFileSize(pdf?.size || 0)}
          </Text>
        </View>
      )}
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
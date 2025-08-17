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
    // 15 saniye timeout ekle
    if (webViewLoading) {
      const timeout = setTimeout(() => {
        setWebViewLoading(false);
        setPdfError(true);
        Alert.alert('Zaman Aşımı', 'PDF yüklenirken zaman aşımına uğradı. Lütfen tekrar deneyin.');
      }, 15000);
      
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
  }, [webViewLoading]);

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

  // PDF görüntüleme için HTML içeriği oluştur
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
            font-family: Arial, sans-serif;
          }
          
          .pdf-container {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .pdf-controls {
            background-color: #333;
            color: white;
            padding: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 14px;
          }
          
          .pdf-viewer {
            flex: 1;
            border: none;
          }
          
          .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            color: #666;
          }
          
          .error {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            color: #e53e3e;
            flex-direction: column;
          }
          
          .zoom-controls {
            display: flex;
            gap: 10px;
          }
          
          .zoom-button {
            background-color: #555;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
          }
          
          .zoom-button:hover {
            background-color: #666;
          }
        </style>
      </head>
      <body>
        <div class="pdf-container">
          <div class="pdf-controls">
            <span id="page-info">PDF Yükleniyor...</span>
            <div class="zoom-controls">
              <button class="zoom-button" onclick="zoomOut()">-</button>
              <span id="zoom-level">${Math.round(zoom * 100)}%</span>
              <button class="zoom-button" onclick="zoomIn()">+</button>
            </div>
          </div>
          
          <iframe 
            id="pdf-viewer"
            class="pdf-viewer"
            src="${pdfSrc}#zoom=${Math.round(zoom * 100)}"
            onload="onPDFLoad()"
            onerror="onPDFError()"
          ></iframe>
        </div>
        
        <script>
          let currentZoom = ${zoom};
          
          function onPDFLoad() {
            document.getElementById('page-info').textContent = '✅ PDF Yüklendi';
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pdfLoaded',
              zoom: currentZoom
            }));
          }
          
          function onPDFError() {
            document.getElementById('pdf-viewer').style.display = 'none';
            document.getElementById('page-info').innerHTML = '❌ PDF Yüklenemedi';
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pdfError'
            }));
          }
          
          function zoomIn() {
            if (currentZoom < 3) {
              currentZoom += 0.25;
              updateZoom();
            }
          }
          
          function zoomOut() {
            if (currentZoom > 0.5) {
              currentZoom -= 0.25;
              updateZoom();
            }
          }
          
          function updateZoom() {
            const iframe = document.getElementById('pdf-viewer');
            const zoomLevel = document.getElementById('zoom-level');
            
            iframe.src = iframe.src.split('#')[0] + '#zoom=' + Math.round(currentZoom * 100);
            zoomLevel.textContent = Math.round(currentZoom * 100) + '%';
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'zoomChanged',
              zoom: currentZoom
            }));
          }
          
          // PDF yüklendikten sonra sayfa bilgilerini güncelle
          setInterval(() => {
            try {
              const iframe = document.getElementById('pdf-viewer');
              if (iframe && iframe.contentWindow) {
                // PDF.js ile sayfa bilgilerini al (eğer mümkünse)
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'pageInfo',
                  currentPage: 1,
                  totalPages: 1
                }));
              }
            } catch (e) {
              // Sayfa bilgisi alınamadı
            }
          }, 2000);
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
          setZoom(data.zoom || 1);
          break;
        case 'pdfError':
          setWebViewLoading(false);
          Alert.alert('Hata', 'PDF yüklenemedi. Dosya bozuk olabilir.');
          break;
        case 'zoomChanged':
          setZoom(data.zoom || 1);
          break;
        case 'pageInfo':
          setCurrentPage(data.currentPage || 1);
          setTotalPages(data.totalPages || 1);
          break;
      }
    } catch (error) {
      console.log('WebView mesaj işleme hatası:', error);
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
          </View>
        )}
        
        <WebView
          style={[styles.webView, webViewLoading && { opacity: 0 }]}
          source={{ 
            html: createPDFViewerHTML(pdf.uri, pdf.fileData) 
          }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          scalesPageToFit={true}
          startInLoadingState={false}
          onLoadStart={() => setWebViewLoading(true)}
          onLoadEnd={() => setWebViewLoading(false)}
          onError={() => {
            setWebViewLoading(false);
            Alert.alert('Hata', 'PDF yüklenirken bir sorun oluştu.');
          }}
        />
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Zoom: {Math.round(zoom * 100)}% • Boyut: {formatFileSize(pdf.size)}
        </Text>
        {totalPages > 1 && (
          <Text style={styles.footerText}>
            Sayfa: {currentPage}/{totalPages}
          </Text>
        )}
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
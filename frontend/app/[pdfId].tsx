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
import Constants from 'expo-constants';

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
  const [error, setError] = useState<string | null>(null);
  const [webViewLoading, setWebViewLoading] = useState(true);
  
  const [showAnnotationMode, setShowAnnotationMode] = useState(false);
  const [annotations, setAnnotations] = useState<Array<{
    id: string;
    x: number;
    y: number;
    text: string;
    page: number;
    type?: string;
    color?: string;
    width?: number;
    height?: number;
    text_content?: string;
    stroke_width?: number;
    drawing_data?: string;
    tool?: string;
  }>>([]);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [highlightMode, setHighlightMode] = useState(false);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState('#FFFF00');
  const [drawingMode, setDrawingMode] = useState(false);
  const [selectedDrawingColor, setSelectedDrawingColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [drawingTool, setDrawingTool] = useState('pen'); // pen, highlighter, eraser

  const EXPO_PUBLIC_BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    if (pdfId) {
      fetchPdf();
    }
  }, [pdfId]);

  useEffect(() => {
    if (pdf) {
      loadAnnotations();
    }
  }, [pdf]);

  const fetchPdf = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdfId}`);
      if (response.ok) {
        const data = await response.json();
        setPdf(data);
      } else {
        setError('PDF bulunamadı');
      }
    } catch (error) {
      console.error('PDF yüklenirken hata:', error);
      setError('PDF yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Annotation işlemleri
  const loadAnnotations = async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdfId}/annotations`);
      if (response.ok) {
        const data = await response.json();
        setAnnotations(data.annotations || []);
      }
    } catch (error) {
      console.error('Annotations yüklenirken hata:', error);
    }
  };

  const addAnnotation = async (x: number, y: number, text: string, page: number = 1) => {
    try {
      const annotationData = {
        type: 'text',
        x,
        y,
        width: 0,
        height: 0,
        page,
        content: text,
        color: '#FFFF00'
      };

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdfId}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(annotationData),
      });

      if (response.ok) {
        const result = await response.json();
        setAnnotations(prev => [...prev, result.annotation]);
        return result.annotation;
      } else {
        throw new Error('Annotation eklenemedi');
      }
    } catch (error) {
      console.error('Annotation ekleme hatası:', error);
      Alert.alert('Hata', 'Not eklenemedi');
      throw error;
    }
  };

  const showAddNoteDialog = () => {
    Alert.prompt(
      'Yeni Not',
      'PDF üzerine eklemek istediğiniz notu yazın:',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Ekle',
          onPress: (text) => {
            if (text && text.trim()) {
              // Rastgele pozisyon (gerçek implementasyonda kullanıcı tıkladığı yeri kullanırız)
              const randomX = Math.floor(Math.random() * 500) + 50;
              const randomY = Math.floor(Math.random() * 300) + 50;
              addAnnotation(randomX, randomY, text.trim());
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const saveAnnotations = async () => {
    try {
      // Tüm annotation'lar zaten backend'e kaydedilmiş durumda
      // Bu fonksiyon başka kaydetme işlemleri için kullanılabilir
      Alert.alert('Başarılı', `${annotations.length} not kaydedildi.`);
    } catch (error) {
      Alert.alert('Hata', 'Notlar kaydedilemedi.');
    }
  };

  // Loading state için early return
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

  // Error state için early return
  if (!pdf) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ PDF bulunamadı</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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

  // Main component return
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
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

      {/* Ana PDF Viewer */}
      <View style={styles.pdfContainer}>
        {/* Annotation Tools */}
        {showAnnotationMode && (
          <View style={styles.annotationToolbar}>
            <TouchableOpacity 
              style={styles.toolButton}
              onPress={() => {
                setShowAnnotationMode(false);
                setHighlightMode(false);
                setDrawingMode(false);
              }}
            >
              <Text style={styles.toolButtonText}>✏️ Düzenleme Kapat</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.toolButton}
              onPress={showAddNoteDialog}
            >
              <Text style={styles.toolButtonText}>📝 Not Ekle</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.toolButton, highlightMode && styles.activeToolButton]}
              onPress={() => {
                setHighlightMode(!highlightMode);
                setDrawingMode(false);
              }}
            >
              <Text style={styles.toolButtonText}>🖍️ İşaretleme</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.toolButton, drawingMode && styles.activeToolButton]}
              onPress={() => {
                setDrawingMode(!drawingMode);
                setHighlightMode(false);
              }}
            >
              <Text style={styles.toolButtonText}>✏️ Çizim</Text>
            </TouchableOpacity>

            {highlightMode && (
              <View style={styles.colorPicker}>
                {['#FFFF00', '#00FF00', '#00BFFF', '#FF69B4', '#FFA500'].map((color, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color },
                      selectedHighlightColor === color && styles.selectedColorButton
                    ]}
                    onPress={() => setSelectedHighlightColor(color)}
                  />
                ))}
              </View>
            )}

            {drawingMode && (
              <View style={styles.drawingToolbar}>
                {/* Drawing Colors */}
                <View style={styles.colorPicker}>
                  {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'].map((color, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.colorButton,
                        { backgroundColor: color },
                        selectedDrawingColor === color && styles.selectedColorButton
                      ]}
                      onPress={() => setSelectedDrawingColor(color)}
                    />
                  ))}
                </View>
                
                {/* Stroke Width Selector */}
                <View style={styles.strokeSelector}>
                  {[1, 2, 4, 6].map((width) => (
                    <TouchableOpacity
                      key={width}
                      style={[
                        styles.strokeButton,
                        strokeWidth === width && styles.selectedStrokeButton
                      ]}
                      onPress={() => setStrokeWidth(width)}
                    >
                      <View style={[styles.strokePreview, { height: width * 2, backgroundColor: selectedDrawingColor }]} />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Drawing Tools */}
                <View style={styles.toolSelector}>
                  <TouchableOpacity
                    style={[styles.drawingToolButton, drawingTool === 'pen' && styles.activeDrawingTool]}
                    onPress={() => setDrawingTool('pen')}
                  >
                    <Text style={styles.drawingToolText}>🖊️</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.drawingToolButton, drawingTool === 'highlighter' && styles.activeDrawingTool]}
                    onPress={() => setDrawingTool('highlighter')}
                  >
                    <Text style={styles.drawingToolText}>🖍️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.toolButton}
              onPress={saveAnnotations}
            >
              <Text style={styles.toolButtonText}>💾 Kaydet</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PDF Viewer Content */}
        <View style={styles.viewerContainer}>
          <Text style={styles.viewerTitle}>📄 PDF Görüntüleyici</Text>
          
          {annotations.length > 0 && (
            <Text style={styles.annotationCount}>
              📝 {annotations.length} not mevcut
            </Text>
          )}
          
          {!showAnnotationMode && (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setShowAnnotationMode(true)}
            >
              <Text style={styles.editButtonText}>✏️ PDF'i Düzenle</Text>
            </TouchableOpacity>
          )}
          
          {drawingMode && (
            <TouchableOpacity 
              style={styles.testButton}
              onPress={simulateDrawing}
            >
              <Text style={styles.testButtonText}>✏️ Test Çizim</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.viewButton} 
            onPress={() => console.log('PDF uygulama içinde açılıyor:', pdf.name)}
          >
            <Text style={styles.viewButtonText}>📖 PDF'i Görüntüle</Text>
          </TouchableOpacity>
        </View>

        {/* Alternative PDF Viewer for Web */}
        {pdf.uri && (
          <View style={styles.webPdfContainer}>
            <Text style={styles.webPdfText}>
              Web Preview - PDF'i açmak için aşağıdaki linke tıklayın:
            </Text>
            <TouchableOpacity 
              style={styles.webPdfButton}
              onPress={() => {
                if (pdf.uri.startsWith('http')) {
                  window.open(pdf.uri, '_blank');
                } else {
                  window.open(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/${pdf.id}/view`, '_blank');
                }
              }}
            >
              <Text style={styles.webPdfButtonText}>🔗 PDF'i Yeni Sekmede Aç</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WebView for Mobile - Native olarak çalışacak */}
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
      </View>
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
  retryButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  retryButtonText: {
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
  annotationToolbar: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexWrap: 'wrap',
  },
  toolButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  activeToolButton: {
    backgroundColor: '#28a745',
  },
  toolButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  colorPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  colorButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorButton: {
    borderColor: '#333',
    borderWidth: 3,
  },
  drawingToolbar: {
    flexDirection: 'column',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  strokeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  strokeButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginHorizontal: 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedStrokeButton: {
    borderColor: '#E53E3E',
    borderWidth: 2,
  },
  strokePreview: {
    borderRadius: 2,
    width: 20,
  },
  toolSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  drawingToolButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginHorizontal: 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDrawingTool: {
    borderColor: '#28a745',
    borderWidth: 2,
    backgroundColor: '#f8fff8',
  },
  drawingToolText: {
    fontSize: 16,
  },
  viewerContainer: {
    padding: 20,
    alignItems: 'center',
  },
  viewerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  annotationCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  editButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  viewButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#17a2b8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  webPdfContainer: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E53E3E',
    borderStyle: 'dashed',
  },
  webPdfText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  webPdfButton: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  webPdfButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
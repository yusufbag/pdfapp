import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AddURL() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const addPDFFromURL = async () => {
    if (!url.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir URL girin.');
      return;
    }

    // URL doğrulama
    if (!isValidURL(url)) {
      Alert.alert('Hata', 'Lütfen geçerli bir URL formatı girin.\nÖrnek: https://example.com/document.pdf');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/pdfs/from-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (response.ok) {
        const pdfData = await response.json();
        Alert.alert(
          'Başarılı', 
          'PDF başarıyla eklendi!',
          [
            {
              text: 'Tamam',
              onPress: () => router.back()
            }
          ]
        );
      } else {
        const errorData = await response.json();
        Alert.alert('Hata', errorData.detail || 'PDF eklenirken bir hata oluştu.');
      }
    } catch (error) {
      console.log('URL\'den PDF ekleme hatası:', error);
      Alert.alert('Hata', 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const isValidURL = (string: string) => {
    try {
      new URL(string);
      return string.startsWith('http://') || string.startsWith('https://');
    } catch (_) {
      return false;
    }
  };

  const pasteFromClipboard = async () => {
    try {
      // React Native'de Clipboard kullanmak için expo-clipboard gerekir
      // Şimdilik manuel yapıştırma kullanıcıya bırakılır
      Alert.alert('Bilgi', 'URL\'i kopyala-yapıştır ile ekleyebilirsiniz.');
    } catch (error) {
      console.log('Pano hatası:', error);
    }
  };

  const addSampleURL = () => {
    setUrl('https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          
          <Text style={styles.title}>URL'den PDF Ekle</Text>
          
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={pasteFromClipboard}
          >
            <Ionicons name="clipboard-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.instructions}>
            <Ionicons name="information-circle" size={24} color="#E53E3E" />
            <Text style={styles.instructionText}>
              PDF dosyasının doğrudan linkini girin. Link https:// ile başlamalıdır.
            </Text>
          </View>

          {/* URL Input */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>PDF URL'i</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={url}
                onChangeText={setUrl}
                placeholder="https://example.com/document.pdf"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={addPDFFromURL}
              />
              {url.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearButton} 
                  onPress={() => setUrl('')}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Sample URL */}
          <TouchableOpacity 
            style={styles.sampleButton} 
            onPress={addSampleURL}
          >
            <Ionicons name="link" size={20} color="#E53E3E" />
            <Text style={styles.sampleText}>Örnek PDF URL'i kullan</Text>
          </TouchableOpacity>

          {/* URL Validation */}
          {url.length > 0 && (
            <View style={styles.validationContainer}>
              <Ionicons 
                name={isValidURL(url) ? "checkmark-circle" : "alert-circle"} 
                size={20} 
                color={isValidURL(url) ? "#10B981" : "#EF4444"} 
              />
              <Text style={[
                styles.validationText,
                { color: isValidURL(url) ? "#10B981" : "#EF4444" }
              ]}>
                {isValidURL(url) ? "Geçerli URL formatı" : "Geçersiz URL formatı"}
              </Text>
            </View>
          )}

          {/* Tips */}
          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>💡 İpuçları:</Text>
            <Text style={styles.tipText}>• URL'in doğrudan PDF dosyasına işaret ettiğinden emin olun</Text>
            <Text style={styles.tipText}>• Bazı siteler doğrudan PDF linkine izin vermeyebilir</Text>
            <Text style={styles.tipText}>• Dosya boyutu büyükse yükleme biraz zaman alabilir</Text>
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity 
            style={[styles.cancelButton]} 
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>İptal</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.addButton, 
              (!url.trim() || !isValidURL(url) || loading) && styles.disabledButton
            ]} 
            onPress={addPDFFromURL}
            disabled={!url.trim() || !isValidURL(url) || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.addButtonText}>PDF Ekle</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardContainer: {
    flex: 1,
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
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  clearButton: {
    padding: 12,
  },
  sampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  sampleText: {
    fontSize: 14,
    color: '#E53E3E',
    marginLeft: 8,
    fontWeight: '500',
  },
  validationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  validationText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  tips: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  addButton: {
    flex: 2,
    backgroundColor: '#E53E3E',
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
});
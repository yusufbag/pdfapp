import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#E53E3E" />
      <Stack
        screenOptions={{
          headerShown: false, // Tüm sayfalar için header'ı gizle
          contentStyle: { backgroundColor: '#f5f5f5' },
          animation: 'slide_from_right', // iOS tarzı geçiş animasyonu
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{
            title: 'PDF Görüntüleyici',
          }} 
        />
        <Stack.Screen 
          name="[pdfId]" 
          options={{
            title: 'PDF Görüntüleyici',
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="add-url" 
          options={{
            title: 'URL\'den PDF Ekle',
            presentation: 'modal',
          }} 
        />
      </Stack>
    </>
  );
}
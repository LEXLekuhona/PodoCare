import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ensureSessionReady } from '@/features/auth/session-store';
import { syncPushDeviceWithServer } from '@/features/push/sync-push-device';

export default function AppLayout() {
  const router = useRouter();
  const [gate, setGate] = useState<'checking' | 'ok' | 'no'>('checking');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await ensureSessionReady();
      if (!cancelled) setGate(ok ? 'ok' : 'no');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gate !== 'no') return;
    router.replace('/(auth)/phone');
  }, [gate, router]);

  useEffect(() => {
    if (gate !== 'ok') return;
    void syncPushDeviceWithServer();
  }, [gate]);

  if (gate !== 'ok') {
    return (
      <View style={styles.gate}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="studio-selector"
        options={{
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen name="specialists" options={{ headerShown: false }} />
      <Stack.Screen name="date-time" options={{ headerShown: false }} />
      <Stack.Screen name="booking-confirm" options={{ headerShown: false }} />
      <Stack.Screen name="booking-created" options={{ headerShown: false }} />
      <Stack.Screen name="service-selection" options={{ headerShown: false }} />
      <Stack.Screen name="health-concern/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="studio-direction/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="feedback" options={{ headerShown: false }} />
      <Stack.Screen name="faq" options={{ headerShown: false }} />
      <Stack.Screen name="consents" options={{ headerShown: false }} />
      <Stack.Screen name="consent-document" options={{ headerShown: false }} />
      <Stack.Screen name="profile-edit" options={{ headerShown: false }} />
      <Stack.Screen name="medical-card" options={{ headerShown: false }} />
      <Stack.Screen name="medical-card/visit/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

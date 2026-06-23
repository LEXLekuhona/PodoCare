import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { ensureSessionReady } from '@/features/auth/session-store';
import { getAppBranding } from '@/shared/config/branding';
import { LeafLogo } from '@/shared/ui/icons/LeafLogo';

export default function SplashScreen() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await ensureSessionReady();
      if (cancelled) return;
      if (ok) router.replace('/(app)/(tabs)');
      else router.replace('/(auth)/phone');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.root} lightColor="#2D6A4F" darkColor="#2D6A4F">
      <View style={styles.logoWrap} lightColor="transparent" darkColor="transparent">
        <LeafLogo size={128} color="#707973" />
      </View>

      <View style={styles.textBlock} lightColor="transparent" darkColor="transparent">
        <Text style={styles.title} lightColor="#FFFFFF" darkColor="#FFFFFF">
          {getAppBranding().brandName}
        </Text>
        <Text style={styles.subtitle} lightColor="#95D4B3" darkColor="#95D4B3">
          ЗАБОТА О ВАШЕМ ЗДОРОВЬЕ
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    gap: 24,
  },
  logoWrap: {},
  textBlock: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
});

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const GREEN = '#2D6A4F';
const STAR_EMPTY = 'rgba(191,201,193,0.95)';

export default function FeedbackScreen() {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    void new Promise<void>((resolve) => setTimeout(resolve, 280)).then(() => {
      setSubmitting(false);
      Alert.alert('Спасибо!', 'Ваша оценка очень важна для нас.', [{ text: 'OK', onPress: () => router.back() }]);
    });
  };

  return (
    <View style={styles.root} lightColor="#FFFFFF" darkColor="#06130E">
      <SafeAreaPadding minTop={10} minBottom={0} style={styles.topNav} lightColor="transparent" darkColor="transparent">
        <RNView style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(app)/(tabs)/profile');
            }}
            accessibilityLabel="Назад"
            style={({ pressed }) => [styles.headerSideBtn, pressed && styles.pressed]}
          >
            <Text style={styles.backGlyph} lightColor="#2D6A4F" darkColor="#95D4B3">
              ‹
            </Text>
          </Pressable>
          <Text style={styles.headerTitle} lightColor={GREEN} darkColor="#95D4B3">
            Обратная связь
          </Text>
          <RNView style={styles.headerSideBtn} />
        </RNView>
      </SafeAreaPadding>

      <RNView style={styles.main}>
        <Text style={styles.h1} lightColor="#1A1A2E" darkColor="#FFFFFF">
          Как вам приложение?
        </Text>
        <Text style={styles.sub} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
          Поставьте оценку
        </Text>

        <View style={styles.starCard} lightColor="#FFFFFF" darkColor="#0C1A14">
          <RNView style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = rating >= n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`Оценка ${n} из 5`}
                  accessibilityState={{ selected: filled }}
                  onPress={() => setRating(n)}
                  style={({ pressed }) => [styles.starHit, pressed && styles.pressed]}
                >
                  <FontAwesome name={filled ? 'star' : 'star-o'} size={34} color={filled ? GREEN : STAR_EMPTY} />
                </Pressable>
              );
            })}
          </RNView>
        </View>

        <Pressable
          onPress={() => void submit()}
          disabled={rating < 1 || submitting}
          style={({ pressed }) => [
            styles.submitBtn,
            (rating < 1 || submitting) && styles.submitBtnDisabled,
            pressed && rating >= 1 && !submitting && styles.pressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText} lightColor="#FFFFFF" darkColor="#FFFFFF">
              Отправить
            </Text>
          )}
        </Pressable>
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topNav: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSideBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 28,
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  main: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 12,
  },
  h1: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: Platform.select({ ios: 'Liberation Serif', android: 'serif' }),
  },
  sub: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  starCard: {
    marginTop: 28,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  starHit: {
    padding: 8,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    marginTop: 32,
    height: 56,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.38,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pressed: {
    opacity: 0.85,
  },
});

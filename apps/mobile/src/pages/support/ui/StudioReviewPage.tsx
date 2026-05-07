import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { ApiError } from '@/shared/api/api-error';
import { submitReview } from '@/features/reviews/reviews-api';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const GREEN = '#2D6A4F';
const MAX_LEN = 2000;
const MIN_LEN = 8;

export function StudioReviewPage() {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const t = text.trim();
    if (t.length < MIN_LEN) {
      Alert.alert('Отзыв', `Напишите хотя бы пару предложений (от ${MIN_LEN} символов).`);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitReview({ comment: t, allowPublish: false });
      setText('');
      Alert.alert('Спасибо!', 'Отзыв отправлен. Мы обязательно его прочитаем.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      const message =
        e instanceof ApiError && e.message
          ? e.message
          : 'Не удалось отправить отзыв. Проверьте интернет и попробуйте ещё раз.';
      Alert.alert('Не удалось отправить', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
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
            Отзыв о визите
          </Text>
          <RNView style={styles.headerSideBtn} />
        </RNView>
      </SafeAreaPadding>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <RNView style={styles.main}>
          <RNView style={styles.hintRow}>
            <FontAwesome name="pencil" size={18} color={GREEN} />
            <Text style={styles.hint} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
              Расскажите, как прошёл визит. Мы передадим отзыв администратору студии. При сбое сети — предложим отправить письмом.
            </Text>
          </RNView>

          <View style={styles.inputCard} lightColor="#FFFFFF" darkColor="#0C1A14">
            <TextInput
              value={text}
              onChangeText={(v) => setText(v.length > MAX_LEN ? v.slice(0, MAX_LEN) : v)}
              placeholder="Например: понравилась атмосфера и внимание специалиста…"
              placeholderTextColor="rgba(112,121,115,0.65)"
              multiline
              textAlignVertical="top"
              style={styles.input}
              editable={!submitting}
            />
            <Text style={styles.counter} lightColor="rgba(112,121,115,0.75)" darkColor="rgba(149,163,160,0.65)">
              {text.length} / {MAX_LEN}
            </Text>
          </View>

          <Pressable
            onPress={() => void submit()}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitBtn,
              submitting && styles.submitBtnDisabled,
              pressed && !submitting && styles.pressed,
            ]}
          >
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : null}
            {!submitting ? (
              <Text style={styles.submitBtnText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                Отправить отзыв
              </Text>
            ) : null}
          </Pressable>
        </RNView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topNav: { paddingHorizontal: 8, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSideBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 28, fontWeight: '300' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  main: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  hint: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  inputCard: {
    flex: 1,
    minHeight: 200,
    maxHeight: 360,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    padding: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: '#1A1A2E',
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  counter: { fontSize: 12, marginTop: 8, textAlign: 'right' },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { fontSize: 17, fontWeight: '800', fontFamily: 'PlusJakartaSans_800ExtraBold' },
  pressed: { opacity: 0.88 },
});

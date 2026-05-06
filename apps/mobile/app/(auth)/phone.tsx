import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { requestOtp } from '@/features/auth/auth-api';
import { ApiError } from '@/shared/api/api-error';
import { digitsToRuE164 } from '@/shared/lib/phone';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

function formatRuPhone(digits: string) {
  const d = onlyDigits(digits).slice(0, 10);
  if (d.length === 0) return '';
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 8);
  const p4 = d.slice(8, 10);

  if (d.length <= 3) return `(${p1}`;
  if (d.length <= 6) return `(${p1}) ${p2}`;
  if (d.length <= 8) return `(${p1}) ${p2}-${p3}`;
  return `(${p1}) ${p2}-${p3}-${p4}`;
}

export default function LoginPhoneScreen() {
  const [digits, setDigits] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const isValid = useMemo(() => onlyDigits(digits).length === 10, [digits]);
  const formatted = useMemo(() => formatRuPhone(digits), [digits]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.screen}>
          <RNView style={styles.decorBlob} pointerEvents="none" />

        <SafeAreaPadding minTop={10} minBottom={0} style={styles.topNav} lightColor="transparent" darkColor="transparent">
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(auth)');
            }}
            accessibilityLabel="Назад"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        </SafeAreaPadding>

        <View style={styles.main} lightColor="transparent" darkColor="transparent">
          <View style={styles.header} lightColor="transparent" darkColor="transparent">
            <Text style={styles.h1}>Введите{'\n'}номер{'\n'}телефона</Text>
            <Text style={styles.sub} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
              Отправим код подтверждения
            </Text>
          </View>

          <View style={styles.inputWrap} lightColor="transparent" darkColor="transparent">
            <View
              style={[styles.card, isFocused && styles.cardFocused]}
              lightColor="#FFFFFF"
              darkColor="#0C1A14"
            >
              <Text style={styles.label} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
                НОМЕР ТЕЛЕФОНА
              </Text>

              <View style={styles.row} lightColor="transparent" darkColor="transparent">
                <Text style={styles.prefix}>+7</Text>
                <TextInput
                  value={formatted}
                  onChangeText={(t) => setDigits(onlyDigits(t))}
                  placeholder="(999) 999-99-99"
                  placeholderTextColor="rgba(191,201,193,0.8)"
                  keyboardType="phone-pad"
                  style={styles.input}
                  maxLength={16}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  selection={{ start: formatted.length, end: formatted.length }}
                  onKeyPress={(e) => {
                    if (e.nativeEvent.key !== 'Backspace') return;
  
                    if (digits.length > 0 && formatted.length > 0) {
                      const lastChar = formatted[formatted.length - 1] ?? '';
                      if (lastChar && /\D/.test(lastChar)) {
                        setDigits((prev) => prev.slice(0, -1));
                      }
                    }
                  }}
                />
              </View>
            </View>
          </View>

          <View style={styles.flex} />

          <SafeAreaPadding minTop={0} minBottom={16} style={styles.bottom} lightColor="transparent" darkColor="transparent">
            <Pressable
              onPress={() => router.push('/(auth)/quiz')}
              style={({ pressed }) => [styles.quizEntry, pressed && styles.pressed]}
            >
              <Text style={styles.quizEntryText} lightColor="#2D6A4F" darkColor="#95D4B3">
                Пройти диагностический квиз без регистрации
              </Text>
            </Pressable>
            {sendError ? (
              <Text style={styles.formError} lightColor="#BA1A1A" darkColor="#FFB4A9">
                {sendError}
              </Text>
            ) : null}
            <Text style={styles.legal} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
              Нажимая кнопку, вы соглашаетесь с{'\n'}
              <Text style={styles.legalLink} lightColor="#0F5238" darkColor="#95D4B3">
                правилами сервиса
              </Text>{' '}
              и{' '}
              <Text style={styles.legalLink} lightColor="#0F5238" darkColor="#95D4B3">
                политикой конфиденциальности
              </Text>
            </Text>

            <Pressable
              onPress={() => {
                if (!isValid || isSending) return;
                setSendError(null);
                setIsSending(true);
                void (async () => {
                  try {
                    const phone = digitsToRuE164(digits);
                    const otpMeta = await requestOtp(phone);
                    router.push({
                      pathname: '/(auth)/otp',
                      params: {
                        phone: digits,
                        codeLength: String(otpMeta.codeLength),
                      },
                    });
                  } catch (e: unknown) {
                    const message = e instanceof ApiError ? e.message : 'Не удалось отправить код';
                    setSendError(message);
                  } finally {
                    setIsSending(false);
                  }
                })();
              }}
              disabled={!isValid || isSending}
              style={({ pressed }) => [
                styles.button,
                (!isValid || isSending) && styles.buttonDisabled,
                pressed && isValid && !isSending && styles.buttonPressed,
              ]}
            >
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText} lightColor="#FFFFFF" darkColor="#06130E">
                  Получить код
                </Text>
              )}
            </Pressable>
          </SafeAreaPadding>
        </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  decorBlob: {
    position: 'absolute',
    top: -80,
    right: -140,
    width: 520,
    height: 520,
    borderRadius: 9999,
    backgroundColor: 'rgba(177,240,206,0.22)',
  },
  topNav: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 28,
    fontWeight: '300',
  },
  main: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    gap: 16,
    marginBottom: 48,
  },
  h1: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  sub: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  inputWrap: {
    flexShrink: 0,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(191,201,193,0.20)',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    overflow: 'hidden',
  },
  cardFocused: {
    borderColor: 'rgba(149,212,179,0.75)',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  row: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prefix: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.2,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.2,
    paddingVertical: 0,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  flex: { flex: 1 },
  bottom: {
    gap: 12,
    marginTop: 48,
  },
  quizEntry: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  quizEntryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  formError: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  legal: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  legalLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
    fontFamily: 'Inter_600SemiBold',
  },
  button: {
    height: 60,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pressed: { opacity: 0.85 },
});


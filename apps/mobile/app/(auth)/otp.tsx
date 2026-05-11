import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { requestOtp, verifyOtp } from '@/features/auth/auth-api';
import { fetchMyConsents } from '@/features/consents/consents-api';
import { mergeQuizSessionWithUser } from '@/features/quiz/quiz-api';
import { clearLastQuizSessionId, getLastQuizSessionId } from '@/features/quiz/quiz-session-store';
import { loadSelectedStudio } from '@/features/studio/local-studio-storage';
import { ApiError } from '@/shared/api/api-error';
import { digitsToRuE164 } from '@/shared/lib/phone';
import { SafeAreaPadding } from '@/shared/ui/safe-area';
import { ConsentType } from '@srs/shared-types';

const REQUIRED_CONSENT_TYPES = new Set<ConsentType>([
  ConsentType.PersonalData,
  ConsentType.MedicalInformation,
]);

function hasRequiredConsents(consents: { type: string }[]): boolean {
  const got = new Set(consents.map((c) => c.type as ConsentType));
  for (const t of REQUIRED_CONSENT_TYPES) {
    if (!got.has(t)) return false;
  }
  return true;
}

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

function formatRuPhoneFromDigits(digits: string) {
  const d = onlyDigits(digits).slice(0, 10);
  if (d.length === 0) return '+7';
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 8);
  const p4 = d.slice(8, 10);
  if (d.length <= 3) return `+7 (${p1}`;
  if (d.length <= 6) return `+7 (${p1}) ${p2}`;
  if (d.length <= 8) return `+7 (${p1}) ${p2}-${p3}`;
  return `+7 (${p1}) ${p2}-${p3}-${p4}`;
}

function formatTimer(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/** Совпадает с VerifyOtpDto на API: длина кода 4–8; дефолт как OTP_CODE_LENGTH на бэке. */
function clampOtpLength(raw: number): number {
  if (!Number.isFinite(raw)) return 6;
  return Math.min(8, Math.max(4, Math.floor(raw)));
}

export default function OtpScreen() {
  const params = useLocalSearchParams<{ phone?: string; codeLength?: string }>();
  const [code, setCode] = useState('');
  const [showError, setShowError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const parsedLen = useMemo(
    () => clampOtpLength(Number.parseInt(params.codeLength ?? '6', 10)),
    [params.codeLength],
  );
  const [otpLen, setOtpLen] = useState(parsedLen);

  useEffect(() => {
    setOtpLen(parsedLen);
  }, [parsedLen]);

  const phoneLabel = useMemo(() => formatRuPhoneFromDigits(params.phone ?? ''), [params.phone]);

  const digits = useMemo(() => onlyDigits(code).slice(0, otpLen), [code, otpLen]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  useEffect(() => {
    if (digits.length !== otpLen) return;

    let cancelled = false;
    setShowError(false);
    setIsVerifying(true);

    void (async () => {
      try {
        const phone = digitsToRuE164(params.phone ?? '');
        const auth = await verifyOtp({
          phone,
          code: digits,
          deviceType: Platform.OS === 'ios' ? 'mobile_ios' : 'mobile_android',
        });
        const pendingQuizSessionId = await getLastQuizSessionId();
        if (pendingQuizSessionId) {
          try {
            await mergeQuizSessionWithUser(pendingQuizSessionId);
            await clearLastQuizSessionId();
          } catch {
            // Ошибка merge не должна блокировать вход в приложение.
          }
        }
        if (cancelled) return;
        const fn = auth.user.firstName.trim();
        const ln = auth.user.lastName.trim();
        const hasRealName = fn.length > 0 && ln.length > 0;
        // Раньше API подставлял «Новый» / «Клиент» — считаем это незаполненным профилем.
        const isLegacyPlaceholder = fn === 'Новый' && ln === 'Клиент';
        if (!hasRealName || isLegacyPlaceholder) {
          router.replace('/(auth)/name');
          return;
        }

        const consents = await fetchMyConsents().catch(() => null);
        if (!consents || !hasRequiredConsents(consents)) {
          router.replace('/(auth)/consent');
          return;
        }

        const studio = await loadSelectedStudio().catch(() => null);
        if (!studio?.id) router.replace('/(app)/studio-selector');
        else router.replace('/(app)/(tabs)');
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof ApiError ? e.message : '';
        setShowError(Boolean(message));
        setCode('');
      } finally {
        setIsVerifying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [digits, otpLen, params.phone]);

  const focusInput = () => inputRef.current?.focus();

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.screen}>
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
            <Text style={styles.h1}>Введите код</Text>
            <Text style={styles.sub} lightColor="rgba(64,73,67,1)" darkColor="rgba(149,163,160,0.85)">
              Отправили на {phoneLabel}
            </Text>
          </View>

          <Pressable onPress={focusInput} style={styles.otpRow} accessibilityRole="button">
            {isVerifying ? (
              <RNView style={styles.verifyingOverlay}>
                <ActivityIndicator />
              </RNView>
            ) : null}
            {Array.from({ length: otpLen }).map((_, idx) => {
              const ch = digits[idx] ?? '';
              const isActive =
                isFocused && idx === digits.length && digits.length < otpLen && !showError;
              const isFilled = ch.length > 0;
              return (
                <View
                  key={idx}
                  style={[
                    styles.cell,
                    isActive && styles.cellActive,
                    showError && styles.cellError,
                    !isFilled && styles.cellEmpty,
                  ]}
                  lightColor="#FFFFFF"
                  darkColor="#0C1A14"
                >
                  {isActive ? <RNView style={styles.caret} /> : null}
                  {!isActive ? (
                    <Text style={[styles.cellText, showError && styles.cellTextError]}>{ch || ' '}</Text>
                  ) : null}
                </View>
              );
            })}

            <TextInput
              ref={inputRef}
              value={digits}
              onChangeText={(t) => {
                setShowError(false);
                setCode(onlyDigits(t).slice(0, otpLen));
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={otpLen}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              style={styles.hiddenInput}
            />
          </Pressable>

          <View style={styles.timerRow} lightColor="transparent" darkColor="transparent">
            <Text style={styles.timerText} lightColor="rgba(64,73,67,1)" darkColor="rgba(149,163,160,0.85)">
              {secondsLeft > 0 ? 'Повторить через ' : 'Отправить код ещё раз'}
            </Text>
            {secondsLeft > 0 ? (
              <Text style={styles.timerValue} lightColor="#0F5238" darkColor="#95D4B3">
                {formatTimer(secondsLeft)}
              </Text>
            ) : (
              <Pressable
                onPress={() => {
                  void (async () => {
                    try {
                      const meta = await requestOtp(digitsToRuE164(params.phone ?? ''));
                      setOtpLen(clampOtpLength(meta.codeLength));
                      setSecondsLeft(45);
                      setCode('');
                      setShowError(false);
                      focusInput();
                    } catch {
                      setShowError(true);
                    }
                  })();
                }}
                style={({ pressed }) => [styles.resendBtn, pressed && styles.pressed]}
              >
                <Text style={styles.timerValue} lightColor="#0F5238" darkColor="#95D4B3">
                  сейчас
                </Text>
              </Pressable>
            )}
          </View>

          {showError ? (
            <Text style={styles.error} lightColor="#BA1A1A" darkColor="#FFB4A9">
              Неверный код. Попробуйте еще раз.
            </Text>
          ) : null}
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
    paddingTop: 32,
    paddingBottom: 48,
  },
  header: {
    gap: 16,
    marginBottom: 40,
  },
  h1: {
    fontSize: 56,
    lineHeight: 56,
    fontWeight: '800',
    letterSpacing: -1.4,
    fontFamily: Platform.select({ ios: 'Liberation Serif', android: 'serif' }),
  },
  sub: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 12,
    zIndex: 2,
  },
  cell: {
    width: 44,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(191,201,193,0.30)',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.02,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
  cellEmpty: {
    backgroundColor: '#F3F4F5',
    borderColor: 'rgba(0,0,0,0)',
    shadowOpacity: 0,
  },
  cellActive: {
    backgroundColor: '#B1F0CE',
    borderColor: '#0F5238',
    borderWidth: 2,
    shadowOpacity: 0.06,
  },
  cellError: {
    backgroundColor: '#FFDAD6',
    borderColor: 'rgba(186,26,26,0.30)',
    borderWidth: 1,
    shadowOpacity: 0,
  },
  caret: {
    width: 2,
    height: 24,
    backgroundColor: '#0F5238',
    borderRadius: 2,
  },
  cellText: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 42,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1A1A2E',
  },
  cellTextError: {
    color: '#93000A',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  error: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  timerRow: {
    marginTop: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  timerValue: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  resendBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  pressed: { opacity: 0.85 },
});


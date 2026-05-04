import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { patchMe } from '@/features/user/me-api';
import { ApiError } from '@/shared/api/api-error';
import { isValidRuPersonName, normalizeRuPersonName } from '@/shared/lib/ru-person-name';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

export default function NameEntryScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const canContinue = useMemo(
    () => isValidRuPersonName(firstName) && isValidRuPersonName(lastName),
    [firstName, lastName]
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
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
            <Text style={styles.h1}>Как вас{'\n'}зовут?</Text>
            <Text style={styles.sub} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
              Давайте познакомимся. Эти данные помогут нам персонализировать ваш опыт и создать личную карту здоровья.
            </Text>
          </View>

          <View style={styles.fields} lightColor="transparent" darkColor="transparent">
            <View style={styles.inputWrap} lightColor="transparent" darkColor="transparent">
              <Text style={styles.label} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
                ИМЯ
              </Text>
              <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
                <FontAwesome name="user-o" size={18} color="rgba(112,121,115,1)" />
                <TextInput
                  value={firstName}
                  onChangeText={(t) => setFirstName(normalizeRuPersonName(t))}
                  placeholder="Введите ваше имя"
                  placeholderTextColor="rgba(191,201,193,0.9)"
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.inputWrap} lightColor="transparent" darkColor="transparent">
              <Text style={styles.label} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
                ФАМИЛИЯ
              </Text>
              <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
                <FontAwesome name="id-card-o" size={18} color="rgba(112,121,115,1)" />
                <TextInput
                  value={lastName}
                  onChangeText={(t) => setLastName(normalizeRuPersonName(t))}
                  placeholder="Введите вашу фамилию"
                  placeholderTextColor="rgba(191,201,193,0.9)"
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>
            </View>
          </View>

          <View style={styles.flex} />

          <SafeAreaPadding minTop={0} minBottom={16} style={styles.bottom} lightColor="transparent" darkColor="transparent">
            <Pressable
              onPress={() => {
                if (!canContinue || isSaving) return;
                setIsSaving(true);
                void (async () => {
                  try {
                    await patchMe({ firstName: firstName.trim(), lastName: lastName.trim() });
                    router.replace('/(auth)/consent');
                  } catch (e: unknown) {
                    const message = e instanceof ApiError ? e.message : 'Не удалось сохранить данные';
                    Alert.alert('Ошибка', message);
                  } finally {
                    setIsSaving(false);
                  }
                })();
              }}
              disabled={!canContinue || isSaving}
              style={({ pressed }) => [
                styles.button,
                (!canContinue || isSaving) && styles.buttonDisabled,
                pressed && canContinue && !isSaving && styles.buttonPressed,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.buttonText} lightColor="#FFFFFF" darkColor="#06130E">
                    Продолжить{'  '}
                  </Text>
                  <FontAwesome name="arrow-right" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </SafeAreaPadding>
        </View>
      </View>
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
    marginBottom: 24,
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
  fields: {
    gap: 18,
  },
  inputWrap: {
    gap: 10,
  },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(191,201,193,0.20)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
    fontFamily: 'Inter_600SemiBold',
  },
  flex: { flex: 1 },
  bottom: {
    marginTop: 24,
  },
  button: {
    height: 60,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
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


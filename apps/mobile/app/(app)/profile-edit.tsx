import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { getMe, patchMe } from '@/features/user/me-api';
import { ApiError } from '@/shared/api/api-error';
import { isoDateToDdMmYyyy, maskRuBirthDateInput, parseDdMmYyyyToIso } from '@/shared/lib/birth-date-ru';
import { formatRuPhoneDisplay } from '@/shared/lib/phone';
import { isValidRuPersonName, normalizeRuPersonName } from '@/shared/lib/ru-person-name';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const GREEN = '#2D6A4F';

function isValidEmailLoose(s: string): boolean {
  const t = s.trim();
  if (t === '') return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export default function ProfileEditScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDisplay, setBirthDisplay] = useState('');
  const [email, setEmail] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [birthIsoLoaded, setBirthIsoLoaded] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      setFirstName(me.firstName ?? '');
      setLastName(me.lastName ?? '');
      setEmail(me.email ?? '');
      setPhoneDisplay(formatRuPhoneDisplay(me.phone));
      setBirthIsoLoaded(me.birthDate);
      setBirthDisplay(me.birthDate ? isoDateToDdMmYyyy(me.birthDate) : '');
      setAvatarUri(me.avatarUrl ?? null);
    } catch (e: unknown) {
      const message = e instanceof ApiError ? e.message : 'Не удалось загрузить профиль';
      Alert.alert('Ошибка', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pickerValue = useMemo(() => {
    const fromDisplay = parseDdMmYyyyToIso(birthDisplay);
    if (fromDisplay) {
      const [y, m, d] = fromDisplay.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const iso = birthIsoLoaded ?? '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(1990, 3, 15);
  }, [birthDisplay, birthIsoLoaded]);

  const onDatePicked = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed') {
      if (Platform.OS === 'android') setShowDatePicker(false);
      return;
    }
    if (selected) {
      setBirthDisplay(
        `${String(selected.getDate()).padStart(2, '0')}.${String(selected.getMonth() + 1).padStart(2, '0')}.${selected.getFullYear()}`,
      );
    }
  };

  const save = () => {
    const fn = normalizeRuPersonName(firstName).trim();
    const ln = normalizeRuPersonName(lastName).trim();
    if (!isValidRuPersonName(fn) || !isValidRuPersonName(ln)) {
      Alert.alert('Проверьте данные', 'Укажите имя и фамилию на русском языке (не короче 2 букв).');
      return;
    }
    if (!isValidEmailLoose(email)) {
      Alert.alert('Проверьте данные', 'Некорректный email.');
      return;
    }
    const birthIso =
      birthDisplay.trim() === '' ? '' : parseDdMmYyyyToIso(birthDisplay) ?? '__invalid__';
    if (birthIso === '__invalid__') {
      Alert.alert('Проверьте данные', 'Дата рождения: формат ДД.ММ.ГГГГ.');
      return;
    }
    setSaving(true);
    void (async () => {
      try {
        await patchMe({
          firstName: fn,
          lastName: ln,
          email: email.trim(),
          birthDate: birthIso,
        });
        Alert.alert('Сохранено', 'Данные профиля обновлены.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch (e: unknown) {
        const message = e instanceof ApiError ? e.message : 'Не удалось сохранить';
        Alert.alert('Ошибка', message);
      } finally {
        setSaving(false);
      }
    })();
  };

  const pickAvatarFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Доступ к фото', 'Разрешите доступ к галерее в настройках устройства.');
        return;
      }
      setAvatarBusy(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) return;
      const manipulated = await manipulateAsync(uri, [{ resize: { width: 512 } }], {
        compress: 0.82,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!manipulated.base64) {
        Alert.alert('Ошибка', 'Не удалось обработать изображение.');
        return;
      }
      const dataUrl = `data:image/jpeg;base64,${manipulated.base64}`;
      const updated = await patchMe({ avatarUrl: dataUrl });
      setAvatarUri(updated.avatarUrl ?? null);
    } catch (e: unknown) {
      const message = e instanceof ApiError ? e.message : 'Не удалось сохранить фото';
      Alert.alert('Ошибка', message);
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatarPhoto = async () => {
    try {
      setAvatarBusy(true);
      const updated = await patchMe({ avatarUrl: '' });
      setAvatarUri(updated.avatarUrl ?? null);
    } catch (e: unknown) {
      const message = e instanceof ApiError ? e.message : 'Не удалось удалить фото';
      Alert.alert('Ошибка', message);
    } finally {
      setAvatarBusy(false);
    }
  };

  const openAvatarOptions = () => {
    Alert.alert(
      'Фото профиля',
      undefined,
      [
        { text: 'Выбрать из галереи', onPress: () => void pickAvatarFromGallery() },
        ...(avatarUri
          ? [{ text: 'Удалить фото', style: 'destructive' as const, onPress: () => void removeAvatarPhoto() }]
          : []),
        { text: 'Отмена', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  return (
    <View style={styles.root} lightColor="#F3F4F5" darkColor="#06130E">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <SafeAreaPadding minTop={10} minBottom={0} style={styles.safeTop} lightColor="transparent" darkColor="transparent">
          <RNView style={styles.headerRow}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/profile');
              }}
              accessibilityLabel="Назад"
              style={({ pressed }) => [styles.headerSideBtn, pressed && styles.pressed]}
            >
              <Text style={styles.backGlyph} lightColor="#2D6A4F" darkColor="#95D4B3">
                ‹
              </Text>
            </Pressable>
            <Text style={styles.headerTitle} lightColor={GREEN} darkColor="#95D4B3">
              Редактирование
            </Text>
            <RNView style={styles.headerSideBtn} />
          </RNView>
        </SafeAreaPadding>

        {loading ? (
          <RNView style={styles.loader}>
            <ActivityIndicator />
          </RNView>
        ) : (
          <View style={styles.sheet} lightColor="#FFFFFF" darkColor="#0C1A14">
            <SafeAreaView style={styles.flex} edges={['bottom']}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={styles.flex}
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
              >
              <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
                <RNView style={styles.avatarBlock}>
                  <RNView style={styles.avatarCircleWrap}>
                    <View style={styles.avatarCircle} lightColor="#EEF1EE" darkColor="rgba(255,255,255,0.08)">
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                      ) : (
                        <FontAwesome name="user" size={44} color="rgba(112,121,115,1)" />
                      )}
                      {avatarBusy ? (
                        <RNView style={styles.avatarBusyOverlay}>
                          <ActivityIndicator color="#FFFFFF" />
                        </RNView>
                      ) : null}
                      <Pressable
                        style={({ pressed }) => [styles.avatarFab, pressed && styles.pressed]}
                        onPress={openAvatarOptions}
                        disabled={avatarBusy}
                        accessibilityLabel="Изменить фото"
                      >
                        <FontAwesome name="pencil" size={14} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </RNView>
                  <Pressable onPress={openAvatarOptions} disabled={avatarBusy}>
                    <Text style={styles.changePhoto} lightColor={GREEN} darkColor="#95D4B3">
                      Изменить фото
                    </Text>
                  </Pressable>
                </RNView>

                <FieldLabel>Имя</FieldLabel>
                <RNView style={styles.inputOuter}>
                  <TextInput
                    value={firstName}
                    onChangeText={(t) => setFirstName(normalizeRuPersonName(t))}
                    placeholder="Имя"
                    placeholderTextColor="rgba(191,201,193,0.9)"
                    autoCapitalize="words"
                    style={styles.input}
                  />
                </RNView>

                <FieldLabel>Фамилия</FieldLabel>
                <RNView style={styles.inputOuter}>
                  <TextInput
                    value={lastName}
                    onChangeText={(t) => setLastName(normalizeRuPersonName(t))}
                    placeholder="Фамилия"
                    placeholderTextColor="rgba(191,201,193,0.9)"
                    autoCapitalize="words"
                    style={styles.input}
                  />
                </RNView>

                <FieldLabel>Дата рождения</FieldLabel>
                <RNView style={styles.inputOuterRow}>
                  <TextInput
                    value={birthDisplay}
                    onChangeText={(t) => setBirthDisplay(maskRuBirthDateInput(t))}
                    placeholder="ДД.ММ.ГГГГ"
                    placeholderTextColor="rgba(191,201,193,0.9)"
                    keyboardType="number-pad"
                    style={[styles.input, styles.inputFlex]}
                  />
                  <Pressable
                    onPress={() => setShowDatePicker((v) => !v)}
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                    accessibilityLabel="Открыть календарь"
                  >
                    <FontAwesome name="calendar" size={18} color={GREEN} />
                  </Pressable>
                </RNView>

                {showDatePicker ? (
                  <RNView style={styles.pickerWrap}>
                    <DateTimePicker
                      value={pickerValue}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      locale="ru-RU"
                      maximumDate={new Date()}
                      onChange={onDatePicked}
                    />
                    {Platform.OS === 'ios' ? (
                      <Pressable onPress={() => setShowDatePicker(false)} style={styles.pickerDone}>
                        <Text style={styles.pickerDoneText} lightColor={GREEN} darkColor="#95D4B3">
                          Готово
                        </Text>
                      </Pressable>
                    ) : null}
                  </RNView>
                ) : null}

                <FieldLabel>Email</FieldLabel>
                <RNView style={styles.inputOuter}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@example.com"
                    placeholderTextColor="rgba(191,201,193,0.9)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </RNView>

                <FieldLabel>Номер телефона</FieldLabel>
                <RNView style={styles.phoneBox}>
                  <FontAwesome name="lock" size={16} color="rgba(112,121,115,1)" style={styles.phoneLock} />
                  <Text style={styles.phoneText} lightColor="rgba(11,27,20,0.65)" darkColor="rgba(255,255,255,0.75)">
                    {phoneDisplay}
                  </Text>
                </RNView>
                <Text style={styles.phoneHint} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
                  Для изменения номера обратитесь в поддержку.
                </Text>
              </View>

              <Pressable
                onPress={save}
                disabled={saving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  saving && styles.saveBtnDisabled,
                  pressed && !saving && styles.pressed,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                    Сохранить
                  </Text>
                )}
              </Pressable>
              </ScrollView>
            </SafeAreaView>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text style={styles.fieldLabel} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.9)">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  safeTop: {
    paddingHorizontal: 8,
    paddingBottom: 4,
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
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    gap: 4,
  },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  avatarCircleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(45,106,79,0.2)',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarImage: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 52,
  },
  avatarFab: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  changePhoto: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  fieldLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    letterSpacing: 0.6,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  inputOuter: {
    borderWidth: 1,
    borderColor: 'rgba(191,201,193,0.45)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: '#FFFFFF',
  },
  inputOuterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(191,201,193,0.45)',
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 6,
    backgroundColor: '#FFFFFF',
  },
  inputFlex: { flex: 1 },
  input: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#1A1A2E',
    paddingVertical: Platform.OS === 'ios' ? 4 : 8,
  },
  iconBtn: {
    padding: 12,
    borderRadius: 12,
  },
  pickerWrap: {
    marginTop: 8,
    alignItems: 'stretch',
  },
  pickerDone: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  phoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(149,163,160,0.16)',
    marginTop: 2,
  },
  phoneLock: {
    marginRight: 2,
  },
  phoneText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  phoneHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  saveBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  saveBtnDisabled: {
    opacity: 0.55,
  },
  saveBtnText: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pressed: { opacity: 0.88 },
});

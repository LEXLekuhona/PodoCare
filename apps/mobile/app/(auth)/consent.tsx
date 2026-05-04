import { ConsentType } from '@podocare/shared-types';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { ConsentDocumentBody } from '@/features/consents/ConsentDocumentBody';
import { CONSENT_DOCUMENT_VERSIONS, PERSONAL_DATA_PARAGRAPHS } from '@/features/consents/consent-copy';
import { recordConsents } from '@/features/consents/consents-api';
import { ApiError } from '@/shared/api/api-error';
import { LeafLogo } from '@/shared/ui/icons/LeafLogo';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

export default function PrivacyConsentScreen() {
  const [isChecked, setIsChecked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <View style={styles.root} lightColor="#F3F4F5" darkColor="#06130E">
      <SafeAreaPadding minTop={14} minBottom={0} style={styles.topBar} lightColor="#FFFFFF" darkColor="#06130E">
        <View style={styles.topRow} lightColor="transparent" darkColor="transparent">
          <View style={styles.brand} lightColor="transparent" darkColor="transparent">
            <LeafLogo size={28} color="#707973" />
            <Text style={styles.brandText}>PodoCare</Text>
          </View>
          <Pressable accessibilityLabel="Уведомления" style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <FontAwesome name="bell-o" size={18} color="#0F5238" />
          </Pressable>
        </View>
      </SafeAreaPadding>

      <View style={styles.content} lightColor="transparent" darkColor="transparent">
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(auth)');
          }}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
        >
          <FontAwesome name="arrow-left" size={16} color="rgba(112,121,115,1)" />
          <Text style={styles.backText} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
            Назад
          </Text>
        </Pressable>

        <Text style={styles.h1}>Согласие на обработку{'\n'}персональных данных</Text>
        <Text style={styles.sub} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
          Пожалуйста, ознакомьтесь с условиями перед продолжением.
        </Text>

        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.docScroll}>
            <ConsentDocumentBody paragraphs={PERSONAL_DATA_PARAGRAPHS} />
          </ScrollView>
        </View>
      </View>

      <SafeAreaPadding minTop={0} minBottom={16} style={styles.bottom} lightColor="transparent" darkColor="transparent">
        <Pressable onPress={() => setIsChecked((v) => !v)} style={styles.checkboxRow}>
          <RNView style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
            {isChecked ? <FontAwesome name="check" size={12} color="#FFFFFF" /> : null}
          </RNView>
          <Text style={styles.checkboxText} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
            Я прочитал(а) текст согласия и даю свое{'\n'}
            <Text style={styles.checkboxTextStrong} lightColor="#1A1A2E" darkColor="#FFFFFF">
              Согласие на обработку персональных данных
            </Text>
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (!isChecked || isSaving) return;
            setIsSaving(true);
            void (async () => {
              try {
                await recordConsents([
                  {
                    type: ConsentType.PersonalData,
                    documentVersion: CONSENT_DOCUMENT_VERSIONS.PERSONAL_DATA,
                  },
                  {
                    type: ConsentType.MedicalInformation,
                    documentVersion: CONSENT_DOCUMENT_VERSIONS.MEDICAL_INFORMATION,
                  },
                ]);
                router.replace('/(app)/studio-selector');
              } catch (e: unknown) {
                const message = e instanceof ApiError ? e.message : 'Не удалось сохранить согласия';
                Alert.alert('Ошибка', message);
              } finally {
                setIsSaving(false);
              }
            })();
          }}
          disabled={!isChecked || isSaving}
          style={({ pressed }) => [
            styles.button,
            (!isChecked || isSaving) && styles.buttonDisabled,
            pressed && isChecked && !isSaving && styles.buttonPressed,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText} lightColor="#FFFFFF" darkColor="#06130E">
              Принять и продолжить
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(auth)');
          }}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText} lightColor="rgba(64,73,67,1)" darkColor="rgba(149,163,160,0.85)">
            Отказаться
          </Text>
        </Pressable>
      </SafeAreaPadding>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(191,201,193,0.5)',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  h1: {
    marginTop: 6,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  sub: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  card: {
    marginTop: 18,
    borderRadius: 16,
    padding: 0,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    flex: 1,
    overflow: 'hidden',
  },
  docScroll: {
    padding: 18,
    paddingBottom: 22,
  },
  bottom: {
    paddingHorizontal: 24,
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(112,121,115,0.6)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#2D6A4F',
    borderColor: '#2D6A4F',
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  checkboxTextStrong: {
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  button: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(45,106,79,0.45)',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  pressed: { opacity: 0.85 },
});


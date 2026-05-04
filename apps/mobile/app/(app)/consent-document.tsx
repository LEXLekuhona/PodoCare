import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { ConsentDocumentBody } from '@/features/consents/ConsentDocumentBody';
import { consentDocumentTitleRu, getConsentParagraphs } from '@/features/consents/consent-copy';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const GREEN = '#2D6A4F';

function HeaderBar(props: { title: string }) {
  return (
    <RNView style={styles.headerRow}>
      <Pressable
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(app)/consents');
        }}
        accessibilityLabel="Назад"
        style={({ pressed }) => [styles.headerSideBtn, pressed && styles.pressed]}
      >
        <Text style={styles.backGlyph} lightColor="#2D6A4F" darkColor="#95D4B3">
          ‹
        </Text>
      </Pressable>
      <Text style={styles.headerTitle} lightColor={GREEN} darkColor="#95D4B3">
        {props.title}
      </Text>
      <RNView style={styles.headerSideBtn} />
    </RNView>
  );
}

export default function ConsentDocumentReaderScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const type = typeof params.type === 'string' ? params.type : '';
  const paragraphs = type ? getConsentParagraphs(type) : null;
  const docTitle = type ? consentDocumentTitleRu(type) : 'Документ';

  if (!type || !paragraphs) {
    return (
      <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
        <SafeAreaPadding minTop={10} style={styles.safeTop} lightColor="transparent" darkColor="transparent">
          <HeaderBar title="Документы" />
        </SafeAreaPadding>
        <RNView style={styles.fallback}>
          <Text style={styles.fallbackText} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
            Документ не найден.
          </Text>
        </RNView>
      </View>
    );
  }

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
      <SafeAreaPadding minTop={10} minBottom={0} style={styles.safeTop} lightColor="transparent" darkColor="transparent">
        <HeaderBar title="Документы" />
      </SafeAreaPadding>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1} lightColor="#1A1A2E" darkColor="#FFFFFF">
          {docTitle}
        </Text>
        <Text style={styles.sub} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
          Только для ознакомления. Документ уже подписан.
        </Text>
        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
          <ConsentDocumentBody paragraphs={paragraphs} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: {
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
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
  },
  h1: {
    marginTop: 8,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },
  card: {
    marginTop: 8,
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackText: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  pressed: { opacity: 0.85 },
});

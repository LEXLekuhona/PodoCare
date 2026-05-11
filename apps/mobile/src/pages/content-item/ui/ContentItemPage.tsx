import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import type { ClientContentFeedCta, ClientContentItemDetail } from '@srs/shared-types';
import { ContentFormat } from '@srs/shared-types';

import { Text, View } from '@/components/Themed';
import { resolveContentCtaNavigation } from '@/features/education/content-cta-routing';
import {
  clickContentItemCta,
  fetchClientContentItem,
  saveContentItemProgress,
} from '@/features/education/education-api';
import {
  ContentDocumentWebView,
  ContentInlineAudio,
  ContentInlineVideo,
  ContentWebinarEmbed,
} from '@/features/education/content-in-app-media';
import { ApiError } from '@/shared/api/api-error';
import { sanitizeRouteParam } from '@/shared/navigation/route-params';
import { AppHeader } from '@/shared/ui/AppHeader';

const PRIMARY = '#2D6A4F';

interface MediaBody {
  videoUrl?: string;
  audioUrl?: string;
  webinarUrl?: string;
  quizId?: string;
  markdown?: string;
  documentUrl?: string;
}

function readMediaBody(body: unknown): MediaBody {
  if (typeof body !== 'object' || body == null || Array.isArray(body)) {
    return {};
  }
  const obj = body as Record<string, unknown>;
  return {
    markdown: typeof obj.markdown === 'string' ? obj.markdown : undefined,
    videoUrl: typeof obj.videoUrl === 'string' ? obj.videoUrl : undefined,
    audioUrl: typeof obj.audioUrl === 'string' ? obj.audioUrl : undefined,
    webinarUrl: typeof obj.webinarUrl === 'string' ? obj.webinarUrl : undefined,
    quizId: typeof obj.quizId === 'string' ? obj.quizId : undefined,
    documentUrl: typeof obj.documentUrl === 'string' ? obj.documentUrl : undefined,
  };
}

export function ContentItemPage() {
  const insets = useSafeAreaInsets();
  const itemId = sanitizeRouteParam(useLocalSearchParams().id);
  const [item, setItem] = useState<ClientContentItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [inAppLinkUrl, setInAppLinkUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!itemId) {
      setItem(null);
      setError('Материал не найден');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClientContentItem(itemId);
      setItem(data);
      setProgressPercent(data.progress.percent);
      if (data.progress.percent < 10) {
        // Нечитаемая ошибка прогресса не должна ломать экран — он уже показал материал.
        saveContentItemProgress(itemId, { percent: 10 }).catch(() => undefined);
      }
    } catch (e) {
      setItem(null);
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить материал');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onMarkComplete = useCallback(async () => {
    if (!item) return;
    setCompleting(true);
    try {
      await saveContentItemProgress(item.id, { percent: 100 });
      setProgressPercent(100);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить прогресс');
    } finally {
      setCompleting(false);
    }
  }, [item]);

  const onCtaPress = useCallback(
    (cta: ClientContentFeedCta) => {
      if (!item) return;
      // Click-tracking на бэке независим от навигации: ошибка телеметрии не должна блокировать переход.
      clickContentItemCta(item.id, cta.id).catch(() => undefined);
      const intent = resolveContentCtaNavigation(cta);
      if (intent.kind === 'external') {
        void WebBrowser.openBrowserAsync(intent.url);
      } else if (intent.kind === 'expo-router') {
        router.push({ pathname: intent.pathname as never, params: intent.params });
      }
    },
    [item],
  );

  const body = useMemo(() => readMediaBody(item?.body), [item?.body]);

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
      <AppHeader
        title={item?.title ?? 'Материал'}
        titleNumberOfLines={1}
        titleStyle={styles.headerTitle}
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, insets.bottom + 24) }]}>
        {loading ? (
          <View style={styles.loader} lightColor="transparent" darkColor="transparent">
            <ActivityIndicator />
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.errorCard} lightColor="#FFFFFF" darkColor="#0C1A14">
            <Text style={styles.errorText} lightColor="#93000A" darkColor="#FFB4A9">
              {error}
            </Text>
            <Pressable
              onPress={() => void load()}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Повторить</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && item ? (
          <>
            <View style={styles.heroCard} lightColor="#FFFFFF" darkColor="#0C1A14">
              <Text style={styles.seriesLabel} lightColor={PRIMARY} darkColor="#95D4B3">
                {item.seriesTitle}
              </Text>
              <Text style={styles.title}>{item.title}</Text>
              {item.description ? (
                <Text
                  style={styles.descriptionText}
                  lightColor="rgba(11,27,20,0.68)"
                  darkColor="rgba(255,255,255,0.70)"
                >
                  {item.description}
                </Text>
              ) : null}
            </View>

            {item.format === ContentFormat.Article ? (
              <>
                <View style={styles.bodyCard} lightColor="#FFFFFF" darkColor="#0C1A14">
                  {body.markdown && body.markdown.trim() ? (
                    <Markdown
                      style={markdownStyles}
                      onLinkPress={(url) => {
                        if (/^https?:\/\//i.test(url)) {
                          setInAppLinkUrl(url);
                          return false;
                        }
                        void Linking.openURL(url);
                        return false;
                      }}
                    >
                      {body.markdown}
                    </Markdown>
                  ) : (
                    <Text style={styles.muted} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
                      Текст материала пуст.
                    </Text>
                  )}
                </View>
                {body.documentUrl?.trim() ? (
                  <ContentDocumentWebView uri={body.documentUrl.trim()} title="Прикреплённый документ" />
                ) : null}
              </>
            ) : null}

            {item.format === ContentFormat.Video && body.videoUrl ? (
              <View style={styles.bodyCard} lightColor="#FFFFFF" darkColor="#0C1A14">
                <Text style={styles.sectionTitle}>Видео</Text>
                <ContentInlineVideo uri={body.videoUrl} itemId={item.id} />
              </View>
            ) : null}

            {item.format === ContentFormat.Audio && body.audioUrl ? (
              <View style={styles.bodyCard} lightColor="#FFFFFF" darkColor="#0C1A14">
                <Text style={styles.sectionTitle}>Аудио</Text>
                <ContentInlineAudio uri={body.audioUrl} itemId={item.id} />
              </View>
            ) : null}

            {item.format === ContentFormat.Webinar && body.webinarUrl ? (
              <View style={styles.bodyCard} lightColor="#FFFFFF" darkColor="#0C1A14">
                <Text style={styles.sectionTitle}>Вебинар</Text>
                <ContentWebinarEmbed uri={body.webinarUrl} itemId={item.id} />
              </View>
            ) : null}

            {item.format === ContentFormat.Quiz && body.quizId ? (
              <View style={styles.mediaCard} lightColor="#FFFFFF" darkColor="#0C1A14">
                <View style={styles.mediaRow} lightColor="transparent" darkColor="transparent">
                  <FontAwesome name="question-circle" size={22} color={PRIMARY} />
                  <Text style={styles.mediaTitle}>Диагностический квиз</Text>
                </View>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/(app)/quiz' as never, params: { quizId: body.quizId! } })
                  }
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryBtnText}>Пройти квиз</Text>
                </Pressable>
              </View>
            ) : null}

            {item.ctas.length > 0 ? (
              <View style={styles.bodyCard} lightColor="#FFFFFF" darkColor="#0C1A14">
                <Text style={styles.sectionTitle}>Что делать дальше</Text>
                {item.ctas.map((cta) => (
                  <Pressable
                    key={cta.id}
                    onPress={() => onCtaPress(cta)}
                    style={({ pressed }) => [styles.ctaBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.ctaBtnLabel}>{cta.label}</Text>
                    {cta.subtitle ? (
                      <Text style={styles.ctaBtnSubtitle}>{cta.subtitle}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={completing || progressPercent >= 100}
              onPress={onMarkComplete}
              style={({ pressed }) => [
                styles.primaryBtn,
                progressPercent >= 100 && styles.primaryBtnDone,
                (pressed || completing) && styles.pressed,
              ]}
            >
              <FontAwesome
                name={progressPercent >= 100 ? 'check-circle' : 'check'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.primaryBtnText}>
                {progressPercent >= 100 ? 'Пройдено' : 'Отметить как пройденное'}
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={inAppLinkUrl != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInAppLinkUrl(null)}
      >
        <RNView style={[styles.linkModalRoot, { paddingTop: Math.max(12, insets.top), paddingBottom: insets.bottom }]}>
          <RNView style={styles.linkModalBar}>
            <Pressable
              onPress={() => setInAppLinkUrl(null)}
              style={({ pressed }) => [styles.linkModalClose, pressed && styles.pressed]}
            >
              <Text style={styles.linkModalCloseText}>Закрыть</Text>
            </Pressable>
          </RNView>
          {inAppLinkUrl ? (
            <WebView source={{ uri: inAppLinkUrl }} style={styles.linkModalWeb} startInLoadingState />
          ) : null}
        </RNView>
      </Modal>
    </View>
  );
}

const markdownStyles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22, color: '#1A1A2E' },
  heading1: { fontSize: 22, lineHeight: 28, fontWeight: '800', marginTop: 4, marginBottom: 8, color: '#0B1B14' },
  heading2: { fontSize: 18, lineHeight: 24, fontWeight: '800', marginTop: 4, marginBottom: 6, color: '#0B1B14' },
  heading3: { fontSize: 16, lineHeight: 22, fontWeight: '700', marginTop: 4, marginBottom: 4, color: '#0B1B14' },
  paragraph: { marginTop: 0, marginBottom: 10 },
  list_item: { marginBottom: 4 },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  blockquote: {
    backgroundColor: 'rgba(45,106,79,0.06)',
    borderLeftColor: PRIMARY,
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 6,
  },
  link: { color: PRIMARY, fontWeight: '700' },
  strong: { fontWeight: '800' },
  em: { fontStyle: 'italic' },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerTitle: { textAlign: 'center', maxWidth: '88%' },
  content: { padding: 16, gap: 14 },
  loader: { paddingVertical: 32, alignItems: 'center' },
  errorCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(186,26,26,0.30)',
  },
  errorText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  heroCard: {
    borderRadius: 18,
    padding: 16,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.30)',
  },
  seriesLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  descriptionText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  bodyCard: {
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.30)',
  },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  muted: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  mediaCard: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.30)',
  },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mediaTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtnDone: { backgroundColor: '#0F5238' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  ctaBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(45,106,79,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(45,106,79,0.25)',
    gap: 4,
  },
  ctaBtnLabel: { fontSize: 15, fontWeight: '800', color: PRIMARY },
  ctaBtnSubtitle: { fontSize: 13, lineHeight: 18, color: 'rgba(11,27,20,0.65)' },
  pressed: { opacity: 0.85 },
  linkModalRoot: { flex: 1, backgroundColor: '#F8F9FA' },
  linkModalBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  linkModalClose: { paddingVertical: 8, paddingHorizontal: 12 },
  linkModalCloseText: { fontSize: 16, fontWeight: '800', color: PRIMARY },
  linkModalWeb: { flex: 1, backgroundColor: '#FFFFFF' },
});

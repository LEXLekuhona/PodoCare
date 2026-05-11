import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View as RNView } from 'react-native';
import { Audio, ResizeMode, Video } from 'expo-av';
import type { AVPlaybackStatus } from 'expo-av';
import { WebView } from 'react-native-webview';

import { Text, View } from '@/components/Themed';
import { saveContentItemProgress } from '@/features/education/education-api';

const PRIMARY = '#2D6A4F';

function looksLikeDirectMediaUrl(url: string): boolean {
  return /\.(mp4|m4v|mov|m3u8)(\?|#|$)/i.test(url.trim());
}

/** Встроенное видео (MP4 / HLS). См. ADR 0002 — основной сценарий без внешнего браузера. */
export function ContentInlineVideo(props: { uri: string; itemId: string }) {
  const { uri, itemId } = props;
  const [error, setError] = useState<string | null>(null);
  const lastProgressSent = useRef(0);

  const onPlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded || !status.durationMillis || status.durationMillis <= 0) return;
      const pct = Math.min(99, Math.round((status.positionMillis / status.durationMillis) * 100));
      const now = Date.now();
      if (now - lastProgressSent.current < 20_000 || pct < 1) return;
      lastProgressSent.current = now;
      void saveContentItemProgress(itemId, {
        percent: pct,
        lastPositionSeconds: Math.floor(status.positionMillis / 1000),
      }).catch(() => undefined);
    },
    [itemId],
  );

  if (error) {
    return (
      <View style={mediaStyles.fallbackBox} lightColor="#FFF5F5" darkColor="#2A1515">
        <Text style={mediaStyles.fallbackText} lightColor="#7A271A" darkColor="#FFB4A9">
          {error}
        </Text>
      </View>
    );
  }

  return (
    <RNView style={mediaStyles.videoWrap}>
      <Video
        source={{ uri }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        style={mediaStyles.video}
        onError={() => setError('Не удалось воспроизвести видео. Проверьте ссылку и сеть.')}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />
    </RNView>
  );
}

/** Встроенное аудио без выхода в браузер. */
export function ContentInlineAudio(props: { uri: string; itemId: string }) {
  const { uri, itemId } = props;
  const soundRef = useRef<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionLabel, setPositionLabel] = useState('0:00');
  const [durationLabel, setDurationLabel] = useState('0:00');
  const lastProgressSent = useRef(0);

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          (status) => {
            if (!status.isLoaded) return;
            setPlaying(status.isPlaying);
            setPositionLabel(formatMs(status.positionMillis));
            setDurationLabel(formatMs(status.durationMillis ?? 0));
            const dur = status.durationMillis ?? 0;
            if (dur > 0) {
              const pct = Math.min(99, Math.round((status.positionMillis / dur) * 100));
              const now = Date.now();
              if (now - lastProgressSent.current >= 25_000 && pct >= 1) {
                lastProgressSent.current = now;
                void saveContentItemProgress(itemId, {
                  percent: pct,
                  lastPositionSeconds: Math.floor(status.positionMillis / 1000),
                }).catch(() => undefined);
              }
            }
          },
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Не удалось загрузить аудио.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, [uri, itemId]);

  const toggle = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    const st = await s.getStatusAsync();
    if (!st.isLoaded) return;
    if (st.isPlaying) await s.pauseAsync();
    else await s.playAsync();
  }, []);

  if (error) {
    return (
      <View style={mediaStyles.fallbackBox} lightColor="#FFF5F5" darkColor="#2A1515">
        <Text style={mediaStyles.fallbackText} lightColor="#7A271A" darkColor="#FFB4A9">
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={mediaStyles.audioCard} lightColor="#FFFFFF" darkColor="#0C1A14">
      {loading ? <ActivityIndicator color={PRIMARY} /> : null}
      <Text style={mediaStyles.audioTime} lightColor="rgba(11,27,20,0.75)" darkColor="rgba(255,255,255,0.65)">
        {positionLabel} / {durationLabel}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Пауза' : 'Воспроизвести'}
        onPress={toggle}
        disabled={loading}
        style={({ pressed }) => [mediaStyles.playBtn, pressed && mediaStyles.pressed]}
      >
        <Text style={mediaStyles.playBtnText}>{playing ? 'Пауза' : 'Слушать'}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Вебинар: прямой поток — нативное видео; страница (YouTube, Zoom и т.д.) — WebView внутри приложения.
 */
export function ContentWebinarEmbed(props: { uri: string; itemId: string }) {
  const { uri, itemId } = props;
  const [mode, setMode] = useState<'video' | 'web'>(() => (looksLikeDirectMediaUrl(uri) ? 'video' : 'web'));
  const lastProgressSent = useRef(0);

  if (mode === 'web') {
    return (
      <RNView style={mediaStyles.webviewWrap}>
        <WebView
          source={{ uri }}
          style={mediaStyles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState
          renderLoading={() => <ActivityIndicator style={mediaStyles.webLoading} color={PRIMARY} />}
        />
      </RNView>
    );
  }

  return (
    <RNView>
      <Video
        source={{ uri }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        style={mediaStyles.video}
        onError={() => setMode('web')}
        onPlaybackStatusUpdate={(st) => {
          if (!st.isLoaded || !st.durationMillis || st.durationMillis <= 0) return;
          const pct = Math.min(99, Math.round((st.positionMillis / st.durationMillis) * 100));
          const now = Date.now();
          if (now - lastProgressSent.current < 20_000 || pct < 1) return;
          lastProgressSent.current = now;
          void saveContentItemProgress(itemId, {
            percent: pct,
            lastPositionSeconds: Math.floor(st.positionMillis / 1000),
          }).catch(() => undefined);
        }}
      />
    </RNView>
  );
}

/** Встроенный просмотр PDF/страницы документа (не системный Safari). */
export function ContentDocumentWebView(props: { uri: string; title?: string }) {
  const { uri } = props;
  return (
    <View style={mediaStyles.docCard} lightColor="#FFFFFF" darkColor="#0C1A14">
      <Text style={mediaStyles.docCaption} lightColor="rgba(11,27,20,0.65)" darkColor="rgba(255,255,255,0.55)">
        {props.title ?? 'Документ'}
      </Text>
      <RNView style={mediaStyles.webviewWrap}>
        <WebView
          source={{ uri }}
          style={mediaStyles.docWebview}
          startInLoadingState
          renderLoading={() => <ActivityIndicator style={mediaStyles.webLoading} color={PRIMARY} />}
        />
      </RNView>
    </View>
  );
}

const mediaStyles = StyleSheet.create({
  videoWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  webviewWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    minHeight: 320,
  },
  webview: {
    flex: 1,
    minHeight: 320,
    backgroundColor: '#FFFFFF',
  },
  docWebview: {
    flex: 1,
    minHeight: 480,
    backgroundColor: '#F8F9FA',
  },
  webLoading: { paddingVertical: 24 },
  fallbackBox: {
    padding: 14,
    borderRadius: 14,
  },
  fallbackText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  audioCard: {
    borderRadius: 14,
    padding: 16,
    gap: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.30)',
  },
  audioTime: { fontSize: 14, fontWeight: '600' },
  playBtn: {
    minWidth: 160,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  playBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.88 },
  docCard: {
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.30)',
  },
  docCaption: { fontSize: 13, fontWeight: '700' },
});

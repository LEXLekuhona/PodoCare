import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { saveSelectedStudio } from '@/features/studio/local-studio-storage';
import { ApiError } from '@/shared/api/api-error';
import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

type StudioDto = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
};

export function StudioSelectorSheet() {
  const [studios, setStudios] = useState<StudioDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingList(true);
      setLoadError(null);
      try {
        const list = await apiFetchJsonAuth<StudioDto[]>('/studios');
        if (cancelled) return;
        setStudios(list);
        setSelectedId((prev) => prev || list[0]?.id || '');
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof ApiError ? e.message : 'Не удалось загрузить студии';
        setLoadError(message);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => studios.find((s) => s.id === selectedId) ?? null, [studios, selectedId]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)');
  };

  return (
    <View style={styles.overlay} lightColor="rgba(0,0,0,0.25)" darkColor="rgba(0,0,0,0.6)">
      <Pressable style={styles.backdrop} onPress={close} />

      <View style={styles.sheet} lightColor="#FFFFFF" darkColor="#0C1A14">
        <View style={styles.dragHandleWrap} lightColor="transparent" darkColor="transparent">
          <View style={styles.dragHandle} lightColor="rgba(149,163,160,0.55)" darkColor="rgba(255,255,255,0.20)" />
        </View>

        <View style={styles.header} lightColor="transparent" darkColor="transparent">
          <Text style={styles.title}>Выберите студию</Text>
          <Pressable onPress={close} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeText} lightColor="#2D6A4F" darkColor="#95D4B3">
              Закрыть
            </Text>
          </Pressable>
        </View>

        {loadingList ? (
          <View style={styles.centerPad} lightColor="transparent" darkColor="transparent">
            <ActivityIndicator />
          </View>
        ) : loadError ? (
          <View style={styles.centerPad} lightColor="transparent" darkColor="transparent">
            <Text style={styles.errorText} lightColor="#BA1A1A" darkColor="#FFB4A9">
              {loadError}
            </Text>
          </View>
        ) : (
          <View style={styles.list} lightColor="transparent" darkColor="transparent">
            {studios.map((s) => {
              const active = s.id === selectedId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedId(s.id)}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <View
                    style={[styles.card, active && styles.cardActive]}
                    lightColor={active ? 'rgba(45,106,79,0.08)' : '#FFFFFF'}
                    darkColor={active ? 'rgba(149,212,179,0.12)' : '#0C1A14'}
                  >
                    <View style={styles.cardText} lightColor="transparent" darkColor="transparent">
                      <Text style={styles.cardTitle}>{s.name}</Text>
                      <Text style={styles.cardAddr} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
                        {s.address}
                      </Text>
                      {s.phone ? (
                        <Text style={styles.cardPhone} lightColor="rgba(11,27,20,0.45)" darkColor="rgba(255,255,255,0.45)">
                          {s.phone}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[styles.radio, active && styles.radioActive]}
                      lightColor="#FFFFFF"
                      darkColor="#06130E"
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <SafeAreaPadding minTop={0} minBottom={16} style={styles.footer} lightColor="#FFFFFF" darkColor="#0C1A14">
          <Pressable
            onPress={() => {
              if (!selected || confirming) return;
              setConfirming(true);
              void (async () => {
                try {
                  await saveSelectedStudio({
                    id: selected.id,
                    name: selected.name,
                    address: selected.address,
                    phone: selected.phone,
                  });
                  router.replace('/(app)/(tabs)');
                } finally {
                  setConfirming(false);
                }
              })();
            }}
            disabled={!selected || confirming || loadingList || Boolean(loadError)}
            style={({ pressed }) => [
              styles.button,
              (!selected || confirming || loadingList || Boolean(loadError)) && styles.buttonDisabled,
              pressed && selected && !confirming && styles.buttonPressed,
            ]}
          >
            {confirming ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText} lightColor="#FFFFFF" darkColor="#06130E">
                Подтвердить
              </Text>
            )}
          </Pressable>
        </SafeAreaPadding>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 8,
    maxHeight: '78%',
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  centerPad: {
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  list: {
    paddingHorizontal: 18,
    gap: 12,
    paddingBottom: 8,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
  },
  cardActive: {
    borderColor: 'rgba(45,106,79,0.45)',
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  cardAddr: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  cardPhone: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(149,163,160,0.65)',
  },
  radioActive: {
    borderColor: '#2D6A4F',
    backgroundColor: '#2D6A4F',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pressed: {
    opacity: 0.85,
  },
});

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';

const ERROR = '#BA1A1A';
const ON_ERROR = '#FFFFFF';
const ERROR_CONTAINER_LIGHT = '#FFDAD6';
const MAX_REASON_LENGTH = 200;

function compactWhenRu(dateLine: string, timeLine: string): string {
  const i = dateLine.indexOf(',');
  const datePart = i >= 0 ? dateLine.slice(i + 1).trim() : dateLine.trim();
  return `${datePart} в ${timeLine}`;
}

export type CancelAppointmentSheetProps = {
  visible: boolean;
  onClose: () => void;
  serviceName: string;
  dateLine: string;
  timeLine: string;
  submitting: boolean;
  onConfirm: (reason: string | undefined) => void;
};

export function CancelAppointmentSheet(props: CancelAppointmentSheetProps) {
  const { visible, onClose, serviceName, dateLine, timeLine, submitting, onConfirm } = props;
  const [reason, setReason] = useState('');
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const whenPhrase = useMemo(() => compactWhenRu(dateLine, timeLine), [dateLine, timeLine]);

  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F5';
  const inputColor = isDark ? '#F5FBF7' : '#191C1D';
  const placeholderColor = '#707973';
  const iconCircleBg = isDark ? 'rgba(186,26,26,0.22)' : ERROR_CONTAINER_LIGHT;

  const safeClose = () => {
    if (!submitting) onClose();
  };

  const submit = () => {
    const trimmed = reason.trim();
    onConfirm(trimmed.length > 0 ? trimmed.slice(0, MAX_REASON_LENGTH) : undefined);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={safeClose}
    >
      <RNView style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Закрыть"
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={safeClose}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          style={styles.keyboardWrap}
          pointerEvents="box-none"
        >
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.sheet} lightColor="#FFFFFF" darkColor="#0C1A14">
              <View style={styles.dragHandleWrap} lightColor="transparent" darkColor="transparent">
                <View style={styles.dragHandle} lightColor="rgba(149,163,160,0.55)" darkColor="rgba(255,255,255,0.20)" />
              </View>

              <RNView style={styles.sheetBody}>
                <RNView style={[styles.iconCircle, { backgroundColor: iconCircleBg }]}>
                  <FontAwesome name="calendar-times-o" size={30} color={ERROR} />
                </RNView>

                <Text style={styles.title} lightColor="#1A1A2E" darkColor="#FFFFFF">
                  Отменить запись?
                </Text>

                <Text style={styles.description} lightColor="#404943" darkColor="rgba(255,255,255,0.65)">
                  Запись на{' '}
                  <Text style={styles.descriptionBold} lightColor="#1A1A2E" darkColor="#FFFFFF">
                    {serviceName}
                  </Text>{' '}
                  {whenPhrase} будет отменена
                </Text>

                <Text style={styles.fieldLabel} lightColor="#707973" darkColor="rgba(255,255,255,0.45)">
                  Причина (необязательно)
                </Text>

                <TextInput
                  value={reason}
                  onChangeText={(t) => setReason(t.slice(0, MAX_REASON_LENGTH))}
                  placeholder="Не смогу прийти..."
                  placeholderTextColor={placeholderColor}
                  multiline
                  editable={!submitting}
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: inputBg,
                      color: inputColor,
                    },
                  ]}
                  textAlignVertical="top"
                />

                <RNView style={styles.counterRow}>
                  <Text style={styles.counter} lightColor="#707973" darkColor="rgba(255,255,255,0.45)">
                    {reason.length}/{MAX_REASON_LENGTH}
                  </Text>
                </RNView>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Да, отменить запись"
                  disabled={submitting}
                  onPress={submit}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    submitting && styles.primaryBtnDisabled,
                    pressed && !submitting && styles.pressed,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color={ON_ERROR} />
                  ) : (
                    <RNView style={styles.primaryBtnInner}>
                      <FontAwesome name="times-circle" size={18} color={ON_ERROR} style={styles.primaryLeadingIcon} />
                      <Text style={styles.primaryBtnText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                        Да, отменить
                      </Text>
                    </RNView>
                  )}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Оставить запись"
                  disabled={submitting}
                  onPress={safeClose}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && !submitting && styles.pressed]}
                >
                  <Text style={styles.secondaryBtnText} lightColor="#1A1A2E" darkColor="#F5FBF7">
                    Оставить запись
                  </Text>
                </Pressable>
              </RNView>

              <RNView style={{ height: Math.max(insets.bottom, 12) }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </RNView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  sheetBody: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  descriptionBold: {
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  fieldLabel: {
    alignSelf: 'stretch',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },
  textArea: {
    alignSelf: 'stretch',
    minHeight: 96,
    maxHeight: 140,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(191,201,193,0.45)',
  },
  counterRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    marginBottom: 20,
  },
  counter: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  primaryBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ERROR,
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 20,
  },
  primaryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryLeadingIcon: {
    marginRight: 10,
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  secondaryBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  pressed: {
    opacity: 0.88,
  },
});

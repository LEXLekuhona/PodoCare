import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { StyleProp, TextStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';

type Props = {
  title?: string;
  /** Дополнительные стили для центрального заголовка (цвет бренда и т.п.). */
  titleStyle?: StyleProp<TextStyle>;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onBackPress?: (() => void) | null;
  variant?: 'solid' | 'transparent';
};

export function AppHeader(props: Props) {
  const insets = useSafeAreaInsets();
  const variant = props.variant ?? 'solid';

  return (
    <View
      style={[
        styles.root,
        { paddingTop: Math.max(insets.top, 16) },
        variant === 'transparent' && styles.transparent,
      ]}
      lightColor={variant === 'solid' ? '#FFFFFF' : 'transparent'}
      darkColor={variant === 'solid' ? '#06130E' : 'transparent'}
    >
      <View style={styles.row} lightColor="transparent" darkColor="transparent">
        <View style={styles.side} lightColor="transparent" darkColor="transparent">
          {props.onBackPress ? (
            <Pressable hitSlop={12} style={styles.backBtn} onPress={props.onBackPress}>
              <FontAwesome name="chevron-left" size={18} color="#2D6A4F" />
            </Pressable>
          ) : (
            props.left ?? <View style={styles.spacer} lightColor="transparent" darkColor="transparent" />
          )}
        </View>

        <View style={styles.center} lightColor="transparent" darkColor="transparent">
          {props.title ? <Text style={[styles.title, props.titleStyle]}>{props.title}</Text> : null}
        </View>

        <View style={styles.side} lightColor="transparent" darkColor="transparent">
          {props.right ?? <View style={styles.spacer} lightColor="transparent" darkColor="transparent" />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(149,163,160,0.25)',
  },
  transparent: {
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.08)',
  },
  spacer: {
    width: 36,
    height: 36,
  },
});


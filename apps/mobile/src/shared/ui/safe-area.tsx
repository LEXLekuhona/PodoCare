import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { View } from '@/components/Themed';

type SafeAreaPaddingProps = {
  children: React.ReactNode;
  /** Minimal padding on top of insets. Default 0. */
  minTop?: number;
  /** Minimal padding on bottom of insets. Default 0. */
  minBottom?: number;
  style?: object;
  lightColor?: string;
  darkColor?: string;
};

export function SafeAreaPadding(props: SafeAreaPaddingProps) {
  const insets = useSafeAreaInsets();
  const top = props.minTop ?? 0;
  const bottom = props.minBottom ?? 0;

  return (
    <View
      style={[
        styles.root,
        { paddingTop: Math.max(insets.top, top), paddingBottom: Math.max(insets.bottom, bottom) },
        props.style,
      ]}
      lightColor={props.lightColor}
      darkColor={props.darkColor}
    >
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {},
});


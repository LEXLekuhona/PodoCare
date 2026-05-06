import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export function BookingPage() {
  return (
    <View style={styles.root}>
      <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
        <Text style={styles.title}>Запись</Text>
        <Text style={styles.sub} lightColor="rgba(11,27,20,0.65)" darkColor="rgba(255,255,255,0.65)">
          Выберите дату и время, затем услугу.
        </Text>
        <Pressable
          onPress={() => router.push('/(app)/studio-selector')}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText} lightColor="#FFFFFF" darkColor="#06130E">
            Выбрать студию
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  title: { fontSize: 18, fontWeight: '900' },
  sub: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  button: {
    marginTop: 8,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.9 },
});


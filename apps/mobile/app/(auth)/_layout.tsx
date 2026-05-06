import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="quiz" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="name" />
      <Stack.Screen name="consent" />
    </Stack>
  );
}


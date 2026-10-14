import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../state/Store';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="business/[id]" />
          <Stack.Screen name="contribute/[id]" />
          <Stack.Screen name="claims/[id]" />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

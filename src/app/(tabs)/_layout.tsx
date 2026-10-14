import { Tabs } from 'expo-router';
import { colors } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Cerca' }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Mappa' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profilo' }}
      />
    </Tabs>
  );
}

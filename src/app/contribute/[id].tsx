import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { ContributeForm } from '../../features/contributions/ContributeForm';
import { useStore } from '../../state/Store';
import { colors, space } from '../../theme';

export default function ContributeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { catalog } = useStore();
  const business = catalog.businesses.find((item) => item.id === id);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Button label="Indietro" variant="quiet" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text accessibilityRole="header" style={styles.title}>
          {business ? business.name : 'Contributo'}
        </Text>
        <Text style={styles.body}>Modulo breve. Una proposta in attesa non sostituisce gli orari pubblicati.</Text>
        {id ? <ContributeForm businessId={id} /> : <Text style={styles.body}>Scheda mancante.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: space.lg, gap: space.md, width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: 48 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 22 },
});

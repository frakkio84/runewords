import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import type { VerificationMethod } from '../../domain/catalog';
import { useStore } from '../../state/Store';
import { colors, space } from '../../theme';

const METHODS: Array<{ id: VerificationMethod; label: string }> = [
  { id: 'document', label: 'Documento dell’attività' },
  { id: 'business_contact', label: 'Contatto aziendale' },
  { id: 'manual_review', label: 'Revisione manuale' },
];

export function ClaimForm({ businessId }: { businessId: string }) {
  const { catalog, profile, userId, claimAs } = useStore();
  const existing = catalog.claims.find(
    (item) => item.businessId === businessId && item.userId === userId && item.status !== 'rejected',
  );
  const [name, setName] = useState(profile?.displayName ?? '');
  const [method, setMethod] = useState<VerificationMethod>('manual_review');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (existing) {
    const status =
      existing.status === 'pending'
        ? 'In attesa di verifica. Non puoi ancora modificare gli orari.'
        : existing.status === 'verified'
          ? 'Titolare verificato per questa scheda.'
          : existing.status === 'revoked'
            ? 'Verifica revocata. I permessi di gestione non sono attivi.'
            : 'Richiesta rifiutata.';
    return <Text style={styles.body}>{status}</Text>;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.body}>
        La richiesta resta in attesa finché un moderatore non la verifica. Nel frattempo non ottieni permessi di gestione.
      </Text>
      <Text style={styles.label}>Il tuo nome</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={styles.input}
        accessibilityLabel="Nome di chi rivendica"
      />
      {METHODS.map((item) => {
        const selected = method === item.id;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => setMethod(item.id)}
            style={[styles.choice, selected && styles.choiceOn]}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{item.label}</Text>
          </Pressable>
        );
      })}
      <Text style={styles.label}>Nota per la verifica</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        style={[styles.input, styles.multiline]}
        multiline
        accessibilityLabel="Nota per la verifica"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <Button
        label="Invia richiesta di titolarità"
        onPress={() => {
          setError(null);
          const result = claimAs(name, { businessId, verificationMethod: method, note });
          if (!result.ok) setError(result.message);
          else setMessage(result.message);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  body: { color: colors.ink, fontSize: 16, lineHeight: 22 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: space.md,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  choice: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: space.md,
  },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  choiceTextOn: { color: colors.onPrimary },
  error: { color: colors.danger, fontSize: 15 },
  ok: { color: colors.openInk, fontSize: 16, fontWeight: '700', lineHeight: 22 },
});

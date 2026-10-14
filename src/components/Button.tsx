import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, space } from '../theme';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'quiet' && styles.quiet,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === 'primary' && styles.primaryLabel,
          variant !== 'primary' && styles.secondaryLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  quiet: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.75 },
  label: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  primaryLabel: { color: colors.onPrimary },
  secondaryLabel: { color: colors.ink },
});

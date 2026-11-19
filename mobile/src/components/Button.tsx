import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '../theme';

export function Button({
  label,
  onPress,
  kind = 'fill',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'fill' | 'primary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const backgroundColor = kind === 'primary' ? theme.accent : kind === 'danger' ? theme.fill : theme.fill;
  const color = kind === 'primary' ? theme.white : kind === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { backgroundColor, opacity: disabled ? 0.55 : 1 }, style]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  label: { fontSize: 15, fontWeight: '600' },
});

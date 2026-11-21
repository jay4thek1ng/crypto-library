import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

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
  const colors = useTheme();
  const backgroundColor = kind === 'primary' ? colors.accent : colors.fill;
  const color = kind === 'primary' ? colors.accentOnFill : kind === 'danger' ? colors.danger : colors.text;
  const borderColor = kind === 'primary' ? colors.accent : colors.pillBorder;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor, borderColor, borderWidth: kind === 'primary' ? 0 : 1, opacity: disabled ? 0.55 : 1 },
        style,
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  label: { fontSize: 15, fontWeight: '600' },
});

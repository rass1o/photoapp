import { createContext, useContext } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  TextProps,
  TextInputProps,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
import { colors, fonts } from '../theme';

// Drop-in replacements for React Native's Text and TextInput that use the
// app font. They turn fontWeight into the matching Fredoka family, since
// custom fonts don't synthesize weights (bold would render regular on Android).

function familyFor(weight: TextStyle['fontWeight']) {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

// Nested <Text> without its own weight should inherit the parent's font,
// not reset to regular
const InsideText = createContext(false);

function withFont(style: StyleProp<TextStyle>, nested: boolean): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return style;
  if (nested && flat.fontWeight == null) return style;
  return [style, { fontFamily: familyFor(flat.fontWeight), fontWeight: 'normal' }];
}

export function Text(props: TextProps) {
  const nested = useContext(InsideText);
  const text = <RNText {...props} style={withFont(props.style, nested)} />;
  return nested ? text : <InsideText.Provider value={true}>{text}</InsideText.Provider>;
}

export function TextInput(props: TextInputProps) {
  return (
    <RNTextInput placeholderTextColor={colors.faint} {...props} style={withFont(props.style, false)} />
  );
}

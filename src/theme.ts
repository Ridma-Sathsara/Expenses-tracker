import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F6FB',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  primary: '#4F46E5',
  primaryText: '#FFFFFF',
  danger: '#DC2626',
  success: '#16A34A',
  bubbleMe: '#4F46E5',
  bubbleMeText: '#FFFFFF',
  bubbleBot: '#FFFFFF',
  input: '#FFFFFF',
};

const dark: typeof light = {
  bg: '#0B1020',
  card: '#151B2E',
  text: '#E5E7EB',
  muted: '#94A3B8',
  border: '#263046',
  primary: '#818CF8',
  primaryText: '#0B1020',
  danger: '#F87171',
  success: '#4ADE80',
  bubbleMe: '#6366F1',
  bubbleMeText: '#FFFFFF',
  bubbleBot: '#1E2640',
  input: '#151B2E',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

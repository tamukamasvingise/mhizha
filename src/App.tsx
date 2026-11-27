import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Shell } from './shell/Shell';

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

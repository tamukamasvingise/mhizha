import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button, styles as parts } from '../ui/parts';
import { useColours } from '../ui/theme';
import { radius, size, space } from '../ui/tokens';
import { signaturePath, signatureSvg, type Stroke } from './signature';

/** A pad to draw a signature on with a finger. `onKeep` gets the SVG file text. */
export function SignaturePad({ onKeep }: { onKeep: (svg: string) => void }) {
  const c = useColours();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const live = useRef<Stroke[]>([]);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        live.current = [...live.current, [{ x, y }]];
        setStrokes(live.current);
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        const last = live.current[live.current.length - 1];
        if (!last) return;
        live.current = [...live.current.slice(0, -1), [...last, { x, y }]];
        setStrokes(live.current);
      },
    }),
  ).current;

  const clear = () => {
    live.current = [];
    setStrokes([]);
  };
  const svg = signatureSvg(strokes, box.width, box.height);

  return (
    <View style={local.wrap}>
      <Text style={[parts.small, { color: c.label }]}>Sign with your finger in the box.</Text>
      <View
        accessible
        accessibilityLabel="Signature box"
        accessibilityHint="Draw your signature with your finger."
        onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        style={[local.pad, { borderColor: c.input, backgroundColor: c.surface }]}
        {...responder.panHandlers}
      >
        <Svg width="100%" height="100%" pointerEvents="none">
          <Path
            d={signaturePath(strokes) || 'M0 0'}
            fill="none"
            stroke={c.fg}
            strokeWidth={size.ring}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={local.actions}>
        <View style={local.grow}>
          <Button label="Clear" onPress={clear} />
        </View>
        <View style={local.grow}>
          <Button label="Keep signature" onPress={() => svg && onKeep(svg)} primary={!!svg} />
        </View>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  wrap: { gap: space.s2 },
  pad: { height: size.signatureH, borderWidth: size.hairline, borderRadius: radius.r, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: space.s2 },
  grow: { flex: 1 },
});

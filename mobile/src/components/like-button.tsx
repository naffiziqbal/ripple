import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../lib/theme';

interface LikeButtonProps {
  liked: boolean;
  count: number;
  onPress: () => void;
}

/**
 * The app's signature moment: liking a post drops a stone in the water —
 * two concentric rings ripple out from under your thumb.
 */
export function LikeButton({ liked, count, onPress }: LikeButtonProps) {
  const burst = useSharedValue(0);
  const pop = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  function handlePress() {
    if (!liked && !reducedMotion) {
      burst.value = 0;
      burst.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
      pop.value = 0.6;
      pop.value = withSpring(1, { damping: 9, stiffness: 220 });
    }
    onPress();
  }

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  const outerRing = useAnimatedStyle(() => ({
    opacity: burst.value === 0 ? 0 : interpolate(burst.value, [0, 1], [0.55, 0]),
    transform: [{ scale: interpolate(burst.value, [0, 1], [0.4, 2.4]) }],
  }));

  const innerRing = useAnimatedStyle(() => {
    const p = Math.max(0, (burst.value - 0.18) / 0.82);
    return {
      opacity: burst.value === 0 ? 0 : interpolate(p, [0, 1], [0.4, 0]),
      transform: [{ scale: interpolate(p, [0, 1], [0.3, 1.7]) }],
    };
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Unlike' : 'Like'}
      onPress={handlePress}
      hitSlop={10}
      className="flex-row items-center gap-2"
    >
      <View className="h-7 w-7 items-center justify-center">
        <Animated.View
          className="pointer-events-none absolute h-10 w-10 rounded-full border-2 border-koi"
          style={outerRing}
        />
        <Animated.View
          className="pointer-events-none absolute h-10 w-10 rounded-full border border-koi"
          style={innerRing}
        />
        <Animated.View style={heartStyle}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={22}
            color={liked ? colors.koi : colors.mist}
          />
        </Animated.View>
      </View>
      <Text className={`font-displaymed text-sm ${liked ? 'text-koi' : 'text-mist'}`}>
        {count}
      </Text>
    </Pressable>
  );
}

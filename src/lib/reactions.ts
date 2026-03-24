export const REACTION_TYPES = [
  { key: "pray", emoji: "🙏", label: "Pray", color: "text-amber-500" },
  { key: "love", emoji: "❤️", label: "Love", color: "text-red-500" },
  { key: "haha", emoji: "😂", label: "Haha", color: "text-yellow-500" },
  { key: "wow", emoji: "😮", label: "Wow", color: "text-yellow-400" },
  { key: "sad", emoji: "😢", label: "Sad", color: "text-blue-400" },
  { key: "angry", emoji: "😡", label: "Angry", color: "text-orange-500" },
] as const;

export type ReactionType = typeof REACTION_TYPES[number]["key"];

export function getReaction(key: string) {
  return REACTION_TYPES.find((r) => r.key === key) ?? REACTION_TYPES[0];
}

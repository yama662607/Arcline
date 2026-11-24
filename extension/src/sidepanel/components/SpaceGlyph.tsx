import {
  Bookmark,
  BookOpen,
  Briefcase,
  Calendar,
  Clock,
  Cloud,
  Code2,
  Flag,
  Flame,
  Gift,
  Globe,
  Heart,
  Home,
  Keyboard,
  Leaf,
  Lock,
  Moon,
  Music,
  Plane,
  Sparkles,
  Star,
  Terminal,
  ThumbsUp,
  Zap,
} from 'lucide-react';

/** Maps Arc's built-in Space icon names (e.g. thumbsUp, leaf, musicalNote) or user emojis to clean symbols. */
export function SpaceGlyph({ icon, size = 14 }: { icon?: string; size?: number }) {
  if (!icon) {
    return (
      <span
        aria-hidden="true"
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, backgroundColor: 'currentColor' }}
      />
    );
  }
  switch (icon) {
    case 'thumbsUp':
      return <ThumbsUp size={size} strokeWidth={2} />;
    case 'leaf':
      return <Leaf size={size} strokeWidth={2} />;
    case 'music':
    case 'musicNote':
    case 'musicalNote':
      return <Music size={size} strokeWidth={2} />;
    case 'star':
      return <Star size={size} strokeWidth={2} />;
    case 'heart':
      return <Heart size={size} strokeWidth={2} />;
    case 'flame':
      return <Flame size={size} strokeWidth={2} />;
    case 'bolt':
      return <Zap size={size} strokeWidth={2} />;
    case 'book':
      return <BookOpen size={size} strokeWidth={2} />;
    case 'briefcase':
      return <Briefcase size={size} strokeWidth={2} />;
    case 'home':
      return <Home size={size} strokeWidth={2} />;
    case 'code':
      return <Code2 size={size} strokeWidth={2} />;
    case 'terminal':
      return <Terminal size={size} strokeWidth={2} />;
    case 'globe':
      return <Globe size={size} strokeWidth={2} />;
    case 'sparkles':
      return <Sparkles size={size} strokeWidth={2} />;
    case 'airplane':
      return <Plane size={size} strokeWidth={2} />;
    case 'bookmark':
      return <Bookmark size={size} strokeWidth={2} />;
    case 'calendar':
      return <Calendar size={size} strokeWidth={2} />;
    case 'clock':
      return <Clock size={size} strokeWidth={2} />;
    case 'cloud':
      return <Cloud size={size} strokeWidth={2} />;
    case 'flag':
      return <Flag size={size} strokeWidth={2} />;
    case 'gift':
      return <Gift size={size} strokeWidth={2} />;
    case 'keyboard':
      return <Keyboard size={size} strokeWidth={2} />;
    case 'lock':
      return <Lock size={size} strokeWidth={2} />;
    case 'moon':
      return <Moon size={size} strokeWidth={2} />;
    default:
      // Guard against unknown ASCII icon identifiers from Arc spilling raw text into the bar
      if (/^[a-zA-Z0-9_-]{3,}$/.test(icon)) {
        return (
          <span
            aria-hidden="true"
            className="inline-block rounded-full"
            style={{ width: 6, height: 6, backgroundColor: 'currentColor' }}
          />
        );
      }
      return (
        <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1 }}>
          {icon}
        </span>
      );
  }
}

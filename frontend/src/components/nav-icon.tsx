import { AtSign, LayoutGrid, List, Send, Settings, Users, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  grid: LayoutGrid,
  list: List,
  'at-sign': AtSign,
  send: Send,
  users: Users,
  settings: Settings,
};

export function NavIcon({ name }: { name: string }) {
  const Icon = ICONS[name] ?? List;
  return <Icon />;
}

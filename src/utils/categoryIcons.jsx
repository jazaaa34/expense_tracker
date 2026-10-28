import {
  Utensils,
  ShoppingCart,
  Car,
  Zap,
  ShoppingBag,
  Film,
  HeartPulse,
  BookOpen,
  Plane,
  MoreHorizontal,
  Wallet,
  Laptop,
  TrendingUp,
  Gift,
  Building2,
  CircleDollarSign,
  Tag
} from 'lucide-react';

const CATEGORY_ICONS = {
  Utensils,
  ShoppingCart,
  Car,
  Zap,
  ShoppingBag,
  Film,
  HeartPulse,
  BookOpen,
  Plane,
  MoreHorizontal,
  Wallet,
  Laptop,
  TrendingUp,
  Gift,
  Building2,
  CircleDollarSign,
  Tag
};

export function getCategoryIcon(iconName) {
  return CATEGORY_ICONS[iconName] || Tag;
}

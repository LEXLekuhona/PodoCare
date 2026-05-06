import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SvgXml } from 'react-native-svg';

import { resolveConcernIconKey } from '@/shared/lib/concern-icon-key';
import { FungusIcon } from '@/shared/ui/icons/concerns/FungusIcon';
import { NailIcon } from '@/shared/ui/icons/concerns/NailIcon';
import { SweatIcon } from '@/shared/ui/icons/concerns/SweatIcon';

type Props = {
  slug: string;
  title: string;
  size?: number;
  color?: string;
};

/** Обёртка 24×24, stroke/fill подставляется из color */
function strokeSvg(inner: string): string {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

const SLUG_PATHS: Record<string, string> = {
  'knee-pain': strokeSvg(
    `<circle cx="12" cy="9" r="2.25" stroke="__C__" stroke-width="1.65"/>
<path d="M10 3v5.2M14 3v5.2M10 11.25v9.75M14 11.25v9.75" stroke="__C__" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  'migraines-and-headaches': strokeSvg(
    `<ellipse cx="12" cy="11" rx="5.5" ry="6" stroke="__C__" stroke-width="1.65"/>
<path d="M8 5.5l-1.2-2.2M16 5.5l1.2-2.2M9.5 15.5l1.2 2.8M14.5 15.5l-1.2 2.8" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>`,
  ),
  'neck-hump-tension': strokeSvg(
    `<path d="M12 5v5" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>
<path d="M5.5 19c2.8-3.2 5.5-4.5 6.5-4.5s3.7 1.3 6.5 4.5" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>
<path d="M8.5 14.5c1.8-2.8 4.2-2.8 7 0" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>`,
  ),
  'back-pain': strokeSvg(
    `<path d="M12 3.5v17" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>
<path d="M9 6.5h6M8 11.5h8M9 16.5h6" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>`,
  ),
  'nail-and-skin-fungus': '__FUNGUS__',
  'warts': strokeSvg(
    `<rect x="5" y="6.5" width="14" height="11" rx="2" stroke="__C__" stroke-width="1.65"/>
<circle cx="9.5" cy="10.5" r="1.35" fill="__C__"/>
<circle cx="14.5" cy="9.8" r="1.1" fill="__C__"/>
<circle cx="12" cy="14.2" r="1.2" fill="__C__"/>`,
  ),
  'skin-cracks-and-dryness': strokeSvg(
    `<path d="M4 9h16" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>
<path d="M6.5 9l-1.5 8.5M17.5 9l-1.5 8.5M9.5 12l1.8 5.5M14.5 12l-1.8 5.5" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>`,
  ),
  'onycholysis': strokeSvg(
    `<path d="M7 8.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" stroke="__C__" stroke-width="1.65"/>
<path d="M7 11.5h10" stroke="__C__" stroke-width="1.4" stroke-dasharray="2 2.5" stroke-linecap="round"/>`,
  ),
  'ingrown-toenail': strokeSvg(
    `<path d="M8 15.5h8c1.4 0 2.5-1 2.5-2.4V9.2H8v6.3z" stroke="__C__" stroke-width="1.65" stroke-linejoin="round"/>
<path d="M9.5 16.8l1.2-3.6" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>`,
  ),
  'fatigue-low-energy': strokeSvg(
    `<rect x="5" y="8" width="12" height="8" rx="1.5" stroke="__C__" stroke-width="1.65"/>
<path d="M17 10.5h2v3h-2z" fill="__C__"/>
<path d="M7.5 12h5" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>`,
  ),
  'sleep-disorders': strokeSvg(
    `<path d="M17.5 14.2a6.8 6.8 0 0 1-9.9-7.4 5.4 5.4 0 1 0 9.9 7.4z" stroke="__C__" stroke-width="1.65" stroke-linejoin="round"/>`,
  ),
  'acne': strokeSvg(
    `<circle cx="12" cy="12" r="7" stroke="__C__" stroke-width="1.65"/>
<circle cx="9.2" cy="11" r="0.9" fill="__C__"/>
<circle cx="14.8" cy="10.5" r="0.85" fill="__C__"/>
<circle cx="12" cy="15" r="0.9" fill="__C__"/>`,
  ),
  'hair-loss-alopecia': strokeSvg(
    `<path d="M6.5 15.5c2-4.5 5.5-7 11.5-5.5" stroke="__C__" stroke-width="1.65" stroke-linecap="round" fill="none"/>
<path d="M9 11.5v3.5M12 9.5v4.5M15 11.5v3.5" stroke="__C__" stroke-width="1.65" stroke-linecap="round"/>`,
  ),
};

function xmlForSlug(slug: string, color: string): string | null {
  const raw = SLUG_PATHS[slug];
  if (raw == null) return null;
  if (raw === '__FUNGUS__') return null;
  return raw.replace(/__C__/g, color);
}

/**
 * Иконка жалобы: сначала по стабильному slug, иначе по ключевым словам в title (старые данные).
 */
export function ConcernIcon(props: Props) {
  const size = props.size ?? 18;
  const color = props.color ?? '#2D6A4F';
  const xml = xmlForSlug(props.slug, color);
  if (xml) {
    return <SvgXml xml={xml} width={size} height={size} />;
  }
  if (props.slug === 'nail-and-skin-fungus') {
    return <FungusIcon size={size} color={color} />;
  }

  const key = resolveConcernIconKey(props.title);
  if (key === 'fungus') return <FungusIcon size={size} color={color} />;
  if (key === 'nail') return <NailIcon size={size} color={color} />;
  if (key === 'sweat') return <SweatIcon size={size} color={color} />;
  if (key === 'corn') return <FontAwesome name="circle-o" size={size * 0.9} color={color} />;
  return <FontAwesome name="stethoscope" size={size * 0.9} color={color} />;
}

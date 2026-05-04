import { SvgXml } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

const XML = `<svg width="18" height="25" viewBox="0 0 18 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M7.15 15.4H10.45V12.65H13.2V9.35H10.45V6.6H7.15V9.35H4.4V12.65H7.15V15.4ZM0 19.8V6.6L8.8 0L17.6 6.6V19.8H0Z" fill="#2D6A4F"/>
</svg>`;

export function HomeTabIcon(props: Props) {
  const size = props.size ?? 24;
  const color = props.color ?? '#707973';
  const xml = XML.replace(/fill="#(?:707973|2D6A4F)"/g, `fill="${color}"`);
  return <SvgXml xml={xml} width={size} height={size} />;
}

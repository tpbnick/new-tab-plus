export type WeatherIconName = 'sun' | 'cloud-sun' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

const ICON_PATHS: Record<WeatherIconName, string> = {
  sun: `
    <circle cx="12" cy="12" r="4.5" />
    <g stroke-linecap="round">
      <line x1="12" y1="1.5" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22.5" />
      <line x1="1.5" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22.5" y2="12" />
      <line x1="4.5" y1="4.5" x2="6.2" y2="6.2" />
      <line x1="17.8" y1="17.8" x2="19.5" y2="19.5" />
      <line x1="4.5" y1="19.5" x2="6.2" y2="17.8" />
      <line x1="17.8" y1="6.2" x2="19.5" y2="4.5" />
    </g>
  `,
  'cloud-sun': `
    <circle cx="8" cy="7.5" r="3.2" />
    <g stroke-linecap="round">
      <line x1="8" y1="1.5" x2="8" y2="3" />
      <line x1="2.7" y1="7.5" x2="4.2" y2="7.5" />
      <line x1="4.1" y1="3.6" x2="5.2" y2="4.7" />
    </g>
    <path d="M6 21h11.5a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 11a4.5 4.5 0 0 0-1.6 8.9" fill="none" />
  `,
  cloud: `
    <path d="M7 19h11.5a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 8.6 9a4.5 4.5 0 0 0-1.6 9.9" fill="none" />
  `,
  fog: `
    <path d="M7 14h11.5a4 4 0 0 0 .3-7.97A5.5 5.5 0 0 0 8.6 4 4.5 4.5 0 0 0 7 13.5" fill="none" />
    <g stroke-linecap="round">
      <line x1="4" y1="18" x2="20" y2="18" />
      <line x1="6" y1="21.5" x2="18" y2="21.5" />
    </g>
  `,
  drizzle: `
    <path d="M6 13h11.5a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 3a4.5 4.5 0 0 0-1.6 9.9" fill="none" />
    <g stroke-linecap="round">
      <line x1="9" y1="17" x2="8" y2="20" />
      <line x1="14" y1="17" x2="13" y2="20" />
    </g>
  `,
  rain: `
    <path d="M6 12h11.5a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 2a4.5 4.5 0 0 0-1.6 9.9" fill="none" />
    <g stroke-linecap="round">
      <line x1="8" y1="16" x2="6.5" y2="21" />
      <line x1="13" y1="16" x2="11.5" y2="21" />
      <line x1="18" y1="16" x2="16.5" y2="21" />
    </g>
  `,
  snow: `
    <path d="M6 12h11.5a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 2a4.5 4.5 0 0 0-1.6 9.9" fill="none" />
    <g stroke-linecap="round">
      <line x1="8" y1="17" x2="8" y2="21" />
      <line x1="5.8" y1="19" x2="10.2" y2="19" />
      <line x1="16" y1="17" x2="16" y2="21" />
      <line x1="13.8" y1="19" x2="18.2" y2="19" />
    </g>
  `,
  storm: `
    <path d="M6 12h11.5a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.6 2a4.5 4.5 0 0 0-1.6 9.9" fill="none" />
    <path d="M13 14.5 9.5 19h3l-1.5 4 5-5.5h-3z" />
  `,
};

export function createWeatherIcon(name: WeatherIconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'weather-icon');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.innerHTML = ICON_PATHS[name];
  return svg;
}

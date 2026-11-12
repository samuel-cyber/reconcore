export const theme = {
  bg: '#070B14',
  bgSoft: '#0E1626',
  panel: '#131D30',
  line: 'rgba(148,163,184,0.18)',
  text: '#F8FAFC',
  muted: '#94A3B8',
  green: '#10B981',
  greenSoft: 'rgba(16,185,129,0.14)',
  red: '#F05252',
  redSoft: 'rgba(240,82,82,0.14)',
  amber: '#F59E0B',
  amberSoft: 'rgba(245,158,11,0.14)',
  sans: "'Poppins', 'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const fontCss = `
@font-face { font-family: 'Poppins'; font-weight: 400; font-display: block;
  src: url('__F400__') format('woff2'); }
@font-face { font-family: 'Poppins'; font-weight: 500; font-display: block;
  src: url('__F500__') format('woff2'); }
@font-face { font-family: 'Poppins'; font-weight: 600; font-display: block;
  src: url('__F600__') format('woff2'); }
@font-face { font-family: 'Poppins'; font-weight: 700; font-display: block;
  src: url('__F700__') format('woff2'); }
@font-face { font-family: 'JetBrains Mono'; font-weight: 400; font-display: block;
  src: url('__FMONO__') format('woff2'); }
`;

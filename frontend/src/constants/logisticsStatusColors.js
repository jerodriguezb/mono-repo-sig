const COLOR_BLUE = '#1E88E5';
const COLOR_YELLOW = '#FFC107';
const COLOR_GREEN = '#2E7D32';
const COLOR_ORANGE = '#FB8C00';
const COLOR_RED = '#D32F2F';

const normalizeStatus = (estado) =>
  (estado ?? '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

const STATUS_COLOR_RULES = [
  { matchers: ['entregado', 'finalizado', 'completado'], color: COLOR_GREEN },
  { matchers: ['pendiente', 'solicitado', 'nuevo'], color: COLOR_YELLOW },
  { matchers: ['demorado', 'demora', 'reprogramado', 'postergado'], color: COLOR_ORANGE },
  {
    matchers: ['cancelado', 'rechazado', 'anulado', 'devuelto', 'no entregado'],
    color: COLOR_RED,
  },
  {
    matchers: ['transito', 'tránsito', 'camino', 'enviado', 'curso', 'asignado'],
    color: COLOR_BLUE,
  },
];

export const LOGISTICS_STATUS_COLORS = {
  blue: COLOR_BLUE,
  yellow: COLOR_YELLOW,
  green: COLOR_GREEN,
  orange: COLOR_ORANGE,
  red: COLOR_RED,
};

export const getLogisticsStatusColor = (estado) => {
  const normalized = normalizeStatus(estado);
  if (!normalized) {
    return COLOR_BLUE;
  }

  const matchedRule = STATUS_COLOR_RULES.find((rule) =>
    rule.matchers.some((matcher) => normalized.includes(matcher)),
  );

  return matchedRule?.color ?? COLOR_BLUE;
};

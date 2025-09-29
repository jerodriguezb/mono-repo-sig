const DEFAULT_LABEL = '—';

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const sumItemsCantidad = (items = []) => {
  if (!Array.isArray(items) || !items.length) return 0;
  return items.reduce((acc, item) => acc + Number(item?.cantidad ?? 0), 0);
};

const formatProductsSummary = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return DEFAULT_LABEL;

  const summaries = items
    .map((item) => {
      const descripcion = normalizeText(item?.codprod?.descripcion);
      const presentacion = normalizeText(item?.codprod?.presentacion);
      const cantidadText = String(item?.cantidad ?? '').trim();
      const label = [descripcion, presentacion].filter(Boolean).join(' ').trim();
      if (!label || !cantidadText) return '';
      return `${label} (${cantidadText})`;
    })
    .filter(Boolean);

  return summaries.length ? summaries.join(' - ') : DEFAULT_LABEL;
};

const buildGroupingValue = ({ key, label, rawValue = null, sortValue = null, fallbackKey }) => {
  const safeLabel = label ? String(label).trim() : DEFAULT_LABEL;
  const normalizedKey =
    key !== undefined && key !== null && key !== ''
      ? String(key)
      : fallbackKey ?? safeLabel || DEFAULT_LABEL;

  return {
    key: normalizedKey,
    label: safeLabel || DEFAULT_LABEL,
    rawValue,
    sortValue: sortValue !== undefined && sortValue !== null
      ? String(sortValue).toLowerCase()
      : (safeLabel || DEFAULT_LABEL).toLowerCase(),
  };
};

const groupingResolvers = {
  nrodecomanda: (comanda) => {
    const nro = comanda?.nrodecomanda;
    if (nro === undefined || nro === null) {
      return buildGroupingValue({ key: '__sin_nro__', label: DEFAULT_LABEL });
    }
    const label = String(nro).trim();
    return buildGroupingValue({
      key: label,
      label,
      rawValue: nro,
      sortValue: label.padStart(12, '0'),
    });
  },
  cliente: (comanda) => {
    const id = comanda?.codcli?._id ? String(comanda.codcli._id) : null;
    const label = normalizeText(comanda?.codcli?.razonsocial) || DEFAULT_LABEL;
    return buildGroupingValue({
      key: id ?? label.toLowerCase(),
      label,
      rawValue: id,
    });
  },
  ruta: (comanda) => {
    const rutaId =
      (comanda?.codcli?.ruta?._id && String(comanda.codcli.ruta._id)) ||
      (comanda?.camion?.rutaId && String(comanda.camion.rutaId)) ||
      null;
    const rutaLabel = normalizeText(comanda?.codcli?.ruta?.ruta) || normalizeText(comanda?.camion?.ruta) || DEFAULT_LABEL;
    return buildGroupingValue({
      key: rutaId ?? rutaLabel.toLowerCase(),
      label: rutaLabel,
      rawValue: rutaId,
    });
  },
  producto: (comanda) => {
    const summary = formatProductsSummary(comanda?.items);
    return buildGroupingValue({
      key: summary.toLowerCase(),
      label: summary,
    });
  },
  rubro: (comanda) => {
    const rubroId = comanda?.items?.[0]?.codprod?.rubro?._id
      ? String(comanda.items[0].codprod.rubro._id)
      : null;
    const rubroLabel = normalizeText(comanda?.items?.[0]?.codprod?.rubro?.descripcion) || DEFAULT_LABEL;
    return buildGroupingValue({
      key: rubroId ?? rubroLabel.toLowerCase(),
      label: rubroLabel,
      rawValue: rubroId,
    });
  },
  camion: (comanda) => {
    const camionId = comanda?.camion?._id ? String(comanda.camion._id) : null;
    const camionLabel = normalizeText(comanda?.camion?.camion) || DEFAULT_LABEL;
    return buildGroupingValue({
      key: camionId ?? camionLabel.toLowerCase(),
      label: camionLabel,
      rawValue: camionId,
    });
  },
};

const ALLOWED_GROUPING_COLUMNS = Object.keys(groupingResolvers);

const sanitizeGrouping = (grouping) => {
  if (!Array.isArray(grouping) || !grouping.length) return [];
  const seen = new Set();
  const result = [];
  grouping.forEach((columnId) => {
    if (!ALLOWED_GROUPING_COLUMNS.includes(columnId)) return;
    if (seen.has(columnId)) return;
    seen.add(columnId);
    result.push(columnId);
  });
  return result;
};

const buildComandaGroups = (comandas, grouping) => {
  const sanitizedGrouping = sanitizeGrouping(grouping);
  if (!Array.isArray(comandas) || !comandas.length || sanitizedGrouping.length === 0) {
    return [];
  }

  const root = new Map();

  comandas.forEach((comanda) => {
    const totalCantidad = sumItemsCantidad(comanda?.items);
    let currentLevel = root;

    sanitizedGrouping.forEach((columnId, index) => {
      const resolver = groupingResolvers[columnId];
      const resolved = resolver ? resolver(comanda) : buildGroupingValue({ key: '__empty__', label: DEFAULT_LABEL });
      const groupKey = `${columnId}::${resolved.key}`;
      let groupNode = currentLevel.get(groupKey);

      if (!groupNode) {
        groupNode = {
          id: groupKey,
          columnId,
          value: resolved.label,
          rawValue: resolved.rawValue,
          key: resolved.key,
          sortValue: resolved.sortValue,
          count: 0,
          cantidadTotal: 0,
          children: new Map(),
          comandas: [],
        };
        currentLevel.set(groupKey, groupNode);
      }

      groupNode.count += 1;
      groupNode.cantidadTotal += totalCantidad;

      if (index === sanitizedGrouping.length - 1) {
        groupNode.comandas.push(comanda);
      } else {
        currentLevel = groupNode.children;
      }
    });
  });

  const convertToArray = (map, parentPath = []) =>
    Array.from(map.values())
      .sort((a, b) => {
        const aSort = a.sortValue ?? '';
        const bSort = b.sortValue ?? '';
        if (aSort < bSort) return -1;
        if (aSort > bSort) return 1;
        return 0;
      })
      .map((group) => {
        const currentPath = [
          ...parentPath,
          { columnId: group.columnId, value: group.value, key: group.key },
        ];
        return {
          id: group.id,
          columnId: group.columnId,
          value: group.value,
          rawValue: group.rawValue,
          key: group.key,
          count: group.count,
          cantidadTotal: group.cantidadTotal,
          path: currentPath,
          groups: convertToArray(group.children, currentPath),
          comandas: group.comandas,
        };
      });

  return convertToArray(root);
};

module.exports = {
  ALLOWED_GROUPING_COLUMNS,
  buildComandaGroups,
  formatProductsSummary,
  sanitizeGrouping,
  sumItemsCantidad,
};

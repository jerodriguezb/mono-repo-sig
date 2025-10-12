const formatCamioneroName = (camionero) => {
  if (!camionero) return '';
  const nombres = camionero?.nombres ?? '';
  const apellidos = camionero?.apellidos ?? '';
  return `${nombres} ${apellidos}`.trim();
};

const formatCamionLabel = (camion) => camion?.camion ?? '';

export const MASS_UPDATE_FIELD_KEYS = {
  ESTADO: 'estado',
  CAMIONERO: 'camionero',
  CAMION: 'camion',
  PUNTO_DISTRIBUCION: 'puntoDistribucion',
};

const buildEmptySummaryEntry = (key, label, nextLabel = null) => ({
  key,
  label,
  nextLabel,
  updateCount: 0,
  skipAlreadyAssignedCount: 0,
  skipNotSelectedCount: 0,
  skipUnchangedCount: 0,
});

const normalizeString = (value) => (value ?? '').trim();

export const buildMassUpdatePlan = ({ comandas = [], selections = {} }) => {
  const estadoSel = selections.estado ?? null;
  const camioneroSel = selections.camionero ?? null;
  const camionSel = selections.camion ?? null;
  const puntoSelRaw = selections.puntoDistribucion ?? null;
  const puntoSel = normalizeString(puntoSelRaw);

  const summary = {
    [MASS_UPDATE_FIELD_KEYS.ESTADO]: buildEmptySummaryEntry(
      MASS_UPDATE_FIELD_KEYS.ESTADO,
      'Estado logístico',
      estadoSel?.label ?? null,
    ),
    [MASS_UPDATE_FIELD_KEYS.CAMIONERO]: buildEmptySummaryEntry(
      MASS_UPDATE_FIELD_KEYS.CAMIONERO,
      'Camionero / Chofer',
      camioneroSel?.label ?? null,
    ),
    [MASS_UPDATE_FIELD_KEYS.CAMION]: buildEmptySummaryEntry(
      MASS_UPDATE_FIELD_KEYS.CAMION,
      'Camión',
      camionSel?.label ?? null,
    ),
    [MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION]: buildEmptySummaryEntry(
      MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION,
      'Punto de distribución',
      puntoSel || null,
    ),
  };

  const comandaPlans = [];
  let hasChanges = false;

  comandas.forEach((comanda) => {
    const comandaPlan = {
      id: comanda?._id ?? null,
      numero: comanda?.nrodecomanda ?? null,
      cliente: comanda?.codcli?.razonsocial ?? 'Cliente sin nombre',
      fieldStates: {},
      payload: {},
    };

    const currentEstadoId = comanda?.codestado?._id ?? null;
    const currentEstadoLabel = comanda?.codestado?.estado ?? null;

    if (!estadoSel?.id) {
      summary[MASS_UPDATE_FIELD_KEYS.ESTADO].skipNotSelectedCount += 1;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.ESTADO] = {
        action: 'skip',
        reason: 'notSelected',
        currentLabel: currentEstadoLabel,
        nextLabel: estadoSel?.label ?? null,
      };
    } else if (currentEstadoId === estadoSel.id) {
      summary[MASS_UPDATE_FIELD_KEYS.ESTADO].skipUnchangedCount += 1;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.ESTADO] = {
        action: 'skip',
        reason: 'unchanged',
        currentLabel: currentEstadoLabel,
        nextLabel: estadoSel.label ?? null,
      };
    } else {
      summary[MASS_UPDATE_FIELD_KEYS.ESTADO].updateCount += 1;
      comandaPlan.payload.codestado = estadoSel.id;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.ESTADO] = {
        action: 'update',
        currentLabel: currentEstadoLabel,
        nextLabel: estadoSel.label ?? null,
      };
    }

    const currentCamioneroId = comanda?.camionero?._id ?? null;
    const currentCamioneroLabel = formatCamioneroName(comanda?.camionero);

    if (!camioneroSel?.id) {
      summary[MASS_UPDATE_FIELD_KEYS.CAMIONERO].skipNotSelectedCount += 1;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.CAMIONERO] = {
        action: 'skip',
        reason: 'notSelected',
        currentLabel: currentCamioneroLabel,
        nextLabel: camioneroSel?.label ?? null,
      };
    } else if (currentCamioneroId) {
      summary[MASS_UPDATE_FIELD_KEYS.CAMIONERO].skipAlreadyAssignedCount += 1;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.CAMIONERO] = {
        action: 'skip',
        reason: 'alreadyAssigned',
        currentLabel: currentCamioneroLabel,
        nextLabel: camioneroSel.label ?? null,
      };
    } else {
      summary[MASS_UPDATE_FIELD_KEYS.CAMIONERO].updateCount += 1;
      comandaPlan.payload.camionero = camioneroSel.id;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.CAMIONERO] = {
        action: 'update',
        currentLabel: currentCamioneroLabel,
        nextLabel: camioneroSel.label ?? null,
      };
    }

    const currentCamionId = comanda?.camion?._id ?? null;
    const currentCamionLabel = formatCamionLabel(comanda?.camion);

    if (!camionSel?.id) {
      summary[MASS_UPDATE_FIELD_KEYS.CAMION].skipNotSelectedCount += 1;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.CAMION] = {
        action: 'skip',
        reason: 'notSelected',
        currentLabel: currentCamionLabel,
        nextLabel: camionSel?.label ?? null,
      };
    } else if (currentCamionId) {
      summary[MASS_UPDATE_FIELD_KEYS.CAMION].skipAlreadyAssignedCount += 1;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.CAMION] = {
        action: 'skip',
        reason: 'alreadyAssigned',
        currentLabel: currentCamionLabel,
        nextLabel: camionSel.label ?? null,
      };
    } else {
      summary[MASS_UPDATE_FIELD_KEYS.CAMION].updateCount += 1;
      comandaPlan.payload.camion = camionSel.id;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.CAMION] = {
        action: 'update',
        currentLabel: currentCamionLabel,
        nextLabel: camionSel.label ?? null,
      };
    }

    const currentPunto = normalizeString(comanda?.puntoDistribucion ?? '');

    if (!puntoSel) {
      summary[MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION].skipNotSelectedCount += 1;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION] = {
        action: 'skip',
        reason: 'notSelected',
        currentLabel: currentPunto || null,
        nextLabel: puntoSel || null,
      };
    } else if (currentPunto) {
      summary[MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION].skipAlreadyAssignedCount += 1;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION] = {
        action: 'skip',
        reason: 'alreadyAssigned',
        currentLabel: currentPunto,
        nextLabel: puntoSel,
      };
    } else {
      summary[MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION].updateCount += 1;
      comandaPlan.payload.puntoDistribucion = puntoSel;
      comandaPlan.fieldStates[MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION] = {
        action: 'update',
        currentLabel: currentPunto || null,
        nextLabel: puntoSel,
      };
    }

    if (Object.keys(comandaPlan.payload).length > 0) {
      hasChanges = true;
    }

    comandaPlans.push(comandaPlan);
  });

  return {
    comandas: comandaPlans,
    summary,
    hasChanges,
    totalComandas: comandas.length,
  };
};

export const detectStateRegression = ({
  comandas = [],
  nextEstado,
  resolveEstadoOrden,
  restrictedStatusSet,
  normalizeEstadoNombre: normalizeFn,
}) => {
  if (!nextEstado || typeof resolveEstadoOrden !== 'function') return false;
  const nextOrder = resolveEstadoOrden(nextEstado);
  if (nextOrder === null || nextOrder === undefined) return false;

  return (comandas ?? []).some((comanda) => {
    const currentEstado = comanda?.codestado;
    if (!currentEstado) return false;
    const currentName = normalizeFn?.(currentEstado?.estado ?? '') ?? '';
    if (!restrictedStatusSet?.has(currentName)) {
      return false;
    }

    const currentOrder = resolveEstadoOrden(currentEstado);
    if (currentOrder === null || currentOrder === undefined) return false;

    return nextOrder < currentOrder;
  });
};

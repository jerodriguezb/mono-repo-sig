import {
  buildMassUpdatePlan,
  detectStateRegression,
  MASS_UPDATE_FIELD_KEYS,
} from '../logisticsMassUpdate.js';

const lower = (value) => (value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

describe('buildMassUpdatePlan', () => {
  it('skips fields that already tienen un valor asignado en actualizaciones masivas', () => {
    const comandas = [
      {
        _id: 'com-1',
        nrodecomanda: 1001,
        codcli: { razonsocial: 'Cliente Test' },
        codestado: { _id: 'estado-1', estado: 'A preparar' },
        camionero: { _id: 'driver-1', nombres: 'Juan', apellidos: 'Pérez' },
        puntoDistribucion: 'Centro Norte',
      },
    ];

    const selections = {
      estado: { id: 'estado-1', label: 'A preparar' },
      camionero: { id: 'driver-2', label: 'Carlos Díaz' },
      camion: null,
      puntoDistribucion: 'Centro Sur',
    };

    const plan = buildMassUpdatePlan({ comandas, selections });

    expect(plan.summary[MASS_UPDATE_FIELD_KEYS.CAMIONERO].updateCount).toBe(0);
    expect(plan.summary[MASS_UPDATE_FIELD_KEYS.CAMIONERO].skipAlreadyAssignedCount).toBe(1);
    expect(plan.summary[MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION].skipAlreadyAssignedCount).toBe(1);
    expect(plan.comandas[0].payload.camionero).toBeUndefined();
    expect(plan.comandas[0].payload.puntoDistribucion).toBeUndefined();
    expect(plan.hasChanges).toBe(false);
  });

  it('genera un resumen con los campos que se actualizan y se mantienen', () => {
    const comandas = [
      {
        _id: 'com-1',
        nrodecomanda: 2001,
        codcli: { razonsocial: 'Cliente Uno' },
        codestado: { _id: 'estado-a', estado: 'A preparar' },
        camionero: null,
        camion: null,
        puntoDistribucion: '',
      },
      {
        _id: 'com-2',
        nrodecomanda: 2002,
        codcli: { razonsocial: 'Cliente Dos' },
        codestado: { _id: 'estado-b', estado: 'Preparada' },
        camionero: { _id: 'driver-9', nombres: 'Miguel', apellidos: 'Suárez' },
        camion: { _id: 'camion-7', camion: 'Camión Azul' },
        puntoDistribucion: 'Depósito Central',
      },
    ];

    const selections = {
      estado: { id: 'estado-c', label: 'En distribución' },
      camionero: { id: 'driver-2', label: 'Carlos Díaz' },
      camion: { id: 'camion-9', label: 'Camión Rojo' },
      puntoDistribucion: 'Centro 1',
    };

    const plan = buildMassUpdatePlan({ comandas, selections });

    expect(plan.hasChanges).toBe(true);
    expect(plan.summary[MASS_UPDATE_FIELD_KEYS.ESTADO].updateCount).toBe(2);
    expect(plan.summary[MASS_UPDATE_FIELD_KEYS.CAMIONERO].updateCount).toBe(1);
    expect(plan.summary[MASS_UPDATE_FIELD_KEYS.CAMIONERO].skipAlreadyAssignedCount).toBe(1);
    expect(plan.summary[MASS_UPDATE_FIELD_KEYS.CAMION].updateCount).toBe(1);
    expect(plan.summary[MASS_UPDATE_FIELD_KEYS.CAMION].skipAlreadyAssignedCount).toBe(1);
    expect(plan.summary[MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION].updateCount).toBe(1);
    expect(plan.summary[MASS_UPDATE_FIELD_KEYS.PUNTO_DISTRIBUCION].skipAlreadyAssignedCount).toBe(1);
    expect(plan.comandas[0].payload).toMatchObject({
      codestado: 'estado-c',
      camionero: 'driver-2',
      camion: 'camion-9',
      puntoDistribucion: 'Centro 1',
    });
    expect(plan.comandas[1].payload).toMatchObject({ codestado: 'estado-c' });
  });
});

describe('detectStateRegression', () => {
  it('identifica cuando se intenta volver a un estado anterior', () => {
    const comandas = [
      {
        codestado: { estado: 'En distribución', orden: 3 },
      },
    ];

    const result = detectStateRegression({
      comandas,
      nextEstado: { estado: 'A preparar', orden: 1 },
      resolveEstadoOrden: (estado) => estado?.orden ?? null,
      restrictedStatusSet: new Set([lower('En distribución')]),
      normalizeEstadoNombre: lower,
    });

    expect(result).toBe(true);
  });

  it('permite transiciones válidas', () => {
    const comandas = [
      {
        codestado: { estado: 'A preparar', orden: 1 },
      },
    ];

    const result = detectStateRegression({
      comandas,
      nextEstado: { estado: 'En distribución', orden: 3 },
      resolveEstadoOrden: (estado) => estado?.orden ?? null,
      restrictedStatusSet: new Set([lower('En distribución')]),
      normalizeEstadoNombre: lower,
    });

    expect(result).toBe(false);
  });
});

const express = require('express');
const request = require('supertest');

jest.mock('../../middlewares/autenticacion', () => ({
  verificaToken: (_req, _res, next) => next(),
  verificaAdmin_role: (_req, _res, next) => next(),
  verificaCam_role: (_req, _res, next) => next(),
  verificaAdminCam_role: (_req, _res, next) => next(),
  verificaAdminPrev_role: (_req, _res, next) => next(),
}));

jest.mock('../../modelos/comanda', () => {
  const state = {
    dataset: [],
    references: {
      clientes: {},
      rutas: {},
      usuarios: {},
      camiones: {},
      listas: {},
      productos: {},
      estados: {},
    },
  };

  const collator = new Intl.Collator('es-AR', { sensitivity: 'base', numeric: true });

  const clone = (value) => (value == null ? value : structuredClone(value));

  const normalizeId = (value) => {
    if (value == null) return value;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value;
    if (typeof value.toString === 'function') return value.toString();
    return value;
  };

  const matches = (doc, condition = {}) => {
    if (!condition || Object.keys(condition).length === 0) return true;
    if (condition.$and) {
      return condition.$and.every((sub) => matches(doc, sub));
    }
    return Object.entries(condition).every(([key, value]) => {
      const docValue = doc[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (Object.prototype.hasOwnProperty.call(value, '$in')) {
          return value.$in.map(normalizeId).includes(normalizeId(docValue));
        }
        if (Object.prototype.hasOwnProperty.call(value, '$regex')) {
          const regex = value.$regex instanceof RegExp
            ? value.$regex
            : new RegExp(value.$regex, value.$options);
          return regex.test(String(docValue ?? ''));
        }
        const hasRange =
          Object.prototype.hasOwnProperty.call(value, '$gte') ||
          Object.prototype.hasOwnProperty.call(value, '$lte');
        if (hasRange) {
          const docTime = docValue instanceof Date ? docValue.getTime() : new Date(docValue).getTime();
          if (Object.prototype.hasOwnProperty.call(value, '$gte')) {
            const min = value.$gte instanceof Date ? value.$gte.getTime() : new Date(value.$gte).getTime();
            if (docTime < min) return false;
          }
          if (Object.prototype.hasOwnProperty.call(value, '$lte')) {
            const max = value.$lte instanceof Date ? value.$lte.getTime() : new Date(value.$lte).getTime();
            if (docTime > max) return false;
          }
          return true;
        }
      }
      return normalizeId(docValue) === normalizeId(value);
    });
  };

  const formatName = (user) => {
    if (!user) return '';
    const first = user.nombres ?? '';
    const last = user.apellidos ?? '';
    return `${first} ${last}`.trim();
  };

  const compareValues = (valueA, valueB) => {
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return valueA - valueB;
    }
    if (valueA instanceof Date && valueB instanceof Date) {
      return valueA.getTime() - valueB.getTime();
    }
    const parsedA = typeof valueA === 'string' ? Date.parse(valueA) : Number.NaN;
    const parsedB = typeof valueB === 'string' ? Date.parse(valueB) : Number.NaN;
    if (!Number.isNaN(parsedA) && !Number.isNaN(parsedB)) {
      return parsedA - parsedB;
    }
    return collator.compare(String(valueA ?? ''), String(valueB ?? ''));
  };

  const api = {};

  api.__setData = (data = []) => {
    state.dataset = data.map((doc) => clone(doc));
  };

  api.__setReferences = (refs = {}) => {
    state.references = {
      clientes: { ...(refs.clientes || {}) },
      rutas: { ...(refs.rutas || {}) },
      usuarios: { ...(refs.usuarios || {}) },
      camiones: { ...(refs.camiones || {}) },
      listas: { ...(refs.listas || {}) },
      productos: { ...(refs.productos || {}) },
      estados: { ...(refs.estados || {}) },
    };
  };

  api.countDocuments = jest.fn(async (condition = {}) =>
    state.dataset.filter((doc) => matches(doc, condition)).length,
  );

  api.aggregate = jest.fn((pipeline = []) => ({
      pipeline,
      options: {},
      collation(options = {}) {
        this.options.collation = options;
        return this;
      },
      async exec() {
        const matchStage = pipeline.find((stage) => stage.$match);
        let docs = state.dataset
          .filter((doc) => matches(doc, matchStage ? matchStage.$match : {}))
          .map((doc) => clone(doc));

        docs = docs.map((doc) => {
          const normalizedFecha = doc.fecha instanceof Date ? doc.fecha : new Date(doc.fecha);
          const cliente = state.references.clientes[normalizeId(doc.codcli)] || null;
          const ruta = cliente && cliente.ruta
            ? state.references.rutas[normalizeId(cliente.ruta)] || null
            : null;
          const camion = doc.camion ? state.references.camiones[normalizeId(doc.camion)] || null : null;
          const camionero = doc.camionero
            ? state.references.usuarios[normalizeId(doc.camionero)] || null
            : null;
          const usuario = doc.usuario
            ? state.references.usuarios[normalizeId(doc.usuario)] || null
            : null;
          const precioTotal = Array.isArray(doc.items)
            ? doc.items.reduce(
                (sum, item) => sum + Number(item?.cantidad ?? 0) * Number(item?.monto ?? 0),
                0,
              )
            : 0;

          return {
            ...doc,
            fecha: normalizedFecha,
            clienteNombre: cliente?.razonsocial ?? '',
            rutaNombre: ruta?.ruta ?? (camion?.ruta ?? ''),
            camioneroNombre: formatName(camionero),
            usuarioNombre: formatName(usuario),
            precioTotal,
          };
        });

        const sortStage = pipeline.find((stage) => stage.$sort);
        if (sortStage) {
          const sortEntries = Object.entries(sortStage.$sort);
          docs.sort((a, b) => {
            for (const [field, direction] of sortEntries) {
              const comparison = compareValues(a[field], b[field]);
              if (comparison !== 0) {
                return direction >= 0 ? comparison : -comparison;
              }
            }
            return 0;
          });
        }

        const skipStage = pipeline.find((stage) => stage.$skip);
        if (skipStage) {
          docs = docs.slice(skipStage.$skip);
        }

        const limitStage = pipeline.find((stage) => stage.$limit);
        if (limitStage) {
          docs = docs.slice(0, limitStage.$limit);
        }

        return docs;
      },
    }));

  api.populate = jest.fn(async (docs = []) =>
    docs.map((doc) => {
      const populated = clone(doc) || {};

      const cliente = state.references.clientes[normalizeId(doc.codcli)] || null;
      if (cliente) populated.codcli = clone(cliente);

      const camion = doc.camion ? state.references.camiones[normalizeId(doc.camion)] || null : null;
      if (camion) populated.camion = clone(camion);

      const usuario = doc.usuario ? state.references.usuarios[normalizeId(doc.usuario)] || null : null;
      if (usuario) populated.usuario = clone(usuario);

      const camionero = doc.camionero ? state.references.usuarios[normalizeId(doc.camionero)] || null : null;
      if (camionero) populated.camionero = clone(camionero);

      if (Array.isArray(doc.items)) {
        populated.items = doc.items.map((item) => {
          const populatedItem = clone(item) || {};
          const lista = state.references.listas[normalizeId(item.lista)] || null;
          if (lista) populatedItem.lista = clone(lista);
          const producto = state.references.productos[normalizeId(item.codprod)] || null;
          if (producto) populatedItem.codprod = clone(producto);
          return populatedItem;
        });
      }

      const estado = doc.codestado ? state.references.estados[normalizeId(doc.codestado)] || null : null;
      if (estado) populated.codestado = clone(estado);

      return populated;
    }),
  );

  api.__resetMocks = () => {
    api.countDocuments.mockClear();
    api.aggregate.mockClear();
    api.populate.mockClear();
  };

  return api;
});

const router = require('../comanda');
const Comanda = require('../../modelos/comanda');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return app;
};

const baseReferences = {
  clientes: {
    c1: { _id: 'c1', razonsocial: 'Cliente Beta', ruta: 'r2' },
    c2: { _id: 'c2', razonsocial: 'Cliente Alfa', ruta: 'r1' },
    c3: { _id: 'c3', razonsocial: 'Cliente Zeta', ruta: 'r3' },
  },
  rutas: {
    r1: { _id: 'r1', ruta: 'Ruta Sur' },
    r2: { _id: 'r2', ruta: 'Ruta Norte' },
    r3: { _id: 'r3', ruta: 'Ruta Centro' },
  },
  usuarios: {
    u1: { _id: 'u1', nombres: 'Ana', apellidos: 'Lopez' },
    u2: { _id: 'u2', nombres: 'Bruno', apellidos: 'Martinez' },
    u3: { _id: 'u3', nombres: 'Carla', apellidos: 'Diaz' },
  },
  camiones: {
    truck1: { _id: 'truck1', camion: 'Camión Norte' },
    truck2: { _id: 'truck2', camion: 'Camión Sur' },
    truck3: { _id: 'truck3', camion: 'Camión Centro' },
  },
  listas: {
    l1: { _id: 'l1', descripcion: 'Lista 1' },
    l2: { _id: 'l2', descripcion: 'Lista 2' },
    l3: { _id: 'l3', descripcion: 'Lista 3' },
  },
  productos: {
    p1: { _id: 'p1', descripcion: 'Producto 1' },
    p2: { _id: 'p2', descripcion: 'Producto 2' },
    p3: { _id: 'p3', descripcion: 'Producto 3' },
    p4: { _id: 'p4', descripcion: 'Producto 4' },
  },
  estados: {
    e1: { _id: 'e1', estado: 'En proceso' },
    e2: { _id: 'e2', estado: 'Entregado' },
    e3: { _id: 'e3', estado: 'Pendiente' },
  },
};

const baseComandas = [
  {
    _id: '1',
    activo: true,
    nrodecomanda: 100,
    codcli: 'c1',
    fecha: new Date('2024-01-01T00:00:00Z'),
    codestado: 'e1',
    camion: 'truck1',
    usuario: 'u1',
    camionero: 'u2',
    puntoDistribucion: 'Depósito Norte',
    items: [
      { lista: 'l1', codprod: 'p1', cantidad: 2, monto: 100 },
      { lista: 'l2', codprod: 'p2', cantidad: 1, monto: 50 },
    ],
  },
  {
    _id: '2',
    activo: true,
    nrodecomanda: 101,
    codcli: 'c2',
    fecha: new Date('2024-02-01T00:00:00Z'),
    codestado: 'e2',
    camion: 'truck2',
    usuario: 'u2',
    camionero: 'u3',
    puntoDistribucion: 'Depósito Sur',
    items: [
      { lista: 'l2', codprod: 'p3', cantidad: 5, monto: 20 },
    ],
  },
  {
    _id: '3',
    activo: true,
    nrodecomanda: 102,
    codcli: 'c3',
    fecha: new Date('2024-03-01T00:00:00Z'),
    codestado: 'e3',
    camion: 'truck3',
    usuario: 'u3',
    camionero: 'u1',
    puntoDistribucion: 'Depósito Centro',
    items: [
      { lista: 'l3', codprod: 'p4', cantidad: 1, monto: 500 },
    ],
  },
];

const expectedOrders = {
  clienteNombre: {
    asc: ['2', '1', '3'],
    desc: ['3', '1', '2'],
  },
  precioTotal: {
    asc: ['2', '1', '3'],
    desc: ['3', '1', '2'],
  },
  rutaNombre: {
    asc: ['3', '1', '2'],
    desc: ['2', '1', '3'],
  },
  camioneroNombre: {
    asc: ['3', '1', '2'],
    desc: ['2', '1', '3'],
  },
  usuarioNombre: {
    asc: ['1', '2', '3'],
    desc: ['3', '2', '1'],
  },
};

describe('GET /comandas/logistica sorting', () => {
  const app = createApp();

  beforeEach(() => {
    Comanda.__setReferences(baseReferences);
    Comanda.__setData(baseComandas);
    Comanda.__resetMocks();
  });

  test('uses default sorting when sort field is not provided', async () => {
    const response = await request(app).get('/comandas/logistica').expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.total).toBe(baseComandas.length);
    expect(response.body.comandas.map((c) => c._id)).toEqual(['3', '2', '1']);

    const aggregateCall = Comanda.aggregate.mock.results[0]?.value;
    expect(aggregateCall?.options?.collation).toEqual({ locale: 'es-AR', caseLevel: false, strength: 1 });
  });

  Object.entries(expectedOrders).forEach(([field, orders]) => {
    test(`sorts ascending by ${field}`, async () => {
      const response = await request(app)
        .get('/comandas/logistica')
        .query({ sortField: field, sortOrder: 'asc' })
        .expect(200);

      expect(response.body.comandas.map((c) => c._id)).toEqual(orders.asc);
      response.body.comandas.forEach((comanda) => {
        expect(comanda).toHaveProperty(field);
      });
    });

    test(`sorts descending by ${field}`, async () => {
      const response = await request(app)
        .get('/comandas/logistica')
        .query({ sortField: field, sortOrder: 'desc' })
        .expect(200);

      expect(response.body.comandas.map((c) => c._id)).toEqual(orders.desc);
      response.body.comandas.forEach((comanda) => {
        expect(comanda).toHaveProperty(field);
      });
    });
  });
});

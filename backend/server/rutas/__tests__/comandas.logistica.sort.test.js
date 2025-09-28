const express = require('express');
const request = require('supertest');

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

const buildFullName = (user) => `${user?.nombres ?? ''} ${user?.apellidos ?? ''}`.trim();

jest.mock('../../middlewares/autenticacion', () => ({
  verificaToken: (_req, _res, next) => next(),
  verificaAdmin_role: (_req, _res, next) => next(),
  verificaCam_role: (_req, _res, next) => next(),
  verificaAdminCam_role: (_req, _res, next) => next(),
  verificaAdminPrev_role: (_req, _res, next) => next(),
}));

const mockFullComandas = [
  {
    _id: 'c1',
    nrodecomanda: 110,
    fecha: new Date('2024-01-03T00:00:00Z'),
    codcli: {
      razonsocial: 'Cliente Bravo',
      ruta: { ruta: 'Ruta Norte' },
    },
    camionero: { nombres: 'Carlos', apellidos: 'Zeta' },
    usuario: { nombres: 'Pedro', apellidos: 'Lopez' },
    items: [
      { cantidad: 3, monto: 100 },
    ],
  },
  {
    _id: 'c2',
    nrodecomanda: 111,
    fecha: new Date('2024-01-01T00:00:00Z'),
    codcli: {
      razonsocial: 'Cliente Alfa',
      ruta: { ruta: 'Ruta Sur' },
    },
    camionero: { nombres: 'Ana', apellidos: 'Lopez' },
    usuario: { nombres: 'Maria', apellidos: 'Gomez' },
    items: [
      { cantidad: 1, monto: 100 },
    ],
  },
  {
    _id: 'c3',
    nrodecomanda: 112,
    fecha: new Date('2024-01-02T00:00:00Z'),
    codcli: {
      razonsocial: 'Cliente Charlie',
      ruta: { ruta: 'Ruta Centro' },
    },
    camionero: { nombres: 'Bruno', apellidos: 'Mora' },
    usuario: { nombres: 'Lucia', apellidos: 'Perez' },
    items: [
      { cantidad: 2, monto: 100 },
    ],
  },
];

const computePrecioTotal = (items) =>
  Array.isArray(items)
    ? items.reduce((sum, item) => sum + (Number(item.cantidad) || 0) * (Number(item.monto) || 0), 0)
    : 0;

const mockAggregateDocs = mockFullComandas.map((comanda) => ({
  _id: comanda._id,
  clienteNombre: comanda.codcli.razonsocial,
  rutaNombre: comanda.codcli.ruta?.ruta ?? '',
  camioneroNombre: buildFullName(comanda.camionero),
  usuarioNombre: buildFullName(comanda.usuario),
  precioTotal: computePrecioTotal(comanda.items),
  fecha: comanda.fecha,
  nrodecomanda: comanda.nrodecomanda,
}));

const mockAggregateComparators = {
  clienteNombre: (a, b) => collator.compare(a.clienteNombre, b.clienteNombre),
  rutaNombre: (a, b) => collator.compare(a.rutaNombre, b.rutaNombre),
  camioneroNombre: (a, b) => collator.compare(a.camioneroNombre, b.camioneroNombre),
  usuarioNombre: (a, b) => collator.compare(a.usuarioNombre, b.usuarioNombre),
  precioTotal: (a, b) => a.precioTotal - b.precioTotal,
};

const mockFullDocsMap = new Map(mockFullComandas.map((comanda) => [comanda._id, comanda]));

const createQueryChain = (initialDocs) => {
  const state = { docs: [...initialDocs] };
  const chain = {
    sort: (criteria = {}) => {
      const entries = Object.entries(criteria);
      if (entries.length) {
        state.docs.sort((a, b) => {
          for (const [field, direction] of entries) {
            const dir = direction === 1 ? 1 : -1;
            const valueA = a[field];
            const valueB = b[field];
            if (valueA === valueB) continue;
            if (valueA == null) return dir * -1;
            if (valueB == null) return dir * 1;
            if (valueA > valueB) return dir * 1;
            if (valueA < valueB) return dir * -1;
          }
          return 0;
        });
      }
      return chain;
    },
    skip: (value = 0) => {
      state.docs = state.docs.slice(value);
      return chain;
    },
    limit: (value) => {
      if (typeof value === 'number') {
        state.docs = state.docs.slice(0, value);
      }
      return chain;
    },
    populate: () => chain,
    lean: () => chain,
    exec: () => Promise.resolve(state.docs.map((doc) => ({ ...doc }))),
  };
  return chain;
};

jest.mock('../../modelos/comanda', () => {
  const aggregate = jest.fn((pipeline) => {
    const sortStage = pipeline.find((stage) => stage.$sort) || { $sort: {} };
    const primaryField = Object.keys(sortStage.$sort).find((field) => !['fecha', 'nrodecomanda'].includes(field));
    const direction = sortStage.$sort[primaryField] ?? 1;
    const comparator = mockAggregateComparators[primaryField] || (() => 0);
    const skipStage = pipeline.find((stage) => stage.$skip);
    const limitStage = pipeline.find((stage) => stage.$limit);
    const skip = skipStage ? skipStage.$skip : 0;
    const limit = limitStage ? limitStage.$limit : mockAggregateDocs.length;

    const sorted = [...mockAggregateDocs].sort((a, b) => {
      const result = comparator(a, b);
      if (result !== 0) {
        return direction === 1 ? result : -result;
      }
      const fechaDiff = new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      if (fechaDiff !== 0) return fechaDiff;
      return (b.nrodecomanda ?? 0) - (a.nrodecomanda ?? 0);
    });

    const sliced = sorted.slice(skip, skip + limit).map((doc) => ({ _id: doc._id }));
    const aggregateObject = {
      collation: () => aggregateObject,
      exec: () => Promise.resolve(sliced),
    };
    return aggregateObject;
  });

  const find = jest.fn((criteria = {}) => {
    if (criteria._id && criteria._id.$in) {
      const ids = criteria._id.$in.map(String);
      const docs = ids.map((id) => mockFullDocsMap.get(id)).filter(Boolean);
      return createQueryChain(docs);
    }
    return createQueryChain(mockFullComandas);
  });

  const countDocuments = jest.fn(() => Promise.resolve(mockFullComandas.length));

  return {
    aggregate,
    find,
    countDocuments,
    collection: { collectionName: 'comandas' },
  };
});

const router = require('../comanda');

const app = express();
app.use(express.json());
app.use(router);

describe('GET /comandas/logistica sorting', () => {
  it('ordena por precioTotal ascendente utilizando la agregación', async () => {
    const response = await request(app)
      .get('/comandas/logistica')
      .query({ sortField: 'precioTotal', sortOrder: 'asc' });

    expect(response.status).toBe(200);
    const orden = response.body.comandas.map((c) => c.nrodecomanda);
    expect(orden).toEqual([111, 112, 110]);
  });

  it('ordena por nombre completo del camionero en forma descendente', async () => {
    const response = await request(app)
      .get('/comandas/logistica')
      .query({ sortField: 'camionero', sortOrder: 'desc' });

    expect(response.status).toBe(200);
    const nombres = response.body.comandas.map((c) => buildFullName(c.camionero));
    expect(nombres).toEqual(['Carlos Zeta', 'Bruno Mora', 'Ana Lopez']);
  });

  it('ordena por razón social del cliente ascendente', async () => {
    const response = await request(app)
      .get('/comandas/logistica')
      .query({ sortField: 'codcli', sortOrder: 'asc' });

    expect(response.status).toBe(200);
    const clientes = response.body.comandas.map((c) => c.codcli?.razonsocial);
    expect(clientes).toEqual(['Cliente Alfa', 'Cliente Bravo', 'Cliente Charlie']);
  });

  it('ordena por nombre de ruta ascendente', async () => {
    const response = await request(app)
      .get('/comandas/logistica')
      .query({ sortField: 'ruta', sortOrder: 'asc' });

    expect(response.status).toBe(200);
    const rutas = response.body.comandas.map((c) => c.codcli?.ruta?.ruta ?? '');
    expect(rutas).toEqual(['Ruta Centro', 'Ruta Norte', 'Ruta Sur']);
  });
});

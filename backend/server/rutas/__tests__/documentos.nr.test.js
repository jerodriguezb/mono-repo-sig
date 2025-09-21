jest.setTimeout(10000);

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

jest.mock('../../modelos/documento', () => {
  const mockMongoose = require('mongoose');
  const store = [];
  const pendingBySession = new Map();
  const existsMock = jest.fn(async (query = {}) => {
    const found = store.find((doc) => {
      if (query.NrodeDocumento && doc.NrodeDocumento !== query.NrodeDocumento) return false;
      if (Object.prototype.hasOwnProperty.call(query, 'activo') && doc.activo !== query.activo) return false;
      return true;
    });
    return found ? { _id: found._id } : null;
  });
  class DocumentoMock {
    constructor(data = {}) {
      this.data = { ...data };
      this.prefijo = data.prefijo || '0001';
      this.tipo = data.tipo;
      this.proveedor = data.proveedor;
      this.fechaRemito = data.fechaRemito;
      this.items = data.items;
      this.observaciones = data.observaciones;
      this.usuario = data.usuario;
      this.NrodeDocumento = data.NrodeDocumento;
      this.activo = data.activo ?? true;
      this._id = new mockMongoose.Types.ObjectId().toString();
    }

    async save(options = {}) {
      const docData = {
        _id: this._id,
        prefijo: this.prefijo,
        tipo: this.tipo,
        proveedor: this.proveedor,
        fechaRemito: this.fechaRemito,
        items: this.items,
        observaciones: this.observaciones,
        usuario: this.usuario,
        NrodeDocumento: this.NrodeDocumento,
        activo: this.activo,
      };

      if (options?.session) {
        const pending = pendingBySession.get(options.session) || [];
        pending.push(docData);
        pendingBySession.set(options.session, pending);
      } else {
        store.push(docData);
      }
      return this;
    }

    async populate() {
      return this;
    }

    toObject() {
      return {
        _id: this._id,
        prefijo: this.prefijo,
        tipo: this.tipo,
        proveedor: this.proveedor,
        fechaRemito: this.fechaRemito,
        items: this.items,
        observaciones: this.observaciones,
        usuario: this.usuario,
        NrodeDocumento: this.NrodeDocumento,
        activo: this.activo,
      };
    }
  }

  DocumentoMock.exists = existsMock;
  DocumentoMock.__store = store;
  DocumentoMock.__commitSession = (session) => {
    const pending = pendingBySession.get(session) || [];
    pending.forEach((doc) => store.push(doc));
    pendingBySession.delete(session);
  };
  DocumentoMock.__abortSession = (session) => {
    pendingBySession.delete(session);
  };
  DocumentoMock.__reset = () => {
    store.length = 0;
    existsMock.mockClear();
    pendingBySession.clear();
  };

  return DocumentoMock;
});

jest.mock('../../modelos/proveedor', () => {
  const store = new Map();
  const findByIdMock = jest.fn((id) => ({
    select: () => ({
      lean: () => ({
        exec: async () => (store.has(String(id)) ? { _id: String(id) } : null),
      }),
    }),
  }));

  return {
    __store: store,
    __add: (doc) => store.set(String(doc._id), doc),
    __reset: () => {
      store.clear();
      findByIdMock.mockClear();
    },
    findById: findByIdMock,
  };
});

jest.mock('../../modelos/producserv', () => {
  const store = new Map();
  const findMock = jest.fn((query = {}) => ({
    select: () => ({
      lean: () => ({
        exec: async () => {
          const ids = Array.isArray(query._id?.$in) ? query._id.$in.map(String) : [];
          return ids.filter((id) => store.has(id)).map((id) => ({ _id: id }));
        },
      }),
    }),
  }));

  const findOneMock = jest.fn((query = {}) => {
    const id = query && query._id ? String(query._id) : undefined;
    const doc = id && store.has(id) ? { ...store.get(id) } : null;
    const buildResponse = () => ({
      lean: () => Promise.resolve(doc),
    });

    return {
      session: () => buildResponse(),
      lean: () => Promise.resolve(doc),
    };
  });

  const findByIdAndUpdateMock = jest.fn(async (id, update = {}) => {
    const key = String(id);
    const current = store.get(key);
    if (!current) return null;
    const inc = update?.$inc?.stkactual ?? 0;
    const updated = { ...current, stkactual: (current.stkactual ?? 0) + inc };
    store.set(key, updated);
    return updated;
  });

  return {
    __store: store,
    __add: (doc) => store.set(String(doc._id), doc),
    __reset: () => {
      store.clear();
      findMock.mockClear();
      findOneMock.mockClear();
      findByIdAndUpdateMock.mockClear();
    },
    find: findMock,
    findOne: findOneMock,
    findByIdAndUpdate: findByIdAndUpdateMock,
  };
});

process.env.JWT_SECRET = 'test-secret';

const Documento = require('../../modelos/documento');
const Proveedor = require('../../modelos/proveedor');
const Producserv = require('../../modelos/producserv');
const router = require('../documentos');

const sessionStub = {
  startTransaction: jest.fn().mockResolvedValue(),
  commitTransaction: jest.fn().mockImplementation(async () => {
    Documento.__commitSession(sessionStub);
  }),
  abortTransaction: jest.fn().mockImplementation(async () => {
    Documento.__abortSession(sessionStub);
  }),
  endSession: jest.fn().mockResolvedValue(),
};

const app = express();
app.use(express.json());
app.use(router);

const postDocumento = (payload, authToken) =>
  request(app)
    .post('/documentos')
    .set('Authorization', `Bearer ${authToken}`)
    .send(payload);

const crearProveedor = () => {
  const doc = {
    _id: new mongoose.Types.ObjectId().toString(),
    codprov: 1,
    razonsocial: 'Proveedor Test',
    domicilio: 'Calle Falsa 123',
    telefono: '123456789',
  };
  Proveedor.__add(doc);
  return doc;
};

const crearProducto = (overrides = {}) => {
  const doc = {
    _id: new mongoose.Types.ObjectId().toString(),
    codprod: 'SKU-001',
    descripcion: 'Producto Test',
    tipo: 'PRODUCTO',
    iva: 21,
    stkactual: 0,
    activo: true,
    ...overrides,
  };
  Producserv.__add(doc);
  return doc;
};

describe('POST /documentos', () => {
  let token;

  beforeAll(() => {
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(sessionStub);
    token = jwt.sign({ _id: new mongoose.Types.ObjectId().toString(), role: 'ADMIN_ROLE' }, process.env.JWT_SECRET);
  });

  afterAll(() => {
    jest.restoreAllMocks();
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    Documento.__reset();
    Proveedor.__reset();
    Producserv.__reset();
    sessionStub.startTransaction.mockClear();
    sessionStub.commitTransaction.mockClear();
    sessionStub.abortTransaction.mockClear();
    sessionStub.endSession.mockClear();
  });

  describe('para Notas de Recepción (NR)', () => {
    const buildPayload = () => {
      const proveedor = crearProveedor();
      const producto = crearProducto();

      return {
        tipo: 'NR',
        prefijo: '12',
        fechaRemito: '2024-05-20',
        proveedor: proveedor._id,
        items: [
          {
            cantidad: 2,
            producto: producto._id,
            codprod: producto.codprod,
          },
        ],
        numeroSugerido: '0012NR00000001',
      };
    };

    test('crea una NR con número válido y lo conserva', async () => {
      const payload = buildPayload();

      const response = await postDocumento(payload, token);

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.documento.NrodeDocumento).toBe('0012NR00000001');

      expect(Documento.__store).toHaveLength(1);
      expect(Documento.__store[0].NrodeDocumento).toBe('0012NR00000001');
      expect(Documento.__store[0].prefijo).toBe('0012');
    });

    test('rechaza una NR con formato inválido', async () => {
      const payload = { ...buildPayload(), numeroSugerido: '0012NR12' };

      const response = await postDocumento(payload, token);

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.err.message).toMatch(/formato 0012NR/);
      expect(Documento.__store).toHaveLength(0);
    });

    test('rechaza la creación duplicada de una NR activa', async () => {
      const payload = buildPayload();

      const primeraRespuesta = await postDocumento(payload, token);
      expect(primeraRespuesta.status).toBe(201);
      expect(Documento.__store).toHaveLength(1);

      const segundaRespuesta = await postDocumento(payload, token);
      expect(segundaRespuesta.status).toBe(409);
      expect(segundaRespuesta.body.ok).toBe(false);
      expect(segundaRespuesta.body.err.message).toMatch(/Ya existe un documento activo/);
      expect(Documento.__store).toHaveLength(1);
    });

    test('suma las cantidades de productos repetidos y actualiza el stock una sola vez', async () => {
      const proveedor = crearProveedor();
      const producto = crearProducto();

      const payload = {
        tipo: 'NR',
        prefijo: '12',
        fechaRemito: '2024-05-20',
        proveedor: proveedor._id,
        items: [
          { cantidad: 2, producto: producto._id, codprod: producto.codprod },
          { cantidad: 3, producto: producto._id, codprod: producto.codprod },
        ],
        numeroSugerido: '0012NR00000001',
      };

      const response = await postDocumento(payload, token);

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.stock.updates).toHaveLength(1);
      expect(response.body.stock.updates[0]).toMatchObject({
        producto: producto._id,
        codprod: producto.codprod,
        incremento: 5,
      });
      expect(Producserv.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(Producserv.__store.get(producto._id).stkactual).toBe(5);
    });

    test('no incrementa stock cuando el producto está inactivo', async () => {
      const proveedor = crearProveedor();
      const producto = crearProducto();
      Producserv.__add({ ...producto, activo: false, _id: producto._id });

      const payload = {
        tipo: 'NR',
        prefijo: '12',
        fechaRemito: '2024-05-20',
        proveedor: proveedor._id,
        items: [
          { cantidad: 2, producto: producto._id, codprod: producto.codprod },
        ],
        numeroSugerido: '0012NR00000001',
      };

      const response = await postDocumento(payload, token);

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.err.message).toMatch(/inactivo/);
      expect(Documento.__store).toHaveLength(0);
      expect(Producserv.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(sessionStub.abortTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('para Ajustes (AJ)', () => {
    test('realiza un ajuste negativo descontando stock', async () => {
      const proveedor = crearProveedor();
      const producto = crearProducto({ stkactual: 10 });

      const payload = {
        tipo: 'AJ',
        prefijo: '0001',
        fechaRemito: '2024-05-20',
        proveedor: proveedor._id,
        ajusteOperacion: 'decrement',
        nroSugerido: '0001AJ00000123',
        items: [
          { cantidad: 3, producto: producto._id, codprod: producto.codprod },
        ],
      };

      const response = await postDocumento(payload, token);

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.stock.updates).toHaveLength(1);
      expect(response.body.stock.updates[0]).toMatchObject({
        producto: producto._id,
        codprod: producto.codprod,
        decremento: 3,
        operacion: 'decrement',
      });
      expect(Producserv.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(Producserv.__store.get(producto._id).stkactual).toBe(7);
      expect(Documento.__store[0].NrodeDocumento).toBe(payload.nroSugerido);
    });

    test('realiza un ajuste positivo sumando stock y conserva el número sugerido', async () => {
      const proveedor = crearProveedor();
      const producto = crearProducto({ stkactual: 4 });

      const payload = {
        tipo: 'AJ',
        prefijo: '0007',
        fechaRemito: '2024-06-01',
        proveedor: proveedor._id,
        ajusteOperacion: 'increment',
        nroSugerido: '0007AJ00000042',
        items: [
          { cantidad: 5, producto: producto._id, codprod: producto.codprod },
        ],
      };

      const response = await postDocumento(payload, token);

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.stock.updates).toHaveLength(1);
      expect(response.body.stock.updates[0]).toMatchObject({
        producto: producto._id,
        codprod: producto.codprod,
        incremento: 5,
        operacion: 'increment',
      });
      expect(Producserv.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(Producserv.__store.get(producto._id).stkactual).toBe(9);
      expect(Documento.__store[0].NrodeDocumento).toBe('0007AJ00000042');
    });
  });
});

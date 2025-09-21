const mongoose = require('mongoose');

const Documento = require('../documento');

describe('Modelo Documento - validación de cantidades en ajustes', () => {
  const buildDocumento = (cantidad) => new Documento({
    tipo: 'AJ',
    proveedor: new mongoose.Types.ObjectId(),
    fechaRemito: new Date('2024-01-01T00:00:00.000Z'),
    usuario: new mongoose.Types.ObjectId(),
    items: [
      {
        cantidad,
        producto: new mongoose.Types.ObjectId(),
        codprod: 'SKU-NEG',
      },
    ],
  });

  test('permite validar un ajuste negativo con cantidad entera distinta de cero', () => {
    const documento = buildDocumento(-3);
    const error = documento.validateSync();

    expect(error).toBeUndefined();
    expect(documento.items[0].cantidad).toBe(-3);
  });

  test('rechaza cantidades iguales a cero o con decimales', () => {
    const documentoConCero = buildDocumento(0);
    const errorCero = documentoConCero.validateSync();
    expect(errorCero.errors['items.0.cantidad'].message).toBe(
      'La cantidad debe ser un entero distinto de cero',
    );

    const documentoConDecimal = buildDocumento(-1.5);
    const errorDecimal = documentoConDecimal.validateSync();
    expect(errorDecimal.errors['items.0.cantidad'].message).toBe(
      'La cantidad debe ser un entero distinto de cero',
    );
  });
});

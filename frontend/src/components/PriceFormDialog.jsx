import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Switch,
  FormControlLabel,
  Autocomplete,
  CircularProgress,
  Typography,
} from '@mui/material';
import api from '../api/axios.js';

const defaultForm = {
  codproducto: null,
  lista: null,
  activo: true,
  precionetocompra: '',
  ivacompra: '',
  preciototalcompra: '',
  precionetoventa: '',
  ivaventa: '',
  preciototalventa: '',
};

const formatForInput = (value) => (value === null || value === undefined ? '' : value.toString());
const sanitizeDecimal = (value) => value.replace(/[^0-9.,]/g, '');

const parseDecimal = (value) => {
  if (value === null || value === undefined) return null;
  const cleaned = sanitizeDecimal(String(value));
  if (!cleaned) return null;
  const sepIndex = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  if (sepIndex === -1) {
    return Number(cleaned.replace(/[.,]/g, ''));
  }
  const integer = cleaned.slice(0, sepIndex).replace(/[.,]/g, '');
  const decimal = cleaned.slice(sepIndex + 1).replace(/[^0-9]/g, '');
  const normalized = `${integer}.${decimal}`;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

export default function PriceFormDialog({ open, onClose, row }) {
  const isEdit = Boolean(row);

  const [form, setForm] = React.useState(defaultForm);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState({});

  const [productInput, setProductInput] = React.useState('');
  const [productOptions, setProductOptions] = React.useState([]);
  const [productLoading, setProductLoading] = React.useState(false);

  const [listOptions, setListOptions] = React.useState([]);
  const [listsLoading, setListsLoading] = React.useState(false);

  const [autoCalcCompra, setAutoCalcCompra] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    if (!open) return () => { active = false; };
    if (listOptions.length) return () => { active = false; };

    const fetchLists = async () => {
      setListsLoading(true);
      try {
        const { data } = await api.get('/listas', { params: { limite: 500 } });
        if (!active) return;
        const listas = (data.listas ?? []).filter((l) => l?.activo !== false);
        setListOptions(listas);
      } catch (err) {
        console.error('Error al obtener listas de precios:', err);
      } finally {
        if (active) setListsLoading(false);
      }
    };

    fetchLists();
    return () => { active = false; };
  }, [open, listOptions.length]);

  React.useEffect(() => {
    let active = true;
    if (!open) return () => { active = false; };
    if (productInput.trim().length < 3) {
      setProductOptions((opts) => {
        if (!isEdit || !row?.codproducto) return [];
        const current = row.codproducto;
        const exists = opts.some((opt) => opt?._id === current?._id);
        return exists ? opts : [current, ...opts];
      });
      return () => { active = false; };
    }

    const handler = setTimeout(async () => {
      setProductLoading(true);
      try {
        const { data } = await api.get('/producservs/lookup', {
          params: { q: productInput.trim(), limit: 20 },
        });
        if (!active) return;
        const results = data.producservs ?? [];
        setProductOptions((opts) => {
          const merged = results.slice();
          if (isEdit && row?.codproducto) {
            const exists = merged.some((opt) => opt?._id === row.codproducto?._id);
            if (!exists) merged.unshift(row.codproducto);
          }
          return merged;
        });
      } catch (err) {
        if (err?.response?.status !== 400) {
          console.error('Error al buscar productos/servicios:', err);
        }
      } finally {
        if (active) setProductLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [open, productInput, isEdit, row?.codproducto]);

  React.useEffect(() => {
    if (!open) return;
    if (isEdit && row) {
      const producto = row.codproducto ?? null;
      const lista = row.lista ?? null;
      const netoCompra = formatForInput(row.precionetocompra);
      const ivaCompra = formatForInput(row.ivacompra);
      const totalCompra = formatForInput(row.preciototalcompra);
      const netoVenta = formatForInput(row.precionetoventa);
      const ivaVenta = formatForInput(row.ivaventa);
      const totalVenta = formatForInput(row.preciototalventa);

      setForm({
        codproducto: producto,
        lista,
        activo: Boolean(row.activo),
        precionetocompra: netoCompra,
        ivacompra: ivaCompra,
        preciototalcompra: totalCompra,
        precionetoventa: netoVenta,
        ivaventa: ivaVenta,
        preciototalventa: totalVenta,
      });
      setProductInput(producto?.descripcion ?? '');
      if (producto) {
        setProductOptions((opts) => {
          const exists = opts.some((opt) => opt?._id === producto?._id);
          return exists ? opts : [producto, ...opts];
        });
      }
      if (lista) {
        setListOptions((opts) => {
          const exists = opts.some((opt) => opt?._id === lista?._id);
          return exists ? opts : [lista, ...opts];
        });
      }
      const netoCompraNum = parseDecimal(netoCompra);
      const ivaCompraNum = parseDecimal(ivaCompra) ?? 0;
      const totalCompraNum = parseDecimal(totalCompra);
      if (
        netoCompraNum !== null &&
        totalCompraNum !== null &&
        Math.abs((netoCompraNum + netoCompraNum * (ivaCompraNum / 100)) - totalCompraNum) > 0.01
      ) {
        setAutoCalcCompra(false);
      } else {
        setAutoCalcCompra(true);
      }
    } else {
      setForm(defaultForm);
      setProductInput('');
      setAutoCalcCompra(true);
    }
    setErrors({});
  }, [open, isEdit, row]);

  const handleNumberChange = (field) => (event) => {
    const value = sanitizeDecimal(event.target.value);
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (autoCalcCompra && (field === 'precionetocompra' || field === 'ivacompra')) {
        const neto = parseDecimal(field === 'precionetocompra' ? value : next.precionetocompra);
        const iva = parseDecimal(field === 'ivacompra' ? value : next.ivacompra) ?? 0;
        if (neto !== null) {
          const total = neto + neto * (iva / 100);
          next.preciototalcompra = Number.isFinite(total) ? total.toFixed(2) : '';
        }
      }
      return next;
    });
  };

  const handleTotalCompraChange = (event) => {
    const value = sanitizeDecimal(event.target.value);
    setAutoCalcCompra(false);
    setForm((prev) => ({ ...prev, preciototalcompra: value }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.codproducto) nextErrors.codproducto = 'Seleccione un producto';
    if (!form.lista) nextErrors.lista = 'Seleccione una lista';

    const netoCompra = parseDecimal(form.precionetocompra);
    const totalCompra = parseDecimal(form.preciototalcompra);
    const netoVenta = parseDecimal(form.precionetoventa);
    const totalVenta = parseDecimal(form.preciototalventa);

    if (netoCompra === null) nextErrors.precionetocompra = 'Ingrese un valor válido';
    if (totalCompra === null) nextErrors.preciototalcompra = 'Ingrese un valor válido';
    if (netoVenta === null) nextErrors.precionetoventa = 'Ingrese un valor válido';
    if (totalVenta === null) nextErrors.preciototalventa = 'Ingrese un valor válido';

    const ivaCompra = parseDecimal(form.ivacompra) ?? 0;
    if (
      autoCalcCompra &&
      netoCompra !== null &&
      totalCompra !== null &&
      Math.abs((netoCompra + netoCompra * (ivaCompra / 100)) - totalCompra) > 0.01
    ) {
      nextErrors.preciototalcompra = 'El total no coincide con el neto + IVA';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const netoCompra = parseDecimal(form.precionetocompra);
      const ivaCompra = parseDecimal(form.ivacompra);
      const totalCompra = parseDecimal(form.preciototalcompra);
      const netoVenta = parseDecimal(form.precionetoventa);
      const ivaVenta = parseDecimal(form.ivaventa);
      const totalVenta = parseDecimal(form.preciototalventa);

      const payload = {
        codproducto: form.codproducto?._id ?? form.codproducto,
        lista: form.lista?._id ?? form.lista,
        activo: Boolean(form.activo),
        precionetocompra: netoCompra,
        ivacompra: ivaCompra,
        preciototalcompra: totalCompra,
        precionetoventa: netoVenta,
        ivaventa: ivaVenta,
        preciototalventa: totalVenta,
      };

      let response;
      if (isEdit && row?._id) {
        response = await api.put(`/precios/${row._id}`, payload);
      } else {
        response = await api.post('/precios', payload);
      }

      const message = isEdit ? 'Precio actualizado correctamente' : 'Precio creado correctamente';
      onClose(true, message, response?.data?.precio ?? null);
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'No se pudo guardar el precio.';
      console.error('Guardar precio falló:', status, msg, err?.response?.data);
      window.alert(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => onClose(false)}
      fullWidth
      maxWidth="sm"
      keepMounted
    >
      <DialogTitle>{isEdit ? 'Editar precio' : 'Nuevo precio'}</DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={productOptions}
              loading={productLoading}
              value={form.codproducto}
              onChange={(_, newValue) => setForm((prev) => ({ ...prev, codproducto: newValue }))}
              onInputChange={(_, newInput) => setProductInput(newInput)}
              getOptionLabel={(option) => option?.descripcion ?? ''}
              isOptionEqualToValue={(option, value) => option?._id === value?._id}
              filterOptions={(x) => x}
              noOptionsText={
                productInput.trim().length < 3
                  ? 'Ingresá al menos 3 caracteres para buscar'
                  : 'Sin resultados'
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Producto/Servicio"
                  required
                  error={Boolean(errors.codproducto)}
                  helperText={errors.codproducto || 'Escribe al menos 3 caracteres para buscar'}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {productLoading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <Autocomplete
              options={listOptions}
              loading={listsLoading}
              value={form.lista}
              onChange={(_, newValue) => setForm((prev) => ({ ...prev, lista: newValue }))}
              getOptionLabel={(option) => option?.lista ?? ''}
              isOptionEqualToValue={(option, value) => option?._id === value?._id}
              filterOptions={(x) => x}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Lista"
                  required
                  error={Boolean(errors.lista)}
                  helperText={errors.lista}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {listsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(form.activo)}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, activo: event.target.checked }))
                  }
                />
              }
              label="Activo"
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1 }}>
              PRECIO DE COMPRA
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Precio Neto de compra"
                value={form.precionetocompra}
                onChange={handleNumberChange('precionetocompra')}
                error={Boolean(errors.precionetocompra)}
                helperText={errors.precionetocompra}
                required
                fullWidth
                inputProps={{ inputMode: 'decimal' }}
              />
              <TextField
                label="IVA compra"
                value={form.ivacompra}
                onChange={handleNumberChange('ivacompra')}
                error={Boolean(errors.ivacompra)}
                helperText={errors.ivacompra}
                fullWidth
                inputProps={{ inputMode: 'decimal' }}
              />
            </Stack>

            <TextField
              label="Precio Total compra"
              value={form.preciototalcompra}
              onChange={handleTotalCompraChange}
              error={Boolean(errors.preciototalcompra)}
              helperText={
                errors.preciototalcompra ||
                (autoCalcCompra
                  ? 'Se calcula automáticamente a partir del neto e IVA'
                  : 'Ingresá el total manualmente si difiere del cálculo automático')
              }
              required
              inputProps={{ inputMode: 'decimal' }}
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1 }}>
              PRECIO DE VENTA
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Precio Neto de venta"
                value={form.precionetoventa}
                onChange={handleNumberChange('precionetoventa')}
                error={Boolean(errors.precionetoventa)}
                helperText={errors.precionetoventa}
                required
                fullWidth
                inputProps={{ inputMode: 'decimal' }}
              />
              <TextField
                label="IVA venta"
                value={form.ivaventa}
                onChange={handleNumberChange('ivaventa')}
                error={Boolean(errors.ivaventa)}
                helperText={errors.ivaventa}
                fullWidth
                inputProps={{ inputMode: 'decimal' }}
              />
            </Stack>

            <TextField
              label="Precio Total venta"
              value={form.preciototalventa}
              onChange={handleNumberChange('preciototalventa')}
              error={Boolean(errors.preciototalventa)}
              helperText={errors.preciototalventa}
              required
              inputProps={{ inputMode: 'decimal' }}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => onClose(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

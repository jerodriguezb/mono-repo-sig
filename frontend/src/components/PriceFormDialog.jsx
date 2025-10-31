import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  Autocomplete,
  Typography,
  CircularProgress,
} from '@mui/material';
import api from '../api/axios.js';

const initialFormState = {
  producto: null,
  lista: null,
  activo: true,
  precionetocompra: '',
  ivacompra: '',
  preciototalcompra: '',
  precionetoventa: '',
  ivaventa: '',
  preciototalventa: '',
};

const buildAuthHeaders = () => {
  const raw = localStorage.getItem('token') || '';
  const token = raw.replace(/^"|"$/g, '');
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers.token = token;
  }
  return headers;
};

const normalizeNumber = (value) => {
  if (value === '' || value === null || typeof value === 'undefined') return null;
  const str = String(value).trim();
  if (!str) return null;
  if (str.includes(',') && str.includes('.')) {
    const cleaned = str.replace(/\./g, '').replace(',', '.');
    return Number(cleaned);
  }
  if (str.includes(',')) return Number(str.replace(',', '.'));
  return Number(str);
};

const sanitizeNumericInput = (value) => value.replace(/[^0-9.,-]/g, '');

const shouldAutoFillCompra = (data) => {
  const neto = normalizeNumber(data?.precionetocompra);
  const iva = normalizeNumber(data?.ivacompra);
  const total = normalizeNumber(data?.preciototalcompra);
  if (neto === null || Number.isNaN(neto)) return true;
  if (total === null || Number.isNaN(total)) return true;
  if (iva === null || Number.isNaN(iva)) return Math.abs(total - neto) <= 0.02;
  const computed = neto + neto * (iva / 100);
  return Math.abs(total - computed) <= 0.02;
};

export default function PriceFormDialog({ open, onClose, row }) {
  const isEdit = Boolean(row);

  const [form, setForm] = React.useState(initialFormState);
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  const [listOptions, setListOptions] = React.useState([]);
  const [loadingLists, setLoadingLists] = React.useState(false);
  const [listMessage, setListMessage] = React.useState('');
  const [listDisabled, setListDisabled] = React.useState(true);

  const [productOptions, setProductOptions] = React.useState([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);

  const productoTimer = React.useRef(null);
  const productoAbort = React.useRef(null);
  const listaAbort = React.useRef(null);
  const currentListIdRef = React.useRef(null);
  const [autoTotalCompra, setAutoTotalCompra] = React.useState(true);

  const ensureProductoInOptions = React.useCallback((producto) => {
    if (!producto) return;
    setProductOptions((prev) => {
      const exists = prev.some((opt) => opt._id === producto._id);
      if (exists) return prev;
      return [...prev, producto];
    });
  }, []);

  React.useEffect(() => {
    if (!open) {
      if (listaAbort.current) listaAbort.current.abort();
      setListOptions([]);
      setListMessage('');
      setListDisabled(true);
      setLoadingLists(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (isEdit && row) {
      const nextForm = {
        producto: row.codproducto ?? null,
        lista: row.lista ?? null,
        activo: Boolean(row.activo ?? true),
        precionetocompra: row.precionetocompra != null ? String(row.precionetocompra) : '',
        ivacompra: row.ivacompra != null ? String(row.ivacompra) : '',
        preciototalcompra: row.preciototalcompra != null ? String(row.preciototalcompra) : '',
        precionetoventa: row.precionetoventa != null ? String(row.precionetoventa) : '',
        ivaventa: row.ivaventa != null ? String(row.ivaventa) : '',
        preciototalventa: row.preciototalventa != null ? String(row.preciototalventa) : '',
      };
      setForm(nextForm);
      ensureProductoInOptions(row.codproducto);
      setAutoTotalCompra(shouldAutoFillCompra(nextForm));
    } else {
      setForm(initialFormState);
      setAutoTotalCompra(true);
    }
    setErrors({});
  }, [row, isEdit, ensureProductoInOptions]);

  React.useEffect(() => () => {
    if (productoTimer.current) clearTimeout(productoTimer.current);
    if (productoAbort.current) productoAbort.current.abort();
  }, []);

  const handleProductInputChange = React.useCallback((_, value) => {
    if (productoTimer.current) clearTimeout(productoTimer.current);
    if (productoAbort.current) productoAbort.current.abort();

    const trimmed = value?.trim?.() ?? '';
    if (!trimmed || trimmed.length < 3) {
      setProductOptions(form.producto ? [form.producto] : []);
      setLoadingProducts(false);
      return;
    }

    productoTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      productoAbort.current = controller;
      setLoadingProducts(true);
      try {
        const { data } = await api.get('/producservs/lookup', {
          params: { q: trimmed, limit: 20 },
          signal: controller.signal,
        });
        const options = (data?.producservs ?? []).slice(0, 20);
        setProductOptions(options);
      } catch (error) {
        if (error?.code !== 'ERR_CANCELED') {
          console.error('Error buscando productos', error);
        }
      } finally {
        setLoadingProducts(false);
      }
    }, 300);
  }, [form.producto]);

  const handleNumericChange = (event) => {
    const { name, value } = event.target;
    const sanitized = sanitizeNumericInput(value);
    if (name === 'preciototalcompra') {
      setAutoTotalCompra(sanitized.trim() === '');
    }
    setForm((prev) => ({ ...prev, [name]: sanitized }));
  };

  const handleToggle = (event) => {
    setForm((prev) => ({ ...prev, activo: event.target.checked }));
  };

  React.useEffect(() => {
    currentListIdRef.current = form.lista?._id ?? form.lista ?? null;
  }, [form.lista]);

  React.useEffect(() => {
    if (!open) return undefined;

    const productoId = form.producto?._id ?? form.producto;

    if (listaAbort.current) {
      listaAbort.current.abort();
      listaAbort.current = null;
    }

    if (!productoId) {
      setListOptions([]);
      setListDisabled(true);
      setListMessage('');
      setLoadingLists(false);
      return undefined;
    }

    const controller = new AbortController();
    listaAbort.current = controller;
    let alive = true;

    setLoadingLists(true);
    setListDisabled(true);
    setListMessage('');

    const fetchLists = async () => {
      try {
        const [preciosResponse, listasResponse] = await Promise.all([
          api.get('/precios', {
            params: { codproducto: productoId, limite: 500 },
            signal: controller.signal,
          }),
          api.get('/listas', { params: { limite: 500 }, signal: controller.signal }),
        ]);

        if (!alive) return;

        const precios = preciosResponse?.data?.precios ?? [];
        const listas = (listasResponse?.data?.listas ?? []).filter((lista) => lista?.activo !== false);
        const usedListIds = new Set(
          precios
            .map((precio) => precio?.lista?._id ?? precio?.lista)
            .filter((id) => Boolean(id))
        );
        const currentListId = currentListIdRef.current;

        const availableLists = listas.filter((lista) => {
          const id = lista?._id;
          if (!id) return false;
          if (usedListIds.has(id) && (!currentListId || id !== currentListId)) return false;
          return true;
        });

        setListOptions(availableLists);

        if (!availableLists.length) {
          setListDisabled(true);
          setListMessage('No hay listas disponibles para este producto');
          setForm((prev) => {
            if (!prev.lista) return prev;
            return { ...prev, lista: null };
          });
        } else {
          setListDisabled(false);
          setListMessage('');
        }
      } catch (error) {
        if (error?.code === 'ERR_CANCELED') return;
        if (!alive) return;
        console.error('Error al cargar listas disponibles', error);
        setListOptions([]);
        setListDisabled(true);
        setListMessage('No se pudieron cargar las listas disponibles');
      } finally {
        if (alive) {
          setLoadingLists(false);
          if (listaAbort.current === controller) {
            listaAbort.current = null;
          }
        }
      }
    };

    fetchLists();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [form.producto, open]);

  React.useEffect(() => {
    if (!autoTotalCompra) return;
    const neto = normalizeNumber(form.precionetocompra);
    if (neto === null || Number.isNaN(neto)) {
      if (form.preciototalcompra !== '') {
        setForm((prev) => ({ ...prev, preciototalcompra: '' }));
      }
      return;
    }
    const iva = normalizeNumber(form.ivacompra);
    const computed = iva === null || Number.isNaN(iva)
      ? neto
      : neto + neto * (iva / 100);
    if (!Number.isFinite(computed)) return;
    const formatted = computed.toFixed(2);
    if (form.preciototalcompra === formatted) return;
    setForm((prev) => ({ ...prev, preciototalcompra: formatted }));
  }, [autoTotalCompra, form.precionetocompra, form.ivacompra, form.preciototalcompra]);

  const validate = React.useCallback(() => {
    const errs = {};
    if (!form.producto?._id && !form.producto) errs.producto = 'Seleccioná un producto o servicio';
    if (!form.lista?._id && !form.lista) errs.lista = 'Seleccioná una lista';

    const netoCompra = normalizeNumber(form.precionetocompra);
    const totalCompra = normalizeNumber(form.preciototalcompra);
    const netoVenta = normalizeNumber(form.precionetoventa);
    const totalVenta = normalizeNumber(form.preciototalventa);

    if (netoCompra === null || Number.isNaN(netoCompra)) errs.precionetocompra = 'Ingresá un número válido';
    if (totalCompra === null || Number.isNaN(totalCompra)) errs.preciototalcompra = 'Ingresá un número válido';
    if (netoVenta === null || Number.isNaN(netoVenta)) errs.precionetoventa = 'Ingresá un número válido';
    if (totalVenta === null || Number.isNaN(totalVenta)) errs.preciototalventa = 'Requerido';

    const ivaCompra = normalizeNumber(form.ivacompra);
    if (form.ivacompra && (ivaCompra === null || Number.isNaN(ivaCompra))) errs.ivacompra = 'Número inválido';
    const ivaVenta = normalizeNumber(form.ivaventa);
    if (form.ivaventa && (ivaVenta === null || Number.isNaN(ivaVenta))) errs.ivaventa = 'Número inválido';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        codproducto: form.producto?._id ?? form.producto,
        lista: form.lista?._id ?? form.lista,
        precionetocompra: normalizeNumber(form.precionetocompra),
        ivacompra: normalizeNumber(form.ivacompra),
        preciototalcompra: normalizeNumber(form.preciototalcompra),
        precionetoventa: normalizeNumber(form.precionetoventa),
        ivaventa: normalizeNumber(form.ivaventa),
        preciototalventa: normalizeNumber(form.preciototalventa),
        activo: Boolean(form.activo),
      };

      const headers = buildAuthHeaders();

      if (isEdit) {
        await api.put(`/precios/${row._id}`, payload, { headers });
        window.alert('Precio actualizado correctamente');
      } else {
        await api.post('/precios', payload, { headers });
        window.alert('Precio creado correctamente');
      }

      onClose(true);
    } catch (error) {
      console.error('No se pudo guardar el precio', error);
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        window.alert('No tenés permisos para guardar precios. Iniciá sesión nuevamente.');
      } else if (status === 400 || status === 409) {
        window.alert('Este producto ya tiene precio en la lista seleccionada');
      } else {
        const message = error?.response?.data?.error || error?.response?.data?.message || error?.message;
        window.alert(message || 'Error al guardar el precio. Revisá los datos e intentá nuevamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  const dialogTitle = isEdit ? 'Editar precio' : 'Nuevo precio';

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="sm" keepMounted>
      <DialogTitle>{dialogTitle}</DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1">Datos generales</Typography>

              <Autocomplete
                options={productOptions}
                value={form.producto}
                loading={loadingProducts}
                getOptionLabel={(option) => option?.descripcion ?? ''}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                onInputChange={handleProductInputChange}
                onChange={(_, value) => {
                  ensureProductoInOptions(value);
                  setForm((prev) => ({ ...prev, producto: value, lista: null }));
                  setListMessage('');
                  setListOptions([]);
                  setListDisabled(!value);
                  setErrors((prev) => ({ ...prev, lista: undefined }));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Producto / Servicio"
                    required
                    error={Boolean(errors.producto)}
                    helperText={errors.producto}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <React.Fragment>
                          {loadingProducts ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </React.Fragment>
                      ),
                    }}
                  />
                )}
              />

              <Autocomplete
                options={listOptions}
                value={form.lista}
                loading={loadingLists}
                getOptionLabel={(option) => option?.lista ?? ''}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                onChange={(_, value) => setForm((prev) => ({ ...prev, lista: value }))}
                disabled={listDisabled}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Lista"
                    required
                    error={Boolean(errors.lista)}
                    helperText={errors.lista || listMessage}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <React.Fragment>
                          {loadingLists ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </React.Fragment>
                      ),
                    }}
                  />
                )}
              />

              <FormControlLabel
                control={<Switch checked={form.activo} onChange={handleToggle} color="primary" />}
                label="Activo"
              />
            </Stack>

            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                PRECIO DE COMPRA
              </Typography>
              <TextField
                name="precionetocompra"
                label="Precio Neto de compra"
                value={form.precionetocompra}
                onChange={handleNumericChange}
                error={Boolean(errors.precionetocompra)}
                helperText={errors.precionetocompra}
                required
                inputProps={{ inputMode: 'decimal' }}
              />
              <TextField
                name="ivacompra"
                label="IVA compra (%)"
                value={form.ivacompra}
                onChange={handleNumericChange}
                error={Boolean(errors.ivacompra)}
                helperText={errors.ivacompra}
                inputProps={{ inputMode: 'decimal' }}
              />
              <TextField
                name="preciototalcompra"
                label="Precio Total compra"
                value={form.preciototalcompra}
                onChange={handleNumericChange}
                error={Boolean(errors.preciototalcompra)}
                helperText={errors.preciototalcompra}
                required
                inputProps={{ inputMode: 'decimal' }}
              />
            </Stack>

            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                PRECIO DE VENTA
              </Typography>
              <TextField
                name="precionetoventa"
                label="Precio Neto de venta"
                value={form.precionetoventa}
                onChange={handleNumericChange}
                error={Boolean(errors.precionetoventa)}
                helperText={errors.precionetoventa}
                required
                inputProps={{ inputMode: 'decimal' }}
              />
              <TextField
                name="ivaventa"
                label="IVA venta (%)"
                value={form.ivaventa}
                onChange={handleNumericChange}
                error={Boolean(errors.ivaventa)}
                helperText={errors.ivaventa}
                inputProps={{ inputMode: 'decimal' }}
              />
              <TextField
                name="preciototalventa"
                label="Precio Total venta"
                value={form.preciototalventa}
                onChange={handleNumericChange}
                error={Boolean(errors.preciototalventa)}
                helperText={errors.preciototalventa}
                required
                inputProps={{ inputMode: 'decimal' }}
              />
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => onClose(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              saving
              || loadingLists
              || listDisabled
              || !form.producto
              || !form.lista
            }
          >
            {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

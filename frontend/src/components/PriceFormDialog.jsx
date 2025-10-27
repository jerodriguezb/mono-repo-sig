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

const numberSanitizer = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[^0-9.,-]/g, '').replace(/(?!^)-/g, '').replace(/(,)(?=.*[,])/g, '').replace(/(\.)(?=.*\.)/g, '');
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value)
    .replace(/[^0-9,.-]/g, '')
    .replace(/,/g, '.');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2);
};

export default function PriceFormDialog({ open, onClose, row }) {
  const isEdit = Boolean(row?._id);

  const [form, setForm] = React.useState({
    codproducto: null,
    lista: null,
    activo: true,
    precionetocompra: '',
    ivacompra: '',
    preciototalcompra: '',
    precionetoventa: '',
    ivaventa: '',
    preciototalventa: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [listaOptions, setListaOptions] = React.useState([]);
  const [listaLoading, setListaLoading] = React.useState(false);
  const [productOptions, setProductOptions] = React.useState([]);
  const [productInput, setProductInput] = React.useState('');
  const [productLoading, setProductLoading] = React.useState(false);
  const [manualCompraTotal, setManualCompraTotal] = React.useState(false);

  const productRequestRef = React.useRef(0);
  const fetchedListasRef = React.useRef(false);

  const resetForm = React.useCallback(() => {
    setForm({
      codproducto: null,
      lista: null,
      activo: true,
      precionetocompra: '',
      ivacompra: '',
      preciototalcompra: '',
      precionetoventa: '',
      ivaventa: '',
      preciototalventa: '',
    });
    setErrors({});
    setProductInput('');
    setProductOptions([]);
    setManualCompraTotal(false);
  }, []);

  React.useEffect(() => {
    if (open) {
      if (row) {
        setForm({
          codproducto: row.codproducto ?? null,
          lista: row.lista ?? null,
          activo: Boolean(row.activo ?? true),
          precionetocompra: row.precionetocompra !== undefined && row.precionetocompra !== null
            ? formatNumber(Number(row.precionetocompra))
            : '',
          ivacompra: row.ivacompra !== undefined && row.ivacompra !== null
            ? formatNumber(Number(row.ivacompra))
            : '',
          preciototalcompra: row.preciototalcompra !== undefined && row.preciototalcompra !== null
            ? formatNumber(Number(row.preciototalcompra))
            : '',
          precionetoventa: row.precionetoventa !== undefined && row.precionetoventa !== null
            ? formatNumber(Number(row.precionetoventa))
            : '',
          ivaventa: row.ivaventa !== undefined && row.ivaventa !== null
            ? formatNumber(Number(row.ivaventa))
            : '',
          preciototalventa: row.preciototalventa !== undefined && row.preciototalventa !== null
            ? formatNumber(Number(row.preciototalventa))
            : '',
        });
        setProductOptions((prev) => {
          const existing = row.codproducto ? [row.codproducto, ...prev.filter((opt) => opt?._id !== row.codproducto?._id)] : prev;
          return existing;
        });
        setProductInput(row.codproducto?.descripcion ?? '');
      } else {
        resetForm();
      }
      setErrors({});
      setManualCompraTotal(false);
    } else if (!open) {
      resetForm();
    }
  }, [open, row, resetForm]);

  React.useEffect(() => {
    if (!open || fetchedListasRef.current) return;
    let alive = true;
    setListaLoading(true);
    api.get('/listas', { params: { limite: 500 } })
      .then(({ data }) => {
        if (!alive) return;
        const listas = Array.isArray(data?.listas) ? data.listas.filter((item) => item?.activo !== false) : [];
        setListaOptions(listas);
        fetchedListasRef.current = true;
      })
      .catch((err) => {
        console.error('Error al cargar listas:', err);
      })
      .finally(() => {
        if (alive) setListaLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const trimmed = productInput.trim();
    if (trimmed.length < 3) {
      setProductLoading(false);
      setProductOptions((prev) => {
        if (form.codproducto?._id) {
          const selected = form.codproducto;
          const exists = prev.find((opt) => opt?._id === selected._id);
          return exists ? prev : [selected, ...prev];
        }
        return form.codproducto ? [form.codproducto] : [];
      });
      return;
    }

    setProductLoading(true);
    const requestId = productRequestRef.current + 1;
    productRequestRef.current = requestId;

    const handler = setTimeout(() => {
      api.get('/producservs/lookup', { params: { q: trimmed, limit: 20 } })
        .then(({ data }) => {
          if (productRequestRef.current !== requestId) return;
          const options = Array.isArray(data?.producservs) ? data.producservs.slice(0, 20) : [];
          const mapped = [...options];
          if (form.codproducto?._id) {
            const exists = mapped.some((opt) => opt?._id === form.codproducto._id);
            if (!exists) mapped.unshift(form.codproducto);
          }
          setProductOptions(mapped);
        })
        .catch((err) => {
          if (productRequestRef.current !== requestId) return;
          console.error('Error al buscar productos/servicios:', err);
          setProductOptions(form.codproducto ? [form.codproducto] : []);
        })
        .finally(() => {
          if (productRequestRef.current === requestId) {
            setProductLoading(false);
          }
        });
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [productInput, form.codproducto, open]);

  const handleToggle = (event) => {
    const { checked } = event.target;
    setForm((prev) => ({ ...prev, activo: checked }));
  };

  const handleAutocompleteChange = (name) => (event, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'codproducto' && value?.descripcion) {
      setProductInput(value.descripcion);
    }
  };

  const handleNumericChange = (event) => {
    const { name } = event.target;
    const sanitized = numberSanitizer(event.target.value);

    if (name === 'preciototalcompra') {
      setManualCompraTotal(true);
    }

    setForm((prev) => {
      const next = { ...prev, [name]: sanitized };
      if (!manualCompraTotal && (name === 'precionetocompra' || name === 'ivacompra')) {
        const neto = parseNumber(name === 'precionetocompra' ? sanitized : next.precionetocompra);
        const iva = parseNumber(name === 'ivacompra' ? sanitized : next.ivacompra);
        if (neto !== null && iva !== null) {
          const total = neto + neto * (iva / 100);
          next.preciototalcompra = formatNumber(total);
        }
      }
      return next;
    });
  };

  const handleProductInputChange = (event, value) => {
    setProductInput(value ?? '');
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.codproducto?._id) nextErrors.codproducto = 'Seleccioná un producto o servicio';
    if (!form.lista?._id) nextErrors.lista = 'Seleccioná una lista de precios';

    const netoCompra = parseNumber(form.precionetocompra);
    const totalCompra = parseNumber(form.preciototalcompra);
    const netoVenta = parseNumber(form.precionetoventa);
    const totalVenta = parseNumber(form.preciototalventa);

    if (netoCompra === null) nextErrors.precionetocompra = 'Ingresá un precio neto de compra';
    if (totalCompra === null) nextErrors.preciototalcompra = 'Ingresá un precio total de compra';
    if (netoVenta === null) nextErrors.precionetoventa = 'Ingresá un precio neto de venta';
    if (totalVenta === null) nextErrors.preciototalventa = 'Ingresá un precio total de venta';

    const ivaCompra = parseNumber(form.ivacompra);
    if (netoCompra !== null && ivaCompra !== null && totalCompra !== null) {
      const computed = netoCompra + netoCompra * (ivaCompra / 100);
      if (Math.abs(computed - totalCompra) > 0.05 && !manualCompraTotal) {
        nextErrors.preciototalcompra = 'El total debería ser neto + IVA. Revisá los valores ingresados.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const tokenRaw = localStorage.getItem('token') || '';
      const token = tokenRaw.replace(/^"|"$/g, '');
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        headers.token = token;
      }

      const payload = {
        codproducto: form.codproducto?._id ?? form.codproducto,
        lista: form.lista?._id ?? form.lista,
        activo: form.activo,
        precionetocompra: parseNumber(form.precionetocompra),
        ivacompra: parseNumber(form.ivacompra),
        preciototalcompra: parseNumber(form.preciototalcompra),
        precionetoventa: parseNumber(form.precionetoventa),
        ivaventa: parseNumber(form.ivaventa),
        preciototalventa: parseNumber(form.preciototalventa),
      };

      if (isEdit) {
        await api.put(`/precios/${row._id}`, payload, { headers });
      } else {
        await api.post('/precios', payload, { headers });
      }

      window.alert('Precio guardado correctamente.');
      onClose(true);
    } catch (error) {
      console.error('Error al guardar precio:', error);
      const status = error?.response?.status;
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo guardar el precio';

      if (status === 401 || status === 403) {
        window.alert('Sesión inválida o sin permisos. Iniciá sesión nuevamente.');
      } else {
        window.alert(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const productOptionsWithSelection = React.useMemo(() => {
    if (!form.codproducto?._id) return productOptions;
    const exists = productOptions.some((opt) => opt?._id === form.codproducto._id);
    if (exists) return productOptions;
    return [form.codproducto, ...productOptions];
  }, [productOptions, form.codproducto]);

  const listaOptionsWithSelection = React.useMemo(() => {
    if (!form.lista?._id) return listaOptions;
    const exists = listaOptions.some((opt) => opt?._id === form.lista._id);
    if (exists) return listaOptions;
    return [form.lista, ...listaOptions];
  }, [listaOptions, form.lista]);

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="sm" keepMounted>
      <DialogTitle>{isEdit ? 'Editar precio' : 'Nuevo precio'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                Datos generales
              </Typography>
              <Autocomplete
                options={productOptionsWithSelection}
                value={form.codproducto}
                loading={productLoading}
                onChange={handleAutocompleteChange('codproducto')}
                onInputChange={handleProductInputChange}
                getOptionLabel={(option) => option?.descripcion ?? ''}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Producto/Servicio"
                    required
                    error={Boolean(errors.codproducto)}
                    helperText={errors.codproducto || 'Ingresá al menos 3 caracteres para buscar'}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {productLoading ? <CircularProgress color="inherit" size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              <Autocomplete
                options={listaOptionsWithSelection}
                value={form.lista}
                loading={listaLoading}
                onChange={handleAutocompleteChange('lista')}
                getOptionLabel={(option) => option?.lista ?? ''}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Lista"
                    required
                    error={Boolean(errors.lista)}
                    helperText={errors.lista}
                  />
                )}
              />

              <FormControlLabel
                control={<Switch checked={form.activo} onChange={handleToggle} />}
                label="Activo"
              />
            </Stack>

            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                PRECIO DE COMPRA
              </Typography>
              <TextField
                name="precionetocompra"
                label="Precio Neto de compra"
                value={form.precionetocompra}
                onChange={handleNumericChange}
                required
                error={Boolean(errors.precionetocompra)}
                helperText={errors.precionetocompra}
                inputMode="decimal"
                fullWidth
              />
              <TextField
                name="ivacompra"
                label="IVA compra (%)"
                value={form.ivacompra}
                onChange={handleNumericChange}
                error={Boolean(errors.ivacompra)}
                helperText={errors.ivacompra}
                inputMode="decimal"
                fullWidth
              />
              <TextField
                name="preciototalcompra"
                label="Precio Total compra"
                value={form.preciototalcompra}
                onChange={handleNumericChange}
                required
                error={Boolean(errors.preciototalcompra)}
                helperText={errors.preciototalcompra}
                inputMode="decimal"
                fullWidth
              />
            </Stack>

            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                PRECIO DE VENTA
              </Typography>
              <TextField
                name="precionetoventa"
                label="Precio Neto de venta"
                value={form.precionetoventa}
                onChange={handleNumericChange}
                required
                error={Boolean(errors.precionetoventa)}
                helperText={errors.precionetoventa}
                inputMode="decimal"
                fullWidth
              />
              <TextField
                name="ivaventa"
                label="IVA venta (%)"
                value={form.ivaventa}
                onChange={handleNumericChange}
                error={Boolean(errors.ivaventa)}
                helperText={errors.ivaventa}
                inputMode="decimal"
                fullWidth
              />
              <TextField
                name="preciototalventa"
                label="Precio Total venta"
                value={form.preciototalventa}
                onChange={handleNumericChange}
                required
                error={Boolean(errors.preciototalventa)}
                helperText={errors.preciototalventa}
                inputMode="decimal"
                fullWidth
              />
            </Stack>
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

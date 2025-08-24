import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Switch, FormControlLabel, Autocomplete,
  CircularProgress,
} from '@mui/material';
import api from '../api/axios.js';

export default function ProductFormDialog({ open, onClose, row }) {
  const isEdit = Boolean(row);

  const [form, setForm] = React.useState({
    codprod: '',
    descripcion: '',
    tipo: 'PRODUCTO',   // PRODUCTO | SERVICIO
    iva: 21,
    stkactual: 0,       // editable solo en alta
    activo: true,
    rubro: null,              // objeto { _id, rubro, ... }
    marca: null,              // objeto { _id, marca, ... }
    unidaddemedida: null,     // objeto { _id, unidaddemedida, ... }
  });

  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [loadingOpts, setLoadingOpts] = React.useState(false);

  // opciones selects
  const [rubroOpts, setRubroOpts] = React.useState([]);
  const [marcaOpts, setMarcaOpts] = React.useState([]);
  const [unidadOpts, setUnidadOpts] = React.useState([]);

  // Cargar opciones cuando se abre el diálogo
  React.useEffect(() => {
    let alive = true;
    const fetchOpts = async () => {
      setLoadingOpts(true);
      try {
        const [r, m, u] = await Promise.all([
          api.get('/rubros'),
          api.get('/marcas'),
          api.get('/unidades'),
        ]);
        if (!alive) return;
        setRubroOpts(r.data.rubros ?? []);
        setMarcaOpts(m.data.marcas ?? []);
        setUnidadOpts(u.data.unidades ?? []);
      } catch (e) {
        console.error('Error cargando opciones:', e);
      } finally {
        if (alive) setLoadingOpts(false);
      }
    };
    if (open) fetchOpts();
    return () => { alive = false; };
  }, [open]);

  // Cargar datos al editar / limpiar al crear
  React.useEffect(() => {
    if (isEdit && row) {
      const {
        codprod, descripcion, tipo, iva, stkactual, activo,
        rubro, marca, unidaddemedida,
      } = row;
      setForm({
        codprod: (codprod ?? '').toString().trim(),
        descripcion: descripcion ?? '',
        tipo: tipo ?? 'PRODUCTO',
        iva: Number.isFinite(iva) ? iva : 21,
        stkactual: Number.isFinite(stkactual) ? stkactual : 0,
        activo: !!activo,
        rubro: rubro ?? null,
        marca: marca ?? null,
        unidaddemedida: unidaddemedida ?? null,
      });
    } else {
      setForm({
        codprod: '',
        descripcion: '',
        tipo: 'PRODUCTO',
        iva: 21,
        stkactual: 0,
        activo: true,
        rubro: null,
        marca: null,
        unidaddemedida: null,
      });
    }
    setErrors({});
  }, [row, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Stock editable SOLO en alta
    if (name === 'stkactual') {
      if (isEdit) return;
      const v = value.replace(/[^\d]/g, ''); // enteros ≥ 0
      setForm((p) => ({ ...p, stkactual: v }));
      return;
    }

    let v = value;
    if (name === 'iva') v = v.replace(',', '.');
    setForm((p) => ({ ...p, [name]: v }));
  };

  const validate = () => {
    const e = {};
    if (!form.codprod.trim()) e.codprod = 'Requerido';
    if (!form.descripcion.trim()) e.descripcion = 'Requerido';
    if (!['PRODUCTO', 'SERVICIO'].includes(form.tipo))
      e.tipo = 'PRODUCTO o SERVICIO';

    const iva = Number(form.iva);
    if (!Number.isFinite(iva) || iva < 0 || iva > 27)
      e.iva = 'IVA inválido (0–27)';

    if (!isEdit) {
      const stk = Number(form.stkactual);
      if (!Number.isInteger(stk) || stk < 0)
        e.stkactual = 'Stock inicial debe ser un entero ≥ 0';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev?.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const raw = localStorage.getItem('token') || '';
      const token = raw.replace(/^"|"$/g, '');
      const headers = token ? { Authorization: `Bearer ${token}`, token } : undefined;

      const base = {
        codprod: form.codprod.trim(),
        descripcion: form.descripcion.trim(),
        tipo: form.tipo,
        iva: Number(form.iva),
        activo: form.activo,
        rubro: form.rubro?._id ?? null,
        marca: form.marca?._id ?? null,
        unidaddemedida: form.unidaddemedida?._id ?? null,
      };

      if (isEdit) {
        await api.put(`/producservs/${row._id}`, base, { headers });
      } else {
        await api.post(
          '/producservs',
          { ...base, stkactual: Number(form.stkactual) },
          { headers }
        );
      }

      onClose(true);
    } catch (err) {
      console.error('Error al guardar producto:', err?.response?.data || err);
      window.alert(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'No se pudo guardar el producto.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="sm" keepMounted>
      <DialogTitle>{isEdit ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              name="codprod"
              label="Código *"
              value={form.codprod}
              onChange={handleChange}
              error={!!errors.codprod}
              helperText={errors.codprod}
              required
              fullWidth
            />
            <TextField
              name="descripcion"
              label="Descripción *"
              value={form.descripcion}
              onChange={handleChange}
              error={!!errors.descripcion}
              helperText={errors.descripcion}
              required
              fullWidth
            />
            <TextField
              name="tipo"
              label="Tipo (PRODUCTO o SERVICIO)"
              value={form.tipo}
              onChange={handleChange}
              error={!!errors.tipo}
              helperText={errors.tipo}
              fullWidth
            />
            <TextField
              name="iva"
              label="IVA %"
              type="number"
              inputProps={{ step: '0.1', min: 0, max: 27 }}
              value={form.iva}
              onChange={handleChange}
              error={!!errors.iva}
              helperText={errors.iva}
              fullWidth
            />

            {/* RUBRO */}
            <Autocomplete
              options={rubroOpts}
              value={form.rubro}
              loading={loadingOpts}
              onChange={(_, newVal) => setForm((p) => ({ ...p, rubro: newVal }))}
              getOptionLabel={(opt) => opt?.rubro ?? ''}
              isOptionEqualToValue={(opt, val) => opt?._id === val?._id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Rubro"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingOpts ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            {/* MARCA */}
            <Autocomplete
              options={marcaOpts}
              value={form.marca}
              loading={loadingOpts}
              onChange={(_, newVal) => setForm((p) => ({ ...p, marca: newVal }))}
              getOptionLabel={(opt) => opt?.marca ?? ''}
              isOptionEqualToValue={(opt, val) => opt?._id === val?._id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Marca"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingOpts ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            {/* UNIDAD DE MEDIDA */}
            <Autocomplete
              options={unidadOpts}
              value={form.unidaddemedida}
              loading={loadingOpts}
              onChange={(_, newVal) =>
                setForm((p) => ({ ...p, unidaddemedida: newVal }))
              }
              getOptionLabel={(opt) => opt?.unidaddemedida ?? ''}
              isOptionEqualToValue={(opt, val) => opt?._id === val?._id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Unidad de medida"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingOpts ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            {/* STOCK */}
            <TextField
              name="stkactual"
              label={isEdit ? 'Stock (solo lectura)' : 'Stock inicial'}
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={form.stkactual}
              onChange={handleChange}
              disabled={isEdit}
              InputProps={isEdit ? { readOnly: true } : undefined}
              error={!!errors.stkactual}
              helperText={
                isEdit
                  ? 'Este valor no puede modificarse desde aquí'
                  : (errors.stkactual || 'Ingrese stock inicial (entero ≥ 0)')
              }
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  checked={form.activo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, activo: e.target.checked }))
                  }
                />
              }
              label="Activo"
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


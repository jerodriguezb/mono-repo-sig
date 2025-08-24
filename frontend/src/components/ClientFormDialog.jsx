// File: src/components/ClientFormDialog.jsx
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Switch, FormControlLabel,
  Autocomplete, CircularProgress,
} from '@mui/material';
import api from '../api/axios.js';

export default function ClientFormDialog({ open, onClose, row }) {
  const isEdit = Boolean(row);

  // Estado del formulario
  const [form, setForm] = React.useState({
    razonsocial: '',
    domicilio: '',
    telefono: '',
    cuit: '',
    email: '',
    activo: true,
    localidad: null,
    ruta: null,
  });
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState({});

  // Opciones
  const [locOpts, setLocOpts] = React.useState([]);
  const [rutaOpts, setRutaOpts] = React.useState([]);
  const [loadingOpts, setLoadingOpts] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    const fetchOpts = async () => {
      try {
        const [lRes, rRes] = await Promise.all([
          api.get('/localidades'),
          api.get('/rutas'),
        ]);
        if (!alive) return;
        setLocOpts(lRes.data.localidades ?? []);
        setRutaOpts(rRes.data.rutas ?? []);
      } catch (err) {
        console.error('Error al obtener opciones:', err);
      } finally {
        if (alive) setLoadingOpts(false);
      }
    };
    if (open) fetchOpts();
    return () => { alive = false; };
  }, [open]);

  // Cargar fila a editar / limpiar para alta
  React.useEffect(() => {
    if (isEdit && row) {
      const {
        razonsocial, domicilio, telefono,
        cuit, email, activo, localidad, ruta,
      } = row;
      setForm({
        razonsocial: razonsocial ?? '',
        domicilio:   domicilio   ?? '',
        telefono:    telefono    ?? '',
        cuit:        cuit        ?? '',
        email:       email       ?? '',
        activo:      Boolean(activo),
        localidad:   localidad   ?? null,
        ruta:        ruta        ?? null,
      });
    } else {
      setForm({
        razonsocial: '',
        domicilio: '',
        telefono: '',
        cuit: '',
        email: '',
        activo: true,
        localidad: null,
        ruta: null,
      });
    }
    setErrors({});
  }, [row, isEdit]);

  // Handlers
  const handleChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;

    // Sanitiza numéricos en vivo
    if (name === 'telefono') value = value.replace(/\D/g, '').slice(0, 10);
    if (name === 'cuit')     value = value.replace(/\D/g, '').slice(0, 11);

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggle = (e) =>
    setForm((prev) => ({ ...prev, activo: e.target.checked }));

  // Validación
  const validate = () => {
    const errs = {};
    if (!form.razonsocial.trim()) errs.razonsocial = 'Requerido';
    if (!/^\d{10}$/.test(form.telefono)) errs.telefono = 'Debe contener 10 dígitos numéricos';
    if (!form.cuit.trim()) {
      errs.cuit = 'Requerido';
    } else if (!/^\d{11}$/.test(form.cuit)) {
      errs.cuit = 'Sólo números (11 dígitos)';
    }
    if (form.email && !/^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/i.test(form.email))
      errs.email = 'Email inválido';
    if (!form.localidad) errs.localidad = 'Seleccione una localidad';
    if (!form.ruta)      errs.ruta      = 'Seleccione una ruta';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit
  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      // lee token y soporta ambos formatos de header (Authorization y token)
      const raw = localStorage.getItem('token') || '';
      const token = raw.replace(/^"|"$/g, ''); // por si quedó con comillas
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`; // middleware moderno
        headers.token = token;                     // middleware legado
      }

      const payload = {
        razonsocial: form.razonsocial,
        domicilio:   form.domicilio,
        telefono:    form.telefono,
        cuit:        form.cuit,
        email:       form.email?.trim(),
        activo:      form.activo,
        localidad:   form.localidad?._id ?? form.localidad,
        ruta:        form.ruta?._id      ?? form.ruta,
      };

      if (isEdit) {
        await api.put(`/clientes/${row._id}`, payload, { headers });
      } else {
        await api.post('/clientes', payload, { headers });
      }

      onClose(true); // éxito → cerrar y refrescar en el padre
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message;

      console.error('Guardar cliente falló:', status, msg, err?.response?.data);

      if (status === 401 || status === 403) {
        window.alert('Tu sesión no es válida o no tienes permisos para guardar. Inicia sesión nuevamente.');
      } else {
        window.alert(msg || 'No se pudo guardar el cliente. Verifique los datos o su sesión.');
      }
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
      <DialogTitle>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          {loadingOpts ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress />
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                name="razonsocial"
                label="Razón social"
                value={form.razonsocial}
                onChange={handleChange}
                error={Boolean(errors.razonsocial)}
                helperText={errors.razonsocial}
                required
                fullWidth
              />

              <TextField
                name="domicilio"
                label="Domicilio"
                value={form.domicilio}
                onChange={handleChange}
                fullWidth
              />

              <TextField
                name="telefono"
                label="Teléfono (10 dígitos)"
                value={form.telefono}
                onChange={handleChange}
                inputProps={{ inputMode: 'numeric', maxLength: 10 }}
                error={Boolean(errors.telefono)}
                helperText={errors.telefono}
                required
                fullWidth
              />

              <TextField
                name="cuit"
                label="CUIT"
                value={form.cuit}
                onChange={handleChange}
                inputProps={{ inputMode: 'numeric', maxLength: 11 }}
                error={Boolean(errors.cuit)}
                helperText={errors.cuit}
                required
                fullWidth
              />

              <TextField
                name="email"
                label="Email"
                value={form.email}
                onChange={handleChange}
                error={Boolean(errors.email)}
                helperText={errors.email}
                fullWidth
              />

              <Autocomplete
                options={locOpts}
                getOptionLabel={(opt) =>
                  opt ? `${opt.localidad} (${opt.codigopostal})` : ''
                }
                isOptionEqualToValue={(opt, val) =>
                  (opt?._id ?? opt) === (val?._id ?? val)
                }
                value={form.localidad}
                onChange={(_, newVal) =>
                  setForm((prev) => ({ ...prev, localidad: newVal }))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Localidad"
                    error={Boolean(errors.localidad)}
                    helperText={errors.localidad}
                    required
                  />
                )}
              />

              <Autocomplete
                options={rutaOpts}
                getOptionLabel={(opt) => (opt ? opt.ruta : '')}
                isOptionEqualToValue={(opt, val) =>
                  (opt?._id ?? opt) === (val?._id ?? val)
                }
                value={form.ruta}
                onChange={(_, newVal) =>
                  setForm((prev) => ({ ...prev, ruta: newVal }))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Ruta"
                    error={Boolean(errors.ruta)}
                    helperText={errors.ruta}
                    required
                  />
                )}
              />

              <FormControlLabel
                control={<Switch checked={form.activo} onChange={handleToggle} />}
                label="Activo"
              />
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => onClose(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            type="submit"
            disabled={saving || loadingOpts}
          >
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

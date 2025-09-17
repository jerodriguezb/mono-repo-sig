import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Stack,
  Divider,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { createDocument, DOCUMENT_TYPES, fetchDocuments } from '../api/documents.js';
import { fetchProviders } from '../api/providers.js';
import { fetchProducts, updateProductStock } from '../api/products.js';
import { useAuth } from '../context/AuthContext.jsx';

dayjs.extend(utc);
dayjs.extend(timezone);

const ARG_TIMEZONE = 'America/Argentina/Buenos_Aires';
const PREFIJO_AUTOMATICO = '0001';
const steps = ['Tipo de movimiento', 'Datos del documento', 'Confirmación'];

const createEmptyItem = () => ({
  cantidad: '',
  producto: null,
  codprod: '',
});

const formatDateForInput = (value) => (value ? dayjs(value).format('YYYY-MM-DD') : '');
const formatDateForDisplay = (value) => (value ? dayjs(value).tz(ARG_TIMEZONE).format('DD/MM/YYYY') : '');

const getTipoLabel = (tipo) => DOCUMENT_TYPES.find((opt) => opt.value === tipo)?.label ?? '';

export default function DocumentsPage() {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState(() => ({
    tipo: '',
    prefijo: '',
    nroDocumento: '',
    proveedor: null,
    fechaRemito: dayjs().tz(ARG_TIMEZONE),
    items: [createEmptyItem()],
    observaciones: '',
  }));
  const [providers, setProviders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingNextNumber, setLoadingNextNumber] = useState(false);
  const [automaticPreview, setAutomaticPreview] = useState('');
  const [nextNumberError, setNextNumberError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const isAutomaticType = useMemo(() => ['NR', 'AJ'].includes(formData.tipo), [formData.tipo]);

  const providerOptions = useMemo(() => providers ?? [], [providers]);
  const productOptions = useMemo(() => products ?? [], [products]);

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const { data } = await fetchProviders({ limite: 500 });
      setProviders(data?.proveedores ?? []);
    } catch (error) {
      console.error('Error obteniendo proveedores', error);
      setSnackbar({ open: true, severity: 'error', message: 'No se pudo cargar la lista de proveedores.' });
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const { data } = await fetchProducts({ limite: 200 });
      setProducts(data?.producservs ?? []);
    } catch (error) {
      console.error('Error obteniendo productos', error);
      setSnackbar({ open: true, severity: 'error', message: 'No se pudo cargar la lista de productos.' });
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const fetchNextSequence = useCallback(async (tipo) => {
    if (!tipo) return;
    setLoadingNextNumber(true);
    setNextNumberError('');
    try {
      const { data } = await fetchDocuments({ tipo, limite: 1 });
      const cantidad = Number.isFinite(Number(data?.cantidad)) ? Number(data.cantidad) : 0;
      const siguiente = cantidad + 1;
      const secuencia = String(siguiente).padStart(8, '0');
      setFormData((prev) => ({
        ...prev,
        prefijo: PREFIJO_AUTOMATICO,
        nroDocumento: secuencia,
      }));
      setAutomaticPreview(`${PREFIJO_AUTOMATICO}${tipo}${secuencia}`);
    } catch (error) {
      console.error('Error calculando secuencia', error);
      setNextNumberError('No se pudo calcular el próximo número de documento.');
      setAutomaticPreview('');
    } finally {
      setLoadingNextNumber(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
    loadProducts();
  }, [loadProviders, loadProducts]);

  useEffect(() => {
    if (isAutomaticType && formData.tipo) {
      fetchNextSequence(formData.tipo);
    } else {
      setAutomaticPreview('');
      setNextNumberError('');
    }
  }, [formData.tipo, isAutomaticType, fetchNextSequence]);

  const handleTipoChange = (event) => {
    const { value } = event.target;
    setFormData((prev) => ({
      ...prev,
      tipo: value,
      prefijo: ['NR', 'AJ'].includes(value) ? PREFIJO_AUTOMATICO : '',
      nroDocumento: '',
    }));
    setErrors((prev) => ({ ...prev, tipo: undefined }));
  };

  const handleFechaChange = (event) => {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      fechaRemito: value ? dayjs.tz(value, ARG_TIMEZONE) : null,
    }));
    setErrors((prev) => ({ ...prev, fechaRemito: undefined }));
  };

  const handlePrefijoChange = (event) => {
    const { value } = event.target;
    setFormData((prev) => ({ ...prev, prefijo: value.toUpperCase() }));
    setErrors((prev) => ({ ...prev, prefijo: undefined }));
  };

  const handleNumeroChange = (event) => {
    const { value } = event.target;
    setFormData((prev) => ({ ...prev, nroDocumento: value.replace(/[^0-9]/g, '') }));
    setErrors((prev) => ({ ...prev, nroDocumento: undefined }));
  };

  const handleProveedorChange = (_, value) => {
    setFormData((prev) => ({ ...prev, proveedor: value }));
    setErrors((prev) => ({ ...prev, proveedor: undefined }));
  };

  const handleObservacionesChange = (event) => {
    setFormData((prev) => ({ ...prev, observaciones: event.target.value }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const handleItemProductChange = (index, producto) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        producto: producto || null,
      };
      return { ...prev, items: updated };
    });
    setErrors((prev) => ({ ...prev, [`items.${index}.producto`]: undefined }));
  };

  const addItemRow = () => {
    setFormData((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
  };

  const removeItemRow = (index) => {
    setFormData((prev) => {
      const updated = prev.items.filter((_, idx) => idx !== index);
      return { ...prev, items: updated.length ? updated : [createEmptyItem()] };
    });
  };

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.tipo) newErrors.tipo = 'Selecciona un tipo de documento.';
    if (!formData.proveedor) newErrors.proveedor = 'Selecciona un proveedor.';
    if (!formData.fechaRemito) newErrors.fechaRemito = 'La fecha de remito es obligatoria.';

    if (formData.tipo === 'R') {
      if (!formData.prefijo) newErrors.prefijo = 'Ingresá la secuencia (letra + 4 dígitos).';
      else if (!/^([A-Z]{1}\d{4}|\d{4})$/.test(formData.prefijo)) {
        newErrors.prefijo = 'Debe contener una letra y cuatro dígitos (ej: A0001).';
      }
      if (!formData.nroDocumento) newErrors.nroDocumento = 'Ingresá el número de documento (hasta 8 dígitos).';
      else if (!/^\d{1,8}$/.test(formData.nroDocumento)) {
        newErrors.nroDocumento = 'El número debe contener entre 1 y 8 dígitos.';
      }
    }

    if (isAutomaticType) {
      if (!formData.nroDocumento) {
        newErrors.nroDocumento = 'No se pudo calcular el número automático.';
      }
    }

    if (!Array.isArray(formData.items) || formData.items.length === 0) {
      newErrors.items = 'Agregá al menos un ítem.';
    } else {
      formData.items.forEach((item, index) => {
        if (!item || !item.producto) newErrors[`items.${index}.producto`] = 'Seleccioná un producto.';
        const cantidad = Number(item?.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0) newErrors[`items.${index}.cantidad`] = 'Indicá una cantidad válida (> 0).';
        if (!item?.codprod || !item.codprod.toString().trim()) newErrors[`items.${index}.codprod`] = 'El código es obligatorio.';
      });
    }

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  }, [formData, isAutomaticType]);

  const handleNext = () => {
    if (activeStep === 0) {
      if (!formData.tipo) {
        setErrors((prev) => ({ ...prev, tipo: 'Selecciona un tipo de documento.' }));
        return;
      }
      setActiveStep(1);
      return;
    }
    if (activeStep === 1) {
      const { isValid } = validateForm();
      if (isValid) setActiveStep(2);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep((prev) => prev - 1);
  };

  const handleReset = () => {
    setFormData({
      tipo: '',
      prefijo: '',
      nroDocumento: '',
      proveedor: null,
      fechaRemito: dayjs().tz(ARG_TIMEZONE),
      items: [createEmptyItem()],
      observaciones: '',
    });
    setErrors({});
    setAutomaticPreview('');
    setNextNumberError('');
    setActiveStep(0);
  };

  const handleSubmit = async () => {
    const { isValid } = validateForm();
    if (!isValid) {
      setActiveStep(1);
      return;
    }
    const userId = user?.id || localStorage.getItem('id');
    if (!userId) {
      setSnackbar({ open: true, severity: 'error', message: 'No se pudo identificar al usuario autenticado.' });
      return;
    }

    const fechaArg = formData.fechaRemito
      ? dayjs(formData.fechaRemito).tz(ARG_TIMEZONE, true).toDate()
      : null;

    let prefijoValue = formData.prefijo;
    let prefijoLetra = '';
    if (formData.tipo === 'R') {
      const match = formData.prefijo.match(/^([A-Z]?)(\d{4})$/);
      if (match) {
        prefijoLetra = match[1] ?? '';
        prefijoValue = match[2];
      }
    } else if (isAutomaticType) {
      prefijoValue = PREFIJO_AUTOMATICO;
    }

    const itemsPayload = formData.items.map((item) => ({
      cantidad: Number(item.cantidad),
      producto: item.producto?._id || item.producto,
      codprod: item.codprod,
    }));

    const observaciones = [formData.observaciones?.trim(), prefijoLetra ? `Secuencia manual: ${prefijoLetra}${formData.nroDocumento}` : '']
      .filter(Boolean)
      .join(' | ');

    const payload = {
      tipo: formData.tipo,
      prefijo: prefijoValue,
      fechaRemito: fechaArg,
      proveedor: formData.proveedor?._id || formData.proveedor,
      items: itemsPayload,
      observaciones: observaciones || undefined,
      usuario: userId,
    };

    if (formData.tipo === 'R' && formData.nroDocumento) {
      payload.secuencia = Number(formData.nroDocumento);
    }

    if (isAutomaticType && formData.nroDocumento) {
      payload.secuencia = Number(formData.nroDocumento);
    }

    setSaving(true);
    try {
      const { data } = await createDocument(payload);
      const documentoCreado = data?.documento;

      const acumulado = new Map();
      const productosInfo = new Map();
      formData.items.forEach((item) => {
        if (!item?.producto?._id) return;
        const key = item.producto._id;
        const cantidad = Number(item.cantidad) || 0;
        acumulado.set(key, (acumulado.get(key) || 0) + cantidad);
        if (!productosInfo.has(key)) productosInfo.set(key, item.producto);
      });

      for (const [productoId, cantidad] of acumulado.entries()) {
        const info = productosInfo.get(productoId);
        const stockActual = Number(info?.stkactual) || 0;
        const nuevoStock = stockActual - cantidad;
        await updateProductStock(productoId, { stkactual: nuevoStock });
      }

      setSnackbar({
        open: true,
        severity: 'success',
        message: documentoCreado?.NrodeDocumento
          ? `Documento ${documentoCreado.NrodeDocumento} grabado correctamente.`
          : 'Documento grabado correctamente.',
      });
      handleReset();
    } catch (error) {
      console.error('Error al grabar documento', error);
      const backendMessage = error?.response?.data?.err?.message;
      setSnackbar({
        open: true,
        severity: 'error',
        message: backendMessage || 'Ocurrió un error al grabar el documento.',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderTipoStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Seleccioná el tipo de movimiento
      </Typography>
      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel id="tipo-documento-label">Tipo de documento</InputLabel>
        <Select
          labelId="tipo-documento-label"
          value={formData.tipo}
          label="Tipo de documento"
          onChange={handleTipoChange}
          error={Boolean(errors.tipo)}
        >
          {DOCUMENT_TYPES.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {errors.tipo && (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {errors.tipo}
        </Typography>
      )}
      <Box sx={{ mt: 4 }}>
        <Typography variant="body1" color="text.secondary">
          Elegí el tipo de documento para continuar con la carga. Podés avanzar cuando selecciones una opción válida.
        </Typography>
      </Box>
    </Box>
  );

  const renderFormStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        {`Completa los datos del ${getTipoLabel(formData.tipo) || 'documento'}`}
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Autocomplete
            options={providerOptions}
            loading={loadingProviders}
            value={formData.proveedor}
            onChange={handleProveedorChange}
            getOptionLabel={(option) => option?.razonsocial || ''}
            isOptionEqualToValue={(option, value) => option?._id === value?._id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Proveedor"
                error={Boolean(errors.proveedor)}
                helperText={errors.proveedor}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingProviders ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            label="Fecha del documento"
            type="date"
            value={formatDateForInput(formData.fechaRemito)}
            onChange={handleFechaChange}
            InputLabelProps={{ shrink: true }}
            error={Boolean(errors.fechaRemito)}
            helperText={errors.fechaRemito || 'Formato: dd/mm/aaaa'}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            label="Prefijo"
            value={isAutomaticType ? PREFIJO_AUTOMATICO : formData.prefijo}
            onChange={handlePrefijoChange}
            disabled={isAutomaticType}
            inputProps={{ maxLength: 5 }}
            error={Boolean(errors.prefijo)}
            helperText={isAutomaticType ? 'Asignado automáticamente al guardar' : errors.prefijo || 'Ej: A0001'}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            label="Número de documento"
            value={isAutomaticType ? formData.nroDocumento : formData.nroDocumento}
            onChange={handleNumeroChange}
            disabled={isAutomaticType}
            inputProps={{ maxLength: 8 }}
            error={Boolean(errors.nroDocumento)}
            helperText={
              isAutomaticType
                ? nextNumberError || (automaticPreview ? `Siguiente: ${automaticPreview}` : 'Se calcula automáticamente al guardar')
                : errors.nroDocumento || 'Hasta 8 dígitos'
            }
            fullWidth
            InputProps={{
              endAdornment: isAutomaticType && loadingNextNumber ? (
                <InputAdornment position="end">
                  <CircularProgress color="inherit" size={18} />
                </InputAdornment>
              ) : undefined,
            }}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Ítems del documento
        </Typography>
        {errors.items && (
          <Typography color="error" variant="body2" sx={{ mb: 1 }}>
            {errors.items}
          </Typography>
        )}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cantidad</TableCell>
              <TableCell>Producto / Servicio</TableCell>
              <TableCell>Código (codprod)</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {formData.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell width="15%">
                  <TextField
                    type="number"
                    value={item.cantidad}
                    onChange={(event) => handleItemChange(index, 'cantidad', event.target.value)}
                    inputProps={{ min: 0, step: '0.01' }}
                    error={Boolean(errors[`items.${index}.cantidad`])}
                    helperText={errors[`items.${index}.cantidad`]}
                    fullWidth
                  />
                </TableCell>
                <TableCell width="45%">
                  <Autocomplete
                    options={productOptions}
                    loading={loadingProducts}
                    value={item.producto}
                    onChange={(_, value) => handleItemProductChange(index, value)}
                    getOptionLabel={(option) => option?.descripcion || ''}
                    isOptionEqualToValue={(option, value) => option?._id === value?._id}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Producto"
                        error={Boolean(errors[`items.${index}.producto`])}
                        helperText={errors[`items.${index}.producto`]}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingProducts ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </TableCell>
                <TableCell width="25%">
                  <TextField
                    value={item.codprod}
                    onChange={(event) => handleItemChange(index, 'codprod', event.target.value)}
                    error={Boolean(errors[`items.${index}.codprod`])}
                    helperText={errors[`items.${index}.codprod`]}
                    fullWidth
                  />
                </TableCell>
                <TableCell width="15%" align="center">
                  <IconButton color="error" onClick={() => removeItemRow(index)} disabled={formData.items.length === 1}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button startIcon={<AddCircleOutlineIcon />} onClick={addItemRow} sx={{ mt: 2 }}>
          Agregar ítem
        </Button>
      </Box>

      <Box sx={{ mt: 4 }}>
        <TextField
          label="Observaciones"
          value={formData.observaciones}
          onChange={handleObservacionesChange}
          fullWidth
          multiline
          minRows={3}
        />
      </Box>
    </Box>
  );

  const renderConfirmStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Revisá y confirma los datos
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Tipo de documento
            </Typography>
            <Typography variant="body1">{getTipoLabel(formData.tipo)}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Fecha
            </Typography>
            <Typography variant="body1">{formatDateForDisplay(formData.fechaRemito)}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Proveedor
            </Typography>
            <Typography variant="body1">{formData.proveedor?.razonsocial}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Prefijo
            </Typography>
            <Typography variant="body1">{isAutomaticType ? PREFIJO_AUTOMATICO : formData.prefijo}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Número de documento
            </Typography>
            <Typography variant="body1">
              {isAutomaticType ? automaticPreview || formData.nroDocumento : formData.nroDocumento}
            </Typography>
          </Grid>
          {formData.observaciones && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Observaciones
              </Typography>
              <Typography variant="body1">{formData.observaciones}</Typography>
            </Grid>
          )}
        </Grid>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Ítems cargados
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cantidad</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell>Código</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {formData.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.cantidad}</TableCell>
                <TableCell>{item.producto?.descripcion}</TableCell>
                <TableCell>{item.codprod}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Gestión de documentos de stock
      </Typography>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 3, mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper elevation={0} sx={{ p: 3 }}>
        {activeStep === 0 && renderTipoStep()}
        {activeStep === 1 && renderFormStep()}
        {activeStep === 2 && renderConfirmStep()}
      </Paper>

      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          disabled={activeStep === 0 || saving}
        >
          Volver
        </Button>
        {activeStep < steps.length - 1 && (
          <Button variant="contained" onClick={handleNext} disabled={activeStep === 0 && !formData.tipo}>
            Siguiente
          </Button>
        )}
        {activeStep === steps.length - 1 && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Grabando...' : 'Grabar documento'}
          </Button>
        )}
        <Button variant="text" onClick={handleReset} disabled={saving}>
          Reiniciar
        </Button>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

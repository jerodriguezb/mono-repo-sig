import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/es';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useAuth } from '../context/AuthContextState.js';
import {
  createDocumento,
  fetchDocumentos,
  fetchProductos,
  fetchProveedores,
  updateProductoStock,
} from '../api/documentos.js';

const ARG_TIMEZONE = 'America/Argentina/Buenos_Aires';
const DOCUMENT_TYPES = [
  { value: 'R', label: 'Remito' },
  { value: 'NR', label: 'Nota de Recepción' },
  { value: 'AJ', label: 'Ajuste de Inventario' },
];

const steps = ['Seleccioná el tipo', 'Completa los datos'];

const createEmptyItem = () => ({
  cantidad: '',
  producto: null,
  codprod: '',
});

dayjs.extend(utc);
dayjs.extend(timezone);

export default function DocumentsPage() {
  const { userId } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedType, setSelectedType] = useState('');
  const [formState, setFormState] = useState({
    tipo: '',
    prefijo: '0001',
    sequenceManual: '',
    documentNumberManual: '',
    fechaRemito: dayjs().tz(ARG_TIMEZONE),
    proveedor: null,
  });
  const [autoSequenceDisplay, setAutoSequenceDisplay] = useState('');
  const [autoDocumentNumber, setAutoDocumentNumber] = useState('');
  const [items, setItems] = useState([createEmptyItem()]);
  const [providers, setProviders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingDocumentMeta, setLoadingDocumentMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleSnackbarClose = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const { data } = await fetchProveedores();
      setProviders((data?.proveedores || []).sort((a, b) => a.razonsocial.localeCompare(b.razonsocial)));
    } catch (error) {
      console.error(error);
      showSnackbar('No se pudo cargar la lista de proveedores.', 'error');
    } finally {
      setLoadingProviders(false);
    }
  }, [showSnackbar]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const { data } = await fetchProductos({ limite: 200, sortField: 'descripcion' });
      setProducts(data?.producservs || []);
    } catch (error) {
      console.error(error);
      showSnackbar('No se pudo cargar la lista de productos.', 'error');
    } finally {
      setLoadingProducts(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    if (activeStep === 1) {
      loadProviders();
      loadProducts();
    }
  }, [activeStep, loadProducts, loadProviders]);

  const prepareAutomaticSequence = useCallback(async (tipo) => {
    setLoadingDocumentMeta(true);
    const defaultPrefijo = '0001';
    const typeInitial = tipo === 'NR' ? 'N' : 'A';
    let prefijo = defaultPrefijo;
    let nextSequence = 1;

    try {
      const { data } = await fetchDocumentos({ tipo, limite: 1 });
      const lastDocument = data?.documentos?.[0];
      if (lastDocument) {
        prefijo = lastDocument.prefijo || defaultPrefijo;
        nextSequence = Number(lastDocument.secuencia || 0) + 1;
      }
    } catch (error) {
      console.error(error);
      showSnackbar('No se pudo consultar el último número. Se usarán valores por defecto.', 'warning');
    } finally {
      setFormState((prev) => ({
        ...prev,
        prefijo,
      }));
      setAutoSequenceDisplay(`${typeInitial}${prefijo}`);
      setAutoDocumentNumber(`${prefijo}${tipo}${String(nextSequence).padStart(8, '0')}`);
      setLoadingDocumentMeta(false);
    }
  }, [showSnackbar]);

  const resetForm = useCallback(() => {
    setFormState({
      tipo: '',
      prefijo: '0001',
      sequenceManual: '',
      documentNumberManual: '',
      fechaRemito: dayjs().tz(ARG_TIMEZONE),
      proveedor: null,
    });
    setItems([createEmptyItem()]);
    setAutoSequenceDisplay('');
    setAutoDocumentNumber('');
    setSelectedType('');
    setErrors({});
  }, []);

  const handleTypeContinue = useCallback(async () => {
    if (!selectedType) {
      setErrors({ tipo: 'Seleccioná un tipo de documento válido.' });
      return;
    }

    setErrors({});
    setItems([createEmptyItem()]);
    setFormState((prev) => ({
      ...prev,
      tipo: selectedType,
      sequenceManual: '',
      documentNumberManual: '',
      fechaRemito: dayjs().tz(ARG_TIMEZONE),
      proveedor: null,
    }));
    setAutoSequenceDisplay('');
    setAutoDocumentNumber('');
    setActiveStep(1);

    if (selectedType !== 'R') {
      await prepareAutomaticSequence(selectedType);
    }
  }, [prepareAutomaticSequence, selectedType]);

  const handleBack = useCallback(() => {
    setActiveStep(0);
  }, []);

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) => prev.map((item, idx) => {
      if (idx !== index) return item;
      if (field === 'producto') {
        const codprod = value?.codprod || '';
        return { ...item, producto: value, codprod: codprod || item.codprod };
      }
      return { ...item, [field]: value };
    }));
  }, []);

  const addItemRow = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
  }, []);

  const removeItemRow = useCallback((index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const itemErrors = useMemo(() => errors.items || [], [errors.items]);

  const validateForm = useCallback(() => {
    const validation = {};

    if (!formState.proveedor) {
      validation.proveedor = 'Debes seleccionar un proveedor.';
    }

    if (!formState.fechaRemito) {
      validation.fechaRemito = 'La fecha es obligatoria.';
    }

    if (formState.tipo === 'R') {
      if (!formState.sequenceManual || !/^[A-Za-z][0-9]{4}$/.test(formState.sequenceManual)) {
        validation.sequenceManual = 'Usá una letra seguida de cuatro dígitos (ej. R0001).';
      }
      if (!formState.documentNumberManual || !/^\d{1,8}$/.test(formState.documentNumberManual)) {
        validation.documentNumberManual = 'El número debe tener hasta 8 dígitos.';
      }
    }

    const rowsErrors = items.map((item) => ({
      cantidad: !item.cantidad || Number(item.cantidad) <= 0 ? 'Ingresá una cantidad positiva.' : '',
      producto: item.producto ? '' : 'Seleccioná un producto.',
      codprod: item.codprod ? '' : 'Ingresá el código asociado.',
    }));

    if (rowsErrors.some((row) => row.cantidad || row.producto || row.codprod)) {
      validation.items = rowsErrors;
      validation.itemsMessage = 'Revisá los ítems cargados.';
    }

    if (!items.length) {
      validation.itemsMessage = 'Agregá al menos un ítem.';
    }

    return validation;
  }, [formState.documentNumberManual, formState.proveedor, formState.sequenceManual, formState.tipo, formState.fechaRemito, items]);

  const handleSave = useCallback(async () => {
    const validation = validateForm();
    setErrors(validation);

    if (Object.keys(validation).length > 0) {
      showSnackbar('Revisá los campos destacados antes de grabar.', 'error');
      return;
    }

    const payloadItems = items.map((item) => ({
      cantidad: Number(item.cantidad),
      producto: item.producto._id,
      codprod: item.codprod.trim(),
    }));

    const fechaFormatted = formState.fechaRemito
      ? dayjs(formState.fechaRemito).tz(ARG_TIMEZONE).format('YYYY-MM-DD')
      : null;

    const payload = {
      tipo: formState.tipo,
      prefijo: formState.prefijo,
      proveedor: formState.proveedor._id,
      fechaRemito: fechaFormatted,
      items: payloadItems,
    };

    if (formState.tipo === 'R') {
      payload.prefijo = formState.sequenceManual ? formState.sequenceManual.slice(1) : formState.prefijo;
      payload.numeroManual = formState.documentNumberManual;
    }

    if (userId) {
      payload.usuario = userId;
    }

    setSaving(true);

    try {
      const { data } = await createDocumento(payload);
      const documentoCreado = data?.documento;
      const predictedNumber = formState.tipo === 'R'
        ? formState.documentNumberManual
        : autoDocumentNumber;
      const docNumber = documentoCreado?.NrodeDocumento || predictedNumber;

      showSnackbar(
        docNumber
          ? `Documento ${docNumber} guardado. Actualizando stock...`
          : 'Documento guardado. Actualizando stock...',
        'success',
      );

      const updatesByProduct = new Map();
      items.forEach((item) => {
        if (!item.producto) return;
        const key = item.producto._id;
        const current = updatesByProduct.get(key) || { cantidad: 0, producto: item.producto };
        current.cantidad += Number(item.cantidad) || 0;
        updatesByProduct.set(key, current);
      });

      const updateResults = await Promise.allSettled(
        Array.from(updatesByProduct.values()).map(({ cantidad, producto }) => {
          const currentStock = Number(producto.stkactual ?? 0);
          const nuevoStock = currentStock - cantidad;
          return updateProductoStock(producto._id, { stkactual: nuevoStock });
        })
      );

      const failed = updateResults.filter((result) => result.status === 'rejected');
      if (failed.length) {
        showSnackbar(
          docNumber
            ? `Documento ${docNumber} guardado, pero hubo errores al actualizar el stock.`
            : 'El documento se guardó, pero hubo errores al actualizar el stock.',
          'warning',
        );
      } else if (updatesByProduct.size) {
        showSnackbar(
          docNumber
            ? `Documento ${docNumber} guardado y stock actualizado correctamente.`
            : 'Stock actualizado correctamente.',
          'success',
        );
      } else {
        showSnackbar(
          docNumber
            ? `Documento ${docNumber} guardado correctamente.`
            : 'Documento guardado correctamente.',
          'success',
        );
      }

      resetForm();
      setActiveStep(0);
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.err?.message || 'No se pudo guardar el documento.';
      showSnackbar(message, 'error');
    } finally {
      setSaving(false);
    }
  }, [autoDocumentNumber, formState.documentNumberManual, formState.fechaRemito, formState.prefijo, formState.proveedor, formState.sequenceManual, formState.tipo, items, resetForm, showSnackbar, userId, validateForm]);

  const sequenceHelperText = useMemo(() => {
    if (formState.tipo === 'R') {
      return 'Ejemplo: R0001';
    }
    return 'Se completa automáticamente según el tipo seleccionado.';
  }, [formState.tipo]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Stack spacing={3}>
        <Typography variant="h5">Nuevo documento de stock</Typography>

        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Typography variant="subtitle1">
                Seleccioná el tipo de movimiento que deseas registrar
              </Typography>
              <TextField
                select
                fullWidth
                label="Tipo de documento"
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
                error={Boolean(errors.tipo)}
                helperText={errors.tipo || 'Las opciones se validan con el backend.'}
              >
                {DOCUMENT_TYPES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction="row" justifyContent="flex-end" spacing={2}>
                <Button
                  variant="contained"
                  onClick={handleTypeContinue}
                  disabled={loadingDocumentMeta}
                >
                  Continuar
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}

        {activeStep === 1 && (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Datos del documento</Typography>
                <Button
                  startIcon={<ArrowBackIcon />}
                  onClick={handleBack}
                  color="secondary"
                >
                  Volver
                </Button>
              </Stack>

              {loadingDocumentMeta && (
                <Alert severity="info">Consultando numeración disponible en el backend…</Alert>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={providers}
                    loading={loadingProviders}
                    value={formState.proveedor}
                    onChange={(_, newValue) => setFormState((prev) => ({ ...prev, proveedor: newValue }))}
                    isOptionEqualToValue={(option, value) => option._id === value?._id}
                    getOptionLabel={(option) => option?.razonsocial || ''}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Proveedor"
                        error={Boolean(errors.proveedor)}
                        helperText={errors.proveedor || ''}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingProviders ? <CircularProgress color="inherit" size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <DatePicker
                    label="Fecha del documento"
                    value={formState.fechaRemito}
                    format="DD/MM/YYYY"
                    onChange={(value) => setFormState((prev) => ({ ...prev, fechaRemito: value }))}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: Boolean(errors.fechaRemito),
                        helperText: errors.fechaRemito || '',
                      },
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    label="Secuencia"
                    fullWidth
                    value={formState.tipo === 'R' ? formState.sequenceManual : autoSequenceDisplay}
                    onChange={(event) => setFormState((prev) => ({ ...prev, sequenceManual: event.target.value.toUpperCase() }))}
                    inputProps={{ maxLength: 5 }}
                    disabled={formState.tipo !== 'R'}
                    helperText={
                      formState.tipo === 'R' && errors.sequenceManual
                        ? errors.sequenceManual
                        : sequenceHelperText
                    }
                    error={formState.tipo === 'R' && Boolean(errors.sequenceManual)}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    label="Número de documento"
                    fullWidth
                    value={formState.tipo === 'R' ? formState.documentNumberManual : autoDocumentNumber}
                    onChange={(event) => setFormState((prev) => ({ ...prev, documentNumberManual: event.target.value }))}
                    inputProps={{ maxLength: 8, inputMode: 'numeric' }}
                    disabled={formState.tipo !== 'R'}
                    helperText={
                      formState.tipo === 'R' && errors.documentNumberManual
                        ? errors.documentNumberManual
                        : formState.tipo === 'R'
                          ? 'Hasta 8 dígitos numéricos.'
                          : 'Generado automáticamente desde el backend.'
                    }
                    error={formState.tipo === 'R' && Boolean(errors.documentNumberManual)}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    label="Usuario"
                    fullWidth
                    value={userId || ''}
                    disabled
                    helperText="Se enviará automáticamente en la carga."
                  />
                </Grid>
              </Grid>

              {errors.itemsMessage && (
                <Alert severity="warning">{errors.itemsMessage}</Alert>
              )}

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1">Ítems</Typography>
                  <Button
                    startIcon={<AddCircleIcon />}
                    onClick={addItemRow}
                    variant="outlined"
                  >
                    Agregar ítem
                  </Button>
                </Stack>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width="15%">Cantidad</TableCell>
                        <TableCell width="45%">Producto</TableCell>
                        <TableCell width="25%">Código asociado</TableCell>
                        <TableCell width="15%" align="center">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={`item-${index}`}>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              fullWidth
                              inputProps={{ min: 0, step: '0.01' }}
                              value={item.cantidad}
                              onChange={(event) => handleItemChange(index, 'cantidad', event.target.value)}
                              error={Boolean(itemErrors[index]?.cantidad)}
                              helperText={itemErrors[index]?.cantidad || ''}
                            />
                          </TableCell>
                          <TableCell>
                            <Autocomplete
                              options={products}
                              loading={loadingProducts}
                              value={item.producto}
                              onChange={(_, newValue) => handleItemChange(index, 'producto', newValue)}
                              isOptionEqualToValue={(option, value) => option?._id === value?._id}
                              getOptionLabel={(option) => option?.descripcion || ''}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  size="small"
                                  label="Producto"
                                  error={Boolean(itemErrors[index]?.producto)}
                                  helperText={itemErrors[index]?.producto || ''}
                                  InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                      <>
                                        {loadingProducts ? <CircularProgress color="inherit" size={18} /> : null}
                                        {params.InputProps.endAdornment}
                                      </>
                                    ),
                                  }}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              fullWidth
                              value={item.codprod}
                              onChange={(event) => handleItemChange(index, 'codprod', event.target.value)}
                              error={Boolean(itemErrors[index]?.codprod)}
                              helperText={itemErrors[index]?.codprod || ''}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton color="error" onClick={() => removeItemRow(index)} disabled={items.length === 1}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              <Stack direction="row" justifyContent="flex-end" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={saving || loadingDocumentMeta}
                >
                  {saving ? 'Grabando...' : 'Grabar'}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Stack>
    </LocalizationProvider>
  );
}

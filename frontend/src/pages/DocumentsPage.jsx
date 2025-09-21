import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ReplayIcon from '@mui/icons-material/Replay';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/axios';

const steps = ['Tipo y proveedor', 'Datos del documento', 'Ítems'];

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'R', label: 'Remito' },
  { value: 'NR', label: 'Nota de recepción' },
  { value: 'AJ+', label: 'Ajuste (+)' },
  { value: 'AJ-', label: 'Ajuste (-)' },
];

const DEFAULT_DATE = new Date().toISOString().split('T')[0];

const normalizePrefijo = (value) => {
  if (!value) return '';
  const digits = value.toString().replace(/\D/g, '').slice(0, 4);
  return digits;
};

const padPrefijo = (value) => (value ? value.toString().padStart(4, '0') : '0001');

const padSequence = (value) => String(value ?? 0).padStart(8, '0');

const parseApiError = (error, fallback) => {
  if (error?.response?.data?.err?.message) return error.response.data.err.message;
  if (error?.response?.data?.message) return error.response.data.message;
  return error?.message || fallback;
};

export default function DocumentsPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedType, setSelectedType] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [prefijo, setPrefijo] = useState('0001');
  const [fechaRemito, setFechaRemito] = useState(DEFAULT_DATE);
  const [observaciones, setObservaciones] = useState('');
  const [usuarioResponsable, setUsuarioResponsable] = useState('');

  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productCache, setProductCache] = useState({});
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const [dataError, setDataError] = useState({
    providers: '',
    products: '',
    users: '',
    documents: '',
    sequence: '',
  });

  const [nextSequence, setNextSequence] = useState(null);
  const [numeroSugerido, setNumeroSugerido] = useState('');
  const [numeroSugeridoError, setNumeroSugeridoError] = useState('');
  const [ajusteOperacion, setAjusteOperacion] = useState('decrement');

  const [itemDraft, setItemDraft] = useState({ productoId: '', cantidad: '1' });
  const [itemDraftError, setItemDraftError] = useState('');
  const [editingIndex, setEditingIndex] = useState(-1);
  const [items, setItems] = useState([]);

  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ open: false, severity: 'success', message: '' });

  const baseType = useMemo(
    () => (selectedType.startsWith('AJ') ? 'AJ' : selectedType),
    [selectedType],
  );
  const previousBaseTypeRef = useRef(baseType);
  const productSearchRequestIdRef = useRef(0);

  const isNumeroSugeridoValid = useMemo(() => {
    if (baseType !== 'R') return true;
    if (!numeroSugerido) return false;
    const numericValue = Number(numeroSugerido);
    return Number.isSafeInteger(numericValue) && numericValue > 0 && !numeroSugeridoError;
  }, [baseType, numeroSugerido, numeroSugeridoError]);

  const canProceedStep0 = Boolean(selectedType && selectedProvider);
  const canProceedStep1 = Boolean(fechaRemito && prefijo && prefijo.length === 4 && isNumeroSugeridoValid);
  const canSubmit = items.length > 0 && canProceedStep1;

  const selectedUserFromStorage = useMemo(() => localStorage.getItem('id'), []);
  const responsableDisplayName = useMemo(() => {
    if (!usuarioResponsable) return 'Sin especificar';
    const selectedUser = users.find((user) => user._id === usuarioResponsable);
    if (!selectedUser) return 'Sin especificar';
    const nombres = `${selectedUser.nombres ?? ''} ${selectedUser.apellidos ?? ''}`.trim();
    return nombres || selectedUser.email || 'Sin especificar';
  }, [usuarioResponsable, users]);

  const updateDataError = useCallback((key, message) => {
    setDataError((prev) => ({ ...prev, [key]: message }));
  }, []);

  const fetchProviders = useCallback(async () => {
    setProvidersLoading(true);
    try {
      const { data } = await api.get('/proveedores');
      setProviders(data?.proveedores ?? []);
      updateDataError('providers', '');
    } catch (error) {
      updateDataError('providers', parseApiError(error, 'No se pudieron cargar los proveedores'));
    } finally {
      setProvidersLoading(false);
    }
  }, [updateDataError]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data } = await api.get('/usuarios');
      setUsers(data?.usuarios ?? []);
      updateDataError('users', '');
    } catch (error) {
      updateDataError('users', parseApiError(error, 'No se pudieron cargar los usuarios activos'));
    } finally {
      setUsersLoading(false);
    }
  }, [updateDataError]);

  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    try {
      const { data } = await api.get('/documentos', { params: { limite: 25 } });
      setDocuments(data?.documentos ?? []);
      updateDataError('documents', '');
    } catch (error) {
      updateDataError('documents', parseApiError(error, 'No se pudo obtener el historial reciente de documentos'));
    } finally {
      setDocumentsLoading(false);
    }
  }, [updateDataError]);

  const fetchNextSequenceForType = useCallback(async (tipo, overridePrefijo) => {
    const effectivePrefijo = padPrefijo(overridePrefijo ?? prefijo);
    try {
      const { data } = await api.get('/documentos', { params: { tipo, limite: 1 } });
      const last = data?.documentos?.[0];
      const next = (last?.secuencia ?? 0) + 1;
      setNextSequence(next);
      const suggestedNumber = `${effectivePrefijo}${tipo}${padSequence(next)}`;
      setNumeroSugerido(suggestedNumber);
      updateDataError('sequence', '');
      return { next, numero: suggestedNumber };
    } catch (error) {
      const message = parseApiError(error, 'No se pudo obtener el número secuencial');
      updateDataError('sequence', message);
      setAlert({ open: true, severity: 'error', message });
      throw error;
    }
  }, [prefijo, updateDataError]);

  useEffect(() => {
    fetchProviders();
    fetchUsers();
    fetchDocuments();
  }, [fetchProviders, fetchUsers, fetchDocuments]);

  useEffect(() => {
    const trimmedTerm = productSearchTerm.trim();
    const requestId = productSearchRequestIdRef.current + 1;
    productSearchRequestIdRef.current = requestId;

    if (trimmedTerm.length < 3) {
      setProductSearchLoading(false);
      setProductSearchResults([]);
      updateDataError('products', '');
      return;
    }

    setProductSearchLoading(true);
    const handler = setTimeout(() => {
      api
        .get('/producservs/lookup', { params: { q: trimmedTerm, limit: 20 } })
        .then(({ data }) => {
          if (productSearchRequestIdRef.current !== requestId) return;

          const results = Array.isArray(data?.producservs)
            ? data.producservs.slice(0, 20)
            : [];

          setProductSearchResults(results);
          setProductCache((prev) => {
            const next = { ...prev };
            results.forEach((product) => {
              if (!product?._id) return;
              const id = product._id;
              next[id] = { ...(prev[id] ?? {}), ...product };
            });
            return next;
          });
          updateDataError('products', '');
        })
        .catch((error) => {
          if (productSearchRequestIdRef.current !== requestId) return;
          setProductSearchResults([]);
          updateDataError('products', parseApiError(error, 'No se pudieron cargar los productos'));
        })
        .finally(() => {
          if (productSearchRequestIdRef.current === requestId) {
            setProductSearchLoading(false);
          }
        });
    }, 350);

    return () => {
      clearTimeout(handler);
    };
  }, [productSearchTerm, updateDataError]);

  useEffect(() => {
    if (selectedUserFromStorage && users.length > 0 && !usuarioResponsable) {
      const exists = users.find((user) => user._id === selectedUserFromStorage);
      if (exists) setUsuarioResponsable(selectedUserFromStorage);
    }
  }, [users, usuarioResponsable, selectedUserFromStorage]);

  useEffect(() => {
    const previousBaseType = previousBaseTypeRef.current;

    if (!baseType) {
      setNumeroSugerido('');
      setNextSequence(null);
      setAjusteOperacion('decrement');
      previousBaseTypeRef.current = baseType;
      return;
    }

    if (baseType === 'AJ') {
      setAjusteOperacion(selectedType === 'AJ+' ? 'increment' : 'decrement');
    } else if (baseType === 'NR' || baseType === 'R') {
      setAjusteOperacion('increment');
    } else {
      setAjusteOperacion('decrement');
    }

    if (baseType === 'NR' || baseType === 'AJ') {
      const nextPrefijo = '0001';
      if (prefijo !== nextPrefijo) setPrefijo(nextPrefijo);
      fetchNextSequenceForType(baseType, nextPrefijo)
        .then(() => {
          setNumeroSugeridoError('');
        })
        .catch(() => {});
    } else {
      setNextSequence(null);
      updateDataError('sequence', '');
      if (baseType !== 'R' || previousBaseType !== 'R') {
        setNumeroSugerido('');
        setNumeroSugeridoError('');
      }
    }

    previousBaseTypeRef.current = baseType;
  }, [baseType, selectedType, prefijo, fetchNextSequenceForType, updateDataError]);

  useEffect(() => {
    if (nextSequence && (baseType === 'NR' || baseType === 'AJ')) {
      const effectivePrefijo = padPrefijo(prefijo);
      setNumeroSugerido(`${effectivePrefijo}${baseType}${padSequence(nextSequence)}`);
    }
  }, [prefijo, baseType, nextSequence]);

  const ensureNumeroSugeridoValido = useCallback(() => {
    if (baseType !== 'R') return true;
    if (!numeroSugerido) {
      setNumeroSugeridoError((prev) => prev || 'Ingresá un número de documento antes de continuar.');
      return false;
    }
    const numericValue = Number(numeroSugerido);
    if (!Number.isSafeInteger(numericValue) || numericValue <= 0) {
      setNumeroSugeridoError('El número de documento debe ser un entero positivo.');
      return false;
    }
    if (numeroSugeridoError) return false;
    return true;
  }, [baseType, numeroSugerido, numeroSugeridoError]);

  const handleNext = () => {
    if (activeStep === 0 && !canProceedStep0) {
      setAlert({ open: true, severity: 'warning', message: 'Seleccioná el tipo de documento y el proveedor para continuar.' });
      return;
    }
    if (activeStep === 1 && !canProceedStep1) {
      const numeroValido = ensureNumeroSugeridoValido();
      setAlert({
        open: true,
        severity: 'warning',
        message:
          baseType === 'R' && !numeroValido
            ? 'Verificá el número de remito antes de avanzar.'
            : 'Completá los datos del documento antes de avanzar.',
      });
      return;
    }
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleNumeroSugeridoChange = (event) => {
    if (baseType !== 'R') return;
    const rawValue = event.target.value ?? '';
    const digitsOnly = rawValue.toString().replace(/\D/g, '');
    const limitedDigits = digitsOnly.length > 8 ? digitsOnly.slice(-8) : digitsOnly;
    if (!limitedDigits) {
      setNumeroSugerido('');
      setNumeroSugeridoError('');
      return;
    }
    const parsed = Number(limitedDigits);
    const normalized = padSequence(parsed);
    setNumeroSugerido(normalized);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      setNumeroSugeridoError('El número de documento debe ser un entero positivo.');
    } else {
      setNumeroSugeridoError('');
    }
  };

  const handlePrefijoChange = (event) => {
    const value = normalizePrefijo(event.target.value);
    setPrefijo(value);
  };

  const handleProductSearchChange = (event) => {
    setProductSearchTerm(event.target.value ?? '');
  };

  const handleSelectProductFromLookup = (product) => {
    if (!product?._id) return;
    const id = product._id;
    setItemDraft((prev) => ({ ...prev, productoId: id }));
    setProductCache((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...product } }));
    setItemDraftError('');
  };

  const handleItemDraftChange = (event) => {
    const { name, value } = event.target;
    if (name === 'cantidad') {
      if (value === '') {
        setItemDraft((prev) => ({ ...prev, cantidad: '' }));
        setItemDraftError('');
        return;
      }
      if (!/^\d+$/.test(value)) {
        return;
      }
      const numericValue = Number(value);
      setItemDraft((prev) => ({ ...prev, cantidad: value }));
      if (!Number.isInteger(numericValue) || numericValue <= 0) {
        setItemDraftError('La cantidad debe ser un entero positivo.');
      } else {
        setItemDraftError('');
      }
      return;
    }
    setItemDraft((prev) => ({ ...prev, [name]: value }));
  };

  const resetItemDraft = () => {
    setItemDraft({ productoId: '', cantidad: '1' });
    setEditingIndex(-1);
    setItemDraftError('');
  };

  const handleAddOrUpdateItem = () => {
    const productId = itemDraft.productoId;
    const quantity = Number(itemDraft.cantidad);
    if (!productId) {
      setAlert({ open: true, severity: 'warning', message: 'Seleccioná un producto para agregarlo al detalle.' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      const message = 'La cantidad debe ser un entero positivo.';
      setItemDraftError(message);
      setAlert({ open: true, severity: 'warning', message });
      return;
    }
    setItemDraftError('');
    const product = productCache[productId] ?? productSearchResults.find((prod) => prod._id === productId);
    if (!product) {
      setAlert({ open: true, severity: 'error', message: 'El producto seleccionado no está disponible.' });
      return;
    }
    setProductCache((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? {}), ...product },
    }));
    const draftItem = {
      productoId: productId,
      cantidad: quantity,
      codprod: product.codprod,
      descripcion: product.descripcion,
      stkactual: Number(product.stkactual ?? 0),
    };
    setItems((prevItems) => {
      const updated = [...prevItems];
      if (editingIndex >= 0) {
        updated[editingIndex] = draftItem;
      } else {
        const existingIndex = updated.findIndex((item) => item.productoId === productId);
        if (existingIndex >= 0) {
          updated[existingIndex] = { ...draftItem, cantidad: quantity };
        } else {
          updated.push(draftItem);
        }
      }
      return updated;
    });
    setAlert({
      open: true,
      severity: 'success',
      message: editingIndex >= 0 ? 'Ítem actualizado correctamente.' : 'Ítem agregado al documento.',
    });
    resetItemDraft();
  };

  const handleEditItem = (index) => {
    const item = items[index];
    setItemDraft({ productoId: item.productoId, cantidad: String(item.cantidad ?? '') });
    setEditingIndex(index);
    setItemDraftError('');
    setProductCache((prev) => ({
      ...prev,
      [item.productoId]: {
        ...(prev[item.productoId] ?? {}),
        codprod: item.codprod,
        descripcion: item.descripcion,
        stkactual: item.stkactual,
      },
    }));
  };

  const handleRemoveItem = (index) => {
    setItems((prevItems) => prevItems.filter((_, i) => i !== index));
    resetItemDraft();
    setAlert({ open: true, severity: 'info', message: 'Ítem eliminado del documento.' });
  };

  const resetForm = () => {
    setActiveStep(0);
    setSelectedType('');
    setSelectedProvider('');
    setPrefijo('0001');
    setFechaRemito(DEFAULT_DATE);
    setObservaciones('');
    setUsuarioResponsable(selectedUserFromStorage || '');
    setItems([]);
    resetItemDraft();
    setNextSequence(null);
    setNumeroSugerido('');
    setNumeroSugeridoError('');
    setAjusteOperacion('decrement');
    updateDataError('sequence', '');
    setProductSearchTerm('');
    setProductSearchResults([]);
  };

  const closeAlert = (_, reason) => {
    if (reason === 'clickaway') return;
    setAlert((prev) => ({ ...prev, open: false }));
  };

  const handleSubmit = async () => {
    if (baseType === 'R' && !ensureNumeroSugeridoValido()) {
      setAlert({ open: true, severity: 'warning', message: 'Verificá el número de remito antes de guardar.' });
      return;
    }
    if (!canSubmit) {
      setAlert({ open: true, severity: 'warning', message: 'Revisá el formulario: faltan datos obligatorios.' });
      return;
    }
    const effectivePrefijo = padPrefijo(prefijo);
    let sequenceInfo = null;
    if (baseType === 'NR' || baseType === 'AJ') {
      try {
        sequenceInfo = await fetchNextSequenceForType(baseType, effectivePrefijo);
      } catch {
        return;
      }
    } else {
      updateDataError('sequence', '');
    }

    const payload = {
      tipo: baseType,
      prefijo: effectivePrefijo,
      fechaRemito,
      proveedor: selectedProvider,
      items: items.map((item) => ({
        producto: item.productoId,
        cantidad: item.cantidad,
        codprod: item.codprod,
      })),
    };
    if (baseType === 'AJ') {
      payload.ajusteOperacion = ajusteOperacion === 'increment' ? 'increment' : 'decrement';
    }
    const rawNumeroDocumento =
      baseType === 'NR' && sequenceInfo?.numero ? sequenceInfo.numero : numeroSugerido;
    const trimmedNumeroDocumento = rawNumeroDocumento?.toString().trim();
    if ((baseType === 'R' || baseType === 'NR') && trimmedNumeroDocumento) {
      payload.nroDocumento = trimmedNumeroDocumento;
    }
    if (selectedType === 'AJ+' || selectedType === 'AJ-') {
      const trimmedNumeroSugerido =
        numeroSugerido?.toString().trim() || sequenceInfo?.numero?.toString().trim() || '';
      if (!trimmedNumeroSugerido) {
        setAlert({
          open: true,
          severity: 'warning',
          message: 'No se pudo determinar el número sugerido para el ajuste.',
        });
        return;
      }
      payload.nroSugerido = trimmedNumeroSugerido;
    }
    const responsableId = usuarioResponsable || selectedUserFromStorage || '';
    if (responsableId) {
      payload.usuarioResponsable = responsableId;
    }
    const obs = observaciones.trim();
    if (obs) payload.observaciones = obs;

    setSaving(true);
    try {
      const { data } = await api.post('/documentos', payload);
      if (!data?.ok) throw new Error('La API no confirmó la creación del documento.');

      const stockInfo = data?.stock ?? {};
      const stockErrors = Array.isArray(stockInfo?.errors) ? stockInfo.errors : [];
      const backendUpdates = Array.isArray(stockInfo?.updates) ? stockInfo.updates : [];

      const updatesMap = new Map();
      backendUpdates.forEach((update) => {
        const key = update?.producto || update?.id || update?._id;
        if (key) {
          updatesMap.set(key.toString(), Number(update?.stkactual ?? 0));
        }
      });

      items.forEach((item) => {
        if (updatesMap.has(item.productoId)) return;
        const product = productCache[item.productoId];
        const currentStock = Number(product?.stkactual ?? item.stkactual ?? 0);
        const adjustedCantidad = Number(item.cantidad ?? 0);
        const newStock =
          ajusteOperacion === 'increment'
            ? currentStock + adjustedCantidad
            : Math.max(currentStock - adjustedCantidad, 0);
        updatesMap.set(item.productoId, newStock);
      });

      if (updatesMap.size > 0) {
        setProductCache((prev) => {
          const next = { ...prev };
          updatesMap.forEach((value, key) => {
            if (next[key]) {
              next[key] = { ...next[key], stkactual: value };
            }
          });
          return next;
        });
        setProductSearchResults((prev) =>
          prev.map((prod) => (updatesMap.has(prod._id) ? { ...prod, stkactual: updatesMap.get(prod._id) } : prod)),
        );
      }

      await fetchDocuments();

      const formattedStockErrors = stockErrors.map((errorItem) =>
        typeof errorItem === 'string' ? errorItem : String(errorItem?.message ?? errorItem),
      );

      if (formattedStockErrors.length > 0) {
        setAlert({
          open: true,
          severity: 'warning',
          message: `Documento registrado pero algunas actualizaciones de stock fallaron: ${formattedStockErrors.join(' | ')}`,
        });
      } else {
        const backendNumber = data?.documento?.NrodeDocumento?.toString().trim();
        const successMessage = backendNumber
          ? `Documento ${backendNumber} registrado correctamente.`
          : 'Documento registrado correctamente.';
        setAlert({ open: true, severity: 'success', message: successMessage });
        resetForm();
      }
    } catch (error) {
      setAlert({ open: true, severity: 'error', message: parseApiError(error, 'No se pudo guardar el documento') });
    } finally {
      setSaving(false);
    }
  };

  const totalCantidad = useMemo(
    () => items.reduce((acc, item) => acc + Number(item.cantidad ?? 0), 0),
    [items],
  );

  const selectedProduct = useMemo(
    () => (itemDraft.productoId ? productCache[itemDraft.productoId] ?? null : null),
    [itemDraft.productoId, productCache],
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Paper sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="document-type-label">Tipo de documento</InputLabel>
                  <Select
                    labelId="document-type-label"
                    label="Tipo de documento"
                    value={selectedType}
                    onChange={(event) => setSelectedType(event.target.value)}
                  >
                    <MenuItem value="" disabled>
                      Seleccione
                    </MenuItem>
                    {DOCUMENT_TYPE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    Para NR y Ajustes el prefijo se fija en 0001 automáticamente.
                  </FormHelperText>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="provider-label">Proveedor</InputLabel>
                  <Select
                    labelId="provider-label"
                    label="Proveedor"
                    value={selectedProvider}
                    onChange={(event) => setSelectedProvider(event.target.value)}
                    disabled={providersLoading}
                  >
                    <MenuItem value="" disabled>
                      Seleccione
                    </MenuItem>
                    {providers.map((provider) => (
                      <MenuItem key={provider._id} value={provider._id}>
                        {provider.razonsocial}
                      </MenuItem>
                    ))}
                  </Select>
                  {providersLoading && <FormHelperText>Cargando proveedores...</FormHelperText>}
                  {dataError.providers && (
                    <FormHelperText error>{dataError.providers}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Documentos recientes en la base: {documentsLoading ? '...' : documents.length}
                  </Typography>
                  <Button size="small" onClick={fetchDocuments} disabled={documentsLoading}>
                    Actualizar historial
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        );
      case 1:
        return (
          <Paper sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Fecha"
                  type="date"
                  value={fechaRemito}
                  onChange={(event) => setFechaRemito(event.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Prefijo"
                  value={prefijo}
                  onChange={handlePrefijoChange}
                  fullWidth
                  inputProps={{ inputMode: 'numeric', maxLength: 4, pattern: '[0-9]*' }}
                  helperText={baseType === 'R' ? 'Editable para remitos.' : 'Asignado automáticamente.'}
                  disabled={baseType !== 'R'}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Número sugerido"
                  value={numeroSugerido}
                  onChange={handleNumeroSugeridoChange}
                  fullWidth
                  InputProps={{ readOnly: baseType !== 'R' }}
                  inputProps={baseType === 'R' ? { inputMode: 'numeric', pattern: '[0-9]*' } : undefined}
                  error={baseType === 'R' && Boolean(numeroSugeridoError)}
                  helperText={
                    baseType === 'R'
                      ? numeroSugeridoError || 'Ingresá manualmente un número entero positivo (8 dígitos).'
                      : dataError.sequence || 'Se consulta el backend antes de grabar.'
                  }
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel htmlFor="responsable-input">Responsable</InputLabel>
                  <OutlinedInput
                    id="responsable-input"
                    label="Responsable"
                    value={responsableDisplayName}
                    inputProps={{ readOnly: true, 'aria-readonly': true }}
                  />
                  {usersLoading && <FormHelperText>Cargando usuarios...</FormHelperText>}
                  {dataError.users && <FormHelperText error>{dataError.users}</FormHelperText>}
                  <FormHelperText>
                    El backend asignará el usuario autenticado automáticamente.
                  </FormHelperText>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Observaciones"
                  value={observaciones}
                  onChange={(event) => setObservaciones(event.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                />
              </Grid>
            </Grid>
          </Paper>
        );
      case 2:
        return (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <Stack spacing={1}>
                    <TextField
                      label="Buscar producto"
                      value={productSearchTerm}
                      onChange={handleProductSearchChange}
                      placeholder="Ingresá al menos 3 caracteres"
                      fullWidth
                      autoComplete="off"
                    />
                    {productSearchLoading && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">
                          Buscando productos...
                        </Typography>
                      </Stack>
                    )}
                    {dataError.products && <FormHelperText error>{dataError.products}</FormHelperText>}
                    {!dataError.products &&
                      productSearchTerm.trim().length > 0 &&
                      productSearchTerm.trim().length < 3 && (
                        <FormHelperText>Escribí al menos 3 caracteres para buscar.</FormHelperText>
                      )}
                    {(productSearchTerm.trim().length >= 3 || productSearchResults.length > 0) && (
                      <Paper variant="outlined" sx={{ maxHeight: 240, overflowY: 'auto' }}>
                        {productSearchResults.length === 0 && !productSearchLoading ? (
                          <Box sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              No se encontraron productos para la búsqueda.
                            </Typography>
                          </Box>
                        ) : (
                          <List dense disablePadding>
                            {productSearchResults.slice(0, 20).map((product) => {
                              const primaryLabel = product.codprod
                                ? `${product.codprod} – ${product.descripcion}`
                                : product.descripcion;
                              return (
                                <ListItemButton
                                  key={product._id}
                                  onClick={() => handleSelectProductFromLookup(product)}
                                  selected={itemDraft.productoId === product._id}
                                >
                                  <ListItemText
                                    primary={primaryLabel}
                                    secondary={`Stock actual: ${Number(product.stkactual ?? 0)}`}
                                  />
                                </ListItemButton>
                              );
                            })}
                          </List>
                        )}
                      </Paper>
                    )}
                    {selectedProduct && (
                      <Typography variant="body2" color="text.secondary">
                        Seleccionaste:{' '}
                        {selectedProduct.codprod
                          ? `${selectedProduct.codprod} – ${selectedProduct.descripcion}`
                          : selectedProduct.descripcion}
                      </Typography>
                    )}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Cantidad"
                    name="cantidad"
                    type="number"
                    value={itemDraft.cantidad}
                    onChange={handleItemDraftChange}
                    fullWidth
                    inputProps={{ min: 1, step: 1, inputMode: 'numeric', pattern: '[0-9]*' }}
                    error={Boolean(itemDraftError)}
                    helperText={itemDraftError}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={editingIndex >= 0 ? <SaveIcon /> : <AddCircleIcon />}
                    onClick={handleAddOrUpdateItem}
                  >
                    {editingIndex >= 0 ? 'Actualizar ítem' : 'Agregar ítem'}
                  </Button>
                </Grid>
              </Grid>

              <Divider />

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell>Código</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell align="right">Stock actual</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No hay ítems cargados todavía.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => (
                      <TableRow key={item.productoId} hover>
                        <TableCell>{item.descripcion}</TableCell>
                        <TableCell>{item.codprod}</TableCell>
                        <TableCell align="right">{item.cantidad}</TableCell>
                        <TableCell align="right">{item.stkactual}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="Editar">
                            <IconButton color="primary" onClick={() => handleEditItem(index)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton color="error" onClick={() => handleRemoveItem(index)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">Total de ítems: {items.length}</Typography>
                <Typography variant="subtitle2">Cantidad acumulada: {totalCantidad}</Typography>
              </Stack>
            </Stack>
          </Paper>
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5">Gestión de documentos</Typography>
        <Button
          variant="text"
          color="secondary"
          startIcon={<ReplayIcon />}
          onClick={resetForm}
          disabled={saving}
        >
          Reiniciar formulario
        </Button>
      </Stack>

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {Object.entries(dataError)
        .filter(([, message]) => Boolean(message))
        .map(([key, message]) => (
          <Alert key={key} severity={key === 'sequence' ? 'warning' : 'error'} sx={{ mb: 2 }}>
            {message}
          </Alert>
        ))}

      {renderStepContent()}

      <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }}>
        <Button onClick={handleBack} disabled={activeStep === 0 || saving}>
          Atrás
        </Button>
        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={saving || (activeStep === 0 && !canProceedStep0) || (activeStep === 1 && !canProceedStep1)}
          >
            Siguiente
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
          >
            {saving ? 'Guardando...' : 'Confirmar y guardar'}
          </Button>
        )}
      </Stack>

      <Snackbar open={alert.open} autoHideDuration={6000} onClose={closeAlert}>
        <Alert onClose={closeAlert} severity={alert.severity} variant="filled" sx={{ width: '100%' }}>
          {alert.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

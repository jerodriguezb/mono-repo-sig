import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DeleteIcon from '@mui/icons-material/Delete';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios.js';

const INITIAL_FILTERS = {
  cliente: null,
  producto: null,
  estado: null,
  ruta: null,
  camionero: null,
  usuario: null,
  fecha: [null, null],
  puntoDistribucion: '',
  numero: '',
};

const isCanceledError = (error) =>
  error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED';

function useRemoteAutocomplete({
  fetcher,
  minChars = 3,
  delay = 300,
  initialNoOptionsText,
}) {
  const [options, setOptions] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [noOptionsText, setNoOptionsText] = useState(
    initialNoOptionsText ?? `Escribí al menos ${minChars} caracteres…`,
  );

  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const cacheRef = useRef(new Map());

  const clearAsync = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const handleInputChange = useCallback(
    (_, value) => {
      setInputValue(value);
      if (timerRef.current) clearTimeout(timerRef.current);

      if (!value || value.length < minChars) {
        clearAsync();
        setOptions([]);
        setLoading(false);
        setNoOptionsText(`Escribí al menos ${minChars} caracteres…`);
        return;
      }

      timerRef.current = setTimeout(async () => {
        if (abortRef.current) abortRef.current.abort();

        if (cacheRef.current.has(value)) {
          const cached = cacheRef.current.get(value);
          setOptions(cached);
          setNoOptionsText(cached.length ? 'Sin resultados' : 'Sin resultados');
          setLoading(false);
          return;
        }

        setLoading(true);
        setNoOptionsText('Buscando…');
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const results = await fetcher(value, controller);
          cacheRef.current.set(value, results);
          setOptions(results);
          setNoOptionsText(results.length ? 'Sin resultados' : 'Sin resultados');
        } catch (err) {
          if (!isCanceledError(err)) {
            console.error('Error en búsqueda remota', err);
            setNoOptionsText('Error al buscar');
          }
        } finally {
          setLoading(false);
        }
      }, delay);
    },
    [clearAsync, delay, fetcher, minChars],
  );

  useEffect(() => clearAsync, [clearAsync]);

  return {
    options,
    setOptions,
    loading,
    inputValue,
    onInputChange: handleInputChange,
    noOptionsText,
    resetCache: () => cacheRef.current.clear(),
  };
}

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

function mergeOptions(current, selected) {
  if (!selected) return current;
  if (!Array.isArray(current)) return [selected];
  const exists = current.some((opt) => opt?._id === selected?._id);
  return exists ? current : [selected, ...current];
}

function LogisticsAssignmentDialog({
  open,
  mode,
  rows,
  estados,
  initial,
  onClose,
  onSubmit,
  fetchUsuarios,
}) {
  const [estadoValue, setEstadoValue] = useState(initial?.estado ?? null);
  const [camioneroValue, setCamioneroValue] = useState(initial?.camionero ?? null);
  const [usuarioValue, setUsuarioValue] = useState(initial?.usuario ?? null);
  const [puntoValue, setPuntoValue] = useState(initial?.puntoDistribucion ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setEstadoValue(initial?.estado ?? null);
      setCamioneroValue(initial?.camionero ?? null);
      setUsuarioValue(initial?.usuario ?? null);
      setPuntoValue(initial?.puntoDistribucion ?? '');
    }
  }, [initial, open]);

  const camioneroLookup = useRemoteAutocomplete({
    fetcher: (term, controller) => fetchUsuarios(term, controller, 'USER_CAM,ADMIN_ROLE'),
    minChars: 2,
    delay: 250,
    initialNoOptionsText: 'Escribí al menos 2 caracteres…',
  });

  const usuarioLookup = useRemoteAutocomplete({
    fetcher: (term, controller) => fetchUsuarios(term, controller, 'USER_CAM,USER_ROLE,ADMIN_ROLE'),
    minChars: 2,
    delay: 250,
    initialNoOptionsText: 'Escribí al menos 2 caracteres…',
  });

  const camioneroOptions = useMemo(
    () => mergeOptions(camioneroLookup.options, camioneroValue),
    [camioneroLookup.options, camioneroValue],
  );

  const usuarioOptions = useMemo(
    () => mergeOptions(usuarioLookup.options, usuarioValue),
    [usuarioLookup.options, usuarioValue],
  );

  const handleSubmit = async () => {
    const updates = {
      estado: estadoValue ?? undefined,
      camionero: camioneroValue ?? undefined,
      usuario: usuarioValue ?? undefined,
      puntoDistribucion: puntoValue ?? undefined,
    };

    setSubmitting(true);
    try {
      await onSubmit(updates);
    } finally {
      setSubmitting(false);
    }
  };

  const resumen = useMemo(
    () =>
      rows.map((row) => ({
        id: row._id,
        nrodecomanda: row.nrodecomanda,
        cliente: row.codcli?.razonsocial ?? '—',
      })),
    [rows],
  );

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {mode === 'bulk' ? 'Asignación masiva de logística' : 'Actualizar logística'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ py: 1 }}>
          <Typography variant="subtitle2">Resumen de comandas</Typography>
          <Paper variant="outlined" sx={{ maxHeight: 180, overflowY: 'auto' }}>
            <List dense>
              {resumen.map((item) => (
                <ListItem key={item.id} divider>
                  <ListItemText
                    primary={`Comanda #${item.nrodecomanda}`}
                    secondary={item.cliente}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>

          <Autocomplete
            options={estados}
            value={estadoValue}
            onChange={(_, value) => setEstadoValue(value)}
            getOptionLabel={(option) => option?.estado ?? ''}
            isOptionEqualToValue={(option, value) => option?._id === value?._id}
            renderInput={(params) => (
              <TextField {...params} label="Estado" placeholder="Seleccioná un estado" />
            )}
            clearOnEscape
          />

          <Autocomplete
            options={camioneroOptions}
            loading={camioneroLookup.loading}
            value={camioneroValue}
            onChange={(_, value) => setCamioneroValue(value)}
            onInputChange={camioneroLookup.onInputChange}
            getOptionLabel={(option) =>
              option ? `${option.nombres ?? ''} ${option.apellidos ?? ''}`.trim() : ''
            }
            isOptionEqualToValue={(option, value) => option?._id === value?._id}
            noOptionsText={camioneroLookup.noOptionsText}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Camionero / Chofer"
                placeholder="Buscá por nombre"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {camioneroLookup.loading ? (
                        <CircularProgress color="inherit" size={18} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            clearOnEscape
          />

          <Autocomplete
            options={usuarioOptions}
            loading={usuarioLookup.loading}
            value={usuarioValue}
            onChange={(_, value) => setUsuarioValue(value)}
            onInputChange={usuarioLookup.onInputChange}
            getOptionLabel={(option) =>
              option ? `${option.nombres ?? ''} ${option.apellidos ?? ''}`.trim() : ''
            }
            isOptionEqualToValue={(option, value) => option?._id === value?._id}
            noOptionsText={usuarioLookup.noOptionsText}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Operario asignado"
                placeholder="Buscá un usuario"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {usuarioLookup.loading ? (
                        <CircularProgress color="inherit" size={18} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            clearOnEscape
          />

          <TextField
            label="Punto de distribución"
            value={puntoValue}
            onChange={(event) => setPuntoValue(event.target.value)}
            placeholder="Ej. Depósito Norte"
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          startIcon={<LocalShippingIcon />}
          disabled={submitting}
        >
          {mode === 'bulk' ? 'Aplicar a seleccionadas' : 'Guardar cambios'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteConfirmationDialog({ open, row, onClose, onConfirm, loading }) {
  const resumen = useMemo(() => {
    if (!row) return null;
    return {
      numero: row.nrodecomanda,
      cliente: row.codcli?.razonsocial ?? '—',
      producto: row.items?.[0]?.codprod?.descripcion ?? '—',
      fecha: row.fecha ? dayjs(row.fecha).format('DD/MM/YYYY') : '—',
    };
  }, [row]);

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Eliminar comanda</DialogTitle>
      <DialogContent dividers>
        {resumen ? (
          <Stack spacing={1.5}>
            <Typography>
              ¿Deseás eliminar lógicamente la comanda #{resumen.numero}?
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText primary="Cliente" secondary={resumen.cliente} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Producto" secondary={resumen.producto} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Fecha" secondary={resumen.fecha} />
              </ListItem>
            </List>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          startIcon={<DeleteIcon />}
          disabled={loading}
        >
          Eliminar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function LogisticsPage() {
  const [filters, setFilters] = useState(() => ({ ...INITIAL_FILTERS, fecha: [null, null] }));
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [estados, setEstados] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [assignmentDialog, setAssignmentDialog] = useState({
    open: false,
    mode: 'single',
    rows: [],
    initial: {},
  });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, row: null, loading: false });
  const [feedback, setFeedback] = useState({ open: false, severity: 'info', message: '' });

  const fetchUsuarios = useCallback(async (term, controller, roles) => {
    const { data: response } = await api.get('/usuarios/lookup', {
      params: { q: term, limit: 20, roles },
      signal: controller.signal,
    });
    return response?.usuarios ?? [];
  }, []);

  const clienteLookup = useRemoteAutocomplete({
    fetcher: async (term, controller) => {
      const { data: response } = await api.get('/clientes/autocomplete', {
        params: { term },
        signal: controller.signal,
      });
      return (response?.clientes ?? []).slice(0, 20);
    },
    minChars: 3,
    delay: 300,
  });

  const productoLookup = useRemoteAutocomplete({
    fetcher: async (term, controller) => {
      const { data: response } = await api.get('/producservs/lookup', {
        params: { q: term, limit: 20 },
        signal: controller.signal,
      });
      return response?.producservs ?? [];
    },
    minChars: 3,
    delay: 300,
  });

  const camioneroLookup = useRemoteAutocomplete({
    fetcher: (term, controller) => fetchUsuarios(term, controller, 'USER_CAM,ADMIN_ROLE'),
    minChars: 2,
    delay: 250,
    initialNoOptionsText: 'Escribí al menos 2 caracteres…',
  });

  const usuarioLookup = useRemoteAutocomplete({
    fetcher: (term, controller) => fetchUsuarios(term, controller, 'USER_ROLE,ADMIN_ROLE,USER_CAM'),
    minChars: 2,
    delay: 250,
    initialNoOptionsText: 'Escribí al menos 2 caracteres…',
  });

  useEffect(() => {
    const controller = new AbortController();
    const loadInitialData = async () => {
      try {
        const [estadosRes, rutasRes] = await Promise.all([
          api.get('/estados', { signal: controller.signal }),
          api.get('/rutas', { params: { limite: 200 }, signal: controller.signal }),
        ]);
        setEstados(estadosRes.data?.estados ?? []);
        setRutas(rutasRes.data?.rutas ?? []);
      } catch (err) {
        if (!isCanceledError(err)) {
          console.error('Error cargando filtros', err);
        }
      }
    };
    loadInitialData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setRowSelection({});
  }, [data]);

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const params = {
          page: page + 1,
          limit: 20,
        };

        if (filters.numero) params.numero = filters.numero;
        if (filters.cliente?._id) params.cliente = filters.cliente._id;
        if (filters.producto?._id) params.producto = filters.producto._id;
        if (filters.estado?._id) params.estado = filters.estado._id;
        if (filters.ruta?._id) params.ruta = filters.ruta._id;
        if (filters.camionero?._id) params.camionero = filters.camionero._id;
        if (filters.usuario?._id) params.usuario = filters.usuario._id;
        if (filters.puntoDistribucion) params.puntoDistribucion = filters.puntoDistribucion;

        const [fechaDesde, fechaHasta] = filters.fecha;
        if (fechaDesde) params.fechaDesde = fechaDesde.startOf('day').toISOString();
        if (fechaHasta) params.fechaHasta = fechaHasta.endOf('day').toISOString();

        const { data: response } = await api.get('/comandas/logistica', {
          params,
          signal: controller.signal,
        });
        setData(response?.data ?? []);
        setTotal(response?.total ?? 0);
      } catch (err) {
        if (!isCanceledError(err)) {
          console.error('Error cargando comandas', err);
          const message =
            err?.response?.data?.err?.message || 'No se pudo cargar la lista de comandas.';
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
    return () => controller.abort();
  }, [filters, page, refreshToken]);

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(total / 20) - 1, 0);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [total, page]);

  const tableRows = useMemo(
    () =>
      data.map((comanda) => {
        const firstItem = comanda.items?.[0] ?? {};
        const productoNombre = firstItem?.codprod?.descripcion ?? '';
        const listaNombre = firstItem?.lista?.lista ?? '';
        const precioUnitario = Number(firstItem?.monto ?? 0);
        const cantidadEntregada = comanda.cantidadEntregada ?? 0;
        const totalEntregado = comanda.totalEntregado ?? 0;
        const fecha = comanda.fecha ? dayjs(comanda.fecha) : null;
        const camioneroNombre = comanda.camionero
          ? `${comanda.camionero.nombres ?? ''} ${comanda.camionero.apellidos ?? ''}`.trim()
          : '';
        const usuarioNombre = comanda.usuario
          ? `${comanda.usuario.nombres ?? ''} ${comanda.usuario.apellidos ?? ''}`.trim()
          : '';
        const rutaNombre = comanda.codcli?.ruta?.ruta ?? '';

        return {
          id: comanda._id,
          nrodecomanda: comanda.nrodecomanda,
          cliente: comanda.codcli?.razonsocial ?? '',
          producto: productoNombre,
          fechaISO: fecha ? fecha.toISOString() : null,
          fechaDisplay: fecha ? fecha.format('DD/MM/YYYY') : '',
          cantidadEntregada,
          lista: listaNombre,
          precioUnitario,
          totalEntregado,
          estado: comanda.codestado?.estado ?? '',
          ruta: rutaNombre,
          camionero: camioneroNombre,
          puntoDistribucion: comanda.puntoDistribucion ?? '',
          usuario: usuarioNombre,
          raw: comanda,
        };
      }),
    [data],
  );

  const handleExportCSV = useCallback(() => {
    if (!tableRows.length) {
      setFeedback({ open: true, severity: 'info', message: 'No hay datos para exportar.' });
      return;
    }

    const headers = [
      'Nro comanda',
      'Cliente',
      'Producto',
      'Fecha',
      'Cant. entregada',
      'Lista',
      'Precio unitario',
      'Total entregado',
      'Estado',
      'Ruta',
      'Camionero',
      'Punto distribución',
      'Usuario',
    ];

    const escapeCSV = (value) => {
      if (value == null) return '';
      const stringValue = String(value).replace(/"/g, '""');
      if (stringValue.search(/[",\n;]/) >= 0) {
        return `"${stringValue}"`;
      }
      return stringValue;
    };

    const rowsData = tableRows.map((row) => [
      row.nrodecomanda,
      row.cliente,
      row.producto,
      row.fechaDisplay,
      numberFormatter.format(row.cantidadEntregada ?? 0),
      row.lista,
      decimalFormatter.format(row.precioUnitario ?? 0),
      decimalFormatter.format(row.totalEntregado ?? 0),
      row.estado,
      row.ruta,
      row.camionero,
      row.puntoDistribucion,
      row.usuario,
    ]);

    const csvContent = [headers, ...rowsData]
      .map((line) => line.map(escapeCSV).join(';'))
      .join('\n');

    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `logistica_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [tableRows]);

  const handleExportPDF = useCallback(() => {
    if (!tableRows.length) {
      setFeedback({ open: true, severity: 'info', message: 'No hay datos para exportar.' });
      return;
    }

    const doc = new jsPDF('landscape');
    doc.text('Reporte de logística', 14, 18);
    autoTable(doc, {
      startY: 24,
      head: [[
        'Nro',
        'Cliente',
        'Producto',
        'Fecha',
        'Cant. entregada',
        'Lista',
        'Precio unitario',
        'Total entregado',
        'Estado',
        'Ruta',
        'Camionero',
        'Punto distribución',
        'Usuario',
      ]],
      body: tableRows.map((row) => [
        row.nrodecomanda,
        row.cliente,
        row.producto,
        row.fechaDisplay,
        numberFormatter.format(row.cantidadEntregada ?? 0),
        row.lista,
        decimalFormatter.format(row.precioUnitario ?? 0),
        currencyFormatter.format(row.totalEntregado ?? 0),
        row.estado,
        row.ruta,
        row.camionero,
        row.puntoDistribucion,
        row.usuario,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 121, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    doc.save(`logistica_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`);
  }, [tableRows]);

  const handleReload = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS, fecha: [null, null] });
    setPage(0);
    clienteLookup.setOptions([]);
    productoLookup.setOptions([]);
    camioneroLookup.setOptions([]);
    usuarioLookup.setOptions([]);
    clienteLookup.resetCache();
    productoLookup.resetCache();
    camioneroLookup.resetCache();
    usuarioLookup.resetCache();
  }, [camioneroLookup, clienteLookup, productoLookup, usuarioLookup]);

  const selectedRows = useReactTableInstanceSelectedRows(rowSelection, tableRows);

  const handleOpenAssignment = useCallback(
    (rowsToAssign, mode) => {
      if (!rowsToAssign.length) return;
      setAssignmentDialog({
        open: true,
        mode,
        rows: rowsToAssign.map((row) => row.raw ?? row),
        initial:
          mode === 'single'
            ? {
                estado: rowsToAssign[0].raw?.codestado ?? null,
                camionero: rowsToAssign[0].raw?.camionero ?? null,
                usuario: rowsToAssign[0].raw?.usuario ?? null,
                puntoDistribucion: rowsToAssign[0].raw?.puntoDistribucion ?? '',
              }
            : {},
      });
    },
    [],
  );

  const handleCloseAssignment = useCallback(() => {
    setAssignmentDialog({ open: false, mode: 'single', rows: [], initial: {} });
  }, []);

  const handleAssignmentSubmit = useCallback(
    async (updates) => {
      const { rows: rowsToUpdate, mode } = assignmentDialog;
      if (!rowsToUpdate.length) {
        handleCloseAssignment();
        return;
      }

      if (updates.estado && updates.estado.estado) {
        const targetName = updates.estado.estado.toLowerCase();
        if (targetName === 'lista para carga') {
          const incompatible = rowsToUpdate.some((row) =>
            (row.codestado?.estado ?? '').toLowerCase().includes('prepar'),
          );
          if (incompatible) {
            setFeedback({
              open: true,
              severity: 'warning',
              message:
                'Hay comandas en estado "A preparar". No se pueden marcar como "Lista para carga".',
            });
            return;
          }
        }
      }

      const payload = {};
      if (Object.prototype.hasOwnProperty.call(updates, 'estado') && updates.estado) {
        payload.codestado = updates.estado._id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'camionero') && updates.camionero) {
        payload.camionero = updates.camionero._id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'usuario') && updates.usuario) {
        payload.usuario = updates.usuario._id;
      }
      if (typeof updates.puntoDistribucion === 'string' && updates.puntoDistribucion.trim()) {
        payload.puntoDistribucion = updates.puntoDistribucion.trim();
      }

      if (!Object.keys(payload).length) {
        setFeedback({
          open: true,
          severity: 'info',
          message: 'Seleccioná al menos un campo para actualizar.',
        });
        return;
      }

      try {
        if (mode === 'bulk') {
          await Promise.all(rowsToUpdate.map((row) => api.put(`/comandas/${row._id}`, payload)));
        } else {
          await api.put(`/comandas/${rowsToUpdate[0]._id}`, payload);
        }
        setFeedback({
          open: true,
          severity: 'success',
          message: 'Cambios guardados correctamente.',
        });
        handleCloseAssignment();
        setRefreshToken((token) => token + 1);
      } catch (err) {
        console.error('Error actualizando comanda', err);
        const message =
          err?.response?.data?.err?.message || 'No se pudo actualizar la comanda.';
        setFeedback({ open: true, severity: 'error', message });
      }
    },
    [assignmentDialog, handleCloseAssignment],
  );

  const handleOpenDelete = useCallback((row) => {
    setDeleteDialog({ open: true, row: row.raw ?? row, loading: false });
  }, []);

  const handleCloseDelete = useCallback(() => {
    setDeleteDialog({ open: false, row: null, loading: false });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialog.row) return;
    setDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      await api.delete(`/comandas/${deleteDialog.row._id}`);
      setFeedback({ open: true, severity: 'success', message: 'Comanda eliminada correctamente.' });
      handleCloseDelete();
      setRefreshToken((token) => token + 1);
    } catch (err) {
      console.error('Error eliminando comanda', err);
      const message = err?.response?.data?.err?.message || 'No se pudo eliminar la comanda.';
      setFeedback({ open: true, severity: 'error', message });
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  }, [deleteDialog.row, handleCloseDelete]);

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            indeterminate={table.getIsSomeRowsSelected()}
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            inputProps={{ 'aria-label': 'Seleccionar todas las comandas' }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            inputProps={{ 'aria-label': `Seleccionar comanda ${row.original.nrodecomanda}` }}
          />
        ),
        size: 56,
      },
      {
        accessorKey: 'nrodecomanda',
        header: 'Nro comanda',
        size: 110,
        meta: { align: 'center' },
      },
      {
        accessorKey: 'cliente',
        header: 'Cliente',
        size: 220,
      },
      {
        accessorKey: 'producto',
        header: 'Producto',
        size: 220,
      },
      {
        accessorKey: 'fechaDisplay',
        header: 'Fecha',
        size: 120,
        meta: { align: 'center' },
      },
      {
        accessorKey: 'cantidadEntregada',
        header: 'Cant. entregada',
        cell: ({ getValue }) => numberFormatter.format(getValue() ?? 0),
        meta: { align: 'right' },
        size: 120,
      },
      {
        accessorKey: 'lista',
        header: 'Lista',
        size: 140,
      },
      {
        accessorKey: 'precioUnitario',
        header: 'Precio unitario',
        cell: ({ getValue }) => decimalFormatter.format(getValue() ?? 0),
        meta: { align: 'right' },
        size: 140,
      },
      {
        accessorKey: 'totalEntregado',
        header: 'Total entregado',
        cell: ({ getValue }) => currencyFormatter.format(getValue() ?? 0),
        meta: { align: 'right' },
        size: 160,
      },
      {
        accessorKey: 'estado',
        header: 'Estado',
        size: 160,
      },
      {
        accessorKey: 'ruta',
        header: 'Ruta',
        size: 140,
      },
      {
        accessorKey: 'camionero',
        header: 'Camionero',
        size: 180,
      },
      {
        accessorKey: 'puntoDistribucion',
        header: 'Punto de distribución',
        size: 200,
      },
      {
        accessorKey: 'usuario',
        header: 'Usuario',
        size: 180,
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Tooltip title="Gestionar logística">
              <IconButton
                color="primary"
                onClick={() => handleOpenAssignment([row.original], 'single')}
                size="small"
              >
                <LocalShippingIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar comanda">
              <IconButton
                color="error"
                onClick={() => handleOpenDelete(row.original)}
                size="small"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
        size: 140,
        meta: { align: 'right' },
      },
    ],
    [handleOpenAssignment, handleOpenDelete],
  );

  const table = useReactTable({
    data: tableRows,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const visibleColumns = table.getVisibleLeafColumns().length || columns.length;
  const selectedCount = selectedRows.length;
  const camioneroOptions = useMemo(
    () => mergeOptions(camioneroLookup.options, filters.camionero),
    [camioneroLookup.options, filters.camionero],
  );
  const usuarioOptions = useMemo(
    () => mergeOptions(usuarioLookup.options, filters.usuario),
    [usuarioLookup.options, filters.usuario],
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Logística
        </Typography>

        <Grid container spacing={3} alignItems="flex-start">
          <Grid item xs={12} md={3}>
            <Paper elevation={1} sx={{ p: 2, position: 'sticky', top: 88 }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Filtros avanzados
                </Typography>
                <TextField
                  label="Nro de comanda"
                  value={filters.numero}
                  onChange={(event) => {
                    setFilters((prev) => ({ ...prev, numero: event.target.value }));
                    setPage(0);
                  }}
                  placeholder="Ej. 12045"
                />
                <Autocomplete
                  options={mergeOptions(clienteLookup.options, filters.cliente)}
                  loading={clienteLookup.loading}
                  value={filters.cliente}
                  onChange={(_, value) => {
                    setFilters((prev) => ({ ...prev, cliente: value }));
                    setPage(0);
                  }}
                  onInputChange={clienteLookup.onInputChange}
                  getOptionLabel={(option) => option?.razonsocial ?? ''}
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  noOptionsText={clienteLookup.noOptionsText}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Cliente"
                      placeholder="Buscar cliente"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {clienteLookup.loading ? (
                              <CircularProgress color="inherit" size={18} />
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  clearOnEscape
                />

                <Autocomplete
                  options={mergeOptions(productoLookup.options, filters.producto)}
                  loading={productoLookup.loading}
                  value={filters.producto}
                  onChange={(_, value) => {
                    setFilters((prev) => ({ ...prev, producto: value }));
                    setPage(0);
                  }}
                  onInputChange={productoLookup.onInputChange}
                  getOptionLabel={(option) => option?.descripcion ?? ''}
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  noOptionsText={productoLookup.noOptionsText}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Producto"
                      placeholder="Buscar producto"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {productoLookup.loading ? (
                              <CircularProgress color="inherit" size={18} />
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  clearOnEscape
                />

                <Autocomplete
                  options={estados}
                  value={filters.estado}
                  onChange={(_, value) => {
                    setFilters((prev) => ({ ...prev, estado: value }));
                    setPage(0);
                  }}
                  getOptionLabel={(option) => option?.estado ?? ''}
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  renderInput={(params) => (
                    <TextField {...params} label="Estado" placeholder="Seleccioná un estado" />
                  )}
                  clearOnEscape
                />

                <Autocomplete
                  options={rutas}
                  value={filters.ruta}
                  onChange={(_, value) => {
                    setFilters((prev) => ({ ...prev, ruta: value }));
                    setPage(0);
                  }}
                  getOptionLabel={(option) => option?.ruta ?? ''}
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  renderInput={(params) => (
                    <TextField {...params} label="Ruta" placeholder="Seleccioná una ruta" />
                  )}
                  clearOnEscape
                />

                <Autocomplete
                  options={camioneroOptions}
                  loading={camioneroLookup.loading}
                  value={filters.camionero}
                  onChange={(_, value) => {
                    setFilters((prev) => ({ ...prev, camionero: value }));
                    setPage(0);
                  }}
                  onInputChange={camioneroLookup.onInputChange}
                  getOptionLabel={(option) =>
                    option ? `${option.nombres ?? ''} ${option.apellidos ?? ''}`.trim() : ''
                  }
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  noOptionsText={camioneroLookup.noOptionsText}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Camionero / Chofer"
                      placeholder="Buscar camionero"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {camioneroLookup.loading ? (
                              <CircularProgress color="inherit" size={18} />
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  clearOnEscape
                />

                <Autocomplete
                  options={usuarioOptions}
                  loading={usuarioLookup.loading}
                  value={filters.usuario}
                  onChange={(_, value) => {
                    setFilters((prev) => ({ ...prev, usuario: value }));
                    setPage(0);
                  }}
                  onInputChange={usuarioLookup.onInputChange}
                  getOptionLabel={(option) =>
                    option ? `${option.nombres ?? ''} ${option.apellidos ?? ''}`.trim() : ''
                  }
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  noOptionsText={usuarioLookup.noOptionsText}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Operario"
                      placeholder="Buscar usuario"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {usuarioLookup.loading ? (
                              <CircularProgress color="inherit" size={18} />
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  clearOnEscape
                />

                <DateRangePicker
                  value={filters.fecha}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, fecha: value }));
                    setPage(0);
                  }}
                  localeText={{ start: 'Desde', end: 'Hasta' }}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                    },
                  }}
                />

                <TextField
                  label="Punto de distribución"
                  value={filters.puntoDistribucion}
                  onChange={(event) => {
                    setFilters((prev) => ({ ...prev, puntoDistribucion: event.target.value }));
                    setPage(0);
                  }}
                  placeholder="Ej. Centro logístico"
                  fullWidth
                />

                <Divider />
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    startIcon={<ClearAllIcon />}
                    variant="outlined"
                    size="small"
                    onClick={handleClearFilters}
                  >
                    Limpiar
                  </Button>
                  <Button
                    startIcon={<RefreshIcon />}
                    variant="contained"
                    size="small"
                    onClick={handleReload}
                  >
                    Recargar
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={9}>
            <Stack spacing={2}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="center">
                  <Button
                    startIcon={<FileDownloadIcon />}
                    variant="outlined"
                    onClick={handleExportCSV}
                  >
                    Exportar CSV
                  </Button>
                  <Button
                    startIcon={<PictureAsPdfIcon />}
                    variant="outlined"
                    onClick={handleExportPDF}
                  >
                    Exportar PDF
                  </Button>
                  <Box sx={{ flexGrow: 1 }} />
                  <Tooltip title="Recargar">
                    <IconButton color="primary" onClick={handleReload}>
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Limpiar filtros">
                    <IconButton color="secondary" onClick={handleClearFilters}>
                      <ClearAllIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Paper>

              {selectedCount > 0 && (
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                    <AssignmentIndIcon color="primary" />
                    <Typography>
                      {selectedCount === 1
                        ? '1 comanda seleccionada'
                        : `${selectedCount} comandas seleccionadas`}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Button
                      variant="contained"
                      startIcon={<LocalShippingIcon />}
                      onClick={() => handleOpenAssignment(selectedRows, 'bulk')}
                    >
                      Gestionar selección
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => table.resetRowSelection()}
                    >
                      Quitar selección
                    </Button>
                  </Stack>
                </Paper>
              )}

              <Paper elevation={2} sx={{ p: 0 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} sx={{ bgcolor: 'grey.100' }}>
                          {headerGroup.headers.map((header) => (
                            <TableCell
                              key={header.id}
                              align={header.column.columnDef.meta?.align ?? 'left'}
                              sx={{ fontWeight: 600 }}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={visibleColumns}>
                            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                              <CircularProgress size={24} />
                              <Typography>Cargando comandas activas…</Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ) : table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row, index) => (
                          <TableRow
                            key={row.id}
                            hover
                            sx={{
                              bgcolor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                            }}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell
                                key={cell.id}
                                align={cell.column.columnDef.meta?.align ?? 'left'}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={visibleColumns}>
                            <Typography align="center" sx={{ py: 3 }}>
                              {error || 'No se encontraron comandas activas con los filtros seleccionados.'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={total}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  rowsPerPage={20}
                  rowsPerPageOptions={[20]}
                  labelRowsPerPage="Registros por página"
                  showFirstButton
                  showLastButton
                  labelDisplayedRows={({ from, to }) => `${from}–${to} de ${total}`}
                  sx={{ borderTop: '1px solid', borderColor: 'grey.200' }}
                />
              </Paper>
            </Stack>
          </Grid>
        </Grid>

        <LogisticsAssignmentDialog
          open={assignmentDialog.open}
          mode={assignmentDialog.mode}
          rows={assignmentDialog.rows}
          estados={estados}
          initial={assignmentDialog.initial}
          onClose={handleCloseAssignment}
          onSubmit={handleAssignmentSubmit}
          fetchUsuarios={fetchUsuarios}
        />

        <DeleteConfirmationDialog
          open={deleteDialog.open}
          row={deleteDialog.row}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
          loading={deleteDialog.loading}
        />

        <Snackbar
          open={feedback.open}
          autoHideDuration={4000}
          onClose={(_, reason) => {
            if (reason === 'clickaway') return;
            setFeedback((prev) => ({ ...prev, open: false }));
          }}
        >
          <Alert
            onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
            severity={feedback.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {feedback.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}

function useReactTableInstanceSelectedRows(rowSelection, rows) {
  return useMemo(() => {
    const ids = Object.keys(rowSelection ?? {}).filter((key) => rowSelection[key]);
    if (!ids.length) return [];
    const map = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }, [rowSelection, rows]);
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';

const PAGE_SIZE = 20;

const defaultLogisticsForm = {
  estado: null,
  camionero: null,
  usuario: null,
  puntoDistribucion: '',
};

function useRemoteAutocomplete({ url, responseKey, paramName = 'term', minLength = 2 }) {
  const [options, setOptions] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length < minLength) {
      setOptions([]);
      setLoading(false);
      return () => {};
    }

    const controller = new AbortController();
    setLoading(true);
    api
      .get(url, {
        params: { [paramName]: trimmed },
        signal: controller.signal,
      })
      .then((res) => {
        setOptions(res?.data?.[responseKey] ?? []);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error(`Error fetching ${url}`, err);
          setOptions([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [inputValue, minLength, paramName, responseKey, url]);

  return { options, inputValue, setInputValue, loading };
}

const formatCurrency = (value) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? number.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
    : '-';
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('DD/MM/YYYY') : '-';
};

const sumCantidadEntregada = (items = []) =>
  items.reduce((acc, item) => acc + Number(item?.cantidadentregada ?? 0), 0);

const sumTotalEntregado = (items = []) =>
  items.reduce(
    (acc, item) => acc + (Number(item?.cantidadentregada ?? 0) * Number(item?.monto ?? 0)),
    0,
  );

export default function LogisticsPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [columnFilters, setColumnFilters] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [estados, setEstados] = useState([]);
  const [reloadFlag, setReloadFlag] = useState(0);

  const [logisticsDialog, setLogisticsDialog] = useState({ open: false, comanda: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, comanda: null });
  const [singleForm, setSingleForm] = useState(defaultLogisticsForm);
  const [bulkForm, setBulkForm] = useState(defaultLogisticsForm);
  const [actionLoading, setActionLoading] = useState(false);

  const clienteFilters = useRemoteAutocomplete({
    url: '/clientes/autocomplete',
    responseKey: 'clientes',
    minLength: 3,
  });
  const productoFilters = useRemoteAutocomplete({
    url: '/producservs/lookup',
    responseKey: 'producservs',
    paramName: 'q',
    minLength: 3,
  });
  const rutaFilters = useRemoteAutocomplete({
    url: '/rutas/autocomplete',
    responseKey: 'rutas',
    minLength: 2,
  });
  const camioneroFilters = useRemoteAutocomplete({
    url: '/usuarios/autocomplete',
    responseKey: 'usuarios',
    minLength: 2,
  });
  const camioneroForm = useRemoteAutocomplete({
    url: '/usuarios/autocomplete',
    responseKey: 'usuarios',
    minLength: 2,
  });
  const usuarioFilters = useRemoteAutocomplete({
    url: '/usuarios/autocomplete',
    responseKey: 'usuarios',
    minLength: 2,
  });
  const usuarioForm = useRemoteAutocomplete({
    url: '/usuarios/autocomplete',
    responseKey: 'usuarios',
    minLength: 2,
  });

  useEffect(() => {
    api
      .get('/estados')
      .then((res) => {
        setEstados(res?.data?.estados ?? []);
      })
      .catch((err) => {
        console.error('Error fetching estados', err);
      });
  }, []);

  const openLogisticsDialog = useCallback((comanda) => {
    setSingleForm({
      estado: comanda?.codestado ?? null,
      camionero: comanda?.camionero ?? null,
      usuario: comanda?.usuario ?? null,
      puntoDistribucion: comanda?.puntoDistribucion ?? '',
    });
    setLogisticsDialog({ open: true, comanda });
  }, []);

  const openDeleteDialog = useCallback((comanda) => {
    setDeleteDialog({ open: true, comanda });
  }, []);

  const closeLogisticsDialog = useCallback(() => {
    setLogisticsDialog({ open: false, comanda: null });
    setSingleForm(defaultLogisticsForm);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog({ open: false, comanda: null });
  }, []);

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            inputProps={{ 'aria-label': 'Seleccionar todas las comandas visibles' }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            indeterminate={row.getIsSomeSelected()}
            onChange={row.getToggleSelectedHandler()}
            inputProps={{ 'aria-label': `Seleccionar comanda ${row.original?.nrodecomanda ?? ''}` }}
          />
        ),
        size: 48,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'nrodecomanda',
        header: 'Nro de comanda',
        enableColumnFilter: true,
      },
      {
        id: 'cliente',
        header: 'Cliente',
        accessorFn: (row) => row?.codcli?.razonsocial ?? '-',
        enableColumnFilter: true,
      },
      {
        id: 'producto',
        header: 'Producto',
        accessorFn: (row) => row?.items?.[0]?.codprod?.descripcion ?? '-',
        enableColumnFilter: true,
      },
      {
        id: 'fecha',
        header: 'Fecha',
        accessorFn: (row) => row?.fecha,
        cell: ({ getValue }) => formatDate(getValue()),
        enableColumnFilter: true,
      },
      {
        id: 'cantidadEntregada',
        header: 'Cant. entregada',
        accessorFn: (row) => sumCantidadEntregada(row?.items),
        cell: ({ getValue }) => Number(getValue()).toLocaleString('es-AR'),
      },
      {
        id: 'lista',
        header: 'Lista',
        accessorFn: (row) => row?.items?.[0]?.lista?.lista ?? '-',
      },
      {
        id: 'precioUnitario',
        header: 'Precio unitario',
        accessorFn: (row) => row?.items?.[0]?.monto ?? 0,
        cell: ({ getValue }) => formatCurrency(getValue()),
      },
      {
        id: 'totalEntregado',
        header: 'Total entregado',
        accessorFn: (row) => sumTotalEntregado(row?.items),
        cell: ({ getValue }) => formatCurrency(getValue()),
      },
      {
        id: 'estado',
        header: 'Estado',
        accessorFn: (row) => row?.codestado?.estado ?? '-',
        enableColumnFilter: true,
      },
      {
        id: 'ruta',
        header: 'Ruta',
        accessorFn: (row) => row?.codcli?.ruta?.ruta ?? '-',
        enableColumnFilter: true,
      },
      {
        id: 'camionero',
        header: 'Camionero',
        accessorFn: (row) => {
          const user = row?.camionero;
          if (!user) return '-';
          return `${user?.nombres ?? ''} ${user?.apellidos ?? ''}`.trim() || '-';
        },
        enableColumnFilter: true,
      },
      {
        id: 'puntoDistribucion',
        header: 'Punto de distribución',
        accessorFn: (row) => row?.puntoDistribucion ?? '-',
        enableColumnFilter: true,
      },
      {
        id: 'usuario',
        header: 'Usuario',
        accessorFn: (row) => {
          const user = row?.usuario;
          if (!user) return '-';
          return `${user?.nombres ?? ''} ${user?.apellidos ?? ''}`.trim() || '-';
        },
        enableColumnFilter: true,
      },
      {
        id: 'acciones',
        header: 'Acciones',
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <Stack direction="row" spacing={1}>
            <Tooltip title="Gestionar logística">
              <span>
                <IconButton color="primary" size="small" onClick={() => openLogisticsDialog(row.original)}>
                  <LocalShippingIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Eliminar comanda">
              <span>
                <IconButton
                  color="error"
                  size="small"
                  onClick={() => openDeleteDialog(row.original)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [openDeleteDialog, openLogisticsDialog],
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, rowSelection, pagination },
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / (pagination.pageSize || PAGE_SIZE))),
  });

  const setFilterValue = useCallback(
    (columnId, value) => {
      const column = table.getColumn(columnId);
      if (column) column.setFilterValue(value ?? undefined);
    },
    [table],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const params = {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    };

    columnFilters.forEach((filter) => {
      switch (filter.id) {
        case 'cliente':
          if (filter.value?._id) params.cliente = filter.value._id;
          break;
        case 'producto':
          if (filter.value?._id) params.producto = filter.value._id;
          break;
        case 'ruta':
          if (filter.value?._id) params.ruta = filter.value._id;
          break;
        case 'camionero':
          if (filter.value?._id) params.camionero = filter.value._id;
          break;
        case 'estado':
          if (filter.value?._id) params.estado = filter.value._id;
          break;
        case 'usuario':
          if (filter.value?._id) params.usuario = filter.value._id;
          break;
        case 'puntoDistribucion':
          if (filter.value) params.puntoDistribucion = filter.value;
          break;
        case 'fecha': {
          if (Array.isArray(filter.value)) {
            const [from, to] = filter.value;
            if (dayjs.isDayjs(from) && from.isValid()) {
              params.fechaDesde = from.startOf('day').toISOString();
            }
            if (dayjs.isDayjs(to) && to.isValid()) {
              params.fechaHasta = to.endOf('day').toISOString();
            }
          }
          break;
        }
        default:
          break;
      }
    });

    api
      .get('/comandas/logistica', { params, signal: controller.signal })
      .then((res) => {
        const payload = res?.data;
        setData(payload?.data ?? []);
        setTotal(payload?.total ?? 0);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Error fetching comandas logísticas', err);
          setError('No se pudo cargar la información de logística.');
          setData([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [columnFilters, pagination, reloadFlag]);

  const handleReload = useCallback(() => {
    setReloadFlag((prev) => prev + 1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setColumnFilters([]);
    setPagination({ pageIndex: 0, pageSize: PAGE_SIZE });
    setRowSelection({});
    setReloadFlag((prev) => prev + 1);
  }, []);

  const selectedRows = table.getSelectedRowModel().flatRows;
  const hasSelection = selectedRows.length > 0;

  const ensureOptionVisible = useCallback((options, value) => {
    if (!value || !value._id) return options;
    const exists = options.some((opt) => opt?._id === value._id);
    return exists ? options : [...options, value];
  }, []);

  const clienteFilterValue = table.getColumn('cliente')?.getFilterValue() ?? null;
  const productoFilterValue = table.getColumn('producto')?.getFilterValue() ?? null;
  const rutaFilterValue = table.getColumn('ruta')?.getFilterValue() ?? null;
  const camioneroFilterValue = table.getColumn('camionero')?.getFilterValue() ?? null;
  const usuarioFilterValue = table.getColumn('usuario')?.getFilterValue() ?? null;
  const estadoFilterValue = table.getColumn('estado')?.getFilterValue() ?? null;
  const puntoDistribucionValue = table.getColumn('puntoDistribucion')?.getFilterValue() ?? '';
  const fechaFilterValue = table.getColumn('fecha')?.getFilterValue() ?? [null, null];

  const mergedClienteFilterOptions = useMemo(
    () => ensureOptionVisible(clienteFilters.options, clienteFilterValue),
    [clienteFilterValue, clienteFilters.options, ensureOptionVisible],
  );
  const mergedProductoFilterOptions = useMemo(
    () => ensureOptionVisible(productoFilters.options, productoFilterValue),
    [ensureOptionVisible, productoFilterValue, productoFilters.options],
  );
  const mergedRutaFilterOptions = useMemo(
    () => ensureOptionVisible(rutaFilters.options, rutaFilterValue),
    [ensureOptionVisible, rutaFilterValue, rutaFilters.options],
  );
  const mergedCamioneroFilterOptions = useMemo(
    () => ensureOptionVisible(camioneroFilters.options, camioneroFilterValue),
    [camioneroFilterValue, camioneroFilters.options, ensureOptionVisible],
  );
  const mergedUsuarioFilterOptions = useMemo(
    () => ensureOptionVisible(usuarioFilters.options, usuarioFilterValue),
    [ensureOptionVisible, usuarioFilterValue, usuarioFilters.options],
  );

  const mergedCamioneroFormOptions = useMemo(
    () => ensureOptionVisible(camioneroForm.options, singleForm.camionero),
    [camioneroForm.options, ensureOptionVisible, singleForm.camionero],
  );
  const mergedUsuarioFormOptions = useMemo(
    () => ensureOptionVisible(usuarioForm.options, singleForm.usuario),
    [ensureOptionVisible, singleForm.usuario, usuarioForm.options],
  );
  const mergedBulkCamioneroOptions = useMemo(
    () => ensureOptionVisible(camioneroForm.options, bulkForm.camionero),
    [bulkForm.camionero, camioneroForm.options, ensureOptionVisible],
  );
  const mergedBulkUsuarioOptions = useMemo(
    () => ensureOptionVisible(usuarioForm.options, bulkForm.usuario),
    [bulkForm.usuario, ensureOptionVisible, usuarioForm.options],
  );

  const handleExportCsv = useCallback(() => {
    if (!data.length) {
      setError('No hay datos para exportar.');
      return;
    }
    const headers = [
      'Nro de comanda',
      'Cliente',
      'Producto',
      'Fecha',
      'Cantidad entregada',
      'Lista',
      'Precio unitario',
      'Total entregado',
      'Estado',
      'Ruta',
      'Camionero',
      'Punto de distribución',
      'Usuario',
    ];
    const rows = data.map((row) => {
      const cliente = row?.codcli?.razonsocial ?? '-';
      const producto = row?.items?.[0]?.codprod?.descripcion ?? '-';
      const cantidad = sumCantidadEntregada(row?.items);
      const lista = row?.items?.[0]?.lista?.lista ?? '-';
      const precio = row?.items?.[0]?.monto ?? 0;
      const totalRow = sumTotalEntregado(row?.items);
      const estado = row?.codestado?.estado ?? '-';
      const ruta = row?.codcli?.ruta?.ruta ?? '-';
      const camionero = row?.camionero
        ? `${row.camionero?.nombres ?? ''} ${row.camionero?.apellidos ?? ''}`.trim()
        : '-';
      const usuario = row?.usuario
        ? `${row.usuario?.nombres ?? ''} ${row.usuario?.apellidos ?? ''}`.trim()
        : '-';
      return [
        row?.nrodecomanda ?? '-',
        cliente,
        producto,
        formatDate(row?.fecha),
        cantidad,
        lista,
        formatCurrency(precio),
        formatCurrency(totalRow),
        estado,
        ruta,
        camionero || '-',
        row?.puntoDistribucion ?? '-',
        usuario || '-',
      ];
    });
    const csvContent = [
      headers.join(';'),
      ...rows.map((r) => r.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logistica_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setSuccess('Exportación CSV generada correctamente.');
  }, [data]);

  const handleExportPdf = useCallback(() => {
    if (!data.length) {
      setError('No hay datos para exportar.');
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Logística - Comandas activas', 14, 16);
    doc.setFontSize(10);

    const rows = data.map((row) => {
      const cliente = row?.codcli?.razonsocial ?? '-';
      const producto = row?.items?.[0]?.codprod?.descripcion ?? '-';
      const cantidad = sumCantidadEntregada(row?.items);
      const lista = row?.items?.[0]?.lista?.lista ?? '-';
      const precio = row?.items?.[0]?.monto ?? 0;
      const totalRow = sumTotalEntregado(row?.items);
      const estado = row?.codestado?.estado ?? '-';
      const ruta = row?.codcli?.ruta?.ruta ?? '-';
      const camionero = row?.camionero
        ? `${row.camionero?.nombres ?? ''} ${row.camionero?.apellidos ?? ''}`.trim()
        : '-';
      const usuario = row?.usuario
        ? `${row.usuario?.nombres ?? ''} ${row.usuario?.apellidos ?? ''}`.trim()
        : '-';
      return [
        row?.nrodecomanda ?? '-',
        cliente,
        producto,
        formatDate(row?.fecha),
        cantidad,
        lista,
        formatCurrency(precio),
        formatCurrency(totalRow),
        estado,
        ruta,
        camionero || '-',
        row?.puntoDistribucion ?? '-',
        usuario || '-',
      ];
    });

    autoTable(doc, {
      startY: 22,
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
        'Punto dist.',
        'Usuario',
      ]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [33, 150, 243] },
      theme: 'grid',
    });

    doc.save(`logistica_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`);
    setSuccess('Exportación PDF generada correctamente.');
  }, [data]);

  const applyLogisticsUpdate = useCallback(async (comandas, formValues) => {
    if (!comandas.length) return;
    const payload = {};
    if (formValues.estado?._id) payload.codestado = formValues.estado._id;
    if (formValues.camionero?._id) payload.camionero = formValues.camionero._id;
    if (formValues.usuario?._id) payload.usuario = formValues.usuario._id;
    if (typeof formValues.puntoDistribucion === 'string') {
      payload.puntoDistribucion = formValues.puntoDistribucion.trim();
    }
    if (!Object.keys(payload).length) {
      throw new Error('Debes seleccionar al menos un cambio para aplicar.');
    }
    const requests = comandas.map((comanda) => api.put(`/comandas/${comanda._id}`, payload));
    await Promise.all(requests);
  }, []);

  const isTransitionAllowed = useCallback((comanda, targetEstado) => {
    if (!targetEstado || !targetEstado.estado) return true;
    const estadoDestino = (targetEstado.estado || '').toLowerCase();
    const estadoActual = (comanda?.codestado?.estado || '').toLowerCase();
    if (estadoDestino === 'lista para carga' && estadoActual === 'a preparar') {
      return false;
    }
    return true;
  }, []);

  const handleLogisticsSubmit = useCallback(async () => {
    if (!logisticsDialog.comanda) return;
    try {
      if (singleForm.estado && !isTransitionAllowed(logisticsDialog.comanda, singleForm.estado)) {
        setError('La comanda seleccionada no puede pasar a "Lista para carga" desde "A preparar".');
        return;
      }
      setActionLoading(true);
      await applyLogisticsUpdate([logisticsDialog.comanda], singleForm);
      setSuccess('Comanda actualizada correctamente.');
      closeLogisticsDialog();
      handleReload();
    } catch (err) {
      console.error('Error actualizando comanda', err);
      setError(err?.message ?? 'No se pudo actualizar la comanda seleccionada.');
    } finally {
      setActionLoading(false);
    }
  }, [
    applyLogisticsUpdate,
    closeLogisticsDialog,
    handleReload,
    isTransitionAllowed,
    logisticsDialog.comanda,
    singleForm,
  ]);

  const handleDelete = useCallback(async () => {
    if (!deleteDialog.comanda) return;
    try {
      setActionLoading(true);
      await api.delete(`/comandas/${deleteDialog.comanda._id}`);
      setSuccess('Comanda eliminada correctamente.');
      closeDeleteDialog();
      handleReload();
    } catch (err) {
      console.error('Error eliminando comanda', err);
      setError('No se pudo eliminar la comanda.');
    } finally {
      setActionLoading(false);
    }
  }, [closeDeleteDialog, deleteDialog.comanda, handleReload]);

  const handleBulkSubmit = useCallback(async () => {
    if (!selectedRows.length) return;
    try {
      if (bulkForm.estado) {
        const incompatibles = selectedRows
          .map((row) => row.original)
          .filter((row) => !isTransitionAllowed(row, bulkForm.estado));
        if (incompatibles.length) {
          setError('Hay comandas con estado "A preparar" que no pueden pasar a "Lista para carga".');
          return;
        }
      }

      setActionLoading(true);
      await applyLogisticsUpdate(selectedRows.map((row) => row.original), bulkForm);
      setSuccess('Cambios aplicados a las comandas seleccionadas.');
      setRowSelection({});
      setBulkForm(defaultLogisticsForm);
      handleReload();
    } catch (err) {
      console.error('Error en acción masiva', err);
      setError(err?.message ?? 'No se pudieron aplicar los cambios masivos.');
    } finally {
      setActionLoading(false);
    }
  }, [
    applyLogisticsUpdate,
    bulkForm,
    handleReload,
    isTransitionAllowed,
    selectedRows,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / (pagination.pageSize || PAGE_SIZE)));

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Box display="flex" flexDirection="column" gap={3}>
        <Box>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            Logística
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona comandas activas con filtros avanzados, asignación de operarios y acciones en lote.
          </Typography>
        </Box>

        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Filtros avanzados
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Autocomplete
                size="small"
                options={mergedClienteFilterOptions}
                loading={clienteFilters.loading}
                inputValue={clienteFilters.inputValue}
                onInputChange={(_e, newInput) => clienteFilters.setInputValue(newInput)}
                value={clienteFilterValue || null}
                onChange={(_e, newValue) => setFilterValue('cliente', newValue)}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                getOptionLabel={(option) => option?.razonsocial ?? ''}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cliente"
                    placeholder="Buscar cliente"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {clienteFilters.loading ? <CircularProgress size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                size="small"
                options={mergedProductoFilterOptions}
                loading={productoFilters.loading}
                inputValue={productoFilters.inputValue}
                onInputChange={(_e, newInput) => productoFilters.setInputValue(newInput)}
                value={productoFilterValue || null}
                onChange={(_e, newValue) => setFilterValue('producto', newValue)}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                getOptionLabel={(option) => option?.descripcion ?? ''}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Producto"
                    placeholder="Buscar producto"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {productoFilters.loading ? <CircularProgress size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                size="small"
                options={mergedRutaFilterOptions}
                loading={rutaFilters.loading}
                inputValue={rutaFilters.inputValue}
                onInputChange={(_e, newInput) => rutaFilters.setInputValue(newInput)}
                value={rutaFilterValue || null}
                onChange={(_e, newValue) => setFilterValue('ruta', newValue)}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                getOptionLabel={(option) => option?.ruta ?? ''}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Ruta"
                    placeholder="Buscar ruta"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {rutaFilters.loading ? <CircularProgress size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                size="small"
                options={estados}
                value={estadoFilterValue || null}
                onChange={(_e, newValue) => setFilterValue('estado', newValue)}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                getOptionLabel={(option) => option?.estado ?? ''}
                renderInput={(params) => <TextField {...params} label="Estado" placeholder="Seleccionar estado" />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                size="small"
                options={mergedCamioneroFilterOptions}
                loading={camioneroFilters.loading}
                inputValue={camioneroFilters.inputValue}
                onInputChange={(_e, newInput) => camioneroFilters.setInputValue(newInput)}
                value={camioneroFilterValue || null}
                onChange={(_e, newValue) => setFilterValue('camionero', newValue)}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                getOptionLabel={(option) => `${option?.nombres ?? ''} ${option?.apellidos ?? ''}`.trim()}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Camionero"
                    placeholder="Buscar chofer"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {camioneroFilters.loading ? <CircularProgress size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                size="small"
                options={mergedUsuarioFilterOptions}
                loading={usuarioFilters.loading}
                inputValue={usuarioFilters.inputValue}
                onInputChange={(_e, newInput) => usuarioFilters.setInputValue(newInput)}
                value={usuarioFilterValue || null}
                onChange={(_e, newValue) => setFilterValue('usuario', newValue)}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                getOptionLabel={(option) => `${option?.nombres ?? ''} ${option?.apellidos ?? ''}`.trim()}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Usuario operador"
                    placeholder="Buscar usuario"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {usuarioFilters.loading ? <CircularProgress size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <DateRangePicker
                value={fechaFilterValue}
                onChange={(newValue) => setFilterValue('fecha', newValue)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
                localeText={{ start: 'Fecha desde', end: 'Fecha hasta' }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Punto de distribución"
                size="small"
                fullWidth
                value={puntoDistribucionValue || ''}
                onChange={(event) => setFilterValue('puntoDistribucion', event.target.value)}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="contained" color="primary" startIcon={<RefreshIcon />} onClick={handleReload}>
              Recargar
            </Button>
            <Button variant="outlined" color="secondary" startIcon={<ClearAllIcon />} onClick={handleResetFilters}>
              Limpiar filtros
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={1} sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2 }}>
            <Typography variant="h6">Comandas activas</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCsv}>
                Exportar CSV
              </Button>
              <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handleExportPdf}>
                Exportar PDF
              </Button>
            </Stack>
          </Stack>

          {loading && <LinearProgress sx={{ mb: 1 }} />}

          <TableContainer>
            <Table size="small">
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} sx={{ backgroundColor: 'grey.100' }}>
                    {headerGroup.headers.map((header) => (
                      <TableCell key={header.id} sx={{ fontWeight: 600 }}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} hover selected={row.getIsSelected()}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {!loading && table.getRowModel().rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 3 }}>
                        <WarningAmberIcon color="warning" />
                        <Typography variant="body2" color="text.secondary">
                          No se encontraron comandas con los filtros seleccionados.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Mostrando {Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)} de {total} comandas activas
            </Typography>
            <Pagination
              count={totalPages}
              page={pagination.pageIndex + 1}
              onChange={(_event, value) => setPagination((prev) => ({ ...prev, pageIndex: value - 1 }))}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Stack>
        </Paper>

        {hasSelection && (
          <Paper elevation={3} sx={{ p: 3, borderLeft: (theme) => `4px solid ${theme.palette.primary.main}` }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                <Typography variant="h6">Acciones masivas</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedRows.length} comandas seleccionadas
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Autocomplete
                    size="small"
                    options={estados}
                    value={bulkForm.estado}
                    onChange={(_e, newValue) => setBulkForm((prev) => ({ ...prev, estado: newValue }))}
                    isOptionEqualToValue={(option, value) => option?._id === value?._id}
                    getOptionLabel={(option) => option?.estado ?? ''}
                    renderInput={(params) => <TextField {...params} label="Nuevo estado" placeholder="Seleccionar" />}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Autocomplete
                    size="small"
                    options={mergedBulkCamioneroOptions}
                    loading={camioneroForm.loading}
                    inputValue={camioneroForm.inputValue}
                    onInputChange={(_e, newInput) => camioneroForm.setInputValue(newInput)}
                    value={bulkForm.camionero}
                    onChange={(_e, newValue) => setBulkForm((prev) => ({ ...prev, camionero: newValue }))}
                    isOptionEqualToValue={(option, value) => option?._id === value?._id}
                    getOptionLabel={(option) => `${option?.nombres ?? ''} ${option?.apellidos ?? ''}`.trim()}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Asignar camionero"
                        placeholder="Buscar"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {camioneroForm.loading ? <CircularProgress size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Autocomplete
                    size="small"
                    options={mergedBulkUsuarioOptions}
                    loading={usuarioForm.loading}
                    inputValue={usuarioForm.inputValue}
                    onInputChange={(_e, newInput) => usuarioForm.setInputValue(newInput)}
                    value={bulkForm.usuario}
                    onChange={(_e, newValue) => setBulkForm((prev) => ({ ...prev, usuario: newValue }))}
                    isOptionEqualToValue={(option, value) => option?._id === value?._id}
                    getOptionLabel={(option) => `${option?.nombres ?? ''} ${option?.apellidos ?? ''}`.trim()}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Asignar operario"
                        placeholder="Buscar"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {usuarioForm.loading ? <CircularProgress size={18} /> : null}
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
                    label="Punto de distribución"
                    size="small"
                    fullWidth
                    value={bulkForm.puntoDistribucion}
                    onChange={(event) => setBulkForm((prev) => ({ ...prev, puntoDistribucion: event.target.value }))}
                  />
                </Grid>
              </Grid>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Resumen de comandas seleccionadas:
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {selectedRows.map((row) => (
                    <Paper
                      key={row.id}
                      variant="outlined"
                      sx={{ p: 1, display: 'inline-flex', flexDirection: 'column', minWidth: 160 }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        #{row.original?.nrodecomanda}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.original?.codcli?.razonsocial ?? '-'}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleBulkSubmit}
                  disabled={actionLoading}
                >
                  Aplicar a seleccionadas
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => setRowSelection({})}
                  disabled={actionLoading}
                >
                  Cancelar selección
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}

        <Dialog open={logisticsDialog.open} onClose={closeLogisticsDialog} fullWidth maxWidth="md">
          <DialogTitle>Acciones de logística</DialogTitle>
          <DialogContent dividers>
            <Typography variant="subtitle1" gutterBottom>
              Comanda #{logisticsDialog.comanda?.nrodecomanda} — {logisticsDialog.comanda?.codcli?.razonsocial}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Selecciona el nuevo estado logístico, asigna el operario y define el punto de distribución.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  size="small"
                  options={estados}
                  value={singleForm.estado}
                  onChange={(_e, newValue) => setSingleForm((prev) => ({ ...prev, estado: newValue }))}
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  getOptionLabel={(option) => option?.estado ?? ''}
                  renderInput={(params) => <TextField {...params} label="Estado" placeholder="Seleccionar" />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  size="small"
                  options={mergedCamioneroFormOptions}
                  loading={camioneroForm.loading}
                  inputValue={camioneroForm.inputValue}
                  onInputChange={(_e, newInput) => camioneroForm.setInputValue(newInput)}
                  value={singleForm.camionero}
                  onChange={(_e, newValue) => setSingleForm((prev) => ({ ...prev, camionero: newValue }))}
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  getOptionLabel={(option) => `${option?.nombres ?? ''} ${option?.apellidos ?? ''}`.trim()}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Camionero asignado"
                      placeholder="Buscar"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {camioneroForm.loading ? <CircularProgress size={18} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  size="small"
                  options={mergedUsuarioFormOptions}
                  loading={usuarioForm.loading}
                  inputValue={usuarioForm.inputValue}
                  onInputChange={(_e, newInput) => usuarioForm.setInputValue(newInput)}
                  value={singleForm.usuario}
                  onChange={(_e, newValue) => setSingleForm((prev) => ({ ...prev, usuario: newValue }))}
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  getOptionLabel={(option) => `${option?.nombres ?? ''} ${option?.apellidos ?? ''}`.trim()}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Operario logístico"
                      placeholder="Buscar"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {usuarioForm.loading ? <CircularProgress size={18} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Punto de distribución"
                  fullWidth
                  value={singleForm.puntoDistribucion}
                  onChange={(event) => setSingleForm((prev) => ({ ...prev, puntoDistribucion: event.target.value }))}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Resumen antes de guardar
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                Estado nuevo: {singleForm.estado?.estado ?? 'Sin cambios'}
              </Typography>
              <Typography variant="body2">
                Camionero asignado: {singleForm.camionero ? `${singleForm.camionero.nombres ?? ''} ${singleForm.camionero.apellidos ?? ''}`.trim() : 'Sin cambios'}
              </Typography>
              <Typography variant="body2">
                Operario logístico: {singleForm.usuario ? `${singleForm.usuario.nombres ?? ''} ${singleForm.usuario.apellidos ?? ''}`.trim() : 'Sin cambios'}
              </Typography>
              <Typography variant="body2">
                Punto de distribución: {singleForm.puntoDistribucion || 'Sin cambios'}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeLogisticsDialog} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button onClick={handleLogisticsSubmit} variant="contained" disabled={actionLoading}>
              Guardar cambios
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteDialog.open} onClose={closeDeleteDialog}>
          <DialogTitle>Eliminar comanda</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Esta acción desactivará la comanda seleccionada. ¿Deseas continuar?
            </DialogContentText>
            <Stack spacing={1}>
              <Typography variant="body2">
                Cliente: {deleteDialog.comanda?.codcli?.razonsocial ?? '-'}
              </Typography>
              <Typography variant="body2">
                Producto: {deleteDialog.comanda?.items?.[0]?.codprod?.descripcion ?? '-'}
              </Typography>
              <Typography variant="body2">
                Fecha: {formatDate(deleteDialog.comanda?.fecha)}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteDialog} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button onClick={handleDelete} color="error" variant="contained" disabled={actionLoading}>
              Eliminar
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(success)}
          autoHideDuration={4000}
          onClose={() => setSuccess('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="success" variant="filled" onClose={() => setSuccess('')}>
            {success}
          </Alert>
        </Snackbar>
        <Snackbar
          open={Boolean(error)}
          autoHideDuration={5000}
          onClose={() => setError('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="error" variant="filled" onClose={() => setError('')}>
            {error}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}

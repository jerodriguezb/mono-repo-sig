import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  Dialog,
} from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Refresh as RefreshIcon,
  CleaningServices as CleaningServicesIcon,
  LocalShipping as LocalShippingIcon,
  DeleteOutline as DeleteOutlineIcon,
} from '@mui/icons-material';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import dayjs from 'dayjs';
import api from '../api/axios';
import LogisticsItemsDialog from '../components/LogisticsItemsDialog';
import LogisticsAssignmentDialog from '../components/LogisticsAssignmentDialog';

const columnHelper = createColumnHelper();
const pageSize = 20;

const numberFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

const camioneroLabel = (usuario) => {
  if (!usuario) return '';
  const nombres = usuario?.nombres ?? '';
  const apellidos = usuario?.apellidos ?? '';
  const full = `${nombres} ${apellidos}`.trim();
  return full || usuario?.email || 'Camionero sin nombre';
};

const usuarioLabel = (usuario) => {
  if (!usuario) return '';
  const nombres = usuario?.nombres ?? '';
  const apellidos = usuario?.apellidos ?? '';
  const full = `${nombres} ${apellidos}`.trim();
  return full || usuario?.email || 'Usuario sin nombre';
};

const getFirstItem = (row) => (Array.isArray(row?.items) ? row.items[0] : null);

const getCantidadEntregada = (row) => {
  if (!Array.isArray(row?.items)) return 0;
  return row.items.reduce((sum, item) => sum + Number(item?.cantidadentregada ?? item?.cantidad ?? 0), 0);
};

const getTotalEntregado = (row) => {
  if (!Array.isArray(row?.items)) return 0;
  return row.items.reduce(
    (sum, item) => sum + Number(item?.cantidadentregada ?? item?.cantidad ?? 0) * Number(item?.monto ?? 0),
    0,
  );
};

const getRutaNombre = (row) => {
  return (
    row?.codcli?.ruta?.ruta ??
    row?.codcli?.localidad?.ruta?.ruta ??
    row?.camion?.ruta?.ruta ??
    ''
  );
};

function useAsyncLookup(endpoint, minLength = 3) {
  const cacheRef = useRef(new Map());
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [noOptionsText, setNoOptionsText] = useState(
    minLength > 0 ? `Escribí al menos ${minLength} caracteres…` : 'Sin resultados',
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  useEffect(() => {
    const term = inputValue.trim();
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();

      if (!term || term.length < minLength) {
        setOptions([]);
        setLoading(false);
        setNoOptionsText(
          minLength > 0 ? `Escribí al menos ${minLength} caracteres…` : 'Sin resultados',
        );
        return;
      }

      if (cacheRef.current.has(term)) {
        setOptions(cacheRef.current.get(term));
        setLoading(false);
        setNoOptionsText('Sin resultados');
        return;
      }

      setLoading(true);
      setNoOptionsText('Buscando…');
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { data } = await api.get(endpoint, {
          params: { term },
          signal: controller.signal,
        });
        const list = data?.clientes || data?.producservs || data?.rutas || data?.usuarios || [];
        cacheRef.current.set(term, list);
        setOptions(list);
        setNoOptionsText('Sin resultados');
      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('Error en búsqueda asincrónica', err);
        }
        setNoOptionsText('Error al buscar');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [endpoint, inputValue, minLength]);

  return {
    options,
    loading,
    inputValue,
    setInputValue,
    noOptionsText,
  };
}

export default function LogisticsPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [filterValues, setFilterValues] = useState({
    cliente: null,
    producto: null,
    ruta: null,
    camionero: null,
    estado: null,
    fechaDesde: '',
    fechaHasta: '',
    puntoDistribucion: '',
  });

  const [estados, setEstados] = useState([]);
  const [puntosDistribucion, setPuntosDistribucion] = useState([]);

  const [itemsDialog, setItemsDialog] = useState({ open: false, comanda: null });
  const [assignmentDialog, setAssignmentDialog] = useState({ open: false, comandas: [], loading: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, comanda: null, loading: false });

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const {
    options: clienteOptions,
    loading: clienteLoading,
    inputValue: clienteInput,
    setInputValue: setClienteInput,
    noOptionsText: clienteNoOpts,
  } = useAsyncLookup('/clientes/autocomplete', 3);

  const {
    options: productoOptions,
    loading: productoLoading,
    inputValue: productoInput,
    setInputValue: setProductoInput,
    noOptionsText: productoNoOpts,
  } = useAsyncLookup('/producservs/lookup', 3);

  const {
    options: rutaOptions,
    loading: rutaLoading,
    inputValue: rutaInput,
    setInputValue: setRutaInput,
    noOptionsText: rutaNoOpts,
  } = useAsyncLookup('/rutas/lookup', 2);

  const {
    options: camioneroOptions,
    loading: camioneroLoading,
    inputValue: camioneroInput,
    setInputValue: setCamioneroInput,
    noOptionsText: camioneroNoOpts,
  } = useAsyncLookup('/usuarios/camioneros', 2);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [{ data: estadosData }, { data: camionesData }] = await Promise.all([
          api.get('/estados'),
          api.get('/camiones'),
        ]);
        setEstados(estadosData?.estados || []);
        const puntos = (camionesData?.camiones || [])
          .map((camion) => camion?.camion)
          .filter(Boolean);
        setPuntosDistribucion(Array.from(new Set(puntos)));
      } catch (err) {
        console.error('Error cargando datos auxiliares', err);
      }
    };
    fetchMeta();
  }, []);

  const upsertFilter = useCallback((id, value) => {
    setColumnFilters((prev) => {
      const next = prev.filter((filter) => filter.id !== id);
      if (value !== null && value !== '' && !(typeof value === 'object' && Object.keys(value).length === 0)) {
        next.push({ id, value });
      }
      return next;
    });
  }, []);

  const handleFilterChange = useCallback((id, value) => {
    setFilterValues((prev) => ({ ...prev, [id]: value }));
    upsertFilter(id, value);
  }, [upsertFilter]);

  const handleDateChange = useCallback((field, value) => {
    setFilterValues((prev) => {
      const next = { ...prev, [field]: value };
      const payload = { fechaDesde: field === 'fechaDesde' ? value : prev.fechaDesde, fechaHasta: field === 'fechaHasta' ? value : prev.fechaHasta };
      if (!payload.fechaDesde && !payload.fechaHasta) {
        upsertFilter('fecha', null);
      } else {
        upsertFilter('fecha', payload);
      }
      return next;
    });
  }, [upsertFilter]);

  useEffect(() => {
    setPage(1);
  }, [columnFilters]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const params = { page, limit: pageSize };
        columnFilters.forEach((filter) => {
          switch (filter.id) {
            case 'cliente':
              params.cliente = filter.value?._id ?? filter.value?.value ?? filter.value ?? undefined;
              break;
            case 'producto':
              params.producto = filter.value?._id ?? filter.value?.value ?? filter.value ?? undefined;
              break;
            case 'ruta':
              params.ruta = filter.value?._id ?? filter.value?.value ?? filter.value ?? undefined;
              break;
            case 'camionero':
              params.camionero = filter.value?._id ?? filter.value?.value ?? filter.value ?? undefined;
              break;
            case 'estado':
              params.estado = filter.value?._id ?? filter.value?.value ?? filter.value ?? undefined;
              break;
            case 'fecha': {
              if (filter.value?.fechaDesde) params.fechaDesde = filter.value.fechaDesde;
              if (filter.value?.fechaHasta) params.fechaHasta = filter.value.fechaHasta;
              break;
            }
            case 'puntoDistribucion':
              params.puntoDistribucion = filter.value;
              break;
            default:
              break;
          }
        });
        const { data: response } = await api.get('/comandas/logistica', { params });
        setData(response?.data || []);
        setTotal(response?.total || 0);
      } catch (err) {
        console.error('Error obteniendo comandas', err);
        setError('No se pudieron cargar las comandas activas.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [page, columnFilters, refreshKey]);

  const columns = useMemo(() => [
      {
        id: 'select',
        header: ({ table: tbl }) => (
          <Checkbox
            size="small"
            indeterminate={tbl.getIsSomePageRowsSelected()}
            checked={tbl.getIsAllPageRowsSelected()}
            onChange={tbl.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            size="small"
            disabled={!row.getCanSelect()}
            checked={row.getIsSelected()}
            indeterminate={row.getIsSomeSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableColumnFilter: false,
        size: 48,
        meta: { label: 'Seleccionar' },
      },
      columnHelper.accessor((row) => row?.nrodecomanda ?? row?.nrocomanda ?? '—', {
        id: 'nrocomanda',
        header: 'N° comanda',
        enableSorting: false,
        cell: (info) => info.getValue() ?? '—',
        meta: { label: 'N° comanda' },
      }),
      columnHelper.accessor((row) => row?.codcli?.razonsocial ?? '—', {
        id: 'cliente',
        header: 'Cliente',
        cell: (info) => info.getValue(),
        meta: { label: 'Cliente' },
      }),
      columnHelper.accessor((row) => getFirstItem(row)?.codprod?.descripcion ?? '—', {
        id: 'producto',
        header: 'Producto',
        cell: ({ row, getValue }) => {
          const hasItems = Array.isArray(row?.original?.items) && row.original.items.length > 0;
          const label = getValue();
          return (
            <Button
              size="small"
              variant="text"
              onClick={() => setItemsDialog({ open: true, comanda: row.original })}
              disabled={!hasItems}
            >
              {label || 'Ver ítems'}
            </Button>
          );
        },
        meta: { label: 'Producto' },
      }),
      columnHelper.accessor((row) => row?.fecha, {
        id: 'fecha',
        header: 'Fecha',
        cell: (info) => (info.getValue() ? dayjs(info.getValue()).format('DD/MM/YYYY') : '—'),
        meta: { label: 'Fecha' },
      }),
      columnHelper.accessor((row) => getCantidadEntregada(row), {
        id: 'cantidadEntregada',
        header: 'Cant. entregada',
        cell: (info) => numberFormatter.format(info.getValue() || 0),
        meta: { label: 'Cantidad entregada' },
      }),
      columnHelper.accessor((row) => getFirstItem(row)?.lista?.lista ?? '—', {
        id: 'lista',
        header: 'Lista',
        cell: (info) => info.getValue(),
        meta: { label: 'Lista' },
      }),
      columnHelper.accessor((row) => Number(getFirstItem(row)?.monto ?? 0), {
        id: 'precioUnitario',
        header: 'Precio unitario',
        cell: (info) => currencyFormatter.format(info.getValue() || 0),
        meta: { label: 'Precio unitario' },
      }),
      columnHelper.accessor((row) => getTotalEntregado(row), {
        id: 'totalEntregado',
        header: 'Total entregado',
        cell: (info) => currencyFormatter.format(info.getValue() || 0),
        meta: { label: 'Total entregado' },
      }),
      columnHelper.accessor((row) => row?.codestado?.estado ?? '—', {
        id: 'estado',
        header: 'Estado',
        cell: (info) => info.getValue(),
        meta: { label: 'Estado' },
      }),
      columnHelper.accessor((row) => getRutaNombre(row) || '—', {
        id: 'ruta',
        header: 'Ruta',
        cell: (info) => info.getValue(),
        meta: { label: 'Ruta' },
      }),
      columnHelper.accessor((row) => row?.camionero ?? row?.usuarioAsignado ?? null, {
        id: 'camionero',
        header: 'Camionero',
        cell: (info) => camioneroLabel(info.getValue()) || '—',
        meta: { label: 'Camionero' },
      }),
      columnHelper.accessor((row) => row?.puntoDistribucion ?? '', {
        id: 'puntoDistribucion',
        header: 'Punto distribución',
        cell: (info) => info.getValue() || '—',
        meta: { label: 'Punto distribución' },
      }),
      columnHelper.accessor((row) => row?.usuario ?? null, {
        id: 'usuario',
        header: 'Usuario',
        cell: (info) => usuarioLabel(info.getValue()) || '—',
        meta: { label: 'Usuario' },
      }),
      columnHelper.display({
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => (
          <Stack direction="row" spacing={1} justifyContent="center">
            <Tooltip title="Gestionar logística">
              <IconButton
                size="small"
                color="primary"
                onClick={() => setAssignmentDialog({ open: true, comandas: [row.original], loading: false })}
              >
                <LocalShippingIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar comanda">
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteDialog({ open: true, comanda: row.original, loading: false })}
              >
                <DeleteOutlineIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        meta: { label: 'Acciones' },
      }),
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      columnFilters,
    },
    manualPagination: true,
    manualFiltering: true,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getRowId: (row) => row?._id ?? `${row?.nrodecomanda}-${row?.fecha}`,
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);

  const handleReload = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleClearFilters = () => {
    setFilterValues({
      cliente: null,
      producto: null,
      ruta: null,
      camionero: null,
      estado: null,
      fechaDesde: '',
      fechaHasta: '',
      puntoDistribucion: '',
    });
    setColumnFilters([]);
    setClienteInput('');
    setProductoInput('');
    setRutaInput('');
    setCamioneroInput('');
    setPage(1);
  };

  const buildExportRows = useCallback(() => {
    return data.map((row) => ({
      nrocomanda: row?.nrodecomanda ?? row?.nrocomanda ?? '',
      cliente: row?.codcli?.razonsocial ?? '',
      producto: getFirstItem(row)?.codprod?.descripcion ?? '',
      fecha: row?.fecha ? dayjs(row.fecha).format('DD/MM/YYYY') : '',
      cantidadEntregada: getCantidadEntregada(row),
      lista: getFirstItem(row)?.lista?.lista ?? '',
      precioUnitario: Number(getFirstItem(row)?.monto ?? 0),
      totalEntregado: getTotalEntregado(row),
      estado: row?.codestado?.estado ?? '',
      ruta: getRutaNombre(row) ?? '',
      camionero: camioneroLabel(row?.camionero ?? row?.usuarioAsignado),
      puntoDistribucion: row?.puntoDistribucion ?? '',
      usuario: usuarioLabel(row?.usuario),
    }));
  }, [data]);

  const handleExportCSV = () => {
    const rows = buildExportRows();
    const headers = [
      'N° Comanda',
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
      'Punto distribución',
      'Usuario',
    ];
    const csvRows = rows.map((row) => [
      row.nrocomanda,
      row.cliente,
      row.producto,
      row.fecha,
      numberFormatter.format(row.cantidadEntregada),
      row.lista,
      currencyFormatter.format(row.precioUnitario),
      currencyFormatter.format(row.totalEntregado),
      row.estado,
      row.ruta,
      row.camionero,
      row.puntoDistribucion,
      row.usuario,
    ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'));

    const csvContent = [headers.join(';'), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logistica-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const rows = buildExportRows();
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF('l', 'pt', 'a4');
    doc.setFontSize(12);
    doc.text('Logística — Comandas activas', 40, 40);
    autoTable(doc, {
      startY: 60,
      head: [[
        'N° Comanda',
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
        'Punto distribución',
        'Usuario',
      ]],
      body: rows.map((row) => [
        row.nrocomanda,
        row.cliente,
        row.producto,
        row.fecha,
        numberFormatter.format(row.cantidadEntregada),
        row.lista,
        currencyFormatter.format(row.precioUnitario),
        currencyFormatter.format(row.totalEntregado),
        row.estado,
        row.ruta,
        row.camionero,
        row.puntoDistribucion,
        row.usuario,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [63, 81, 181] },
    });
    doc.save(`logistica-${dayjs().format('YYYYMMDD-HHmmss')}.pdf`);
  };

  const handleAssignmentSubmit = async ({ estadoId, camioneroId, puntoDistribucion }) => {
    setAssignmentDialog((prev) => ({ ...prev, loading: true }));
    const ids = assignmentDialog.comandas.map((comanda) => comanda._id);
    try {
      if (ids.length > 1) {
        await api.put('/comandas/logistica/bulk', {
          ids,
          codestado: estadoId || undefined,
          camionero: camioneroId || undefined,
          puntoDistribucion: puntoDistribucion ?? undefined,
        });
      } else if (ids.length === 1) {
        await api.put(`/comandas/${ids[0]}`, {
          ...(estadoId ? { codestado: estadoId } : {}),
          ...(camioneroId ? { camionero: camioneroId, usuarioAsignado: camioneroId } : {}),
          ...(puntoDistribucion !== undefined ? { puntoDistribucion } : {}),
        });
      }
      setSnackbar({ open: true, message: 'Cambios guardados correctamente.', severity: 'success' });
      setAssignmentDialog({ open: false, comandas: [], loading: false });
      setRowSelection({});
      handleReload();
    } catch (err) {
      console.error('Error actualizando logística', err);
      setAssignmentDialog((prev) => ({ ...prev, loading: false }));
      setSnackbar({ open: true, message: 'No se pudieron guardar los cambios.', severity: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.comanda?._id) return;
    setDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      await api.delete(`/comandas/${deleteDialog.comanda._id}`);
      setSnackbar({ open: true, message: 'Comanda eliminada correctamente.', severity: 'success' });
      setDeleteDialog({ open: false, comanda: null, loading: false });
      handleReload();
    } catch (err) {
      console.error('Error eliminando comanda', err);
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
      setSnackbar({ open: true, message: 'No se pudo eliminar la comanda.', severity: 'error' });
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Logística
        </Typography>

        <Paper elevation={1}>
          <Toolbar sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button startIcon={<DownloadIcon />} variant="outlined" onClick={handleExportCSV}>
              Exportar CSV
            </Button>
            <Button startIcon={<PictureAsPdfIcon />} variant="outlined" onClick={handleExportPDF}>
              Exportar PDF
            </Button>
            <Tooltip title="Recargar">
              <IconButton color="primary" onClick={handleReload}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Limpiar filtros">
              <IconButton color="secondary" onClick={handleClearFilters}>
                <CleaningServicesIcon />
              </IconButton>
            </Tooltip>
            <Box sx={{ flexGrow: 1 }} />
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <Autocomplete
                size="small"
                sx={{ width: 240 }}
                options={clienteOptions}
                value={filterValues.cliente}
                loading={clienteLoading}
                onChange={(_, value) => handleFilterChange('cliente', value)}
                inputValue={clienteInput}
                onInputChange={(_, value) => setClienteInput(value)}
                getOptionLabel={(option) => option?.razonsocial ?? ''}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                noOptionsText={clienteNoOpts}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cliente"
                    placeholder="Buscar cliente"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {clienteLoading ? <CircularProgress color="inherit" size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <Autocomplete
                size="small"
                sx={{ width: 220 }}
                options={productoOptions}
                value={filterValues.producto}
                loading={productoLoading}
                onChange={(_, value) => handleFilterChange('producto', value)}
                inputValue={productoInput}
                onInputChange={(_, value) => setProductoInput(value)}
                getOptionLabel={(option) => option?.descripcion ?? option?.codprod ?? ''}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                noOptionsText={productoNoOpts}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Producto"
                    placeholder="Buscar producto"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {productoLoading ? <CircularProgress color="inherit" size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <Autocomplete
                size="small"
                sx={{ width: 200 }}
                options={rutaOptions}
                value={filterValues.ruta}
                loading={rutaLoading}
                onChange={(_, value) => handleFilterChange('ruta', value)}
                inputValue={rutaInput}
                onInputChange={(_, value) => setRutaInput(value)}
                getOptionLabel={(option) => option?.ruta ?? ''}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                noOptionsText={rutaNoOpts}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Ruta"
                    placeholder="Buscar ruta"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {rutaLoading ? <CircularProgress color="inherit" size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <Autocomplete
                size="small"
                sx={{ width: 220 }}
                options={camioneroOptions}
                value={filterValues.camionero}
                loading={camioneroLoading}
                onChange={(_, value) => handleFilterChange('camionero', value)}
                inputValue={camioneroInput}
                onInputChange={(_, value) => setCamioneroInput(value)}
                getOptionLabel={(option) => camioneroLabel(option)}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                noOptionsText={camioneroNoOpts}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Camionero"
                    placeholder="Buscar chofer"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {camioneroLoading ? <CircularProgress color="inherit" size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <TextField
                select
                size="small"
                label="Estado"
                sx={{ width: 200 }}
                value={filterValues.estado?._id ?? ''}
                onChange={(event) => {
                  const estadoSel = estados.find((estado) => estado._id === event.target.value) || null;
                  handleFilterChange('estado', estadoSel);
                }}
              >
                <MenuItem value="">Todos</MenuItem>
                {estados.map((estado) => (
                  <MenuItem key={estado._id} value={estado._id}>
                    {estado.estado}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="date"
                size="small"
                label="Fecha desde"
                InputLabelProps={{ shrink: true }}
                value={filterValues.fechaDesde}
                onChange={(event) => handleDateChange('fechaDesde', event.target.value)}
              />
              <TextField
                type="date"
                size="small"
                label="Fecha hasta"
                InputLabelProps={{ shrink: true }}
                value={filterValues.fechaHasta}
                onChange={(event) => handleDateChange('fechaHasta', event.target.value)}
              />
              <Autocomplete
                size="small"
                freeSolo
                options={puntosDistribucion}
                value={filterValues.puntoDistribucion}
                onChange={(_, value) => handleFilterChange('puntoDistribucion', value ?? '')}
                onInputChange={(_, value) => handleFilterChange('puntoDistribucion', value ?? '')}
                sx={{ width: 220 }}
                renderInput={(params) => <TextField {...params} label="Punto distribución" placeholder="Base" />}
              />
            </Stack>
          </Toolbar>

          {loading && <LinearProgress />}
          {error && (
            <Alert severity="error" sx={{ mx: 2, my: 1 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        style={{
                          position: 'sticky',
                          top: 0,
                          background: '#f5f5f5',
                          padding: '12px 16px',
                          textAlign: header.column.id === 'select' ? 'center' : 'left',
                          borderBottom: '1px solid #e0e0e0',
                          minWidth: header.getSize() ? `${header.getSize()}px` : undefined,
                        }}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid #eee',
                          textAlign:
                            ['cantidadEntregada', 'precioUnitario', 'totalEntregado'].includes(cell.column.id)
                              ? 'right'
                              : cell.column.id === 'select'
                                ? 'center'
                                : 'left',
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>

          <Divider sx={{ mt: 1 }} />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Total: {total} registros
            </Typography>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Stack>

          {selectedRows.length > 0 && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ px: 2, pb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {selectedRows.length} comandas seleccionadas
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<LocalShippingIcon />}
                onClick={() => setAssignmentDialog({ open: true, comandas: selectedRows, loading: false })}
              >
                Gestionar selección
              </Button>
            </Stack>
          )}
        </Paper>
      </Stack>

      <LogisticsItemsDialog
        open={itemsDialog.open}
        onClose={() => setItemsDialog({ open: false, comanda: null })}
        items={itemsDialog.comanda?.items}
        comanda={itemsDialog.comanda}
      />

      <LogisticsAssignmentDialog
        open={assignmentDialog.open}
        comandas={assignmentDialog.comandas}
        estados={estados}
        puntos={puntosDistribucion}
        loading={assignmentDialog.loading}
        onSubmit={handleAssignmentSubmit}
        onClose={() => setAssignmentDialog({ open: false, comandas: [], loading: false })}
      />

      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, comanda: null, loading: false })}
      >
        <Box sx={{ p: 3, minWidth: 320 }}>
          <Typography variant="h6" gutterBottom>
            ¿Eliminar comanda?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Se marcará como inactiva la comanda {deleteDialog.comanda?.nrodecomanda ?? '—'} del cliente
            {' '}
            <strong>{deleteDialog.comanda?.codcli?.razonsocial ?? 'Sin cliente'}</strong> del día
            {' '}
            {deleteDialog.comanda?.fecha ? dayjs(deleteDialog.comanda.fecha).format('DD/MM/YYYY') : '—'}.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              onClick={() => setDeleteDialog({ open: false, comanda: null, loading: false })}
              color="inherit"
              disabled={deleteDialog.loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disabled={deleteDialog.loading}
            >
              Eliminar
            </Button>
          </Stack>
        </Box>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

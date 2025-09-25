import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  LinearProgress,
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
  Toolbar,
  Tooltip,
  Typography,
  Autocomplete,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs from 'dayjs';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import api from '../../api/axios';
import LogisticsAssignmentDialog from './LogisticsAssignmentDialog';
import ItemsDialog from './ItemsDialog';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

const columnHelper = createColumnHelper();
const PAGE_SIZE = 20;

function sumCantidadEntregada(items = []) {
  return items.reduce((acc, item) => acc + Number(item?.cantidadentregada ?? 0), 0);
}

function sumTotalEntregado(items = []) {
  return items.reduce((acc, item) => {
    const cantidad = Number(item?.cantidadentregada ?? 0);
    const precio = Number(item?.monto ?? 0);
    return acc + cantidad * precio;
  }, 0);
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
}

function TextFilter({ column, placeholder }) {
  const value = column.getFilterValue() ?? '';
  return (
    <TextField
      size="small"
      value={value}
      onChange={(event) => {
        const newValue = event.target.value;
        const trimmed = newValue.trim();
        column.setFilterValue(trimmed ? trimmed : undefined);
      }}
      placeholder={placeholder}
      fullWidth
    />
  );
}

function DateRangeFilter({ column }) {
  const value = column.getFilterValue() ?? { from: '', to: '' };
  const { from = '', to = '' } = value;

  const handleChange = (key, newValue) => {
    column.setFilterValue((old = {}) => ({ ...old, [key]: newValue }));
  };

  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
      <TextField
        type="date"
        size="small"
        value={from}
        onChange={(event) => handleChange('from', event.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        type="date"
        size="small"
        value={to}
        onChange={(event) => handleChange('to', event.target.value)}
        InputLabelProps={{ shrink: true }}
      />
    </Stack>
  );
}

function AsyncFilterAutocomplete({ column, placeholder, loader, minChars = 3 }) {
  const value = column.getFilterValue() ?? null;
  const [options, setOptions] = useState(value ? [value] : []);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value && !options.find((opt) => opt?.id === value?.id)) {
      setOptions((prev) => [...prev, value]);
    }
  }, [value, options]);

  useEffect(() => {
    let active = true;
    const trimmed = inputValue.trim();
    if (trimmed.length < minChars) return () => { active = false; };

    (async () => {
      setLoading(true);
      try {
        const fetched = await loader(trimmed);
        if (active) setOptions(fetched);
      } catch (error) {
        console.error('Autocomplete fetch error', error);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [inputValue, loader, minChars]);

  return (
    <Autocomplete
      options={options}
      loading={loading}
      value={value}
      onChange={(_, newValue) => column.setFilterValue(newValue ?? undefined)}
      getOptionLabel={(option) => option?.label ?? ''}
      isOptionEqualToValue={(option, val) => option?.id === val?.id}
      filterOptions={(opts) => opts}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      inputValue={inputValue}
      onInputChange={(_, newInput) => setInputValue(newInput)}
      clearOnBlur={false}
    />
  );
}

export default function LogisticsTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [pageCount, setPageCount] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [columnFilters, setColumnFilters] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  const [estadoOptions, setEstadoOptions] = useState([]);

  const [itemsDialog, setItemsDialog] = useState({ open: false, comanda: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, comanda: null });
  const [logisticsDialog, setLogisticsDialog] = useState({ open: false, comandas: [] });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [actionLoading, setActionLoading] = useState(false);

  const buildQueryParams = useCallback(() => {
    const params = { page: pagination.pageIndex + 1, limit: PAGE_SIZE };
    columnFilters.forEach(({ id, value }) => {
      if (!value) return;
      switch (id) {
        case 'nrodecomanda':
          params.nrocomanda = value;
          break;
        case 'cliente':
          if (value?.id) params.cliente = value.id;
          break;
        case 'producto':
          if (value?.id) params.producto = value.id;
          break;
        case 'fecha':
          if (value?.from) params.fechaDesde = value.from;
          if (value?.to) params.fechaHasta = value.to;
          break;
        case 'ruta':
          if (value?.id) params.ruta = value.id;
          break;
        case 'camionero':
          if (value?.id) params.camionero = value.id;
          break;
        case 'estado':
          if (value?.id) params.estado = value.id;
          break;
        case 'puntoDistribucion':
          if (value) params.puntoDistribucion = value;
          break;
        case 'usuario':
          if (value?.id) params.usuario = value.id;
          break;
        case 'usuarioAsignado':
          if (value?.id) params.usuarioAsignado = value.id;
          break;
        default:
          break;
      }
    });
    return params;
  }, [columnFilters, pagination.pageIndex]);

  const loadComandas = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = buildQueryParams();
      const { data: response } = await api.get('/comandas/logistica', { params });
      if (!response?.ok) throw new Error('Respuesta inválida del servidor');
      setData(response.data || []);
      setPageCount(response.totalPages ?? 0);
      setTotalRows(response.total ?? 0);
    } catch (error) {
      console.error('Error cargando comandas', error);
      setFetchError('No pudimos obtener las comandas. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  useEffect(() => {
    loadComandas();
  }, [loadComandas, refreshKey]);

  useEffect(() => {
    (async () => {
      try {
        const { data: response } = await api.get('/estados', { params: { limite: 500 } });
        const options = (response?.estados ?? []).map((estado) => ({ id: estado._id, label: estado.estado }));
        setEstadoOptions(options);
      } catch (error) {
        console.error('Error cargando estados', error);
      }
    })();
  }, []);

  const fetchClientes = useCallback(async (term) => {
    const { data: response } = await api.get('/clientes/autocomplete', { params: { term } });
    return (response?.clientes ?? []).map((cliente) => ({ id: cliente._id, label: cliente.razonsocial }));
  }, []);

  const fetchProductos = useCallback(async (term) => {
    const { data: response } = await api.get('/producservs/lookup', { params: { q: term, limit: 20 } });
    return (response?.producservs ?? []).map((prod) => ({ id: prod._id, label: `${prod.descripcion}` }));
  }, []);

  const fetchRutas = useCallback(async (term) => {
    const { data: response } = await api.get('/rutas/autocomplete', { params: { term } });
    return (response?.rutas ?? []).map((ruta) => ({ id: ruta._id, label: ruta.ruta }));
  }, []);

  const fetchCamioneros = useCallback(async (term) => {
    const { data: response } = await api.get('/usuarios/autocomplete', { params: { term, role: 'USER_CAM' } });
    return (response?.usuarios ?? []).map((usuario) => ({
      id: usuario._id,
      label: `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim(),
    }));
  }, []);

  const fetchUsuarios = useCallback(async (term) => {
    const { data: response } = await api.get('/usuarios/autocomplete', { params: { term } });
    return (response?.usuarios ?? []).map((usuario) => ({
      id: usuario._id,
      label: `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim(),
    }));
  }, []);

  const handleOpenItems = useCallback((comanda) => {
    setItemsDialog({ open: true, comanda });
  }, []);

  const handleCloseItems = useCallback(() => {
    setItemsDialog({ open: false, comanda: null });
  }, []);

  const handleOpenDelete = useCallback((comanda) => {
    setDeleteDialog({ open: true, comanda });
  }, []);

  const handleCloseDelete = useCallback(() => {
    setDeleteDialog({ open: false, comanda: null });
  }, []);

  const handleOpenLogistics = useCallback((comandas) => {
    setLogisticsDialog({ open: true, comandas });
  }, []);

  const handleCloseLogistics = useCallback(() => {
    setLogisticsDialog({ open: false, comandas: [] });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteDialog?.comanda) return;
    setActionLoading(true);
    try {
      await api.delete(`/comandas/${deleteDialog.comanda._id}`);
      setSnackbar({ open: true, message: 'Comanda eliminada correctamente.', severity: 'success' });
      handleCloseDelete();
      setRowSelection({});
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error eliminando comanda', error);
      setSnackbar({ open: true, message: 'No se pudo eliminar la comanda.', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  }, [deleteDialog, handleCloseDelete]);

  const handleLogisticsSubmit = useCallback(async ({ estadoId, usuarioId, puntoDistribucion }) => {
    if (!logisticsDialog.comandas.length) return;
    setActionLoading(true);
    try {
      const payload = {
        codestado: estadoId,
        puntoDistribucion,
      };
      if (usuarioId) {
        payload.usuarioAsignado = usuarioId;
        payload.camionero = usuarioId;
      } else {
        payload.usuarioAsignado = null;
        payload.camionero = null;
      }
      await Promise.all(
        logisticsDialog.comandas.map((comanda) => api.put(`/comandas/${comanda._id}`, payload)),
      );
      setSnackbar({ open: true, message: 'Logística actualizada correctamente.', severity: 'success' });
      handleCloseLogistics();
      setRowSelection({});
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error actualizando logística', error);
      setSnackbar({ open: true, message: 'No se pudo actualizar la logística.', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  }, [handleCloseLogistics, logisticsDialog.comandas]);

  const table = useReactTable({
    data,
    columns: useMemo(() => {
      return [
        {
          id: 'select',
          header: ({ table: tbl }) => (
            <Checkbox
              indeterminate={tbl.getIsSomePageRowsSelected()}
              checked={tbl.getIsAllPageRowsSelected()}
              onChange={(event) => tbl.toggleAllPageRowsSelected(event.target.checked)}
              inputProps={{ 'aria-label': 'Seleccionar todas las comandas' }}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onChange={(event) => row.toggleSelected(event.target.checked)}
              inputProps={{ 'aria-label': `Seleccionar comanda ${row.original.nrodecomanda}` }}
            />
          ),
          enableSorting: false,
          enableColumnFilter: false,
          size: 48,
        },
        columnHelper.accessor('nrodecomanda', {
          header: 'Nro de comanda',
          cell: (info) => info.getValue(),
          meta: { filterComponent: (column) => <TextFilter column={column} placeholder="Buscar nro" /> },
        }),
        columnHelper.accessor((row) => row?.codcli?.razonsocial ?? '', {
          id: 'cliente',
          header: 'Cliente',
          cell: (info) => info.getValue(),
          meta: {
            filterComponent: (column) => (
              <AsyncFilterAutocomplete column={column} placeholder="Buscar cliente" loader={fetchClientes} />
            ),
          },
        }),
        columnHelper.accessor((row) => row?.items?.[0]?.codprod?.descripcion ?? '—', {
          id: 'producto',
          header: 'Producto',
          cell: ({ row }) => {
            const descripcion = row.original?.items?.[0]?.codprod?.descripcion ?? '—';
            return (
              <Button color="primary" size="small" onClick={() => handleOpenItems(row.original)}>
                {descripcion}
              </Button>
            );
          },
          meta: {
            filterComponent: (column) => (
              <AsyncFilterAutocomplete column={column} placeholder="Buscar producto" loader={fetchProductos} />
            ),
          },
        }),
        columnHelper.accessor('fecha', {
          header: 'Fecha',
          cell: (info) => (info.getValue() ? dayjs(info.getValue()).format('DD/MM/YYYY') : '—'),
          meta: { filterComponent: (column) => <DateRangeFilter column={column} /> },
        }),
        columnHelper.display({
          id: 'cantidadEntregada',
          header: 'Cant. entregada',
          cell: ({ row }) => sumCantidadEntregada(row.original.items).toLocaleString('es-AR'),
        }),
        columnHelper.accessor((row) => row?.items?.[0]?.lista?.lista ?? '—', {
          id: 'lista',
          header: 'Lista',
        }),
        columnHelper.accessor((row) => Number(row?.items?.[0]?.monto ?? 0), {
          id: 'precio',
          header: 'Precio unitario',
          cell: (info) => formatCurrency(info.getValue()),
        }),
        columnHelper.display({
          id: 'totalEntregado',
          header: 'Total entregado',
          cell: ({ row }) => formatCurrency(sumTotalEntregado(row.original.items)),
        }),
        columnHelper.accessor((row) => row?.codestado?.estado ?? 'Sin estado', {
          id: 'estado',
          header: 'Estado',
          meta: {
            filterComponent: (column) => (
              <Autocomplete
                options={estadoOptions}
                value={column.getFilterValue() ?? null}
                onChange={(_, newValue) => column.setFilterValue(newValue ?? undefined)}
                renderInput={(params) => <TextField {...params} size="small" placeholder="Filtrar estado" />}
                isOptionEqualToValue={(option, val) => option?.id === val?.id}
              />
            ),
          },
        }),
        columnHelper.accessor((row) => row?.codcli?.ruta?.ruta ?? 'Sin ruta', {
          id: 'ruta',
          header: 'Ruta',
          meta: {
            filterComponent: (column) => (
              <AsyncFilterAutocomplete column={column} placeholder="Buscar ruta" loader={fetchRutas} minChars={2} />
            ),
          },
        }),
        columnHelper.accessor((row) => row?.camionero, {
          id: 'camionero',
          header: 'Camionero',
          cell: (info) => {
            const camionero = info.getValue();
            if (!camionero) return '—';
            return `${camionero.nombres ?? ''} ${camionero.apellidos ?? ''}`.trim();
          },
          meta: {
            filterComponent: (column) => (
              <AsyncFilterAutocomplete column={column} placeholder="Buscar camionero" loader={fetchCamioneros} />
            ),
          },
        }),
        columnHelper.accessor((row) => row?.usuarioAsignado, {
          id: 'usuarioAsignado',
          header: 'Operario asignado',
          cell: (info) => {
            const usuarioAsignado = info.getValue();
            if (!usuarioAsignado) return '—';
            return `${usuarioAsignado.nombres ?? ''} ${usuarioAsignado.apellidos ?? ''}`.trim();
          },
          meta: {
            filterComponent: (column) => (
              <AsyncFilterAutocomplete column={column} placeholder="Buscar operario" loader={fetchCamioneros} />
            ),
          },
        }),
        columnHelper.accessor('puntoDistribucion', {
          header: 'Punto de distribución',
          meta: { filterComponent: (column) => <TextFilter column={column} placeholder="Filtrar punto" /> },
        }),
        columnHelper.accessor((row) => row?.usuario, {
          id: 'usuario',
          header: 'Usuario creador',
          cell: (info) => {
            const usuario = info.getValue();
            if (!usuario) return '—';
            return `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim();
          },
          meta: {
            filterComponent: (column) => (
              <AsyncFilterAutocomplete column={column} placeholder="Buscar usuario" loader={fetchUsuarios} />
            ),
          },
        }),
        columnHelper.display({
          id: 'acciones',
          header: 'Acciones',
          cell: ({ row }) => (
            <Stack direction="row" spacing={1}>
              <Tooltip title="Gestionar logística">
                <span>
                  <IconButton
                    color="primary"
                    size="small"
                    onClick={() => handleOpenLogistics([row.original])}
                    disabled={actionLoading}
                  >
                    <LocalShippingIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Eliminar comanda">
                <span>
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => handleOpenDelete(row.original)}
                    disabled={actionLoading}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          ),
          enableColumnFilter: false,
        }),
      ];
    }, [actionLoading, estadoOptions, fetchCamioneros, fetchClientes, fetchProductos, fetchRutas, fetchUsuarios, handleOpenDelete, handleOpenItems, handleOpenLogistics]),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
    state: {
      pagination,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getRowId: (row) => row?._id ?? `${row.nrodecomanda}`,
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);

  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  const handleClearFilters = () => {
    setColumnFilters([]);
    setPagination({ pageIndex: 0, pageSize: PAGE_SIZE });
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleExportCsv = () => {
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
      'Operario asignado',
      'Punto de distribución',
      'Usuario',
    ];

    const rows = data.map((comanda) => {
      const firstItem = comanda?.items?.[0];
      const cantidadEntregada = sumCantidadEntregada(comanda.items);
      const total = sumTotalEntregado(comanda.items);
      return [
        comanda?.nrodecomanda ?? '',
        comanda?.codcli?.razonsocial ?? '',
        firstItem?.codprod?.descripcion ?? '',
        comanda?.fecha ? dayjs(comanda.fecha).format('DD/MM/YYYY') : '',
        cantidadEntregada,
        firstItem?.lista?.lista ?? '',
        Number(firstItem?.monto ?? 0),
        total,
        comanda?.codestado?.estado ?? '',
        comanda?.codcli?.ruta?.ruta ?? '',
        comanda?.camionero ? `${comanda.camionero.nombres ?? ''} ${comanda.camionero.apellidos ?? ''}`.trim() : '',
        comanda?.usuarioAsignado
          ? `${comanda.usuarioAsignado.nombres ?? ''} ${comanda.usuarioAsignado.apellidos ?? ''}`.trim()
          : '',
        comanda?.puntoDistribucion ?? '',
        comanda?.usuario ? `${comanda.usuario.nombres ?? ''} ${comanda.usuario.apellidos ?? ''}`.trim() : '',
      ];
    });

    const csvRows = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([`\uFEFF${csvRows}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'logistica.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF('l', 'pt');
    doc.setFontSize(14);
    doc.text('Reporte de logística', 40, 40);
    const headers = [[
      'Nro de comanda',
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
      'Operario asignado',
      'Punto distribución',
      'Usuario',
    ]];
    const body = data.map((comanda) => {
      const firstItem = comanda?.items?.[0];
      return [
        comanda?.nrodecomanda ?? '',
        comanda?.codcli?.razonsocial ?? '',
        firstItem?.codprod?.descripcion ?? '',
        comanda?.fecha ? dayjs(comanda.fecha).format('DD/MM/YYYY') : '',
        sumCantidadEntregada(comanda.items),
        firstItem?.lista?.lista ?? '',
        formatCurrency(Number(firstItem?.monto ?? 0)),
        formatCurrency(sumTotalEntregado(comanda.items)),
        comanda?.codestado?.estado ?? '',
        comanda?.codcli?.ruta?.ruta ?? '',
        comanda?.camionero ? `${comanda.camionero.nombres ?? ''} ${comanda.camionero.apellidos ?? ''}`.trim() : '',
        comanda?.usuarioAsignado
          ? `${comanda.usuarioAsignado.nombres ?? ''} ${comanda.usuarioAsignado.apellidos ?? ''}`.trim()
          : '',
        comanda?.puntoDistribucion ?? '',
        comanda?.usuario ? `${comanda.usuario.nombres ?? ''} ${comanda.usuario.apellidos ?? ''}`.trim() : '',
      ];
    });

    autoTable(doc, {
      head: headers,
      body,
      startY: 60,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [33, 150, 243] },
    });
    doc.save('logistica.pdf');
  };

  return (
    <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCsv}>
            Exportar CSV
          </Button>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handleExportPdf}>
            Exportar PDF
          </Button>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<FilterAltOffIcon />} onClick={handleClearFilters}>
            Limpiar filtros
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={handleRefresh}>
            Recargar
          </Button>
        </Stack>
      </Toolbar>

      {loading && <LinearProgress />}
      {fetchError && <Alert severity="error">{fetchError}</Alert>}

      <TableContainer>
        <Table size="small">
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} sx={{ backgroundColor: 'grey.100' }}>
                {headerGroup.headers.map((header) => (
                  <TableCell key={header.id} sx={{ verticalAlign: 'top' }}>
                    {header.isPlaceholder ? null : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="subtitle2">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </Typography>
                        {header.column.columnDef.meta?.filterComponent
                          ? header.column.columnDef.meta.filterComponent(header.column)
                          : null}
                      </Box>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                hover
                selected={row.getIsSelected()}
                sx={{ '&.Mui-selected': { backgroundColor: 'action.hover' } }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {!table.getRowModel().rows.length && !loading && (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No hay comandas para mostrar con los filtros actuales.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={totalRows}
        page={pagination.pageIndex}
        onPageChange={(_, newPage) => setPagination((prev) => ({ ...prev, pageIndex: newPage }))}
        rowsPerPage={PAGE_SIZE}
        rowsPerPageOptions={[PAGE_SIZE]}
      />

      {selectedRows.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'grey.50' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1">
              {selectedRows.length} comanda(s) seleccionada(s)
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<LocalShippingIcon />}
                onClick={() => handleOpenLogistics(selectedRows)}
                disabled={actionLoading}
              >
                Gestionar logística seleccionadas
              </Button>
              <Button onClick={() => setRowSelection({})} disabled={actionLoading}>
                Limpiar selección
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <ItemsDialog open={itemsDialog.open} comanda={itemsDialog.comanda} onClose={handleCloseItems} />
      <DeleteConfirmationDialog
        open={deleteDialog.open}
        comanda={deleteDialog.comanda}
        onClose={handleCloseDelete}
        onConfirm={handleDelete}
        loading={actionLoading}
      />
      <LogisticsAssignmentDialog
        open={logisticsDialog.open}
        comandas={logisticsDialog.comandas}
        onClose={handleCloseLogistics}
        onSubmit={handleLogisticsSubmit}
        estadoOptions={estadoOptions}
        loadUsuarios={fetchCamioneros}
        loading={actionLoading}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

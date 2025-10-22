import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Grid,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import api from '../api/axios';

const columnHelper = createColumnHelper();

const quantityFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const normalizeText = (value) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const decodeJwtPayload = (token) => {
  if (!token) return null;
  try {
    const [, payload = ''] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const jsonPayload = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('No se pudo decodificar el token JWT', error);
    return null;
  }
};

const clampDelivered = (value, max) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  const sanitized = Math.max(numeric, 0);
  if (Number.isFinite(max)) {
    return Math.min(sanitized, max);
  }
  return sanitized;
};

const buildRowId = (comandaId, itemId, index) => {
  if (itemId) return `${comandaId}-${itemId}`;
  return `${comandaId}-item-${index}`;
};

export default function DistribucionPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTabletDown = useMediaQuery(theme.breakpoints.down('md'));
  const [authState, setAuthState] = useState({ checking: true, role: null, userId: null });
  const [estadoDistribucionId, setEstadoDistribucionId] = useState(null);
  const [rows, setRows] = useState([]);
  const [comandasById, setComandasById] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [editedRows, setEditedRows] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [massDialog, setMassDialog] = useState({ open: false, value: '', error: '' });
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [clienteSeleccionadoKey, setClienteSeleccionadoKey] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setAuthState({ checking: false, role: null, userId: null });
      return;
    }
    const cleanedToken = storedToken.replace(/^"|"$/g, '');
    const payload = decodeJwtPayload(cleanedToken);
    if (!payload?._id || !payload?.role) {
      setAuthState({ checking: false, role: null, userId: null });
      return;
    }
    setAuthState({ checking: false, role: payload.role, userId: payload._id });
  }, []);

  const transformComandas = useCallback((comandas = []) => {
    const result = [];
    comandas.forEach((comanda) => {
      const clienteNombre = comanda?.codcli?.razonsocial ?? '';
      const clienteId = comanda?.codcli?._id ? String(comanda.codcli._id) : null;
      const items = Array.isArray(comanda?.items) ? comanda.items : [];
      items.forEach((item, index) => {
        const itemId = item?._id ? String(item._id) : null;
        const rowId = buildRowId(comanda?._id ?? `comanda-${index}`, itemId, index);
        const cantidad = Number(item?.cantidad ?? 0);
        const monto = Number(item?.monto ?? 0);
        const cantidadEntregada = Number(item?.cantidadentregada ?? 0);
        const clienteKey =
          clienteId ??
          `${normalizeText(clienteNombre) || 'sin-cliente'}-${
            String(comanda?.codcli?.codigo ?? comanda?._id ?? index)
          }`;
        result.push({
          rowId,
          comandaId: comanda?._id ?? null,
          itemId: itemId ?? `item-${index}`,
          nrodecomanda: comanda?.nrodecomanda ?? '',
          clienteNombre,
          clienteId,
          clienteKey,
          productoDescripcion: item?.codprod?.descripcion ?? '',
          cantidad,
          monto,
          total: cantidad * monto,
          cantidadEntregada,
          cantidadEntregadaOriginal: cantidadEntregada,
          totalEntregado: cantidadEntregada * monto,
        });
      });
    });
    return result;
  }, []);

  const fetchEstadoDistribucion = useCallback(async () => {
    const { data } = await api.get('/estados');
    const estados = Array.isArray(data) ? data : data?.estados ?? [];
    const target = estados.find((estado) => normalizeText(estado?.estado ?? estado?.descripcion ?? '') === 'en distribucion');
    if (!target?._id) {
      throw new Error('No se encontró el estado "En distribución".');
    }
    return target._id;
  }, []);

  const fetchComandas = useCallback(async (estadoId, camioneroId) => {
    if (!estadoId || !camioneroId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/comandas', {
        params: { estado: estadoId, camionero: camioneroId },
      });
      const comandas = data?.comandas ?? [];
      const mapped = {};
      comandas.forEach((comanda) => {
        if (comanda?._id) mapped[comanda._id] = comanda;
      });
      setComandasById(mapped);
      setRows(transformComandas(comandas));
      setEditedRows({});
      setRowSelection({});
    } catch (requestError) {
      console.error('Error obteniendo comandas en distribución', requestError);
      const message =
        requestError?.response?.data?.err?.message ||
        requestError?.response?.data?.message ||
        'No se pudieron obtener las comandas en distribución.';
      setError(message);
      setRows([]);
      setEditedRows({});
    } finally {
      setLoading(false);
    }
  }, [transformComandas]);

  useEffect(() => {
    if (authState.checking) return;
    if (authState.role !== 'USER_CAM') return;

    let cancelled = false;
    const loadEstado = async () => {
      try {
        const estadoId = await fetchEstadoDistribucion();
        if (cancelled) return;
        setEstadoDistribucionId(estadoId);
      } catch (stateError) {
        console.error('Error obteniendo estados', stateError);
        if (cancelled) return;
        const message = stateError?.message || 'No se pudieron obtener los estados activos.';
        setError(message);
      }
    };

    loadEstado();

    return () => {
      cancelled = true;
    };
  }, [authState.checking, authState.role, fetchEstadoDistribucion]);

  useEffect(() => {
    if (authState.role !== 'USER_CAM') return;
    if (!estadoDistribucionId || !authState.userId) return;
    fetchComandas(estadoDistribucionId, authState.userId);
  }, [authState.role, authState.userId, estadoDistribucionId, fetchComandas]);

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleSnackbarClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const applyDeliveredValue = useCallback((rowUpdates) => {
    if (!rowUpdates || rowUpdates.size === 0) return;

    setRows((prev) =>
      prev.map((row) => {
        const update = rowUpdates.get(row.rowId);
        if (!update) return row;
        const cantidad = Number(update.cantidad ?? 0);
        return {
          ...row,
          cantidadEntregada: cantidad,
          totalEntregado: cantidad * row.monto,
        };
      }),
    );

    setEditedRows((prev) => {
      const next = { ...prev };
      rowUpdates.forEach((update, rowId) => {
        const baseRow = rows.find((row) => row.rowId === rowId);
        if (!baseRow) return;
        const cantidad = Number(update.cantidad ?? 0);
        if (cantidad === baseRow.cantidadEntregadaOriginal) {
          delete next[rowId];
        } else {
          next[rowId] = {
            comandaId: baseRow.comandaId,
            itemId: baseRow.itemId,
            cantidadentregada: cantidad,
          };
        }
      });
      return next;
    });
  }, [rows]);

  const handleCantidadEntregadaChange = useCallback((row, rawValue) => {
    const cantidad = clampDelivered(rawValue, row.cantidad);
    const updates = new Map([[row.rowId, { cantidad }]]);
    applyDeliveredValue(updates);
  }, [applyDeliveredValue]);

  const handleMassiveDialogOpen = () => {
    if (table.getSelectedRowModel().rows.length === 0) {
      showSnackbar('Selecciona al menos una fila para aplicar la entrega masiva.', 'info');
      return;
    }
    setMassDialog({ open: true, value: '', error: '' });
  };

  const handleMassDialogClose = () => {
    setMassDialog({ open: false, value: '', error: '' });
  };

  const handleMassDialogConfirm = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      setMassDialog({ open: false, value: '', error: '' });
      return;
    }

    const numeric = Number(massDialog.value);
    if (Number.isNaN(numeric) || numeric < 0) {
      setMassDialog((prev) => ({ ...prev, error: 'Ingresa un valor válido (≥ 0).' }));
      return;
    }

    const updates = new Map();
    selectedRows.forEach((tableRow) => {
      const row = tableRow.original;
      const cantidad = clampDelivered(numeric, row.cantidad);
      updates.set(row.rowId, { cantidad });
    });

    applyDeliveredValue(updates);
    setMassDialog({ open: false, value: '', error: '' });
    showSnackbar('Entrega masiva aplicada correctamente. Recuerda guardar los cambios.', 'success');
  };

  const handleSaveChanges = async () => {
    const entries = Object.entries(editedRows);
    if (!entries.length) {
      showSnackbar('No hay cambios para guardar.', 'info');
      return;
    }

    const updatesByComanda = new Map();
    entries.forEach(([, value]) => {
      if (!value?.comandaId) return;
      const comandaKey = String(value.comandaId);
      if (!updatesByComanda.has(comandaKey)) {
        updatesByComanda.set(comandaKey, new Map());
      }
      updatesByComanda.get(comandaKey).set(String(value.itemId), Number(value.cantidadentregada ?? 0));
    });

    const rowLookup = new Map(
      rows.map((row) => [`${row.comandaId ?? ''}__${row.itemId ?? ''}`, row]),
    );

    setSaving(true);

    try {
      for (const [comandaId, itemUpdates] of updatesByComanda.entries()) {
        const comanda = comandasById[comandaId];
        if (!comanda) continue;
        const items = Array.isArray(comanda.items) ? comanda.items : [];
        const updatedItems = items.map((item) => {
          const itemId = String(item?._id ?? '');
          const override = itemUpdates.get(itemId);
          let cantidadEntregada = override;
          if (cantidadEntregada === undefined) {
            const rowKey = `${comandaId}__${itemId}`;
            const row = rowLookup.get(rowKey);
            if (row) {
              cantidadEntregada = Number(row.cantidadEntregada ?? 0);
            } else {
              cantidadEntregada = Number(item?.cantidadentregada ?? 0);
            }
          }
          if (cantidadEntregada === undefined) cantidadEntregada = Number(item?.cantidadentregada ?? 0);
          const cantidad = Number(item?.cantidad ?? 0);
          return {
            ...item,
            cantidadentregada: cantidadEntregada,
            entregado: cantidad > 0 ? cantidadEntregada >= cantidad : Boolean(item?.entregado),
          };
        });

        await api.put(`/comandas/${comandaId}`, { items: updatedItems });
      }

      showSnackbar('Entregas actualizadas correctamente.', 'success');
      setEditedRows({});
      if (estadoDistribucionId && authState.userId) {
        fetchComandas(estadoDistribucionId, authState.userId);
      }
    } catch (requestError) {
      console.error('Error actualizando entregas', requestError);
      const message =
        requestError?.response?.data?.err?.message ||
        requestError?.response?.data?.message ||
        'No se pudieron actualizar las entregas.';
      showSnackbar(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReload = () => {
    if (estadoDistribucionId && authState.userId) {
      fetchComandas(estadoDistribucionId, authState.userId);
    }
  };

  const clientesData = useMemo(() => {
    const grouped = new Map();
    rows.forEach((row) => {
      const key = row.clienteKey ?? row.clienteId ?? row.rowId;
      const nombre = row.clienteNombre ?? '—';
      if (!grouped.has(key)) {
        grouped.set(key, {
          clienteKey: key,
          clienteId: row.clienteId ?? null,
          clienteNombre: nombre,
          searchValue: normalizeText(nombre),
          items: [],
          totalCantidad: 0,
          totalCantidadEntregada: 0,
          totalBultos: 0,
          estado: 'pendiente',
        });
      }
      const entry = grouped.get(key);
      entry.items.push(row);
      const cantidad = Number(row.cantidad ?? 0);
      const entregada = Number(row.cantidadEntregada ?? 0);
      entry.totalCantidad += cantidad;
      entry.totalCantidadEntregada += entregada;
      entry.totalBultos += cantidad;
    });

    grouped.forEach((entry) => {
      const allComplete = entry.items.every(
        (item) => Number(item.cantidadEntregada ?? 0) >= Number(item.cantidad ?? 0),
      );
      if (entry.totalCantidadEntregada <= 0) {
        entry.estado = 'pendiente';
      } else if (allComplete) {
        entry.estado = 'completo';
      } else {
        entry.estado = 'parcial';
      }
    });

    const list = Array.from(grouped.values()).sort((a, b) =>
      (a.clienteNombre ?? '').localeCompare(b.clienteNombre ?? '', 'es', {
        sensitivity: 'base',
        ignorePunctuation: true,
      }),
    );

    return { list, map: grouped };
  }, [rows]);

  useEffect(() => {
    if (!clienteSeleccionadoKey) return;
    if (!clientesData.map.has(clienteSeleccionadoKey)) {
      setClienteSeleccionadoKey(null);
    }
  }, [clienteSeleccionadoKey, clientesData]);

  const clienteSeleccionado = clienteSeleccionadoKey
    ? clientesData.map.get(clienteSeleccionadoKey) ?? null
    : null;

  const clienteFilterOptions = useMemo(
    () =>
      (options, { inputValue }) => {
        const normalized = normalizeText(inputValue);
        if (!normalized) {
          return options.slice(0, 15);
        }
        return options.filter((option) => option.searchValue.includes(normalized)).slice(0, 15);
      },
    [],
  );

  const clienteOptions = clientesData.list;

  const pendientesCount = useMemo(
    () => clientesData.list.reduce((acc, cliente) => acc + (cliente.estado === 'pendiente' ? 1 : 0), 0),
    [clientesData],
  );

  const rowEstadoMap = useMemo(() => {
    const map = new Map();
    clientesData.list.forEach((cliente) => {
      cliente.items.forEach((item) => {
        map.set(item.rowId, cliente.estado);
      });
    });
    return map;
  }, [clientesData]);

  const clienteFilteredRows = useMemo(() => {
    if (!clienteSeleccionadoKey) return rows;
    return rows.filter((row) => row.clienteKey === clienteSeleccionadoKey);
  }, [rows, clienteSeleccionadoKey]);

  const filterFns = useMemo(
    () => ({
      includesString: (row, columnId, value) => {
        if (!value && value !== 0) return true;
        const rowValue = row.getValue(columnId);
        return String(rowValue ?? '')
          .toLowerCase()
          .includes(String(value ?? '').toLowerCase());
      },
    }),
    [],
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table: tbl }) => (
          <Checkbox
            checked={tbl.getIsAllPageRowsSelected()}
            indeterminate={tbl.getIsSomePageRowsSelected()}
            onChange={tbl.getToggleAllPageRowsSelectedHandler()}
            inputProps={{ 'aria-label': 'Seleccionar todas las filas' }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            indeterminate={row.getIsSomeSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            inputProps={{ 'aria-label': `Seleccionar comanda ${row.original.nrodecomanda}` }}
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: 'center' },
      }),
      columnHelper.accessor('nrodecomanda', {
        header: 'Com',
        cell: (info) => info.getValue() ?? '—',
        filterFn: 'includesString',
        meta: { filterLabel: 'comanda', align: 'right' },
      }),
      columnHelper.accessor('clienteNombre', {
        header: 'Cliente',
        cell: (info) => info.getValue() ?? '—',
        filterFn: 'includesString',
        meta: { filterLabel: 'cliente' },
      }),
      columnHelper.display({
        id: 'estadoCliente',
        header: 'Estado',
        cell: ({ row }) => {
          const estado = rowEstadoMap.get(row.original.rowId) ?? 'pendiente';
          if (estado === 'parcial') {
            return (
              <Chip
                size="small"
                color="warning"
                variant="filled"
                icon={<WarningAmberIcon fontSize="small" />}
                label="Parcial"
              />
            );
          }
          if (estado === 'completo') {
            return (
              <Chip
                size="small"
                color="success"
                variant="outlined"
                icon={<CheckCircleIcon fontSize="small" />}
                label="Completo"
              />
            );
          }
          return <Chip size="small" variant="outlined" label="Pendiente" />;
        },
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: 'center' },
      }),
      columnHelper.accessor('productoDescripcion', {
        header: 'Producto',
        cell: (info) => info.getValue() ?? '—',
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'producto' },
      }),
      columnHelper.accessor('cantidad', {
        header: 'Cant',
        cell: (info) => quantityFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'cantidad', align: 'right' },
      }),
      columnHelper.accessor('monto', {
        header: 'Precio unitario',
        cell: (info) => decimalFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'precio', align: 'right' },
      }),
      columnHelper.accessor('total', {
        header: 'Total',
        cell: (info) => decimalFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'total', align: 'right' },
      }),
      columnHelper.accessor('cantidadEntregada', {
        header: 'Cant entreg',
        cell: (info) => {
          const row = info.row.original;
          return (
            <TextField
              value={row.cantidadEntregada}
              type="number"
              size={isTabletDown ? 'medium' : 'small'}
              onChange={(event) => handleCantidadEntregadaChange(row, event.target.value)}
              inputProps={{ min: 0, max: row.cantidad, step: '0.01' }}
              fullWidth={isTabletDown}
              sx={{ maxWidth: isTabletDown ? '100%' : 120 }}
            />
          );
        },
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'cantidad entregada', align: 'right' },
      }),
      columnHelper.accessor('totalEntregado', {
        header: 'Total entreg',
        cell: (info) => decimalFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'total entregado', align: 'right' },
      }),
    ],
    [handleCantidadEntregadaChange, isTabletDown, rowEstadoMap],
  );

  const table = useReactTable({
    data: clienteFilteredRows,
    columns,
    state: {
      columnFilters,
      sorting,
      rowSelection,
      pagination,
    },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    filterFns,
    getRowId: (row) => row.rowId,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  });

  const renderColumnFilter = (column) => {
    if (!column.getCanFilter()) return null;
    const value = column.getFilterValue() ?? '';
    return (
      <TextField
        size="small"
        fullWidth
        value={value}
        onChange={(event) => {
          const newValue = event.target.value;
          column.setFilterValue(newValue || undefined);
        }}
        placeholder={`Buscar ${column.columnDef.meta?.filterLabel ?? ''}`.trim()}
        InputProps={{ sx: { fontSize: 13 } }}
      />
    );
  };

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [clienteSeleccionadoKey]);

  const selectedRows = table.getSelectedRowModel().rows;
  const hasEditedRows = Object.keys(editedRows).length > 0;
  const pageRows = table.getRowModel().rows;
  const filteredRows = table.getFilteredRowModel().rows;
  const totalRegistros = filteredRows.length;
  let totalCantidadEntregada = 0;
  let totalMontoEntregado = 0;
  let totalBultos = 0;
  let valorTotal = 0;
  filteredRows.forEach((row) => {
    totalCantidadEntregada += Number(row.original?.cantidadEntregada ?? 0);
    totalMontoEntregado += Number(row.original?.totalEntregado ?? 0);
    totalBultos += Number(row.original?.cantidad ?? 0);
    valorTotal += Number(row.original?.total ?? 0);
  });

  if (authState.checking) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <LinearProgress sx={{ width: { xs: '100%', sm: '60%' } }} />
      </Box>
    );
  }

  if (authState.role !== 'USER_CAM') {
    return (
      <Alert severity="warning">
        Acceso restringido. Esta sección está disponible únicamente para usuarios con rol
        USER_CAM.
      </Alert>
    );
  }

  const selectedCount = selectedRows.length;
  const massPreviewValue = Number(massDialog.value);
  const hasMassValue = !Number.isNaN(massPreviewValue);
  const filterableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanFilter());
  const isSmallScreen = isMobile;

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pb: 4 }}>
      <Box
        sx={{
          mb: 3,
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
          bgcolor: 'primary.dark',
          color: 'common.white',
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant={isSmallScreen ? 'h5' : 'h4'} sx={{ fontWeight: 600 }}>
            En distribución
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Gestiona tus comandas y actualiza las entregas con una interfaz preparada para
            pantallas táctiles.
          </Typography>
        </Stack>
      </Box>

      <Stack
        direction={isSmallScreen ? 'column' : 'row'}
        spacing={isSmallScreen ? 1.5 : 2}
        alignItems={isSmallScreen ? 'stretch' : 'center'}
        sx={{ mb: 3 }}
      >
        <Autocomplete
          value={clienteSeleccionado}
          options={clienteOptions}
          onChange={(_, value) => setClienteSeleccionadoKey(value?.clienteKey ?? null)}
          getOptionLabel={(option) => option?.clienteNombre ?? ''}
          filterOptions={clienteFilterOptions}
          isOptionEqualToValue={(option, value) => option.clienteKey === value.clienteKey}
          fullWidth
          clearOnEscape
          handleHomeEndKeys
          includeInputInList
          size={isSmallScreen ? 'medium' : 'small'}
          renderInput={(params) => (
            <TextField {...params} label="Cliente" placeholder="Buscar cliente" fullWidth />
          )}
        />
        <Chip
          label={`Pendientes: ${pendientesCount}`}
          color={pendientesCount > 0 ? 'warning' : 'default'}
          variant={pendientesCount > 0 ? 'filled' : 'outlined'}
          size={isSmallScreen ? 'medium' : 'small'}
          icon={pendientesCount > 0 ? <WarningAmberIcon fontSize="small" /> : undefined}
          sx={{ fontWeight: 600, alignSelf: isSmallScreen ? 'flex-start' : 'center', px: 1.5 }}
        />
      </Stack>

      {isSmallScreen && filterableColumns.length > 0 && (
        <Paper sx={{ mb: 2, p: 2, borderRadius: 2 }} variant="outlined">
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Buscar comandas
            </Typography>
            {filterableColumns.map((column) => {
              const value = column.getFilterValue() ?? '';
              const label =
                typeof column.columnDef.header === 'string'
                  ? column.columnDef.header
                  : column.columnDef.meta?.filterLabel || 'Filtro';
              return (
                <TextField
                  key={column.id}
                  label={label}
                  value={value}
                  onChange={(event) => {
                    const newValue = event.target.value;
                    column.setFilterValue(newValue || undefined);
                  }}
                  type="text"
                  size="medium"
                  fullWidth
                />
              );
            })}
          </Stack>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1.5, md: 2 }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 1 }}
          flexWrap="wrap"
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <Button
            variant="contained"
            startIcon={<DoneAllIcon />}
            onClick={handleMassiveDialogOpen}
            disabled={selectedCount === 0}
            fullWidth={isTabletDown}
            sx={{ minHeight: 48, borderRadius: 2, px: 2 }}
          >
            Entrega Masiva
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReload}
            fullWidth={isTabletDown}
            sx={{ minHeight: 48, borderRadius: 2, px: 2 }}
          >
            Recargar
          </Button>
        </Stack>
        <Button
          variant="contained"
          color="success"
          startIcon={<SaveIcon />}
          onClick={handleSaveChanges}
          disabled={!hasEditedRows || saving}
          fullWidth={isTabletDown}
          size="large"
          sx={{ minHeight: 56, borderRadius: 2.5, px: 3, fontWeight: 600 }}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </Stack>

      <Paper
        sx={{ position: 'relative', p: isSmallScreen ? 1.5 : 0 }}
        variant="outlined"
      >
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        {isSmallScreen ? (
          <Stack spacing={1.5} sx={{ py: 0.5 }}>
            {pageRows.length > 0 &&
              pageRows.map((row) => {
                const original = row.original;
                const isEdited = Boolean(editedRows[original.rowId]);
                const estadoCliente = rowEstadoMap.get(original.rowId);
                return (
                  <Box
                    key={row.id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: isEdited ? 'primary.main' : 'divider',
                      bgcolor: isEdited ? 'action.hover' : 'background.paper',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Com {original.nrodecomanda ?? '—'}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {original.clienteNombre ?? '—'}
                          </Typography>
                          {estadoCliente === 'parcial' && (
                            <Chip
                              label="Parcial"
                              size="small"
                              color="warning"
                              variant="filled"
                              icon={<WarningAmberIcon fontSize="small" />}
                            />
                          )}
                        </Stack>
                      </Box>
                      <Checkbox
                        checked={row.getIsSelected()}
                        indeterminate={row.getIsSomeSelected()}
                        disabled={!row.getCanSelect()}
                        onChange={row.getToggleSelectedHandler()}
                        size="medium"
                        inputProps={{
                          'aria-label': `Seleccionar comanda ${original.nrodecomanda ?? ''}`,
                        }}
                      />
                    </Stack>
                    <Grid container spacing={1.5} alignItems="flex-start">
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Producto
                        </Typography>
                        <Typography variant="body2">
                          {original.productoDescripcion ?? '—'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Cantidad
                        </Typography>
                        <Typography variant="body2">
                          {quantityFormatter.format(Number(original.cantidad ?? 0))}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Total
                        </Typography>
                        <Typography variant="body2">
                          {decimalFormatter.format(Number(original.total ?? 0))}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Precio unitario
                        </Typography>
                        <Typography variant="body2">
                          {decimalFormatter.format(Number(original.monto ?? 0))}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Cantidad entregada
                        </Typography>
                        <TextField
                          value={original.cantidadEntregada}
                          type="number"
                          size="medium"
                          fullWidth
                          onChange={(event) =>
                            handleCantidadEntregadaChange(original, event.target.value)
                          }
                          inputProps={{ min: 0, max: original.cantidad, step: '0.01' }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Total entregado
                        </Typography>
                        <Typography variant="body2">
                          {decimalFormatter.format(Number(original.totalEntregado ?? 0))}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                );
              })}
            {!loading && pageRows.length === 0 && (
              <Typography align="center" sx={{ py: 3 }}>
                No se encontraron comandas en distribución para el usuario actual.
              </Typography>
            )}
          </Stack>
        ) : (
          <TableContainer
            sx={{
              maxHeight: isTabletDown ? '60vh' : 600,
              overflowX: 'auto',
            }}
          >
            <Table
              stickyHeader
              size="small"
              sx={{
                minWidth: isTabletDown ? 720 : 960,
                '& .MuiTableCell-root': {
                  px: { xs: 1, sm: 1.5 },
                  py: { xs: 1, sm: 1.5 },
                },
              }}
            >
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableCell
                        key={header.id}
                        align={header.column.columnDef.meta?.align ?? 'left'}
                        sx={{ bgcolor: 'background.paper' }}
                      >
                        {header.isPlaceholder ? null : (
                          <Stack spacing={1}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              {header.column.getCanSort() ? (
                                <TableSortLabel
                                  active={!!header.column.getIsSorted()}
                                  direction={header.column.getIsSorted() === 'desc' ? 'desc' : 'asc'}
                                  onClick={header.column.getToggleSortingHandler()}
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </TableSortLabel>
                              ) : (
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </Typography>
                              )}
                            </Stack>
                            {renderColumnFilter(header.column)}
                          </Stack>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{
                      bgcolor: editedRows[row.original.rowId] ? 'action.hover' : undefined,
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
                ))}
                {!loading && pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <Typography align="center" sx={{ py: 3 }}>
                        No se encontraron comandas en distribución para el usuario actual.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ mt: 2, p: { xs: 2, sm: 2.5 } }} variant="outlined">
        <Stack spacing={{ xs: 2, md: 1.5 }}>
          <Grid container spacing={{ xs: 1.5, md: 2 }}>
            <Grid item xs={12} md={4} lg={3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total de registros: {totalRegistros}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4} lg={3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total de bultos: {quantityFormatter.format(totalBultos)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4} lg={3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Valor total $: {decimalFormatter.format(valorTotal)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Suma Cant entreg: {quantityFormatter.format(totalCantidadEntregada)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Suma Total entreg: {decimalFormatter.format(totalMontoEntregado)}
              </Typography>
            </Grid>
          </Grid>
          <TablePagination
            component="div"
            count={totalRegistros}
            page={table.getState().pagination.pageIndex}
            onPageChange={(_, newPage) => table.setPageIndex(newPage)}
            rowsPerPage={table.getState().pagination.pageSize}
            onRowsPerPageChange={(event) => {
              const newSize = Number(event.target.value) || 10;
              table.setPageSize(newSize);
              table.setPageIndex(0);
            }}
            rowsPerPageOptions={[10]}
            showFirstButton
            showLastButton
          />
        </Stack>
      </Paper>

      <Dialog open={massDialog.open} onClose={handleMassDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>Entrega Masiva</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2 }}>
            Ingresa la cantidad entregada que deseas asignar a las {selectedCount}{' '}
            {selectedCount === 1 ? 'fila seleccionada' : 'filas seleccionadas'}. El valor se
            ajustará automáticamente para no superar la cantidad solicitada de cada producto.
          </DialogContentText>
          <TextField
            label="Cantidad entregada"
            type="number"
            fullWidth
            value={massDialog.value}
            onChange={(event) => setMassDialog((prev) => ({ ...prev, value: event.target.value }))}
            inputProps={{ min: 0, step: '0.01' }}
            error={Boolean(massDialog.error)}
            helperText={massDialog.error || 'Ingresa un número mayor o igual a 0.'}
            sx={{ mb: 3 }}
          />
          {selectedCount > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Resumen (primeras {Math.min(selectedCount, 5)} filas):
              </Typography>
              {selectedRows.slice(0, 5).map((row) => {
                const original = row.original;
                const preview = hasMassValue
                  ? clampDelivered(massPreviewValue, original.cantidad)
                  : '—';
                return (
                  <Paper key={row.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Comanda {original.nrodecomanda ?? '—'} — {original.productoDescripcion ?? '—'}
                    </Typography>
                    <Typography variant="body2">
                      Actual: {quantityFormatter.format(Number(original.cantidadEntregada ?? 0))} |{' '}
                      Nuevo: {typeof preview === 'number' ? quantityFormatter.format(preview) : '—'}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleMassDialogClose}>Cancelar</Button>
          <Button onClick={handleMassDialogConfirm} variant="contained">
            Aplicar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
          action={
            <IconButton
              size="small"
              color="inherit"
              onClick={handleSnackbarClose}
              aria-label="Cerrar"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

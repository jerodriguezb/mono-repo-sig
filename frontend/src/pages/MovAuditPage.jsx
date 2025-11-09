import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  LinearProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { DataGrid } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import {
  fetchMovementTypes,
  fetchStockMovements,
  lookupProducts,
  lookupUsers,
} from '../api/stocks';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 50;
const SEARCH_MIN_LENGTH = 3;

const quantityFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = dayjs(value);
  if (!parsed.isValid()) return '—';
  return parsed.format('DD/MM/YYYY HH:mm');
};

const buildProductOption = (item) => {
  if (!item) return null;
  return {
    id: item._id,
    label: [item.codprod, item.descripcion].filter(Boolean).join(' - '),
    raw: item,
  };
};

const buildUserOption = (item) => {
  if (!item) return null;
  const fullName = [item.nombres, item.apellidos].filter(Boolean).join(' ');
  return {
    id: item._id,
    label: fullName || item.email || 'Usuario sin nombre',
    raw: item,
  };
};

const buildMovementOption = (item) => {
  if (!item) return null;
  return {
    id: item._id,
    label: item.movimiento,
    factor: item.factor,
    raw: item,
  };
};

const resolveSignedQuantity = (stock) => {
  const raw = Number(stock?.cantidad ?? 0);
  const factor = Number(stock?.movimiento?.factor);
  if (!Number.isFinite(raw)) return 0;
  const sanitizedFactor = Number.isFinite(factor) && factor !== 0 ? factor : 1;
  return raw * sanitizedFactor;
};

const resolveUserName = (usuario) => {
  if (!usuario) return '—';
  const parts = [usuario.nombres, usuario.apellidos].filter(Boolean);
  if (parts.length === 0 && usuario.email) return usuario.email;
  return parts.length ? parts.join(' ') : '—';
};

const INITIAL_FILTERS = {
  dateFrom: '',
  dateTo: '',
  product: null,
  movement: null,
  user: null,
  orderNumber: '',
};

const createInitialFilters = () => ({ ...INITIAL_FILTERS });

function NoRowsOverlay() {
  return (
    <Stack height="100%" alignItems="center" justifyContent="center" spacing={1}>
      <Typography variant="body2" color="text.secondary">
        No se encontraron movimientos
      </Typography>
    </Stack>
  );
}

export default function MovAuditPage() {
  const [filters, setFilters] = useState(() => createInitialFilters());
  const [appliedFilters, setAppliedFilters] = useState(() => createInitialFilters());
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: DEFAULT_PAGE_SIZE });
  const [productOptions, setProductOptions] = useState([]);
  const [productInput, setProductInput] = useState('');
  const [productLoading, setProductLoading] = useState(false);
  const [userOptions, setUserOptions] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [movementOptions, setMovementOptions] = useState([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [dateError, setDateError] = useState('');

  const showError = useCallback((message) => {
    setSnackbar({ open: true, message, severity: 'error' });
  }, []);

  const showSuccess = useCallback((message) => {
    setSnackbar({ open: true, message, severity: 'success' });
  }, []);

  useEffect(() => {
    let active = true;
    setMovementLoading(true);
    fetchMovementTypes({ limite: 100 })
      .then((response) => {
        if (!active) return;
        if (!response?.ok) {
          showError('No se pudieron obtener los tipos de movimiento.');
          return;
        }
        const mapped = (response.tipomovimientos ?? []).map((item) => buildMovementOption(item));
        setMovementOptions(mapped.filter(Boolean));
      })
      .catch(() => {
        if (!active) return;
        showError('Ocurrió un error al cargar los tipos de movimiento.');
      })
      .finally(() => {
        if (active) setMovementLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showError]);

  useEffect(() => {
    const trimmed = productInput.trim();
    if (!trimmed || trimmed.length < SEARCH_MIN_LENGTH) {
      setProductOptions([]);
      setProductLoading(false);
      return undefined;
    }

    let active = true;
    setProductLoading(true);
    lookupProducts(trimmed, { limit: 20 })
      .then((response) => {
        if (!active) return;
        if (!response?.ok) {
          showError('No se pudieron obtener productos.');
          return;
        }
        const mapped = (response.producservs ?? []).map((item) => buildProductOption(item));
        setProductOptions(mapped.filter(Boolean));
      })
      .catch(() => {
        if (!active) return;
        showError('Ocurrió un error al buscar productos.');
      })
      .finally(() => {
        if (active) setProductLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productInput, showError]);

  useEffect(() => {
    const trimmed = userInput.trim();
    if (!trimmed || trimmed.length < SEARCH_MIN_LENGTH) {
      setUserOptions([]);
      setUserLoading(false);
      return undefined;
    }

    let active = true;
    setUserLoading(true);
    lookupUsers(trimmed, { limit: 20 })
      .then((response) => {
        if (!active) return;
        if (!response?.ok) {
          showError('No se pudieron obtener usuarios.');
          return;
        }
        const mapped = (response.usuarios ?? []).map((item) => buildUserOption(item));
        setUserOptions(mapped.filter(Boolean));
      })
      .catch(() => {
        if (!active) return;
        showError('Ocurrió un error al buscar usuarios.');
      })
      .finally(() => {
        if (active) setUserLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userInput, showError]);

  const productOptionsWithValue = useMemo(() => {
    if (filters.product) {
      const exists = productOptions.some((option) => option.id === filters.product.id);
      if (!exists) return [filters.product, ...productOptions];
    }
    return productOptions;
  }, [filters.product, productOptions]);

  const userOptionsWithValue = useMemo(() => {
    if (filters.user) {
      const exists = userOptions.some((option) => option.id === filters.user.id);
      if (!exists) return [filters.user, ...userOptions];
    }
    return userOptions;
  }, [filters.user, userOptions]);

  const columns = useMemo(() => [
    {
      field: 'fecha',
      headerName: 'Fecha',
      flex: 1,
      minWidth: 160,
      valueFormatter: (params) => formatDateTime(params.value),
      sortable: true,
    },
    {
      field: 'producto',
      headerName: 'Producto/Servicio',
      flex: 1.2,
      minWidth: 220,
      valueGetter: (params) => params.row?.codprod?.descripcion ?? '—',
    },
    {
      field: 'nrodecomanda',
      headerName: 'Comanda',
      flex: 0.6,
      minWidth: 120,
      valueGetter: (params) => params.row?.nrodecomanda ?? '—',
    },
    {
      field: 'movimiento',
      headerName: 'Tipo de Movimiento',
      flex: 1,
      minWidth: 180,
      valueGetter: (params) => params.row?.movimiento?.movimiento ?? '—',
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      type: 'number',
      flex: 0.6,
      minWidth: 120,
      align: 'right',
      headerAlign: 'right',
      valueGetter: (params) => resolveSignedQuantity(params.row),
      valueFormatter: (params) => quantityFormatter.format(params.value ?? 0),
    },
    {
      field: 'usuario',
      headerName: 'Usuario',
      flex: 1,
      minWidth: 200,
      valueGetter: (params) => resolveUserName(params.row?.usuario),
    },
    {
      field: 'fechadecarga',
      headerName: 'Fecha de carga',
      flex: 1,
      minWidth: 180,
      valueFormatter: (params) => formatDateTime(params.value),
    },
  ], []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const params = {
      limite: paginationModel.pageSize,
      desde: paginationModel.page * paginationModel.pageSize,
    };

    if (appliedFilters.product?.id) params.producto = appliedFilters.product.id;
    if (appliedFilters.movement?.id) params.movimiento = appliedFilters.movement.id;
    if (appliedFilters.user?.id) params.usuario = appliedFilters.user.id;
    if (appliedFilters.orderNumber) params.nrodecomanda = appliedFilters.orderNumber;
    if (appliedFilters.dateFrom) params.fechaDesde = appliedFilters.dateFrom;
    if (appliedFilters.dateTo) params.fechaHasta = appliedFilters.dateTo;

    try {
      const response = await fetchStockMovements(params);
      if (!response?.ok) {
        showError('No se pudieron cargar los movimientos.');
        setRows([]);
        setRowCount(0);
        return;
      }

      const mappedRows = (response.stocks ?? []).map((stock) => ({
        id: stock._id,
        ...stock,
      }));
      setRows(mappedRows);
      setRowCount(Number(response.cantidad ?? mappedRows.length));
    } catch {
      showError('Ocurrió un error al cargar los movimientos.');
      setRows([]);
      setRowCount(0);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, paginationModel, showError]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleApplyFilters = useCallback(() => {
    if (filters.dateFrom && filters.dateTo) {
      const from = dayjs(filters.dateFrom);
      const to = dayjs(filters.dateTo);
      if (from.isValid() && to.isValid() && from.isAfter(to)) {
        setDateError('La fecha inicial no puede ser posterior a la final.');
        return;
      }
    }
    setDateError('');
    setAppliedFilters({ ...filters });
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [filters]);

  const handleClearFilters = useCallback(() => {
    setFilters(createInitialFilters());
    setAppliedFilters(createInitialFilters());
    setPaginationModel({ page: 0, pageSize: DEFAULT_PAGE_SIZE });
    setProductInput('');
    setUserInput('');
    setDateError('');
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!rows.length) {
      showError('No hay movimientos para exportar.');
      return;
    }

    const headers = [
      'Fecha',
      'Producto/Servicio',
      'Comanda',
      'Tipo de Movimiento',
      'Cantidad',
      'Usuario',
      'Fecha de carga',
    ];

    const csvRows = rows.map((row) => {
      const values = [
        formatDateTime(row.fecha),
        row?.codprod?.descripcion ?? '',
        row?.nrodecomanda ?? '',
        row?.movimiento?.movimiento ?? '',
        quantityFormatter.format(resolveSignedQuantity(row)),
        resolveUserName(row?.usuario),
        formatDateTime(row.fechadecarga),
      ];
      return values
        .map((value) => {
          const safe = String(value ?? '').replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `movimientos_stock_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccess('Exportación iniciada.');
  }, [rows, showError, showSuccess]);

  const handleCloseSnackbar = useCallback((_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        height: '100%',
      }}
    >
      <Typography variant="h4" component="h1">
        Auditoría de movimientos
      </Typography>

      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Fecha desde"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, dateFrom: event.target.value }));
              setDateError('');
            }}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Fecha hasta"
            type="date"
            value={filters.dateTo}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, dateTo: event.target.value }));
              setDateError('');
            }}
            InputLabelProps={{ shrink: true }}
            error={Boolean(dateError)}
            helperText={dateError}
            fullWidth
          />
          <Autocomplete
            fullWidth
            options={productOptionsWithValue}
            loading={productLoading}
            value={filters.product}
            onChange={(_, newValue) => setFilters((prev) => ({ ...prev, product: newValue }))}
            onInputChange={(_, newInput) => setProductInput(newInput)}
            getOptionLabel={(option) => option?.label ?? ''}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText={productInput.trim().length >= SEARCH_MIN_LENGTH ? 'Sin resultados' : 'Ingresá al menos 3 caracteres'}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Producto/Servicio"
                placeholder="Buscar producto"
                InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
              />
            )}
          />
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Autocomplete
            fullWidth
            options={movementOptions}
            loading={movementLoading}
            value={filters.movement}
            onChange={(_, newValue) => setFilters((prev) => ({ ...prev, movement: newValue }))}
            getOptionLabel={(option) => option?.label ?? ''}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText={movementLoading ? 'Cargando…' : 'Sin resultados'}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tipo de movimiento"
                placeholder="Seleccionar"
                InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
              />
            )}
          />

          <Autocomplete
            fullWidth
            options={userOptionsWithValue}
            loading={userLoading}
            value={filters.user}
            onChange={(_, newValue) => setFilters((prev) => ({ ...prev, user: newValue }))}
            onInputChange={(_, newInput) => setUserInput(newInput)}
            getOptionLabel={(option) => option?.label ?? ''}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText={userInput.trim().length >= SEARCH_MIN_LENGTH ? 'Sin resultados' : 'Ingresá al menos 3 caracteres'}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Usuario"
                placeholder="Buscar usuario"
                InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
              />
            )}
          />

          <TextField
            label="N.º de comanda"
            type="number"
            value={filters.orderNumber}
            onChange={(event) => setFilters((prev) => ({ ...prev, orderNumber: event.target.value }))}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: 0 }}
            fullWidth
          />
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="flex-end">
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<CleaningServicesIcon />}
          onClick={handleClearFilters}
        >
          Limpiar filtros
        </Button>
        <Button
          variant="contained"
          startIcon={<FilterAltIcon />}
          onClick={handleApplyFilters}
        >
          Aplicar filtros
        </Button>
        <Button
          variant="text"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportCsv}
          disabled={!rows.length}
        >
          Exportar CSV
        </Button>
      </Stack>

      <Box sx={{ position: 'relative', flexGrow: 1, minHeight: { xs: 420, md: 520 } }}>
        {loading && (
          <LinearProgress
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1,
            }}
          />
        )}
        <DataGrid
          rows={rows}
          columns={columns}
          disableColumnMenu
          paginationMode="server"
          rowCount={rowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          loading={loading}
          disableRowSelectionOnClick
          initialState={{
            sorting: {
              sortModel: [{ field: 'fecha', sort: 'desc' }],
            },
          }}
          sx={{
            height: '100%',
            '& .MuiDataGrid-cell': { alignItems: 'center' },
          }}
          slots={{
            noRowsOverlay: NoRowsOverlay,
          }}
        />
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

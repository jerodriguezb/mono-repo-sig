import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { DataGrid } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import api from '../api/axios';

const INITIAL_FILTERS = {
  dateFrom: '',
  dateTo: '',
  product: null,
  movement: null,
  user: null,
  orderNumber: '',
};

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(';') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

function NoRowsOverlay() {
  return (
    <Stack height="100%" alignItems="center" justifyContent="center" spacing={1}>
      <Typography variant="body2" color="text.secondary">
        No se encontraron movimientos
      </Typography>
    </Stack>
  );
}

const buildProductOption = (item) => ({
  id: item._id,
  label: item.descripcion || item.detalle || item.nombre || '—',
  raw: item,
});

const buildUserOption = (item) => ({
  id: item._id,
  label: [item.nombres, item.apellidos].filter(Boolean).join(' ') || item.email || '—',
  raw: item,
});

const buildMovementOption = (item) => ({
  id: item._id,
  label: item.movimiento || '—',
  raw: item,
});

export default function MovAuditPage() {
  const [filters, setFilters] = useState(() => ({ ...INITIAL_FILTERS }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...INITIAL_FILTERS }));

  const [movementOptions, setMovementOptions] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [productOptions, setProductOptions] = useState([]);
  const [productInput, setProductInput] = useState('');
  const [productLoading, setProductLoading] = useState(false);

  const [userOptions, setUserOptions] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [userLoading, setUserLoading] = useState(false);

  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: DEFAULT_PAGE_SIZE });

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

  const quantityFormatter = useMemo(
    () =>
      new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }),
    [],
  );

  const columns = useMemo(
    () => [
      {
        field: 'fecha',
        headerName: 'Fecha',
        flex: 1.15,
        minWidth: 180,
        valueGetter: (params) => params.row?.fecha ?? null,
        valueFormatter: (params) => formatDateTime(params.value),
        sortComparator: (v1, v2) => dayjs(v1).valueOf() - dayjs(v2).valueOf(),
      },
      {
        field: 'producto',
        headerName: 'Producto / Servicio',
        flex: 1.3,
        minWidth: 220,
        valueGetter: (params) => params.row?.codprod?.descripcion || params.row?.codprod?.detalle || '—',
      },
      {
        field: 'nrodecomanda',
        headerName: 'Comanda',
        minWidth: 120,
        valueGetter: (params) => (params.row?.nrodecomanda ?? '') === '' ? null : params.row?.nrodecomanda,
        valueFormatter: (params) => (params.value === null || params.value === undefined ? '—' : params.value),
      },
      {
        field: 'movimiento',
        headerName: 'Tipo de movimiento',
        flex: 1.1,
        minWidth: 200,
        valueGetter: (params) => params.row?.movimiento?.movimiento || '—',
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        type: 'number',
        minWidth: 130,
        valueGetter: (params) => {
          const raw = Number(params.row?.cantidad ?? 0);
          if (!Number.isFinite(raw)) return null;
          const factor = Number(params.row?.movimiento?.factor ?? 1);
          const sign = Number.isFinite(factor) && factor < 0 ? -1 : 1;
          return raw * sign;
        },
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) return '—';
          return quantityFormatter.format(params.value);
        },
      },
      {
        field: 'usuario',
        headerName: 'Usuario',
        flex: 1.2,
        minWidth: 220,
        valueGetter: (params) => {
          const usuario = params.row?.usuario;
          if (!usuario) return '—';
          const parts = [usuario.nombres, usuario.apellidos].filter(Boolean);
          if (parts.length) return parts.join(' ');
          return usuario.email || '—';
        },
      },
      {
        field: 'fechadecarga',
        headerName: 'Fecha de carga',
        flex: 1.1,
        minWidth: 180,
        valueGetter: (params) => params.row?.fechadecarga ?? null,
        valueFormatter: (params) => formatDateTime(params.value),
      },
    ],
    [quantityFormatter],
  );

  useEffect(() => {
    let active = true;
    const fetchMovements = async () => {
      setMovementsLoading(true);
      try {
        const { data } = await api.get('/tipomovimientos', { params: { limite: 200 } });
        if (!active) return;
        const options = Array.isArray(data?.tipomovimientos)
          ? data.tipomovimientos.map((item) => buildMovementOption(item))
          : [];
        setMovementOptions(options);
      } catch {
        if (!active) return;
        setSnackbar({ open: true, message: 'No se pudieron cargar los tipos de movimiento', severity: 'error' });
      } finally {
        if (active) setMovementsLoading(false);
      }
    };

    fetchMovements();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const trimmed = productInput.trim();

    if (trimmed.length < 3) {
      setProductOptions(filters.product ? [filters.product] : []);
      setProductLoading(false);
      return () => {
        active = false;
      };
    }

    const fetchProducts = async () => {
      setProductLoading(true);
      try {
        const { data } = await api.get('/producservs/lookup', {
          params: { q: trimmed, limit: 20 },
        });
        if (!active) return;
        const options = Array.isArray(data?.producservs)
          ? data.producservs.map((item) => buildProductOption(item))
          : [];
        if (filters.product?.id && !options.some((option) => option.id === filters.product.id)) {
          options.unshift(filters.product);
        }
        setProductOptions(options);
      } catch {
        if (!active) return;
        setSnackbar({ open: true, message: 'No se pudieron cargar los productos', severity: 'error' });
      } finally {
        if (active) setProductLoading(false);
      }
    };

    fetchProducts();
    return () => {
      active = false;
    };
  }, [productInput, filters.product]);

  useEffect(() => {
    let active = true;
    const trimmed = userInput.trim();

    if (trimmed.length < 3) {
      setUserOptions(filters.user ? [filters.user] : []);
      setUserLoading(false);
      return () => {
        active = false;
      };
    }

    const fetchUsers = async () => {
      setUserLoading(true);
      try {
        const { data } = await api.get('/usuarios/lookup', {
          params: { term: trimmed, limit: 20 },
        });
        if (!active) return;
        const options = Array.isArray(data?.usuarios)
          ? data.usuarios.map((item) => buildUserOption(item))
          : [];
        if (filters.user?.id && !options.some((option) => option.id === filters.user.id)) {
          options.unshift(filters.user);
        }
        setUserOptions(options);
      } catch {
        if (!active) return;
        setSnackbar({ open: true, message: 'No se pudieron cargar los usuarios', severity: 'error' });
      } finally {
        if (active) setUserLoading(false);
      }
    };

    fetchUsers();
    return () => {
      active = false;
    };
  }, [userInput, filters.user]);

  useEffect(() => {
    let active = true;

    const fetchStocks = async () => {
      setLoading(true);
      try {
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

        const { data } = await api.get('/stocks', { params });
        if (!active) return;
        const stocks = Array.isArray(data?.stocks) ? data.stocks : [];
        setRows(stocks);
        setRowCount(Number.isFinite(Number(data?.cantidad)) ? Number(data.cantidad) : stocks.length);
      } catch {
        if (!active) return;
        setRows([]);
        setRowCount(0);
        setSnackbar({ open: true, message: 'No se pudieron cargar los movimientos', severity: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchStocks();
    return () => {
      active = false;
    };
  }, [paginationModel, appliedFilters]);

  const handleApplyFilters = useCallback(() => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setSnackbar({ open: true, message: 'La fecha final no puede ser menor a la inicial', severity: 'warning' });
      return;
    }

    const normalizedOrder = filters.orderNumber ? String(filters.orderNumber).trim() : '';

    setAppliedFilters({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      product: filters.product,
      movement: filters.movement,
      user: filters.user,
      orderNumber: normalizedOrder,
    });
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [filters]);

  const handleClearFilters = useCallback(() => {
    const emptyFilters = { ...INITIAL_FILTERS };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setProductInput('');
    setUserInput('');
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  const handleExportCsv = useCallback(() => {
    const header = [
      'Fecha',
      'Producto/Servicio',
      'Comanda',
      'Tipo de movimiento',
      'Cantidad',
      'Usuario',
      'Fecha de carga',
    ];

    const csvRows = rows.map((row) => {
      const signedQty = (() => {
        const raw = Number(row?.cantidad ?? 0);
        if (!Number.isFinite(raw)) return '';
        const factor = Number(row?.movimiento?.factor ?? 1);
        const sign = Number.isFinite(factor) && factor < 0 ? -1 : 1;
        return raw * sign;
      })();

      const usuario = row?.usuario
        ? [row.usuario.nombres, row.usuario.apellidos].filter(Boolean).join(' ') || row.usuario.email || ''
        : '';

      return [
        formatDateTime(row?.fecha ?? null),
        row?.codprod?.descripcion || row?.codprod?.detalle || '',
        row?.nrodecomanda ?? '',
        row?.movimiento?.movimiento || '',
        signedQty === '' ? '' : quantityFormatter.format(signedQty),
        usuario,
        formatDateTime(row?.fechadecarga ?? null),
      ].map(escapeCsv).join(';');
    });

    const csvContent = [header.map(escapeCsv).join(';'), ...csvRows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `movimientos-${dayjs().format('YYYYMMDD-HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [rows, quantityFormatter]);

  const handleSnackbarClose = useCallback((_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pb: { xs: 4, md: 6 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" component="h1">
        Auditoría de movimientos
      </Typography>

      <Paper elevation={1} sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Fecha desde"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Fecha hasta"
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Nro. de comanda"
              type="number"
              value={filters.orderNumber}
              onChange={(event) => setFilters((prev) => ({ ...prev, orderNumber: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Autocomplete
              value={filters.product}
              onChange={(_, newValue) => setFilters((prev) => ({ ...prev, product: newValue }))}
              inputValue={productInput}
              onInputChange={(_, newInputValue) => setProductInput(newInputValue)}
              options={productOptions}
              loading={productLoading}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              getOptionLabel={(option) => option?.label ?? ''}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Producto / Servicio"
                  placeholder="Buscar producto"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {productLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                  fullWidth
                />
              )}
            />

            <Autocomplete
              value={filters.movement}
              onChange={(_, newValue) => setFilters((prev) => ({ ...prev, movement: newValue }))}
              options={movementOptions}
              loading={movementsLoading}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              getOptionLabel={(option) => option?.label ?? ''}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tipo de movimiento"
                  placeholder="Seleccionar"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {movementsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                  fullWidth
                />
              )}
            />

            <Autocomplete
              value={filters.user}
              onChange={(_, newValue) => setFilters((prev) => ({ ...prev, user: newValue }))}
              inputValue={userInput}
              onInputChange={(_, newInputValue) => setUserInput(newInputValue)}
              options={userOptions}
              loading={userLoading}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              getOptionLabel={(option) => option?.label ?? ''}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Usuario"
                  placeholder="Buscar usuario"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {userLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                  fullWidth
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="flex-end">
            <Button variant="outlined" color="secondary" onClick={handleClearFilters}>
              Limpiar filtros
            </Button>
            <Button variant="contained" onClick={handleApplyFilters}>
              Aplicar filtros
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ pb: 2 }}
        >
          <Typography variant="h6" component="h2">
            Movimientos
          </Typography>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportCsv}
            color="primary"
            disabled={!rows.length}
          >
            Exportar CSV
          </Button>
        </Stack>

        <Box sx={{ position: 'relative' }}>
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
            getRowId={(row) => row._id}
            rowCount={rowCount}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            loading={loading}
            disableRowSelectionOnClick
            autoHeight
            sx={{
              border: 0,
              '& .MuiDataGrid-cell': { py: 1 },
            }}
            slots={{ noRowsOverlay: NoRowsOverlay }}
            slotProps={{ pagination: { labelRowsPerPage: 'Filas por página' } }}
            localeText={{
              noRowsLabel: 'No se encontraron movimientos',
              noResultsOverlayLabel: 'No se encontraron movimientos',
            }}
          />
        </Box>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity || 'error'} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import ManageHistoryIcon from '@mui/icons-material/ManageHistory';
import dayjs from 'dayjs';
import {
  fetchMovementTypes,
  fetchStockMovements,
  lookupProducts,
  lookupUsers,
} from '../api/stocks';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 50;
const MIN_LOOKUP_LENGTH = 3;
const LOOKUP_DEBOUNCE = 400;

const formatDate = (value) => {
  if (!value) return '—';
  const date = dayjs(value);
  if (!date.isValid()) return '—';
  return date.format('DD/MM/YYYY HH:mm');
};

const formatDay = (value) => {
  if (!value) return '';
  const date = dayjs(value);
  if (!date.isValid()) return '';
  return date.format('YYYY-MM-DD');
};

const resolveSignedQuantity = (row) => {
  const cantidad = Number(row?.cantidad ?? 0);
  const factor = Number(row?.movimiento?.factor ?? 1);
  if (!Number.isFinite(cantidad)) return 0;
  if (!Number.isFinite(factor)) return cantidad;
  return factor < 0 ? cantidad * -1 : cantidad;
};

const formatQuantity = (row) => {
  const signed = resolveSignedQuantity(row);
  if (!Number.isFinite(signed)) return '0';
  return signed.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const ensureOption = (option) => {
  if (!option) return null;
  if (typeof option === 'object' && 'id' in option) return option;
  return null;
};

const buildProductOption = (item) => ({
  id: item?._id,
  label: `${item?.codprod ?? ''} — ${item?.descripcion ?? ''}`.trim(),
  raw: item,
});

const buildUserOption = (item) => ({
  id: item?._id,
  label: `${item?.nombres ?? ''} ${item?.apellidos ?? ''}`.trim() || item?.email || '—',
  raw: item,
});

export default function MovAuditPage() {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    product: null,
    movement: null,
    user: null,
    orderNumber: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({ ...filters });
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: DEFAULT_PAGE_SIZE });
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });
  const [movementOptions, setMovementOptions] = useState([]);

  const [productInputValue, setProductInputValue] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [productLoading, setProductLoading] = useState(false);

  const [userInputValue, setUserInputValue] = useState('');
  const [userOptions, setUserOptions] = useState([]);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetchMovementTypes()
      .then((data) => {
        if (!active) return;
        const options = Array.isArray(data?.tipomovimientos)
          ? data.tipomovimientos.map((item) => ({
              id: item?._id,
              label: item?.movimiento ?? '—',
              raw: item,
            }))
          : [];
        setMovementOptions(options);
      })
      .catch((error) => {
        console.error('Error al cargar tipos de movimiento', error);
        if (!active) return;
        setSnackbar({ open: true, severity: 'error', message: 'No se pudieron cargar los tipos de movimiento.' });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (productInputValue.trim().length < MIN_LOOKUP_LENGTH) {
      setProductOptions((previousOptions) => (
        ensureOption(filters.product)
          ? [filters.product]
          : previousOptions.filter((opt) => opt.id === filters.product?.id)
      ));
      setProductLoading(false);
      return undefined;
    }

    setProductLoading(true);
    const timeoutId = setTimeout(() => {
      lookupProducts(productInputValue.trim())
        .then((data) => {
          const options = Array.isArray(data?.producservs)
            ? data.producservs.map((item) => buildProductOption(item))
            : [];
          setProductOptions(() => {
            const valueOption = ensureOption(filters.product);
            if (valueOption && !options.some((opt) => opt.id === valueOption.id)) {
              return [valueOption, ...options];
            }
            return options;
          });
        })
        .catch((error) => {
          console.error('Error al buscar productos', error);
          setSnackbar({ open: true, severity: 'error', message: 'Error al buscar productos.' });
        })
        .finally(() => setProductLoading(false));
    }, LOOKUP_DEBOUNCE);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [productInputValue, filters.product]);

  useEffect(() => {
    if (userInputValue.trim().length < MIN_LOOKUP_LENGTH) {
      setUserOptions((previousOptions) => (
        ensureOption(filters.user)
          ? [filters.user]
          : previousOptions.filter((opt) => opt.id === filters.user?.id)
      ));
      setUserLoading(false);
      return undefined;
    }

    setUserLoading(true);
    const timeoutId = setTimeout(() => {
      lookupUsers(userInputValue.trim())
        .then((data) => {
          const options = Array.isArray(data?.usuarios)
            ? data.usuarios.map((item) => buildUserOption(item))
            : [];
          setUserOptions(() => {
            const valueOption = ensureOption(filters.user);
            if (valueOption && !options.some((opt) => opt.id === valueOption.id)) {
              return [valueOption, ...options];
            }
            return options;
          });
        })
        .catch((error) => {
          console.error('Error al buscar usuarios', error);
          setSnackbar({ open: true, severity: 'error', message: 'Error al buscar usuarios.' });
        })
        .finally(() => setUserLoading(false));
    }, LOOKUP_DEBOUNCE);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [userInputValue, filters.user]);

  useEffect(() => {
    let active = true;
    const { page, pageSize } = paginationModel;
    const params = {
      limite: pageSize,
      desde: page * pageSize,
    };

    if (appliedFilters.product?.id) params.producto = appliedFilters.product.id;
    if (appliedFilters.movement?.id) params.movimiento = appliedFilters.movement.id;
    if (appliedFilters.user?.id) params.usuario = appliedFilters.user.id;
    if (appliedFilters.orderNumber) params.nrodecomanda = appliedFilters.orderNumber;
    if (appliedFilters.dateFrom) params.fechaDesde = appliedFilters.dateFrom;
    if (appliedFilters.dateTo) params.fechaHasta = appliedFilters.dateTo;

    setLoading(true);
    fetchStockMovements(params)
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data?.stocks) ? data.stocks : [];
        setRows(items.map((item) => ({ ...item, id: item?._id ?? `${item.fecha}-${item.nrodecomanda}` })));
        setRowCount(Number(data?.cantidad ?? items.length));
      })
      .catch((error) => {
        console.error('Error al cargar movimientos de stock', error);
        if (!active) return;
        setSnackbar({ open: true, severity: 'error', message: 'No se pudieron cargar los movimientos de stock.' });
        setRows([]);
        setRowCount(0);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [paginationModel, appliedFilters]);

  const columns = useMemo(() => [
    {
      field: 'fecha',
      headerName: 'Fecha',
      minWidth: 170,
      flex: 1,
      valueGetter: (params) => params.row?.fecha ?? null,
      renderCell: (params) => formatDate(params.value),
    },
    {
      field: 'codprod',
      headerName: 'Producto / Servicio',
      minWidth: 240,
      flex: 1.2,
      valueGetter: (params) => params.row?.codprod?.descripcion ?? '—',
      renderCell: (params) => params.value ?? '—',
    },
    {
      field: 'nrodecomanda',
      headerName: 'Comanda',
      minWidth: 120,
      valueGetter: (params) => params.row?.nrodecomanda ?? null,
      renderCell: (params) => params.value ?? '—',
    },
    {
      field: 'movimiento',
      headerName: 'Tipo de movimiento',
      minWidth: 180,
      flex: 1,
      valueGetter: (params) => params.row?.movimiento?.movimiento ?? '—',
      renderCell: (params) => params.value ?? '—',
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      minWidth: 140,
      valueGetter: (params) => resolveSignedQuantity(params.row),
      renderCell: (params) => formatQuantity(params.row),
      align: 'right',
      headerAlign: 'right',
      sortComparator: (v1, v2) => Number(v1 ?? 0) - Number(v2 ?? 0),
    },
    {
      field: 'usuario',
      headerName: 'Usuario',
      minWidth: 200,
      flex: 1,
      valueGetter: (params) => {
        const nombres = params.row?.usuario?.nombres ?? '';
        const apellidos = params.row?.usuario?.apellidos ?? '';
        const fullName = `${nombres} ${apellidos}`.trim();
        return fullName || params.row?.usuario?.email || '—';
      },
      renderCell: (params) => params.value ?? '—',
    },
    {
      field: 'fechadecarga',
      headerName: 'Fecha de carga',
      minWidth: 170,
      valueGetter: (params) => params.row?.fechadecarga ?? null,
      renderCell: (params) => formatDate(params.value),
    },
  ], []);

  const handleApplyFilters = () => {
    if (filters.dateFrom && filters.dateTo) {
      const from = dayjs(filters.dateFrom);
      const to = dayjs(filters.dateTo);
      if (from.isValid() && to.isValid() && to.isBefore(from)) {
        setSnackbar({ open: true, severity: 'warning', message: 'La fecha "Hasta" debe ser posterior o igual a la fecha "Desde".' });
        return;
      }
    }
    setAppliedFilters({ ...filters });
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const handleClearFilters = () => {
    const reset = {
      dateFrom: '',
      dateTo: '',
      product: null,
      movement: null,
      user: null,
      orderNumber: '',
    };
    setFilters(reset);
    setProductInputValue('');
    setUserInputValue('');
    setAppliedFilters(reset);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const handleCloseSnackbar = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <ManageHistoryIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" component="h1">
          Auditoría de movimientos
        </Typography>
      </Stack>

      <Stack
        spacing={2}
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: 'background.paper',
          borderRadius: 2,
          boxShadow: (theme) => theme.shadows[1],
        }}
      >
        <Typography variant="h6" component="h2">
          Filtros
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Desde"
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateFrom: formatDay(event.target.value) }))}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Hasta"
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateTo: formatDay(event.target.value) }))}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Autocomplete
            options={productOptions}
            value={ensureOption(filters.product)}
            onChange={(_, newValue) => setFilters((prev) => ({ ...prev, product: ensureOption(newValue) }))}
            inputValue={productInputValue}
            onInputChange={(_, newInputValue) => setProductInputValue(newInputValue)}
            loading={productLoading}
            fullWidth
            getOptionLabel={(option) => option?.label ?? ''}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Producto / Servicio"
                placeholder="Buscar por código o descripción"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {productLoading ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <Autocomplete
            options={movementOptions}
            value={ensureOption(filters.movement)}
            onChange={(_, newValue) => setFilters((prev) => ({ ...prev, movement: ensureOption(newValue) }))}
            fullWidth
            getOptionLabel={(option) => option?.label ?? ''}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            renderInput={(params) => (
              <TextField {...params} label="Tipo de movimiento" placeholder="Seleccioná un tipo" />
            )}
          />
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Autocomplete
            options={userOptions}
            value={ensureOption(filters.user)}
            onChange={(_, newValue) => setFilters((prev) => ({ ...prev, user: ensureOption(newValue) }))}
            inputValue={userInputValue}
            onInputChange={(_, newInputValue) => setUserInputValue(newInputValue)}
            loading={userLoading}
            fullWidth
            getOptionLabel={(option) => option?.label ?? ''}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Usuario"
                placeholder="Buscar por nombre o email"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {userLoading ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <TextField
            label="Número de comanda"
            type="number"
            value={filters.orderNumber}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, orderNumber: event.target.value.trim() }))}
            fullWidth
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="flex-end">
          <Button variant="outlined" onClick={handleClearFilters}>
            Limpiar filtros
          </Button>
          <Button variant="contained" onClick={handleApplyFilters}>
            Aplicar filtros
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ height: 600, width: '100%' }}>
        {loading ? <LinearProgress sx={{ mb: 1 }} /> : null}
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={rowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          paginationMode="server"
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          loading={loading}
          disableRowSelectionOnClick
          autoHeight={false}
          sx={{
            '& .MuiDataGrid-cell': {
              alignItems: 'center',
            },
          }}
          slots={{ toolbar: GridToolbar }}
          localeText={{
            noRowsLabel: 'No se encontraron movimientos',
          }}
        />
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import api from '../api/axios';

const initialFilters = {
  fechaDesde: '',
  fechaHasta: '',
  producto: null,
  movimiento: null,
  usuario: null,
  nrodecomanda: '',
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  const response = error.response?.data;
  return (
    response?.err?.message ||
    response?.message ||
    error.message ||
    fallback
  );
};

const NoRowsOverlay = () => (
  <Stack height="100%" alignItems="center" justifyContent="center" spacing={1}>
    <Typography variant="body2" color="text.secondary">
      No se encontraron movimientos
    </Typography>
  </Stack>
);

const buildAutocompleteOption = (entity, label) => {
  if (!entity || !entity._id) return null;
  return {
    id: entity._id,
    label,
    raw: entity,
  };
};

const ensureOptionInList = (options, option) => {
  if (!option) return options;
  const exists = options.some((item) => item.id === option.id);
  return exists ? options : [option, ...options];
};

export default function MovAuditPage() {
  const [filters, setFilters] = useState(() => ({ ...initialFilters }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...initialFilters }));
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 50 });
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const [movementOptions, setMovementOptions] = useState([]);

  const [productOptions, setProductOptions] = useState([]);
  const [productInput, setProductInput] = useState('');
  const [productLoading, setProductLoading] = useState(false);
  const productRequestIdRef = useRef(0);

  const [userOptions, setUserOptions] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const userRequestIdRef = useRef(0);

  const quantityFormatter = useMemo(
    () => new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    [],
  );
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
    [],
  );

  const formatDateTime = useCallback(
    (value) => {
      if (!value) return '—';
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return '—';
      return dateTimeFormatter.format(parsed);
    },
    [dateTimeFormatter],
  );

  const resolveSignedQuantity = useCallback((row) => {
    const base = Number(row?.cantidad ?? 0);
    const factor = Number(row?.movimiento?.factor ?? 1);
    if (!Number.isFinite(base)) return 0;
    if (!Number.isFinite(factor) || factor === 0) return base;
    return base * factor;
  }, []);

  const hasActiveFilters = useMemo(() => {
    if (filters.fechaDesde || filters.fechaHasta || filters.nrodecomanda) return true;
    if (filters.producto || filters.movimiento || filters.usuario) return true;
    return false;
  }, [filters]);

  const columns = useMemo(
    () => [
      {
        field: 'fecha',
        headerName: 'Fecha',
        flex: 1,
        minWidth: 200,
        valueGetter: (params) => {
          const raw = params.row?.fecha;
          if (!raw) return null;
          const parsed = new Date(raw);
          return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
        },
        renderCell: (params) => formatDateTime(params.row?.fecha),
        sortComparator: (a, b) => (a ?? 0) - (b ?? 0),
      },
      {
        field: 'producto',
        headerName: 'Producto/Servicio',
        flex: 1.2,
        minWidth: 220,
        valueGetter: (params) => params.row?.codprod?.descripcion || params.row?.codprod?.nombre || '—',
      },
      {
        field: 'nrodecomanda',
        headerName: 'Comanda',
        minWidth: 140,
        valueGetter: (params) => params.row?.nrodecomanda ?? null,
        renderCell: (params) => (params.value ?? '—'),
      },
      {
        field: 'movimiento',
        headerName: 'Tipo de movimiento',
        flex: 1,
        minWidth: 200,
        valueGetter: (params) => params.row?.movimiento?.movimiento || '—',
      },
      {
        field: 'cantidad',
        headerName: 'Cantidad',
        minWidth: 140,
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        valueGetter: (params) => resolveSignedQuantity(params.row),
        renderCell: (params) => quantityFormatter.format(params.value ?? 0),
        sortComparator: (a, b) => (a ?? 0) - (b ?? 0),
      },
      {
        field: 'usuario',
        headerName: 'Usuario',
        flex: 1,
        minWidth: 200,
        valueGetter: (params) => {
          const nombres = params.row?.usuario?.nombres ?? '';
          const apellidos = params.row?.usuario?.apellidos ?? '';
          const fullName = `${nombres} ${apellidos}`.trim();
          return fullName || '—';
        },
      },
      {
        field: 'fechadecarga',
        headerName: 'Fecha de carga',
        flex: 1,
        minWidth: 200,
        valueGetter: (params) => {
          const raw = params.row?.fechadecarga;
          if (!raw) return null;
          const parsed = new Date(raw);
          return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
        },
        renderCell: (params) => formatDateTime(params.row?.fechadecarga),
        sortComparator: (a, b) => (a ?? 0) - (b ?? 0),
      },
    ],
    [formatDateTime, quantityFormatter, resolveSignedQuantity],
  );

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const handleApplyFilters = useCallback(() => {
    if (filters.fechaDesde && filters.fechaHasta && filters.fechaDesde > filters.fechaHasta) {
      setSnackbar({
        open: true,
        message: 'La fecha final no puede ser anterior a la fecha inicial.',
        severity: 'warning',
      });
      return;
    }
    const normalizedComanda = (filters.nrodecomanda ?? '').toString().trim();
    if (normalizedComanda !== filters.nrodecomanda) {
      setFilters((prev) => ({ ...prev, nrodecomanda: normalizedComanda }));
    }
    setAppliedFilters({ ...filters, nrodecomanda: normalizedComanda });
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [filters]);

  const handleResetFilters = useCallback(() => {
    setFilters(() => ({ ...initialFilters }));
    setAppliedFilters(() => ({ ...initialFilters }));
    setProductInput('');
    setUserInput('');
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!rows.length) {
      setSnackbar({ open: true, message: 'No hay movimientos para exportar.', severity: 'info' });
      return;
    }

    const headers = [
      'Fecha',
      'Producto/Servicio',
      'Comanda',
      'Tipo de movimiento',
      'Cantidad',
      'Usuario',
      'Fecha de carga',
    ];

    const dataRows = rows.map((row) => {
      const producto = row?.codprod?.descripcion || row?.codprod?.nombre || '';
      const usuario = (() => {
        const nombres = row?.usuario?.nombres ?? '';
        const apellidos = row?.usuario?.apellidos ?? '';
        const full = `${nombres} ${apellidos}`.trim();
        return full || '';
      })();

      return [
        formatDateTime(row?.fecha),
        producto,
        row?.nrodecomanda ?? '',
        row?.movimiento?.movimiento ?? '',
        quantityFormatter.format(resolveSignedQuantity(row)),
        usuario,
        formatDateTime(row?.fechadecarga),
      ];
    });

    const escape = (value) => {
      const stringValue = value ?? '';
      const normalized = stringValue.toString().replaceAll('"', '""');
      return `"${normalized}` + '"';
    };

    const csvContent = [headers, ...dataRows]
      .map((row) => row.map(escape).join(','))
      .join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `movimientos_auditoria_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [formatDateTime, quantityFormatter, resolveSignedQuantity, rows]);

  useEffect(() => {
    let active = true;

    const fetchMovements = async () => {
      try {
        const { data } = await api.get('/tipomovimientos', { params: { limite: 200 } });
        if (!active) return;
        const options = (data?.tipomovimientos ?? []).map((mov) => ({
          id: mov._id,
          label: mov.movimiento,
          raw: mov,
        }));
        setMovementOptions(options);
      } catch (error) {
        if (!active) return;
        setSnackbar({
          open: true,
          message: getErrorMessage(error, 'No se pudieron cargar los tipos de movimiento.'),
          severity: 'error',
        });
      }
    };

    fetchMovements();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = productInput.trim();
    const requestId = productRequestIdRef.current + 1;
    productRequestIdRef.current = requestId;

    if (trimmed.length < 3) {
      setProductLoading(false);
      setProductOptions(() => ensureOptionInList([], filters.producto));
      return;
    }

    setProductLoading(true);
    const handler = setTimeout(() => {
      api
        .get('/producservs/lookup', { params: { q: trimmed, limit: 20 } })
        .then(({ data }) => {
          if (productRequestIdRef.current !== requestId) return;
          const options = (data?.producservs ?? []).map((item) =>
            buildAutocompleteOption(item, item.descripcion ?? item.nombre ?? ''),
          ).filter(Boolean);
          setProductOptions(ensureOptionInList(options, filters.producto));
        })
        .catch((error) => {
          if (productRequestIdRef.current !== requestId) return;
          setSnackbar({
            open: true,
            message: getErrorMessage(error, 'No se pudieron cargar los productos o servicios.'),
            severity: 'error',
          });
        })
        .finally(() => {
          if (productRequestIdRef.current === requestId) {
            setProductLoading(false);
          }
        });
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [filters.producto, productInput]);

  useEffect(() => {
    const trimmed = userInput.trim();
    const requestId = userRequestIdRef.current + 1;
    userRequestIdRef.current = requestId;

    if (trimmed.length < 3) {
      setUserLoading(false);
      setUserOptions(() => ensureOptionInList([], filters.usuario));
      return;
    }

    setUserLoading(true);
    const handler = setTimeout(() => {
      api
        .get('/usuarios/lookup', { params: { q: trimmed, limit: 20 } })
        .then(({ data }) => {
          if (userRequestIdRef.current !== requestId) return;
          const options = (data?.usuarios ?? []).map((user) =>
            buildAutocompleteOption(
              user,
              `${user.nombres ?? ''} ${user.apellidos ?? ''}`.trim() || user.email || '',
            ),
          ).filter(Boolean);
          setUserOptions(ensureOptionInList(options, filters.usuario));
        })
        .catch((error) => {
          if (userRequestIdRef.current !== requestId) return;
          setSnackbar({
            open: true,
            message: getErrorMessage(error, 'No se pudieron cargar los usuarios.'),
            severity: 'error',
          });
        })
        .finally(() => {
          if (userRequestIdRef.current === requestId) {
            setUserLoading(false);
          }
        });
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [filters.usuario, userInput]);

  useEffect(() => {
    let active = true;
    const { page, pageSize } = paginationModel;
    const params = {
      limite: pageSize,
      desde: page * pageSize,
    };

    if (appliedFilters.producto?.id) params.producto = appliedFilters.producto.id;
    if (appliedFilters.movimiento?.id) params.movimiento = appliedFilters.movimiento.id;
    if (appliedFilters.usuario?.id) params.usuario = appliedFilters.usuario.id;
    if (appliedFilters.nrodecomanda) params.nrodecomanda = appliedFilters.nrodecomanda;
    if (appliedFilters.fechaDesde) params.fechaDesde = appliedFilters.fechaDesde;
    if (appliedFilters.fechaHasta) params.fechaHasta = appliedFilters.fechaHasta;

    setLoading(true);
    api
      .get('/stocks', { params })
      .then(({ data }) => {
        if (!active) return;
        const stocks = Array.isArray(data?.stocks) ? data.stocks : [];
        setRows(stocks.map((stock) => ({ ...stock, id: stock._id })));
        setRowCount(Number(data?.cantidad) || 0);
      })
      .catch((error) => {
        if (!active) return;
        setRows([]);
        setRowCount(0);
        setSnackbar({
          open: true,
          message: getErrorMessage(error, 'No se pudieron cargar los movimientos de stock.'),
          severity: 'error',
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appliedFilters, paginationModel]);

  return (
    <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Auditoría de movimientos
      </Typography>

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }} elevation={3}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Fecha desde"
              type="date"
              value={filters.fechaDesde}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, fechaDesde: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Fecha hasta"
              type="date"
              value={filters.fechaHasta}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, fechaHasta: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="N° de comanda"
              type="number"
              value={filters.nrodecomanda}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, nrodecomanda: event.target.value }))
              }
              fullWidth
              inputProps={{ min: 0 }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Autocomplete
              value={filters.producto}
              onChange={(_, value) => {
                setFilters((prev) => ({ ...prev, producto: value }));
                setProductOptions((prev) => ensureOptionInList(prev, value));
              }}
              inputValue={productInput}
              onInputChange={(_, value) => setProductInput(value)}
              options={ensureOptionInList(productOptions, filters.producto)}
              loading={productLoading}
              getOptionLabel={(option) => option?.label ?? ''}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Producto / Servicio"
                  placeholder="Escribe al menos 3 caracteres"
                />
              )}
              fullWidth
            />

            <Autocomplete
              value={filters.movimiento}
              onChange={(_, value) => setFilters((prev) => ({ ...prev, movimiento: value }))}
              options={movementOptions}
              getOptionLabel={(option) => option?.label ?? ''}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              renderInput={(params) => <TextField {...params} label="Tipo de movimiento" />}
              fullWidth
            />

            <Autocomplete
              value={filters.usuario}
              onChange={(_, value) => {
                setFilters((prev) => ({ ...prev, usuario: value }));
                setUserOptions((prev) => ensureOptionInList(prev, value));
              }}
              inputValue={userInput}
              onInputChange={(_, value) => setUserInput(value)}
              options={ensureOptionInList(userOptions, filters.usuario)}
              loading={userLoading}
              getOptionLabel={(option) => option?.label ?? ''}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Usuario"
                  placeholder="Escribe al menos 3 caracteres"
                />
              )}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="flex-end">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="flex-end">
              <Button variant="outlined" color="secondary" onClick={handleExportCsv} disabled={!rows.length}>
                Exportar CSV
              </Button>
              <Button variant="outlined" onClick={handleResetFilters} disabled={!hasActiveFilters}>
                Limpiar filtros
              </Button>
              <Button variant="contained" onClick={handleApplyFilters}>
                Aplicar filtros
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ position: 'relative', height: { xs: 520, md: 640 } }} elevation={3}>
        {loading && (
          <LinearProgress
            sx={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1 }}
          />
        )}
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id || row._id}
          rowCount={rowCount}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          disableRowSelectionOnClick
          density="standard"
          initialState={{
            sorting: {
              sortModel: [{ field: 'fecha', sort: 'desc' }],
            },
          }}
          sx={{
            height: '100%',
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: (theme) => theme.palette.action.hover,
            },
            '& .MuiDataGrid-virtualScroller': {
              marginTop: loading ? 4 : 0,
            },
          }}
          slots={{
            noRowsOverlay: NoRowsOverlay,
          }}
        />
      </Paper>

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

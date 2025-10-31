import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DataGrid,
  GridActionsCellItem,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid';
import {
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import api from '../api/axios.js';

const pageSize = 20;

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function normalizeNumeric(value) {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  const hasComma = stringValue.includes(',');
  const hasDot = stringValue.includes('.');
  let normalized = stringValue;

  if (hasComma && hasDot) {
    normalized = stringValue.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = stringValue.replace(',', '.');
  }

  normalized = normalized.replace(/\s+/g, '');
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatCurrency(value) {
  const numeric = normalizeNumeric(value);
  if (numeric === null) return value ?? '';
  return numberFormatter.format(numeric);
}

function formatPercent(value) {
  const numeric = normalizeNumeric(value);
  if (numeric === null) return value ?? '';
  return `${numeric}%`;
}

function CustomFooter({ totalCount = 0 }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        px: 2,
        py: 0.5,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="subtitle1">
        Total registros: {Intl.NumberFormat('es-AR').format(totalCount)}
      </Typography>
    </Box>
  );
}

const PriceTable = forwardRef(function PriceTable({ onEdit }, ref) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [sortModel, setSortModel] = useState([
    { field: 'productoDescripcion', sort: 'asc' },
  ]);
  const [filterModel, setFilterModel] = useState({ items: [], quickFilterValues: [] });
  const [listOptions, setListOptions] = useState([]);

  const fetchData = useCallback(async (
    nextPage = 0,
    sModel = sortModel,
    fModel = filterModel,
  ) => {
    const pageIndex = Number.isFinite(nextPage) && nextPage >= 0 ? nextPage : 0;
    setLoading(true);
    try {
      const params = {
        desde: pageIndex * pageSize,
        limite: pageSize,
      };

      if (Array.isArray(sModel) && sModel.length > 0) {
        params.sortField = sModel[0].field;
        params.sortOrder = sModel[0].sort;
      }

      const validFilters = Array.isArray(fModel?.items)
        ? fModel.items.filter((item) => {
          if (!item) return false;
          if (item.operator === 'isEmpty' || item.operator === 'isNotEmpty') return true;
          return item.value !== undefined && item.value !== null && String(item.value).trim() !== '';
        })
        : [];

      if (validFilters.length > 0) {
        params.filters = JSON.stringify(validFilters);
      }

      if (Array.isArray(fModel?.quickFilterValues) && fModel.quickFilterValues.length > 0) {
        params.search = fModel.quickFilterValues.join(' ');
      }

      const { data } = await api.get('/precios', { params });
      const mapped = (data?.precios ?? []).map((precio) => ({
        ...precio,
        productoDescripcion: precio?.codproducto?.descripcion ?? '',
        listaNombre: precio?.lista?.lista ?? '',
      }));
      setRows(mapped);
      setRowCount(Number(data?.cantidad ?? mapped.length));
    } catch (error) {
      console.error('Error al obtener precios', error);
    } finally {
      setLoading(false);
    }
  }, [filterModel, sortModel]);

  const initialLoad = useRef(false);

  useEffect(() => {
    if (initialLoad.current) return;
    initialLoad.current = true;
    fetchData(0, sortModel, filterModel);
    setPage(0);
  }, [fetchData, sortModel, filterModel]);

  useImperativeHandle(ref, () => ({
    refresh: () => fetchData(page, sortModel, filterModel),
  }));

  useEffect(() => {
    let cancelled = false;
    if (listOptions.length > 0) return undefined;
    api
      .get('/listas', { params: { limite: 500 } })
      .then(({ data }) => {
        if (cancelled) return;
        const options = (data?.listas ?? [])
          .filter((lista) => lista?.lista)
          .map((lista) => ({ value: lista.lista, label: lista.lista }));
        setListOptions(options);
      })
      .catch((error) => {
        console.error('Error al obtener listas para filtros', error);
      });

    return () => {
      cancelled = true;
    };
  }, [listOptions.length]);

  const columns = useMemo(() => [
    {
      field: 'productoDescripcion',
      headerName: 'Producto / Servicio',
      flex: 1.4,
      minWidth: 220,
      sortable: true,
      sortComparator: (a = '', b = '') => a.localeCompare(b, 'es', { sensitivity: 'base' }),
    },
    {
      field: 'listaNombre',
      headerName: 'Lista',
      flex: 1,
      minWidth: 160,
      sortable: true,
      type: 'singleSelect',
      valueOptions: listOptions,
      sortComparator: (a = '', b = '') => a.localeCompare(b, 'es', { sensitivity: 'base' }),
    },
    {
      field: 'precionetocompra',
      headerName: 'Precio Neto compra',
      flex: 0.8,
      minWidth: 160,
      type: 'number',
      renderCell: ({ value }) => formatCurrency(value),
    },
    {
      field: 'ivacompra',
      headerName: 'IVA compra',
      flex: 0.6,
      minWidth: 140,
      type: 'number',
      renderCell: ({ value }) => formatPercent(value),
    },
    {
      field: 'preciototalcompra',
      headerName: 'Precio Total compra',
      flex: 0.8,
      minWidth: 170,
      type: 'number',
      renderCell: ({ value }) => formatCurrency(value),
    },
    {
      field: 'precionetoventa',
      headerName: 'Precio Neto venta',
      flex: 0.8,
      minWidth: 160,
      type: 'number',
      renderCell: ({ value }) => formatCurrency(value),
    },
    {
      field: 'ivaventa',
      headerName: 'IVA venta',
      flex: 0.6,
      minWidth: 140,
      type: 'number',
      renderCell: ({ value }) => formatPercent(value),
    },
    {
      field: 'preciototalventa',
      headerName: 'Precio Total venta',
      flex: 0.9,
      minWidth: 180,
      type: 'number',
      renderCell: ({ value }) => formatCurrency(value),
    },
    {
      field: 'activo',
      headerName: 'Activo',
      width: 100,
      type: 'boolean',
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Acciones',
      width: 90,
      getActions: (params) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label="Editar"
          onClick={() => onEdit(params.row)}
        />,
      ],
    },
  ], [listOptions, onEdit]);

  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));

  const goToPage = (nextPage) => {
    if (nextPage < 0 || nextPage >= totalPages) return;
    setPage(nextPage);
    fetchData(nextPage, sortModel, filterModel);
  };

  return (
    <Stack spacing={1}>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(row) => row._id}
          pagination
          paginationMode="server"
          rowCount={rowCount}
          page={page}
          pageSize={pageSize}
          onPageChange={goToPage}
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={(model) => {
            setSortModel(model);
            const nextPage = 0;
            setPage(nextPage);
            fetchData(nextPage, model, filterModel);
          }}
          filterMode="server"
          filterModel={filterModel}
          onFilterModelChange={(model) => {
            setFilterModel(model);
            const nextPage = 0;
            setPage(nextPage);
            fetchData(nextPage, sortModel, model);
          }}
          disableRowSelectionOnClick
          slots={{
            toolbar: GridToolbarQuickFilter,
            footer: CustomFooter,
          }}
          slotProps={{
            toolbar: { quickFilterProps: { debounceMs: 300 } },
            footer: { totalCount: rowCount },
          }}
          hideFooterPagination
        />
      </Box>

      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button
          variant="outlined"
          onClick={() => goToPage(page - 1)}
          disabled={loading || page <= 0}
        >
          Anterior
        </Button>
        <Button
          variant="outlined"
          onClick={() => goToPage(page + 1)}
          disabled={loading || page + 1 >= totalPages}
        >
          Siguiente
        </Button>
      </Box>
    </Stack>
  );
});

export default PriceTable;

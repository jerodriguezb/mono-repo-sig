import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
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

function formatCurrency(value) {
  if (value === null || typeof value === 'undefined' || Number.isNaN(Number(value))) return '';
  return numberFormatter.format(Number(value));
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
  const [sortModel, setSortModel] = useState([]);

  const fetchData = async (nextPage = page) => {
    setLoading(true);
    try {
      const { data } = await api.get('/precios', {
        params: {
          desde: nextPage * pageSize,
          limite: pageSize,
        },
      });
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
  };

  useEffect(() => {
    fetchData(0);
    setPage(0);
  }, []);

  useImperativeHandle(ref, () => ({
    refresh: () => fetchData(page),
  }));

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
      sortComparator: (a = '', b = '') => a.localeCompare(b, 'es', { sensitivity: 'base' }),
    },
    {
      field: 'precionetocompra',
      headerName: 'Precio Neto compra',
      flex: 0.8,
      minWidth: 160,
      type: 'number',
      valueFormatter: ({ value }) => formatCurrency(value),
    },
    {
      field: 'ivacompra',
      headerName: 'IVA compra',
      flex: 0.6,
      minWidth: 140,
      type: 'number',
      valueFormatter: ({ value }) => (value == null ? '' : `${value}%`),
    },
    {
      field: 'preciototalcompra',
      headerName: 'Precio Total compra',
      flex: 0.8,
      minWidth: 170,
      type: 'number',
      valueFormatter: ({ value }) => formatCurrency(value),
    },
    {
      field: 'precionetoventa',
      headerName: 'Precio Neto venta',
      flex: 0.8,
      minWidth: 160,
      type: 'number',
      valueFormatter: ({ value }) => formatCurrency(value),
    },
    {
      field: 'ivaventa',
      headerName: 'IVA venta',
      flex: 0.6,
      minWidth: 140,
      type: 'number',
      valueFormatter: ({ value }) => (value == null ? '' : `${value}%`),
    },
    {
      field: 'preciototalventa',
      headerName: 'Precio Total venta',
      flex: 0.9,
      minWidth: 180,
      type: 'number',
      valueFormatter: ({ value }) => formatCurrency(value),
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
  ], [onEdit]);

  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));

  const goToPage = (nextPage) => {
    if (nextPage < 0 || nextPage >= totalPages) return;
    setPage(nextPage);
    fetchData(nextPage);
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
          sortingMode="client"
          sortModel={sortModel}
          onSortModelChange={(model) => setSortModel(model)}
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

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
import EditIcon from '@mui/icons-material/Edit';
import { Box, Typography, Button, Stack } from '@mui/material';
import api from '../api/axios.js';

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

const sortableFields = new Set(['productoDescripcion', 'listaNombre']);

const PriceTable = forwardRef(function PriceTable({ onEdit }, ref) {
  const [rows, setRows] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rowCount, setRowCount] = useState(0);

  const pageSize = 20;
  const [page, setPage] = useState(0);
  const [sortModel, setSortModel] = useState([]);

  const applySort = useMemo(
    () =>
      (data, model) => {
        if (!model?.length) return data;
        const { field, sort } = model[0];
        if (!sortableFields.has(field)) return data;
        const sorted = [...data].sort((a, b) => {
          const valA = (a[field] ?? '').toString().toLowerCase();
          const valB = (b[field] ?? '').toString().toLowerCase();
          if (valA < valB) return -1;
          if (valA > valB) return 1;
          return 0;
        });
        return sort === 'desc' ? sorted.reverse() : sorted;
      },
    []
  );

  const fetchData = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = { desde: targetPage * pageSize, limite: pageSize };
      const { data } = await api.get('/precios', { params });
      const mapped = (data.precios ?? []).map((precio) => ({
        ...precio,
        productoDescripcion: precio.codproducto?.descripcion ?? '',
        listaNombre: precio.lista?.lista ?? '',
      }));
      setRawRows(mapped);
      setRowCount(data.cantidad ?? mapped.length);
    } catch (err) {
      console.error('Error al obtener precios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRows(applySort(rawRows, sortModel));
  }, [rawRows, sortModel, applySort]);

  useImperativeHandle(ref, () => ({
    refresh: () => fetchData(page),
  }));

  const columns = [
    {
      field: 'productoDescripcion',
      headerName: 'Producto/Servicio',
      flex: 1.2,
      minWidth: 220,
      sortable: true,
    },
    {
      field: 'listaNombre',
      headerName: 'Lista',
      flex: 0.7,
      minWidth: 160,
      sortable: true,
    },
    {
      field: 'precionetocompra',
      headerName: 'Precio Neto compra',
      type: 'number',
      minWidth: 160,
      valueFormatter: ({ value }) =>
        value === null || value === undefined ? '' : value.toLocaleString('es-AR'),
      sortable: false,
    },
    {
      field: 'ivacompra',
      headerName: 'IVA compra',
      type: 'number',
      minWidth: 130,
      valueFormatter: ({ value }) =>
        value === null || value === undefined ? '' : value.toLocaleString('es-AR'),
      sortable: false,
    },
    {
      field: 'preciototalcompra',
      headerName: 'Precio Total compra',
      type: 'number',
      minWidth: 170,
      valueFormatter: ({ value }) =>
        value === null || value === undefined ? '' : value.toLocaleString('es-AR'),
      sortable: false,
    },
    {
      field: 'precionetoventa',
      headerName: 'Precio Neto venta',
      type: 'number',
      minWidth: 160,
      valueFormatter: ({ value }) =>
        value === null || value === undefined ? '' : value.toLocaleString('es-AR'),
      sortable: false,
    },
    {
      field: 'ivaventa',
      headerName: 'IVA venta',
      type: 'number',
      minWidth: 130,
      valueFormatter: ({ value }) =>
        value === null || value === undefined ? '' : value.toLocaleString('es-AR'),
      sortable: false,
    },
    {
      field: 'preciototalventa',
      headerName: 'Precio Total venta',
      type: 'number',
      minWidth: 170,
      valueFormatter: ({ value }) =>
        value === null || value === undefined ? '' : value.toLocaleString('es-AR'),
      sortable: false,
    },
    {
      field: 'activo',
      headerName: 'Activo',
      type: 'boolean',
      width: 90,
      sortable: false,
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
  ];

  const totalPages = Math.max(Math.ceil(rowCount / pageSize), 1);

  const goToPage = (newPage) => {
    setPage(newPage);
    fetchData(newPage);
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
          onPageChange={(newPage) => goToPage(newPage)}
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={(newModel) => setSortModel(newModel)}
          slots={{
            toolbar: GridToolbarQuickFilter,
            footer: CustomFooter,
          }}
          slotProps={{
            toolbar: { quickFilterProps: { debounceMs: 400 } },
            footer: { totalCount: rowCount },
          }}
          disableRowSelectionOnClick
          hideFooterPagination
        />
      </Box>

      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button
          variant="outlined"
          onClick={() => goToPage(page - 1)}
          disabled={loading || page === 0}
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

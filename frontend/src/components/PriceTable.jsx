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
import { Box, Button, Stack, Typography } from '@mui/material';
import api from '../api/axios.js';

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatNumericCell(value) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numberFormatter.format(numeric) : '';
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

const pageSize = 20;

const PriceTable = forwardRef(function PriceTable({ onEdit }, ref) {
  const [rawRows, setRawRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [sortModel, setSortModel] = useState([]);
  const pageRef = React.useRef(0);

  const fetchData = React.useCallback(async (targetPage = pageRef.current) => {
    setLoading(true);
    try {
      const { data } = await api.get('/precios', {
        params: {
          desde: targetPage * pageSize,
          limite: pageSize,
        },
      });
      const precios = Array.isArray(data?.precios) ? data.precios : [];
      const mapped = precios.map((precio) => ({
        ...precio,
        productoDescripcion: precio?.codproducto?.descripcion ?? '',
        listaNombre: precio?.lista?.lista ?? '',
      }));
      setRawRows(mapped);
      setRowCount(Number(data?.cantidad) || 0);
    } catch (error) {
      console.error('Error al obtener precios:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(0);
  }, [fetchData]);

  useImperativeHandle(ref, () => ({
    refresh: () => fetchData(pageRef.current),
  }), [fetchData]);

  const applySort = React.useCallback((sourceRows, model) => {
    if (!model?.length) return sourceRows;
    const [{ field, sort }] = model;
    const sorted = [...sourceRows].sort((a, b) => {
      const aValue = a?.[field];
      const bValue = b?.[field];

      const aNumber = Number(aValue);
      const bNumber = Number(bValue);
      const bothNumbers = Number.isFinite(aNumber) && Number.isFinite(bNumber);

      if (bothNumbers) {
        return sort === 'asc' ? aNumber - bNumber : bNumber - aNumber;
      }

      const aText = (aValue ?? '').toString().toLowerCase();
      const bText = (bValue ?? '').toString().toLowerCase();

      if (aText < bText) return sort === 'asc' ? -1 : 1;
      if (aText > bText) return sort === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, []);

  useEffect(() => {
    setRows(sortModel.length ? applySort(rawRows, sortModel) : rawRows);
  }, [rawRows, sortModel, applySort]);

  const columns = useMemo(() => ([
    {
      field: 'productoDescripcion',
      headerName: 'Producto/Servicio',
      flex: 1.4,
      minWidth: 200,
      sortable: true,
    },
    {
      field: 'listaNombre',
      headerName: 'Lista',
      flex: 1,
      minWidth: 150,
      sortable: true,
    },
    {
      field: 'precionetocompra',
      headerName: 'Precio Neto compra',
      type: 'number',
      width: 160,
      valueFormatter: ({ value }) => formatNumericCell(value),
    },
    {
      field: 'ivacompra',
      headerName: 'IVA compra',
      type: 'number',
      width: 120,
      valueFormatter: ({ value }) => formatNumericCell(value),
    },
    {
      field: 'preciototalcompra',
      headerName: 'Precio Total compra',
      type: 'number',
      width: 170,
      valueFormatter: ({ value }) => formatNumericCell(value),
    },
    {
      field: 'precionetoventa',
      headerName: 'Precio Neto venta',
      type: 'number',
      width: 160,
      valueFormatter: ({ value }) => formatNumericCell(value),
    },
    {
      field: 'ivaventa',
      headerName: 'IVA venta',
      type: 'number',
      width: 120,
      valueFormatter: ({ value }) => formatNumericCell(value),
    },
    {
      field: 'preciototalventa',
      headerName: 'Precio Total venta',
      type: 'number',
      width: 170,
      valueFormatter: ({ value }) => formatNumericCell(value),
    },
    {
      field: 'activo',
      headerName: 'Activo',
      type: 'boolean',
      width: 100,
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
  ]), [onEdit]);

  const totalPages = rowCount > 0 ? Math.ceil(rowCount / pageSize) : 0;
  const isLastPage = totalPages === 0 ? true : page + 1 >= totalPages;

  const handlePageChange = (newPage) => {
    pageRef.current = newPage;
    setPage(newPage);
    fetchData(newPage);
  };

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

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
          onPageChange={handlePageChange}
          pageSizeOptions={[pageSize]}
          sortingMode="client"
          sortModel={sortModel}
          onSortModelChange={(model) => setSortModel(model.slice(0, 1))}
          filterMode="client"
          disableColumnMenu
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
          onClick={() => handlePageChange(page - 1)}
          disabled={loading || page === 0}
        >
          Anterior
        </Button>
        <Button
          variant="outlined"
          onClick={() => handlePageChange(page + 1)}
          disabled={loading || isLastPage}
        >
          Siguiente
        </Button>
      </Box>
    </Stack>
  );
});

export default PriceTable;

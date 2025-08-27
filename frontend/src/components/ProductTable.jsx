import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import {
  DataGrid, GridActionsCellItem
} from '@mui/x-data-grid';
import { Box, Button, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import api from '../api/axios.js';

/* Footer: muestra total de registros */
function CustomFooter({ totalCount = 0 }) {
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
      px: 2, py: 0.5, borderTop: '1px solid', borderColor: 'divider'
    }}>
      <Typography variant="subtitle1">
        Total registros: {Intl.NumberFormat('es-AR').format(totalCount)}
      </Typography>
    </Box>
  );
}

const ProductTable = forwardRef(function ProductTable({ onEdit }, ref) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const pageSize = 10;
  const [page, setPage] = useState(0);         // 0-based
  const [rowCount, setRowCount] = useState(0); // total desde backend
  const [filterModel, setFilterModel] = useState({ items: [] });
  const [sortModel, setSortModel] = useState([]);

  const fetchData = useCallback(async (
    p = 0,
    model = filterModel,
    sModel = sortModel,
  ) => {
    setLoading(true);
    try {
      const desde = p * pageSize;
      const { field, value, operator } = model.items[0] || {};
      const params = { desde, limite: pageSize };
      if (field && value !== undefined) {
        params.searchField = field;
        params.searchValue = value;
        params.operator = operator;
      }

      const [sort] = sModel;
      if (sort?.field) {
        params.sortField = sort.field;
        params.sortOrder = sort.sort;
      }

      const { data } = await api.get('/producservs', { params });


      const flat = (data.producservs ?? []).map((x) => ({
        ...x,
        // nombres legibles si vienen objetos poblados
        rubroNombre:
          typeof x.rubro === 'string' ? x.rubro :
          x.rubro?.nombre ?? x.rubro?.rubro ?? '',
        marcaNombre:
          typeof x.marca === 'string' ? x.marca :
          x.marca?.nombre ?? x.marca?.marca ?? '',
        unidadNombre:
          typeof x.unidaddemedida === 'string' ? x.unidaddemedida :
          x.unidaddemedida?.nombre ?? x.unidaddemedida?.descripcion ?? '',
      }));

      setRows(flat);
      setRowCount(data.cantidad || 0);
    } catch (err) {
      console.error('Error al obtener productos:', err);
    } finally {
      setLoading(false);
    }

  }, [pageSize, filterModel, sortModel]);

  useEffect(() => {
    fetchData(0);
    setPage(0);
  }, [fetchData]);

  useImperativeHandle(ref, () => ({
    refresh: () => fetchData(page),
  }));

  const handleFilterChange = (model) => {
    setFilterModel(model);
    setPage(0);
    fetchData(0, model, sortModel);
  };

  const handleSortModelChange = (model) => {
    setSortModel(model);
    setPage(0);
    fetchData(0, filterModel, model);
  };

  const columns = [
    { field: 'codprod',      headerName: 'Código',     width: 120 },
    { field: 'descripcion',  headerName: 'Descripción', flex: 1, minWidth: 280 },
    { field: 'tipo',         headerName: 'Tipo',        width: 120 },
    { field: 'iva',          headerName: 'IVA %',       width: 90, type: 'number' },
    { field: 'stkactual',    headerName: 'Stock',       width: 100, type: 'number' },
    { field: 'rubroNombre',  headerName: 'Rubro',       width: 150 },
    { field: 'marcaNombre',  headerName: 'Marca',       width: 150 },
    { field: 'unidadNombre', headerName: 'Unidad',      width: 140 },
    { field: 'activo',       headerName: 'Activo',      width: 90, type: 'boolean' },
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

  const totalPages = Math.ceil(rowCount / pageSize);
  const goToPage = (np) => { setPage(np); fetchData(np, filterModel, sortModel); };

  return (
    <Stack spacing={1}>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r._id}
          pagination
          paginationMode="server"
          page={page}
          pageSize={pageSize}
          rowCount={rowCount}
          onPageChange={(np) => goToPage(np)}
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={handleSortModelChange}
          filterMode="server"
          filterModel={filterModel}
          onFilterModelChange={handleFilterChange}
          slots={{ footer: CustomFooter }}
          slotProps={{ footer: { totalCount: rowCount } }}
          hideFooterPagination
          disableRowSelectionOnClick
        />
      </Box>

      {/* Navegación simple */}
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

export default ProductTable;

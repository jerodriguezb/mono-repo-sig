import React, {
  useState, useEffect, forwardRef, useImperativeHandle,
} from 'react';
import {
  DataGrid,
  GridActionsCellItem,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Typography, Button, Stack } from '@mui/material';
import api from '../api/axios.js';

/* ---------- footer: sólo cuenta total de registros ---------- */
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

/* ---------- tabla ---------- */
const ClientTable = forwardRef(function ClientTable({ onEdit }, ref) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  const pageSize = 10;
  const [page, setPage]       = useState(0);     // 0-based
  const [rowCount, setCount]  = useState(0);

  /* filtros */
  const [filterModel, setFilterModel] = useState({
    items: [],             // [{ field, operator, value }]
    quickFilterValues: [], // texto quick
  });

  /* construir params (soporta filtros repetidos) */
  const buildParams = (p, model) => {
    const params = { limit: pageSize, page: p + 1 };
    model.items.forEach((f) => {
      if (!f.value) return;
      const key = `filter[${f.field}]`;
      params[key] = params[key]
        ? (Array.isArray(params[key]) ? [...params[key], f.value] : [params[key], f.value])
        : f.value;
    });
    if (model.quickFilterValues?.length) {
      params['filter[global]'] = model.quickFilterValues.join(' ');
    }
    return params;
  };

  /* fetch */
  const fetchData = async (p = page, model = filterModel) => {
    setLoading(true);
    try {
      const { data } = await api.get('/clientes', { params: buildParams(p, model) });
      const flat = (data.clientes ?? []).map((c) => ({
        ...c,
        localidadNombre: c.localidad?.localidad ?? '',
        rutaNombre:      c.ruta?.ruta          ?? '',
      }));
      setRows(flat);
      setCount(data.total || 0); // ← total de registros (filtrados) desde el backend
    } catch (err) {
      console.error('Error al obtener clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(0, filterModel); }, []); // carga inicial

  useImperativeHandle(ref, () => ({
    refresh: () => fetchData(page, filterModel),
  }));

  /* columnas */
  const columns = [
    { field: 'codcli',            headerName: 'Código',       width: 100, type: 'number' },
    { field: 'razonsocial',       headerName: 'Razón Social', flex: 1, minWidth: 200 },
    { field: 'domicilio',         headerName: 'Domicilio',    flex: 1.2, minWidth: 200 },
    { field: 'telefono',          headerName: 'Teléfono',     width: 130 },
    { field: 'email',             headerName: 'E-mail',       flex: 1, minWidth: 200 },
    { field: 'cuit',              headerName: 'CUIT',         width: 140 },
    { field: 'localidadNombre',   headerName: 'Localidad',    width: 120 },
    { field: 'rutaNombre',        headerName: 'Ruta',         width: 110 },
    { field: 'activo',            headerName: 'Activo',       type: 'boolean', width: 90 },
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

  const goToPage = (newPage) => {
    setPage(newPage);
    fetchData(newPage, filterModel);
  };

  return (
    <Stack spacing={1}>
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r._id}
          /* paginación servidor */
          pagination
          paginationMode="server"
          rowCount={rowCount}
          page={page}
          pageSize={pageSize}
          onPageChange={(np) => goToPage(np)}
          /* filtros servidor */
          filterMode="server"
          filterModel={filterModel}
          onFilterModelChange={(nm) => {
            setFilterModel(nm);
            setPage(0);
            fetchData(0, nm);
          }}
          /* quick filter */
          slots={{
            toolbar: GridToolbarQuickFilter,
            footer : CustomFooter,
          }}
          slotProps={{
            toolbar: { quickFilterProps: { debounceMs: 400 } },
            footer : { totalCount: rowCount }, // ← pasa el total al footer
          }}
          hideFooterPagination
          disableRowSelectionOnClick
        />
      </Box>

      {/* Botones Anterior / Siguiente */}
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

export default ClientTable;

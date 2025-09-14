import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import api from '../api/axios.js';
import ComandaPrintView from './ComandaPrintView.jsx';

export default function HistorialComandas() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  const fetchData = useCallback(
    async (pageParam = page + 1, pageSizeParam = pageSize) => {
      setLoading(true);
      try {
        const { data: resp } = await api.get('/comandas/historial', {
          params: { page: pageParam, pageSize: pageSizeParam },
        });
        const flat = (resp.data ?? []).map((c) => ({
          ...c,
          estadoNombre: c.codestado?.estado ?? '',
          total: c.total ?? 0,
          clienteNombre: c.codcli?.razonsocial,
        }));
        setRows(flat);
        setPage((resp.page ?? pageParam) - 1);
        setPageSize(resp.pageSize ?? pageSizeParam);
        setTotal(resp.total ?? flat.length);
      } catch (err) {
        console.error('Error obteniendo comandas', err);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize]
  );

  useEffect(() => {
    fetchData(page + 1, pageSize);
  }, [fetchData, page, pageSize]);

  const handleView = (row) => setSelected(row);
  const handleClose = () => setSelected(null);
  const handlePrint = (row) => {
    handleView(row);
    setTimeout(() => window.print(), 100);
  };

  const toPrintItems = (com) =>
    com.items.map((i) => ({
      codprod: i.codprod?._id ?? i.codprod,
      descripcion: i.codprod?.descripcion ?? '',
      precio: Number(i.monto) || 0,
      cantidad: Number(i.cantidad) || 0,
    }));

  const columns = [
    { field: 'nrodecomanda', headerName: 'Número', width: 100 },
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 140,
      valueGetter: (params) => {
        const date =
          params.value instanceof Date ? params.value : new Date(params.value);
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
          return '-';
        }
        return date.toLocaleDateString('es-AR', {
          timeZone: 'America/Argentina/Tucuman',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      },
    },
    { field: 'clienteNombre', headerName: 'Cliente', flex: 1 },
    { field: 'estadoNombre', headerName: 'Estado', width: 120 },
    {
      field: 'total',
      headerName: 'Total',
      width: 120,
      type: 'number',
      valueFormatter: (p) => currencyFormatter.format(p.value),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Acciones',
      width: 120,
      getActions: (params) => [
        <GridActionsCellItem
          key="view"
          icon={<VisibilityIcon />}
          label="Ver"
          onClick={() => handleView(params.row)}
        />,
        <GridActionsCellItem
          key="print"
          icon={<PrintIcon />}
          label="Imprimir"
          onClick={() => handlePrint(params.row)}
        />,
      ],
    },
  ];

  return (
    <Box sx={{ height: 600, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        paginationMode="server"
        rowCount={total}
        paginationModel={{ page, pageSize }}
        onPaginationModelChange={(m) => {
          setPage(m.page);
          setPageSize(m.pageSize);
        }}
        initialState={{ sorting: { sortModel: [{ field: 'nrodecomanda', sort: 'desc' }] } }}
        getRowId={(r) => r._id}
        disableRowSelectionOnClick
      />
      <Dialog fullScreen open={!!selected} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Comanda {selected?.nrodecomanda}</DialogTitle>
        <DialogContent>
          {selected && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6">Comanda {selected.nrodecomanda}</Typography>
                <Typography variant="subtitle1">
                  Cliente: {selected.codcli?.razonsocial}
                </Typography>
                <Typography variant="subtitle1">
                  Fecha:{' '}
                  {selected.fecha
                    ? new Date(selected.fecha).toLocaleDateString('es-AR', {
                        timeZone: 'America/Argentina/Tucuman',
                      })
                    : ''}
                </Typography>
              </Box>
              <ComandaPrintView
                items={toPrintItems(selected)}
                showTotal
                cliente={selected.codcli?.razonsocial}
                fecha={selected.fecha}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => window.print()} startIcon={<PrintIcon />}>Imprimir</Button>
          <Button onClick={handleClose}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: resp } = await api.get('/comandas/historial');
      const flat = (resp.data ?? []).map((c) => ({
        ...c,
        estadoNombre: c.codestado?.estado ?? '',
        total: c.items.reduce((sum, i) => sum + i.cantidad * i.monto, 0),
        clienteNombre: c.codcli?.razonsocial,
      }));
      setRows(flat);
      setTotal(resp.total ?? flat.length);
    } catch (err) {
      console.error('Error obteniendo comandas', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      precio: i.monto,
      cantidad: i.cantidad,
    }));

  const columns = [
    { field: 'nrodecomanda', headerName: 'Número', width: 100 },
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 140,
      valueFormatter: ({ value }) => {
        if (!value) return '-';
        const date = new Date(value);
        return isNaN(date)
          ? '-'
          : date.toLocaleDateString('es-AR', {
              timeZone: 'America/Argentina/Tucuman',
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
      <Dialog open={!!selected} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Comanda {selected?.nrodecomanda}</DialogTitle>
        <DialogContent>
          {selected && (
            <ComandaPrintView items={toPrintItems(selected)} showTotal />
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


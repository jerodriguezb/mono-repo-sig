import { Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import ClientsPage from './pages/ClientsPage';
import ProductsPage from './pages/ProductsPage.jsx';
import ComandasPage from './pages/ComandasPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import LogisticsPage from './pages/LogisticsPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import LoginForm from './pages/LoginForm';
import PrivateRoute from './components/PrivateRoute';
import HistorialComandas from './components/HistorialComandas.jsx';
import DistribucionPage from './pages/DistribucionPage.jsx';
import DeliveryManagerPage from './pages/DeliveryManagerPage.jsx';

export default function AppRoutes({ themeName, setThemeName }) {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <DashboardLayout themeName={themeName} setThemeName={setThemeName} />
          </PrivateRoute>
        }
      >
        <Route path="clients" element={<ClientsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="comandas" element={<ComandasPage />} />
        <Route path="/ordenes" element={<OrdersPage />} />
        <Route path="/historial-comandas" element={<HistorialComandas />} />
        <Route path="/distribucion" element={<DistribucionPage />} />
        <Route path="/pantalla-distribucion" element={<DeliveryManagerPage />} />
        <Route path="/logistics" element={<LogisticsPage />} />
        {/* Otras rutas aquí */}
      </Route>
    </Routes>
  );
}

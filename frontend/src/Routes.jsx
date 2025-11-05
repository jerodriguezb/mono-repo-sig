import { Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import ClientsPage from './pages/ClientsPage';
import ProductsPage from './pages/ProductsPage.jsx';
import ComandasPage from './pages/ComandasPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import LogisticsPage from './pages/LogisticsPage.jsx';
import PricesPage from './pages/PricesPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import LoginForm from './pages/LoginForm';
import PrivateRoute from './components/PrivateRoute';
import HistorialComandas from './components/HistorialComandas.jsx';
import DistribucionPage from './pages/DistribucionPage.jsx';
import PermissionsPage from './pages/PermissionsPage.jsx';
import NoAccessPage from './pages/NoAccessPage.jsx';
import RoleGuard from './components/RoleGuard.jsx';

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
        <Route
          path="clients"
          element={(
            <RoleGuard requiredPath="/clients">
              <ClientsPage />
            </RoleGuard>
          )}
        />
        <Route
          path="/products"
          element={(
            <RoleGuard requiredPath="/products">
              <ProductsPage />
            </RoleGuard>
          )}
        />
        <Route
          path="/documents"
          element={(
            <RoleGuard requiredPath="/documents">
              <DocumentsPage />
            </RoleGuard>
          )}
        />
        <Route
          path="comandas"
          element={(
            <RoleGuard requiredPath="/comandas">
              <ComandasPage />
            </RoleGuard>
          )}
        />
        <Route
          path="/ordenes"
          element={(
            <RoleGuard requiredPath="/ordenes">
              <OrdersPage />
            </RoleGuard>
          )}
        />
        <Route
          path="/historial-comandas"
          element={(
            <RoleGuard requiredPath="/historial-comandas">
              <HistorialComandas />
            </RoleGuard>
          )}
        />
        <Route
          path="/permissions"
          element={(
            <RoleGuard requiredPath="/permissions">
              <PermissionsPage />
            </RoleGuard>
          )}
        />
        <Route
          path="/distribucion"
          element={(
            <RoleGuard requiredPath="/distribucion">
              <DistribucionPage />
            </RoleGuard>
          )}
        />
        <Route
          path="/logistics"
          element={(
            <RoleGuard requiredPath="/logistics">
              <LogisticsPage />
            </RoleGuard>
          )}
        />
        <Route
          path="/precios"
          element={(
            <RoleGuard requiredPath="/precios">
              <PricesPage />
            </RoleGuard>
          )}
        />
        <Route path="/no-access" element={<NoAccessPage />} />
      </Route>
    </Routes>
  );
}

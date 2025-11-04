import GroupIcon from '@mui/icons-material/Group';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import SecurityIcon from '@mui/icons-material/Security';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HistoryIcon from '@mui/icons-material/History';
import DescriptionIcon from '@mui/icons-material/Description';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import PriceChangeIcon from '@mui/icons-material/PriceChange';

export const navItems = [
  { label: 'Clientes', path: '/clients', icon: <GroupIcon /> },
  { label: 'Usuarios', path: '/users', icon: <PeopleAltIcon /> },
  { label: 'Productos', path: '/products', icon: <Inventory2Icon /> },
  { label: 'Documentos', path: '/documents', icon: <DescriptionIcon /> },
  { label: 'Comandas', path: '/comandas', icon: <ReceiptLongIcon /> },
  { label: 'Ordenes', path: '/ordenes', icon: <AssignmentTurnedInIcon /> },
  { label: 'Historial', path: '/historial-comandas', icon: <HistoryIcon /> },
  { label: 'Permisos', path: '/permissions', icon: <SecurityIcon /> },
  { label: 'Distribución', path: '/distribucion', icon: <DeliveryDiningIcon /> },
  { label: 'Logística', path: '/logistics', icon: <LocalShippingIcon /> },
  { label: 'Precios', path: '/precios', icon: <PriceChangeIcon /> },
];

export default navItems;

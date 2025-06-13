// frontend/src/App.jsx
import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider.jsx';

// Importações das páginas
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import ClientForm from './components/ClientForm.jsx';
import ClientDetailsPage from './pages/ClientDetailsPage.jsx';
import CarnesPage from './pages/CarnesPage.jsx';
import CarneForm from './pages/CarneForm.jsx';
import CarneDetailsPage from './pages/CarneDetailsPage.jsx';
import NovaVendaPage from './pages/NovaVendaPage.jsx';
import ReceiptsReportPage from './pages/ReceiptsReportPage.jsx';
import PendingDebtsReportPage from './pages/PendingDebtsReportPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterUserPage from './pages/RegisterUserPage.jsx';
import RegisterAdminPage from './pages/RegisterAdminPage.jsx';
import RegisterUserByAdminPage from './pages/RegisterUserByAdminPage.jsx';

// Importações para produtos
import ProdutosPage from './pages/ProdutosPage.jsx';
import ProdutoFormPage from './pages/ProdutoFormPage.jsx';

// Seu GlobalAlert e Contexto
import GlobalAlert from './components/GlobalAlert.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';

// Importações do Material-UI para o Header
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer'; 
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuIcon from '@mui/icons-material/Menu'; // Certifique-se de ter instalado: npm install @mui/icons-material


const GlobalAlertContext = createContext(null);
export const useGlobalAlert = () => useContext(GlobalAlertContext);

const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingSpinner message="Verificando autenticação..." />;
    return user ? children : <Navigate to="/" />;
};

const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const alertContext = useContext(GlobalAlertContext);

    if (loading) return <LoadingSpinner message="Verificando permissões..." />;
    if (!user) return <Navigate to="/" />;
    if (user.perfil !== 'admin') {
        alertContext?.setGlobalAlert({ message: 'Acesso negado. Você não tem permissão de administrador.', type: 'error' });
        return <Navigate to="/dashboard" />;
    }
    return children;
};

function App() {
    const [globalAlert, setGlobalAlert] = useState(null);
    const clearGlobalAlert = () => setGlobalAlert(null);

    return (
        <Router>
            <AuthProvider>
                <GlobalAlertContext.Provider value={{ setGlobalAlert, clearGlobalAlert }}>
                    <Header />
                    {globalAlert && (
                        <GlobalAlert 
                            message={globalAlert.message} 
                            type={globalAlert.type} 
                            onClose={clearGlobalAlert} 
                        />
                    )}
                    <main className="main-content flex-grow p-4"> {/* Adicionado classes Tailwind aqui */}
                        <Routes>
                            <Route path="/" element={<LoginPage />} />
                            <Route path="/register-user" element={<RegisterUserPage />} />
                            <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
                            <Route path="/nova-venda" element={<PrivateRoute><NovaVendaPage /></PrivateRoute>} />
                            <Route path="/clients" element={<PrivateRoute><ClientsPage /></PrivateRoute>} />
                            <Route path="/clients/new" element={<PrivateRoute><ClientForm /></PrivateRoute>} />
                            <Route path="/clients/edit/:id" element={<PrivateRoute><ClientForm /></PrivateRoute>} />
                            <Route path="/clients/details/:id" element={<PrivateRoute><ClientDetailsPage /></PrivateRoute>} />
                            <Route path="/carnes" element={<PrivateRoute><CarnesPage /></PrivateRoute>} />
                            <Route path="/clients/:id_cliente/carnes" element={<PrivateRoute><CarnesPage /></PrivateRoute>} />
                            <Route path="/carnes/new/:clientIdFromUrl?" element={<PrivateRoute><CarneForm /></PrivateRoute>} />
                            <Route path="/carnes/edit/:id" element={<PrivateRoute><CarneForm /></PrivateRoute>} />
                            <Route path="/carnes/details/:id" element={<PrivateRoute><CarneDetailsPage /></PrivateRoute>} />
                            <Route path="/produtos" element={<PrivateRoute><ProdutosPage /></PrivateRoute>} />
                            <Route path="/produtos/novo" element={<AdminRoute><ProdutoFormPage /></AdminRoute>} />
                            <Route path="/produtos/editar/:id" element={<AdminRoute><ProdutoFormPage /></AdminRoute>} />
                            <Route path="/reports/receipts" element={<PrivateRoute><ReceiptsReportPage /></PrivateRoute>} />
                            <Route path="/reports/pending-debts-by-client/:client_id?" element={<PrivateRoute><PendingDebtsReportPage /></PrivateRoute>} />
                            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                            <Route path="/register-admin" element={<AdminRoute><RegisterAdminPage /></AdminRoute>} />
                            <Route path="/register-atendente" element={<AdminRoute><RegisterUserByAdminPage /></AdminRoute>} />
                        </Routes>
                    </main>
                </GlobalAlertContext.Provider>
            </AuthProvider>
        </Router>
    );
}

function Header() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false); // Estado para controlar o Drawer do MUI

    const toggleDrawer = (open) => (event) => {
        if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
            return;
        }
        setDrawerOpen(open);
    };

    const closeDrawer = () => setDrawerOpen(false);

    const isLinkActive = (path) => {
        if (path === '/') return location.pathname === path;
        return location.pathname === path || 
               location.pathname.startsWith(path + '/') || 
               (path.includes(':') && location.pathname.startsWith(path.substring(0, path.indexOf(':'))));
    };

    // Definição dos itens do menu
    const menuItems = [
        { text: 'Dashboard', path: '/dashboard', roles: ['admin', 'atendente'] },
        { text: 'Nova Venda', path: '/nova-venda', roles: ['admin', 'atendente'] },
        { text: 'Clientes', path: '/clients', roles: ['admin', 'atendente'] },
        { text: 'Carnês', path: '/carnes', roles: ['admin', 'atendente'] },
        { text: 'Produtos', path: '/produtos', roles: ['admin', 'atendente'] },
        { text: 'Rel. Receb.', path: '/reports/receipts', roles: ['admin', 'atendente'] },
        { text: 'Rel. Dívidas', path: '/reports/pending-debts-by-client', roles: ['admin', 'atendente'] },
        { text: 'Reg. Admin', path: '/register-admin', roles: ['admin'] },
        { text: 'Reg. Atendente', path: '/register-atendente', roles: ['admin'] },
        { text: 'Meu Perfil', path: '/profile', roles: ['admin', 'atendente'] },
    ];

    // Componente auxiliar para o conteúdo do Drawer
    const drawerContent = (
        <Box
            sx={{ width: 250 }}
            role="presentation"
            onClick={toggleDrawer(false)}
            onKeyDown={toggleDrawer(false)}
            className="flex flex-col h-full bg-gray-800 text-white" // Tailwind classes for drawer background and text
        >
            <Typography variant="h6" component="div" sx={{ p: 2, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                Navegação
            </Typography>
            <List className="flex-grow">
                {user && menuItems.map((item) => (
                    (item.roles.includes(user.perfil)) && (
                        <ListItem key={item.text} disablePadding>
                            <ListItemButton
                                component={Link}
                                to={item.path}
                                selected={isLinkActive(item.path)}
                                sx={{
                                    '&.Mui-selected': {
                                        backgroundColor: 'primary.main', // Cor de destaque do MUI theme
                                        '&:hover': {
                                            backgroundColor: 'primary.dark',
                                        },
                                    },
                                    '&:hover': {
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                    },
                                    px: 2, // Tailwind px-2
                                }}
                            >
                                <ListItemText primary={item.text} sx={{ color: 'white' }} />
                            </ListItemButton>
                        </ListItem>
                    )
                ))}
            </List>
            {user && (
                <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }} className="text-sm">
                    <Typography className="mb-2">Olá, {user.nome}! ({user.perfil})</Typography>
                    <Button
                        variant="contained"
                        color="error"
                        fullWidth
                        onClick={logout}
                    >
                        Sair
                    </Button>
                </Box>
            )}
        </Box>
    );

    return (
        <AppBar position="static" sx={{ bgcolor: 'background.default', boxShadow: 3 }}> {/* MUI AppBar com cor de fundo padrão e sombra */}
            <Toolbar className="flex justify-between items-center px-4 sm:px-6 lg:px-8"> {/* Tailwind para espaçamento e alinhamento */}
                <Typography variant="h6" component="div" className="flex-shrink-0">
                    <Link to={user ? "/dashboard" : "/"} className="text-white no-underline hover:text-gray-200">
                        Bios Store
                    </Link>
                </Typography>

                {user && (
                    <>
                        {/* Menu para telas maiores (desktop) */}
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2 }} className="ml-auto"> {/* Oculta em xs, mostra em md, espaçamento */}
                            {menuItems.map((item) => (
                                (item.roles.includes(user.perfil)) && (
                                    <Button
                                        key={item.text}
                                        component={Link}
                                        to={item.path}
                                        color="inherit" // Cor do texto do botão (branca no AppBar)
                                        className={`capitalize ${isLinkActive(item.path) ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-gray-700'}`} // Tailwind para caps, cor ativa
                                        sx={{ borderRadius: 1 }} // Arredondamento
                                    >
                                        {item.text}
                                    </Button>
                                )
                            ))}
                            {/* Info do usuário (DESKTOP) */}
                            <Box className="flex items-center gap-2 ml-4">
                                <Typography variant="body2" className="text-white whitespace-nowrap">
                                    Olá, {user.nome}! ({user.perfil})
                                </Typography>
                                <Button
                                    variant="contained" 
                                    color="error" 
                                    size="small" 
                                    onClick={logout}
                                >
                                    Sair
                                </Button>
                            </Box>
                        </Box>

                        {/* Botão de Menu Hamburger para telas pequenas (mobile) */}
                        <IconButton
                            edge="start"
                            color="inherit"
                            aria-label="menu"
                            onClick={toggleDrawer(true)}
                            sx={{ display: { md: 'none' } }} // Oculta em md e acima
                        >
                            <MenuIcon />
                        </IconButton>

                        {/* Drawer (Menu Lateral) */}
                        <Drawer
                            anchor="right" 
                            open={drawerOpen}
                            onClose={toggleDrawer(false)}
                        >
                            {drawerContent}
                        </Drawer>
                    </>
                )}
            </Toolbar>
        </AppBar>
    );
}

export default App;
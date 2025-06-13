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
import { createTheme, ThemeProvider } from '@mui/material/styles'; //
import CssBaseline from '@mui/material/CssBaseline'; //


// 1. Definição de um Tema Material-UI (Opcional, mas altamente recomendado para consistência)
const theme = createTheme({ //
  palette: { //
    primary: { //
      main: '#3F51B5', // Um azul mais vibrante para a cor principal do seu tema
    }, //
    secondary: { //
      main: '#FFC107', // Amarelo/laranja para destaque
    }, //
    error: { //
      main: '#D32F2F', // Vermelho padrão para erros
    }, //
    background: { //
      default: '#f4f7f6', // Fundo claro da página
      paper: '#FFFFFF', // Fundo de componentes como cards e modais
      appBar: '#2C3E50', // Cor de fundo para a AppBar, um azul escuro
    }, //
  }, //
  typography: { //
    fontFamily: 'Roboto, sans-serif', //
  }, //
}); //


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
        <ThemeProvider theme={theme}>
            <CssBaseline /> 
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
                        <main className="main-content flex-grow p-4">
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
        </ThemeProvider>
    );
}

function Header() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);

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
            className="flex flex-col h-full bg-gray-800 text-white"
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
                                    // Ajuste de cores para o Drawer
                                    '&.Mui-selected': {
                                        backgroundColor: theme.palette.primary.main, // Cor do tema para o item selecionado
                                        '&:hover': {
                                            backgroundColor: theme.palette.primary.dark, //
                                        }, //
                                    }, //
                                    '&:hover': {
                                        backgroundColor: 'rgba(255,255,255,0.15)', // Um hover mais visível
                                    }, //
                                    px: 2,
                                    color: 'white', // Garante que o texto seja branco no drawer
                                }}
                            >
                                <ListItemText primary={item.text} sx={{ color: 'inherit' }} /> {/* Herda a cor do ListItemButton */}
                            </ListItemButton>
                        </ListItem>
                    )
                ))}
            </List>
            {user && (
                <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }} className="text-sm">
                    <Typography className="mb-2 text-white">Olá, {user.nome}! ({user.perfil})</Typography>
                    <Button
                        variant="contained"
                        color="error"
                        fullWidth
                        onClick={logout}
                        sx={{
                            backgroundColor: '#D32F2F', // Vermelho mais forte
                            '&:hover': {
                                backgroundColor: '#B71C1C', // Tom mais escuro no hover
                            }, //
                        }} //
                    >
                        Sair
                    </Button>
                </Box>
            )}
        </Box>
    );

    return (
        <AppBar position="static" sx={{ bgcolor: theme.palette.background.appBar, boxShadow: 6 }}> {/* Usa a cor definida no tema, e sombra mais forte */}
            <Toolbar sx={{ minHeight: '64px', '@media (min-width:600px)': { minHeight: '64px' } }} className="flex justify-between items-center px-4 sm:px-6 lg:px-8"> {/* Garante altura mínima para um bom visual */}
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}> {/* Texto mais em negrito para o logo */}
                    <Link to={user ? "/dashboard" : "/"} className="text-white no-underline hover:text-gray-200">
                        Bios Store
                    </Link>
                </Typography>

                {user && (
                    <>
                        {/* Menu para telas maiores (desktop) */}
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }} className="ml-auto"> {/* Reduz o gap entre os botões para melhor aproveitamento do espaço */}
                            {menuItems.map((item) => (
                                (item.roles.includes(user.perfil)) && (
                                    <Button
                                        key={item.text}
                                        component={Link}
                                        to={item.path}
                                        color="inherit" // Mantém a cor base do AppBar (branca)
                                        className={`capitalize px-3 py-2 text-sm font-medium transition-colors duration-200 ease-in-out
                                            ${isLinkActive(item.path)
                                                ? 'bg-blue-600 text-white hover:bg-blue-700' // Cor de destaque para ativo
                                                : 'text-white hover:bg-gray-700 hover:text-white' // Cores para inativo no hover
                                            }`}
                                        sx={{
                                            borderRadius: 1,
                                            minWidth: 'auto', // Ajusta largura mínima
                                            padding: '8px 12px', // Ajusta padding para botões
                                            fontSize: '0.875rem' // Tamanho da fonte
                                        }} //
                                    >
                                        {item.text}
                                    </Button>
                                )
                            ))}
                            {/* Info do usuário (DESKTOP) */}
                            <Box className="flex items-center gap-2 ml-4">
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }} className="whitespace-nowrap"> {/* Texto mais discreto */}
                                    Olá, {user.nome}! ({user.perfil})
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="error"
                                    size="small"
                                    onClick={logout}
                                    sx={{
                                        backgroundColor: '#D32F2F', // Vermelho mais forte
                                        '&:hover': {
                                            backgroundColor: '#B71C1C', // Tom mais escuro no hover
                                        }, //
                                    }} //
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
                            sx={{ display: { md: 'none' }, color: 'white' }} // Garante que o ícone seja branco
                        >
                            <MenuIcon />
                        </IconButton>

                        {/* Drawer (Menu Lateral) */}
                        <Drawer
                            anchor="right"
                            open={drawerOpen}
                            onClose={toggleDrawer(false)}
                            PaperProps={{ // Estilo para o Paper do Drawer
                                sx: {
                                    backgroundColor: theme.palette.background.appBar, // Fundo do drawer igual ao AppBar
                                    color: 'white', // Texto branco
                                }, //
                            }} //
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
// frontend/src/App.jsx
import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@components/AuthProvider.jsx'; // Caminho atualizado

// Importações das páginas (caminhos atualizados)
import LoginPage from '@pages/LoginPage.jsx';
import DashboardPage from '@pages/DashboardPage.jsx';
import ClientsPage from '@pages/ClientsPage.jsx';
import ClientForm from '@components/ClientForm.jsx'; // Caminho atualizado
import ClientDetailsPage from '@pages/ClientDetailsPage.jsx';
import CarnesPage from '@pages/CarnesPage.jsx';
import CarneForm from '@pages/CarneForm.jsx';
import CarneDetailsPage from '@pages/CarneDetailsPage.jsx';
import NovaVendaPage from '@pages/NovaVendaPage.jsx';
import ReceiptsReportPage from '@pages/ReceiptsReportPage.jsx';
import PendingDebtsReportPage from '@pages/PendingDebtsReportPage.jsx';
import ProfilePage from '@pages/ProfilePage.jsx';
import RegisterUserPage from '@pages/RegisterUserPage.jsx';
import RegisterAdminPage from '@pages/RegisterAdminPage.jsx';
import RegisterUserByAdminPage from '@pages/RegisterUserByAdminPage.jsx';

// Importações para produtos (caminhos atualizados)
import ProdutosPage from '@pages/ProdutosPage.jsx';
import ProdutoFormPage from '@pages/ProdutoFormPage.jsx';

// Seu GlobalAlert e Contexto (caminhos atualizados)
import GlobalAlert from '@components/GlobalAlert.jsx';
import LoadingSpinner from '@components/LoadingSpinner.jsx';

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
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

// Ícones do Material-UI
import MenuIcon from '@mui/icons-material/Menu';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

// Material-UI para tema e normalização de CSS
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';


// Definição do Tema Material-UI para consistência de design
const theme = createTheme({
  palette: {
    primary: {
      main: '#3F51B5', // Azul primário mais vibrante
    },
    secondary: {
      main: '#FFC107', // Amarelo/laranja para destaque
    },
    error: {
      main: '#D32F2F', // Vermelho padrão para erros
    },
    background: {
      default: '#f4f7f6', // Fundo claro da página
      paper: '#FFFFFF', // Fundo de componentes como cards e modais
      appBar: '#2C3E50', // Cor de fundo para a AppBar (cabeçalho), um azul escuro moderno
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif', // Fonte padrão para o aplicativo
  },
});


const GlobalAlertContext = createContext(null);
export const useGlobalAlert = () => useContext(GlobalAlertContext);

// Componente para rotas privadas (requer autenticação)
const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingSpinner message="Verificando autenticação..." />;
    return user ? children : <Navigate to="/" />;
};

// Componente para rotas de administrador (requer perfil 'admin')
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

// Componente principal da aplicação
function App() {
    const [globalAlert, setGlobalAlert] = useState(null);
    const clearGlobalAlert = () => setGlobalAlert(null);

    return (
        // ThemeProvider e CssBaseline para aplicar o tema e normalizar estilos globalmente
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {/* BrowserRouter (Router) para gerenciar o roteamento da aplicação */}
            <Router>
                {/* AuthProvider para gerenciar o estado de autenticação do usuário */}
                <AuthProvider>
                    {/* GlobalAlertContext.Provider para gerenciar alertas globais */}
                    <GlobalAlertContext.Provider value={{ setGlobalAlert, clearGlobalAlert }}>
                        {/* Header do aplicativo (barra de navegação) */}
                        <Header />
                        {/* Exibe o GlobalAlert se houver uma mensagem */}
                        {globalAlert && (
                            <GlobalAlert
                                message={globalAlert.message}
                                type={globalAlert.type}
                                onClose={clearGlobalAlert}
                            />
                        )}
                        {/* Conteúdo principal da aplicação, com flex-grow para ocupar espaço disponível */}
                        <main className="main-content flex-grow p-4">
                            {/* Rotas da aplicação */}
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

// Componente Header (Cabeçalho da aplicação)
function Header() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Estados e handlers para os menus suspensos de Relatórios e Registros
    const [anchorElReports, setAnchorElReports] = useState(null);
    const openReportsMenu = Boolean(anchorElReports);

    const [anchorElRegisters, setAnchorElRegisters] = useState(null);
    const openRegistersMenu = Boolean(anchorElRegisters);

    const handleClickReports = (event) => {
        setAnchorElReports(event.currentTarget);
    };

    const handleCloseReports = () => {
        setAnchorElReports(null);
    };

    const handleClickRegisters = (event) => {
        setAnchorElRegisters(event.currentTarget);
    };

    const handleCloseRegisters = () => {
        setAnchorElRegisters(null);
    };

    // Lógica para abrir/fechar o Drawer (menu lateral mobile)
    const toggleDrawer = (open) => (event) => {
        if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
            return;
        }
        setDrawerOpen(open);
    };

    const closeDrawer = () => setDrawerOpen(false); // Função para fechar o Drawer

    // Verifica se o link atual está ativo para destacar no menu
    const isLinkActive = (path) => {
        if (path === '/') return location.pathname === path;
        // Verifica se o path exato ou um sub-caminho está ativo
        return location.pathname === path ||
               location.pathname.startsWith(path + '/') ||
               // Lida com paths com parâmetros como /clients/edit/:id
               (path.includes(':') && location.pathname.startsWith(path.substring(0, path.indexOf(':'))));
    };

    // Definição dos itens do menu, incluindo os novos grupos com sub-itens e ícones
    const menuItems = [
        { text: 'Dashboard', path: '/dashboard', roles: ['admin', 'atendente'], type: 'link' },
        { text: 'Nova Venda', path: '/nova-venda', roles: ['admin', 'atendente'], type: 'link' },
        { text: 'Clientes', path: '/clients', roles: ['admin', 'atendente'], type: 'link' },
        { text: 'Carnês', path: '/carnes', roles: ['admin', 'atendente'], type: 'link' },
        { text: 'Produtos', path: '/produtos', roles: ['admin', 'atendente'], type: 'link' },
        // Item de menu agrupado para Relatórios
        {
            text: 'Relatórios',
            icon: <AssessmentIcon sx={{ mr: 0.5 }} />, // Ícone para o botão de Relatórios
            roles: ['admin', 'atendente'], // Perfis que podem ver este menu
            type: 'menu', // Indica que é um menu suspenso
            subItems: [ // Sub-itens do menu de Relatórios
                { text: 'Recebimentos', path: '/reports/receipts', roles: ['admin', 'atendente'] },
                { text: 'Dívidas Pendentes', path: '/reports/pending-debts-by-client', roles: ['admin', 'atendente'] },
            ]
        },
        // Item de menu agrupado para Registros
        {
            text: 'Registros',
            icon: <PersonAddIcon sx={{ mr: 0.5 }} />, // Ícone para o botão de Registros
            roles: ['admin'], // Perfis que podem ver este menu (geralmente só admin)
            type: 'menu', // Indica que é um menu suspenso
            subItems: [ // Sub-itens do menu de Registros
                { text: 'Novo Administrador', path: '/register-admin', roles: ['admin'] },
                { text: 'Novo Atendente', path: '/register-atendente', roles: ['admin'] },
            ]
        },
        { text: 'Meu Perfil', path: '/profile', roles: ['admin', 'atendente'], type: 'link' },
    ];

    // Conteúdo para o Drawer (menu lateral mobile)
    const drawerContent = (
        <Box
            sx={{ width: 250 }}
            role="presentation"
            onClick={toggleDrawer(false)} // Fecha o drawer ao clicar em qualquer lugar
            onKeyDown={toggleDrawer(false)} // Fecha o drawer ao usar teclado
            className="flex flex-col h-full bg-gray-800 text-white" // Estilos Tailwind para o drawer
        >
            <Typography variant="h6" component="div" sx={{ p: 2, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                Navegação
            </Typography>
            <List className="flex-grow">
                {user && menuItems.map((item) => (
                    // Renderiza links diretos ou sub-menus no Drawer (menu lateral)
                    item.type === 'link' && item.roles.includes(user.perfil) ? (
                        <ListItem key={item.text} disablePadding>
                            <ListItemButton
                                component={Link}
                                to={item.path}
                                selected={isLinkActive(item.path)}
                                sx={{
                                    // Estilos para item de menu selecionado no drawer
                                    '&.Mui-selected': {
                                        backgroundColor: theme.palette.primary.main,
                                        '&:hover': { backgroundColor: theme.palette.primary.dark },
                                    },
                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)' },
                                    px: 2,
                                    color: 'white', // Garante que o texto seja branco
                                }}
                            >
                                {item.icon && <span style={{ marginRight: '8px' }}>{item.icon}</span>} {/* Exibe ícone se definido */}
                                <ListItemText primary={item.text} sx={{ color: 'inherit' }} />
                            </ListItemButton>
                        </ListItem>
                    ) : item.type === 'menu' && item.roles.includes(user.perfil) && (
                        // Renderiza o item pai do menu agrupado no drawer
                        <React.Fragment key={item.text}>
                            <ListItem disablePadding>
                                <ListItemButton sx={{ px: 2, color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)' }}}>
                                    {item.icon && <span style={{ marginRight: '8px' }}>{item.icon}</span>}
                                    <ListItemText primary={item.text} />
                                    <ArrowDropDownIcon sx={{ color: 'white' }} /> {/* Ícone de seta para indicar sub-menu */}
                                </ListItemButton>
                            </ListItem>
                            {/* Lista de sub-itens indentados no drawer */}
                            <List component="div" disablePadding sx={{ pl: 2 }}>
                                {item.subItems.map((subItem) => (
                                    subItem.roles.includes(user.perfil) && (
                                        <ListItem key={subItem.text} disablePadding>
                                            <ListItemButton
                                                component={Link}
                                                to={subItem.path}
                                                selected={isLinkActive(subItem.path)}
                                                sx={{
                                                    '&.Mui-selected': {
                                                        backgroundColor: theme.palette.primary.main,
                                                        '&:hover': { backgroundColor: theme.palette.primary.dark },
                                                    },
                                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)' },
                                                    px: 2,
                                                    color: 'white',
                                                }}
                                            >
                                                <ListItemText primary={subItem.text} sx={{ color: 'inherit' }} />
                                            </ListItemButton>
                                        </ListItem>
                                    )
                                ))}
                            </List>
                        </React.Fragment>
                    )
                ))}
            </List>
            {/* Seção de informações do usuário e botão Sair no Drawer */}
            {user && (
                <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }} className="text-sm">
                    <Typography className="mb-2 text-white">Olá, {user.nome}! ({user.perfil})</Typography>
                    <Button
                        variant="contained"
                        color="error"
                        fullWidth
                        onClick={logout}
                        sx={{
                            backgroundColor: '#D32F2F', // Vermelho forte
                            '&:hover': {
                                backgroundColor: '#B71C1C', // Tom mais escuro no hover
                            },
                        }}
                    >
                        Sair
                    </Button>
                </Box>
            )}
        </Box>
    );

    return (
        <AppBar position="static" sx={{ bgcolor: theme.palette.background.appBar, boxShadow: 6 }}> {/* AppBar com fundo escuro e sombra */}
            <Toolbar sx={{ minHeight: '64px', '@media (min-width:600px)': { minHeight: '64px' } }} className="flex justify-between items-center px-4 sm:px-6 lg:px-8">
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    <Link to={user ? "/dashboard" : "/"} className="text-white no-underline hover:text-gray-200">
                        Bios Store
                    </Link>
                </Typography>

                {user && (
                    <>
                        {/* Menu para telas maiores (desktop) */}
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }} className="ml-auto">
                            {menuItems.map((item) => (
                                (item.roles.includes(user.perfil)) && (
                                    item.type === 'link' ? ( // Renderiza um botão de link direto
                                        <Button
                                            key={item.text}
                                            component={Link}
                                            to={item.path}
                                            color="inherit" // Mantém a cor base do AppBar (branca para o texto)
                                            className={`capitalize px-3 py-2 text-sm font-medium transition-colors duration-200 ease-in-out
                                                ${isLinkActive(item.path)
                                                    ? 'bg-blue-600 text-white hover:bg-blue-700' // Estilo para item ativo
                                                    : 'text-white hover:bg-gray-700 hover:text-white' // Estilo para item inativo
                                                }`}
                                            sx={{
                                                borderRadius: 1,
                                                minWidth: 'auto', // Ajusta largura mínima
                                                padding: '8px 12px', // Ajusta padding para botões
                                                fontSize: '0.875rem' // Tamanho da fonte
                                            }}
                                        >
                                            {item.text}
                                        </Button>
                                    ) : ( // Renderiza um botão que abre um menu suspenso
                                        <React.Fragment key={item.text}>
                                            <Button
                                                id={`${item.text.toLowerCase().replace(' ', '-')}-button`}
                                                aria-controls={
                                                    (item.text === 'Relatórios' && openReportsMenu) ||
                                                    (item.text === 'Registros' && openRegistersMenu) ?
                                                    `${item.text.toLowerCase().replace(' ', '-')}-menu` : undefined
                                                }
                                                aria-haspopup="true"
                                                aria-expanded={
                                                    (item.text === 'Relatórios' && openReportsMenu) ||
                                                    (item.text === 'Registros' && openRegistersMenu) ? 'true' : undefined
                                                }
                                                onClick={item.text === 'Relatórios' ? handleClickReports : handleClickRegisters}
                                                color="inherit"
                                                className={`capitalize px-3 py-2 text-sm font-medium transition-colors duration-200 ease-in-out text-white hover:bg-gray-700 hover:text-white`}
                                                sx={{
                                                    borderRadius: 1,
                                                    minWidth: 'auto',
                                                    padding: '8px 12px',
                                                    fontSize: '0.875rem',
                                                    // Adicionar um fundo azul se algum subitem deste menu estiver ativo
                                                    ...(item.subItems.some(sub => isLinkActive(sub.path)) && {
                                                        backgroundColor: 'rgb(37 99 235 / var(--tw-bg-opacity))', // Tailwind: bg-blue-600
                                                        '&:hover': {
                                                            backgroundColor: 'rgb(29 78 216 / var(--tw-bg-opacity))', // Tailwind: hover:bg-blue-700
                                                        }
                                                    })
                                                }}
                                            >
                                                {item.icon} {item.text} <ArrowDropDownIcon />
                                            </Button>
                                            <Menu
                                                id={`${item.text.toLowerCase().replace(' ', '-')}-menu`}
                                                anchorEl={item.text === 'Relatórios' ? anchorElReports : anchorElRegisters}
                                                open={item.text === 'Relatórios' ? openReportsMenu : openRegistersMenu}
                                                onClose={item.text === 'Relatórios' ? handleCloseReports : handleCloseRegisters}
                                                MenuListProps={{
                                                    'aria-labelledby': `${item.text.toLowerCase().replace(' ', '-')}-button`,
                                                }}
                                                sx={{
                                                    // Estilo do papel/fundo do menu suspenso
                                                    '& .MuiPaper-root': {
                                                        backgroundColor: theme.palette.background.appBar, // Fundo escuro
                                                        color: 'white',
                                                    },
                                                    // Estilo dos itens individuais do menu suspenso
                                                    '& .MuiMenuItem-root': {
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(255,255,255,0.1)', // Hover suave
                                                        },
                                                        // Estilo para item selecionado dentro do menu suspenso
                                                        '&.Mui-selected': {
                                                            backgroundColor: theme.palette.primary.main,
                                                            '&:hover': {
                                                                backgroundColor: theme.palette.primary.dark,
                                                            },
                                                        }
                                                    }
                                                }}
                                            >
                                                {item.subItems.map((subItem) => (
                                                    subItem.roles.includes(user.perfil) && (
                                                        <MenuItem
                                                            key={subItem.text}
                                                            onClick={item.text === 'Relatórios' ? handleCloseReports : handleCloseRegisters}
                                                            component={Link}
                                                            to={subItem.path}
                                                            selected={isLinkActive(subItem.path)}
                                                        >
                                                            {subItem.text}
                                                        </MenuItem>
                                                    )
                                                ))}
                                            </Menu>
                                        </React.Fragment>
                                    )
                                )
                            ))}
                            {/* Informações do usuário (desktop) */}
                            <Box className="flex items-center gap-2 ml-4">
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }} className="whitespace-nowrap">
                                    Olá, {user.nome}! ({user.perfil})
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="error"
                                    size="small"
                                    onClick={logout}
                                    sx={{
                                        backgroundColor: '#D32F2F',
                                        '&:hover': {
                                            backgroundColor: '#B71C1C',
                                        },
                                    }}
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
                            sx={{ display: { md: 'none' }, color: 'white' }}
                        >
                            <MenuIcon />
                        </IconButton>

                        {/* Drawer (Menu Lateral) para mobile */}
                        <Drawer
                            anchor="right"
                            open={drawerOpen}
                            onClose={toggleDrawer(false)}
                            PaperProps={{
                                sx: {
                                    backgroundColor: theme.palette.background.appBar,
                                    color: 'white',
                                },
                            }}
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
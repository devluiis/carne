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

// <<<< NOVAS IMPORTAÇÕES PARA PRODUTOS >>>>
import ProdutosPage from './pages/ProdutosPage.jsx';
import ProdutoFormPage from './pages/ProdutoFormPage.jsx';


// Seu GlobalAlert e Contexto
import GlobalAlert from './components/GlobalAlert.jsx';
const GlobalAlertContext = createContext(null);
export const useGlobalAlert = () => useContext(GlobalAlertContext);

// Componente de Spinner simples (pode ser movido para components/ se preferir)
const LoadingSpinner = ({ message }) => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', flexDirection: 'column' }}>
        {/* Se você tiver um CSS para loading-spinner-animation, ótimo! Senão, um texto simples. */}
        <div className="loading-spinner-animation" style={{border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite'}}></div>
        <p style={{marginTop: '10px'}}>{message || 'Carregando...'}</p>
        <style>
            {`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}
        </style>
    </div>
);

// Componentes de Rota Protegida
const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return <LoadingSpinner message="Verificando autenticação..." />;
    }
    return user ? children : <Navigate to="/" />;
};

const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const alertContext = useContext(GlobalAlertContext); 

    if (loading) {
        return <LoadingSpinner message="Verificando permissões..." />;
    }
    if (!user) {
        return <Navigate to="/" />;
    }
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
                    <main className="main-content">
                        <Routes>
                            <Route path="/" element={<LoginPage />} />
                            <Route path="/register-user" element={<RegisterUserPage />} />

                            {/* Rotas Privadas */}
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
                            
                            {/* <<<< NOVAS ROTAS PARA PRODUTOS >>>> */}
                            <Route path="/produtos" element={<PrivateRoute><ProdutosPage /></PrivateRoute>} />
                            <Route path="/produtos/novo" element={<AdminRoute><ProdutoFormPage /></AdminRoute>} /> {/* Apenas admin cria */}
                            <Route path="/produtos/editar/:id" element={<AdminRoute><ProdutoFormPage /></AdminRoute>} /> {/* Apenas admin edita */}
                            
                            <Route path="/reports/receipts" element={<PrivateRoute><ReceiptsReportPage /></PrivateRoute>} />
                            <Route path="/reports/pending-debts-by-client/:client_id?" element={<PrivateRoute><PendingDebtsReportPage /></PrivateRoute>} />
                            
                            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

                            {/* Rotas de Admin */}
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

    const isLinkActive = (path) => {
        if (path === '/') return location.pathname === path;
        // Verifica se o pathname é exatamente igual ao path ou se começa com o path seguido de uma barra (para sub-rotas)
        // ou se o path é uma sub-rota do pathname atual (para links como /reports/pending-debts-by-client quando o ID está na URL)
        return location.pathname === path || 
               location.pathname.startsWith(path + '/') || 
               (path.includes(':') && location.pathname.startsWith(path.substring(0, path.indexOf(':'))));
    };

    const activeLinkStyle = { backgroundColor: '#555', padding: '10px 15px', borderRadius: '5px', color: 'white', textDecoration: 'none', transition: 'background-color 0.2s ease', display: 'inline-block' };
    const inactiveLinkStyle = { padding: '10px 15px', color: 'white', textDecoration: 'none', transition: 'background-color 0.2s ease', display: 'inline-block' };
    const listItemStyle = { marginRight: '5px' };


    return (
        <header>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
                <Link to={user ? "/dashboard" : "/"} style={{ color: 'white', textDecoration: 'none' }}>
                    Gestor de Carnês
                </Link>
            </h1>
            {user && (
                <nav style={{ display: 'flex', alignItems: 'center' }}>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                        <li style={listItemStyle}><Link to="/dashboard" style={isLinkActive('/dashboard') ? activeLinkStyle : inactiveLinkStyle}>Dashboard</Link></li>
                        <li style={listItemStyle}><Link to="/nova-venda" style={isLinkActive('/nova-venda') ? activeLinkStyle : inactiveLinkStyle}>Nova Venda</Link></li>
                        <li style={listItemStyle}><Link to="/clients" style={isLinkActive('/clients') ? activeLinkStyle : inactiveLinkStyle}>Clientes</Link></li>
                        <li style={listItemStyle}><Link to="/carnes" style={isLinkActive('/carnes') ? activeLinkStyle : inactiveLinkStyle}>Carnês</Link></li>
                        
                        {/* <<<< NOVO LINK PARA PRODUTOS >>>> */}
                        <li style={listItemStyle}><Link to="/produtos" style={isLinkActive('/produtos') ? activeLinkStyle : inactiveLinkStyle}>Produtos</Link></li>
                        
                        <li style={listItemStyle}><Link to="/reports/receipts" style={isLinkActive('/reports/receipts') ? activeLinkStyle : inactiveLinkStyle}>Rel. Receb.</Link></li>
                        <li style={listItemStyle}><Link to="/reports/pending-debts-by-client" style={isLinkActive('/reports/pending-debts-by-client') ? activeLinkStyle : inactiveLinkStyle}>Rel. Dívidas</Link></li>
                        
                        {user.perfil === 'admin' && ( 
                            <>
                                <li style={listItemStyle}><Link to="/register-admin" style={isLinkActive('/register-admin') ? activeLinkStyle : inactiveLinkStyle}>Reg. Admin</Link></li>
                                <li style={listItemStyle}><Link to="/register-atendente" style={isLinkActive('/register-atendente') ? activeLinkStyle : inactiveLinkStyle}>Reg. Atendente</Link></li>
                            </>
                        )}
                        <li style={listItemStyle}><Link to="/profile" style={isLinkActive('/profile') ? activeLinkStyle : inactiveLinkStyle}>Meu Perfil</Link></li>
                    </ul>
                    <div style={{ marginLeft: '20px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                         <span style={{ marginRight: '10px' }}>Olá, {user.nome}! ({user.perfil})</span>
                        <button onClick={logout} className="btn btn-danger btn-sm" style={{width: 'auto', padding: '8px 12px'}}>Sair</button>
                    </div>
                </nav>
            )}
        </header>
    );
}

export default App;
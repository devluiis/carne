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

// Componente de Spinner
import LoadingSpinner from './components/LoadingSpinner.jsx';


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
                            <Route path="/produtos/novo" element={<AdminRoute><ProdutoFormPage /></AdminRoute>} /> 
                            <Route path="/produtos/editar/:id" element={<AdminRoute><ProdutoFormPage /></AdminRoute>} /> 
                            
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
    const [isMenuOpen, setIsMenuOpen] = useState(false); // NOVO ESTADO AQUI

    const toggleMenu = () => { // NOVA FUNÇÃO PARA ALTERNAR O MENU
        setIsMenuOpen(!isMenuOpen);
    };

    const isLinkActive = (path) => {
        if (path === '/') return location.pathname === path;
        return location.pathname === path || 
               location.pathname.startsWith(path + '/') || 
               (path.includes(':') && location.pathname.startsWith(path.substring(0, path.indexOf(':'))));
    };

    const activeLinkClass = "active-link"; 
    const inactiveLinkClass = ""; 

    return (
        <header className="main-header"> 
            {user && ( // O hambúrguer só aparece se o usuário estiver logado
                <button className={`hamburger-menu ${isMenuOpen ? 'open' : ''}`} onClick={toggleMenu}>
                    <span className="hamburger-icon"></span>
                    <span className="hamburger-icon"></span>
                    <span className="hamburger-icon"></span>
                </button>
            )}
            <h1 className="app-title"> 
                <Link to={user ? "/dashboard" : "/"} style={{ color: 'white', textDecoration: 'none' }}>
                    Gestor de Carnês
                </Link>
            </h1>
            
            {user && (
                <div className="user-info-section-mobile"> 
                    <span className="user-name-mobile">Olá, {user.nome}! ({user.perfil})</span>
                    <button onClick={logout} className="btn btn-danger btn-sm">Sair</button>
                </div>
            )}

            {user && (
                <nav className={`main-nav ${isMenuOpen ? 'open' : ''}`}> 
                    <ul className="nav-list"> 
                        <li className="nav-item"><Link to="/dashboard" className={isLinkActive('/dashboard') ? activeLinkClass : inactiveLinkClass}>Dashboard</Link></li>
                        <li className="nav-item"><Link to="/nova-venda" className={isLinkActive('/nova-venda') ? activeLinkClass : inactiveLinkClass}>Nova Venda</Link></li>
                        <li className="nav-item"><Link to="/clients" className={isLinkActive('/clients') ? activeLinkClass : inactiveLinkClass}>Clientes</Link></li>
                        <li className="nav-item"><Link to="/carnes" className={isLinkActive('/carnes') ? activeLinkClass : inactiveLinkClass}>Carnês</Link></li>
                        
                        <li className="nav-item"><Link to="/produtos" className={isLinkActive('/produtos') ? activeLinkClass : inactiveLinkClass}>Produtos</Link></li>
                        
                        <li className="nav-item"><Link to="/reports/receipts" className={isLinkActive('/reports/receipts') ? activeLinkClass : inactiveLinkClass}>Rel. Receb.</Link></li>
                        <li className="nav-item"><Link to="/reports/pending-debts-by-client" className={isLinkActive('/reports/pending-debts-by-client') ? activeLinkClass : inactiveLinkClass}>Rel. Dívidas</Link></li>
                        
                        {user.perfil === 'admin' && ( 
                            <>
                                <li className="nav-item"><Link to="/register-admin" className={isLinkActive('/register-admin') ? activeLinkClass : inactiveLinkClass}>Reg. Admin</Link></li>
                                <li className="nav-item"><Link to="/register-atendente" className={isLinkActive('/register-atendente') ? activeLinkClass : inactiveLinkClass}>Reg. Atendente</Link></li>
                            </>
                        )}
                        <li className="nav-item"><Link to="/profile" className={isLinkActive('/profile') ? activeLinkClass : inactiveLinkClass}>Meu Perfil</Link></li>
                    </ul>
                </nav>
            )}
        </header>
    );
}

export default App;
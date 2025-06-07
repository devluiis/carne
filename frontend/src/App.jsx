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
                    <main className="main-content">
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
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    const closeMenu = () => setIsMenuOpen(false);

    const isLinkActive = (path) => {
        if (path === '/') return location.pathname === path;
        return location.pathname === path || 
               location.pathname.startsWith(path + '/') || 
               (path.includes(':') && location.pathname.startsWith(path.substring(0, path.indexOf(':'))));
    };

    return (
        <header>
            <h1>
                <Link to={user ? "/dashboard" : "/"} className="app-title-link">
                    Gestor de Carnês
                </Link>
            </h1>

            {user && (
                <>
                    <button className="menu-toggle" onClick={toggleMenu} aria-label="Abrir Menu">☰</button>
                    {isMenuOpen && <div className="menu-overlay" onClick={closeMenu}></div>}

                    <nav className={`main-nav ${isMenuOpen ? 'menu-open' : ''}`}>
                        <button className="close-menu-button" onClick={closeMenu} aria-label="Fechar Menu">&times;</button>
                        <ul className="nav-list">
                            <li><Link to="/dashboard" className={isLinkActive('/dashboard') ? "nav-link active" : "nav-link"} onClick={closeMenu}>Dashboard</Link></li>
                            <li><Link to="/nova-venda" className={isLinkActive('/nova-venda') ? "nav-link active" : "nav-link"} onClick={closeMenu}>Nova Venda</Link></li>
                            <li><Link to="/clients" className={isLinkActive('/clients') ? "nav-link active" : "nav-link"} onClick={closeMenu}>Clientes</Link></li>
                            <li><Link to="/carnes" className={isLinkActive('/carnes') ? "nav-link active" : "nav-link"} onClick={closeMenu}>Carnês</Link></li>
                            <li><Link to="/produtos" className={isLinkActive('/produtos') ? "nav-link active" : "nav-link"} onClick={closeMenu}>Produtos</Link></li>
                            <li><Link to="/reports/receipts" className={isLinkActive('/reports/receipts') ? "nav-link active" : "nav-link"} onClick={closeMenu}>Rel. Receb.</Link></li>
                            <li><Link to="/reports/pending-debts-by-client" className={isLinkActive('/reports/pending-debts-by-client') ? "nav-link active" : "nav-link"} onClick={closeMenu}>Rel. Dívidas</Link></li>
                            {user.perfil === 'admin' && (
                                <>
                                    <li><Link to="/register-admin" className={isLinkActive('/register-admin') ? "nav-link active" : "nav-link"} onClick={closeMenu}>Reg. Admin</Link></li>
                                    <li><Link to="/register-atendente" className={isLinkActive('/register-atendente') ? "nav-link active" : "nav-link"} onClick={closeMenu}>Reg. Atendente</Link></li>
                                </>
                            )}
                            <li><Link to="/profile" className={isLinkActive('/profile') ? "nav-link active" : "nav-link"} onClick={closeMenu}>Meu Perfil</Link></li>
                        </ul>
                        <div className="user-info mobile-only-user-info-section">
                            <span>Olá, {user.nome}! ({user.perfil})</span>
                            <button onClick={() => { logout(); closeMenu(); }} className="btn btn-danger btn-sm logout-btn-mobile">Sair</button>
                        </div>
                    </nav>

                    <div className="user-info">
                        <span>Olá, {user.nome}! ({user.perfil})</span>
                        <button onClick={logout} className="btn btn-danger btn-sm logout-btn">Sair</button>
                    </div>
                </>
            )}
        </header>
    );
}

export default App;

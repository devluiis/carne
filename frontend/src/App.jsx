import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import ClientForm from './components/ClientForm.jsx';
import CarneDetailsPage from './pages/CarneDetailsPage.jsx';
import CarnesPage from './pages/CarnesPage.jsx';
import CarneForm from './pages/CarneForm.jsx';
import RegisterAdminPage from './pages/RegisterAdminPage.jsx';
import RegisterUserPage from './pages/RegisterUserPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ClientDetailsPage from './pages/ClientDetailsPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ReceiptsReportPage from './pages/ReceiptsReportPage.jsx';
import PendingDebtsReportPage from './pages/PendingDebtsReportPage.jsx';
import GlobalAlert from './components/GlobalAlert.jsx';
import RegisterUserByAdminPage from './pages/RegisterUserByAdminPage.jsx'; // NOVO: Importar a nova página

const GlobalAlertContext = createContext(null);
export const useGlobalAlert = () => useContext(GlobalAlertContext);


const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <p>Carregando autenticação...</p>;
    }

    return user ? children : <Navigate to="/" />;
};

const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <p>Carregando autenticação...</p>;
    }

    if (!user) {
        return <Navigate to="/" />;
    }
    if (user.perfil !== 'admin') {
        const { setGlobalAlert } = useContext(GlobalAlertContext);
        setGlobalAlert({ message: 'Acesso negado. Você não tem permissão de administrador para esta funcionalidade.', type: 'error' });
        return <Navigate to="/clients" />;
    }
    return children;
};


function App() {
    const [globalAlert, setGlobalAlert] = useState(null);

    const clearGlobalAlert = () => {
        setGlobalAlert(null);
    };

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
                    <Routes>
                        <Route path="/" element={<LoginPage />} />
                        
                        <Route path="/register-user" element={<RegisterUserPage />} />

                        {/* Rota de Registro de Admin - Protegida por AdminRoute */}
                        <Route
                            path="/register-admin"
                            element={
                                <AdminRoute>
                                    <RegisterAdminPage />
                                </AdminRoute>
                            }
                        />

                        {/* NOVO: Rota para Registro de Atendente por Admin - Protegida por AdminRoute */}
                        <Route
                            path="/register-atendente"
                            element={
                                <AdminRoute>
                                    <RegisterUserByAdminPage />
                                </AdminRoute>
                            }
                        />

                        <Route
                            path="/profile"
                            element={
                                <PrivateRoute>
                                    <ProfilePage />
                                </PrivateRoute>
                            }
                        />

                        <Route
                            path="/dashboard"
                            element={
                                <PrivateRoute>
                                    <DashboardPage />
                                </PrivateRoute>
                            }
                        />
                        
                        <Route
                            path="/reports/receipts"
                            element={
                                <PrivateRoute>
                                    <ReceiptsReportPage />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/reports/pending-debts-by-client/:client_id?"
                            element={
                                <PrivateRoute>
                                    <PendingDebtsReportPage />
                                </PrivateRoute>
                            }
                        />

                        <Route
                            path="/clients"
                            element={
                                <PrivateRoute>
                                    <ClientsPage />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/clients/new"
                            element={
                                <PrivateRoute>
                                    <ClientForm />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/clients/edit/:id"
                            element={
                                <PrivateRoute>
                                    <ClientForm />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/clients/details/:id"
                            element={
                                <PrivateRoute>
                                    <ClientDetailsPage />
                                </PrivateRoute>
                            }
                        />

                        <Route
                            path="/carnes"
                            element={
                                <PrivateRoute>
                                    <CarnesPage />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/clients/:id_cliente/carnes"
                            element={
                                <PrivateRoute>
                                    <CarnesPage />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/carnes/new/:clientIdFromUrl?"
                            element={
                                <PrivateRoute>
                                    <CarneForm />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/carnes/edit/:id"
                            element={
                                <PrivateRoute>
                                    <CarneForm />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/carnes/details/:id"
                            element={
                                <PrivateRoute>
                                    <CarneDetailsPage />
                                </PrivateRoute>
                            }
                        />
                    </Routes>
                </GlobalAlertContext.Provider>
            </AuthProvider>
        </Router>
    );
}

function Header() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const isLinkActive = (path) => {
        if (path === '/dashboard' && location.pathname === '/dashboard') return true;
        if (path === '/clients' && location.pathname.startsWith('/clients')) return true;
        if (path === '/carnes' && location.pathname.startsWith('/carnes')) return true;
        if (path === '/reports/receipts' && location.pathname === '/reports/receipts') return true;
        if (path === '/reports/pending-debts-by-client/0' && location.pathname.startsWith('/reports/pending-debts-by-client')) return true;
        if (path === '/profile' && location.pathname === '/profile') return true;
        if (path === '/register-admin' && location.pathname === '/register-admin') return true;
        if (path === '/register-atendente' && location.pathname === '/register-atendente') return true; // NOVO: Para ativar o link do novo formulário

        return false; // Default para não ativo
    };


    const activeLinkStyle = {
        backgroundColor: '#555',
        padding: '10px 15px',
        borderRadius: '5px',
        color: 'white',
        textDecoration: 'none',
        transition: 'background-color 0.3s ease',
    };

    const inactiveLinkStyle = {
        padding: '10px 15px',
        color: 'white',
        textDecoration: 'none',
        transition: 'background-color 0.3s ease',
    };

    const listItemStyle = {
        marginRight: '10px',
    };

    return (
        <header style={{ background: '#333', color: 'white', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '24px' }}>Carnê de Pagamentos</h1>
            <nav>
                {user && (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex' }}>
                        <li style={listItemStyle}>
                            <Link to="/dashboard" style={isLinkActive('/dashboard') ? activeLinkStyle : inactiveLinkStyle}>Dashboard</Link>
                        </li>
                        <li style={listItemStyle}>
                            <Link to="/clients" style={isLinkActive('/clients') ? activeLinkStyle : inactiveLinkStyle}>Clientes</Link>
                        </li>
                        <li style={listItemStyle}>
                            <Link to="/carnes" style={isLinkActive('/carnes') ? activeLinkStyle : inactiveLinkStyle}>Carnês</Link>
                        </li>
                        <li style={listItemStyle}>
                            <Link to="/reports/receipts" style={isLinkActive('/reports/receipts') ? activeLinkStyle : inactiveLinkStyle}>Rel. Recebimentos</Link>
                        </li>
                        <li style={listItemStyle}>
                            <Link to="/reports/pending-debts-by-client/0" style={isLinkActive('/reports/pending-debts-by-client/0') ? activeLinkStyle : inactiveLinkStyle}>Rel. Dívidas Cli.</Link>
                        </li>
                        <li style={listItemStyle}>
                            <Link to="/profile" style={isLinkActive('/profile') ? activeLinkStyle : inactiveLinkStyle}>Meu Perfil</Link>
                        </li>
                        {user.perfil === 'admin' && ( 
                            <>
                                <li style={listItemStyle}>
                                    <Link to="/register-admin" style={isLinkActive('/register-admin') ? activeLinkStyle : inactiveLinkStyle}>Registrar Admin</Link>
                                </li>
                                <li style={listItemStyle}> {/* NOVO: Link para registrar atendente */}
                                    <Link to="/register-atendente" style={isLinkActive('/register-atendente') ? activeLinkStyle : inactiveLinkStyle}>Registrar Atendente</Link>
                                </li>
                            </>
                        )}
                    </ul>
                )}
            </nav>
            {user ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '15px' }}>Olá, {user.nome}! (Perfil: {user.perfil})</span>
                    <button onClick={logout} style={{ background: 'none', border: '1px solid white', color: 'white', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>Sair</button>
                </div>
            ) : (
                <p>Faça Login</p>
            )}
        </header>
    );
}

export default App;
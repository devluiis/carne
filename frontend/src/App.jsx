import React, { useState, createContext, useContext } from 'react'; // Importar createContext e useContext
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
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
import GlobalAlert from './components/GlobalAlert.jsx'; // NOVO: Importar GlobalAlert

// NOVO: Contexto para o alerta global
const GlobalAlertContext = createContext(null);
export const useGlobalAlert = () => useContext(GlobalAlertContext);


// Componente para rotas privadas
const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <p>Carregando autenticação...</p>;
    }

    return user ? children : <Navigate to="/" />;
};

// Componente para rotas restritas a administradores
const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <p>Carregando autenticação...</p>;
    }

    if (!user) {
        return <Navigate to="/" />;
    }
    if (user.perfil !== 'admin') {
        // Usa o alerta global para feedback ao usuário
        const { setGlobalAlert } = useContext(GlobalAlertContext);
        setGlobalAlert({ message: 'Acesso negado. Você não tem permissão de administrador para esta funcionalidade.', type: 'error' });
        return <Navigate to="/clients" />;
    }
    return children;
};


function App() {
    const [globalAlert, setGlobalAlert] = useState(null); // Estado para o alerta global

    const clearGlobalAlert = () => {
        setGlobalAlert(null);
    };

    return (
        <Router>
            <AuthProvider>
                <GlobalAlertContext.Provider value={{ setGlobalAlert, clearGlobalAlert }}> {/* Provedor do contexto */}
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
                        
                        {/* Rota de Registro de Usuário COMUM (Atendente) - RF001 */}
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

                        {/* Rota para o perfil do usuário */}
                        <Route
                            path="/profile"
                            element={
                                <PrivateRoute>
                                    <ProfilePage />
                                </PrivateRoute>
                            }
                        />

                        {/* Rota para o Dashboard (RF021) */}
                        <Route
                            path="/dashboard"
                            element={
                                <PrivateRoute>
                                    <DashboardPage />
                                </PrivateRoute>
                            }
                        />
                        
                        {/* Rota para o Relatório de Recebimentos por Período (RF022) */}
                        <Route
                            path="/reports/receipts"
                            element={
                                <PrivateRoute> {/* Acessível por qualquer usuário logado */}
                                    <ReceiptsReportPage />
                                </PrivateRoute>
                            }
                        />
                        {/* NOVO: Rota para o Relatório de Dívidas por Cliente (RF023) */}
                        <Route
                            path="/reports/pending-debts-by-client/:client_id"
                            element={
                                <PrivateRoute> {/* Acessível por qualquer usuário logado */}
                                    <PendingDebtsReportPage />
                                </PrivateRoute>
                            }
                        />

                        {/* Rotas de Clientes */}
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
                        {/* Rota para a página de detalhes/resumo do cliente (RF008) */}
                        <Route
                            path="/clients/details/:id"
                            element={
                                <PrivateRoute>
                                    <ClientDetailsPage />
                                </PrivateRoute>
                            }
                        />

                        {/* Rotas de Carnês */}
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
    return (
        <header style={{ background: '#333', color: 'white', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '24px' }}>Carnê de Pagamentos</h1>
            <nav>
                {user && (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex' }}>
                        <li style={{ marginRight: '20px' }}>
                            <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none' }}>Dashboard</Link>
                        </li>
                        <li style={{ marginRight: '20px' }}>
                            <Link to="/clients" style={{ color: 'white', textDecoration: 'none' }}>Clientes</Link>
                        </li>
                        <li style={{ marginRight: '20px' }}>
                            <Link to="/carnes" style={{ color: 'white', textDecoration: 'none' }}>Carnês</Link>
                        </li>
                        <li style={{ marginRight: '20px' }}>
                            {/* NOVO: Link para o Relatório de Recebimentos (RF022) */}
                            <Link to="/reports/receipts" style={{ color: 'white', textDecoration: 'none' }}>Rel. Recebimentos</Link>
                        </li>
                        <li style={{ marginRight: '20px' }}>
                            {/* NOVO: Link para o Relatório de Dívidas por Cliente (RF023) */}
                            <Link to="/reports/pending-debts-by-client/0" style={{ color: 'white', textDecoration: 'none' }}>Rel. Dívidas Cli.</Link>
                        </li>
                        <li style={{ marginRight: '20px' }}>
                            <Link to="/profile" style={{ color: 'white', textDecoration: 'none' }}>Meu Perfil</Link>
                        </li>
                        {user.perfil === 'admin' && ( 
                            <li style={{ marginRight: '20px' }}>
                                <Link to="/register-admin" style={{ color: 'white', textDecoration: 'none' }}>Registrar Admin</Link>
                            </li>
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
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
    // Adicionar classe 'menu-open' ao body quando o menu estiver aberto
    const { isMenuOpen } = useAuth().isMenuOpen; // Acessar o estado do menu do contexto, se movido para AuthProvider

    // Usar useEffect para adicionar/remover classe no body
    // useEffect(() => {
    //     if (isMenuOpen) {
    //         document.body.classList.add('menu-open');
    //     } else {
    //         document.body.classList.remove('menu-open');
    //     }
    // }, [isMenuOpen]);


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
    const [isMenuOpen, setIsMenuOpen] = useState(false); // Estado para controlar o menu hamburger

    // Adiciona/remove classe 'menu-open' do body para empurrar o conteúdo principal
    useEffect(() => {
        if (isMenuOpen) {
            document.body.classList.add('menu-open');
        } else {
            document.body.classList.remove('menu-open');
        }
    }, [isMenuOpen]);


    const toggleMenu = () => {
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
            {user && ( 
                <button className={`hamburger-menu ${isMenuOpen ? 'open' : ''}`} onClick={toggleMenu} aria-label="Abrir Menu">
                    <span className="hamburger-icon"></span>
                    <span className="hamburger-icon"></span>
                    <span className="hamburger-icon"></span>
                </button>
            )}
            <h1 className="app-title"> 
                <Link to={user ? "/dashboard" : "/"} className="text-white text-decoration-none"> {/* Classes Bootstrap */}
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
                    <ul className="navbar-nav"> {/* Usar navbar-nav do Bootstrap */}
                        <li className="nav-item"><Link to="/dashboard" className={`nav-link ${isLinkActive('/dashboard') ? activeLinkClass : inactiveLinkClass}`} onClick={toggleMenu}>Dashboard</Link></li>
                        <li className="nav-item"><Link to="/nova-venda" className={`nav-link ${isLinkActive('/nova-venda') ? activeLinkClass : inactiveLinkClass}`} onClick={toggleMenu}>Nova Venda</Link></li>
                        <li className="nav-item"><Link to="/clients" className={`nav-link ${isLinkActive('/clients') ? activeLinkClass : inactiveLinkClass}`} onClick={toggleMenu}>Clientes</Link></li>
                        <li className="nav-item"><Link to="/carnes" className={`nav-link ${isLinkActive('/carnes') ? activeLinkClass : inactiveLinkClass}`} onClick={toggleMenu}>Carnês</Link></li>
                        
                        <li className="nav-item"><Link to="/produtos" className={`nav-link ${isLinkActive('/produtos') ? activeLinkClass : inactiveLinkClass}`} onClick={toggleMenu}>Produtos</Link></li>
                        
                        <li className="nav-item"><Link to="/reports/receipts" className={`nav-link ${isLinkActive('/reports/receipts') ? activeLinkClass : inactiveLinkClass}`} onClick={toggleMenu}>Rel. Receb.</Link></li>
                        <li className="nav-item"><Link to="/reports/pending-debts-by-client" className={`nav-link ${isLinkActive('/reports/pending-debts-by-client') ? activeLinkClass : inactiveLinkClass}`} onClick={toggleMenu}>Rel. Dívidas</Link></li>
                        
                        {user.perfil === 'admin' && ( 
                            <>
                                <li className="nav-item"><Link to="/register-admin" className={`nav-link ${isLinkActive('/register-admin') ? activeLinkClass : inactiveLinkClass}`} onClick={toggleMenu}>Reg. Admin</Link></li>
                                <li className="nav-item"><Link to="/register-atendente" className={`nav-link ${isLinkActive('/register-atendente') ? activeLinkClass : inactiveLinkClass}`} onClick={toggleMenu}>Reg. Atendente</Link></li>
                            </>
                        )}
                        <li className="nav-item"><Link to="/profile" className={`nav-link ${isLinkActive('/profile') ? activeLinkClass : inactiveLinkClass}`} onClick={toggleMenu}>Meu Perfil</Link></li>
                    </ul>
                </nav>
            )}
        </header>
    );
}

export default App;
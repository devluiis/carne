import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../api'; // Certifique-se que api.js exporta 'auth'

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Inicia como true para o fetchUser inicial
    const [token, setToken] = useState(localStorage.getItem('token')); // Inicializa token do localStorage

    const fetchUser = useCallback(async () => {
        const currentToken = localStorage.getItem('token'); // Lê o token mais recente
        if (!currentToken) {
            setUser(null);
            setToken(null); // Garante que o estado do token seja limpo
            setLoading(false);
            return;
        }
        
        // Não precisa de setLoading(true) aqui se o loading inicial já é true
        // e se o login já lida com seu próprio loading.
        try {
            const response = await auth.getMe(); // auth.getMe() usará o token via interceptor
            setUser(response.data);
            localStorage.setItem('user', JSON.stringify(response.data)); // Mantém user no localStorage
        } catch (error) {
            console.error('Erro ao buscar usuário (sessão pode ter expirado ou token inválido):', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false); // Importante para liberar o PrivateRoute
        }
    }, []); // Removida a dependência 'token' daqui para evitar loops se setToken for chamado dentro

    useEffect(() => {
        // Ao montar, tenta carregar usuário do localStorage para UI rápida,
        // mas fetchUser validará com o backend.
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                localStorage.removeItem('user');
            }
        }
        fetchUser(); // Valida a sessão e busca dados do usuário atual
    }, [fetchUser]);


    const login = async (email, password) => {
        setLoading(true); // Inicia o processo de login
        try {
            const response = await auth.login(email, password);
            const newToken = response.data.access_token;
            const userData = response.data.user_data;

            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(userData));
            
            setToken(newToken); // Atualiza o estado do token
            setUser(userData);  // Atualiza o estado do usuário
            setLoading(false);  // <<<< ADICIONADO: Finaliza o loading após sucesso
            return true;        // Indica sucesso
        } catch (error) {
            console.error('Erro no login:', error);
            // Limpa tudo em caso de falha
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            setLoading(false); // Finaliza o loading em caso de erro
            throw error; 
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        // O redirecionamento para '/' geralmente é feito no componente que chama logout
        // ou por um useEffect que monitora 'user' no App.jsx ou PrivateRoute
    };

    const register = async (userData) => {
        // setLoading(true); // Opcional, depende se você quer um loading global para registro
        try {
            await auth.register(userData);
            // setLoading(false);
            return true;
        } catch (error) {
            console.error('Erro no registro:', error);
            // setLoading(false);
            throw error;
        }
    };

    const registerAdmin = async (userData) => {
        // setLoading(true);
        try {
            const response = await auth.registerAdmin(userData);
            // setLoading(false);
            return response;
        } catch (error) {
            // ... (tratamento de erro)
            throw error;
        }
    };

    const registerAtendenteByAdmin = async (userData) => {
        // setLoading(true);
        try {
            const response = await auth.registerAtendenteByAdmin(userData); // Usa a função correta do api.js
            // setLoading(false);
            return response;
        } catch (error) {
            // ... (tratamento de erro)
            throw error;
        }
    };
    
    // A função updateUser que discutimos para o ProfilePage
     const updateUser = (newUserData) => {
        const updatedUser = { ...user, ...newUserData };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    const value = {
        user,
        token, // Exportando o token se algum componente precisar dele diretamente
        loading,
        login,
        logout,
        register,
        registerAdmin,
        registerAtendenteByAdmin,
        updateUser 
    };

    return (
        <AuthContext.Provider value={value}>
            {/* Removido !loading && children para deixar o PrivateRoute/AdminRoute gerenciar o spinner
                se o loading inicial ainda não terminou. Se children for null/undefined,
                o React não renderiza nada, o que pode ser uma tela em branco.
                Garantir que o <App /> tenha algo para renderizar é importante.
                No entanto, o <PrivateRoute> já tem um spinner. */}
            {children}
        </AuthContext.Provider>
    );
};
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
            setLoading(false);  // Finaliza o loading após sucesso
            return true;        // Indica sucesso
        } catch (error) {
            console.error('Erro no login:', error);
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
    };

    const register = async (userData) => {
        try {
            await auth.register(userData);
            return true;
        } catch (error) {
            console.error('Erro no registro:', error);
            throw error;
        }
    };

    const registerAdmin = async (userData) => {
        try {
            const response = await auth.registerAdmin(userData);
            return response;
        } catch (error) {
            throw error;
        }
    };

    const registerAtendenteByAdmin = async (userData) => {
        try {
            const response = await auth.registerAtendenteByAdmin(userData); // Usa a função correta do api.js
            return response;
        } catch (error) {
            throw error;
        }
    };
    
     const updateUser = (newUserData) => {
        const updatedUser = { ...user, ...newUserData };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    const value = {
        user,
        token, 
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
            {children}
        </AuthContext.Provider>
    );
};
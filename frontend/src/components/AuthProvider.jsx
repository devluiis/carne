import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../api'; 

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); 
    const [token, setToken] = useState(localStorage.getItem('token')); 

    const fetchUser = useCallback(async () => {
        const currentToken = localStorage.getItem('token'); 
        if (!currentToken) {
            setUser(null);
            setToken(null); 
            setLoading(false);
            return;
        }
        
        try {
            const response = await auth.getMe(); 
            setUser(response.data);
            localStorage.setItem('user', JSON.stringify(response.data)); 
        } catch (error) {
            console.error('Erro ao buscar usuário (sessão pode ter expirado ou token inválido):', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false); 
        }
    }, []); 

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                localStorage.removeItem('user');
            }
        }
        fetchUser(); 
    }, [fetchUser]);


    const login = async (email, password) => {
        setLoading(true); 
        try {
            const response = await auth.login(email, password);
            const newToken = response.data.access_token;
            const userData = response.data.user_data;

            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(userData));
            
            setToken(newToken); 
            setUser(userData);  
            setLoading(false);  
            return true;        
        } catch (error) {
            console.error('Erro no login:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            setLoading(false); 
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
            const response = await auth.registerAtendenteByAdmin(userData); 
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
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../api'; // Certifique-se que api.js exporta 'auth'

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // O token é pego do localStorage no início e atualizado no login/logout
    // A principal fonte de verdade para as chamadas API é o interceptor em api.js

    // Função para buscar dados do usuário se um token existir
    const fetchUser = useCallback(async () => {
        const tokenFromStorage = localStorage.getItem('token');
        if (!tokenFromStorage) {
            setUser(null);
            setLoading(false);
            return;
        }
        
        setLoading(true); // Garante que o loading seja true ao iniciar a busca
        try {
            // Assume que api.js tem o interceptor que usa o token do localStorage
            const response = await auth.getMe();
            setUser(response.data);
            // Atualiza o usuário no localStorage também para consistência
            localStorage.setItem('user', JSON.stringify(response.data));
        } catch (error) {
            console.error('Erro ao buscar usuário (sessão pode ter expirado):', error);
            // Limpa tudo se o token for inválido ou houver erro
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []); // useCallback sem dependências, pois tokenFromStorage é lido dentro

    useEffect(() => {
        // Tenta carregar o usuário do localStorage para uma UI mais rápida,
        // mas fetchUser validará e buscará o mais recente.
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Erro ao parsear usuário do localStorage:", e);
                localStorage.removeItem('user'); // Remove dado inválido
            }
        }
        fetchUser(); // Sempre busca para validar/atualizar
    }, [fetchUser]);

    const login = async (email, password) => {
        setLoading(true);
        try {
            const response = await auth.login(email, password);
            const { access_token, user_data } = response.data;
            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(user_data));
            setUser(user_data);
            setLoading(false); // Define loading como false após sucesso
            return user_data; // Retorna user_data para uso opcional na página de login
        } catch (error) {
            // Limpa em caso de falha no login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setLoading(false);
            throw error; // Propaga o erro para ser tratado na página de login
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        // Redirecionamento pode ser feito no componente que chama o logout, se necessário
    };

    // Função para registrar usuário comum (atendente)
    const register = async (userData) => {
        // setLoading(true); // Opcional: setLoading aqui também
        try {
            // A API /register deve criar o usuário
            await auth.register(userData); 
            // Não faz login automático após registro aqui, usuário precisará logar
            // setLoading(false);
            return true;
        } catch (error) {
            console.error('Erro no registro:', error);
            // setLoading(false);
            throw error;
        }
    };

    // Função para admin registrar outro admin
    const registerAdmin = async (userData) => {
        // setLoading(true);
        try {
            // Assume que auth.registerAdmin existe em api.js e está configurado no backend
            const response = await auth.registerAdmin(userData); 
            // setLoading(false);
            return response; // Pode retornar dados do usuário criado, se a API fizer isso
        } catch (error) {
            console.error('Erro no registro de admin:', error);
            // setLoading(false);
            throw error;
        }
    };

    // Função para admin registrar atendente
    const registerAtendenteByAdmin = async (userData) => {
        // setLoading(true);
        try {
            // Assume que auth.registerAtendenteByAdmin existe em api.js
            // ou que você tem uma rota específica no backend para isso.
            // Se a rota de registro é a mesma, mas protegida,
            // a chamada API pode ser a mesma `auth.register`,
            // mas o token do admin no header permitirá a criação.
            // Baseado no seu código anterior, você tinha `auth.registerAtendenteByAdmin`
            // O ideal é que a API chamada seja a mesma de register, e o backend valide o perfil do chamador
            // Por ora, mantenho a chamada como você tinha, assumindo que exista no api.js
            const response = await auth.register({ ...userData, perfil: 'atendente' }); // Ou uma chamada API específica
            // setLoading(false);
            return response;
        } catch (error) {
            console.error('Erro no registro de atendente por admin:', error);
            // setLoading(false);
            throw error;
        }
    };
    
    // Função para atualizar dados do usuário no contexto (usado pelo ProfilePage)
    const updateUser = (newUserData) => {
        setUser(currentUser => ({ ...currentUser, ...newUserData }));
        // Atualiza também no localStorage para persistência entre reloads da UI
        localStorage.setItem('user', JSON.stringify({ ...user, ...newUserData }));
    };

    const value = {
        user,
        loading,
        login,
        logout,
        register,
        registerAdmin,
        registerAtendenteByAdmin,
        updateUser // Exportando a nova função
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children} {/* Opcional: Renderiza children apenas quando o loading inicial terminar */}
            {/* Se preferir mostrar o app com um spinner de tela cheia, mantenha apenas {children} e trate o loading nas páginas */}
        </AuthContext.Provider>
    );
};
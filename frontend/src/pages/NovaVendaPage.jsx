import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clients } from '../api';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

function NovaVendaPage() {
    const [clientOptions, setClientOptions] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [loadingClients, setLoadingClients] = useState(true);
    
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchClientOptions = useCallback(async () => {
        try {
            setLoadingClients(true);
            const response = await clients.getAll(''); 
            setClientOptions(response.data || []);
        } catch (err) {
            console.error('Erro ao carregar opções de clientes:', err);
            setGlobalAlert({ message: 'Falha ao carregar lista de clientes.', type: 'error' });
        } finally {
            setLoadingClients(false);
        }
    }, [setGlobalAlert]);

    useEffect(() => {
        fetchClientOptions();
    }, [fetchClientOptions]);

    const handleProceedToCarne = () => {
        if (!selectedClientId) {
            setGlobalAlert({ message: 'Por favor, selecione um cliente para prosseguir.', type: 'warning' });
            return;
        }
        navigate(`/carnes/new/${selectedClientId}`);
    };

    if (loadingClients) {
        return <LoadingSpinner message="Carregando lista de clientes..." />;
    }

    return (
        <div className="container form-container" style={{maxWidth: '700px'}}> {/* container do Bootstrap */}
            <h2 className="text-center mb-4">Registrar Nova Venda / Carnê</h2>
            <p className="text-center mb-4">Selecione o cliente para o qual deseja registrar uma nova venda e gerar um carnê.</p>
            
            <div className="mb-3"> {/* mb-3 do Bootstrap */}
                <label htmlFor="client-select" className="form-label">Cliente:</label>
                <select
                    id="client-select"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="form-select" /* form-select do Bootstrap */
                >
                    <option value="">-- Selecione um Cliente --</option>
                    {clientOptions.length > 0 ? (
                        clientOptions.map(client => (
                            <option key={client.id_cliente} value={client.id_cliente}>
                                {client.nome} ({client.cpf_cnpj})
                            </option>
                        ))
                    ) : (
                        <option value="" disabled>Nenhum cliente cadastrado</option>
                    )}
                </select>
            </div>

            <button
                onClick={handleProceedToCarne}
                className="btn btn-primary w-100 mb-2" /* w-100 mb-2 do Bootstrap */
                disabled={!selectedClientId || loadingClients}
            >
                Prosseguir para Criação do Carnê
            </button>
            <button
                type="button"
                onClick={() => navigate('/clients/new')} 
                className="btn btn-success w-100 mb-2" 
            >
                + Cadastrar Novo Cliente
            </button>
            <button
                type="button"
                onClick={() => navigate('/carnes')}
                className="btn btn-secondary w-100" 
            >
                Cancelar / Ver Carnês
            </button>
        </div>
    );
}

export default NovaVendaPage;
import React, { useState, useEffect } from 'react';
import { clients } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';

function ClientForm() {
    const [nome, setNome] = useState('');
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [endereco, setEndereco] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loadingInitial, setLoadingInitial] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const navigate = useNavigate();
    const { id } = useParams();
    const { setGlobalAlert } = useGlobalAlert();

    useEffect(() => {
        if (id) {
            setLoadingInitial(true);
            clients.getById(id)
                .then(response => {
                    const client = response.data;
                    setNome(client.nome);
                    setCpfCnpj(client.cpf_cnpj);
                    setEndereco(client.endereco || '');
                    setTelefone(client.telefone || '');
                    setEmail(client.email || '');
                })
                .catch(err => {
                    console.error('Erro ao carregar cliente para edição:', err);
                    setGlobalAlert({ message: 'Erro ao carregar dados do cliente.', type: 'error' });
                    navigate('/clients');
                })
                .finally(() => setLoadingInitial(false));
        }
    }, [id, navigate, setGlobalAlert]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitLoading(true);
        const clientData = { nome, cpf_cnpj: cpfCnpj, endereco, telefone, email };

        try {
            if (id) {
                await clients.update(id, clientData);
                setGlobalAlert({ message: 'Cliente atualizado com sucesso!', type: 'success' });
            } else {
                await clients.create(clientData);
                setGlobalAlert({ message: 'Cliente cadastrado com sucesso!', type: 'success' });
            }
            navigate('/clients');
        } catch (err) {
            const errorMessage = `Erro ao salvar cliente: ${err.response?.data?.detail || err.message}`;
            setError(errorMessage);
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loadingInitial) {
        return <LoadingSpinner message="Carregando dados do cliente..." />;
    }

    return (
        <div className="form-container">
            <h2>{id ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h2>
            {error && <p className="text-center" style={{ color: 'red', marginBottom: '15px' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="nome">Nome Completo / Razão Social:</label>
                    <input
                        type="text"
                        id="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="cpfCnpj">CPF / CNPJ:</label>
                    <input
                        type="text"
                        id="cpfCnpj"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="endereco">Endereço:</label>
                    <input
                        type="text"
                        id="endereco"
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="telefone">Telefone:</label>
                    <input
                        type="text"
                        id="telefone"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="form-input"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                    {submitLoading ? 'Salvando...' : (id ? 'Atualizar Cliente' : 'Cadastrar Cliente')}
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/clients')}
                    className="btn btn-secondary mt-2"
                >
                    Cancelar
                </button>
            </form>
        </div>
    );
}

export default ClientForm;
import React, { useState, useEffect } from 'react';

// Se estiver usando IPC com contextBridge:
// declare const window: {
//   api: {
//     lerEmails: () => Promise<Email[]>;
//   };
// };

function App() {
  type Email = {
    from: string,
    subject: string,
    text: string,
    html?: string,
  }

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEmailHtml, setSelectedEmailHtml] = useState(''); // Estado para o HTML do e-mail selecionado
  const [showHtmlModal, setShowHtmlModal] = useState(false); // Estado para controlar a visibilidade do modal

  const fetchEmailsFromMain = async () => {
    setLoading(true);
    setError('');
    try {
      // Exemplo de como você chamaria sua função lerEmails do processo principal via IPC
      // No mundo real, você passaria os tokens de autenticação de forma segura.
      // Aqui, estou simulando que `window.api.lerEmails()` está disponível e já lida com a autenticação.
      const fetchedEmails = await window.api.lerEmails(); // Supondo que `window.api.lerEmails` é sua função IPC
      setEmails(fetchedEmails);
    } catch (err) {
      console.error('Erro ao buscar e-mails via IPC:', err);
      setError('Erro ao buscar e-mails. Por favor, verifique a autenticação ou o console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Chamada inicial para buscar e-mails quando o componente monta
    fetchEmailsFromMain();
  }, []);

  // Função para exibir o modal com o HTML do e-mail
  const handleViewHtml = (htmlContent) => {
    setSelectedEmailHtml(htmlContent);
    setShowHtmlModal(true);
  };

  const closeModal = () => {
    setShowHtmlModal(false);
    setSelectedEmailHtml('');
  };

  const handleHtmlContentClick = (event) => {
    // Verifica se o elemento clicado (ou um de seus pais) é uma tag <a>
    let targetElement = event.target;
    while (targetElement != null && targetElement !== event.currentTarget) {
      if (targetElement.tagName === 'A' && targetElement.href) {
        event.preventDefault(); // Impede a navegação padrão do navegador
        window.api.openExternal(targetElement.href)
          .then(success => {
            if (!success) {
              console.warn('Não foi possível abrir o link externo:', targetElement.href);
              // Opcional: Mostrar uma mensagem de erro para o usuário
            }
          })
          .catch(err => {
            console.error('Erro ao chamar openExternal via IPC:', err);
            // Opcional: Mostrar uma mensagem de erro para o usuário
          });
        return; // Sai da função após lidar com o link
      }
      targetElement = targetElement.parentElement;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center font-inter">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Leitor de E-mails do Gmail</h1>

        <div className="text-center mb-6">
          <button
            onClick={fetchEmailsFromMain}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
          >
            {loading ? 'Carregando E-mails...' : 'Atualizar E-mails'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-center">
            {error}
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Seus E-mails Recentes:</h2>
          {emails.length === 0 && !loading && (
            <p className="text-gray-600 text-center">Nenhum e-mail encontrado.</p>
          )}
          {emails.length > 0 && (
            <ul className="space-y-4">
              {emails.map((email,id) => (
                <li key={id} className="bg-gray-50 p-4 rounded-md shadow-sm border border-gray-200">
                  <p className="text-lg font-medium text-gray-900">De: {email.from}</p>
                  <p className="text-md text-gray-800">Assunto: {email.subject}</p>
                  <p className="text-sm text-gray-700 mt-2 line-clamp-3">{email.text}</p> {/* Exibe o texto simples */}

                  {email.html && (
                    <button
                      onClick={() => handleViewHtml(email.html)}
                      className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-300 ease-in-out"
                    >
                      Ver HTML Completo
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modal para exibir o HTML */}
      {showHtmlModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">HTML da Mensagem</h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="flex-grow overflow-y-auto border border-gray-300 p-2 rounded-md" onClick={handleHtmlContentClick}>
              {/* AQUI É ONDE O HTML É RENDERIZADO! */}
              <div dangerouslySetInnerHTML={{ __html: selectedEmailHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
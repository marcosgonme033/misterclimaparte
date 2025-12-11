// BeeSoftware/frontend/src/App.jsx
import { useState, useEffect } from 'react';
import PartesBoard from './PartesBoard';
import logoLogin from './assets/WhatsApp Image 2025-12-11 at 12.38.14.jpeg';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Constantes para la gestión de sesión
const SESSION_STORAGE_KEY = 'beesoftware_session';
const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 horas en milisegundos

function App() {
  // Estado LOGIN
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    rememberMe: true,
  });

  // Estado UI
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Restaurar sesión al cargar la aplicación
  useEffect(() => {
    const restoreSession = () => {
      try {
        const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
        
        if (!storedSession) {
          setIsCheckingSession(false);
          return;
        }

        const session = JSON.parse(storedSession);
        const now = Date.now();

        // Verificar si la sesión ha expirado
        if (now >= session.expiresAt) {
          console.log('⏰ Sesión expirada, limpiando...');
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setIsCheckingSession(false);
          return;
        }

        // Sesión válida, restaurar usuario
        console.log('✅ Sesión válida restaurada');
        setUser(session.user);
      } catch (error) {
        console.error('❌ Error al restaurar sesión:', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        setIsCheckingSession(false);
      }
    };

    restoreSession();
  }, []);

  const handleChangeLogin = (field, value) => {
    setLoginForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setGlobalError('');
    setStatusMessage('');
  };

  const validateLogin = () => {
    const errors = {};
    if (!loginForm.username.trim()) {
      errors.username = 'El usuario es obligatorio.';
    } else if (loginForm.username.trim().length < 3) {
      errors.username = 'Mínimo 3 caracteres.';
    }

    if (!loginForm.password) {
      errors.password = 'La contraseña es obligatoria.';
    } else if (loginForm.password.length < 4) {
      errors.password = 'Mínimo 4 caracteres.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitLogin = async (event) => {
    event.preventDefault();
    if (!validateLogin()) return;

    setLoading(true);
    setGlobalError('');
    setStatusMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password,
          rememberMe: loginForm.rememberMe,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setGlobalError(data.message || 'No se ha podido iniciar sesión.');
        return;
      }

      const userData = data.data?.user || null;
      setUser(userData);
      setStatusMessage('Has iniciado sesión correctamente.');
      setGlobalError('');

      // Guardar sesión en localStorage
      if (userData) {
        const session = {
          user: userData,
          token: data.data?.token || null, // Si el backend devuelve token
          expiresAt: Date.now() + SESSION_DURATION,
          createdAt: Date.now()
        };
        
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        console.log('💾 Sesión guardada en localStorage (expira en 4 horas)');
      }
    } catch (error) {
      console.error('Error en login:', error);
      setGlobalError('Error de conexión con el servidor. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Limpiar sesión del localStorage
    localStorage.removeItem(SESSION_STORAGE_KEY);
    console.log('🚪 Sesión cerrada y limpiada del localStorage');
    
    // Resetear estado de usuario
    setUser(null);
    setLoginForm({
      username: '',
      password: '',
      rememberMe: true,
    });
    setGlobalError('');
    setStatusMessage('');
  };

  // Mostrar loading mientras se verifica la sesión
  if (isCheckingSession) {
    return (
      <div className="auth-page">
        <div className="auth-backdrop" />
        <div className="auth-shell">
          <div className="auth-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#9ca3af', margin: 0 }}>Verificando sesión...</p>
          </div>
        </div>
      </div>
    );
  }

  // Si el usuario está logueado, mostrar el tablero de partes
  if (user) {
    return <PartesBoard user={user} onLogout={handleLogout} />;
  }

  // Si no hay usuario, mostrar el formulario de login
  return (
    <div className="auth-page">
      <div className="auth-backdrop" />

      <div className="auth-shell">
        <div className="auth-card">
          <header className="auth-header">
            <div className="auth-logo-row">
              <div className="brand-logo">
  <img
    src={logoLogin}
    alt="Logo"
    style={{ width: '48px', height: '48px', objectFit: 'contain' }}
  />
</div>
              <div className="auth-header-text">
                <h2>Inicia sesión en Mr. Clima / Partes</h2>
              </div>
            </div>
          </header>

          {globalError && (
            <div className="status-banner status-banner--error">
              <span className="status-dot status-dot--error" />
              <span>{globalError}</span>
            </div>
          )}

          {statusMessage && !globalError && (
            <div className="status-banner status-banner--success">
              <span className="status-dot status-dot--success" />
              <span>{statusMessage}</span>
            </div>
          )}

          {user && (
            <div className="user-summary">
              <p className="user-summary-title">Sesión activa</p>
              <p className="user-summary-line">
                <span>Usuario:</span> <strong>{user.username}</strong>
              </p>
              {user.name && (
                <p className="user-summary-line">
                  <span>Nombre:</span> <strong>{user.name}</strong>
                </p>
              )}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmitLogin} noValidate>
            <div className="field">
              <label htmlFor="login-username" className="field-label">
                Usuario
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                className={fieldErrors.username ? 'input input--error' : 'input'}
                value={loginForm.username}
                onChange={(e) => handleChangeLogin('username', e.target.value)}
                placeholder="tu.usuario"
              />
              {fieldErrors.username && (
                <p className="field-error">{fieldErrors.username}</p>
              )}
            </div>

            <div className="field">
              <div className="field-label-row">
                <label htmlFor="login-password" className="field-label">
                  Contraseña
                </label>
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                >
                  {showLoginPassword ? 'Ocultarr' : 'Mostrar'}
                </button>
              </div>
              <input
                id="login-password"
                type={showLoginPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={fieldErrors.password ? 'input input--error' : 'input'}
                value={loginForm.password}
                onChange={(e) => handleChangeLogin('password', e.target.value)}
                placeholder="Mínimo 4 caracteres"
              />
              {fieldErrors.password && (
                <p className="field-error">{fieldErrors.password}</p>
              )}
            </div>

            <div className="field-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={loginForm.rememberMe}
                  onChange={(e) => handleChangeLogin('rememberMe', e.target.checked)}
                />
                <span>Recordarme en este equipo</span>
              </label>
            </div>

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Verificando credenciales...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;

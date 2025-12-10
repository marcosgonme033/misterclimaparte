import React, { useState } from 'react';

export default function RecoverPassword({ onCancel, onDone }) {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState(''); // email o usuario
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const startRecovery = async (e) => {
    e && e.preventDefault();
    if (!identifier.trim()) return setMessage('Introduce tu email o usuario');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/recover/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || 'Error al solicitar el código');
        setLoading(false);
        return;
      }
      setLoading(false);
      setStep(2);
      setMessage(data.message || 'Hemos enviado un código de verificación');
      if (data.previewUrl) console.info('Ethereal preview:', data.previewUrl);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setMessage('Error de red al solicitar el código');
    }
  };

  const verifyCode = async (e) => {
    e && e.preventDefault();
    if (!code.trim()) return setMessage('Introduce el código recibido');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/recover/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || 'Código incorrecto');
        setLoading(false);
        return;
      }
      setLoading(false);
      setStep(3);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setMessage('Error de red al verificar el código');
    }
  };

  const finish = async (e) => {
    e && e.preventDefault();
    if (!newPassword || newPassword.length < 6) return setMessage('La contraseña debe tener al menos 6 caracteres');
    if (newPassword !== confirmPassword) return setMessage('Las contraseñas no coinciden');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/recover/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || 'Error al actualizar la contraseña');
        setLoading(false);
        return;
      }
      setLoading(false);
      setMessage(data.message || 'Contraseña actualizada. Puedes iniciar sesión con tu nueva contraseña.');
      setStep(4);
      onDone && onDone();
    } catch (err) {
      console.error(err);
      setLoading(false);
      setMessage('Error de red al actualizar la contraseña');
    }
  };

  return (
    <div className="card" style={{maxWidth:700, margin:'20px auto'}}>
      <div className="brand" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>Recuperar contraseña</h1>
          <p className="brand-subtitle">Sigue los pasos para recuperar el acceso a tu cuenta</p>
        </div>
      </div>

      {step === 1 && (
        <form onSubmit={startRecovery}>
          <label className="label">
            Email o usuario
            <input
              type="text"
              value={identifier}
              onChange={(e)=>setIdentifier(e.target.value)}
              placeholder="ej: usuario o correo@dominio.com"
              className="input"
              autoFocus
            />
          </label>

          {/* El flujo usa email por defecto: no pedir método (más profesional) */}

          {message && <div className="field-error" style={{marginBottom:12}}>{message}</div>}

          <div style={{display:'flex',gap:12}}>
            <button className="btn" type="button" onClick={onCancel}>Volver</button>
            <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar código'}</button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verifyCode}>
          <p>Introduce el código que has recibido por email.</p>
          <label className="label">
            Código de verificación
            <input type="text" value={code} onChange={(e)=>setCode(e.target.value)} className="input" />
          </label>
          {message && <div className="field-error" style={{marginBottom:12}}>{message}</div>}
          <div style={{display:'flex',gap:12}}>
            <button type="button" className="btn" onClick={()=>setStep(1)}>Volver</button>
            <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Verificando...' : 'Verificar código'}</button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={finish}>
          <label className="label">
            Nueva contraseña
            <input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="input" />
          </label>
          <label className="label">
            Confirmar contraseña
            <input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} className="input" />
          </label>
          {message && <div className="field-error" style={{marginBottom:12}}>{message}</div>}
          <div style={{display:'flex',gap:12}}>
            <button type="button" className="btn" onClick={()=>setStep(2)}>Volver</button>
            <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Actualizar contraseña'}</button>
          </div>
        </form>
      )}

      {step === 4 && (
        <div>
          <p className="subtitle">¡Listo! {message}</p>
          <div style={{display:'flex',gap:12,marginTop:12}}>
            <button className="primary-btn" onClick={onCancel}>Volver a iniciar sesión</button>
          </div>
        </div>
      )}
    </div>
  );
}

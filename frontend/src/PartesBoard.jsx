// BeeSoftware/frontend/src/PartesBoard.jsx
import { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Definición de columnas del tablero Kanban
const COLUMNS = [
  { id: 'inicial', title: 'Parte inicial', color: '#facc15' },
  { id: 'revisado', title: 'Revisado', color: '#60a5fa' },
  { id: 'visitado', title: 'Visita realizada', color: '#a78bfa' },
  { id: 'reparado', title: 'Reparado', color: '#34d399' },
];

function PartesBoard({ user }) {
  const [partes, setPartes] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewParteForm, setShowNewParteForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedParte, setSelectedParte] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // Ahora es "searchQuery" en lugar de "searchNumeroParte"
  const [selectedTecnico, setSelectedTecnico] = useState(''); // Filtro por técnico (solo admin)

  // Estado del formulario
  const [formData, setFormData] = useState({
    numero_parte: '',
    aparato: '',
    poblacion: '',
    observaciones: '',
    instrucciones_tecnico: '',
    informe_tecnico: '',
    cliente_email: '',
    nombre_tecnico: '', // Para asignación de técnico (solo admin)
  });

  const [formErrors, setFormErrors] = useState({});
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [videoRef, setVideoRef] = useState(null);

  // Cargar partes al montar el componente
  useEffect(() => {
    loadTecnicos();
    loadPartes();
  }, [user]);

  // Helper para headers de autenticación
  const getAuthHeaders = () => ({
    'Authorization': `Bearer fake-jwt-token-beesoftware`,
    'x-user': JSON.stringify(user),
    'Content-Type': 'application/json'
  });

  // Cargar lista de técnicos (solo para admin)
  const loadTecnicos = async () => {
    if (user.role !== 'admin') return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/partes/tecnicos`, {
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (response.ok && data.ok) {
        // Filtrar técnicos válidos y ordenar
        const tecnicosValidos = (data.data || [])
          .filter(t => t.name && t.name.trim()) // Eliminar null/vacío
          .sort((a, b) => a.name.localeCompare(b.name)); // Ordenar alfabéticamente
        
        console.log('👥 Técnicos cargados desde BD (solo válidos):', tecnicosValidos);
        setTecnicos(tecnicosValidos);
      } else {
        console.error('Error al cargar técnicos:', data.message);
      }
    } catch (err) {
      console.error('Error al cargar técnicos:', err);
    }
  };

  const loadPartes = async () => {
    try {
      setLoading(true);
      setError('');

      let url = `${API_BASE_URL}/api/partes`;
      
      // Si es user (no admin), filtramos por su nombre
      if (user.role !== 'admin') {
        const nombreTecnico = user.name || user.username;
        url += `?nombre_tecnico=${encodeURIComponent(nombreTecnico)}`;
      }

      const response = await fetch(url, {
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Error al cargar los partes');
      }

      setPartes(data.data || []);
    } catch (err) {
      console.error('Error cargando partes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar partes según búsqueda, rol y técnico seleccionado
  const filteredPartes = useMemo(() => {
    let filtered = partes;

    // Filtrar por técnico (solo para admin)
    if (user.role === 'admin' && selectedTecnico) {
      console.log('🔍 Filtrando por técnico:', {
        tecnicoSeleccionado: selectedTecnico,
        partesTotal: partes.length,
        nombresEnPartes: [...new Set(partes.map(p => p.nombre_tecnico))]
      });
      
      // Comparación exacta de nombres (tal cual vienen de la BD)
      // Trim para eliminar espacios extra
      filtered = filtered.filter(p => {
        const nombreParte = (p.nombre_tecnico || '').trim();
        const nombreSeleccionado = selectedTecnico.trim();
        const coincide = nombreParte === nombreSeleccionado;
        
        if (!coincide && nombreParte) {
          console.log('⚠️ No coincide:', {nombreParte, nombreSeleccionado});
        }
        
        return coincide;
      });
      
      console.log('✅ Partes filtrados:', filtered.length);
    }

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();

      if (user.role === 'admin') {
        // Admin puede buscar por número de parte O población
        filtered = filtered.filter(p => 
          p.numero_parte?.toLowerCase().includes(query) ||
          p.poblacion?.toLowerCase().includes(query)
        );
      } else {
        // Técnicos solo pueden buscar por población
        filtered = filtered.filter(p => 
          p.poblacion?.toLowerCase().includes(query)
        );
      }
    }

    return filtered;
  }, [partes, searchQuery, selectedTecnico, user.role]);

  // Organizar partes por columna
  const getPartesByColumn = (columnId) => {
    return filteredPartes
      .filter((parte) => parte.estado === columnId)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0)); // Ordenar por campo 'orden'
  };

  // Manejar drag and drop
  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    // Si no hay destino válido, cancelar
    if (!destination) return;

    // Si se soltó en el mismo lugar, cancelar
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const parteId = parseInt(draggableId);
    const oldEstado = source.droppableId;
    const newEstado = destination.droppableId;
    const sourceIndex = source.index;
    const destIndex = destination.index;

    // CASO 1: Reordenamiento dentro de la misma columna
    if (oldEstado === newEstado) {
      console.log('🔄 Reordenando dentro de la columna:', oldEstado);
      
      try {
        const partesEnColumna = getPartesByColumn(oldEstado);
        const [movedParte] = partesEnColumna.splice(sourceIndex, 1);
        partesEnColumna.splice(destIndex, 0, movedParte);
        
        // Preparar actualizaciones de orden
        const ordenUpdates = partesEnColumna.map((parte, index) => ({
          id: parte.id,
          orden: index + 1
        }));
        
        console.log('📤 Enviando actualizaciones de orden:', ordenUpdates);
        
        // Enviar al backend
        const response = await fetch(`${API_BASE_URL}/api/partes/orden`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ updates: ordenUpdates }),
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.ok) {
          throw new Error(data.message || 'Error al actualizar el orden');
        }
        
        console.log('✅ Orden actualizado correctamente');
        await loadPartes();
      } catch (err) {
        console.error('❌ Error al reordenar:', err);
        setError(err.message);
        await loadPartes();
      }
      return;
    }

    // CASO 2: Cambio de columna (estado)
    console.log('🔄 Drag & Drop:', {
      parteId,
      from: oldEstado,
      to: newEstado,
      direction: oldEstado > newEstado ? '⬅️ Hacia atrás' : '➡️ Hacia adelante'
    });

    try {
      // Actualizar estado optimistamente en el frontend
      setPartes((prevPartes) =>
        prevPartes.map((parte) =>
          parte.id === parteId ? { ...parte, estado: newEstado } : parte
        )
      );

      // Obtener el parte completo para enviarlo con el nuevo estado
      const parteCompleto = partes.find(p => p.id === parteId);
      
      // Actualizar en el backend enviando todos los campos para evitar pérdida de datos
      const response = await fetch(`${API_BASE_URL}/api/partes/${parteId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...parteCompleto,
          estado: newEstado
        }),
      });

      const data = await response.json();

      console.log('✅ Respuesta del backend:', {
        status: response.status,
        ok: response.ok,
        data: data
      });

      if (!response.ok || !data.ok) {
        console.error('❌ Backend rechazó el cambio:', data.message);
        throw new Error(data.message || 'Error al actualizar el estado');
      }

      console.log('✅ Estado actualizado correctamente');
      // Recargar partes para asegurar sincronización
      await loadPartes();
    } catch (err) {
      console.error('❌ Error en handleDragEnd:', err);
      setError(err.message);
      // Recargar partes en caso de error para revertir cambios optimistas
      await loadPartes();
    }
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Limitar a 5 imágenes máximo
    if (files.length + selectedImages.length > 5) {
      setError('Máximo 5 imágenes permitidas');
      return;
    }

    setSelectedImages((prev) => [...prev, ...files]);

    // Crear previsualizaciones
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Función para iniciar la cámara
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Usar cámara trasera en móviles
        audio: false
      });
      setStream(mediaStream);
      setShowCamera(true);
      
      // Esperar a que el video ref esté disponible
      setTimeout(() => {
        if (videoRef) {
          videoRef.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
    }
  };

  // Función para detener la cámara
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  // Función para capturar foto
  const capturePhoto = () => {
    if (!videoRef) return;
    
    // Limitar a 5 imágenes máximo
    if (selectedImages.length >= 5) {
      setError('Máximo 5 imágenes permitidas');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.videoWidth;
    canvas.height = videoRef.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef, 0, 0);

    // Convertir a blob y crear File
    canvas.toBlob((blob) => {
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setSelectedImages((prev) => [...prev, file]);
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
      
      // Cerrar cámara después de capturar
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  const removeImage = (index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.numero_parte.trim()) {
      errors.numero_parte = 'El número de parte es obligatorio';
    } else if (!/^\d{6}$/.test(formData.numero_parte)) {
      errors.numero_parte = 'Debe tener exactamente 6 dígitos';
    }

    if (!formData.aparato.trim()) {
      errors.aparato = 'El aparato es obligatorio';
    }

    if (!formData.poblacion.trim()) {
      errors.poblacion = 'La población es obligatoria';
    }

    // Validar técnico solo al crear (no al editar)
    if (!selectedParte && !formData.nombre_tecnico.trim()) {
      errors.nombre_tecnico = 'Debe seleccionar un técnico';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitNuevoParte = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setFormLoading(true);

      // Convertir imágenes a base64 y crear JSON
      const fotosArray = imagePreviews.map((preview, index) => ({
        id: index + 1,
        data: preview,
        nombre: selectedImages[index]?.name || `foto_${index + 1}.jpg`,
      }));

      const parteData = {
        numero_parte: formData.numero_parte,
        aparato: formData.aparato,
        poblacion: formData.poblacion,
        observaciones: formData.observaciones,
        cliente_email: formData.cliente_email,
        nombre_tecnico: formData.nombre_tecnico, // El admin selecciona el técnico
        fotos_json: fotosArray.length > 0 ? JSON.stringify(fotosArray) : null,
      };

      const response = await fetch(`${API_BASE_URL}/api/partes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(parteData),
      });

      const data = await response.json();

      // Manejo específico de duplicado
      if (!response.ok) {
        if (response.status === 409 && data.field === 'numero_parte') {
          setFormErrors({...formErrors, numero_parte: data.message || 'Ya existe un parte con ese número'});
          return; // No cerrar el formulario para que el usuario corrija
        }
        throw new Error(data.message || 'Error al crear el parte');
      }

      if (!data.ok) {
        throw new Error(data.message || 'Error al crear el parte');
      }

      await loadPartes();

      // Resetear formulario
      setFormData({
        numero_parte: '',
        aparato: '',
        poblacion: '',
        observaciones: '',
        instrucciones_tecnico: '',
        informe_tecnico: '',
        cliente_email: '',
        nombre_tecnico: '',
      });
      setSelectedImages([]);
      setImagePreviews([]);

      setShowNewParteForm(false);
      setError('');
    } catch (err) {
      console.error('Error creando parte:', err);
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancelarNuevoParte = () => {
    setShowNewParteForm(false);
    setFormData({
      numero_parte: '',
      aparato: '',
      poblacion: '',
      observaciones: '',
      instrucciones_tecnico: '',
      informe_tecnico: '',
      cliente_email: '',
      nombre_tecnico: '',
    });
    setFormErrors({});
    setSelectedImages([]);
    setImagePreviews([]);
    setError('');
  };

  const handleOpenEditModal = (parte) => {
    setSelectedParte(parte);
    setFormData({
      numero_parte: parte.numero_parte,
      aparato: parte.aparato,
      poblacion: parte.poblacion,
      observaciones: parte.observaciones || '',
      instrucciones_tecnico: parte.instrucciones_tecnico || '',
      informe_tecnico: parte.informe_tecnico || '',
      cliente_email: parte.cliente_email || '',
      nombre_tecnico: parte.nombre_tecnico || '',
    });

    // Cargar imágenes existentes
    if (parte.fotos_json) {
      try {
        const fotos = JSON.parse(parte.fotos_json);
        setImagePreviews(fotos.map((f) => f.data));
        setSelectedImages([]);
      } catch (err) {
        console.error('Error parseando fotos:', err);
      }
    } else {
      setImagePreviews([]);
      setSelectedImages([]);
    }

    setShowEditModal(true);
  };

  const handleUpdateParte = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setFormLoading(true);

      const fotosArray = imagePreviews.map((preview, index) => ({
        id: index + 1,
        data: preview,
        nombre: selectedImages[index]?.name || `foto_${index + 1}.jpg`,
      }));

      const parteData = {
        ...formData,
        fotos_json: fotosArray.length > 0 ? JSON.stringify(fotosArray) : null,
      };

      const response = await fetch(`${API_BASE_URL}/api/partes/${selectedParte.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(parteData),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Error al actualizar el parte');
      }

      await loadPartes();

      setShowEditModal(false);
      setSelectedParte(null);
      setFormData({
        numero_parte: '',
        aparato: '',
        poblacion: '',
        observaciones: '',
        instrucciones_tecnico: '',
        informe_tecnico: '',
        cliente_email: '',
        nombre_tecnico: '',
      });
      setSelectedImages([]);
      setImagePreviews([]);
      setError('');
    } catch (err) {
      console.error('Error actualizando parte:', err);
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteParte = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este parte?')) {
      return;
    }

    try {
      setFormLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/partes/${selectedParte.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Error al eliminar el parte');
      }

      await loadPartes();

      setShowEditModal(false);
      setSelectedParte(null);
      setFormData({
        numero_parte: '',
        aparato: '',
        poblacion: '',
        observaciones: '',
        instrucciones_tecnico: '',
        informe_tecnico: '',
        cliente_email: '',
        nombre_tecnico: '',
      });
      setSelectedImages([]);
      setImagePreviews([]);
    } catch (err) {
      console.error('Error eliminando parte:', err);
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-backdrop" />

      <div className="kanban-container">
        {/* Header */}
        <header className="kanban-header">
          <div className="auth-logo-row">
            <div className="brand-logo">B</div>
            <div className="auth-header-text">
              <h2>Partes</h2>
              <p>
                Bienvenido, <strong style={{ color: '#facc15' }}>{user.name || user.username}</strong>
              </p>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div style={{ flex: 1, maxWidth: '400px', margin: '0 1rem' }}>
            <input
              type="text"
              className="input"
              placeholder={
                user.role === 'admin' 
                  ? '🔍 Buscar por número de parte o población...' 
                  : '🔍 Buscar por población...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                margin: 0,
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                color: '#e5e7eb',
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
              }}
            />
          </div>

          {/* Filtro por técnico - SOLO ADMIN */}
          {user.role === 'admin' && !showNewParteForm && (
            <div style={{ minWidth: '200px' }}>
              <select
                className="input"
                value={selectedTecnico}
                onChange={(e) => {
                  console.log('🎯 Técnico seleccionado:', e.target.value);
                  setSelectedTecnico(e.target.value);
                }}
                style={{
                  width: '100%',
                  margin: 0,
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  color: '#e5e7eb',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                }}
              >
                <option value="">👥 Todos los técnicos</option>
                {tecnicos.map(tecnico => (
                  <option key={tecnico.id} value={tecnico.name}>
                    {tecnico.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {error && (
          <div className="status-banner status-banner--error" style={{ maxWidth: '100%', margin: '0 0 1.5rem' }}>
            <span className="status-dot status-dot--error" />
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: '#fee2e2',
                cursor: 'pointer',
                fontSize: '1.2rem',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Formulario nuevo parte */}
        {showNewParteForm && (
          <div className="auth-card" style={{ maxWidth: '760px', margin: '0 0 2rem', width: '100%' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid rgba(148, 163, 184, 0.3)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f9fafb' }}>Crear Nuevo Parte</h3>
              <button
                onClick={handleCancelarNuevoParte}
                disabled={formLoading}
                className="btn"
                style={{ padding: '0.4rem 0.8rem' }}
              >
                ✕
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmitNuevoParte} style={{ gap: '1.1rem' }}>
              {/* Fila 1: Número de parte y Aparato */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                <div className="field">
                  <label htmlFor="numero_parte" className="field-label">
                    Nº Parte <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    id="numero_parte"
                    type="text"
                    className={formErrors.numero_parte ? 'input input--error' : 'input'}
                    value={formData.numero_parte}
                    onChange={(e) => handleFormChange('numero_parte', e.target.value)}
                    placeholder="123456"
                    maxLength="6"
                  />
                  {formErrors.numero_parte && (
                    <p className="field-error">{formErrors.numero_parte}</p>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="aparato" className="field-label">
                    Aparato <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    id="aparato"
                    type="text"
                    className={formErrors.aparato ? 'input input--error' : 'input'}
                    value={formData.aparato}
                    onChange={(e) => handleFormChange('aparato', e.target.value)}
                    placeholder="Ej. Aire Acondicionado Split"
                  />
                  {formErrors.aparato && (
                    <p className="field-error">{formErrors.aparato}</p>
                  )}
                </div>
              </div>

              {/* Fila 2: Población y Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="field">
                  <label htmlFor="poblacion" className="field-label">
                    Población <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    id="poblacion"
                    type="text"
                    className={formErrors.poblacion ? 'input input--error' : 'input'}
                    value={formData.poblacion}
                    onChange={(e) => handleFormChange('poblacion', e.target.value)}
                    placeholder="Ej. Madrid"
                  />
                  {formErrors.poblacion && (
                    <p className="field-error">{formErrors.poblacion}</p>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="cliente_email" className="field-label">
                    Email Clientesss
                  </label>
                  <input
                    id="cliente_email"
                    type="email"
                    className="input"
                    value={formData.cliente_email}
                    onChange={(e) => handleFormChange('cliente_email', e.target.value)}
                    placeholder="cliente@ejemplo.com"
                  />
                </div>
              </div>

              {/* Fila 3: Selección de Técnico (solo admin) */}
              <div className="field">
                <label htmlFor="nombre_tecnico" className="field-label">
                  Técnico Asignado <span style={{ color: '#f87171' }}>*</span>
                </label>
                <select
                  id="nombre_tecnico"
                  className={formErrors.nombre_tecnico ? 'input input--error' : 'input'}
                  value={formData.nombre_tecnico}
                  onChange={(e) => handleFormChange('nombre_tecnico', e.target.value)}
                >
                  <option value="">Seleccionar técnico</option>
                  {tecnicos.map(tecnico => (
                    <option key={tecnico.id} value={tecnico.name}>
                      {tecnico.name}
                    </option>
                  ))}
                </select>
                {formErrors.nombre_tecnico && (
                  <p className="field-error">{formErrors.nombre_tecnico}</p>
                )}
              </div>

              {/* Observaciones */}
              <div className="field">
                <label htmlFor="observaciones" className="field-label">
                  Observaciones
                </label>
                <textarea
                  id="observaciones"
                  rows="3"
                  className="input"
                  style={{ resize: 'vertical', minHeight: '80px' }}
                  value={formData.observaciones}
                  onChange={(e) => handleFormChange('observaciones', e.target.value)}
                  placeholder="Observaciones generales..."
                />
              </div>

              {/* Subida de fotos (ELIMINADO - no permitido en estado inicial) */}

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCancelarNuevoParte}
                  disabled={formLoading}
                  className="btn"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="primary-btn"
                  style={{
                    flex: 2,
                    marginTop: 0,
                  }}
                >
                  {formLoading ? 'Creando parte...' : 'Crear Parte'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tablero Kanban */}
        {!showNewParteForm && (
          <div className="kanban-board">
            {loading ? (
              <div className="auth-card" style={{ textAlign: 'center', padding: '3rem', gridColumn: '1 / -1' }}>
                <p style={{ color: '#9ca3af', margin: 0 }}>Cargando partes...</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                {COLUMNS.map((column) => (
                  <div key={column.id} className="kanban-column">
                    <div className="kanban-column-header" style={{ borderColor: column.color }}>
                      <h3 style={{ color: column.color }}>{column.title}</h3>
                      <span className="kanban-column-count">{getPartesByColumn(column.id).length}</span>
                    </div>

                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`kanban-column-content ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                          style={{
                            background: snapshot.isDraggingOver ? `rgba(${column.color === '#facc15' ? '250, 204, 21' : column.color === '#60a5fa' ? '96, 165, 250' : column.color === '#a78bfa' ? '167, 139, 250' : '52, 211, 153'}, 0.05)` : 'transparent',
                          }}
                        >
                          {getPartesByColumn(column.id).map((parte, index) => (
                            <Draggable key={parte.id} draggableId={String(parte.id)} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`kanban-card ${snapshot.isDragging ? 'dragging' : ''}`}
                                  onClick={() => handleOpenEditModal(parte)}
                                  style={{
                                    ...provided.draggableProps.style,
                                    opacity: snapshot.isDragging ? 0.9 : 1,
                                  }}
                                >
                                  <div className="kanban-card-header">
                                    <span className="kanban-card-number" style={{ color: column.color }}>
                                      #{parte.numero_parte}
                                    </span>
                                    {parte.nombre_tecnico && (
                                      <span className="kanban-card-tech">
                                        👤 {parte.nombre_tecnico}
                                      </span>
                                    )}
                                  </div>

                                  <div className="kanban-card-body">
                                    <h4>{parte.aparato}</h4>
                                    <p className="kanban-card-location">
                                      <span>📍</span> {parte.poblacion}
                                    </p>
                                    {parte.observaciones && (
                                      <p className="kanban-card-notes">{parte.observaciones}</p>
                                    )}
                                  </div>

                                  {parte.fotos_json && (
                                    <div className="kanban-card-footer">
                                      <span className="kanban-card-badge">
                                        📷 {JSON.parse(parte.fotos_json).length} {JSON.parse(parte.fotos_json).length === 1 ? 'foto' : 'fotos'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {getPartesByColumn(column.id).length === 0 && (
                            <div className="kanban-empty">
                              <p>No hay partes aquí</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </DragDropContext>
            )}
          </div>
        )}

        {/* Modal de edición */}
        {showEditModal && selectedParte && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="auth-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '760px', margin: '2rem auto', maxHeight: '90vh', overflowY: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.3)',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f9fafb' }}>Editar Parte #{selectedParte.numero_parte}</h3>
                <button onClick={() => setShowEditModal(false)} disabled={formLoading} className="btn" style={{ padding: '0.4rem 0.8rem' }}>
                  ✕
                </button>
              </div>

              <form className="auth-form" onSubmit={handleUpdateParte} style={{ gap: '1.1rem' }}>
                {/* Mismo formulario que crear parte pero con ID del parte y botones diferentes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div className="field">
                    <label htmlFor="edit_numero_parte" className="field-label">
                      Nº Parte <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      id="edit_numero_parte"
                      type="text"
                      className={formErrors.numero_parte ? 'input input--error' : 'input'}
                      value={formData.numero_parte}
                      onChange={(e) => handleFormChange('numero_parte', e.target.value)}
                      placeholder="123456"
                      maxLength="6"
                    />
                    {formErrors.numero_parte && <p className="field-error">{formErrors.numero_parte}</p>}
                  </div>

                  <div className="field">
                    <label htmlFor="edit_aparato" className="field-label">
                      Aparato <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      id="edit_aparato"
                      type="text"
                      className={formErrors.aparato ? 'input input--error' : 'input'}
                      value={formData.aparato}
                      onChange={(e) => handleFormChange('aparato', e.target.value)}
                      placeholder="Ej. Aire Acondicionado Split"
                    />
                    {formErrors.aparato && <p className="field-error">{formErrors.aparato}</p>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="field">
                    <label htmlFor="edit_poblacion" className="field-label">
                      Población <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      id="edit_poblacion"
                      type="text"
                      className={formErrors.poblacion ? 'input input--error' : 'input'}
                      value={formData.poblacion}
                      onChange={(e) => handleFormChange('poblacion', e.target.value)}
                      placeholder="Ej. Madrid"
                    />
                    {formErrors.poblacion && <p className="field-error">{formErrors.poblacion}</p>}
                  </div>

                  <div className="field">
                    <label htmlFor="edit_cliente_email" className="field-label">
                      Email Cliente
                    </label>
                    <input
                      id="edit_cliente_email"
                      type="email"
                      className="input"
                      value={formData.cliente_email}
                      onChange={(e) => handleFormChange('cliente_email', e.target.value)}
                      placeholder="cliente@ejemplo.com"
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="edit_observaciones" className="field-label">
                    Información para el técnico
                  </label>
                  <textarea
                    id="edit_observaciones"
                    rows="3"
                    className="input"
                    style={{ resize: 'vertical', minHeight: '80px' }}
                    value={formData.observaciones}
                    onChange={(e) => handleFormChange('observaciones', e.target.value)}
                    placeholder="Observaciones generales..."
                    disabled={selectedParte.estado === 'reparado'}
                  />
                </div>

                {/* Instrucciones técnico (disponible desde 'revisado') */}
                {['revisado', 'visitado', 'reparado'].includes(selectedParte.estado) && (
                  <div className="field">
                    <label htmlFor="edit_instrucciones_tecnico" className="field-label">
                      Observaciones del técnico
                    </label>
                    <textarea
                      id="edit_instrucciones_tecnico"
                      rows="3"
                      className="input"
                      style={{ resize: 'vertical', minHeight: '80px' }}
                      value={formData.instrucciones_tecnico}
                      onChange={(e) => handleFormChange('instrucciones_tecnico', e.target.value)}
                      placeholder="Instrucciones internas..."
                      disabled={selectedParte.estado === 'reparado'}
                    />
                  </div>
                )}

                {/* Informe técnico y fotos (disponible desde 'visitado') */}
                {['visitado', 'reparado'].includes(selectedParte.estado) && (
                  <>
                    <div className="field">
                      <label htmlFor="edit_informe_tecnico" className="field-label">
                        Informe Técnico
                      </label>
                      <textarea
                        id="edit_informe_tecnico"
                        rows="4"
                        className="input"
                        style={{ resize: 'vertical', minHeight: '100px' }}
                        value={formData.informe_tecnico}
                        onChange={(e) => handleFormChange('informe_tecnico', e.target.value)}
                        placeholder="Informe técnico detallado..."
                        disabled={selectedParte.estado === 'reparado'}
                      />
                    </div>

                    <div className="field">
                      <label className="field-label">Fotos del Trabajo (Máximo 5)</label>
                      {selectedParte.estado !== 'reparado' && (
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                            style={{ display: 'none' }}
                            id="file-upload-edit"
                          />
                          <label htmlFor="file-upload-edit" className="btn" style={{ display: 'inline-flex', padding: '0.7rem 1rem', cursor: 'pointer' }}>
                            📷 Añadir Imágenes
                          </label>
                          <button
                            type="button"
                            onClick={startCamera}
                            className="btn"
                            style={{ display: 'inline-flex', padding: '0.7rem 1rem' }}
                          >
                            📸 Hacer Foto
                          </button>
                        </div>
                      )}

                      {/* Modal de cámara */}
                      {showCamera && (
                        <div style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.9)',
                          zIndex: 10000,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '1rem'
                        }}>
                          <div style={{
                            maxWidth: '600px',
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                          }}>
                            <video
                              ref={(ref) => {
                                if (ref && stream) {
                                  ref.srcObject = stream;
                                  setVideoRef(ref);
                                }
                              }}
                              autoPlay
                              playsInline
                              style={{
                                width: '100%',
                                borderRadius: '0.75rem',
                                backgroundColor: '#000'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={capturePhoto}
                                className="primary-btn"
                                style={{ padding: '0.75rem 1.5rem' }}
                              >
                                📸 Capturar
                              </button>
                              <button
                                type="button"
                                onClick={stopCamera}
                                className="btn"
                                style={{ padding: '0.75rem 1.5rem' }}
                              >
                                ✕ Cancelar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {imagePreviews.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                          {imagePreviews.map((preview, index) => (
                            <div
                              key={index}
                              style={{
                                position: 'relative',
                                borderRadius: '0.6rem',
                                overflow: 'hidden',
                                aspectRatio: '1',
                                border: '1px solid rgba(148, 163, 184, 0.3)',
                              }}
                            >
                              <img src={preview} alt={`Preview ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              {selectedParte.estado !== 'reparado' && (
                                <button
                                  type="button"
                                  onClick={() => removeImage(index)}
                                  style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    border: '1px solid rgba(248, 113, 113, 0.8)',
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    color: '#fecaca',
                                  }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {user.role === 'admin' && (
                    <button
                      type="button"
                      onClick={handleDeleteParte}
                      disabled={formLoading}
                      className="btn"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        background: 'rgba(248, 113, 113, 0.1)',
                        border: '1px solid rgba(248, 113, 113, 0.3)',
                        color: '#fecaca',
                      }}
                    >
                      🗑️ Eliminar
                    </button>
                  )}
                  {selectedParte.estado !== 'reparado' && (
                    <button type="submit" disabled={formLoading} className="primary-btn" style={{ flex: 2, marginTop: 0 }}>
                      {formLoading ? 'Actualizando...' : 'Guardar Cambios'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PartesBoard;

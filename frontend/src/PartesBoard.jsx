// BeeSoftware/frontend/src/PartesBoard.jsx
import { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import logoApp from './assets/logo-beesoftware.jpeg';
import { API_BASE_URL, getAuthHeaders } from './config/api';


// Definición de columnas del tablero Kanban (NUEVOS ESTADOS)
const COLUMNS = [
  { id: 'inicial', title: 'Parte inicial', color: '#facc15' },
  { id: 'revisando', title: 'Revisando', color: '#60a5fa' },
  { id: 'visitas_realizadas', title: 'Visitas realizadas', color: '#a78bfa' },
  { id: 'ausentes', title: 'Ausentes', color: '#34d399' },
];

function PartesBoard({ user, onLogout }) {
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
  
  // Estado para columnas colapsadas/expandidas
  const [collapsedColumns, setCollapsedColumns] = useState({});

  // Función para alternar colapsar/expandir columna
  const toggleColumn = (columnId) => {
    setCollapsedColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  };

  // Estado del formulario
  const [formData, setFormData] = useState({
    numero_parte: '',
    nombre_cliente: '',
    fecha_parte: '',
    aparato: '',
    poblacion: '',
    calle: '',
    observaciones: '',
    instrucciones_tecnico: '',
    informe_tecnico: '',
    cliente_email: '',
    cliente_telefono: '',
    telefono2_cliente: '',
    nombre_tecnico: '', // Para asignación de técnico (solo admin)
    dni_cliente: '',
    acepta_proteccion_datos: false,
    estado: '', // Estado del parte (se actualiza desde los botones mini)
  });

  const [formErrors, setFormErrors] = useState({});
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [videoRef, setVideoRef] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [currentPhaseTab, setCurrentPhaseTab] = useState('inicial'); // Para navegación de fases

  // ✅ Funciones utilitarias para Google Maps
  const buildMapsQuery = (parte) => {
    // Si tiene calle, usar "calle, poblacion", si no, solo "poblacion"
    if (parte.calle && parte.calle.trim()) {
      return `${parte.calle.trim()}, ${parte.poblacion.trim()}`;
    }
    return parte.poblacion.trim();
  };

  const openGoogleMaps = (parte, e) => {
    // Evitar que se abra el modal de edición al clicar en población
    e.stopPropagation();
    
    const query = buildMapsQuery(parte);
    const encodedQuery = encodeURIComponent(query);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
    
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  // Cargar partes al montar el componente
  useEffect(() => {
    loadTecnicos();
    loadPartes();
  }, [user]);

  // Autorefresco de partes cada 60 segundos
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('🔄 Actualizando partes automáticamente...');
      loadPartes();
    }, 60000); // 60 segundos

    // Limpiar el intervalo cuando el componente se desmonte
    return () => {
      console.log('🧹 Limpiando intervalo de autorefresco');
      clearInterval(intervalId);
    };
  }, [user]); // Dependencia de user para recrear el intervalo si cambia

  // Helper para headers de autenticación (usa la función importada)
  const getAuthHeadersWithUser = () => getAuthHeaders(user);

  // Cargar lista de técnicos (solo para admin)
  const loadTecnicos = async () => {
    if (user.role !== 'admin') return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/partes/tecnicos`, {
        headers: getAuthHeadersWithUser()
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
        headers: getAuthHeadersWithUser()
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
          headers: getAuthHeadersWithUser(),
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
        headers: getAuthHeadersWithUser(),
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
        headers: getAuthHeadersWithUser(),
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
        nombre_cliente: '',
        fecha_parte: '',
        aparato: '',
        poblacion: '',
        calle: '',
        observaciones: '',
        instrucciones_tecnico: '',
        informe_tecnico: '',
        cliente_email: '',
        cliente_telefono: '',
        telefono2_cliente: '',
        nombre_tecnico: '',
        dni_cliente: '',
        acepta_proteccion_datos: false,
        estado: '',
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
      nombre_cliente: '',
      fecha_parte: '',
      aparato: '',
      poblacion: '',
      calle: '',
      observaciones: '',
      instrucciones_tecnico: '',
      informe_tecnico: '',
      cliente_email: '',
      cliente_telefono: '',
      telefono2_cliente: '',
      nombre_tecnico: '',
      dni_cliente: '',
      acepta_proteccion_datos: false,
      estado: '',
    });
    setFormErrors({});
    setSelectedImages([]);
    setImagePreviews([]);
    setError('');
  };

  const handleOpenEditModal = (parte) => {
    setSelectedParte(parte);
    setCurrentPhaseTab(parte.estado); // Establecer el tab activo según el estado actual
    setFormData({
      numero_parte: parte.numero_parte,
      nombre_cliente: parte.nombre_cliente || '',
      fecha_parte: parte.fecha_parte || '',
      aparato: parte.aparato,
      poblacion: parte.poblacion,
      calle: parte.calle || '',
      observaciones: parte.observaciones || '',
      instrucciones_tecnico: parte.instrucciones_tecnico || '',
      informe_tecnico: parte.informe_tecnico || '',
      cliente_email: parte.cliente_email || '',
      cliente_telefono: parte.cliente_telefono || '',
      telefono2_cliente: parte.telefono2_cliente || '',
      nombre_tecnico: parte.nombre_tecnico || '',
      dni_cliente: parte.dni_cliente || '',
      acepta_proteccion_datos: parte.acepta_proteccion_datos || false,
      estado: parte.estado, // Cargar el estado actual
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
        estado: formData.estado || selectedParte.estado, // Usar el estado del formulario si fue modificado
        // ✅ ASEGURAR QUE SIEMPRE SE ENVÍAN ESTOS CAMPOS (INCLUSO SI SON VACÍOS)
        calle: formData.calle || '',
        cliente_telefono: formData.cliente_telefono || '',
        telefono2_cliente: formData.telefono2_cliente || '',
        dni_cliente: formData.dni_cliente || '',
        acepta_proteccion_datos: formData.acepta_proteccion_datos || false,
      };

      const response = await fetch(`${API_BASE_URL}/api/partes/${selectedParte.id}`, {
        method: 'PUT',
        headers: getAuthHeadersWithUser(),
        body: JSON.stringify(parteData),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Error al actualizar el parte');
      }

      // ✅ Actualizar selectedParte con los datos guardados (importante para validaciones de email)
      setSelectedParte(data.data);
      
      // ✅ Actualizar formData con los datos guardados (para reflejar cambios en el formulario)
      setFormData({
        numero_parte: data.data.numero_parte,
        aparato: data.data.aparato,
        poblacion: data.data.poblacion,
        calle: data.data.calle || '',
        observaciones: data.data.observaciones || '',
        instrucciones_tecnico: data.data.instrucciones_tecnico || '',
        informe_tecnico: data.data.informe_tecnico || '',
        cliente_email: data.data.cliente_email || '',
        cliente_telefono: data.data.cliente_telefono || '',
        telefono2_cliente: data.data.telefono2_cliente || '',
        nombre_tecnico: data.data.nombre_tecnico || '',
        dni_cliente: data.data.dni_cliente || '',
        acepta_proteccion_datos: data.data.acepta_proteccion_datos || false,
        estado: data.data.estado,
      });

      await loadPartes();

      // ✅ NO cerrar el modal automáticamente - permitir seguir editando o enviar email
      // El usuario puede cerrar manualmente si lo desea
      setError('');
      
      // Mostrar mensaje de éxito
      alert('✅ Parte actualizado correctamente');
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
        headers: getAuthHeadersWithUser(),
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
        nombre_cliente: '',
        fecha_parte: '',
        aparato: '',
        poblacion: '',
        calle: '',
        observaciones: '',
        instrucciones_tecnico: '',
        informe_tecnico: '',
        cliente_email: '',
        cliente_telefono: '',
        telefono2_cliente: '',
        nombre_tecnico: '',
        dni_cliente: '',
        acepta_proteccion_datos: false,
        estado: '',
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

  const handleEnviarEmail = async () => {
    // ✅ VALIDACIONES OBLIGATORIAS PARA ENVIAR EMAIL (RGPD)
    // Validar que existen todos los campos necesarios
    const camposFaltantes = [];
    
    if (!selectedParte.cliente_email || !selectedParte.cliente_email.trim()) {
      camposFaltantes.push('Email del cliente');
    }
    
    if (!selectedParte.dni_cliente || !selectedParte.dni_cliente.trim()) {
      camposFaltantes.push('DNI del cliente');
    }
    
    if (!selectedParte.acepta_proteccion_datos) {
      camposFaltantes.push('Aceptación de protección de datos (checkbox)');
    }
    
    // Si faltan campos, mostrar mensaje y no permitir envío
    if (camposFaltantes.length > 0) {
      const mensaje = `❌ No se puede enviar el email. Faltan los siguientes datos:\n\n${camposFaltantes.map(c => `• ${c}`).join('\n')}\n\nPor favor, completa estos campos en el formulario y guarda los cambios antes de enviar el email.`;
      alert(mensaje);
      return;
    }

    try {
      setSendingEmail(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/api/partes/${selectedParte.id}/enviar-email`, {
        method: 'POST',
        headers: getAuthHeadersWithUser(),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Error al enviar el email');
      }

      // Mostrar mensaje de éxito detallado
      alert(`✅ Email enviado exitosamente\n\nDestinatario: ${data.to}\nAsunto: ${data.subject}\nID de mensaje: ${data.messageId}`);
      
      // Si hay URL de preview (cuenta de prueba), mostrarla en consola
      if (data.previewUrl) {
        console.log('📧 Vista previa del email (cuenta de prueba):', data.previewUrl);
        console.log('💡 Abre la URL anterior en tu navegador para ver el email enviado');
      }

      console.log('✅ Email enviado correctamente:', {
        messageId: data.messageId,
        to: data.to,
        subject: data.subject,
      });

    } catch (err) {
      console.error('❌ Error enviando email:', err);
      const errorMsg = err.message || 'Error desconocido al enviar el email';
      setError(errorMsg);
      alert(`❌ Error al enviar el email\n\n${errorMsg}\n\nRevisa la consola para más detalles.`);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-backdrop" />

      <div className="kanban-container">
        {/* Header */}
        <header className="kanban-header">
          <div className="auth-logo-row">
            <div className="brand-logo">
              <img src={logoApp} alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
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

          {/* Botón de cerrar sesión */}
          <button
            onClick={onLogout}
            className="btn"
            style={{
              padding: '0.6rem 1rem',
              fontSize: '0.9rem',
              whiteSpace: 'nowrap',
            }}
            title="Cerrar sesión"
          >
            🚪 Salir
          </button>
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
              {/* Fila 1: Número de parte, Nombre del cliente y Fecha */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '1rem' }}>
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
                  <label htmlFor="nombre_cliente" className="field-label">
                    Nombre del Cliente
                  </label>
                  <input
                    id="nombre_cliente"
                    type="text"
                    className="input"
                    value={formData.nombre_cliente}
                    onChange={(e) => handleFormChange('nombre_cliente', e.target.value)}
                    placeholder="Ej. Juan Pérez"
                  />
                </div>

                <div className="field">
                  <label htmlFor="fecha_parte" className="field-label">
                    Fecha del Parte
                  </label>
                  <input
                    id="fecha_parte"
                    type="date"
                    className="input"
                    value={formData.fecha_parte}
                    onChange={(e) => handleFormChange('fecha_parte', e.target.value)}
                  />
                </div>
              </div>

              {/* Fila 2: Aparato */}
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

              {/* Fila 3: Población y Calle */}
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
                  <label htmlFor="calle" className="field-label">
                    Calle
                  </label>
                  <input
                    id="calle"
                    type="text"
                    className="input"
                    value={formData.calle}
                    onChange={(e) => handleFormChange('calle', e.target.value)}
                    placeholder="Ej. Av. XXX 12, 3ºB"
                  />
                </div>
              </div>

              {/* Fila 3: Email y Teléfonos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="field">
                  <label htmlFor="cliente_email" className="field-label">
                    Email CLIENTE
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

                <div className="field">
                  <label htmlFor="cliente_telefono" className="field-label">
                    Teléfono 1
                  </label>
                  <input
                    id="cliente_telefono"
                    type="tel"
                    className="input"
                    value={formData.cliente_telefono}
                    onChange={(e) => handleFormChange('cliente_telefono', e.target.value)}
                    placeholder="Ej: +34 600 123 123"
                  />
                </div>

                <div className="field">
                  <label htmlFor="telefono2_cliente" className="field-label">
                    Teléfono 2
                  </label>
                  <input
                    id="telefono2_cliente"
                    type="tel"
                    className="input"
                    value={formData.telefono2_cliente}
                    onChange={(e) => handleFormChange('telefono2_cliente', e.target.value)}
                    placeholder="Ej: +34 600 456 456"
                  />
                </div>
              </div>

              {/* Fila 4: Selección de Técnico (solo admin) */}
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
                    <div 
                      className="kanban-column-header" 
                      style={{ borderColor: column.color, cursor: 'pointer' }}
                      onClick={() => toggleColumn(column.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <span style={{ fontSize: '1rem', color: column.color }}>
                          {collapsedColumns[column.id] ? '▶' : '▼'}
                        </span>
                        <h3 style={{ color: column.color, margin: 0 }}>{column.title}</h3>
                      </div>
                      <span className="kanban-column-count">{getPartesByColumn(column.id).length}</span>
                    </div>

                    {!collapsedColumns[column.id] && (
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
                                    {parte.nombre_cliente && (
                                      <span className="kanban-card-tech" style={{ fontSize: '0.75rem' }}>
                                        👤 {parte.nombre_cliente}
                                      </span>
                                    )}
                                    {parte.fecha_parte && (
                                      <span className="kanban-card-tech" style={{ fontSize: '0.75rem' }}>
                                        📅 {new Date(parte.fecha_parte).toLocaleDateString('es-ES')}
                                      </span>
                                    )}
                                    <span 
                                      className="kanban-card-location-header"
                                      onClick={(e) => openGoogleMaps(parte, e)}
                                      style={{ 
                                        cursor: 'pointer',
                                        textDecoration: 'none',
                                        transition: 'all 0.2s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.textDecoration = 'underline';
                                        e.target.style.color = column.color;
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.textDecoration = 'none';
                                        e.target.style.color = '#9ca3af';
                                      }}
                                      title={buildMapsQuery(parte)}
                                    >
                                      📍 {parte.poblacion}
                                    </span>
                                    {/* Mostrar nombre del técnico SOLO si es admin */}
                                    {user.role === 'admin' && parte.nombre_tecnico && (
                                      <span className="kanban-card-tech">
                                        🔧 {parte.nombre_tecnico}
                                      </span>
                                    )}
                                  </div>

                                  <div className="kanban-card-body">
                                    <h4>{parte.aparato}</h4>
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
                    )}
                  </div>
                ))}
              </DragDropContext>
            )}
          </div>
        )}

        {/* Modal de edición */}
        {showEditModal && selectedParte && (
          <div 
            className="modal-overlay" 
            onClick={(e) => {
              if (e.target.classList.contains('modal-overlay')) {
                setShowEditModal(false);
              }
            }}
          >
            <div className="auth-card modal-content" style={{ maxWidth: '760px', margin: '2rem auto', maxHeight: '90vh', overflowY: 'auto' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '1rem' }}>
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
                    <label htmlFor="edit_nombre_cliente" className="field-label">
                      Nombre del Cliente
                    </label>
                    <input
                      id="edit_nombre_cliente"
                      type="text"
                      className="input"
                      value={formData.nombre_cliente}
                      onChange={(e) => handleFormChange('nombre_cliente', e.target.value)}
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="edit_fecha_parte" className="field-label">
                      Fecha del Parte
                    </label>
                    <input
                      id="edit_fecha_parte"
                      type="date"
                      className="input"
                      value={formData.fecha_parte}
                      onChange={(e) => handleFormChange('fecha_parte', e.target.value)}
                    />
                  </div>
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
                    <label htmlFor="edit_calle" className="field-label">
                      Calle
                    </label>
                    <input
                      id="edit_calle"
                      type="text"
                      className="input"
                      value={formData.calle}
                      onChange={(e) => handleFormChange('calle', e.target.value)}
                      placeholder="Ej. Av. XXX 12, 3ºB"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
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

                  <div className="field">
                    <label htmlFor="edit_cliente_telefono" className="field-label">
                      Teléfono 1
                    </label>
                    <input
                      id="edit_cliente_telefono"
                      type="tel"
                      className="input"
                      value={formData.cliente_telefono}
                      onChange={(e) => handleFormChange('cliente_telefono', e.target.value)}
                      placeholder="Ej: +34 600 123 123"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="edit_telefono2_cliente" className="field-label">
                      Teléfono 2
                    </label>
                    <input
                      id="edit_telefono2_cliente"
                      type="tel"
                      className="input"
                      value={formData.telefono2_cliente}
                      onChange={(e) => handleFormChange('telefono2_cliente', e.target.value)}
                      placeholder="Ej: +34 600 456 456"
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
                  />
                </div>

                {/* Instrucciones técnico (disponible desde 'revisando') */}
                {['revisando', 'visitas_realizadas', 'ausentes'].includes(formData.estado || selectedParte.estado) && (
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
                    />
                  </div>
                )}

                {/* Informe técnico y fotos (disponible desde 'revisando') */}
                {['revisando', 'visitas_realizadas', 'ausentes'].includes(formData.estado || selectedParte.estado) && (
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
                      />
                    </div>

                    <div className="field">
                      <label className="field-label">Fotos del Trabajo (Máximo 5)</label>
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
                                  fontSize: '0.76rem',
                                  color: '#fecaca',
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Campos adicionales para estado "revisando", "visitas_realizadas" y "ausentes" */}
                    <div className="field">
                      <label htmlFor="edit_dni_cliente" className="field-label">
                        DNI del cliente
                      </label>
                      <input
                        id="edit_dni_cliente"
                        type="text"
                        className="input"
                        value={formData.dni_cliente}
                        onChange={(e) => handleFormChange('dni_cliente', e.target.value)}
                        placeholder="Ej. 12345678A"
                      />
                    </div>

                    <div className="field">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={formData.acepta_proteccion_datos}
                          onChange={(e) => handleFormChange('acepta_proteccion_datos', e.target.checked)}
                        />
                        <span>El cliente declara haber sido informado y acepta la política de protección de datos.</span>
                      </label>
                    </div>

                    {/* Botón de enviar email - solo si cumple TODOS los requisitos de RGPD */}
                    {(() => {
                      // Validar todas las condiciones necesarias para enviar email
                      const tieneEmail = formData.cliente_email && formData.cliente_email.trim();
                      const tieneDNI = formData.dni_cliente && formData.dni_cliente.trim();
                      const aceptaProteccion = formData.acepta_proteccion_datos;
                      
                      const puedeEnviarEmail = tieneEmail && tieneDNI && aceptaProteccion;
                      
                      if (puedeEnviarEmail) {
                        return (
                          <div style={{ marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={handleEnviarEmail}
                              disabled={sendingEmail || formLoading}
                              className="btn"
                              style={{
                                width: '100%',
                                padding: '0.75rem',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                background: 'rgba(52, 211, 153, 0.1)',
                                border: '1px solid rgba(52, 211, 153, 0.3)',
                                color: '#6ee7b7',
                                cursor: sendingEmail || formLoading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {sendingEmail ? '📧 Enviando email...' : '✉️ Enviar email al cliente'}
                            </button>
                            <p style={{ 
                              fontSize: '0.85rem', 
                              color: '#9ca3af', 
                              marginTop: '0.5rem',
                              textAlign: 'center',
                            }}>
                              Se enviará a: {formData.cliente_email}
                            </p>
                          </div>
                        );
                      } else {
                        // Determinar qué campos faltan
                        const camposFaltantes = [];
                        if (!tieneEmail) camposFaltantes.push('Email del cliente');
                        if (!tieneDNI) camposFaltantes.push('DNI del cliente');
                        if (!aceptaProteccion) camposFaltantes.push('Aceptación de protección de datos');
                        
                        return (
                          <div style={{ marginTop: '0.5rem' }}>
                            <p style={{ 
                              fontSize: '0.85rem', 
                              color: '#f87171', 
                              textAlign: 'center',
                              padding: '0.75rem',
                              backgroundColor: 'rgba(248, 113, 113, 0.1)',
                              borderRadius: '0.4rem',
                              border: '1px solid rgba(248, 113, 113, 0.3)',
                              margin: 0,
                            }}>
                              ⚠️ No se puede enviar email. Faltan:<br/>
                              <strong>{camposFaltantes.join(', ')}</strong>
                            </p>
                          </div>
                        );
                      }
                    })()}
                  </>
                )}

                {/* Mini botones de cambio de estado - justo encima del botón Guardar */}
                <div style={{ 
                  marginTop: '1.5rem',
                  padding: '1rem',
                  backgroundColor: 'rgba(31, 41, 55, 0.5)',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(148, 163, 184, 0.2)'
                }}>
                  <label className="field-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                    Cambiar estado del parte:
                  </label>
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    {COLUMNS.map((column) => (
                      <button
                        key={column.id}
                        type="button"
                        onClick={() => handleFormChange('estado', column.id)}
                        disabled={formLoading}
                        style={{
                          flex: 1,
                          minWidth: '100px',
                          padding: '0.6rem 0.8rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          borderRadius: '0.4rem',
                          border: formData.estado === column.id || (!formData.estado && selectedParte.estado === column.id) 
                            ? `2px solid ${column.color}` 
                            : '1px solid rgba(148, 163, 184, 0.3)',
                          backgroundColor: formData.estado === column.id || (!formData.estado && selectedParte.estado === column.id)
                            ? `${column.color}20` 
                            : 'rgba(31, 41, 55, 0.7)',
                          color: formData.estado === column.id || (!formData.estado && selectedParte.estado === column.id)
                            ? column.color 
                            : '#9ca3af',
                          cursor: formLoading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {column.title}
                      </button>
                    ))}
                  </div>
                  <p style={{ 
                    fontSize: '0.8rem', 
                    color: '#9ca3af', 
                    marginTop: '0.75rem',
                    marginBottom: 0,
                    textAlign: 'center'
                  }}>
                    💡 Selecciona el nuevo estado y luego pulsa "Guardar cambios"
                  </p>
                </div>

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="submit" disabled={formLoading} className="primary-btn" style={{ flex: 1, marginTop: 0 }}>
                    {formLoading ? 'Actualizando...' : 'Guardar Cambios'}
                  </button>
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

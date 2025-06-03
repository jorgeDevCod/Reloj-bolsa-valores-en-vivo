const mainMarkets = [
    {
        name: 'Nueva York',
        country: 'Estados Unidos',
        timezone: 'America/New_York',
        market: 'NYSE / NASDAQ',
        icon: 'fas fa-chart-line',
        openHour: 9, closeHour: 16,
        flag: '🇺🇸'
    },
    {
        name: 'Londres',
        country: 'Reino Unido',
        timezone: 'Europe/London',
        market: 'LSE',
        icon: 'fas fa-pound-sign',
        openHour: 8, closeHour: 16.5,
        flag: '🇬🇧'
    },
    {
        name: 'Tokio',
        country: 'Japón',
        timezone: 'Asia/Tokyo',
        market: 'TSE',
        icon: 'fas fa-yen-sign',
        openHour: 9, closeHour: 15,
        flag: '🇯🇵'
    },
    {
        name: 'Hong Kong',
        country: 'China',
        timezone: 'Asia/Hong_Kong',
        market: 'HKEX',
        icon: 'fas fa-coins',
        openHour: 9.5, closeHour: 16,
        flag: '🇭🇰'
    },
    {
        name: 'Sídney',
        country: 'Australia',
        timezone: 'Australia/Sydney',
        market: 'ASX',
        icon: 'fas fa-dollar-sign',
        openHour: 10, closeHour: 16,
        flag: '🇦🇺'
    },
    {
        name: 'Fráncfort',
        country: 'Alemania',
        timezone: 'Europe/Berlin',
        market: 'XETRA',
        icon: 'fas fa-euro-sign',
        openHour: 9, closeHour: 17.5,
        flag: '🇩🇪'
    }
];

// Variables globales mejoradas
let worldCities = [];
let userMarkets = [];
let searchResults = [];
let isLoading = true;
let marketAlerts = new Map(); // Para almacenar las alertas activas
let notificationPermission = false;
let serviceWorker = null;

// Inicializar Service Worker
async function initServiceWorker() {
    if ( 'serviceWorker' in navigator ) {
        try {
            const registration = await navigator.serviceWorker.register( 'sw.js' );
            console.log( 'Service Worker registrado exitosamente' );

            // Obtener el service worker activo
            serviceWorker = registration.active || registration.waiting || registration.installing;

            // Escuchar mensajes del service worker
            navigator.serviceWorker.addEventListener( 'message', event => {
                const { type, alerts } = event.data;
                if ( type === 'ACTIVE_ALERTS' ) {
                    loadPersistedAlerts( alerts );
                }
            } );

            // Cargar alertas persistentes al iniciar
            await loadPersistedAlerts();

        } catch ( error ) {
            console.error( 'Error al registrar Service Worker:', error );
        }
    }
}

// Cargar alertas persistentes
async function loadPersistedAlerts( alerts = null ) {
    if ( !alerts && serviceWorker ) {
        // Solicitar alertas al service worker
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = ( event ) => {
            if ( event.data.type === 'ACTIVE_ALERTS' ) {
                loadPersistedAlerts( event.data.alerts );
            }
        };

        serviceWorker.postMessage(
            { type: 'GET_ACTIVE_ALERTS' },
            [ messageChannel.port2 ]
        );
        return;
    }

    if ( alerts && Array.isArray( alerts ) ) {
        marketAlerts.clear();
        alerts.forEach( alert => {
            marketAlerts.set( alert.id, {
                market: alert.market,
                alertType: alert.alertType,
                targetTime: new Date( alert.targetTime ),
                persistent: true
            } );
        } );

        // Actualizar interfaz
        renderMainMarkets();
        renderUserMarkets();

        const alertsPanel = document.getElementById( 'alerts-panel' );
        if ( alertsPanel && !alertsPanel.classList.contains( 'hidden' ) ) {
            updateAlertsPanel();
        }

        // Actualizar contador al cargar alertas persistentes
        updateAlertsCounter();

        console.log( `Cargadas ${alerts.length} alertas persistentes` );
    }
}

// Guardar alerta en Service Worker
async function saveAlertToPersistence( alertId, market, alertType, targetTime, recurring = true ) {
    if ( serviceWorker ) {
        const alertData = {
            id: alertId,
            market: market,
            alertType: alertType,
            targetTime: targetTime.getTime(),
            recurring: recurring,
            created: Date.now()
        };

        serviceWorker.postMessage( {
            type: 'SCHEDULE_ALERT',
            data: alertData
        } );
    }
}

// Cancelar alerta persistente
async function cancelPersistentAlert( alertId ) {
    if ( serviceWorker ) {
        serviceWorker.postMessage( {
            type: 'CANCEL_ALERT',
            data: { alertId }
        } );
    }
}

// Función para escapar HTML y prevenir XSS
function escapeHtml( text ) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace( /[&<>"']/g, function ( m ) { return map[ m ]; } );
}

// Cargar datos del JSON
async function loadCitiesData() {
    try {
        showLoadingState( true );
        const response = await fetch( 'world-cities.json' );
        if ( !response.ok ) {
            throw new Error( `HTTP error! status: ${response.status}` );
        }
        const data = await response.json();
        worldCities = data.cities;
        showLoadingState( false );
        showDefaultSuggestions();
        console.log( `Cargadas ${worldCities.length} ciudades desde el JSON` );
    } catch ( error ) {
        console.error( 'Error al cargar los datos de ciudades:', error );
        showLoadingState( false, 'Error al cargar la base de datos de ciudades. Usando datos básicos.' );
        // Fallback a datos básicos si falla la carga
        worldCities = [
            { name: 'Toronto', country: 'Canadá', timezone: 'America/Toronto', market: 'TSX', flag: '🇨🇦', openHour: 9.5, closeHour: 16 },
            { name: 'São Paulo', country: 'Brasil', timezone: 'America/Sao_Paulo', market: 'B3', flag: '🇧🇷', openHour: 10, closeHour: 17 },
            { name: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata', market: 'BSE', flag: '🇮🇳', openHour: 9.25, closeHour: 15.5 },
            { name: 'Seúl', country: 'Corea del Sur', timezone: 'Asia/Seoul', market: 'KRX', flag: '🇰🇷', openHour: 9, closeHour: 15.5 }
        ];
        showDefaultSuggestions();
    }
}

// Mostrar estado de carga
function showLoadingState( loading, errorMessage = null ) {
    const suggestionsContainer = document.getElementById( 'search-suggestions' );
    const searchInput = document.getElementById( 'country-search' );
    const addButton = document.getElementById( 'add-country-btn' );

    if ( loading ) {
        suggestionsContainer.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-spinner fa-spin text-white text-2xl mb-2"></i>
                <p class="text-white">Cargando base de datos de ciudades...</p>
            </div>
        `;
        searchInput.disabled = true;
        addButton.disabled = true;
        isLoading = true;
    } else {
        searchInput.disabled = false;
        addButton.disabled = false;
        isLoading = false;

        if ( errorMessage ) {
            suggestionsContainer.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-exclamation-triangle text-yellow-400 text-xl mb-2"></i>
                    <p class="text-yellow-200 text-sm">${errorMessage}</p>
                </div>
            `;
        }
    }
}

// Función para obtener el estado del mercado
function getMarketStatus( timezone, openHour = 9, closeHour = 17 ) {
    try {
        // Crear un objeto Date para la zona horaria específica
        const now = new Date();
        const marketTime = new Date( now.toLocaleString( "en-US", { timeZone: timezone } ) );

        // getDay() devuelve: 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado
        const dayOfWeek = marketTime.getDay();

        // Calcular la hora actual en formato decimal
        const currentHour = marketTime.getHours() + marketTime.getMinutes() / 60;

        // Debug: log para verificar valores
        console.log( `${timezone}: día=${dayOfWeek}, hora=${currentHour.toFixed( 2 )}, apertura=${openHour}, cierre=${closeHour}` );

        // Verificar si es fin de semana
        if ( dayOfWeek === 0 || dayOfWeek === 6 ) {
            return { status: 'Cerrado', class: 'status-closed' };
        }

        // Verificar horarios del mercado
        if ( currentHour >= openHour && currentHour < closeHour ) {
            return { status: 'Abierto', class: 'status-open' };
        } else if ( currentHour >= ( openHour - 1 ) && currentHour < openHour ) {
            return { status: 'Pre-apertura', class: 'status-pre' };
        } else {
            return { status: 'Cerrado', class: 'status-closed' };
        }
    } catch ( error ) {
        console.error( `Error obteniendo estado del mercado para ${timezone}:`, error );
        return { status: 'Error', class: 'status-closed' };
    }
}

// Función para crear una tarjeta de mercado
function createMarketCard( market, isUser = false ) {
    const marketStatus = getMarketStatus( market.timezone, market.openHour, market.closeHour );
    const marketKey = `${market.timezone}-${market.name}`;
    const hasOpenAlert = marketAlerts.has( `${marketKey}-open` );
    const hasCloseAlert = marketAlerts.has( `${marketKey}-close` );

    // Formatear horarios
    const openTime = formatHour( market.openHour );
    const closeTime = formatHour( market.closeHour );

    return `
        <div class="clock-card rounded-2xl p-6 text-white shadow-xl ${marketStatus.status === 'Abierto' ? 'market-open' : marketStatus.status === 'Cerrado' ? 'market-closed' : 'market-pre'}">
            <div class="mobile-card-content">
                <!-- Header móvil con información y tiempo -->
                <div class="mobile-header">
                    <div class="mobile-info row lg:flex lg:flex-col lg:gap-2 lg:mb-2">
                    <div class="info-titles">
                        <h3 class="text-xl font-bold mb-1">
                            ${market.flag} ${market.name}
                        </h3>
                        <p class="text-white text-sm">${market.country}</p>
                        <p class="text-white text-xs">${market.market || 'Mercado Principal'}</p>
                        </div>
                        <div class="text-xs text-white market-hours">
                        <div class="items-cente mb-2">
                        <i class="fas fa-door-open"></i>
                        <span>Apertura: ${openTime}</span>
                        <span class="peru-time-comparison">(${getPeruEquivalentTime( market.timezone, market.openHour )} PE)</span>
                    </div>
                    <div class="items-center">
                        <i class="fas fa-door-closed"></i>
                        <span>Cierre: ${closeTime}</span>
                        <span class="peru-time-comparison">(${getPeruEquivalentTime( market.timezone, market.closeHour )} PE)</span>
                    </div>
                        </div>
                    </div>
                    <div class="mobile-time">
                        <div class="digital-font text-2xl md:text-3xl font-bold market-time" data-timezone="${market.timezone}">
                            --:--:--
                        </div>
                        <div class="text-sm market-date" data-timezone="${market.timezone}">
                            -- de ---- de ----
                        </div>
                        ${isUser ? `<button onclick="removeUserMarket('${market.timezone}')" class="text-red-400 hover:text-red-700 transition-colors mt-2  position-close" title="Eliminar">
                            <i class="fas fa-times text-xl"></i>
                        </button>` : ''}
                    </div>
                </div>
                
                <!-- Fila de estado y alertas móvil -->
                <div class="mobile-status-row mobile">
                    <span class="market-status rounded-full ${marketStatus.class}">
                        ${marketStatus.status}
                    </span>
                    
                    <!-- Botones de alertas móvil -->
                    <div class="mobile-alerts">
                        <button onclick="toggleAlert('${marketKey}', 'open')" 
                                class="alert-btn rounded transition-all duration-300 ${hasOpenAlert ? 'active-open' : ''}" 
                                title="${hasOpenAlert ? 'Cancelar alerta de apertura' : 'Activar alerta de apertura'}">
                            <i class="fas fa-bell${hasOpenAlert ? '' : '-slash'}"></i>
                            <span class="alert-text">Apertura</span>
                        </button>
                        <button onclick="toggleAlert('${marketKey}', 'close')" 
                                class="alert-btn rounded transition-all duration-300 ${hasCloseAlert ? 'active-close' : ''}" 
                                title="${hasCloseAlert ? 'Cancelar alerta de cierre' : 'Activar alerta de cierre'}">
                            <i class="fas fa-bell${hasCloseAlert ? '' : '-slash'}"></i>
                            <span class="alert-text">Cierre</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Función para buscar ciudades/países (mejorada)
function searchCities( searchTerm ) {
    const term = searchTerm.toLowerCase().trim();
    if ( !term || worldCities.length === 0 ) return [];

    // Búsqueda inteligente que considera múltiples campos
    const results = worldCities.filter( city => {
        const nameMatch = city.name.toLowerCase().includes( term );
        const countryMatch = city.country.toLowerCase().includes( term );
        const marketMatch = city.market.toLowerCase().includes( term );
        const regionMatch = city.region && city.region.toLowerCase().includes( term );

        return nameMatch || countryMatch || marketMatch || regionMatch;
    } );

    // Ordenar resultados por relevancia
    return results.sort( ( a, b ) => {
        const aNameMatch = a.name.toLowerCase().startsWith( term );
        const bNameMatch = b.name.toLowerCase().startsWith( term );
        const aCountryMatch = a.country.toLowerCase().startsWith( term );
        const bCountryMatch = b.country.toLowerCase().startsWith( term );

        // Priorizar coincidencias que empiecen con el término
        if ( aNameMatch && !bNameMatch ) return -1;
        if ( !aNameMatch && bNameMatch ) return 1;
        if ( aCountryMatch && !bCountryMatch ) return -1;
        if ( !aCountryMatch && bCountryMatch ) return 1;

        return a.name.localeCompare( b.name );
    } ).slice( 0, 12 ); // Mostrar hasta 12 resultados
}

// Función para mostrar resultados de búsqueda
function showSearchResults( results ) {
    const suggestionsContainer = document.getElementById( 'search-suggestions' );

    if ( results.length === 0 ) {
        suggestionsContainer.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-search text-white text-xl mb-2"></i>
                <p class="text-white">No se encontraron resultados para tu búsqueda.</p>
                <p class="text-white text-sm mt-1">Intenta con nombres como: Londres, Tokyo, Mumbai, etc.</p>
            </div>
        `;
        return;
    }

    const suggestions = results.map( city =>
        `<button onclick="addCityFromResults('${city.timezone}', '${escapeHtml( city.name )}', '${escapeHtml( city.country )}', '${escapeHtml( city.market )}', '${city.flag}', ${city.openHour}, ${city.closeHour})" 
                 class="suggestion-btn px-3 py-2 rounded-lg text-white text-sm font-medium transition-all duration-300 hover:scale-105" 
                 title="Agregar ${city.name}, ${city.country}">
            ${city.flag} ${city.name}
            <span class="text-xs opacity-75 block">${city.country}</span>
        </button>`
    ).join( '' );

    suggestionsContainer.innerHTML = `
        <div class="mb-2">
            <p class="text-white text-sm">Resultados encontrados (${results.length}):</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            ${suggestions}
        </div>
    `;
}

// Función para mostrar sugerencias por defecto
function showDefaultSuggestions() {
    const defaultSuggestions = worldCities.slice( 0, 8 ); // Mostrar las primeras 8 ciudades
    const suggestionsContainer = document.getElementById( 'search-suggestions' );

    const suggestions = defaultSuggestions.map( city =>
        `<button onclick="addCityFromResults('${city.timezone}', '${escapeHtml( city.name )}', '${escapeHtml( city.country )}', '${escapeHtml( city.market )}', '${city.flag}', ${city.openHour}, ${city.closeHour})" 
                 class="suggestion-btn px-3 py-2 rounded-lg text-white text-sm font-medium transition-all duration-300 hover:scale-105" 
                 title="Agregar ${city.name}, ${city.country}">
            ${city.flag} ${city.name}
            <span class="text-xs opacity-75 block">${city.country}</span>
        </button>`
    ).join( '' );

    suggestionsContainer.innerHTML = `
        <div class="mb-2">
            <p class="text-white text-sm">Ciudades populares:</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            ${suggestions}
        </div>
    `;
}

// Función para agregar ciudad desde los resultados de búsqueda
function addCityFromResults( timezone, name, country, market, flag, openHour, closeHour ) {
    // Verificar si ya existe
    if ( userMarkets.some( market => market.timezone === timezone ) ) {
        alert( 'Este mercado ya está agregado' );
        return;
    }

    const newMarket = {
        name: name,
        country: country,
        timezone: timezone,
        market: market,
        flag: flag,
        openHour: openHour,
        closeHour: closeHour
    };

    userMarkets.push( newMarket );
    renderUserMarkets();

    // Limpiar búsqueda
    document.getElementById( 'country-search' ).value = '';
    showDefaultSuggestions();
}

// Función para eliminar mercado del usuario
function removeUserMarket( timezone ) {
    userMarkets = userMarkets.filter( market => market.timezone !== timezone );
    renderUserMarkets();
}

// Función para renderizar mercados del usuario
function renderUserMarkets() {
    const userMarketsContainer = document.getElementById( 'user-markets' );

    if ( userMarkets.length === 0 ) {
        userMarketsContainer.innerHTML = '';
        return;
    }

    const marketsHTML = userMarkets.map( market => createMarketCard( market, true ) ).join( '' );
    userMarketsContainer.innerHTML = marketsHTML;
}

// Función para actualizar la hora en todas las tarjetas
function updateAllTimes() {
    // Actualizar Perú
    updatePeruTime();

    // Actualizar mercados principales
    document.querySelectorAll( '#main-markets .market-time' ).forEach( timeElement => {
        const timezone = timeElement.getAttribute( 'data-timezone' );
        if ( timezone ) {
            updateTimeForTimezone( timeElement, timezone );
        }
    } );

    // Actualizar fechas de mercados principales
    document.querySelectorAll( '#main-markets .market-date' ).forEach( dateElement => {
        const timezone = dateElement.getAttribute( 'data-timezone' );
        if ( timezone ) {
            updateDateForTimezone( dateElement, timezone );
        }
    } );

    // Actualizar mercados de usuario
    document.querySelectorAll( '#user-markets .market-time' ).forEach( timeElement => {
        const timezone = timeElement.getAttribute( 'data-timezone' );
        if ( timezone ) {
            updateTimeForTimezone( timeElement, timezone );
        }
    } );

    document.querySelectorAll( '#user-markets .market-date' ).forEach( dateElement => {
        const timezone = dateElement.getAttribute( 'data-timezone' );
        if ( timezone ) {
            updateDateForTimezone( dateElement, timezone );
        }
    } );

    // Actualizar estados de mercado
    updateMarketStatuses();
}

// Función para actualizar la hora de Perú
function updatePeruTime() {
    const peruTimeElement = document.getElementById( 'peru-time' );
    const peruDateElement = document.getElementById( 'peru-date' );
    const peruStatusElement = document.getElementById( 'peru-status' );

    if ( peruTimeElement ) {
        try {
            const now = new Date();
            const timeString = new Intl.DateTimeFormat( 'es-PE', {
                timeZone: 'America/Lima',
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            } ).format( now );

            peruTimeElement.textContent = timeString;
        } catch ( error ) {
            console.error( 'Error actualizando hora de Perú:', error );
            peruTimeElement.textContent = '--:--:--';
        }
    }

    if ( peruDateElement ) {
        try {
            const now = new Date();
            const dateString = new Intl.DateTimeFormat( 'es-PE', {
                timeZone: 'America/Lima',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            } ).format( now );

            peruDateElement.textContent = dateString;
        } catch ( error ) {
            console.error( 'Error actualizando fecha de Perú:', error );
            peruDateElement.textContent = '-- de ---- de ----';
        }
    }

    // Actualizar estado del mercado peruano (BVL: 9:00 - 15:30)
    if ( peruStatusElement ) {
        const marketStatus = getMarketStatus( 'America/Lima', 9, 15.5 );
        peruStatusElement.textContent = marketStatus.status;
        peruStatusElement.className = `market-status rounded-full ${marketStatus.class}`;
    }
}

// Función para actualizar tiempo por zona horaria
function updateTimeForTimezone( element, timezone ) {
    try {
        const now = new Date();
        // Usar Intl.DateTimeFormat para mejor compatibilidad
        const timeString = new Intl.DateTimeFormat( 'es-ES', {
            timeZone: timezone,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        } ).format( now );

        element.textContent = timeString;
    } catch ( error ) {
        console.error( `Error actualizando tiempo para ${timezone}:`, error );
        element.textContent = '--:--:--';
    }
}
// Función para actualizar fecha por zona horaria
function updateDateForTimezone( element, timezone ) {
    try {
        const now = new Date();
        // Usar Intl.DateTimeFormat para mejor compatibilidad
        const dateString = new Intl.DateTimeFormat( 'es-ES', {
            timeZone: timezone,
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        } ).format( now );

        element.textContent = dateString;
    } catch ( error ) {
        console.error( `Error actualizando fecha para ${timezone}:`, error );
        element.textContent = '-- de ---- de ----';
    }
}


// Función para actualizar estados de mercados
function updateMarketStatuses() {
    // Actualizar mercados principales
    mainMarkets.forEach( ( market, index ) => {
        const marketCard = document.querySelector( `#main-markets .clock-card:nth-child(${index + 1})` );
        if ( marketCard ) {
            const statusElement = marketCard.querySelector( '.market-status' );
            const marketStatus = getMarketStatus( market.timezone, market.openHour, market.closeHour );

            if ( statusElement ) {
                statusElement.textContent = marketStatus.status;
                statusElement.className = `market-status rounded-full ${marketStatus.class}`;
            }

            // Actualizar clase del card
            marketCard.className = `clock-card rounded-2xl py-5 px-4 text-white shadow-xl ${marketStatus.status === 'Abierto' ? 'market-open' : marketStatus.status === 'Cerrado' ? 'market-closed' : 'market-pre'}`;
        }
    } );

    // Actualizar mercados de usuario
    userMarkets.forEach( ( market, index ) => {
        const marketCard = document.querySelector( `#user-markets .clock-card:nth-child(${index + 1})` );
        if ( marketCard ) {
            const statusElement = marketCard.querySelector( '.market-status' );
            const marketStatus = getMarketStatus( market.timezone, market.openHour, market.closeHour );

            if ( statusElement ) {
                statusElement.textContent = marketStatus.status;
                statusElement.className = `market-status rounded-full ${marketStatus.class}`;
            }

            // Actualizar clase del card
            marketCard.className = `clock-card rounded-2xl p-6 text-white shadow-xl ${marketStatus.status === 'Abierto' ? 'market-open' : marketStatus.status === 'Cerrado' ? 'market-closed' : 'market-pre'}`;
        }
    } );
}

// Función para renderizar mercados principales
function renderMainMarkets() {
    const mainMarketsContainer = document.getElementById( 'main-markets' );
    const marketsHTML = mainMarkets.map( market => createMarketCard( market, false ) ).join( '' );
    mainMarketsContainer.innerHTML = marketsHTML;
}

// Función para formatear horas
function formatHour( hour ) {
    const hours = Math.floor( hour );
    const minutes = Math.round( ( hour - hours ) * 60 );
    return `${hours.toString().padStart( 2, '0' )}:${minutes.toString().padStart( 2, '0' )}`;
}

// Función para solicitar permisos de notificación
async function requestNotificationPermission() {
    if ( 'Notification' in window ) {
        const permission = await Notification.requestPermission();
        notificationPermission = permission === 'granted';

        if ( notificationPermission ) {
            // Mostrar mensaje de confirmación
            showNotificationSuccess();
        }

        return notificationPermission;
    }
    return false;
}

// Mostrar mensaje de éxito para notificaciones
function showNotificationSuccess() {
    const successDiv = document.createElement( 'div' );
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300';
    successDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas fa-check-circle"></i>
            <span>¡Notificaciones activadas! Las alertas persistirán incluso si cierras el navegador.</span>
        </div>
    `;

    document.body.appendChild( successDiv );

    // Remover después de 5 segundos
    setTimeout( () => {
        successDiv.style.opacity = '0';
        setTimeout( () => successDiv.remove(), 300 );
    }, 5000 );
}


// Función para enviar notificación
function sendNotification( title, body, icon = 'fas fa-bell' ) {
    if ( notificationPermission && 'Notification' in window ) {
        new Notification( title, {
            body: body,
            icon: '/favicon-v2.png', // Usa el favicon del sitio
            requireInteraction: true
        } );
    }
}

// Función para alternar alertas
async function toggleAlert( marketKey, alertType ) {
    const alertId = `${marketKey}-${alertType}`;

    if ( marketAlerts.has( alertId ) ) {
        // Cancelar alerta
        marketAlerts.delete( alertId );
        await cancelPersistentAlert( alertId );

        showAlertFeedback( `Alerta cancelada: ${alertType}`, 'warning' );
        console.log( `Alerta cancelada: ${alertId}` );
    } else {
        // Activar alerta
        if ( !notificationPermission ) {
            const granted = await requestNotificationPermission();
            if ( !granted ) {
                showAlertFeedback( 'Para recibir alertas, debes permitir las notificaciones en tu navegador.', 'error' );
                return;
            }
        }

        // Encontrar el mercado
        const [ timezone, ...nameParts ] = marketKey.split( '-' );
        const marketName = nameParts.join( '-' );

        let market = mainMarkets.find( m => m.timezone === timezone );
        if ( !market ) {
            market = userMarkets.find( m => m.timezone === timezone );
        }

        if ( market ) {
            const targetTime = scheduleAlert( market, alertType, alertId );

            // Guardar en persistencia
            await saveAlertToPersistence( alertId, market, alertType, targetTime, true );

            const timeStr = formatHour( alertType === 'open' ? market.openHour : market.closeHour );
            showAlertFeedback( `Alerta programada: ${alertType} a las ${timeStr}`, 'success' );
            console.log( `Alerta programada: ${alertId}` );
        }
    }

    // Actualizar la interfaz
    renderMainMarkets();
    renderUserMarkets();

    // *** ACTUALIZAR PANEL DE ALERTAS SI ESTÁ ABIERTO ***
    const alertsPanel = document.getElementById( 'alerts-panel' );
    if ( alertsPanel && !alertsPanel.classList.contains( 'hidden' ) ) {
        updateAlertsPanel();
    }

    // Actualizar contador automáticamente
    updateAlertsCounter();
}

// Mostrar feedback de alertas
function showAlertFeedback( message, type = 'info' ) {
    const colors = {
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };

    const icons = {
        success: 'fas fa-check-circle',
        warning: 'fas fa-exclamation-triangle',
        error: 'fas fa-times-circle',
        info: 'fas fa-info-circle'
    };

    const feedbackDiv = document.createElement( 'div' );
    feedbackDiv.className = `fixed top-4 right-4 ${colors[ type ]} text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300 max-w-md`;
    feedbackDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="${icons[ type ]}"></i>
            <span class="text-sm">${message}</span>
        </div>
    `;

    document.body.appendChild( feedbackDiv );

    // Remover después de 3 segundos
    setTimeout( () => {
        feedbackDiv.style.opacity = '0';
        setTimeout( () => feedbackDiv.remove(), 300 );
    }, 3000 );
}

// Función para obtener hora equivalente en horario peruano
function getPeruEquivalentTime( timezone, hour ) {
    const now = new Date();
    const marketTime = new Date( now.toLocaleString( "en-US", { timeZone: timezone } ) );
    const peruTime = new Date( now.toLocaleString( "en-US", { timeZone: "America/Lima" } ) );

    // Calcular diferencia horaria
    const timeDifference = ( peruTime.getTime() - marketTime.getTime() ) / ( 1000 * 60 * 60 );

    // Ajustar la hora del mercado al horario peruano
    const adjustedHour = hour + timeDifference;

    // Manejar horas que cruzan medianoche
    let finalHour = adjustedHour;
    let dayIndicator = '';

    if ( adjustedHour < 0 ) {
        finalHour = adjustedHour + 24;
        dayIndicator = ' -1d';
    } else if ( adjustedHour >= 24 ) {
        finalHour = adjustedHour - 24;
        dayIndicator = ' +1d';
    }

    return formatHour( finalHour ) + dayIndicator;
}

// Función para programar alertas
function scheduleAlert( market, alertType, alertId ) {
    const now = new Date();
    const marketTime = new Date( now.toLocaleString( "en-US", { timeZone: market.timezone } ) );
    const targetHour = alertType === 'open' ? market.openHour : market.closeHour;

    // Crear fecha objetivo para hoy
    let targetTime = new Date( marketTime );
    const hours = Math.floor( targetHour );
    const minutes = Math.round( ( targetHour - hours ) * 60 );
    targetTime.setHours( hours, minutes, 0, 0 );

    // Si ya pasó la hora hoy, programar para mañana
    if ( targetTime <= marketTime ) {
        targetTime.setDate( targetTime.getDate() + 1 );
    }

    // Saltar fines de semana
    while ( targetTime.getDay() === 0 || targetTime.getDay() === 6 ) {
        targetTime.setDate( targetTime.getDate() + 1 );
    }

    // Almacenar en memoria para la sesión actual
    marketAlerts.set( alertId, {
        market: market,
        alertType: alertType,
        targetTime: targetTime,
        persistent: true
    } );

    return targetTime;
}

function createAlertsPanel() {
    const alertsPanel = document.createElement( 'div' );
    alertsPanel.id = 'alerts-panel';
    alertsPanel.className = 'fixed bottom-4 left-4 bg-gray-800 bg-opacity-90 backdrop-blur-sm text-white p-4 rounded-lg shadow-lg z-40 max-w-sm hidden';
    alertsPanel.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="font-bold text-lg">
                <i class="fas fa-bell mr-2"></i>Alertas Activas
            </h3>
            <button onclick="toggleAlertsPanel()" class="text-gray-400 hover:text-white">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div id="alerts-list" class="space-y-2 max-h-60 overflow-y-auto">
            <!-- Las alertas se cargarán aquí -->
        </div>
        <div class="mt-3 pt-2 border-t border-gray-600 text-xs text-gray-300">
            Las alertas persisten aunque cierres el navegador
        </div>
    `;

    document.body.appendChild( alertsPanel );

    // Botón flotante para mostrar/ocultar panel
    const toggleButton = document.createElement( 'button' );
    toggleButton.id = 'alerts-toggle';
    toggleButton.className = 'fixed bottom-4 left-4 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg z-50 transition-all duration-300';
    toggleButton.innerHTML = `
        <i class="fas fa-bell"></i>
        <span id="alerts-count" class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
    `;
    toggleButton.onclick = toggleAlertsPanel;

    document.body.appendChild( toggleButton );
}

// Alternar panel de alertas
function toggleAlertsPanel() {
    const panel = document.getElementById( 'alerts-panel' );
    const isVisible = !panel.classList.contains( 'hidden' );

    if ( isVisible ) {
        panel.classList.add( 'hidden' );
    } else {
        panel.classList.remove( 'hidden' );
        updateAlertsPanel();
    }
}

// Actualizar panel de alertas
function updateAlertsPanel() {
    const alertsList = document.getElementById( 'alerts-list' );

    updateAlertsCounter();

    if ( !alertsList ) return;

    const activeAlerts = Array.from( marketAlerts.entries() );

    if ( activeAlerts.length === 0 ) {
        alertsList.innerHTML = `
            <div class="text-center text-gray-400 py-4">
                <i class="fas fa-bell-slash text-2xl mb-2"></i>
                <p class="text-sm">No tienes alertas activas</p>
            </div>
        `;
        return;
    }

    const alertsHTML = activeAlerts.map( ( [ alertId, alert ] ) => {
        const timeRemaining = getTimeRemaining( alert.targetTime );
        const actionText = alert.alertType === 'open' ? 'Apertura' : 'Cierre';

        return `
            <div class="bg-gray-700 rounded p-3 text-sm">
                <div class="flex justify-between items-start mb-1">
                    <div class="font-medium">${alert.market.flag} ${alert.market.name}</div>
                    <button onclick="cancelAlertFromPanel('${alertId}')" class="text-red-400 hover:text-red-300">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="text-gray-300 text-xs">
                    ${actionText} • ${timeRemaining}
                </div>
            </div>
        `;
    } ).join( '' );

    alertsList.innerHTML = alertsHTML;
}

function updateAlertsCounter() {
    const alertsCount = document.getElementById( 'alerts-count' );
    if ( alertsCount ) {
        const activeAlertsCount = marketAlerts.size;
        alertsCount.textContent = activeAlertsCount;

        // Mostrar/ocultar el contador según si hay alertas
        alertsCount.style.display = activeAlertsCount > 0 ? 'flex' : 'none';
    }
}

// Obtener tiempo restante para una alerta
function getTimeRemaining( targetTime ) {
    const now = new Date();
    const diff = targetTime.getTime() - now.getTime();

    if ( diff <= 0 ) return 'Expirada';

    const days = Math.floor( diff / ( 1000 * 60 * 60 * 24 ) );
    const hours = Math.floor( ( diff % ( 1000 * 60 * 60 * 24 ) ) / ( 1000 * 60 * 60 ) );
    const minutes = Math.floor( ( diff % ( 1000 * 60 * 60 ) ) / ( 1000 * 60 ) );

    if ( days > 0 ) return `En ${days}d ${hours}h`;
    if ( hours > 0 ) return `En ${hours}h ${minutes}m`;
    return `En ${minutes}m`;
}

// Cancelar alerta desde el panel
async function cancelAlertFromPanel( alertId ) {
    marketAlerts.delete( alertId );
    await cancelPersistentAlert( alertId );

    // *** ACTUALIZAR PANEL INMEDIATAMENTE ***
    updateAlertsPanel();

    // Actualizar interfaz de mercados
    renderMainMarkets();
    renderUserMarkets();

    showAlertFeedback( 'Alerta cancelada', 'warning' );

    // Actualizar contador automáticamente
    updateAlertsCounter();
}


// Event Listeners
document.addEventListener( 'DOMContentLoaded', async function () {
    console.log( 'DOM cargado, iniciando aplicación...' );

    // Inicializar Service Worker primero
    await initServiceWorker();

    // Crear panel de alertas
    createAlertsPanel();

    // Cargar datos y renderizar
    await loadCitiesData();
    renderMainMarkets();

    // ACTUALIZAR TIEMPOS INMEDIATAMENTE Y CONFIGURAR INTERVALO
    console.log( 'Iniciando actualización de tiempos...' );
    updateAllTimes(); // Primera actualización inmediata

    // Configurar intervalo para actualizar cada segundo
    const timeUpdateInterval = setInterval( () => {
        updateAllTimes();
    }, 1000 );

    // Configurar intervalo para actualizar panel de alertas cada minuto
    const alertsUpdateInterval = setInterval( () => {
        const alertsPanel = document.getElementById( 'alerts-panel' );
        if ( alertsPanel && !alertsPanel.classList.contains( 'hidden' ) ) {
            updateAlertsPanel();
        }
    }, 60000 );

    // Event listener para búsqueda
    const searchInput = document.getElementById( 'country-search' );
    const addButton = document.getElementById( 'add-country-btn' );

    if ( searchInput ) {
        searchInput.addEventListener( 'input', function () {
            if ( isLoading ) return;

            const searchTerm = this.value.trim();
            if ( searchTerm.length === 0 ) {
                showDefaultSuggestions();
                return;
            }

            if ( searchTerm.length >= 2 ) {
                const results = searchCities( searchTerm );
                showSearchResults( results );
            }
        } );

        // Permitir agregar con Enter
        searchInput.addEventListener( 'keypress', function ( e ) {
            if ( e.key === 'Enter' && addButton ) {
                addButton.click();
            }
        } );
    }

    if ( addButton ) {
        addButton.addEventListener( 'click', function () {
            const searchTerm = searchInput.value.trim();
            if ( !searchTerm ) {
                alert( 'Por favor, escribe el nombre de una ciudad o país' );
                return;
            }

            const results = searchCities( searchTerm );
            if ( results.length === 1 ) {
                const city = results[ 0 ];
                addCityFromResults( city.timezone, city.name, city.country, city.market, city.flag, city.openHour, city.closeHour );
            } else if ( results.length > 1 ) {
                alert( 'Se encontraron múltiples resultados. Por favor, selecciona uno de la lista.' );
            } else {
                alert( 'No se encontraron resultados para tu búsqueda.' );
            }
        } );
    }

    // Actualizar contador inicial
    updateAlertsCounter();

    console.log( 'Aplicación iniciada correctamente' );
} );


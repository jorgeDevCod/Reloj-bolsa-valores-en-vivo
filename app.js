// ============================================
// CONFIGURACIÓN Y DATOS INICIALES
// ============================================

const mainMarkets = [
    {
        name: 'Nueva York',
        country: 'Estados Unidos',
        timezone: 'America/New_York',
        market: 'NYSE / NASDAQ',
        icon: 'fas fa-chart-line',
        openHour: 9,
        closeHour: 16,
        flag: '🇺🇸'
    },
    {
        name: 'Londres',
        country: 'Reino Unido',
        timezone: 'Europe/London',
        market: 'LSE',
        icon: 'fas fa-pound-sign',
        openHour: 8,
        closeHour: 16.5,
        flag: '🇬🇧'
    },
    {
        name: 'Tokio',
        country: 'Japón',
        timezone: 'Asia/Tokyo',
        market: 'TSE',
        icon: 'fas fa-yen-sign',
        openHour: 9,
        closeHour: 15,
        flag: '🇯🇵'
    },
    {
        name: 'Hong Kong',
        country: 'China',
        timezone: 'Asia/Hong_Kong',
        market: 'HKEX',
        icon: 'fas fa-coins',
        openHour: 9.5,
        closeHour: 16,
        flag: '🇭🇰'
    },
    {
        name: 'Sídney',
        country: 'Australia',
        timezone: 'Australia/Sydney',
        market: 'ASX',
        icon: 'fas fa-dollar-sign',
        openHour: 10,
        closeHour: 16,
        flag: '🇦🇺'
    },
    {
        name: 'Fráncfort',
        country: 'Alemania',
        timezone: 'Europe/Berlin',
        market: 'XETRA',
        icon: 'fas fa-euro-sign',
        openHour: 9,
        closeHour: 17.5,
        flag: '🇩🇪'
    }
];


// ============================================
// VARIABLES GLOBALES
// ============================================
let worldCities = [];
let userMarkets = [];
let searchResults = [];
let isLoading = true;
let marketAlerts = new Map();
let notificationPermission = false;
let serviceWorker = null;

// ============================================
// SERVICE WORKER Y PERSISTENCIA
// ============================================
async function initServiceWorker() {
    if ( 'serviceWorker' in navigator ) {
        try {
            const registration = await navigator.serviceWorker.register( 'sw.js' );
            console.log( 'Service Worker registrado exitosamente' );

            serviceWorker = registration.active || registration.waiting || registration.installing;

            navigator.serviceWorker.addEventListener( 'message', event => {
                const { type, alerts } = event.data;
                if ( type === 'ACTIVE_ALERTS' ) {
                    loadPersistedAlerts( alerts );
                }
            } );

            await loadPersistedAlerts();
        } catch ( error ) {
            console.error( 'Error al registrar Service Worker:', error );
        }
    }
}

async function loadPersistedAlerts( alerts = null ) {
    if ( !alerts && serviceWorker ) {
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

        renderMainMarkets();
        renderUserMarkets();

        const alertsPanel = document.getElementById( 'alerts-panel' );
        if ( alertsPanel && !alertsPanel.classList.contains( 'hidden' ) ) {
            updateAlertsPanel();
        }

        updateAlertsCounter();
        console.log( `Cargadas ${alerts.length} alertas persistentes` );
    }
}

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

async function cancelPersistentAlert( alertId ) {
    if ( serviceWorker ) {
        serviceWorker.postMessage( {
            type: 'CANCEL_ALERT',
            data: { alertId }
        } );
    }
}

// ============================================
// UTILIDADES
// ============================================

function escapeHtml( text ) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace( /[&<>"']/g, m => map[ m ] );
}

function formatHour( hour ) {
    const hours = Math.floor( hour );
    const minutes = Math.round( ( hour - hours ) * 60 );
    return `${hours.toString().padStart( 2, '0' )}:${minutes.toString().padStart( 2, '0' )}`;
}

// ============================================
// CARGA DE DATOS
// ============================================

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

        // Fallback a datos básicos
        worldCities = [
            { name: 'Toronto', country: 'Canadá', timezone: 'America/Toronto', market: 'TSX', flag: '🇨🇦', openHour: 9.5, closeHour: 16 },
            { name: 'São Paulo', country: 'Brasil', timezone: 'America/Sao_Paulo', market: 'B3', flag: '🇧🇷', openHour: 10, closeHour: 17 },
            { name: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata', market: 'BSE', flag: '🇮🇳', openHour: 9.25, closeHour: 15.5 },
            { name: 'Seúl', country: 'Corea del Sur', timezone: 'Asia/Seoul', market: 'KRX', flag: '🇰🇷', openHour: 9, closeHour: 15.5 }
        ];
        showDefaultSuggestions();
    }
}

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

// ============================================
// ESTADO DEL MERCADO
// ============================================

function getMarketStatus( timezone, openHour = 9, closeHour = 17 ) {
    try {
        const now = new Date();
        const marketTime = new Date( now.toLocaleString( "en-US", { timeZone: timezone } ) );
        const dayOfWeek = marketTime.getDay();
        const currentHour = marketTime.getHours() + marketTime.getMinutes() / 60;

        console.log( `${timezone}: día=${dayOfWeek}, hora=${currentHour.toFixed( 2 )}, apertura=${openHour}, cierre=${closeHour}` );

        // Fin de semana
        if ( dayOfWeek === 0 || dayOfWeek === 6 ) {
            return { status: 'Cerrado', class: 'status-closed' };
        }

        // Horarios del mercado
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

function getPeruEquivalentTime( timezone, hour ) {
    const now = new Date();
    const marketTime = new Date( now.toLocaleString( "en-US", { timeZone: timezone } ) );
    const peruTime = new Date( now.toLocaleString( "en-US", { timeZone: "America/Lima" } ) );

    const timeDifference = ( peruTime.getTime() - marketTime.getTime() ) / ( 1000 * 60 * 60 );
    const adjustedHour = hour + timeDifference;

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

// ============================================
// CREACIÓN DE TARJETAS
// ============================================

function createMarketCard( market, isUser = false ) {
    const marketStatus = getMarketStatus( market.timezone, market.openHour, market.closeHour );
    const marketKey = `${market.timezone}-${market.name}`;
    const hasOpenAlert = marketAlerts.has( `${marketKey}-open` );
    const hasCloseAlert = marketAlerts.has( `${marketKey}-close` );

    const openTime = formatHour( market.openHour );
    const closeTime = formatHour( market.closeHour );

    return `
        <div class="clock-card rounded-2xl p-6 text-white shadow-xl ${marketStatus.status === 'Abierto' ? 'market-open' : marketStatus.status === 'Cerrado' ? 'market-closed' : 'market-pre'}" role="listitem">
            <div class="flex flex-col gap-4">
                <!-- Header -->
                <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div class="flex-1">
                        <h3 class="text-xl font-bold mb-1">
                            ${market.flag} ${market.name}
                        </h3>
                        <p class="text-white text-sm">${market.country}</p>
                        <p class="text-white text-xs">${market.market || 'Mercado Principal'}</p>
                        <div class="text-xs text-white mt-2 space-y-1">
                            <div class="flex items-center">
                                <i class="fas fa-door-open w-4 mr-2" aria-hidden="true"></i>
                                <span>Apertura: ${openTime}</span>
                                <span class="text-white/80 text-[0.7rem] ml-1">(${getPeruEquivalentTime( market.timezone, market.openHour )} PE)</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-door-closed w-4 mr-2" aria-hidden="true"></i>
                                <span>Cierre: ${closeTime}</span>
                                <span class="text-white/80 text-[0.7rem] ml-1">(${getPeruEquivalentTime( market.timezone, market.closeHour )} PE)</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="text-center lg:text-right min-w-[140px] relative">
                        <div class="digital-font text-2xl md:text-3xl font-bold market-time" data-timezone="${market.timezone}" aria-label="Hora actual en ${market.name}">
                            --:--:--
                        </div>
                        <div class="text-sm market-date" data-timezone="${market.timezone}" aria-label="Fecha actual en ${market.name}">
                            -- de ---- de ----
                        </div>
                        ${isUser ? `
                            <button 
                                onclick="removeUserMarket('${market.timezone}')" 
                                class="absolute -top-2 -right-2 text-red-400 hover:text-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 rounded" 
                                title="Eliminar mercado"
                                aria-label="Eliminar mercado de ${market.name}"
                            >
                                <i class="fas fa-times text-xl" aria-hidden="true"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Estado y alertas -->
                <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/20">
                    <span 
                        class="px-3 py-2 rounded-full text-sm font-semibold min-w-[110px] text-center ${marketStatus.class}"
                        role="status"
                        aria-live="polite"
                    >
                        ${marketStatus.status}
                    </span>
                    
                    <div class="flex gap-2" role="group" aria-label="Alertas del mercado">
                        <button 
                            onclick="toggleAlert('${marketKey}', 'open')" 
                            class="alert-btn rounded focus:ring-2 focus:ring-white/50 focus:outline-none ${hasOpenAlert ? 'active-open' : ''}" 
                            title="${hasOpenAlert ? 'Cancelar alerta de apertura' : 'Activar alerta de apertura'}"
                            aria-label="${hasOpenAlert ? 'Cancelar' : 'Activar'} alerta de apertura"
                            aria-pressed="${hasOpenAlert}"
                        >
                            <i class="fas fa-bell${hasOpenAlert ? '' : '-slash'}" aria-hidden="true"></i>
                            <span class="ml-1">Apertura</span>
                        </button>
                        <button 
                            onclick="toggleAlert('${marketKey}', 'close')" 
                            class="alert-btn rounded focus:ring-2 focus:ring-white/50 focus:outline-none ${hasCloseAlert ? 'active-close' : ''}" 
                            title="${hasCloseAlert ? 'Cancelar alerta de cierre' : 'Activar alerta de cierre'}"
                            aria-label="${hasCloseAlert ? 'Cancelar' : 'Activar'} alerta de cierre"
                            aria-pressed="${hasCloseAlert}"
                        >
                            <i class="fas fa-bell${hasCloseAlert ? '' : '-slash'}" aria-hidden="true"></i>
                            <span class="ml-1">Cierre</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}
// ============================================
// BÚSQUEDA Y SUGERENCIAS
// ============================================

function searchCities( searchTerm ) {
    const term = searchTerm.toLowerCase().trim();
    if ( !term || worldCities.length === 0 ) return [];

    const results = worldCities.filter( city => {
        const nameMatch = city.name.toLowerCase().includes( term );
        const countryMatch = city.country.toLowerCase().includes( term );
        const marketMatch = city.market.toLowerCase().includes( term );
        const regionMatch = city.region && city.region.toLowerCase().includes( term );

        return nameMatch || countryMatch || marketMatch || regionMatch;
    } );

    return results.sort( ( a, b ) => {
        const aNameMatch = a.name.toLowerCase().startsWith( term );
        const bNameMatch = b.name.toLowerCase().startsWith( term );
        const aCountryMatch = a.country.toLowerCase().startsWith( term );
        const bCountryMatch = b.country.toLowerCase().startsWith( term );

        if ( aNameMatch && !bNameMatch ) return -1;
        if ( !aNameMatch && bNameMatch ) return 1;
        if ( aCountryMatch && !bCountryMatch ) return -1;
        if ( !aCountryMatch && bCountryMatch ) return 1;

        return a.name.localeCompare( b.name );
    } ).slice( 0, 12 );
}

function showSearchResults( results ) {
    const suggestionsContainer = document.getElementById( 'search-suggestions' );

    if ( results.length === 0 ) {
        suggestionsContainer.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-search text-white text-xl mb-2" aria-hidden="true"></i>
                <p class="text-white">No se encontraron resultados para tu búsqueda.</p>
                <p class="text-white text-sm mt-1">Intenta con nombres como: Londres, Tokyo, Mumbai, etc.</p>
            </div>
        `;
        return;
    }

    const suggestions = results.map( city =>
        `<button 
            onclick="addCityFromResults('${city.timezone}', '${escapeHtml( city.name )}', '${escapeHtml( city.country )}', '${escapeHtml( city.market )}', '${city.flag}', ${city.openHour}, ${city.closeHour})" 
            class="suggestion-btn px-3 py-2 rounded-lg text-white text-sm font-medium transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400" 
            title="Agregar ${city.name}, ${city.country}"
            aria-label="Agregar mercado de ${city.name}, ${city.country}"
        >
            ${city.flag} ${city.name}
            <span class="text-xs opacity-75 block">${city.country}</span>
        </button>`
    ).join( '' );

    suggestionsContainer.innerHTML = `
        <div class="mb-2">
            <p class="text-white text-sm" role="status">Resultados encontrados (${results.length}):</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            ${suggestions}
        </div>
    `;
}

function showDefaultSuggestions() {
    const defaultSuggestions = worldCities.slice( 0, 8 );
    const suggestionsContainer = document.getElementById( 'search-suggestions' );

    const suggestions = defaultSuggestions.map( city =>
        `<button 
            onclick="addCityFromResults('${city.timezone}', '${escapeHtml( city.name )}', '${escapeHtml( city.country )}', '${escapeHtml( city.market )}', '${city.flag}', ${city.openHour}, ${city.closeHour})" 
            class="suggestion-btn px-3 py-2 rounded-lg text-white text-sm font-medium transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400" 
            title="Agregar ${city.name}, ${city.country}"
            aria-label="Agregar mercado de ${city.name}, ${city.country}"
        >
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

function addCityFromResults( timezone, name, country, market, flag, openHour, closeHour ) {
    if ( userMarkets.some( market => market.timezone === timezone ) ) {
        showAlertFeedback( 'Este mercado ya está agregado', 'warning' );
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

    document.getElementById( 'country-search' ).value = '';
    showDefaultSuggestions();

    showAlertFeedback( `Mercado de ${name} agregado correctamente`, 'success' );
}

function removeUserMarket( timezone ) {
    userMarkets = userMarkets.filter( market => market.timezone !== timezone );
    renderUserMarkets();
    showAlertFeedback( 'Mercado eliminado', 'info' );
}

// ============================================
// RENDERIZADO
// ============================================

function renderMainMarkets() {
    const mainMarketsContainer = document.getElementById( 'main-markets' );
    const marketsHTML = mainMarkets.map( market => createMarketCard( market, false ) ).join( '' );
    mainMarketsContainer.innerHTML = marketsHTML;
}

function renderUserMarkets() {
    const userMarketsContainer = document.getElementById( 'user-markets' );

    if ( userMarkets.length === 0 ) {
        userMarketsContainer.innerHTML = '';
        return;
    }

    const marketsHTML = userMarkets.map( market => createMarketCard( market, true ) ).join( '' );
    userMarketsContainer.innerHTML = marketsHTML;
}

// ============================================
// ACTUALIZACIÓN DE TIEMPOS
// ============================================

function updateAllTimes() {
    updatePeruTime();

    document.querySelectorAll( '#main-markets .market-time, #user-markets .market-time' ).forEach( timeElement => {
        const timezone = timeElement.getAttribute( 'data-timezone' );
        if ( timezone ) {
            updateTimeForTimezone( timeElement, timezone );
        }
    } );

    document.querySelectorAll( '#main-markets .market-date, #user-markets .market-date' ).forEach( dateElement => {
        const timezone = dateElement.getAttribute( 'data-timezone' );
        if ( timezone ) {
            updateDateForTimezone( dateElement, timezone );
        }
    } );

    updateMarketStatuses();
}

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

    if ( peruStatusElement ) {
        const marketStatus = getMarketStatus( 'America/Lima', 9, 15.5 );
        peruStatusElement.textContent = marketStatus.status;
        peruStatusElement.className = `px-4 py-2 rounded-full text-sm font-semibold min-w-[110px] text-center ${marketStatus.class}`;
    }
}

function updateTimeForTimezone( element, timezone ) {
    try {
        const now = new Date();
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

function updateDateForTimezone( element, timezone ) {
    try {
        const now = new Date();
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

function updateMarketStatuses() {
    mainMarkets.forEach( ( market, index ) => {
        const marketCard = document.querySelector( `#main-markets .clock-card:nth-child(${index + 1})` );
        if ( marketCard ) {
            const statusElement = marketCard.querySelector( '[role="status"]' );
            const marketStatus = getMarketStatus( market.timezone, market.openHour, market.closeHour );

            if ( statusElement ) {
                statusElement.textContent = marketStatus.status;
                statusElement.className = `px-3 py-2 rounded-full text-sm font-semibold min-w-[110px] text-center ${marketStatus.class}`;
            }

            marketCard.className = `clock-card rounded-2xl p-6 text-white shadow-xl ${marketStatus.status === 'Abierto' ? 'market-open' : marketStatus.status === 'Cerrado' ? 'market-closed' : 'market-pre'}`;
        }
    } );

    userMarkets.forEach( ( market, index ) => {
        const marketCard = document.querySelector( `#user-markets .clock-card:nth-child(${index + 1})` );
        if ( marketCard ) {
            const statusElement = marketCard.querySelector( '[role="status"]' );
            const marketStatus = getMarketStatus( market.timezone, market.openHour, market.closeHour );

            if ( statusElement ) {
                statusElement.textContent = marketStatus.status;
                statusElement.className = `px-3 py-2 rounded-full text-sm font-semibold min-w-[110px] text-center ${marketStatus.class}`;
            }

            marketCard.className = `clock-card rounded-2xl p-6 text-white shadow-xl ${marketStatus.status === 'Abierto' ? 'market-open' : marketStatus.status === 'Cerrado' ? 'market-closed' : 'market-pre'}`;
        }
    } );
}

// ============================================
// NOTIFICACIONES Y ALERTAS
// ============================================

async function requestNotificationPermission() {
    if ( 'Notification' in window ) {
        const permission = await Notification.requestPermission();
        notificationPermission = permission === 'granted';

        if ( notificationPermission ) {
            showNotificationSuccess();
        }

        return notificationPermission;
    }
    return false;
}

function showNotificationSuccess() {
    const successDiv = document.createElement( 'div' );
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300';
    successDiv.setAttribute( 'role', 'alert' );
    successDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas fa-check-circle" aria-hidden="true"></i>
            <span>¡Notificaciones activadas! Las alertas persistirán incluso si cierras el navegador.</span>
        </div>
    `;

    document.body.appendChild( successDiv );

    setTimeout( () => {
        successDiv.style.opacity = '0';
        setTimeout( () => successDiv.remove(), 300 );
    }, 5000 );
}

function sendNotification( title, body ) {
    if ( notificationPermission && 'Notification' in window ) {
        new Notification( title, {
            body: body,
            icon: '/favicon-v2.png',
            requireInteraction: true
        } );
    }
}

async function toggleAlert( marketKey, alertType ) {
    const alertId = `${marketKey}-${alertType}`;

    if ( marketAlerts.has( alertId ) ) {
        marketAlerts.delete( alertId );
        await cancelPersistentAlert( alertId );

        showAlertFeedback( `Alerta cancelada: ${alertType}`, 'warning' );
        console.log( `Alerta cancelada: ${alertId}` );
    } else {
        if ( !notificationPermission ) {
            const granted = await requestNotificationPermission();
            if ( !granted ) {
                showAlertFeedback( 'Para recibir alertas, debes permitir las notificaciones en tu navegador.', 'error' );
                return;
            }
        }

        const [ timezone, ...nameParts ] = marketKey.split( '-' );
        const marketName = nameParts.join( '-' );

        let market = mainMarkets.find( m => m.timezone === timezone );
        if ( !market ) {
            market = userMarkets.find( m => m.timezone === timezone );
        }

        if ( market ) {
            const targetTime = scheduleAlert( market, alertType, alertId );

            await saveAlertToPersistence( alertId, market, alertType, targetTime, true );

            const timeStr = formatHour( alertType === 'open' ? market.openHour : market.closeHour );
            showAlertFeedback( `Alerta programada: ${alertType} a las ${timeStr}`, 'success' );
            console.log( `Alerta programada: ${alertId}` );
        }
    }

    renderMainMarkets();
    renderUserMarkets();

    const alertsPanel = document.getElementById( 'alerts-panel' );
    if ( alertsPanel && !alertsPanel.classList.contains( 'hidden' ) ) {
        updateAlertsPanel();
    }

    updateAlertsCounter();
}

function scheduleAlert( market, alertType, alertId ) {
    const now = new Date();
    const targetHourInMarket = alertType === 'open' ? market.openHour : market.closeHour;
    const peruEquivalentTimeStr = getPeruEquivalentTime( market.timezone, targetHourInMarket );

    const timeMatch = peruEquivalentTimeStr.match( /(\d{2}):(\d{2})/ );
    const dayMatch = peruEquivalentTimeStr.match( /([+-]\d+)d/ );

    if ( !timeMatch ) {
        console.error( 'Error parseando hora equivalente en Perú:', peruEquivalentTimeStr );
        return null;
    }

    const hours = parseInt( timeMatch[ 1 ] );
    const minutes = parseInt( timeMatch[ 2 ] );
    const dayOffset = dayMatch ? parseInt( dayMatch[ 1 ] ) : 0;

    const peruTime = new Date( now.toLocaleString( "en-US", { timeZone: "America/Lima" } ) );

    let targetTime = new Date( peruTime );
    targetTime.setHours( hours, minutes, 0, 0 );

    if ( dayOffset !== 0 ) {
        targetTime.setDate( targetTime.getDate() + dayOffset );
    }

    if ( targetTime <= peruTime ) {
        targetTime.setDate( targetTime.getDate() + 1 );
    }

    while ( targetTime.getDay() === 0 || targetTime.getDay() === 6 ) {
        targetTime.setDate( targetTime.getDate() + 1 );
    }

    const peruOffset = peruTime.getTime() - now.getTime();
    const finalTargetTime = new Date( targetTime.getTime() - peruOffset );

    marketAlerts.set( alertId, {
        market: market,
        alertType: alertType,
        targetTime: finalTargetTime,
        persistent: true
    } );

    console.log( `Alerta programada para ${market.name} (${alertType}):`,
        `Hora objetivo en Perú: ${targetTime.toLocaleString( 'es-PE' )}`,
        `Hora objetivo UTC: ${finalTargetTime.toISOString()}` );

    return finalTargetTime;
}

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
    feedbackDiv.setAttribute( 'role', 'alert' );
    feedbackDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="${icons[ type ]}" aria-hidden="true"></i>
            <span class="text-sm">${message}</span>
        </div>
    `;

    document.body.appendChild( feedbackDiv );

    setTimeout( () => {
        feedbackDiv.style.opacity = '0';
        setTimeout( () => feedbackDiv.remove(), 300 );
    }, 3000 );
}

// ============================================
// PANEL DE ALERTAS
// ============================================

function toggleAlertsPanel() {
    const panel = document.getElementById( 'alerts-panel' );
    const toggleButton = document.getElementById( 'alerts-toggle' );
    const isVisible = !panel.classList.contains( 'hidden' );

    if ( isVisible ) {
        panel.classList.add( 'hidden' );
        toggleButton.setAttribute( 'aria-expanded', 'false' );
    } else {
        panel.classList.remove( 'hidden' );
        toggleButton.setAttribute( 'aria-expanded', 'true' );
        updateAlertsPanel();
    }
}

function updateAlertsPanel() {
    const alertsList = document.getElementById( 'alerts-list' );
    updateAlertsCounter();

    if ( !alertsList ) return;

    const activeAlerts = Array.from( marketAlerts.entries() );

    if ( activeAlerts.length === 0 ) {
        alertsList.innerHTML = `
            <div class="text-center text-gray-400 py-4">
                <i class="fas fa-bell-slash text-2xl mb-2" aria-hidden="true"></i>
                <p class="text-sm">No tienes alertas activas</p>
            </div>
        `;
        return;
    }

    const alertsHTML = activeAlerts.map( ( [ alertId, alert ] ) => {
        const timeRemaining = getTimeRemaining( alert.targetTime );
        const actionText = alert.alertType === 'open' ? 'Apertura' : 'Cierre';

        return `
            <div class="bg-gray-700 rounded p-3 text-sm" role="listitem">
                <div class="flex justify-between items-start mb-1">
                    <div class="font-medium">${alert.market.flag} ${alert.market.name}</div>
                    <button 
                        onclick="cancelAlertFromPanel('${alertId}')" 
                        class="text-red-400 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
                        aria-label="Cancelar alerta de ${actionText} para ${alert.market.name}"
                    >
                        <i class="fas fa-times" aria-hidden="true"></i>
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
        alertsCount.style.display = activeAlertsCount > 0 ? 'flex' : 'none';

        if ( activeAlertsCount > 0 ) {
            alertsCount.classList.remove( 'hidden' );
        } else {
            alertsCount.classList.add( 'hidden' );
        }
    }
}

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

async function cancelAlertFromPanel( alertId ) {
    marketAlerts.delete( alertId );
    await cancelPersistentAlert( alertId );

    updateAlertsPanel();
    renderMainMarkets();
    renderUserMarkets();

    showAlertFeedback( 'Alerta cancelada', 'warning' );
    updateAlertsCounter();
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener( 'DOMContentLoaded', async function () {
    console.log( 'DOM cargado, iniciando aplicación...' );

    await initServiceWorker();
    await loadCitiesData();
    renderMainMarkets();

    console.log( 'Iniciando actualización de tiempos...' );
    updateAllTimes();

    setInterval( () => {
        updateAllTimes();
    }, 1000 );

    setInterval( () => {
        const alertsPanel = document.getElementById( 'alerts-panel' );
        if ( alertsPanel && !alertsPanel.classList.contains( 'hidden' ) ) {
            updateAlertsPanel();
        }
    }, 60000 );

    // Event listeners
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
                showAlertFeedback( 'Por favor, escribe el nombre de una ciudad o país', 'warning' );
                return;
            }

            const results = searchCities( searchTerm );
            if ( results.length === 1 ) {
                const city = results[ 0 ];
                addCityFromResults( city.timezone, city.name, city.country, city.market, city.flag, city.openHour, city.closeHour );
            } else if ( results.length > 1 ) {
                showAlertFeedback( 'Se encontraron múltiples resultados. Por favor, selecciona uno de la lista.', 'info' );
            } else {
                showAlertFeedback( 'No se encontraron resultados para tu búsqueda.', 'warning' );
            }
        } );
    }

    updateAlertsCounter();

    console.log( 'Aplicación iniciada correctamente' );
} );

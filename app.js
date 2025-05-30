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


// Variables globales
let worldCities = [];
let userMarkets = [];
let searchResults = [];
let isLoading = true;
let marketAlerts = new Map(); // Para almacenar las alertas activas
let notificationPermission = false;

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
    const now = new Date();
    const marketTime = new Date( now.toLocaleString( "en-US", { timeZone: timezone } ) );
    const hours = marketTime.getHours() + marketTime.getMinutes() / 60;
    const day = marketTime.getDay();

    // Weekend
    if ( day === 0 || day === 6 ) {
        return { status: 'Cerrado', class: 'status-closed' };
    }

    // Market hours
    if ( hours >= openHour && hours < closeHour ) {
        return { status: 'Abierto', class: 'status-open' };
    } else if ( hours >= ( openHour - 1 ) && hours < openHour ) {
        return { status: 'Pre-apertura', class: 'status-pre' };
    } else {
        return { status: 'Cerrado', class: 'status-closed' };
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
                    <span class="market-status px-3 py-1 rounded-full text-xs font-semibold ${marketStatus.class}">
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
        updateTimeForTimezone( timeElement, timezone );
    } );

    // Actualizar fechas de mercados principales
    document.querySelectorAll( '#main-markets .market-date' ).forEach( dateElement => {
        const timezone = dateElement.getAttribute( 'data-timezone' );
        updateDateForTimezone( dateElement, timezone );
    } );

    // Actualizar mercados de usuario
    document.querySelectorAll( '#user-markets .market-time' ).forEach( timeElement => {
        const timezone = timeElement.getAttribute( 'data-timezone' );
        updateTimeForTimezone( timeElement, timezone );
    } );

    document.querySelectorAll( '#user-markets .market-date' ).forEach( dateElement => {
        const timezone = dateElement.getAttribute( 'data-timezone' );
        updateDateForTimezone( dateElement, timezone );
    } );

    // Actualizar estados de mercado
    updateMarketStatuses();
}

// Función para actualizar la hora de Perú
function updatePeruTime() {
    const peruTimeElement = document.getElementById( 'peru-time' );
    const peruDateElement = document.getElementById( 'peru-date' );
    const peruStatusElement = document.getElementById( 'peru-status' );

    if ( peruTimeElement && peruDateElement ) {
        const now = new Date();
        const peruTime = new Date( now.toLocaleString( "en-US", { timeZone: "America/Lima" } ) );

        // Formatear tiempo
        const timeString = peruTime.toLocaleTimeString( 'es-PE', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        } );

        // Formatear fecha
        const dateString = peruTime.toLocaleDateString( 'es-PE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        } );

        peruTimeElement.textContent = timeString;
        peruDateElement.textContent = dateString;

        // Actualizar estado del mercado peruano (BVL: 9:00 - 15:30)
        const marketStatus = getMarketStatus( 'America/Lima', 9, 15.5 );
        if ( peruStatusElement ) {
            peruStatusElement.textContent = marketStatus.status;
            peruStatusElement.className = `market-status px-3 py-1 rounded-full text-sm font-semibold ${marketStatus.class}`;
        }
    }
}

// Función para actualizar tiempo por zona horaria
function updateTimeForTimezone( element, timezone ) {
    const now = new Date();
    const localTime = new Date( now.toLocaleString( "en-US", { timeZone: timezone } ) );

    const timeString = localTime.toLocaleTimeString( 'es-ES', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    } );

    element.textContent = timeString;
}

// Función para actualizar fecha por zona horaria
function updateDateForTimezone( element, timezone ) {
    const now = new Date();
    const localTime = new Date( now.toLocaleString( "en-US", { timeZone: timezone } ) );

    const dateString = localTime.toLocaleDateString( 'es-ES', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    } );

    element.textContent = dateString;
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
                statusElement.className = `market-status px-3 py-1 rounded-full text-xs font-semibold ${marketStatus.class}`;
            }

            // Actualizar clase del card
            marketCard.className = `clock-card rounded-2xl p-5 text-white shadow-xl ${marketStatus.status === 'Abierto' ? 'market-open' : marketStatus.status === 'Cerrado' ? 'market-closed' : 'market-pre'}`;
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
                statusElement.className = `market-status px-3 py-1 rounded-full text-xs font-semibold ${marketStatus.class}`;
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
        return notificationPermission;
    }
    return false;
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
        clearTimeout( marketAlerts.get( alertId ).timeoutId );
        marketAlerts.delete( alertId );
        console.log( `Alerta cancelada: ${alertId}` );
    } else {
        // Activar alerta
        if ( !notificationPermission ) {
            const granted = await requestNotificationPermission();
            if ( !granted ) {
                alert( 'Para recibir alertas, debes permitir las notificaciones en tu navegador.' );
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
            scheduleAlert( market, alertType, alertId );
            console.log( `Alerta programada: ${alertId}` );
        }
    }

    // Actualizar la interfaz
    renderMainMarkets();
    renderUserMarkets();
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

    const timeUntilAlert = targetTime.getTime() - now.getTime();

    const timeoutId = setTimeout( () => {
        const actionText = alertType === 'open' ? 'abrió' : 'cerró';
        const title = `${market.flag} ${market.name} - ${market.country}`;
        const body = `El mercado ${market.market} ${actionText} (${formatHour( targetHour )})`;

        sendNotification( title, body );

        // Reprogramar para el siguiente día hábil
        marketAlerts.delete( alertId );
        scheduleAlert( market, alertType, alertId );
    }, timeUntilAlert );

    marketAlerts.set( alertId, {
        timeoutId: timeoutId,
        market: market,
        alertType: alertType,
        targetTime: targetTime
    } );
}

// Event Listeners
document.addEventListener( 'DOMContentLoaded', function () {
    // Cargar datos y renderizar
    loadCitiesData();
    renderMainMarkets();

    // Event listener para búsqueda
    const searchInput = document.getElementById( 'country-search' );
    const addButton = document.getElementById( 'add-country-btn' );

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

    // Event listener para el botón agregar
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

    // Permitir agregar con Enter
    searchInput.addEventListener( 'keypress', function ( e ) {
        if ( e.key === 'Enter' ) {
            addButton.click();
        }
    } );

    // Actualizar tiempos cada segundo
    updateAllTimes();
    setInterval( updateAllTimes, 1000 );
} );

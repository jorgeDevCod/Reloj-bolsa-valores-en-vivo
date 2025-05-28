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

// Sugerencias de países
const countrySuggestions = [
    { name: 'Toronto', country: 'Canadá', timezone: 'America/Toronto', market: 'TSX', flag: '🇨🇦' },
    { name: 'São Paulo', country: 'Brasil', timezone: 'America/Sao_Paulo', market: 'B3', flag: '🇧🇷' },
    { name: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata', market: 'BSE', flag: '🇮🇳' },
    { name: 'Seúl', country: 'Corea del Sur', timezone: 'Asia/Seoul', market: 'KRX', flag: '🇰🇷' },
    { name: 'Shanghái', country: 'China', timezone: 'Asia/Shanghai', market: 'SSE', flag: '🇨🇳' },
    { name: 'Singapur', country: 'Singapur', timezone: 'Asia/Singapore', market: 'SGX', flag: '🇸🇬' },
    { name: 'Zurich', country: 'Suiza', timezone: 'Europe/Zurich', market: 'SIX', flag: '🇨🇭' },
    { name: 'París', country: 'Francia', timezone: 'Europe/Paris', market: 'Euronext', flag: '🇫🇷' },
    { name: 'Milán', country: 'Italia', timezone: 'Europe/Rome', market: 'Borsa Italiana', flag: '🇮🇹' },
    { name: 'Madrid', country: 'España', timezone: 'Europe/Madrid', market: 'BME', flag: '🇪🇸' },
    { name: 'Ámsterdam', country: 'Países Bajos', timezone: 'Europe/Amsterdam', market: 'Euronext', flag: '🇳🇱' },
    { name: 'Estocolmo', country: 'Suecia', timezone: 'Europe/Stockholm', market: 'Nasdaq Stockholm', flag: '🇸🇪' }
];

let userMarkets = [];

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

    return `
        <div class="clock-card rounded-2xl p-6 text-white shadow-xl ${marketStatus.status === 'Abierto' ? 'market-open' : marketStatus.status === 'Cerrado' ? 'market-closed' : 'market-pre'}">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-xl font-bold mb-1">
                        ${market.flag} ${market.name}
                    </h3>
                    <p class="text-blue-100 text-sm">${market.country}</p>
                    <p class="text-blue-200 text-xs">${market.market || 'Mercado Principal'}</p>
                </div>
                ${isUser ? `<button onclick="removeUserMarket('${market.timezone}')" class="text-red-300 hover:text-red-100 transition-colors">
                    <i class="fas fa-times text-lg"></i>
                </button>` : ''}
            </div>
            <div class="text-right">
                <div class="digital-font text-2xl md:text-3xl font-bold market-time" data-timezone="${market.timezone}">
                    --:--:--
                </div>
                <div class="text-sm market-date" data-timezone="${market.timezone}">
                    -- de ---- de ----
                </div>
                <div class="mt-2">
                    <span class="market-status px-3 py-1 rounded-full text-xs font-semibold ${marketStatus.class}">
                        ${marketStatus.status}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// Función para actualizar todos los relojes
function updateClocks() {
    const now = new Date();

    // Actualizar Perú
    const peruTime = now.toLocaleString( "es-PE", {
        timeZone: "America/Lima",
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    } );

    const peruDate = now.toLocaleDateString( "es-PE", {
        timeZone: "America/Lima",
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    } );

    document.getElementById( 'peru-time' ).textContent = peruTime;
    document.getElementById( 'peru-date' ).textContent = peruDate;

    // Estado del mercado peruano (BVL: 9:00 - 15:30)
    const peruMarketStatus = getMarketStatus( 'America/Lima', 9, 15.5 );
    const peruStatusElement = document.getElementById( 'peru-status' );
    peruStatusElement.textContent = peruMarketStatus.status;
    peruStatusElement.className = `market-status px-3 py-1 rounded-full text-sm font-semibold ${peruMarketStatus.class}`;

    // Actualizar otros mercados
    document.querySelectorAll( '.market-time' ).forEach( element => {
        const timezone = element.dataset.timezone;
        const time = now.toLocaleString( "es-PE", {
            timeZone: timezone,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        } );
        element.textContent = time;
    } );

    document.querySelectorAll( '.market-date' ).forEach( element => {
        const timezone = element.dataset.timezone;
        const date = now.toLocaleDateString( "es-PE", {
            timeZone: timezone,
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        } );
        element.textContent = date;
    } );
}

// Función para mostrar sugerencias
function showSuggestions() {
    const suggestionsContainer = document.getElementById( 'search-suggestions' );
    const suggestions = countrySuggestions.slice( 0, 8 ).map( country =>
        `<button onclick="addSuggestedCountry('${country.timezone}', '${country.name}', '${country.country}', '${country.market}', '${country.flag}')" 
                 class="suggestion-btn px-3 py-2 rounded-lg text-white text-sm font-medium transition-all duration-300">
            ${country.flag} ${country.name}
        </button>`
    ).join( '' );
    suggestionsContainer.innerHTML = suggestions;
}

// Función para agregar país sugerido
function addSuggestedCountry( timezone, name, country, market, flag ) {
    const newMarket = { timezone, name, country, market, flag };
    if ( !userMarkets.find( m => m.timezone === timezone ) ) {
        userMarkets.push( newMarket );
        renderUserMarkets();
    }
}

// Función para agregar país desde el buscador
function addCountryFromSearch() {
    const searchInput = document.getElementById( 'country-search' );
    const searchTerm = searchInput.value.toLowerCase().trim();

    if ( !searchTerm ) return;

    const found = countrySuggestions.find( country =>
        country.name.toLowerCase().includes( searchTerm ) ||
        country.country.toLowerCase().includes( searchTerm )
    );

    if ( found && !userMarkets.find( m => m.timezone === found.timezone ) ) {
        userMarkets.push( found );
        renderUserMarkets();
        searchInput.value = '';
    } else if ( !found ) {
        alert( 'País no encontrado. Intenta con: Tokyo, London, New York, Mumbai, etc.' );
    } else {
        alert( 'Este país ya está agregado.' );
    }
}

// Función para eliminar mercado de usuario
function removeUserMarket( timezone ) {
    userMarkets = userMarkets.filter( market => market.timezone !== timezone );
    renderUserMarkets();
}

// Función para renderizar mercados de usuario
function renderUserMarkets() {
    const container = document.getElementById( 'user-markets' );
    container.innerHTML = userMarkets.map( market => createMarketCard( market, true ) ).join( '' );
}

// Función para renderizar mercados principales
function renderMainMarkets() {
    const container = document.getElementById( 'main-markets' );
    container.innerHTML = mainMarkets.map( market => createMarketCard( market ) ).join( '' );
}

// Event listeners
document.getElementById( 'add-country-btn' ).addEventListener( 'click', addCountryFromSearch );
document.getElementById( 'country-search' ).addEventListener( 'keypress', function ( e ) {
    if ( e.key === 'Enter' ) {
        addCountryFromSearch();
    }
} );

// Inicialización
renderMainMarkets();
showSuggestions();
updateClocks();

// Actualizar cada segundo
setInterval( updateClocks, 1000 );

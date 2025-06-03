// sw.js - Service Worker para notificaciones persistentes - VERSIÓN CORREGIDA
const CACHE_NAME = 'market-alerts-v1';
const ALERTS_STORE = 'market-alerts-store';
const DB_VERSION = 1;

let dbInstance = null; // Cache de la instancia de la base de datos

// Instalar el service worker
self.addEventListener( 'install', event => {
    console.log( 'Service Worker instalado' );
    self.skipWaiting();
} );

// Activar el service worker
self.addEventListener( 'activate', event => {
    console.log( 'Service Worker activado' );
    // Inicializar la base de datos al activar
    event.waitUntil(
        Promise.all( [
            self.clients.claim(),
            initializeDatabase()
        ] )
    );
} );

// Inicializar la base de datos al cargar el service worker
async function initializeDatabase() {
    try {
        const db = await openDB();
        console.log( 'Base de datos inicializada correctamente' );
        return db;
    } catch ( error ) {
        console.error( 'Error inicializando base de datos:', error );
        throw error;
    }
}

// Escuchar mensajes desde la aplicación principal
self.addEventListener( 'message', event => {
    const { type, data } = event.data;

    switch ( type ) {
        case 'SCHEDULE_ALERT':
            scheduleAlert( data );
            break;
        case 'CANCEL_ALERT':
            cancelAlert( data.alertId );
            break;
        case 'GET_ACTIVE_ALERTS':
            getActiveAlerts().then( alerts => {
                event.ports[ 0 ].postMessage( { type: 'ACTIVE_ALERTS', alerts } );
            } ).catch( error => {
                console.error( 'Error obteniendo alertas:', error );
                event.ports[ 0 ].postMessage( { type: 'ACTIVE_ALERTS', alerts: [] } );
            } );
            break;
    }
} );

// Función centralizada para abrir la base de datos - MEJORADA
function openDB() {
    return new Promise( ( resolve, reject ) => {
        // Si ya tenemos una instancia válida, la devolvemos
        if ( dbInstance && !dbInstance.closed ) {
            resolve( dbInstance );
            return;
        }

        const request = indexedDB.open( ALERTS_STORE, DB_VERSION );

        request.onerror = () => {
            console.error( 'Error abriendo IndexedDB:', request.error );
            dbInstance = null;
            reject( request.error );
        };

        request.onsuccess = () => {
            dbInstance = request.result;

            // Verificar que el object store existe
            if ( !dbInstance.objectStoreNames.contains( 'alerts' ) ) {
                console.error( 'Object store "alerts" no encontrado' );
                dbInstance.close();
                dbInstance = null;
                // Forzar recreación de la base de datos
                indexedDB.deleteDatabase( ALERTS_STORE );
                reject( new Error( 'Object store no encontrado, recreando base de datos' ) );
                return;
            }

            console.log( 'Base de datos abierta correctamente' );
            resolve( dbInstance );
        };

        request.onupgradeneeded = ( event ) => {
            const db = event.target.result;
            console.log( 'Creando/actualizando base de datos' );

            // Eliminar object store existente si existe para evitar conflictos
            if ( db.objectStoreNames.contains( 'alerts' ) ) {
                db.deleteObjectStore( 'alerts' );
                console.log( 'Object store existente eliminado' );
            }

            // Crear nuevo object store
            const store = db.createObjectStore( 'alerts', { keyPath: 'id' } );
            store.createIndex( 'targetTime', 'targetTime', { unique: false } );
            console.log( 'Object store "alerts" creado exitosamente' );
        };

        request.onblocked = () => {
            console.warn( 'Base de datos bloqueada, cerrando conexiones existentes' );
            if ( dbInstance ) {
                dbInstance.close();
                dbInstance = null;
            }
        };
    } );
}

// Almacenar alertas en IndexedDB - MEJORADA
async function saveAlert( alertData ) {
    let retries = 3;

    while ( retries > 0 ) {
        try {
            const db = await openDB();

            return new Promise( ( resolve, reject ) => {
                const transaction = db.transaction( [ 'alerts' ], 'readwrite' );
                const store = transaction.objectStore( 'alerts' );

                transaction.onerror = () => {
                    console.error( 'Error en transacción:', transaction.error );
                    reject( transaction.error );
                };

                transaction.oncomplete = () => {
                    console.log( 'Alerta guardada exitosamente:', alertData.id );
                    resolve( alertData );
                };

                const saveRequest = store.put( alertData );
                saveRequest.onerror = () => {
                    console.error( 'Error guardando alerta:', saveRequest.error );
                    reject( saveRequest.error );
                };
            } );
        } catch ( error ) {
            console.error( `Error en saveAlert (intento ${4 - retries}):`, error );
            retries--;

            if ( retries === 0 ) {
                throw error;
            }

            // Reinicializar base de datos en caso de error
            dbInstance = null;
            await new Promise( resolve => setTimeout( resolve, 1000 ) ); // Esperar 1 segundo
        }
    }
}

// Obtener alertas activas - MEJORADA
async function getActiveAlerts() {
    let retries = 3;

    while ( retries > 0 ) {
        try {
            const db = await openDB();

            return new Promise( ( resolve, reject ) => {
                const transaction = db.transaction( [ 'alerts' ], 'readonly' );
                const store = transaction.objectStore( 'alerts' );

                transaction.onerror = () => {
                    console.error( 'Error en transacción de lectura:', transaction.error );
                    reject( transaction.error );
                };

                const getRequest = store.getAll();
                getRequest.onsuccess = () => {
                    const now = Date.now();
                    const activeAlerts = getRequest.result.filter( alert => alert.targetTime > now );
                    console.log( 'Alertas activas encontradas:', activeAlerts.length );
                    resolve( activeAlerts );
                };

                getRequest.onerror = () => {
                    console.error( 'Error obteniendo alertas:', getRequest.error );
                    reject( getRequest.error );
                };
            } );
        } catch ( error ) {
            console.error( `Error en getActiveAlerts (intento ${4 - retries}):`, error );
            retries--;

            if ( retries === 0 ) {
                console.warn( 'No se pudieron obtener alertas, devolviendo array vacío' );
                return [];
            }

            // Reinicializar base de datos en caso de error
            dbInstance = null;
            await new Promise( resolve => setTimeout( resolve, 1000 ) ); // Esperar 1 segundo
        }
    }
}

// Eliminar alerta - MEJORADA
async function removeAlert( alertId ) {
    let retries = 3;

    while ( retries > 0 ) {
        try {
            const db = await openDB();

            return new Promise( ( resolve, reject ) => {
                const transaction = db.transaction( [ 'alerts' ], 'readwrite' );
                const store = transaction.objectStore( 'alerts' );

                transaction.onerror = () => {
                    console.error( 'Error en transacción de eliminación:', transaction.error );
                    reject( transaction.error );
                };

                transaction.oncomplete = () => {
                    console.log( 'Alerta eliminada exitosamente:', alertId );
                    resolve();
                };

                const deleteRequest = store.delete( alertId );
                deleteRequest.onerror = () => {
                    console.error( 'Error eliminando alerta:', deleteRequest.error );
                    reject( deleteRequest.error );
                };
            } );
        } catch ( error ) {
            console.error( `Error en removeAlert (intento ${4 - retries}):`, error );
            retries--;

            if ( retries === 0 ) {
                throw error;
            }

            // Reinicializar base de datos en caso de error
            dbInstance = null;
            await new Promise( resolve => setTimeout( resolve, 1000 ) ); // Esperar 1 segundo
        }
    }
}

// Programar alerta - MEJORADA con mejor manejo de errores
async function scheduleAlert( alertData ) {
    try {
        const { id, targetTime, market, alertType } = alertData;

        // Guardar en IndexedDB con reintentos
        await saveAlert( alertData );

        // Calcular tiempo hasta la alerta
        const timeUntilAlert = targetTime - Date.now();

        if ( timeUntilAlert > 0 ) {
            console.log( `Alerta programada para ${new Date( targetTime ).toLocaleString()}` );

            // Programar la notificación
            setTimeout( async () => {
                try {
                    await showNotification( market, alertType );
                    await removeAlert( id );

                    // Reprogramar para el siguiente día hábil si es una alerta recurrente
                    if ( alertData.recurring ) {
                        const nextAlert = calculateNextBusinessDay( alertData );
                        if ( nextAlert ) {
                            await scheduleAlert( nextAlert );
                        }
                    }
                } catch ( error ) {
                    console.error( 'Error ejecutando alerta:', error );
                }
            }, timeUntilAlert );
        } else {
            console.log( 'Alerta programada para el pasado, ejecutando inmediatamente' );
            await showNotification( market, alertType );
            await removeAlert( id );
        }
    } catch ( error ) {
        console.error( 'Error en scheduleAlert:', error );
        // No lanzar el error para evitar que se propague
    }
}

// Cancelar alerta
async function cancelAlert( alertId ) {
    try {
        await removeAlert( alertId );
        console.log( 'Alerta cancelada exitosamente:', alertId );
    } catch ( error ) {
        console.error( 'Error cancelando alerta:', error );
    }
}

// Mostrar notificación
async function showNotification( market, alertType ) {
    try {
        const actionText = alertType === 'open' ? 'abrió' : 'cerró';
        const title = `${market.flag} ${market.name} - ${market.country}`;
        const body = `El mercado ${market.market} ${actionText}`;

        const options = {
            body: body,
            icon: '/favicon-v2.png',
            badge: '/favicon-v2.png',
            requireInteraction: true,
            persistent: true,
            actions: [
                {
                    action: 'view',
                    title: 'Ver mercados'
                },
                {
                    action: 'dismiss',
                    title: 'Cerrar'
                }
            ],
            data: {
                market: market,
                alertType: alertType,
                timestamp: Date.now()
            }
        };

        await self.registration.showNotification( title, options );
        console.log( 'Notificación mostrada:', title );
    } catch ( error ) {
        console.error( 'Error mostrando notificación:', error );
    }
}

// Calcular siguiente día hábil
function calculateNextBusinessDay( alertData ) {
    const nextDate = new Date( alertData.targetTime );
    nextDate.setDate( nextDate.getDate() + 1 );

    // Saltar fines de semana
    while ( nextDate.getDay() === 0 || nextDate.getDay() === 6 ) {
        nextDate.setDate( nextDate.getDate() + 1 );
    }

    return {
        ...alertData,
        targetTime: nextDate.getTime()
    };
}

// Manejar clics en notificaciones
self.addEventListener( 'notificationclick', event => {
    event.notification.close();

    if ( event.action === 'view' ) {
        // Abrir o enfocar la aplicación
        event.waitUntil(
            clients.matchAll( { type: 'window' } ).then( clientList => {
                if ( clientList.length > 0 ) {
                    return clientList[ 0 ].focus();
                }
                return clients.openWindow( '/' );
            } )
        );
    }
} );

// Verificar alertas pendientes periódicamente - MEJORADA
async function checkPendingAlerts() {
    try {
        const activeAlerts = await getActiveAlerts();
        const now = Date.now();

        for ( const alert of activeAlerts ) {
            if ( alert.targetTime <= now ) {
                await showNotification( alert.market, alert.alertType );
                await removeAlert( alert.id );

                // Reprogramar si es recurrente
                if ( alert.recurring ) {
                    const nextAlert = calculateNextBusinessDay( alert );
                    if ( nextAlert ) {
                        await scheduleAlert( nextAlert );
                    }
                }
            }
        }
    } catch ( error ) {
        console.error( 'Error en verificación periódica:', error );
    }
}

// Verificar alertas cada minuto con mejor manejo de errores
setInterval( checkPendingAlerts, 60000 );

// Inicializar la base de datos cuando se carga el service worker
initializeDatabase().catch( error => {
    console.error( 'Error en inicialización inicial:', error );
} );

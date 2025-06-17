// Déclaration des variables globales
let map;
let currentGuidanceId = null;
let watchId; // Pour stocker l'ID du watcher de géolocalisation
let currentAudio = null; // Pour gérer l'audio en cours de lecture
let currentParcoursData = null; // Pour stocker les détails du parcours JSON actuellement chargé
let currentParcoursLayer = null; // Pour stocker la couche GPX Leaflet

// Nouveaux éléments pour la position de l'utilisateur avec la flèche
let userMarker = null; // Marqueur pour la position de l'utilisateur
let userMarkerIcon = L.icon({
    iconUrl: 'img/arrow.png', // Chemin vers votre image de flèche
    iconSize: [30, 30], // Taille de l'icône
    iconAnchor: [15, 15], // Point d'ancrage de l'icône (milieu)
    className: 'user-direction-icon' // Classe CSS pour la rotation
});
// AJOUTÉ: Variable pour le gestionnaire d'événements DeviceOrientation
let deviceOrientationListener = null;

// Liste des parcours disponibles (vous pouvez ajouter une propriété 'type' ici)
const parcoursData = [
    
    {
        id: 'pinede_st_leon',
        name: 'Test rapide',
        type: 'course',
        description: "Circuit rapide",
        json: 'parcours/Salon/parcours_pinede/pinede.json',
        gpx: 'parcours/Salon/parcours_pinede/pinede.gpx'
    }
    // Ajoutez d'autres parcours ici au fur et à mesure
];

// Nouveaux éléments du DOM
const sportSelectionSection = document.getElementById('sport-selection');
const parcoursListSection = document.getElementById('parcours-list');
const mapSection = document.getElementById('map-section');
const btnRunning = document.getElementById('btn-running');
const btnHiking = document.getElementById('btn-hiking');
const parcoursUl = document.getElementById('parcours-ul');
const btnBackToSports = document.getElementById('btn-back-to-sports');
const btnBackToParcours = document.getElementById('btn-back-to-parcours');
const parcoursDetailTitle = document.getElementById('parcours-detail-title');
const parcoursDetailDistance = document.getElementById('parcours-detail-distance');
const parcoursDetailDenivele = document.getElementById('parcours-detail-denivele');
const startGuidanceBtn = document.getElementById('start-guidance-btn');
const stopGuidanceBtn = document.getElementById('stop-guidance-btn');
const currentInfo = document.getElementById('current-info');
const mainContent = document.querySelector('main');
const headerContent = document.querySelector('header');
const footerContent = document.querySelector('footer');
const parcoursDetailInfo = document.getElementById('parcours-detail-info');
const controlsSection = document.getElementById('controls');


document.addEventListener('DOMContentLoaded', () => {
    // Initialisation de la carte Leaflet (sans la centrer immédiatement)
    map = L.map('map', { zoomControl: false }); // Désactive le contrôle de zoom par défaut
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd', // Nécessaire pour CartoDB
    maxZoom: 19
}).addTo(map);

    // Ajout manuel du contrôle de zoom en bas à droite
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);


    // Gestionnaire d'événements pour les boutons de sélection de sport
    btnRunning.addEventListener('click', () => showParcoursForSport('course'));
    btnHiking.addEventListener('click', () => showParcoursForSport('randonnee'));

    // Gestionnaires d'événements pour les boutons de retour
    btnBackToSports.addEventListener('click', backToSportsSelection);
    btnBackToParcours.addEventListener('click', backToParcoursList);

    // Gestionnaires pour les boutons de guidage
    startGuidanceBtn.addEventListener('click', startGuidance);
    stopGuidanceBtn.addEventListener('click', stopGuidance);

    showSection('sport-selection'); // Afficher la sélection de sport au démarrage
});


// Fonction pour gérer l'affichage des sections
function showSection(sectionId) {
    sportSelectionSection.style.display = 'none';
    parcoursListSection.style.display = 'none';
    mapSection.style.display = 'none';

    document.getElementById(sectionId).style.display = 'block';
}

// Fonction pour afficher la liste des parcours pour un sport donné
function showParcoursForSport(sportType) {
    parcoursUl.innerHTML = ''; // Nettoyer la liste précédente
    const filteredParcours = parcoursData.filter(p => p.type === sportType);

    if (filteredParcours.length === 0) {
        parcoursUl.innerHTML = '<p>Aucun parcours disponible pour ce sport.</p>';
    } else {
        filteredParcours.forEach(parcours => {
            const listItem = document.createElement('li');
            // DÉBUT DE L'AJOUT
            const clickableDiv = document.createElement('div');
            clickableDiv.classList.add('parcours-item-clickable'); // Ajoutez une classe pour le style CSS
            clickableDiv.dataset.parcoursId = parcours.id; // Stocker l'ID pour le clic

            clickableDiv.innerHTML = `
                <h3>${parcours.name}</h3>
                <p>${parcours.description}</p>
                <p>Distance: <span id="distance-${parcours.id}">Chargement...</span></p>
                <p>Dénivelé: <span id="denivele-${parcours.id}">Chargement...</span></p>
            `;

            clickableDiv.addEventListener('click', () => loadParcours(parcours.id)); // Attacher l'écouteur au div
            listItem.appendChild(clickableDiv); // Ajouter le div cliquable au li
            // FIN DE L'AJOUT
            parcoursUl.appendChild(listItem); // Cette ligne était déjà là, elle reste.

            // Charger les détails du GPX pour chaque parcours listé
            // La distance et le dénivelé sont chargés pour l'affichage dans la liste
            if (parcours.gpx) {
                fetch(parcours.gpx)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Erreur de chargement du GPX: ${response.statusText}`);
                        }
                        return response.text();
                    })
                    .then(gpxData => {
                        const tempGpxLayer = new L.GPX(gpxData, {
                            async: true,
                            marker_options: {
                                startIconUrl: '', // Ne pas afficher les marqueurs par défaut
                                endIconUrl: '',
                                shadowUrl: '',
                                iconSize: [0,0],
                                iconAnchor: [0,0]
                            }
                        }).on('loaded', function (e) {
                            const distanceKm = (e.target.get_distance() / 1000).toFixed(2);
                            const elevationGainM = e.target.get_elevation_gain().toFixed(0);
                            document.getElementById(`distance-${parcours.id}`).textContent = `${distanceKm} km`;
                            document.getElementById(`denivele-${parcours.id}`).textContent = `${elevationGainM} m`;
                        }).addTo(map); // Ajouter temporairement à la carte pour le chargement, puis supprimer si non sélectionné
                        map.removeLayer(tempGpxLayer); // Supprimer la couche une fois les données chargées
                    })
                    .catch(error => {
                        console.error(`Erreur lors du chargement du GPX pour ${parcours.name}:`, error);
                        document.getElementById(`distance-${parcours.id}`).textContent = `Erreur`;
                        document.getElementById(`denivele-${parcours.id}`).textContent = `Erreur`;
                    });
            }
        });
    }
    showSection('parcours-list');
}

// Fonction pour revenir à la sélection des sports
function backToSportsSelection() {
    showSection('sport-selection');
}

// Fonction pour revenir à la liste des parcours
function backToParcoursList() {
    stopGuidance(); // Arrêter le guidage si actif
    if (currentParcoursLayer) {
        map.removeLayer(currentParcoursLayer); // Supprimer la couche GPX de la carte
        currentParcoursLayer = null;
    }
    if (userMarker) { // Supprimer le marqueur utilisateur
        map.removeLayer(userMarker);
        userMarker = null;
    }
    showSection('parcours-list');
}


// Fonction pour charger un parcours spécifique sur la carte
async function loadParcours(parcoursId) {
    currentGuidanceId = parcoursId;
    const parcours = parcoursData.find(p => p.id === parcoursId);

    if (!parcours) {
        console.error('Parcours non trouvé:', parcoursId);
        return;
    }

    parcoursDetailTitle.textContent = parcours.name;
    // Réinitialiser les infos de distance/dénivelé au cas où le GPX ne charge pas tout de suite
    parcoursDetailDistance.textContent = 'N/A';
    parcoursDetailDenivele.textContent = 'N/A';

    showSection('map-section');

    // Nettoyer la carte avant de charger un nouveau parcours
    if (currentParcoursLayer) {
        map.removeLayer(currentParcoursLayer);
    }
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }


    // Charger le fichier GPX et l'afficher sur la carte
    try {
        const gpxResponse = await fetch(parcours.gpx);
        if (!gpxResponse.ok) {
            throw new Error(`Erreur de chargement du GPX: ${gpxResponse.statusText}`);
        }
        const gpxData = await gpxResponse.text();

        currentParcoursLayer = new L.GPX(gpxData, {
            async: true,
            marker_options: {
                startIconUrl: 'https://raw.githubusercontent.com/mpetroff/leaflet-gpx/master/pin-icon-start.png',
                endIconUrl: 'https://raw.githubusercontent.com/mpetroff/leaflet-gpx/master/pin-icon-end.png',
                shadowUrl: 'https://raw.githubusercontent.com/mpetroff/leaflet-gpx/master/pin-shadow.png',
                iconSize: [33, 50], // Taille des marqueurs de début/fin
                iconAnchor: [16, 49] // Point d'ancrage
            }
        }).on('loaded', function (e) {
            map.fitBounds(e.target.getBounds()); // Adapter la carte au parcours
            const distanceKm = (e.target.get_distance() / 1000).toFixed(2);
            const elevationGainM = e.target.get_elevation_gain().toFixed(0);
            parcoursDetailDistance.textContent = `${distanceKm} km`;
            parcoursDetailDenivele.textContent = `${elevationGainM} m`;
        }).addTo(map);

    } catch (error) {
        console.error(`Erreur lors du chargement du GPX pour ${parcours.name}:`, error);
        parcoursDetailDistance.textContent = `Erreur`;
        parcoursDetailDenivele.textContent = `Erreur`;
    }

    // Charger le fichier JSON des points d'intérêt/guidage
    try {
        const jsonResponse = await fetch(parcours.json);
        if (!jsonResponse.ok) {
            throw new Error(`Erreur de chargement du JSON: ${jsonResponse.statusText}`);
        }
        currentParcoursData = await jsonResponse.json();

        // Optionnel : Ajouter des marqueurs pour les POI/points de guidage sur la carte
        // (Peut être utile pour le débogage ou pour afficher visuellement les points)
        // currentParcoursData.pointsInteret.forEach(poi => {
        //     L.marker([poi.lat, poi.lng]).addTo(map).bindPopup(poi.titre);
        // });
        // currentParcoursData.pointsGuidage.forEach(point => {
        //     L.marker([point.lat, point.lng]).addTo(map).bindPopup(point.descriptionTextuelle || 'Point de guidage');
        // });

    } catch (error) {
        console.error(`Erreur lors du chargement du JSON pour ${parcours.name}:`, error);
        currentParcoursData = { pointsInteret: [], pointsGuidage: [] }; // Initialiser vide pour éviter les erreurs
    }

    startGuidanceBtn.style.display = 'block';
    stopGuidanceBtn.style.display = 'none';
    currentInfo.textContent = 'Prêt à démarrer le guidage.';
}


// Fonction pour démarrer le guidage vocal
function startGuidance() {
    if (!currentGuidanceId || !currentParcoursData) {
        currentInfo.textContent = "Veuillez sélectionner un parcours d'abord.";
        return;
    }

    startGuidanceBtn.style.display = 'none';
    stopGuidanceBtn.style.display = 'block';
    currentInfo.textContent = 'Guidage démarré... En attente de position GPS.';

    // Réinitialiser l'état 'triggered' des points pour un nouveau démarrage
    currentParcoursData.pointsInteret.forEach(poi => poi.triggered = false);
    currentParcoursData.pointsGuidage.forEach(point => point.triggered = false);


    /// Options pour la géolocalisation
    const geoOptions = {
        enableHighAccuracy: true, // Demande la meilleure précision
        maximumAge: 1000,         // Accepte une position d'il y a 1 seconde max
        timeout: 5000             // Délai maximum pour obtenir une position
    };

    // AJOUTÉ : Activer le mode plein écran de la carte
    document.body.classList.add('fullscreen-map-active'); // Ajoute une classe au body
    mainContent.classList.add('fullscreen-map-active'); // Ajoute une classe au main
    mapSection.classList.add('fullscreen'); // Ajoute une classe à la section carte
    btnBackToParcours.style.display = 'none'; // Masquer le bouton de retour
    parcoursDetailTitle.style.display = 'none'; // Masquer le titre
    parcoursDetailInfo.style.display = 'none'; // Masquer les infos de distance/dénivelé
    controlsSection.style.position = 'absolute'; // Positionner les contrôles sur la carte
    controlsSection.style.bottom = '10px'; // Positionner en bas
    controlsSection.style.left = '50%';
    controlsSection.style.transform = 'translateX(-50%)';
    controlsSection.style.zIndex = '1000'; // S'assurer qu'il est au-dessus de la carte
    controlsSection.style.width = 'calc(100% - 20px)'; // Pleine largeur
    controlsSection.style.maxWidth = '400px'; // Limiter la largeur sur grand écran
    // Ajuster la position de #current-info aussi si nécessaire dans le CSS pour le mode plein écran

    // Forcer la carte à prendre la nouvelle taille et recentrer
    map.invalidateSize();

    // AJOUTÉ : Demander la permission pour DeviceOrientation API pour iOS 13+
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    console.log("Device Orientation permission granted.");
                    startDeviceOrientationTracking();
                } else {
                    console.warn("Device Orientation permission denied.");
                }
            })
            .catch(console.error);
    } else {
        // Pour les navigateurs qui ne nécessitent pas de permission explicite (ex: Android, anciens iOS)
        startDeviceOrientationTracking();
    }


    // Démarrer le suivi de la position de l'utilisateur
    watchId = navigator.geolocation.watchPosition(
        position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const heading = position.coords.heading; // Direction en degrés (0-360)
            const accuracy = position.coords.accuracy; // Récupérer la précision

            // **MODIFIÉ/AJOUTÉ : La flèche est toujours affichée.**
            // Le message indique si la précision est faible, mais le marqueur reste.
            const MIN_ACCURACY = 20; // En mètres, seuil pour afficher l'avertissement de précision

            const currentPosition = L.latLng(lat, lng);

            // Mettre à jour le marqueur de l'utilisateur. Le marqueur reste au centre de l'écran.
            // La carte se déplacera sous lui.
            if (!userMarker) {
                userMarker = L.marker(map.getCenter(), { icon: userMarkerIcon, interactive: false }).addTo(map);
            }

            // MODIFIÉ : Centrer la carte sur la nouvelle position de l'utilisateur
            map.panTo(currentPosition, { animate: true, duration: 1.0 });

            // AJOUTÉ : Si la propriété 'heading' est valide et disponible (venant du GPS)
            if (heading !== null && heading !== undefined && !isNaN(heading)) {
                updateUserMarkerRotation(heading);
            }

            // Affichage de l'information, y compris la précision
            if (accuracy > MIN_ACCURACY) {
                currentInfo.textContent = `Position: ${lat.toFixed(5)}, ${lng.toFixed(5)} (Précision: ${accuracy.toFixed(0)}m - Amélioration...)`;
            } else {
                currentInfo.textContent = `Position: ${lat.toFixed(5)}, ${lng.toFixed(5)} (Précision: ${accuracy.toFixed(0)}m)`;
            }

            checkProximity(currentPosition); // Vérifier la proximité des points
        },
        error => {
            console.error('Erreur de géolocalisation:', error);
            let errorMessage = "Erreur de géolocalisation inconnue. Assurez-vous que les services de localisation sont activés et que vous avez donné la permission.";

            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = "Accès à la position refusé. Veuillez autoriser la géolocalisation pour cette application dans les paramètres de votre navigateur et de votre téléphone (Paramètres > Confidentialité > Services de localisation).";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = "Position indisponible. Le signal GPS est faible ou inexistant. Essayez de vous déplacer à l'extérieur ou dans un endroit dégagé.";
                    break;
                case error.TIMEOUT:
                    errorMessage = "Délai de géolocalisation dépassé. Impossible d'obtenir une position rapidement. Vérifiez votre connexion ou réessayez.";
                    break;
                case error.UNKNOWN_ERROR:
                    errorMessage = "Une erreur inconnue est survenue lors de la géolocalisation.";
                    break;
            }
            currentInfo.textContent = `Erreur GPS: ${errorMessage}`;
            // Optionnel : Désactiver le bouton "Arrêter le guidage" si une erreur grave se produit
            // et réactiver le bouton "Démarrer le guidage"
            stopGuidance(); // Arrête le watchPosition pour éviter de continuer à échouer
        },
        geoOptions
    );
        // Zoomer sur la flèche au démarrage (initialement, elle est au centre de la carte)
        map.setView(map.getCenter(), 18); // Zoom initial sur 18 (très proche)
    
}

// Fonction pour arrêter le guidage
function stopGuidance() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        currentInfo.textContent = 'Guidage arrêté.';
    }
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }

    // AJOUTÉ : Désactiver le mode plein écran de la carte
    document.body.classList.remove('fullscreen-map-active');
    mainContent.classList.remove('fullscreen-map-active');
    mapSection.classList.remove('fullscreen');
    btnBackToParcours.style.display = 'block'; // Réafficher le bouton de retour
    parcoursDetailTitle.style.display = 'block'; // Réafficher le titre
    parcoursDetailInfo.style.display = 'block'; // Réafficher les infos de distance/dénivelé
    controlsSection.style.position = 'static'; // Remettre en position statique
    controlsSection.style.bottom = '';
    controlsSection.style.left = '';
    controlsSection.style.transform = '';
    controlsSection.style.zIndex = '';
    controlsSection.style.width = '';
    controlsSection.style.maxWidth = '';
    map.invalidateSize(); // Forcer la carte à se redessiner à sa taille normale

    // AJOUTÉ : Arrêter le suivi de l'orientation de l'appareil
    if (deviceOrientationListener) {
        window.removeEventListener('deviceorientation', deviceOrientationListener);
        deviceOrientationListener = null;
    }

    startGuidanceBtn.style.display = 'block';
    stopGuidanceBtn.style.display = 'none';
}


// Fonction pour vérifier la proximité des points d'intérêt et de guidage
function checkProximity(currentPosition) {
    if (!currentParcoursData) return; // S'assurer que les données du parcours sont chargées

    const defaultRadius = 50; // Rayon de déclenchement par défaut en mètres

    // Vérifier les Points d'Intérêt
    currentParcoursData.pointsInteret.forEach(poi => {
        const poiPosition = L.latLng(poi.lat, poi.lng);
        const triggerRadius = poi.rayonDeclenchement || defaultRadius; // Utilise le rayon du POI ou le défaut

        if (currentPosition.distanceTo(poiPosition) < triggerRadius && !poi.triggered) {
            console.log('Proximité POI :', poi.titre);
            poi.triggered = true;
            playAudio(poi.fichierAudio);
            currentInfo.textContent = `Point d'intérêt : ${poi.titre}`;
        }
    });

    // Vérifier les Points de Guidage
    currentParcoursData.pointsGuidage.forEach(point => {
        const pointPosition = L.latLng(point.lat, point.lng);
        const triggerRadius = point.rayonDeclenchement || defaultRadius; // Utilise le rayon du point ou le défaut

        if (currentPosition.distanceTo(pointPosition) < triggerRadius && !point.triggered) {
            console.log('Proximité point de guidage :', point.fichierAudio);
            point.triggered = true;
            playAudio(point.fichierAudio);
            currentInfo.textContent = `Instruction : ${point.descriptionTextuelle || point.fichierAudio.split('/').pop().replace('.mp3', '')}`; // Affiche la description ou le nom du fichier
        }
    });
}

// Fonction pour lire un fichier audio
function playAudio(audioPath) {
    if (currentAudio) {
        currentAudio.pause(); // Arrête l'audio précédent si il y en a un
        currentAudio.currentTime = 0; // Réinitialise sa position de lecture
    }
    currentAudio = new Audio(audioPath);
    currentAudio.play().catch(e => console.error("Erreur de lecture audio:", e));
}

// AJOUTÉ : Fonction pour mettre à jour la rotation du marqueur utilisateur
function updateUserMarkerRotation(heading) {
    if (userMarker) {
        const iconElement = userMarker._icon;
        if (iconElement) {
            // Heading est la direction du mouvement (0-360, Nord=0)
            // L'icône doit être tournée pour pointer dans cette direction
            // Si votre flèche pointe vers le haut par défaut, c'est juste `heading`
            iconElement.style.transform = `translate(-50%, -50%) rotate(${heading}deg)`;
        }
    }
}

// AJOUTÉ : Fonction pour démarrer le suivi de l'orientation de l'appareil
function startDeviceOrientationTracking() {
    deviceOrientationListener = function(event) {
        // `alpha` est l'azimut (direction par rapport au Nord magnétique)
        // `webkitCompassHeading` est souvent plus fiable sur iOS pour le Nord réel
        let heading = null;

        if (event.webkitCompassHeading) { // iOS spécifique
            heading = event.webkitCompassHeading;
        } else if (event.alpha !== null) { // Android et autres, en tenant compte de `beta` et `gamma`
            // Pour obtenir un cap absolu depuis `alpha` sur certains appareils, il faut
            // souvent des calculs plus complexes avec beta et gamma pour la re-projection.
            // Pour simplifier et si `webkitCompassHeading` n'est pas dispo, on peut juste utiliser alpha.
            // attention: alpha est relatif au repère de l'appareil, non absolu.
            // Une calibration est souvent nécessaire.
            heading = 360 - event.alpha; // Convertir alpha (0 à 360) en direction (0 est Nord)
        }

        if (heading !== null && !isNaN(heading)) {
            // Mettre à jour la rotation du marqueur basée sur le cap de l'appareil
            updateUserMarkerRotation(heading);
        }
    };
    window.addEventListener('deviceorientation', deviceOrientationListener);
}
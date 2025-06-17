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


document.addEventListener('DOMContentLoaded', () => {
    // Initialisation de la carte Leaflet (sans la centrer immédiatement)
    map = L.map('map', { zoomControl: false }); // Désactive le contrôle de zoom par défaut
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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


    // Options pour la géolocalisation
    const geoOptions = {
        enableHighAccuracy: true, // Demande la meilleure précision
        maximumAge: 1000,         // Accepte une position d'il y a 1 seconde max
        timeout: 5000             // Délai maximum pour obtenir une position
    };

    // Démarrer le suivi de la position de l'utilisateur
    watchId = navigator.geolocation.watchPosition(
        position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const heading = position.coords.heading; // Direction en degrés (0-360)
            const accuracy = position.coords.accuracy; // Récupérer la précision
            // Optionnel : Définir un seuil de précision minimum acceptable
            const MIN_ACCURACY = 20; // En mètres, ajustez selon vos besoins

            if (accuracy > MIN_ACCURACY) {
            currentInfo.textContent = `Amélioration de la précision... (${accuracy.toFixed(0)}m)`;
            // Vous pouvez choisir de ne pas mettre à jour la carte ou de ne pas déclencher d'audio si la précision est trop faible
            // Ou vous pouvez afficher un cercle de précision autour du marqueur utilisateur
            // L.circle([lat, lng], {radius: accuracy}).addTo(map);
            console.warn(`Position imprécise: ${accuracy.toFixed(0)}m. En attente d'une meilleure précision.`);
            return; // Ne pas traiter cette position si elle est trop imprécise
        }

            const currentPosition = L.latLng(lat, lng);

            // Créer ou mettre à jour le marqueur de l'utilisateur avec la flèche
            if (!userMarker) {
                userMarker = L.marker(currentPosition, { icon: userMarkerIcon }).addTo(map);
            } else {
                userMarker.setLatLng(currentPosition);
            }

            // Faire pivoter la flèche si la direction est disponible
            if (heading !== null && heading !== undefined) {
                // Leaflet par défaut utilise la rotation CSS sur l'élément img de l'icône
                // Nous devons cibler l'élément DOM de l'icône dans le marqueur
                const iconElement = userMarker._icon;
                if (iconElement) {
                    // Applique la rotation en degrés
                    iconElement.style.transform = `translate(-50%, -50%) rotate(${heading}deg)`;
                    // La transformation translate(-50%, -50%) est nécessaire si iconAnchor est au centre,
                    // pour s'assurer que la rotation se fait autour du centre de l'icône.
                    // Leaflet gère souvent cela, mais il est bon de le préciser.
                }
            } else {
                 // Si le cap n'est pas disponible, réinitialisez la rotation
                const iconElement = userMarker._icon;
                if (iconElement) {
                     iconElement.style.transform = `translate(-50%, -50%) rotate(0deg)`; // Flèche vers le haut par défaut
                }
            }


            // Centrer la carte sur l'utilisateur si c'est la première position ou si le guidage est en cours
            // map.setView(currentPosition, map.getZoom() || 15); // Garde le zoom actuel ou met 15

            // Centrer et ajuster le zoom pour inclure le parcours et l'utilisateur
            if (currentParcoursLayer) {
                const parcoursBounds = currentParcoursLayer.getBounds();
                if (parcoursBounds.isValid()) {
                    const combinedBounds = parcoursBounds.extend(currentPosition);
                    map.fitBounds(combinedBounds, { padding: [50, 50] }); // Marge autour des limites
                } else {
                    map.setView(currentPosition, map.getZoom() || 15);
                }
            } else {
                map.setView(currentPosition, map.getZoom() || 15);
            }


            currentInfo.textContent = `Position: ${lat.toFixed(5)}, ${lng.toFixed(5)} (Précision: ${accuracy.toFixed(0)}m)`; // Afficher la précision
            checkProximity(currentPosition);
        },
        error => {
            console.error('Erreur de géolocalisation:', error);
            currentInfo.textContent = `Erreur GPS: ${error.message}. Vérifiez les permissions.`;
            // Si l'erreur est GEOLOCATION_PERMISSION_DENIED (1), le watchPosition ne rappellera plus.
            // Il faudrait gérer le cas où l'utilisateur refuse.
        },
        geoOptions
    );
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
    if (userMarker) { // Supprimer le marqueur utilisateur
        map.removeLayer(userMarker);
        userMarker = null;
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
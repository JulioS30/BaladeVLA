// Déclaration des variables globales
let map;
let currentGuidanceId = null;
let watchId; // Pour stocker l'ID du watcher de géolocalisation
let currentAudio = null; // Pour gérer l'audio en cours de lecture

// --- Mise à jour : Liste des parcours avec le type de sport ---
const parcoursList = [
    { id: 'salon_test', name: 'Salon test (Course)', sport: 'running', json: 'parcours/Salon/test.json', gpx: 'parcours/Salon/test.gpx' },
    // Ajoutez d'autres parcours ici avec leur propriété 'sport'
];

// --- Récupération des éléments HTML (ajout de ceux pour la sélection de sport) ---
const sportSelectionSection = document.getElementById('sport-selection');
const parcoursListSection = document.getElementById('parcours-list');
const mapSection = document.getElementById('map-section');
const btnRunning = document.getElementById('btn-running');
const btnHiking = document.getElementById('btn-hiking');


document.addEventListener('DOMContentLoaded', () => {
    // Au chargement, afficher la section de sélection de sport et masquer les autres
    sportSelectionSection.style.display = 'block';
    parcoursListSection.style.display = 'none';
    mapSection.style.display = 'none';

    // Attacher les écouteurs d'événements aux boutons de sport
    btnRunning.addEventListener('click', () => displayParcoursList('running'));
    btnHiking.addEventListener('click', () => displayParcoursList('hiking'));
});


// Fonction pour afficher la liste des parcours filtrée par sport
function displayParcoursList(sportType) {
    parcoursListSection.innerHTML = ''; // Nettoyer la liste existante
    const ul = document.createElement('ul');

    // Filtrer les parcours en fonction du sport sélectionné
    const filteredParcours = parcoursList.filter(parcours => parcours.sport === sportType);

    if (filteredParcours.length === 0) {
        ul.innerHTML = `<li>Aucun parcours de ${sportType === 'running' ? 'course à pied' : 'randonnée'} disponible pour le moment.</li>`;
    } else {
        filteredParcours.forEach(parcours => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = parcours.name;
            link.onclick = (e) => {
                e.preventDefault();
                loadParcours(parcours.id);
            };
            li.appendChild(link);
            ul.appendChild(li);
        });
    }
    parcoursListSection.appendChild(ul);

    // --- Mise à jour : Afficher la liste des parcours et cacher la sélection de sport ---
    sportSelectionSection.style.display = 'none';
    parcoursListSection.style.display = 'block';
}


// Fonction pour charger et afficher un parcours spécifique
async function loadParcours(parcoursId) {
    const selectedParcours = parcoursList.find(p => p.id === parcoursId);

    if (!selectedParcours) {
        console.error('Parcours non trouvé :', parcoursId);
        return;
    }

    // Cacher la liste des parcours et afficher la section carte
    document.getElementById('parcours-list').style.display = 'none';
    document.getElementById('map-section').style.display = 'block';

    // Initialisation de la carte Leaflet
    if (map) {
        map.remove();
    }
    map = L.map('map').setView([48.8566, 2.3522], 13); // Centré sur Paris par défaut

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Charger le fichier GPX
    try {
        const gpxData = await fetch(selectedParcours.gpx).then(response => response.text());
        const gpxLayer = new L.GPX(gpxData, {
            async: true,
            marker_options: {
                startIconUrl: 'https://raw.githubusercontent.com/mpetroff/leaflet-gpx/master/pin-icon-start.png',
                endIconUrl: 'https://raw.githubusercontent.com/mpetroff/leaflet-gpx/master/pin-icon-end.png',
                shadowUrl: 'https://raw.githubusercontent.com/mpetroff/leaflet-gpx/master/pin-shadow.png'
            }
        }).on('loaded', function(e) {
            map.fitBounds(e.target.getBounds()); // Centre la carte sur le parcours GPX
        }).addTo(map);
    } catch (error) {
        console.error('Erreur de chargement du GPX :', error);
        document.getElementById('current-info').textContent = 'Erreur lors du chargement du parcours GPX.';
    }

    // Charger le fichier JSON du parcours (pour les POI et les points de guidage)
    try {
        const parcoursDetails = await fetch(selectedParcours.json).then(response => response.json());
        console.log('Détails du parcours JSON :', parcoursDetails);

        // Ajout des marqueurs pour les Points d'Intérêt
        parcoursDetails.pointsInteret.forEach(poi => {
            L.marker([poi.lat, poi.lng])
                .addTo(map)
                .bindPopup(`<b><span class="math-inline">\{poi\.titre\}</b\><br\></span>{poi.descriptionTextuelle}`);
        });

        // Gérer les boutons de guidage
        document.getElementById('start-guidance-btn').onclick = () => startGuidance(selectedParcours.id, parcoursDetails);
        document.getElementById('stop-guidance-btn').onclick = stopGuidance;
        document.getElementById('start-guidance-btn').style.display = 'inline-block';
        document.getElementById('stop-guidance-btn').style.display = 'none';
        document.getElementById('current-info').textContent = 'Parcours chargé. Prêt à démarrer le guidage.';

    } catch (error) {
        console.error('Erreur de chargement du JSON du parcours :', error);
        document.getElementById('current-info').textContent = 'Erreur lors du chargement des détails du parcours.';
    }
}

// --- Fonctions de Guidage ---

// Démarre le guidage GPS et audio
function startGuidance(parcoursId, parcoursDetails) {
    currentGuidanceId = parcoursId;
    document.getElementById('start-guidance-btn').style.display = 'none';
    document.getElementById('stop-guidance-btn').style.display = 'inline-block';
    document.getElementById('current-info').textContent = 'Guidage démarré. Attente de la position GPS...';

    const geoOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            document.getElementById('current-info').textContent = `Position : Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)} (Précision: ${accuracy.toFixed(0)}m)`;
            checkProximity(latitude, longitude, parcoursDetails);
        },
        (error) => {
            console.error('Erreur de géolocalisation :', error.code, error.message);
            document.getElementById('current-info').textContent = `Erreur GPS : ${error.message}`;
        },
        geoOptions
    );

    console.log('Guidage démarré pour le parcours :', parcoursId);
}

// Arrête le guidage GPS et audio
function stopGuidance() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    currentGuidanceId = null;
    document.getElementById('start-guidance-btn').style.display = 'inline-block';
    document.getElementById('stop-guidance-btn').style.display = 'none';
    document.getElementById('current-info').textContent = 'Guidage arrêté.';
    console.log('Guidage arrêté.');
}

// Fonction pour vérifier la proximité avec les POI et points de guidage
function checkProximity(lat, lng, parcoursDetails) {
    const currentPosition = L.latLng(lat, lng);
    const radius = 50; // Rayon de déclenchement en mètres, à ajuster

    // Vérifier les Points d'Intérêt
    parcoursDetails.pointsInteret.forEach(poi => {
        // Ajouter une propriété `triggered` pour éviter les déclenchements multiples

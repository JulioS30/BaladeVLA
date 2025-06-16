// Déclaration des variables globales
let map;
let currentGuidanceId = null;
let watchId; // Pour stocker l'ID du watcher de géolocalisation
let currentAudio = null; // Pour gérer l'audio en cours de lecture
let lastSportSelected = null; // Pour savoir quel sport était sélectionné avant d'aller à la liste des parcours

// Liste des parcours disponibles (vous ajouterez vos fichiers JSON ici)
const parcoursList = [
    { id: 'salon_test', name: 'Salon test (Course)', sport: 'running', json: 'parcours/Salon/test.json', gpx: 'parcours/Salon/test.gpx' },
    // Ajoutez d'autres parcours ici avec leur propriété 'sport'
];

// Récupération des éléments HTML
const sportSelectionSection = document.getElementById('sport-selection');
const parcoursListSection = document.getElementById('parcours-list');
const mapSection = document.getElementById('map-section');
const btnRunning = document.getElementById('btn-running');
const btnHiking = document.getElementById('btn-hiking');

// Nouveaux boutons de retour
const btnBackToSports = document.getElementById('btn-back-to-sports');
const btnBackToParcours = document.getElementById('btn-back-to-parcours');


document.addEventListener('DOMContentLoaded', () => {
    // Au chargement, afficher la section de sélection de sport et masquer les autres
    showSection(sportSelectionSection);

    // Attacher les écouteurs d'événements aux boutons de sport
    btnRunning.addEventListener('click', () => {
        lastSportSelected = 'running'; // Mémorise le sport sélectionné
        displayParcoursList('running');
    });
    btnHiking.addEventListener('click', () => {
        lastSportSelected = 'hiking'; // Mémorise le sport sélectionné
        displayParcoursList('hiking');
    });

    // Attacher les écouteurs d'événements aux boutons de retour
    btnBackToSports.addEventListener('click', () => {
        showSection(sportSelectionSection); // Retourne à la sélection de sport
    });
    btnBackToParcours.addEventListener('click', () => {
        // Retourne à la liste des parcours du sport précédemment sélectionné
        if (lastSportSelected) {
            displayParcoursList(lastSportSelected);
        } else {
            // Si pour une raison quelconque lastSportSelected n'est pas défini,
            // on pourrait revenir à la sélection de sport par défaut.
            showSection(sportSelectionSection);
        }
    });
});

/**
 * Fonction utilitaire pour afficher une section et cacher les autres.
 * @param {HTMLElement} sectionToShow La section HTML à afficher.
 */
function showSection(sectionToShow) {
    sportSelectionSection.style.display = 'none';
    parcoursListSection.style.display = 'none';
    mapSection.style.display = 'none';
    sectionToShow.style.display = 'block';
}

// Fonction pour afficher la liste des parcours filtrée par sport
function displayParcoursList(sportType) {
    parcoursListSection.innerHTML = `
        <div class="section-controls">
            <button id="btn-back-to-sports" class="back-button">Précédent</button>
            <h2>Nos Parcours pour ${sportType === 'running' ? 'la Course à pied' : 'la Randonnée'}</h2>
        </div>
        <ul id="parcours-items-list"></ul>
    `; // Nettoyer la liste existante et ajouter le bouton de retour dynamiquement

    // Ré-attacher l'écouteur d'événement au bouton de retour (car il est recréé)
    document.getElementById('btn-back-to-sports').addEventListener('click', () => {
        showSection(sportSelectionSection);
    });


    const ul = document.getElementById('parcours-items-list');

    const filteredParcours = parcoursList.filter(parcours => parcours.sport === sportType);

    if (filteredParcours.length === 0) {
        ul.innerHTML = `<li>Aucun parcours de ${sportType === 'running' ? 'course à pied' : 'randonnée'} disponible pour le moment.</li>`;
    } else {
        filteredParcours.forEach(parcours => {
            const li = document.createElement('li');
            li.innerHTML = `
                <h3>${parcours.name}</h3>
                <p><strong>Sport :</strong> ${parcours.sport === 'running' ? 'Course à pied' : 'Randonnée'}</p>
                <button data-gpx="${parcours.gpx}" data-name="${parcours.name}" data-json="${parcours.json}" class="view-map-btn">Voir sur la carte</button>
            `;
            ul.appendChild(li);
        });
    }

    showSection(parcoursListSection); // Affiche la section des parcours

    // Ajouter un gestionnaire d'événements global pour les boutons "Voir sur la carte"
    ul.addEventListener('click', (event) => {
        if (event.target.classList.contains('view-map-btn')) {
            const gpxPath = event.target.getAttribute('data-gpx');
            const parcoursName = event.target.getAttribute('data-name');
            const jsonPath = event.target.getAttribute('data-json');
            loadParcours(parcoursName, gpxPath, jsonPath);
        }
    });
}


// Fonction pour charger et afficher un parcours spécifique
// Adaptons loadParcours pour prendre le nom, gpx et json directement, car displayParcoursList les aura déjà
async function loadParcours(parcoursName, gpxPath, jsonPath) {
    // Arrête le guidage si un guidage précédent était en cours
    stopGuidance();

    // Cacher la liste des parcours et afficher la section carte
    showSection(mapSection);
    document.querySelector('#map-section h2').textContent = `Détail du Parcours : ${parcoursName}`;

    // Initialisation de la carte Leaflet
    if (map) {
        map.remove(); // Supprime l'ancienne carte si elle existe
    }
    map = L.map('map').setView([48.8566, 2.3522], 13); // Centré sur Paris par défaut

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Charger le fichier GPX
    try {
        const gpxData = await fetch(gpxPath).then(response => response.text());
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
        const parcoursDetails = await fetch(jsonPath).then(response => response.json());
        console.log('Détails du parcours JSON :', parcoursDetails);

        // Réinitialiser l'état 'triggered' pour tous les POI et points de guidage
        // Ceci est important pour que les audios se rejouent si on revient sur le même parcours
        parcoursDetails.pointsInteret.forEach(poi => poi.triggered = false);
        parcoursDetails.pointsGuidage.forEach(point => point.triggered = false);

        // Ajout des marqueurs pour les Points d'Intérêt
        parcoursDetails.pointsInteret.forEach(poi => {
            L.marker([poi.lat, poi.lng])
                .addTo(map)
                .bindPopup(`<b>${poi.titre}</b><br>${poi.descriptionTextuelle}`);
        });

        // Gérer les boutons de guidage
        document.getElementById('start-guidance-btn').onclick = () => startGuidance(parcoursName, parcoursDetails);
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
        const poiPosition = L.latLng(poi.lat, poi.lng);
        if (currentPosition.distanceTo(poiPosition) < radius && !poi.triggered) {
            console.log('Proximité POI :', poi.titre);
            poi.triggered = true;
            playAudio(poi.fichierAudio);
            document.getElementById('current-info').textContent = `Point d'intérêt : ${poi.titre}`;
        }
    });

    // Vérifier les Points de Guidage
    parcoursDetails.pointsGuidage.forEach(point => {
        const pointPosition = L.latLng(point.lat, point.lng);
        const triggerRadius = point.rayonDeclenchement || radius; // Utiliser le rayon défini ou le défaut
        if (currentPosition.distanceTo(pointPosition) < triggerRadius && !point.triggered) {
            console.log('Proximité point de guidage :', point.fichierAudio);
            point.triggered = true;
            playAudio(point.fichierAudio);
            document.getElementById('current-info').textContent = `Instruction : ${point.fichierAudio.split('/').pop()}`;
        }
    });
}

// Fonction pour lire un fichier audio
function playAudio(audioPath) {
    if (currentAudio) {
        currentAudio.pause(); // Arrête l'audio précédent s'il y en a un
    }
    currentAudio = new Audio(audioPath);
    currentAudio.play().catch(e => console.error('Erreur de lecture audio :', e));
}

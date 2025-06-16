// Déclaration des variables globales
let map;
let currentGuidanceId = null;
let watchId; // Pour stocker l'ID du watcher de géolocalisation
let currentAudio = null; // Pour gérer l'audio en cours de lecture

// Liste des parcours disponibles (vous ajouterez vos fichiers JSON ici)
// Exemple : une liste simple de chemins vers les JSON de parcours
const parcoursList = [
    { id: 'cretes', name: 'Les Crêtes du Soleil', json: 'parcours/parcours_cretes/cretes.json', gpx: 'parcours/parcours_cretes/cretes.gpx' },
    // Ajoutez d'autres parcours ici au fur et à mesure
    // { id: 'riviere', name: 'Bord de Rivière', json: 'parcours/parcours_riviere/riviere.json', gpx: 'parcours/parcours_riviere/riviere.gpx' },
];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Afficher la liste des parcours
    displayParcoursList();
});

// Fonction pour afficher la liste des parcours
function displayParcoursList() {
    const parcoursListSection = document.getElementById('parcours-list');
    const ul = document.createElement('ul');

    if (parcoursList.length === 0) {
        ul.innerHTML = '<li>Aucun parcours disponible pour le moment.</li>';
    } else {
        parcoursList.forEach(parcours => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = '#'; // Pour éviter le rechargement de la page
            link.textContent = parcours.name;
            link.onclick = (e) => {
                e.preventDefault(); // Empêche le comportement par défaut du lien
                loadParcours(parcours.id); // Charge le parcours sélectionné
            };
            li.appendChild(link);
            ul.appendChild(li);
        });
    }
    parcoursListSection.innerHTML = ''; // Nettoie le message de chargement
    parcoursListSection.appendChild(ul);
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
    // Si la carte existe déjà, on la supprime pour en recréer une nouvelle
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

        // TODO: Ici, vous ajouterez la logique pour afficher les POI sur la carte
        // et préparer les données pour le guidage.
        // Exemple d'ajout d'un marqueur (pour un POI)
        parcoursDetails.pointsInteret.forEach(poi => {
            L.marker([poi.lat, poi.lng])
                .addTo(map)
                .bindPopup(`<b>${poi.titre}</b><br>${poi.descriptionTextuelle}`);
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

// --- Fonctions de Guidage (à développer aux prochaines étapes) ---

// Démarre le guidage GPS et audio
function startGuidance(parcoursId, parcoursDetails) {
    currentGuidanceId = parcoursId;
    document.getElementById('start-guidance-btn').style.display = 'none';
    document.getElementById('stop-guidance-btn').style.display = 'inline-block';
    document.getElementById('current-info').textContent = 'Guidage démarré. Attente de la position GPS...';

    // Options pour la géolocalisation
    const geoOptions = {
        enableHighAccuracy: true, // Demande une précision maximale
        timeout: 10000,           // Délai maximum pour obtenir la position (ms)
        maximumAge: 0             // Ne pas utiliser de position mise en cache
    };

    // Démarre le suivi de la position
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            // Callback en cas de succès de la géolocalisation
            const { latitude, longitude, accuracy } = position.coords;
            document.getElementById('current-info').textContent = `Position : Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)} (Précision: ${accuracy.toFixed(0)}m)`;

            // TODO: Ici, vous ajouterez la logique de déclenchement audio
            // et de détection des POI/points de guidage
            checkProximity(latitude, longitude, parcoursDetails);

        },
        (error) => {
            // Callback en cas d'erreur de géolocalisation
            console.error('Erreur de géolocalisation :', error.code, error.message);
            document.getElementById('current-info').textContent = `Erreur GPS : ${error.message}`;
            // Vous pourriez vouloir arrêter le guidage ici ou réessayer
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
            // Marquer comme déclenché pour éviter de rejouer
            poi.triggered = true; // Ceci ne persistera pas au rechargement de la page, mais est suffisant pour une session.
            playAudio(poi.fichierAudio);
            document.getElementById('current-info').textContent = `Point d'intérêt : ${poi.titre}`;
        }
    });

    // Vérifier les Points de Guidage
    parcoursDetails.pointsGuidage.forEach(point => {
        const pointPosition = L.latLng(point.lat, point.lng);
        // Utiliser le rayon de déclenchement défini dans le JSON ou par défaut
        const triggerRadius = point.rayonDeclenchement || radius;
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
        currentAudio.pause(); // Arrête l'audio précédent si il y en a un
    }
    currentAudio = new Audio(audioPath);
    currentAudio.play().catch(e => console.error('Erreur de lecture audio :', e));
}

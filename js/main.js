// Déclaration des variables globales
let map;
let currentGuidanceId = null;
let watchId; // Pour stocker l'ID du watcher de géolocalisation
let currentAudio = null; // Pour gérer l'audio en cours de lecture
let currentParcoursData = null; // Pour stocker les détails du parcours JSON actuellement chargé
let currentParcoursLayer = null; // Pour stocker la couche GPX Leaflet

// Liste des parcours disponibles (vous pouvez ajouter une propriété 'type' ici)
const parcoursData = [
    {
        id: 'cretes',
        name: 'Les Crêtes du Soleil',
        type: 'randonnee', // ou 'course' pour la course à pied
        description: "Un magnifique parcours offrant des vues panoramiques sur la vallée et les montagnes environnantes.",
        json: 'parcours/parcours_cretes/cretes.json',
        gpx: 'parcours/parcours_cretes/cretes.gpx'
    },
    // Ajoutez d'autres parcours ici au fur et à mesure
    // Exemple pour une course à pied :
    /*
    {
        id: 'parc_urbain',
        name: 'Tour du Parc Urbain',
        type: 'course',
        description: "Un parcours rapide et plat, idéal pour une session de course à pied en ville.",
        json: 'parcours/parcours_urbain/urbain.json',
        gpx: 'parcours/parcours_urbain/urbain.gpx'
    },
    */
    {
        id: 'pinede_st_leon',
        name: 'Pinède Saint-Léon',
        type: 'randonnee',
        description: "Découvrez la magnifique pinède Saint-Léon avec son parcours santé et son accrobranche.",
        json: 'parcours/parcours_pinede/pinede.json', // Nouveau JSON pour la pinède
        gpx: 'parcours/parcours_pinede/pinede.gpx' // Nouveau GPX pour la pinède
    }
];

// Éléments du DOM
const sportSelectionSection = document.getElementById('sport-selection');
const parcoursListSection = document.getElementById('parcours-list');
const mapSection = document.getElementById('map-section');
const parcoursUl = document.getElementById('parcours-ul'); // Nouvel ID pour la liste
const parcoursDetailTitle = document.getElementById('parcours-detail-title');
const parcoursDetailDistance = document.getElementById('parcours-detail-distance');
const parcoursDetailDenivele = document.getElementById('parcours-detail-denivele');
const startGuidanceBtn = document.getElementById('start-guidance-btn');
const stopGuidanceBtn = document.getElementById('stop-guidance-btn');
const currentInfo = document.getElementById('current-info');

document.addEventListener('DOMContentLoaded', () => {
    // Initialiser l'affichage
    showSection('sport-selection');

    // Écouteurs d'événements pour la sélection du sport
    document.getElementById('btn-running').addEventListener('click', () => showParcoursForSport('course'));
    document.getElementById('btn-hiking').addEventListener('click', () => showParcoursForSport('randonnee'));

    // Écouteurs d'événements pour les boutons de retour
    document.getElementById('btn-back-to-sports').addEventListener('click', backToSportsSelection);
    document.getElementById('btn-back-to-parcours').addEventListener('click', backToParcoursList);
});

// Fonction pour afficher une section spécifique et cacher les autres
function showSection(sectionId) {
    sportSelectionSection.style.display = 'none';
    parcoursListSection.style.display = 'none';
    mapSection.style.display = 'none';

    document.getElementById(sectionId).style.display = 'block';
}

// Affiche la liste des parcours pour un sport donné
function showParcoursForSport(sportType) {
    showSection('parcours-list');
    parcoursUl.innerHTML = ''; // Nettoyer la liste précédente

    const filteredParcours = parcoursData.filter(p => p.type === sportType);

    if (filteredParcours.length === 0) {
        parcoursUl.innerHTML = '<li>Aucun parcours disponible pour ce sport pour le moment.</li>';
    } else {
        filteredParcours.forEach(parcours => {
            const li = document.createElement('li');
            li.innerHTML = `
                <h3>${parcours.name}</h3>
                <p>${parcours.description}</p>
                <div class="parcours-info-details">
                    <span>Distance: <b id="distance-${parcours.id}">Chargement...</b></span>
                    <span>Dénivelé: <b id="denivele-${parcours.id}">Chargement...</b></span>
                </div>
                <button data-parcours-id="${parcours.id}">Voir sur la carte</button>
            `;
            li.querySelector('button').addEventListener('click', () => loadParcours(parcours.id));
            parcoursUl.appendChild(li);

            // Tenter de charger les données GPX pour distance/dénivelé
            fetch(parcours.gpx)
                .then(response => response.text())
                .then(gpxData => {
                    // Utiliser une instance temporaire de Leaflet.GPX pour extraire les infos
                    const tempGpxLayer = new L.GPX(gpxData, { async: true });
                    tempGpxLayer.on('loaded', function(e) {
                        const distance = (e.target.get_distance() / 1000).toFixed(2); // Convertir en km
                        const eleGain = e.target.get_elevation_gain().toFixed(0); // Dénivelé positif

                        document.getElementById(`distance-${parcours.id}`).textContent = `${distance} km`;
                        document.getElementById(`denivele-${parcours.id}`).textContent = `+${eleGain} m`;
                    });
                })
                .catch(error => {
                    console.error(`Erreur de chargement GPX pour ${parcours.name}:`, error);
                    document.getElementById(`distance-${parcours.id}`).textContent = `N/A`;
                    document.getElementById(`denivele-${parcours.id}`).textContent = `N/A`;
                });
        });
    }
}

// Fonction de retour à la sélection du sport
function backToSportsSelection() {
    showSection('sport-selection');
    // Nettoyer la carte si elle était active
    if (map) {
        map.remove();
        map = null;
    }
    stopGuidance(); // Arrêter le guidage si actif
}

// Fonction de retour à la liste des parcours
function backToParcoursList() {
    showSection('parcours-list');
    // Nettoyer la carte
    if (map) {
        map.remove();
        map = null;
    }
    stopGuidance(); // Arrêter le guidage si actif
    // Recharger la liste des parcours filtrés (si nécessaire, basé sur le dernier sport sélectionné)
    // Pour l'instant, on suppose qu'on revient à la liste générale ou la dernière chargée.
    // Idéalement, on stockerait le dernier sport choisi.
    // Pour cet exemple simple, la liste des parcours s'affiche telle quelle.
}

// Fonction pour charger et afficher un parcours spécifique sur la carte
async function loadParcours(parcoursId) {
    const selectedParcours = parcoursData.find(p => p.id === parcoursId);

    if (!selectedParcours) {
        console.error('Parcours non trouvé :', parcoursId);
        return;
    }

    // Mettre à jour les titres et infos dans la section carte
    parcoursDetailTitle.textContent = selectedParcours.name;
    parcoursDetailDistance.textContent = 'Chargement...';
    parcoursDetailDenivele.textContent = 'Chargement...';

    showSection('map-section');

    // Initialisation de la carte Leaflet
    if (map) {
        map.remove(); // Supprime l'ancienne carte
    }
    map = L.map('map').setView([48.8566, 2.3522], 13); // Centré sur Paris par défaut

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Charger le fichier GPX
    try {
        currentParcoursLayer = new L.GPX(selectedParcours.gpx, {
            async: true,
            marker_options: {
                startIconUrl: 'https://raw.githubusercontent.com/mpetroff/leaflet-gpx/master/pin-icon-start.png',
                endIconUrl: 'https://raw.githubusercontent.com/mpetroff/leaflet-gpx/master/pin-icon-end.png',
                shadowUrl: 'https://raw.githubusercontent.com/mpetroff/leaflet-gpx/master/pin-shadow.png'
            }
        }).on('loaded', function(e) {
            map.fitBounds(e.target.getBounds()); // Centre la carte sur le parcours GPX
            // Mettre à jour la distance et le dénivelé sur la page de détail du parcours
            const distance = (e.target.get_distance() / 1000).toFixed(2); // Convertir en km
            const eleGain = e.target.get_elevation_gain().toFixed(0); // Dénivelé positif

            parcoursDetailDistance.textContent = `${distance} km`;
            parcoursDetailDenivele.textContent = `+${eleGain} m`;
        }).addTo(map);
    } catch (error) {
        console.error('Erreur de chargement du GPX :', error);
        currentInfo.textContent = 'Erreur lors du chargement du parcours GPX.';
    }

    // Charger le fichier JSON du parcours (pour les POI et les points de guidage)
    try {
        currentParcoursData = await fetch(selectedParcours.json).then(response => response.json());
        console.log('Détails du parcours JSON :', currentParcoursData);

        // Ajouter les marqueurs des Points d'Intérêt
        currentParcoursData.pointsInteret.forEach(poi => {
            L.marker([poi.lat, poi.lng])
                .addTo(map)
                .bindPopup(`<b>${poi.titre}</b><br>${poi.descriptionTextuelle}`);
        });

        // Gérer les boutons de guidage
        startGuidanceBtn.onclick = () => startGuidance(currentParcoursData);
        stopGuidanceBtn.onclick = stopGuidance;
        startGuidanceBtn.style.display = 'inline-block';
        stopGuidanceBtn.style.display = 'none';
        currentInfo.textContent = 'Parcours chargé. Prêt à démarrer le guidage.';

    } catch (error) {
        console.error('Erreur de chargement du JSON du parcours :', error);
        currentInfo.textContent = 'Erreur lors du chargement des détails du parcours.';
    }
}

// --- Fonctions de Guidage ---

// Démarre le guidage GPS et audio
function startGuidance(parcoursDetails) {
    if (!navigator.geolocation) {
        currentInfo.textContent = 'La géolocalisation n\'est pas supportée par votre navigateur.';
        return;
    }

    document.getElementById('start-guidance-btn').style.display = 'none';
    document.getElementById('stop-guidance-btn').style.display = 'inline-block';
    currentInfo.textContent = 'Guidage démarré. Attente de la position GPS...';

    // Options pour la géolocalisation
    const geoOptions = {
        enableHighAccuracy: true, // Demande une précision maximale
        timeout: 15000,           // Délai maximum pour obtenir la position (ms)
        maximumAge: 0             // Ne pas utiliser de position mise en cache
    };

    // Démarre le suivi de la position
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            currentInfo.textContent = `Position : Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)} (Précision: ${accuracy.toFixed(0)}m)`;

            // Centrer la carte sur la position de l'utilisateur
            map.setView([latitude, longitude], map.getZoom() > 15 ? map.getZoom() : 16);

            // TODO: Ajouter un marqueur pour la position de l'utilisateur si souhaité
            // Exemple : L.circleMarker([latitude, longitude], {radius: 5, color: 'blue', fillColor: '#00F', fillOpacity: 0.5}).addTo(map);

            checkProximity(latitude, longitude, parcoursDetails);

        },
        (error) => {
            console.error('Erreur de géolocalisation :', error.code, error.message);
            currentInfo.textContent = `Erreur GPS : ${error.message}. Vérifiez les permissions.`;
            // Vous pourriez vouloir arrêter le guidage ici ou réessayer
        },
        geoOptions
    );

    console.log('Guidage démarré.');
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
    startGuidanceBtn.style.display = 'inline-block';
    stopGuidanceBtn.style.display = 'none';
    currentInfo.textContent = 'Guidage arrêté.';
    console.log('Guidage arrêté.');
}

// Fonction pour vérifier la proximité avec les POI et points de guidage
function checkProximity(lat, lng, parcoursDetails) {
    const currentPosition = L.latLng(lat, lng);
    const defaultRadius = 50; // Rayon de déclenchement par défaut en mètres

    // Vérifier les Points d'Intérêt
    parcoursDetails.pointsInteret.forEach(poi => {
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
    parcoursDetails.pointsGuidage.forEach(point => {
        const pointPosition = L.latLng(point.lat, point.lng);
        const triggerRadius = point.rayonDeclenchement || defaultRadius; // Utilise le rayon du point ou le défaut

        if (currentPosition.distanceTo(pointPosition) < triggerRadius && !point.triggered) {
            console.log('Proximité point de guidage :', point.fichierAudio);
            point.triggered = true;
            playAudio(point.fichierAudio);
            currentInfo.textContent = `Instruction : ${point.fichierAudio.split('/').pop().replace('.mp3', '')}`; // Affiche le nom du fichier sans .mp3
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
    currentAudio.play().catch(e => console.error('Erreur de lecture audio :', e));
}

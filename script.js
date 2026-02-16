// ============================================
// CONFIGURATION FIREBASE
// ============================================
// Remplacez ces valeurs par votre propre configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDipuuiSxil2tIkWnEhsl0t5sNjMdjWias",
  authDomain: "coordination-generale.firebaseapp.com",
  projectId: "coordination-generale",
  storageBucket: "coordination-generale.firebasestorage.app",
};

// Initialiser Firebase
let app, db;

// Structure de données pour stocker les fichiers et dossiers
let fileSystem = {
    folders: {},
    files: {}
};

let currentPath = [];

// ============================================
// INITIALISATION FIREBASE
// ============================================
async function initFirebase() {
    try {
        // Initialiser Firebase
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();

        await loadDataFromFirebase();
        setupRealtimeSync();
    } catch (error) {
        console.error('Erreur d\'initialisation Firebase:', error);
        alert('Erreur de configuration Firebase. Vérifiez votre configuration.');
    }
}

// ============================================
// SYNCHRONISATION FIREBASE
// ============================================
async function loadDataFromFirebase() {
    try {
        const doc = await db.collection('shared').doc('coordination-generale').get();
        if (doc.exists) {
            fileSystem = doc.data().fileSystem || { folders: {}, files: {} };
        } else {
            fileSystem = { folders: {}, files: {} };
            await saveDataToFirebase();
        }
        renderFileSystem();
        updateBreadcrumb();
    } catch (error) {
        console.error('Erreur de chargement:', error);
        alert('Erreur lors du chargement des données');
    }
}

async function saveDataToFirebase() {
    try {
        await db.collection('shared').doc('coordination-generale').set({
            fileSystem: fileSystem,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Erreur de sauvegarde:', error);
        alert('Erreur lors de la sauvegarde des données');
    }
}

function setupRealtimeSync() {
    // Écouter les changements en temps réel
    db.collection('shared').doc('coordination-generale').onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            // Éviter de mettre à jour si c'est notre propre changement
            if (JSON.stringify(fileSystem) !== JSON.stringify(data.fileSystem)) {
                fileSystem = data.fileSystem || { folders: {}, files: {} };
                renderFileSystem();
                updateBreadcrumb();
            }
        }
    });
}

// ============================================
// GESTION DES DOSSIERS ET FICHIERS
// ============================================
function getCurrentFolder() {
    let folder = fileSystem;
    for (let dir of currentPath) {
        folder = folder.folders[dir];
    }
    return folder;
}

function openCreateFolderModal() {
    document.getElementById('createFolderModal').classList.add('active');
    document.getElementById('folderName').value = '';
    document.getElementById('folderName').focus();
}

function closeCreateFolderModal() {
    document.getElementById('createFolderModal').classList.remove('active');
}

async function createFolder() {
    const folderName = document.getElementById('folderName').value.trim();
    if (!folderName) {
        alert('Veuillez entrer un nom de dossier');
        return;
    }

    const currentFolder = getCurrentFolder();
    
    if (currentFolder.folders[folderName]) {
        alert('Un dossier avec ce nom existe déjà');
        return;
    }

    currentFolder.folders[folderName] = {
        folders: {},
        files: {},
        createdAt: new Date().toISOString()
    };

    await saveDataToFirebase();
    closeCreateFolderModal();
    renderFileSystem();
}

async function handleFileUpload(event) {
    const files = event.target.files;
    const currentFolder = getCurrentFolder();

    for (let file of files) {
        // Limiter la taille des fichiers (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert(`Le fichier "${file.name}" est trop volumineux (max 5MB)`);
            continue;
        }

        const reader = new FileReader();
        reader.onload = async function(e) {
            currentFolder.files[file.name] = {
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target.result,
                uploadedAt: new Date().toISOString()
            };
            await saveDataToFirebase();
            renderFileSystem();
        };
        reader.readAsDataURL(file);
    }

    event.target.value = '';
}

function navigateToPath(path) {
    currentPath = path;
    renderFileSystem();
    updateBreadcrumb();
}

function openFolder(folderName) {
    currentPath.push(folderName);
    renderFileSystem();
    updateBreadcrumb();
}

function downloadFile(fileName) {
    const currentFolder = getCurrentFolder();
    const file = currentFolder.files[fileName];

    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    link.click();
}

async function deleteFolder(folderName) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le dossier "${folderName}" et tout son contenu ?`)) {
        return;
    }

    const currentFolder = getCurrentFolder();
    delete currentFolder.folders[folderName];
    await saveDataToFirebase();
    renderFileSystem();
}

async function deleteFile(fileName) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le fichier "${fileName}" ?`)) {
        return;
    }

    const currentFolder = getCurrentFolder();
    delete currentFolder.files[fileName];
    await saveDataToFirebase();
    renderFileSystem();
}

// ============================================
// INTERFACE UTILISATEUR
// ============================================
function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '<span class="breadcrumb-item" onclick="navigateToPath([])">🏠 Accueil</span>';

    let path = [];
    for (let i = 0; i < currentPath.length; i++) {
        const dir = currentPath[i];
        path.push(dir);
        const pathCopy = [...path];
        breadcrumb.innerHTML += `
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item" onclick="navigateToPath(${JSON.stringify(pathCopy).replace(/"/g, '&quot;')})">${dir}</span>
        `;
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getFileIcon(type) {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
    if (type.includes('image')) return '🖼️';
    if (type.includes('video')) return '🎥';
    if (type.includes('audio')) return '🎵';
    if (type.includes('zip') || type.includes('rar')) return '🗜️';
    return '📎';
}

function renderFileSystem() {
    const currentFolder = getCurrentFolder();
    const fileGrid = document.getElementById('fileGrid');
    const emptyState = document.getElementById('emptyState');

    fileGrid.innerHTML = '';

    const folderNames = Object.keys(currentFolder.folders).sort();
    const fileNames = Object.keys(currentFolder.files).sort();

    if (folderNames.length === 0 && fileNames.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Afficher les dossiers
    folderNames.forEach(folderName => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-item';
        folderDiv.innerHTML = `
            <button class="delete-btn" onclick="event.stopPropagation(); deleteFolder('${folderName}')">✕</button>
            <div class="icon">📁</div>
            <div class="item-name">${folderName}</div>
            <div class="item-info">Dossier</div>
        `;
        folderDiv.onclick = () => openFolder(folderName);
        fileGrid.appendChild(folderDiv);
    });

    // Afficher les fichiers
    fileNames.forEach(fileName => {
        const file = currentFolder.files[fileName];
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.innerHTML = `
            <button class="delete-btn" onclick="event.stopPropagation(); deleteFile('${fileName}')">✕</button>
            <div class="icon">${getFileIcon(file.type)}</div>
            <div class="item-name">${file.name}</div>
            <div class="item-info">${formatFileSize(file.size)}</div>
        `;
        fileDiv.onclick = () => downloadFile(fileName);
        fileGrid.appendChild(fileDiv);
    });
}

// ============================================
// DRAG AND DROP
// ============================================
const uploadArea = document.getElementById('uploadArea');

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    const event = { target: { files: files } };
    handleFileUpload(event);
});

// ============================================
// GESTION DES MODALS
// ============================================
document.getElementById('createFolderModal').addEventListener('click', (e) => {
    if (e.target.id === 'createFolderModal') {
        closeCreateFolderModal();
    }
});

document.getElementById('folderName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        createFolder();
    }
});

// ============================================
// INITIALISATION
// ============================================
window.addEventListener('load', () => {
    initFirebase();
});

// Structure de données pour stocker les fichiers et dossiers
let fileSystem = {
    folders: {},
    files: {}
};

let currentPath = [];

// Charger les données depuis localStorage
function loadData() {
    const saved = localStorage.getItem('meylanHandballDocs');
    if (saved) {
        fileSystem = JSON.parse(saved);
    }
}

// Sauvegarder les données dans localStorage
function saveData() {
    localStorage.setItem('meylanHandballDocs', JSON.stringify(fileSystem));
}

// Obtenir le dossier courant
function getCurrentFolder() {
    let folder = fileSystem;
    for (let dir of currentPath) {
        folder = folder.folders[dir];
    }
    return folder;
}

// Ouvrir le modal de création de dossier
function openCreateFolderModal() {
    document.getElementById('createFolderModal').classList.add('active');
    document.getElementById('folderName').value = '';
    document.getElementById('folderName').focus();
}

// Fermer le modal de création de dossier
function closeCreateFolderModal() {
    document.getElementById('createFolderModal').classList.remove('active');
}

// Créer un nouveau dossier
function createFolder() {
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

    saveData();
    closeCreateFolderModal();
    renderFileSystem();
}

// Gérer l'upload de fichiers
function handleFileUpload(event) {
    const files = event.target.files;
    const currentFolder = getCurrentFolder();

    for (let file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentFolder.files[file.name] = {
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target.result,
                uploadedAt: new Date().toISOString()
            };
            saveData();
            renderFileSystem();
        };
        reader.readAsDataURL(file);
    }

    event.target.value = '';
}

// Naviguer vers un chemin
function navigateToPath(path) {
    currentPath = path;
    renderFileSystem();
    updateBreadcrumb();
}

// Ouvrir un dossier
function openFolder(folderName) {
    currentPath.push(folderName);
    renderFileSystem();
    updateBreadcrumb();
}

// Télécharger un fichier
function downloadFile(fileName) {
    const currentFolder = getCurrentFolder();
    const file = currentFolder.files[fileName];

    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    link.click();
}

// Supprimer un dossier
function deleteFolder(folderName) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le dossier "${folderName}" et tout son contenu ?`)) {
        return;
    }

    const currentFolder = getCurrentFolder();
    delete currentFolder.folders[folderName];
    saveData();
    renderFileSystem();
}

// Supprimer un fichier
function deleteFile(fileName) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le fichier "${fileName}" ?`)) {
        return;
    }

    const currentFolder = getCurrentFolder();
    delete currentFolder.files[fileName];
    saveData();
    renderFileSystem();
}

// Mettre à jour le fil d'Ariane
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

// Formater la taille du fichier
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Obtenir l'icône du fichier
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

// Rendre le système de fichiers
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

// Drag and drop
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

// Gestion du clic en dehors du modal
document.getElementById('createFolderModal').addEventListener('click', (e) => {
    if (e.target.id === 'createFolderModal') {
        closeCreateFolderModal();
    }
});

// Gestion de la touche Enter dans le champ du nom de dossier
document.getElementById('folderName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        createFolder();
    }
});

// Initialisation au chargement de la page
loadData();
renderFileSystem();
updateBreadcrumb();

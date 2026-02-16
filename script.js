/* ============================
   CONFIG FIREBASE
============================ */
const db = firebase.firestore();
const storage = firebase.storage();

/* ============================
   ÉTAT GLOBAL
============================ */
let currentPath = [];

/* ============================
   MODAL DOSSIER
============================ */
function openCreateFolderModal() {
    document.getElementById('createFolderModal').classList.add('active');
    document.getElementById('folderName').value = '';
    document.getElementById('folderName').focus();
}

function closeCreateFolderModal() {
    document.getElementById('createFolderModal').classList.remove('active');
}

/* ============================
   DOSSIERS (Firestore)
============================ */
async function createFolder() {
    const folderName = document.getElementById('folderName').value.trim();
    if (!folderName) {
        alert('Veuillez entrer un nom de dossier');
        return;
    }

    const path = currentPath.join('/');

    const existing = await db.collection('folders')
        .where('path', '==', path)
        .where('name', '==', folderName)
        .get();

    if (!existing.empty) {
        alert('Un dossier avec ce nom existe déjà');
        return;
    }

    await db.collection('folders').add({
        name: folderName,
        path: path,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closeCreateFolderModal();
    renderFileSystem();
}

/* ============================
   UPLOAD FICHIERS (Storage)
============================ */
async function handleFileUpload(event) {
    const files = event.target.files;
    const folderPath = currentPath.join('/');

    for (let file of files) {
        const ref = storage.ref(`${folderPath}/${file.name}`);
        await ref.put(file);

        await db.collection('files').add({
            name: file.name,
            path: folderPath,
            size: file.size,
            type: file.type,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    event.target.value = '';
    renderFileSystem();
}

/* ============================
   NAVIGATION
============================ */
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

/* ============================
   SUPPRESSION
============================ */
async function deleteFolder(folderName) {
    if (!confirm(`Supprimer le dossier "${folderName}" et son contenu ?`)) return;

    const path = currentPath.join('/');

    const folders = await db.collection('folders')
        .where('path', '==', path)
        .where('name', '==', folderName)
        .get();

    folders.forEach(doc => doc.ref.delete());

    renderFileSystem();
}

async function deleteFile(fileName) {
    if (!confirm(`Supprimer le fichier "${fileName}" ?`)) return;

    const path = currentPath.join('/');

    const files = await db.collection('files')
        .where('path', '==', path)
        .where('name', '==', fileName)
        .get();

    files.forEach(async doc => {
        await storage.ref(`${path}/${fileName}`).delete();
        await doc.ref.delete();
    });

    renderFileSystem();
}

/* ============================
   AFFICHAGE
============================ */
async function renderFileSystem() {
    const fileGrid = document.getElementById('fileGrid');
    const emptyState = document.getElementById('emptyState');
    fileGrid.innerHTML = '';

    const path = currentPath.join('/');

    const foldersSnap = await db.collection('folders')
        .where('path', '==', path)
        .get();

    const filesSnap = await db.collection('files')
        .where('path', '==', path)
        .get();

    if (foldersSnap.empty && filesSnap.empty) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    foldersSnap.forEach(doc => {
        const f = doc.data();
        const div = document.createElement('div');
        div.className = 'folder-item';
        div.innerHTML = `
            <button class="delete-btn" onclick="event.stopPropagation(); deleteFolder('${f.name}')">✕</button>
            <div class="icon">📁</div>
            <div class="item-name">${f.name}</div>
            <div class="item-info">Dossier</div>
        `;
        div.onclick = () => openFolder(f.name);
        fileGrid.appendChild(div);
    });

    filesSnap.forEach(doc => {
        const f = doc.data();
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <button class="delete-btn" onclick="event.stopPropagation(); deleteFile('${f.name}')">✕</button>
            <div class="icon">${getFileIcon(f.type)}</div>
            <div class="item-name">${f.name}</div>
            <div class="item-info">${formatFileSize(f.size)}</div>
        `;
        div.onclick = async () => {
            const url = await storage.ref(`${path}/${f.name}`).getDownloadURL();
            window.open(url, '_blank');
        };
        fileGrid.appendChild(div);
    });
}

/* ============================
   BREADCRUMB
============================ */
function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = `<span class="breadcrumb-item" onclick="navigateToPath([])">🏠 Accueil</span>`;

    let path = [];
    currentPath.forEach(dir => {
        path.push(dir);
        breadcrumb.innerHTML += `
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item" onclick='navigateToPath(${JSON.stringify(path)})'>${dir}</span>
        `;
    });
}

/* ============================
   UTILITAIRES
============================ */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getFileIcon(type) {
    if (!type) return '📎';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('excel')) return '📊';
    if (type.includes('presentation')) return '📽️';
    if (type.includes('image')) return '🖼️';
    if (type.includes('video')) return '🎥';
    if (type.includes('audio')) return '🎵';
    if (type.includes('zip')) return '🗜️';
    return '📎';
}

/* ============================
   DRAG & DROP
============================ */
const uploadArea = document.getElementById('uploadArea');

uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFileUpload({ target: { files: e.dataTransfer.files } });
});

/* ============================
   INIT
============================ */
renderFileSystem();
updateBreadcrumb();

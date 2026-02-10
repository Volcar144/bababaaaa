// API Configuration
const API_BASE_URL = 'https://www.dnd5eapi.co/api';

// In-memory API cache for performance
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for memory cache
const DB_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for IndexedDB cache

// IndexedDB for better caching
let db;
const DB_NAME = 'dnd-lookup-db';
const DB_VERSION = 1;

// State management
let currentCategory = 'spells';
let allResults = [];
let favorites = [];
let compareList = [];
let currentFilters = {};
let isOffline = !navigator.onLine;
let deferredPrompt = null;
let recentItems = [];
let pinnedItems = [];
let diceHistory = [];
let spellSlots = {};
let initiativeList = [];
let currentTurn = 0;
let currentTheme = 'default';
let soundEnabled = false;

// Party Mode state
let peer = null;
let connections = [];
let isHost = false;
let roomId = null;

// QoL features state
let bookmarks = [];
let searchHistory = [];
let diceBox = null;
let enable3DDice = false;

// Utility function to escape HTML and prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load favorites safely
try {
    favorites = JSON.parse(localStorage.getItem('dnd-favorites')) || [];
} catch (error) {
    console.error('Failed to load favorites:', error);
    favorites = [];
}

// Load recent items
try {
    recentItems = JSON.parse(localStorage.getItem('dnd-recent')) || [];
} catch (error) {
    console.error('Failed to load recent items:', error);
    recentItems = [];
}

// Load pinned items
try {
    pinnedItems = JSON.parse(localStorage.getItem('dnd-pinned')) || [];
} catch (error) {
    console.error('Failed to load pinned items:', error);
    pinnedItems = [];
}

// Load dice history
try {
    diceHistory = JSON.parse(localStorage.getItem('dnd-dice-history')) || [];
} catch (error) {
    console.error('Failed to load dice history:', error);
    diceHistory = [];
}

// Load spell slots
try {
    spellSlots = JSON.parse(localStorage.getItem('dnd-spell-slots')) || {};
} catch (error) {
    console.error('Failed to load spell slots:', error);
    spellSlots = {};
}

// Load initiative list
try {
    initiativeList = JSON.parse(localStorage.getItem('dnd-initiative')) || [];
} catch (error) {
    console.error('Failed to load initiative list:', error);
    initiativeList = [];
}

// Load theme preference
try {
    currentTheme = localStorage.getItem('dnd-theme') || 'default';
} catch (error) {
    console.error('Failed to load theme:', error);
    currentTheme = 'default';
}

// Load sound preference
try {
    soundEnabled = localStorage.getItem('dnd-sound') === 'true';
} catch (error) {
    console.error('Failed to load sound preference:', error);
    soundEnabled = false;
}

// Load bookmarks
try {
    bookmarks = JSON.parse(localStorage.getItem('dnd-bookmarks')) || [];
} catch (error) {
    console.error('Failed to load bookmarks:', error);
    bookmarks = [];
}

// Load search history
try {
    searchHistory = JSON.parse(localStorage.getItem('dnd-search-history')) || [];
} catch (error) {
    console.error('Failed to load search history:', error);
    searchHistory = [];
}

// Load 3D dice preference
try {
    enable3DDice = localStorage.getItem('dnd-3d-dice') === 'true';
} catch (error) {
    console.error('Failed to load 3D dice preference:', error);
    enable3DDice = false;
}

// Initialize IndexedDB for better caching
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains('apiCache')) {
                const store = db.createObjectStore('apiCache', { keyPath: 'endpoint' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('searchHistory')) {
                db.createObjectStore('searchHistory', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Initialize DB on load
initIndexedDB().catch(console.error);

// Register Service Worker for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const randomBtn = document.getElementById('randomBtn');
const resultsContainer = document.getElementById('results');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const modal = document.getElementById('detailModal');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.querySelector('.close-btn');
const categoryBtns = document.querySelectorAll('.category-btn');
const darkModeToggle = document.getElementById('darkModeToggle');
const favoritesBtn = document.getElementById('favoritesBtn');
const compareBtn = document.getElementById('compareBtn');
const favCount = document.getElementById('favCount');
const compareCount = document.getElementById('compareCount');
const filterSection = document.getElementById('filterSection');
const compareModal = document.getElementById('compareModal');
const compareBody = document.getElementById('compareBody');
const closeCompare = document.getElementById('closeCompare');
const favoritesModal = document.getElementById('favoritesModal');
const favoritesBody = document.getElementById('favoritesBody');
const closeFavorites = document.getElementById('closeFavorites');
const offlineIndicator = document.getElementById('offlineIndicator');
const installBtn = document.getElementById('installBtn');

// New tool elements
const diceRollerBtn = document.getElementById('diceRollerBtn');
const diceRollerModal = document.getElementById('diceRollerModal');
const closeDiceRoller = document.getElementById('closeDiceRoller');
const spellSlotsBtn = document.getElementById('spellSlotsBtn');
const spellSlotsModal = document.getElementById('spellSlotsModal');
const closeSpellSlots = document.getElementById('closeSpellSlots');
const initiativeBtn = document.getElementById('initiativeBtn');
const initiativeModal = document.getElementById('initiativeModal');
const closeInitiative = document.getElementById('closeInitiative');

// Party Mode elements
const partyModeBtn = document.getElementById('partyModeBtn');
const partyModeModal = document.getElementById('partyModeModal');
const closePartyMode = document.getElementById('closePartyMode');
const hostPartyBtn = document.getElementById('hostParty');
const joinPartyBtn = document.getElementById('joinParty');
const disconnectHostBtn = document.getElementById('disconnectHost');

// Quick Reference elements
const floatingQuickRef = document.getElementById('floatingQuickRef');
const quickRefModal = document.getElementById('quickRefModal');
const closeQuickRef = document.getElementById('closeQuickRef');

// Theme selector
const themeSelector = document.getElementById('themeSelector');

// QoL elements
const bookmarksBtn = document.getElementById('bookmarksBtn');
const bookmarksModal = document.getElementById('bookmarksModal');
const closeBookmarks = document.getElementById('closeBookmarks');
const bookmarkCount = document.getElementById('bookmarkCount');
const searchHistoryBtn = document.getElementById('searchHistoryBtn');
const searchHistoryPanel = document.getElementById('searchHistoryPanel');
const enable3DDiceCheckbox = document.getElementById('enable3DDice');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check for deep link parameters
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const itemId = urlParams.get('item');
    
    if (category && itemId) {
        // Deep link to specific item
        currentCategory = category;
        loadCategory(category).then(() => {
            loadDetails(itemId);
        });
    } else if (category) {
        // Deep link to category
        currentCategory = category;
        loadCategory(category);
    } else {
        loadCategory(currentCategory);
    }
    
    updateFavoritesCount();
    loadDarkMode();
    updateOfflineStatus();
    updateQuickAccess();
    
    // Add event listeners to quick reference cards
    document.querySelectorAll('.ref-card').forEach(card => {
        const refType = card.getAttribute('data-ref-type');
        if (refType) {
            card.addEventListener('click', () => showRefDetail(refType));
            card.style.cursor = 'pointer';
        }
    });
});

// Offline/Online detection
window.addEventListener('online', () => {
    isOffline = false;
    updateOfflineStatus();
    showNotification('You are back online!', 'info');
});

window.addEventListener('offline', () => {
    isOffline = true;
    updateOfflineStatus();
    showNotification('You are offline. Cached content will be available.', 'warning');
});

// PWA Install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        showNotification('App installed successfully!', 'info');
    }
    
    deferredPrompt = null;
    installBtn.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
    showNotification('D&D Lookup Tool installed! You can now use it offline.', 'info');
    installBtn.classList.add('hidden');
});

categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        searchInput.value = '';
        compareList = [];
        updateCompareCount();
        loadCategory(currentCategory);
    });
});

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

// Debounced search for better performance
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 300);
});

randomBtn.addEventListener('click', getRandomItem);

closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

darkModeToggle.addEventListener('click', toggleDarkMode);
favoritesBtn.addEventListener('click', showFavorites);
compareBtn.addEventListener('click', showCompare);

// Favorites modal export/import buttons
document.getElementById('exportFavoritesPDFBtn')?.addEventListener('click', exportFavoritesPDF);
document.getElementById('exportFavoritesJSONBtn')?.addEventListener('click', exportFavoritesJSON);
document.getElementById('importFavoritesJSONBtn')?.addEventListener('click', importFavoritesJSON);

closeCompare.addEventListener('click', () => {
    compareModal.classList.add('hidden');
});

closeFavorites.addEventListener('click', () => {
    favoritesModal.classList.add('hidden');
});

compareModal.addEventListener('click', (e) => {
    if (e.target === compareModal) {
        compareModal.classList.add('hidden');
    }
});

favoritesModal.addEventListener('click', (e) => {
    if (e.target === favoritesModal) {
        favoritesModal.classList.add('hidden');
    }
});

// API Functions - Enhanced with in-memory caching
async function fetchFromAPI(endpoint) {
    // Check in-memory cache first
    const cacheKey = endpoint;
    const cached = apiCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        console.log('Using cached data for', endpoint);
        return cached.data;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            // Check if we're offline and service worker provided cached data
            if (response.status === 503 && isOffline) {
                throw new Error('Offline - no cached data');
            }
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        
        // Store in memory cache
        apiCache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        // If we have expired cache, use it as fallback
        if (cached) {
            console.log('Using expired cache as fallback');
            return cached.data;
        }
        // If offline and error, try to use cached data via service worker
        if (isOffline) {
            throw new Error('Offline mode - unable to fetch data. Try loading categories you\'ve visited before.');
        }
        throw error;
    }
}

async function loadCategory(category) {
    showLoading();
    hideError();
    resultsContainer.innerHTML = '';
    updateFilters();

    try {
        const data = await fetchFromAPI(`/${category}`);
        allResults = data.results || [];
        displayResults(allResults);
    } catch (error) {
        showError(`Failed to load ${category}. Please try again.`);
    } finally {
        hideLoading();
    }
}

function performSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        displayResults(allResults);
        return;
    }

    const filtered = allResults.filter(item => 
        item.name.toLowerCase().includes(searchTerm)
    );

    displayResults(filtered);
}

function displayResults(results) {
    resultsContainer.innerHTML = '';

    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--accent);">
                <h3>No results found</h3>
                <p>Try adjusting your search or select a different category</p>
            </div>
        `;
        return;
    }

    results.forEach(item => {
        const card = createResultCard(item);
        resultsContainer.appendChild(card);
    });
}

function createResultCard(item) {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    const icon = getCategoryIcon(currentCategory);
    const isFavorited = favorites.some(fav => fav.index === item.index && fav.category === currentCategory);
    const isSelected = compareList.some(comp => comp.index === item.index);
    
    if (isSelected) {
        card.classList.add('selected');
    }
    
    card.innerHTML = `
        <div class="card-actions">
            <button class="card-action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                    data-index="${escapeHtml(item.index)}" 
                    title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
                ${isFavorited ? '⭐' : '☆'}
            </button>
            <button class="card-action-btn compare-btn" 
                    data-index="${escapeHtml(item.index)}" 
                    title="${isSelected ? 'Remove from compare' : 'Add to compare'}">
                ${isSelected ? '✓' : '🔄'}
            </button>
        </div>
        <h3>${icon} ${escapeHtml(item.name)}</h3>
        <span class="badge">${escapeHtml(currentCategory)}</span>
        <p class="description">Click to view details</p>
    `;

    card.addEventListener('click', (e) => {
        if (!e.target.closest('.card-actions')) {
            loadDetails(item.index);
        }
    });
    
    const favoriteBtn = card.querySelector('.favorite-btn');
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(item);
    });
    
    const compareBtn = card.querySelector('.compare-btn');
    compareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCompare(item);
    });

    return card;
}

function getCategoryIcon(category) {
    const icons = {
        'spells': '✨',
        'monsters': '👹',
        'classes': '⚔️',
        'equipment': '🛡️',
        'magic-items': '💎',
        'races': '👤',
        'features': '🎯',
        'traits': '⭐'
    };
    return icons[category] || '📜';
}

async function loadDetails(index) {
    showLoading();
    modal.classList.remove('hidden');
    modalBody.innerHTML = '<p style="text-align: center; padding: 40px;">Loading details...</p>';

    try {
        const data = await fetchFromAPI(`/${currentCategory}/${index}`);
        
        // Add to recent items
        addToRecent({
            index: index,
            name: data.name,
            category: currentCategory,
            timestamp: Date.now()
        });
        
        displayDetails(data);
    } catch (error) {
        modalBody.innerHTML = '<p style="text-align: center; padding: 40px; color: #c62828;">Failed to load details. Please try again.</p>';
    } finally {
        hideLoading();
    }
}

function displayDetails(data) {
    // Generate share link
    const shareUrl = `${window.location.origin}${window.location.pathname}?category=${currentCategory}&item=${data.index}`;
    
    let content = `
        <h2>${getCategoryIcon(currentCategory)} ${escapeHtml(data.name)}</h2>
        <div id="detailActions" style="margin: 10px 0; display: flex; gap: 10px; flex-wrap: wrap;">
        </div>
    `;

    // Display based on category
    switch(currentCategory) {
        case 'spells':
            content += displaySpellDetails(data);
            break;
        case 'monsters':
            content += displayMonsterDetails(data);
            break;
        case 'classes':
            content += displayClassDetails(data);
            break;
        case 'equipment':
            content += displayEquipmentDetails(data);
            break;
        case 'magic-items':
            content += displayMagicItemDetails(data);
            break;
        case 'races':
            content += displayRaceDetails(data);
            break;
        default:
            content += displayGenericDetails(data);
    }

    modalBody.innerHTML = content;
    
    // Add action buttons with proper event listeners
    const actionsDiv = document.getElementById('detailActions');
    
    // Share link button
    const shareLinkBtn = document.createElement('button');
    shareLinkBtn.textContent = '🔗 Copy Share Link';
    shareLinkBtn.style.cssText = "padding: 8px 16px; background: linear-gradient(135deg, var(--accent) 0%, #a0552f 100%); color: var(--parchment); border: 2px solid var(--gold); border-radius: 8px; cursor: pointer; font-weight: bold;";
    shareLinkBtn.setAttribute('aria-label', 'Copy share link');
    shareLinkBtn.addEventListener('click', () => copyShareLink(shareUrl));
    actionsDiv.appendChild(shareLinkBtn);
    
    // Pin button
    const pinBtn = document.createElement('button');
    const pinned = isPinned(data.index);
    pinBtn.textContent = pinned ? '📍 Unpin' : '📌 Pin';
    pinBtn.style.cssText = "padding: 8px 16px; background: linear-gradient(135deg, var(--accent) 0%, #a0552f 100%); color: var(--parchment); border: 2px solid var(--gold); border-radius: 8px; cursor: pointer; font-weight: bold;";
    pinBtn.setAttribute('aria-label', pinned ? 'Unpin item' : 'Pin item');
    pinBtn.addEventListener('click', () => {
        togglePin(data.index, data.name, currentCategory);
        // Update button text after toggle
        pinBtn.textContent = isPinned(data.index) ? '📍 Unpin' : '📌 Pin';
    });
    actionsDiv.appendChild(pinBtn);
}

function displaySpellDetails(spell) {
    let html = '<div class="stat-block">';
    
    if (spell.level !== undefined) {
        html += `<div class="stat-row"><span class="stat-label">Level:</span><span>${spell.level === 0 ? 'Cantrip' : spell.level}</span></div>`;
    }
    if (spell.school) {
        html += `<div class="stat-row"><span class="stat-label">School:</span><span>${spell.school.name}</span></div>`;
    }
    if (spell.casting_time) {
        html += `<div class="stat-row"><span class="stat-label">Casting Time:</span><span>${spell.casting_time}</span></div>`;
    }
    if (spell.range) {
        html += `<div class="stat-row"><span class="stat-label">Range:</span><span>${spell.range}</span></div>`;
    }
    if (spell.components) {
        html += `<div class="stat-row"><span class="stat-label">Components:</span><span>${spell.components.join(', ')}</span></div>`;
    }
    if (spell.duration) {
        html += `<div class="stat-row"><span class="stat-label">Duration:</span><span>${spell.duration}</span></div>`;
    }
    if (spell.concentration) {
        html += `<div class="stat-row"><span class="stat-label">Concentration:</span><span>${spell.concentration ? 'Yes' : 'No'}</span></div>`;
    }
    if (spell.ritual) {
        html += `<div class="stat-row"><span class="stat-label">Ritual:</span><span>${spell.ritual ? 'Yes' : 'No'}</span></div>`;
    }
    
    html += '</div>';

    if (spell.desc) {
        html += '<h3>Description</h3>';
        spell.desc.forEach(para => {
            html += `<p>${para}</p>`;
        });
    }

    if (spell.higher_level && spell.higher_level.length > 0) {
        html += '<h3>At Higher Levels</h3>';
        spell.higher_level.forEach(para => {
            html += `<p>${para}</p>`;
        });
    }

    if (spell.classes && spell.classes.length > 0) {
        html += '<h3>Available to Classes</h3><ul>';
        spell.classes.forEach(cls => {
            html += `<li>${cls.name}</li>`;
        });
        html += '</ul>';
    }

    return html;
}

function displayMonsterDetails(monster) {
    let html = '<div class="stat-block">';
    
    if (monster.size) {
        html += `<div class="stat-row"><span class="stat-label">Size:</span><span>${monster.size} ${monster.type || ''}</span></div>`;
    }
    if (monster.alignment) {
        html += `<div class="stat-row"><span class="stat-label">Alignment:</span><span>${monster.alignment}</span></div>`;
    }
    if (monster.armor_class !== undefined) {
        html += `<div class="stat-row"><span class="stat-label">Armor Class:</span><span>${monster.armor_class}</span></div>`;
    }
    if (monster.hit_points !== undefined) {
        html += `<div class="stat-row"><span class="stat-label">Hit Points:</span><span>${monster.hit_points} (${monster.hit_dice || ''})</span></div>`;
    }
    if (monster.speed) {
        const speeds = Object.entries(monster.speed).map(([key, val]) => `${key}: ${val}`).join(', ');
        html += `<div class="stat-row"><span class="stat-label">Speed:</span><span>${speeds}</span></div>`;
    }
    if (monster.challenge_rating !== undefined) {
        html += `<div class="stat-row"><span class="stat-label">Challenge Rating:</span><span>${monster.challenge_rating} (${monster.xp || 0} XP)</span></div>`;
    }
    
    html += '</div>';

    // Ability Scores
    if (monster.strength !== undefined) {
        html += '<h3>Ability Scores</h3><div class="stat-block">';
        html += `<div class="stat-row"><span class="stat-label">STR:</span><span>${monster.strength} (${getModifier(monster.strength)})</span></div>`;
        html += `<div class="stat-row"><span class="stat-label">DEX:</span><span>${monster.dexterity} (${getModifier(monster.dexterity)})</span></div>`;
        html += `<div class="stat-row"><span class="stat-label">CON:</span><span>${monster.constitution} (${getModifier(monster.constitution)})</span></div>`;
        html += `<div class="stat-row"><span class="stat-label">INT:</span><span>${monster.intelligence} (${getModifier(monster.intelligence)})</span></div>`;
        html += `<div class="stat-row"><span class="stat-label">WIS:</span><span>${monster.wisdom} (${getModifier(monster.wisdom)})</span></div>`;
        html += `<div class="stat-row"><span class="stat-label">CHA:</span><span>${monster.charisma} (${getModifier(monster.charisma)})</span></div>`;
        html += '</div>';
    }

    if (monster.special_abilities && monster.special_abilities.length > 0) {
        html += '<h3>Special Abilities</h3><ul>';
        monster.special_abilities.forEach(ability => {
            html += `<li><strong>${ability.name}:</strong> ${ability.desc}</li>`;
        });
        html += '</ul>';
    }

    if (monster.actions && monster.actions.length > 0) {
        html += '<h3>Actions</h3><ul>';
        monster.actions.forEach(action => {
            html += `<li><strong>${action.name}:</strong> ${action.desc}</li>`;
        });
        html += '</ul>';
    }

    return html;
}

function displayClassDetails(classData) {
    let html = '<div class="stat-block">';
    
    if (classData.hit_die) {
        html += `<div class="stat-row"><span class="stat-label">Hit Die:</span><span>d${classData.hit_die}</span></div>`;
    }
    
    html += '</div>';

    if (classData.proficiencies && classData.proficiencies.length > 0) {
        html += '<h3>Proficiencies</h3><ul>';
        classData.proficiencies.forEach(prof => {
            html += `<li>${prof.name}</li>`;
        });
        html += '</ul>';
    }

    if (classData.saving_throws && classData.saving_throws.length > 0) {
        html += '<h3>Saving Throws</h3><ul>';
        classData.saving_throws.forEach(save => {
            html += `<li>${save.name}</li>`;
        });
        html += '</ul>';
    }

    if (classData.spellcasting) {
        html += '<h3>Spellcasting</h3>';
        html += '<div class="stat-block">';
        if (classData.spellcasting.spellcasting_ability) {
            html += `<div class="stat-row"><span class="stat-label">Spellcasting Ability:</span><span>${classData.spellcasting.spellcasting_ability.name}</span></div>`;
        }
        html += '</div>';
    }

    return html;
}

function displayEquipmentDetails(equipment) {
    let html = '<div class="stat-block">';
    
    if (equipment.equipment_category) {
        html += `<div class="stat-row"><span class="stat-label">Category:</span><span>${equipment.equipment_category.name}</span></div>`;
    }
    if (equipment.weapon_category) {
        html += `<div class="stat-row"><span class="stat-label">Weapon Category:</span><span>${equipment.weapon_category}</span></div>`;
    }
    if (equipment.armor_category) {
        html += `<div class="stat-row"><span class="stat-label">Armor Category:</span><span>${equipment.armor_category}</span></div>`;
    }
    if (equipment.cost) {
        html += `<div class="stat-row"><span class="stat-label">Cost:</span><span>${equipment.cost.quantity} ${equipment.cost.unit}</span></div>`;
    }
    if (equipment.weight) {
        html += `<div class="stat-row"><span class="stat-label">Weight:</span><span>${equipment.weight} lbs</span></div>`;
    }
    if (equipment.damage) {
        html += `<div class="stat-row"><span class="stat-label">Damage:</span><span>${equipment.damage.damage_dice} ${equipment.damage.damage_type?.name || ''}</span></div>`;
    }
    if (equipment.armor_class) {
        html += `<div class="stat-row"><span class="stat-label">Armor Class:</span><span>${equipment.armor_class.base}</span></div>`;
    }
    if (equipment.str_minimum) {
        html += `<div class="stat-row"><span class="stat-label">Strength Minimum:</span><span>${equipment.str_minimum}</span></div>`;
    }
    
    html += '</div>';

    if (equipment.desc && equipment.desc.length > 0) {
        html += '<h3>Description</h3>';
        equipment.desc.forEach(para => {
            html += `<p>${para}</p>`;
        });
    }

    if (equipment.properties && equipment.properties.length > 0) {
        html += '<h3>Properties</h3><ul>';
        equipment.properties.forEach(prop => {
            html += `<li>${prop.name}</li>`;
        });
        html += '</ul>';
    }

    return html;
}

function displayMagicItemDetails(item) {
    let html = '<div class="stat-block">';
    
    if (item.equipment_category) {
        html += `<div class="stat-row"><span class="stat-label">Category:</span><span>${item.equipment_category.name}</span></div>`;
    }
    if (item.rarity) {
        html += `<div class="stat-row"><span class="stat-label">Rarity:</span><span>${item.rarity.name}</span></div>`;
    }
    
    html += '</div>';

    if (item.desc && item.desc.length > 0) {
        html += '<h3>Description</h3>';
        item.desc.forEach(para => {
            html += `<p>${para}</p>`;
        });
    }

    return html;
}

function displayRaceDetails(race) {
    let html = '<div class="stat-block">';
    
    if (race.speed) {
        html += `<div class="stat-row"><span class="stat-label">Speed:</span><span>${race.speed} ft</span></div>`;
    }
    if (race.alignment) {
        html += `<div class="stat-row"><span class="stat-label">Alignment:</span><span>${race.alignment}</span></div>`;
    }
    if (race.age) {
        html += `<div class="stat-row"><span class="stat-label">Age:</span><span>${race.age}</span></div>`;
    }
    if (race.size) {
        html += `<div class="stat-row"><span class="stat-label">Size:</span><span>${race.size}</span></div>`;
    }
    if (race.size_description) {
        html += `<div class="stat-row"><span class="stat-label">Size Description:</span><span>${race.size_description}</span></div>`;
    }
    
    html += '</div>';

    if (race.traits && race.traits.length > 0) {
        html += '<h3>Traits</h3><ul>';
        race.traits.forEach(trait => {
            html += `<li>${trait.name}</li>`;
        });
        html += '</ul>';
    }

    if (race.ability_bonuses && race.ability_bonuses.length > 0) {
        html += '<h3>Ability Score Increases</h3><ul>';
        race.ability_bonuses.forEach(bonus => {
            html += `<li>${bonus.ability_score?.name || 'Unknown'}: +${bonus.bonus}</li>`;
        });
        html += '</ul>';
    }

    if (race.starting_proficiencies && race.starting_proficiencies.length > 0) {
        html += '<h3>Starting Proficiencies</h3><ul>';
        race.starting_proficiencies.forEach(prof => {
            html += `<li>${prof.name}</li>`;
        });
        html += '</ul>';
    }

    if (race.languages && race.languages.length > 0) {
        html += '<h3>Languages</h3><ul>';
        race.languages.forEach(lang => {
            html += `<li>${lang.name}</li>`;
        });
        html += '</ul>';
    }

    if (race.language_desc) {
        html += `<h3>Language Description</h3><p>${race.language_desc}</p>`;
    }

    return html;
}

function displayGenericDetails(data) {
    let html = '';

    // Display common fields
    if (data.desc) {
        if (Array.isArray(data.desc)) {
            data.desc.forEach(para => {
                html += `<p>${para}</p>`;
            });
        } else {
            html += `<p>${data.desc}</p>`;
        }
    }

    // Display any other properties
    const excludeKeys = ['index', 'name', 'url', 'desc'];
    Object.keys(data).forEach(key => {
        if (!excludeKeys.includes(key)) {
            const value = data[key];
            if (typeof value === 'string' || typeof value === 'number') {
                html += `<div class="stat-block"><div class="stat-row"><span class="stat-label">${formatKey(key)}:</span><span>${value}</span></div></div>`;
            }
        }
    });

    return html;
}

// Helper Functions
function getModifier(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
}

function formatKey(key) {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function showLoading() {
    loadingElement.classList.remove('hidden');
}

function hideLoading() {
    loadingElement.classList.add('hidden');
}

function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
}

function hideError() {
    errorElement.classList.add('hidden');
}

// New Feature Functions

// Dark Mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('dark-mode', isDark);
    darkModeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
}

function loadDarkMode() {
    const isDark = localStorage.getItem('dark-mode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️ Light Mode';
    }
}

// Favorites
function toggleFavorite(item) {
    const existingIndex = favorites.findIndex(fav => 
        fav.index === item.index && fav.category === currentCategory
    );
    
    if (existingIndex !== -1) {
        favorites.splice(existingIndex, 1);
    } else {
        favorites.push({
            ...item,
            category: currentCategory,
            addedAt: Date.now()
        });
    }
    
    localStorage.setItem('dnd-favorites', JSON.stringify(favorites));
    updateFavoritesCount();
    
    // Refresh display
    performSearch();
}

function updateFavoritesCount() {
    favCount.textContent = favorites.length;
}

function showFavorites() {
    if (favorites.length === 0) {
        favoritesBody.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⭐</div>
                <h3>No Favorites Yet</h3>
                <p>Start adding your favorite items by clicking the star icon on any card!</p>
            </div>
        `;
    } else {
        favoritesBody.innerHTML = '';
        favorites.forEach(fav => {
            const item = document.createElement('div');
            item.className = 'favorite-item';
            item.innerHTML = `
                <div class="favorite-item-info">
                    <h4>${getCategoryIcon(fav.category)} ${escapeHtml(fav.name)}</h4>
                    <span class="badge">${escapeHtml(fav.category)}</span>
                </div>
                <div class="favorite-item-actions">
                    <button class="fav-action-btn view">View</button>
                    <button class="fav-action-btn remove">Remove</button>
                </div>
            `;
            
            item.querySelector('.view').addEventListener('click', async () => {
                favoritesModal.classList.add('hidden');
                // Switch category if needed
                if (currentCategory !== fav.category) {
                    currentCategory = fav.category;
                    categoryBtns.forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.category === currentCategory);
                    });
                    await loadCategory(currentCategory);
                }
                loadDetails(fav.index);
            });
            
            item.querySelector('.remove').addEventListener('click', () => {
                toggleFavorite(fav);
                showFavorites();
            });
            
            favoritesBody.appendChild(item);
        });
    }
    
    favoritesModal.classList.remove('hidden');
}

// Compare
function toggleCompare(item) {
    const existingIndex = compareList.findIndex(comp => comp.index === item.index);
    
    if (existingIndex !== -1) {
        compareList.splice(existingIndex, 1);
    } else {
        if (compareList.length >= 4) {
            showNotification('You can compare up to 4 items at once', 'warning');
            return;
        }
        compareList.push({
            ...item,
            category: currentCategory
        });
    }
    
    updateCompareCount();
    performSearch();
}

function updateCompareCount() {
    compareCount.textContent = compareList.length;
    compareBtn.classList.toggle('hidden', compareList.length === 0);
}

async function showCompare() {
    if (compareList.length === 0) return;
    
    compareBody.innerHTML = '<p style="text-align: center; padding: 20px;">Loading comparison...</p>';
    compareModal.classList.remove('hidden');
    
    compareBody.innerHTML = '';
    
    for (const item of compareList) {
        try {
            const data = await fetchFromAPI(`/${item.category}/${item.index}`);
            const compareItem = document.createElement('div');
            compareItem.className = 'compare-item';
            
            let details = '';
            switch(item.category) {
                case 'spells':
                    details = displaySpellDetails(data);
                    break;
                case 'monsters':
                    details = displayMonsterDetails(data);
                    break;
                default:
                    details = displayGenericDetails(data);
            }
            
            compareItem.innerHTML = `
                <button class="compare-remove" data-index="${item.index}">×</button>
                <h3>${getCategoryIcon(item.category)} ${data.name}</h3>
                <span class="badge">${item.category}</span>
                ${details}
            `;
            
            compareItem.querySelector('.compare-remove').addEventListener('click', () => {
                toggleCompare(item);
                showCompare();
            });
            
            compareBody.appendChild(compareItem);
        } catch (error) {
            console.error('Error loading compare item:', error);
        }
    }
}

// Random Item
function getRandomItem() {
    if (allResults.length === 0) {
        showNotification('No items available in this category', 'warning');
        return;
    }
    
    const randomIndex = Math.floor(Math.random() * allResults.length);
    const randomItem = allResults[randomIndex];
    loadDetails(randomItem.index);
}

// Advanced Filters
function updateFilters() {
    filterSection.innerHTML = '';
    
    if (currentCategory === 'spells') {
        filterSection.classList.remove('hidden');
        filterSection.innerHTML = `
            <label>Level:</label>
            <select id="spellLevelFilter">
                <option value="">All Levels</option>
                <option value="0">Cantrip</option>
                <option value="1">1st Level</option>
                <option value="2">2nd Level</option>
                <option value="3">3rd Level</option>
                <option value="4">4th Level</option>
                <option value="5">5th Level</option>
                <option value="6">6th Level</option>
                <option value="7">7th Level</option>
                <option value="8">8th Level</option>
                <option value="9">9th Level</option>
            </select>
        `;
        
        document.getElementById('spellLevelFilter').addEventListener('change', applyFilters);
    } else if (currentCategory === 'monsters') {
        filterSection.classList.remove('hidden');
        filterSection.innerHTML = `
            <label>Challenge Rating:</label>
            <select id="crFilter">
                <option value="">All CR</option>
                <option value="0-5">CR 0-5</option>
                <option value="6-10">CR 6-10</option>
                <option value="11-15">CR 11-15</option>
                <option value="16-20">CR 16-20</option>
                <option value="21+">CR 21+</option>
            </select>
        `;
        
        document.getElementById('crFilter').addEventListener('change', applyFilters);
    } else {
        filterSection.classList.add('hidden');
    }
}

async function applyFilters() {
    showLoading();
    
    try {
        let filtered = allResults;
        
        if (currentCategory === 'spells') {
            const levelFilter = document.getElementById('spellLevelFilter')?.value;
            if (levelFilter !== '') {
                // Fetch detailed info to filter by level (using Promise.all for performance)
                const detailPromises = allResults.map(item => 
                    fetchFromAPI(`/${currentCategory}/${item.index}`)
                        .then(data => ({ item, data }))
                        .catch(err => ({ item, data: null }))
                );
                
                const results = await Promise.all(detailPromises);
                filtered = results
                    .filter(({ data }) => data && data.level !== undefined && data.level.toString() === levelFilter)
                    .map(({ item }) => item);
            }
        }
        
        displayResults(filtered);
    } catch (error) {
        console.error('Filter error:', error);
    } finally {
        hideLoading();
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'warning' ? '#ff9800' : '#4caf50'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: bold;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Offline status indicator
function updateOfflineStatus() {
    if (isOffline) {
        offlineIndicator.classList.remove('hidden');
    } else {
        offlineIndicator.classList.add('hidden');
    }
}

// Recent Items Management
function addToRecent(item) {
    // Remove if already exists
    recentItems = recentItems.filter(r => !(r.index === item.index && r.category === item.category));
    
    // Add to beginning
    recentItems.unshift(item);
    
    // Keep only last 20 items
    if (recentItems.length > 20) {
        recentItems = recentItems.slice(0, 20);
    }
    
    localStorage.setItem('dnd-recent', JSON.stringify(recentItems));
    updateQuickAccess();
}

// Pinned Items Management
function togglePin(index, name, category) {
    const existingIndex = pinnedItems.findIndex(p => p.index === index && p.category === category);
    
    if (existingIndex !== -1) {
        pinnedItems.splice(existingIndex, 1);
        showNotification('Item unpinned', 'info');
    } else {
        pinnedItems.push({ index, name, category, pinnedAt: Date.now() });
        showNotification('Item pinned for quick access', 'info');
    }
    
    localStorage.setItem('dnd-pinned', JSON.stringify(pinnedItems));
    updateQuickAccess();
    
    // Refresh the details view to update pin button
    loadDetails(index);
}

function isPinned(index) {
    return pinnedItems.some(p => p.index === index && p.category === currentCategory);
}

// Share Link Management
function copyShareLink(url) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            showNotification('Share link copied to clipboard!', 'info');
        }).catch(() => {
            // Fallback for older browsers
            fallbackCopyText(url);
        });
    } else {
        fallbackCopyText(url);
    }
}

function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showNotification('Share link copied!', 'info');
    } catch (err) {
        showNotification('Failed to copy link', 'warning');
    }
    document.body.removeChild(textarea);
}

// Export Favorites to PDF (using browser print)
function exportFavoritesPDF() {
    if (favorites.length === 0) {
        showNotification('No favorites to export', 'warning');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>D&D 5e Favorites</title>
            <style>
                body { font-family: Georgia, serif; padding: 20px; }
                h1 { color: #8b4513; border-bottom: 3px solid #d4af37; }
                .item { margin: 20px 0; padding: 15px; border: 2px solid #a0826d; border-radius: 8px; page-break-inside: avoid; }
                .item h2 { margin: 0 0 10px 0; color: #8b4513; }
                .badge { display: inline-block; padding: 4px 8px; background: #d4af37; color: white; border-radius: 4px; font-size: 0.9em; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <h1>🐉 My D&D 5e Favorites</h1>
            <p>Exported on: ${new Date().toLocaleDateString()}</p>
            <button class="no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
            <hr>
    `;
    
    favorites.forEach(fav => {
        html += `
            <div class="item">
                <h2>${getCategoryIcon(fav.category)} ${fav.name}</h2>
                <span class="badge">${fav.category}</span>
            </div>
        `;
    });
    
    html += '</body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
}

// Export/Import Favorites as JSON
function exportFavoritesJSON() {
    if (favorites.length === 0) {
        showNotification('No favorites to export', 'warning');
        return;
    }
    
    const dataStr = JSON.stringify(favorites, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dnd-favorites-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('Favorites exported as JSON', 'info');
}

function importFavoritesJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (Array.isArray(imported)) {
                    // Merge with existing favorites
                    imported.forEach(item => {
                        if (!favorites.some(f => f.index === item.index && f.category === item.category)) {
                            favorites.push(item);
                        }
                    });
                    localStorage.setItem('dnd-favorites', JSON.stringify(favorites));
                    updateFavoritesCount();
                    showNotification(`Imported ${imported.length} favorites`, 'info');
                } else {
                    showNotification('Invalid JSON format', 'warning');
                }
            } catch (error) {
                showNotification('Failed to import favorites', 'warning');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Make functions globally accessible for onclick handlers
window.copyShareLink = copyShareLink;
window.togglePin = togglePin;
window.exportFavoritesPDF = exportFavoritesPDF;
window.exportFavoritesJSON = exportFavoritesJSON;
window.importFavoritesJSON = importFavoritesJSON;

// Quick Access UI Updates
function updateQuickAccess() {
    const quickAccessSection = document.getElementById('quickAccessSection');
    const pinnedItemsContainer = document.getElementById('pinnedItems');
    const recentItemsContainer = document.getElementById('recentItems');
    
    // Show section if there are pinned or recent items
    if (pinnedItems.length > 0 || recentItems.length > 0) {
        quickAccessSection.classList.remove('hidden');
    } else {
        quickAccessSection.classList.add('hidden');
        return;
    }
    
    // Update pinned items
    if (pinnedItems.length > 0) {
        pinnedItemsContainer.innerHTML = '';
        pinnedItems.forEach(item => {
            const btn = document.createElement('button');
            btn.style.cssText = "padding: 8px 12px; background: linear-gradient(135deg, var(--accent) 0%, #a0552f 100%); color: var(--parchment); border: 2px solid var(--gold); border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 0.85rem;";
            btn.textContent = `📌 ${getCategoryIcon(item.category)} ${item.name}`;
            btn.setAttribute('aria-label', `Load pinned item: ${item.name}`);
            btn.addEventListener('click', () => loadItemFromQuickAccess(item.category, item.index));
            pinnedItemsContainer.appendChild(btn);
        });
    } else {
        pinnedItemsContainer.innerHTML = '<p style="color: #666; font-style: italic; margin: 0;">No pinned items yet. Pin items from their detail view!</p>';
    }
    
    // Update recent items
    if (recentItems.length > 0) {
        recentItemsContainer.innerHTML = '';
        recentItems.slice(0, 10).forEach(item => {
            const btn = document.createElement('button');
            btn.style.cssText = "padding: 6px 10px; background: var(--dark-parchment); color: var(--ink); border: 2px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.8rem;";
            btn.textContent = `${getCategoryIcon(item.category)} ${item.name}`;
            btn.setAttribute('aria-label', `Load recent item: ${item.name}`);
            btn.addEventListener('click', () => loadItemFromQuickAccess(item.category, item.index));
            recentItemsContainer.appendChild(btn);
        });
    } else {
        recentItemsContainer.innerHTML = '<p style="color: #666; font-style: italic; margin: 0;">No recent items yet.</p>';
    }
}

function loadItemFromQuickAccess(category, index) {
    if (currentCategory !== category) {
        currentCategory = category;
        categoryBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
        loadCategory(category).then(() => {
            loadDetails(index);
        });
    } else {
        loadDetails(index);
    }
}

window.loadItemFromQuickAccess = loadItemFromQuickAccess;

// ==================== DICE ROLLER ====================

function openDiceRoller() {
    diceRollerModal.classList.remove('hidden');
    renderDiceHistory();
}

function closeDiceRollerModal() {
    diceRollerModal.classList.add('hidden');
}

diceRollerBtn.addEventListener('click', openDiceRoller);
closeDiceRoller.addEventListener('click', closeDiceRollerModal);

diceRollerModal.addEventListener('click', (e) => {
    if (e.target === diceRollerModal) {
        closeDiceRollerModal();
    }
});

// Handle dice button clicks
document.querySelectorAll('.dice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const diceType = btn.dataset.dice;
        rollDice(diceType);
    });
});

// Handle advantage/disadvantage checkboxes
document.getElementById('advantageCheck').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('disadvantageCheck').checked = false;
    }
});

document.getElementById('disadvantageCheck').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('advantageCheck').checked = false;
    }
});

function renderDiceHistory() {
    const historyDiv = document.getElementById('diceHistory');
    
    if (diceHistory.length === 0) {
        historyDiv.innerHTML = '<p class="empty-state">No rolls yet. Click a dice button to start!</p>';
        return;
    }
    
    historyDiv.innerHTML = `
        <h3>Recent Rolls</h3>
        <div class="history-items">
            ${diceHistory.map(entry => `
                <div class="history-item">
                    <span class="history-time">${entry.timestamp}</span>
                    <span class="history-roll">${entry.dice}</span>
                    <span class="history-rolls">[${entry.rolls.join(', ')}]</span>
                    ${entry.modifier !== 0 ? `<span class="history-mod">${entry.modifier >= 0 ? '+' : ''}${entry.modifier}</span>` : ''}
                    <span class="history-total">= ${entry.total}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ==================== SPELL SLOTS TRACKER ====================

const SPELL_SLOTS_BY_LEVEL = {
    1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
    3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
    4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
    5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
    7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
    8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
    9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
    10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
    11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
    18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
    20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
};

function openSpellSlots() {
    spellSlotsModal.classList.remove('hidden');
    renderSpellSlots();
}

function closeSpellSlotsModal() {
    spellSlotsModal.classList.add('hidden');
}

spellSlotsBtn.addEventListener('click', openSpellSlots);
closeSpellSlots.addEventListener('click', closeSpellSlotsModal);

spellSlotsModal.addEventListener('click', (e) => {
    if (e.target === spellSlotsModal) {
        closeSpellSlotsModal();
    }
});

document.getElementById('characterLevel').addEventListener('change', () => {
    renderSpellSlots();
});

document.getElementById('resetSpellSlots').addEventListener('click', () => {
    const level = parseInt(document.getElementById('characterLevel').value);
    spellSlots = {};
    for (let i = 1; i <= 9; i++) {
        spellSlots[i] = { used: 0, max: SPELL_SLOTS_BY_LEVEL[level][i - 1] };
    }
    localStorage.setItem('dnd-spell-slots', JSON.stringify(spellSlots));
    renderSpellSlots();
    showNotification('All spell slots restored!', 'info');
});

function renderSpellSlots() {
    const level = parseInt(document.getElementById('characterLevel').value);
    const maxSlots = SPELL_SLOTS_BY_LEVEL[level];
    const grid = document.getElementById('spellSlotsGrid');
    
    // Initialize spell slots if not set for this spell level
    for (let i = 1; i <= 9; i++) {
        if (!spellSlots[i]) {
            spellSlots[i] = { used: 0, max: maxSlots[i - 1] };
        } else {
            spellSlots[i].max = maxSlots[i - 1];
        }
    }
    
    grid.innerHTML = '';
    
    for (let spellLevel = 1; spellLevel <= 9; spellLevel++) {
        const max = maxSlots[spellLevel - 1];
        if (max === 0) continue;
        
        const used = spellSlots[spellLevel]?.used || 0;
        const available = max - used;
        
        const slotDiv = document.createElement('div');
        slotDiv.className = 'spell-slot-level';
        const header = document.createElement('div');
        header.className = 'spell-slot-header';
        header.innerHTML = `
            <h3>Level ${spellLevel}</h3>
            <span class="spell-slot-count">${available}/${max}</span>
        `;
        slotDiv.appendChild(header);
        
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'spell-slot-dots';
        
        for (let i = 0; i < max; i++) {
            const dot = document.createElement('button');
            dot.className = `spell-slot-dot ${i < used ? 'used' : 'available'}`;
            dot.setAttribute('aria-label', `Spell slot ${i + 1} ${i < used ? 'used' : 'available'}`);
            dot.addEventListener('click', () => toggleSpellSlot(spellLevel, i));
            dotsContainer.appendChild(dot);
        }
        
        slotDiv.appendChild(dotsContainer);
        grid.appendChild(slotDiv);
    }
}

function toggleSpellSlot(level, index) {
    if (!spellSlots[level]) {
        spellSlots[level] = { used: 0, max: SPELL_SLOTS_BY_LEVEL[parseInt(document.getElementById('characterLevel').value)][level - 1] };
    }
    
    const currentUsed = spellSlots[level].used;
    
    // If clicking on a used slot, mark it and all after as available
    if (index < currentUsed) {
        spellSlots[level].used = index;
    } else {
        // If clicking on available slot, mark it and all before as used
        spellSlots[level].used = index + 1;
    }
    
    localStorage.setItem('dnd-spell-slots', JSON.stringify(spellSlots));
    renderSpellSlots();
}

window.toggleSpellSlot = toggleSpellSlot;

// ==================== INITIATIVE TRACKER ====================

function openInitiative() {
    initiativeModal.classList.remove('hidden');
    renderInitiative();
}

function closeInitiativeModal() {
    initiativeModal.classList.add('hidden');
}

initiativeBtn.addEventListener('click', openInitiative);
closeInitiative.addEventListener('click', closeInitiativeModal);

initiativeModal.addEventListener('click', (e) => {
    if (e.target === initiativeModal) {
        closeInitiativeModal();
    }
});

document.getElementById('addInitiative').addEventListener('click', () => {
    const name = document.getElementById('initCreatureName').value.trim();
    const initiative = parseInt(document.getElementById('initRoll').value);
    const hp = parseInt(document.getElementById('initHP').value) || null;
    
    if (!name || isNaN(initiative)) {
        showNotification('Please enter a name and initiative value', 'warning');
        return;
    }
    
    initiativeList.push({
        id: Date.now(),
        name: name,
        initiative: initiative,
        hp: hp,
        maxHp: hp,
        active: false
    });
    
    // Sort by initiative (highest first)
    initiativeList.sort((a, b) => b.initiative - a.initiative);
    
    localStorage.setItem('dnd-initiative', JSON.stringify(initiativeList));
    
    // Clear inputs
    document.getElementById('initCreatureName').value = '';
    document.getElementById('initRoll').value = '';
    document.getElementById('initHP').value = '';
    
    renderInitiative();
    showNotification(`${name} added to initiative`, 'info');
});

document.getElementById('clearInitiative').addEventListener('click', () => {
    if (confirm('Clear all creatures from initiative?')) {
        initiativeList = [];
        currentTurn = 0;
        localStorage.setItem('dnd-initiative', JSON.stringify(initiativeList));
        renderInitiative();
        showNotification('Initiative tracker cleared', 'info');
    }
});

document.getElementById('nextTurn').addEventListener('click', () => {
    if (initiativeList.length === 0) return;
    
    // Mark current as inactive
    if (initiativeList[currentTurn]) {
        initiativeList[currentTurn].active = false;
    }
    
    // Move to next
    currentTurn = (currentTurn + 1) % initiativeList.length;
    
    // Mark new as active
    initiativeList[currentTurn].active = true;
    
    localStorage.setItem('dnd-initiative', JSON.stringify(initiativeList));
    renderInitiative();
    
    const currentCreature = initiativeList[currentTurn];
    showNotification(`${currentCreature.name}'s turn (Initiative ${currentCreature.initiative})`, 'info');
});

function renderInitiative() {
    const listDiv = document.getElementById('initiativeList');
    
    if (initiativeList.length === 0) {
        listDiv.innerHTML = '<p class="empty-state">No creatures in combat. Add combatants above.</p>';
        return;
    }
    
    listDiv.innerHTML = '';
    initiativeList.forEach((creature, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `initiative-item ${creature.active ? 'active' : ''}`;
        
        const orderDiv = document.createElement('div');
        orderDiv.className = 'init-order';
        orderDiv.textContent = index + 1;
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'init-info';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'init-name';
        nameDiv.textContent = creature.name;
        
        const valueDiv = document.createElement('div');
        valueDiv.className = 'init-value';
        valueDiv.textContent = `Initiative: ${creature.initiative}`;
        
        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(valueDiv);
        
        if (creature.hp !== null) {
            const hpDiv = document.createElement('div');
            hpDiv.className = 'init-hp';
            
            const hpInput = document.createElement('input');
            hpInput.type = 'number';
            hpInput.value = creature.hp;
            hpInput.min = '0';
            hpInput.max = creature.maxHp;
            hpInput.setAttribute('aria-label', `Hit points for ${creature.name}`);
            hpInput.addEventListener('change', (e) => updateCreatureHP(creature.id, e.target.value));
            
            hpDiv.appendChild(hpInput);
            hpDiv.appendChild(document.createTextNode(` / ${creature.maxHp} HP`));
            infoDiv.appendChild(hpDiv);
        }
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'init-remove';
        removeBtn.textContent = '✕';
        removeBtn.setAttribute('aria-label', `Remove ${creature.name}`);
        removeBtn.addEventListener('click', () => removeFromInitiative(creature.id));
        
        itemDiv.appendChild(orderDiv);
        itemDiv.appendChild(infoDiv);
        itemDiv.appendChild(removeBtn);
        listDiv.appendChild(itemDiv);
    });
}

function removeFromInitiative(id) {
    const index = initiativeList.findIndex(c => c.id === id);
    if (index !== -1) {
        const creature = initiativeList[index];
        initiativeList.splice(index, 1);
        
        // Adjust current turn if needed
        if (index < currentTurn) {
            currentTurn--;
        } else if (index === currentTurn && currentTurn >= initiativeList.length) {
            currentTurn = 0;
        }
        
        localStorage.setItem('dnd-initiative', JSON.stringify(initiativeList));
        renderInitiative();
        showNotification(`${creature.name} removed from initiative`, 'info');
    }
}

function updateCreatureHP(id, newHp) {
    const creature = initiativeList.find(c => c.id === id);
    if (creature) {
        creature.hp = parseInt(newHp);
        localStorage.setItem('dnd-initiative', JSON.stringify(initiativeList));
        
        if (creature.hp <= 0) {
            showNotification(`${creature.name} has fallen!`, 'warning');
        }
    }
}

window.removeFromInitiative = removeFromInitiative;
window.updateCreatureHP = updateCreatureHP;

// ==================== KEYBOARD NAVIGATION & ACCESSIBILITY ====================

// Keyboard navigation improvements
document.addEventListener('keydown', (e) => {
    // Escape key to close modals
    if (e.key === 'Escape') {
        if (!modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
        if (!compareModal.classList.contains('hidden')) {
            compareModal.classList.add('hidden');
        }
        if (!favoritesModal.classList.contains('hidden')) {
            favoritesModal.classList.add('hidden');
        }
        if (!diceRollerModal.classList.contains('hidden')) {
            diceRollerModal.classList.add('hidden');
        }
        if (!spellSlotsModal.classList.contains('hidden')) {
            spellSlotsModal.classList.add('hidden');
        }
        if (!initiativeModal.classList.contains('hidden')) {
            initiativeModal.classList.add('hidden');
        }
    }
    
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
    }
    
    // Ctrl/Cmd + D for dice roller
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        openDiceRoller();
    }
});

// Update category button accessibility
categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        categoryBtns.forEach(b => {
            b.setAttribute('aria-selected', 'false');
        });
        btn.setAttribute('aria-selected', 'true');
    });
});

// ==================== PARTY MODE (PeerJS) ====================

function openPartyMode() {
    partyModeModal.classList.remove('hidden');
}

function closePartyModeModal() {
    partyModeModal.classList.add('hidden');
}

partyModeBtn.addEventListener('click', openPartyMode);
closePartyMode.addEventListener('click', closePartyModeModal);

partyModeModal.addEventListener('click', (e) => {
    if (e.target === partyModeModal) {
        closePartyModeModal();
    }
});

// Host a party
hostPartyBtn.addEventListener('click', () => {
    if (peer && peer.open) {
        showNotification('Already hosting a party!', 'warning');
        return;
    }
    
    // Create a new peer with a random ID
    peer = new Peer();
    
    peer.on('open', (id) => {
        isHost = true;
        roomId = id;
        
        // Show room code
        document.getElementById('roomCode').textContent = id;
        document.getElementById('hostInfo').classList.remove('hidden');
        hostPartyBtn.classList.add('hidden');
        document.getElementById('partyMembers').classList.remove('hidden');
        
        updatePartyStatus('Hosting party - waiting for members...');
        showNotification('Party room created!', 'info');
        playSound('connect');
    });
    
    peer.on('connection', (conn) => {
        handleNewConnection(conn);
    });
    
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        showNotification('Connection error: ' + err.message, 'warning');
    });
});

// Join a party
joinPartyBtn.addEventListener('click', () => {
    const code = document.getElementById('joinRoomCode').value.trim();
    
    if (!code) {
        showNotification('Please enter a room code', 'warning');
        return;
    }
    
    if (peer && peer.open) {
        showNotification('Already in a party!', 'warning');
        return;
    }
    
    // Create a new peer
    peer = new Peer();
    
    peer.on('open', () => {
        isHost = false;
        roomId = code;
        
        // Connect to host
        const conn = peer.connect(code);
        
        conn.on('open', () => {
            connections.push(conn);
            document.getElementById('partyMembers').classList.remove('hidden');
            updatePartyStatus('Connected to party!');
            showNotification('Joined party successfully!', 'info');
            playSound('connect');
            
            // Send initial sync request
            conn.send({
                type: 'join',
                peerId: peer.id
            });
            
            setupConnectionListeners(conn);
        });
        
        conn.on('error', (err) => {
            console.error('Connection error:', err);
            showNotification('Failed to join party: ' + err.message, 'warning');
        });
    });
    
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        showNotification('Connection error: ' + err.message, 'warning');
    });
});

// Disconnect from party
disconnectHostBtn.addEventListener('click', () => {
    disconnectParty();
});

function disconnectParty() {
    // Close all connections
    connections.forEach(conn => conn.close());
    connections = [];
    
    // Destroy peer
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    // Reset UI
    document.getElementById('hostInfo').classList.add('hidden');
    document.getElementById('partyMembers').classList.add('hidden');
    hostPartyBtn.classList.remove('hidden');
    document.getElementById('joinRoomCode').value = '';
    
    isHost = false;
    roomId = null;
    
    updatePartyStatus('Disconnected from party');
    updateMembersList();
    showNotification('Disconnected from party', 'info');
}

function handleNewConnection(conn) {
    connections.push(conn);
    
    conn.on('open', () => {
        updatePartyStatus(`${connections.length} member(s) connected`);
        updateMembersList();
        showNotification('New member joined the party!', 'info');
        playSound('connect');
        
        // Send current state to new member
        syncStateToConnection(conn);
    });
    
    setupConnectionListeners(conn);
}

function setupConnectionListeners(conn) {
    conn.on('data', (data) => {
        handlePartyMessage(data, conn);
    });
    
    conn.on('close', () => {
        connections = connections.filter(c => c !== conn);
        updateMembersList();
        updatePartyStatus(connections.length > 0 ? `${connections.length} member(s) connected` : 'Waiting for members...');
        showNotification('A member left the party', 'info');
    });
}

function handlePartyMessage(data, conn) {
    switch (data.type) {
        case 'join':
            if (isHost) {
                syncStateToConnection(conn);
            }
            updateMembersList();
            break;
            
        case 'initiative':
            if (document.getElementById('shareInitiative').checked) {
                initiativeList = data.list;
                currentTurn = data.currentTurn;
                localStorage.setItem('dnd-initiative', JSON.stringify(initiativeList));
                if (!initiativeModal.classList.contains('hidden')) {
                    renderInitiative();
                }
            }
            break;
            
        case 'spellSlots':
            if (document.getElementById('shareSpellSlots').checked) {
                // Only update if not host (host is authoritative)
                if (!isHost) {
                    spellSlots = data.slots;
                    localStorage.setItem('dnd-spell-slots', JSON.stringify(spellSlots));
                    if (!spellSlotsModal.classList.contains('hidden')) {
                        renderSpellSlots();
                    }
                }
            }
            break;
            
        case 'diceRoll':
            if (document.getElementById('shareDiceRolls').checked) {
                showNotification(`${data.player || 'Someone'} rolled ${data.result}!`, 'info');
                playSound('dice');
            }
            break;
            
        case 'sync':
            // Receive full state from host
            if (data.initiative) {
                initiativeList = data.initiative.list;
                currentTurn = data.initiative.currentTurn;
                localStorage.setItem('dnd-initiative', JSON.stringify(initiativeList));
            }
            if (data.spellSlots) {
                spellSlots = data.spellSlots;
                localStorage.setItem('dnd-spell-slots', JSON.stringify(spellSlots));
            }
            break;
    }
}

function syncStateToConnection(conn) {
    conn.send({
        type: 'sync',
        initiative: {
            list: initiativeList,
            currentTurn: currentTurn
        },
        spellSlots: spellSlots
    });
}

function broadcastToParty(message) {
    connections.forEach(conn => {
        if (conn.open) {
            conn.send(message);
        }
    });
}

function updatePartyStatus(message) {
    document.getElementById('partyStatus').innerHTML = `<p>${message}</p>`;
}

function updateMembersList() {
    const list = document.getElementById('membersList');
    if (connections.length === 0 && !isHost) {
        list.innerHTML = '<p class="empty-state">No members yet</p>';
        return;
    }
    
    // Build member list safely
    const memberItems = [];
    
    if (isHost) {
        const hostItem = document.createElement('div');
        hostItem.className = 'party-member';
        hostItem.innerHTML = '<span class="member-badge">👑</span> You (Host)';
        memberItems.push(hostItem);
    }
    
    connections.forEach((conn, i) => {
        const memberItem = document.createElement('div');
        memberItem.className = 'party-member';
        
        const badge = document.createElement('span');
        badge.className = 'member-badge';
        badge.textContent = '🎲';
        
        const nameText = document.createTextNode(` Member ${i + 1}`);
        
        memberItem.appendChild(badge);
        memberItem.appendChild(nameText);
        
        if (isHost) {
            const kickBtn = document.createElement('button');
            kickBtn.className = 'kick-btn';
            kickBtn.textContent = '✕';
            kickBtn.setAttribute('aria-label', `Kick Member ${i + 1}`);
            kickBtn.addEventListener('click', () => kickMember(i));
            memberItem.appendChild(kickBtn);
        }
        
        memberItems.push(memberItem);
    });
    
    list.innerHTML = '';
    memberItems.forEach(item => list.appendChild(item));
}

function kickMember(index) {
    if (connections[index]) {
        connections[index].close();
        connections.splice(index, 1);
        updateMembersList();
        showNotification('Member removed from party', 'info');
    }
}

window.kickMember = kickMember;

// Copy room code
document.getElementById('copyRoomCode').addEventListener('click', () => {
    const code = document.getElementById('roomCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showNotification('Room code copied!', 'info');
    });
});

// Broadcast initiative changes when added
document.getElementById('addInitiative').addEventListener('click', () => {
    // Wait a bit for the list to update, then broadcast
    setTimeout(() => {
        if (document.getElementById('shareInitiative')?.checked) {
            broadcastToParty({
                type: 'initiative',
                list: initiativeList,
                currentTurn: currentTurn
            });
        }
    }, 100);
});

// Broadcast turn changes when advancing
document.getElementById('nextTurn').addEventListener('click', () => {
    setTimeout(() => {
        if (document.getElementById('shareInitiative')?.checked) {
            broadcastToParty({
                type: 'initiative',
                list: initiativeList,
                currentTurn: currentTurn
            });
        }
    }, 100);
});

// ==================== QUICK REFERENCE ====================

function openQuickRef() {
    quickRefModal.classList.remove('hidden');
}

function closeQuickRefModal() {
    quickRefModal.classList.add('hidden');
    document.getElementById('refDetail').classList.add('hidden');
}

floatingQuickRef.addEventListener('click', openQuickRef);
closeQuickRef.addEventListener('click', closeQuickRefModal);

quickRefModal.addEventListener('click', (e) => {
    if (e.target === quickRefModal) {
        closeQuickRefModal();
    }
});

const quickRefData = {
    conditions: {
        title: '🩹 Conditions',
        content: `
            <h3>Common Conditions</h3>
            <ul>
                <li><strong>Blinded:</strong> Can't see, auto-fail sight checks, attacks have disadvantage, attacks against have advantage</li>
                <li><strong>Charmed:</strong> Can't attack charmer, charmer has advantage on social checks</li>
                <li><strong>Frightened:</strong> Disadvantage on checks while source is in sight, can't move closer to source</li>
                <li><strong>Grappled:</strong> Speed becomes 0, ends if grappler is incapacitated</li>
                <li><strong>Paralyzed:</strong> Incapacitated, auto-fail STR/DEX saves, attacks against have advantage, hits are crits if within 5ft</li>
                <li><strong>Poisoned:</strong> Disadvantage on attack rolls and ability checks</li>
                <li><strong>Prone:</strong> Disadvantage on attacks, attacks against have advantage if within 5ft, disadvantage if farther</li>
                <li><strong>Restrained:</strong> Speed becomes 0, disadvantage on DEX saves, attacks against have advantage</li>
                <li><strong>Stunned:</strong> Incapacitated, auto-fail STR/DEX saves, attacks against have advantage</li>
                <li><strong>Unconscious:</strong> Incapacitated, can't move/speak, drops items, auto-fail STR/DEX saves, attacks have advantage, hits are crits if within 5ft, unaware of surroundings</li>
            </ul>
        `
    },
    actions: {
        title: '⚔️ Actions in Combat',
        content: `
            <h3>On Your Turn</h3>
            <ul>
                <li><strong>Action:</strong> Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object</li>
                <li><strong>Bonus Action:</strong> Some spells/abilities grant bonus actions</li>
                <li><strong>Movement:</strong> Move up to your speed</li>
                <li><strong>Free Action:</strong> Drop prone, drop an item, speak</li>
                <li><strong>Reaction (off turn):</strong> Opportunity attack, readied action, some spells</li>
            </ul>
            <h3>Common Actions</h3>
            <ul>
                <li><strong>Attack:</strong> Make one melee or ranged attack</li>
                <li><strong>Cast a Spell:</strong> Cast a spell with casting time of 1 action</li>
                <li><strong>Dash:</strong> Gain extra movement equal to your speed</li>
                <li><strong>Disengage:</strong> Your movement doesn't provoke opportunity attacks</li>
                <li><strong>Dodge:</strong> Attacks against you have disadvantage, you have advantage on DEX saves</li>
                <li><strong>Help:</strong> Give an ally advantage on their next check or attack</li>
                <li><strong>Hide:</strong> Make a Stealth check to hide</li>
                <li><strong>Ready:</strong> Choose a trigger and prepare an action to use as a reaction</li>
            </ul>
        `
    },
    cover: {
        title: '🛡️ Cover',
        content: `
            <h3>Cover Types</h3>
            <ul>
                <li><strong>Half Cover:</strong> +2 to AC and DEX saves (e.g., low wall, furniture, other creatures)</li>
                <li><strong>Three-Quarters Cover:</strong> +5 to AC and DEX saves (e.g., portcullis, arrow slit, thick tree trunk)</li>
                <li><strong>Total Cover:</strong> Can't be targeted directly (e.g., completely behind wall, around corner)</li>
            </ul>
            <p><em>A target has cover only if an attack or effect originates on the opposite side of the cover.</em></p>
        `
    },
    advantage: {
        title: '🎲 Advantage/Disadvantage',
        content: `
            <h3>How It Works</h3>
            <p><strong>Advantage:</strong> Roll 2d20, take the higher result</p>
            <p><strong>Disadvantage:</strong> Roll 2d20, take the lower result</p>
            <p><em>If you have both advantage and disadvantage, they cancel out and you roll normally, regardless of how many you have.</em></p>
            
            <h3>Common Sources of Advantage</h3>
            <ul>
                <li>Attacking a prone enemy (within 5ft)</li>
                <li>Attacking an unseen/hidden enemy</li>
                <li>Help action from an ally</li>
                <li>Some spells and abilities</li>
            </ul>
            
            <h3>Common Sources of Disadvantage</h3>
            <ul>
                <li>Attacking while prone</li>
                <li>Attacking a prone enemy (from range)</li>
                <li>Attacking when you can't see the target</li>
                <li>Some conditions (frightened, poisoned, etc.)</li>
            </ul>
        `
    },
    restTypes: {
        title: '😴 Rests',
        content: `
            <h3>Short Rest (1 hour minimum)</h3>
            <ul>
                <li>Spend Hit Dice to regain HP (roll + CON modifier per die)</li>
                <li>Regain some class abilities</li>
                <li>Warlocks regain spell slots</li>
            </ul>
            
            <h3>Long Rest (8 hours, 6 sleeping)</h3>
            <ul>
                <li>Regain all HP</li>
                <li>Regain spent Hit Dice (up to half your total)</li>
                <li>Regain all spell slots</li>
                <li>Regain all class abilities</li>
                <li>Reset exhaustion by 1 level</li>
            </ul>
            <p><em>You can only benefit from one long rest in a 24-hour period.</em></p>
        `
    },
    movement: {
        title: '🏃 Movement',
        content: `
            <h3>Standard Speeds</h3>
            <ul>
                <li><strong>Walking:</strong> 30ft (most races)</li>
                <li><strong>Swimming/Climbing:</strong> Costs 2ft per 1ft moved (unless special speed)</li>
                <li><strong>Crawling (prone):</strong> Costs 2ft per 1ft moved</li>
                <li><strong>Difficult Terrain:</strong> Costs 2ft per 1ft moved</li>
            </ul>
            
            <h3>Special Movement</h3>
            <ul>
                <li><strong>Jumping:</strong> Long jump = STR score (with 10ft run), half without</li>
                <li><strong>High Jump:</strong> 3 + STR modifier feet (with 10ft run), half without</li>
                <li><strong>Squeezing:</strong> Move through space 1 size smaller, costs 1 extra foot per foot, disadvantage on attacks/DEX saves</li>
            </ul>
        `
    }
};

function showRefDetail(key) {
    const data = quickRefData[key];
    if (!data) return;
    
    const detailDiv = document.getElementById('refDetail');
    detailDiv.innerHTML = `
        <h2>${data.title}</h2>
        ${data.content}
    `;
    
    const backBtn = document.createElement('button');
    backBtn.className = 'control-btn';
    backBtn.textContent = 'Back to Categories';
    backBtn.addEventListener('click', closeRefDetail);
    detailDiv.appendChild(backBtn);
    
    detailDiv.classList.remove('hidden');
}

function closeRefDetail() {
    document.getElementById('refDetail').classList.add('hidden');
}

// Remove global assignments as we now use proper event listeners
// window.showRefDetail = showRefDetail;
// window.closeRefDetail = closeRefDetail;

// ==================== THEMES ====================

const themes = {
    default: 'Default (Parchment)',
    'dark-forest': 'Dark Forest',
    draconic: 'Draconic',
    celestial: 'Celestial',
    underdark: 'Underdark'
};

themeSelector.addEventListener('click', () => {
    const themeList = Object.entries(themes).map(([key, name]) => 
        `<button class="theme-option ${currentTheme === key ? 'active' : ''}" data-theme="${key}">${name}</button>`
    ).join('');
    
    showCustomModal('Choose Theme', themeList, (modal) => {
        modal.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', () => {
                applyTheme(btn.dataset.theme);
                modal.remove();
            });
        });
    });
});

function applyTheme(theme) {
    currentTheme = theme;
    document.body.className = theme !== 'default' ? `theme-${theme}` : '';
    localStorage.setItem('dnd-theme', theme);
    showNotification(`Theme changed to ${themes[theme]}`, 'info');
}

// Apply saved theme on load
if (currentTheme && currentTheme !== 'default') {
    document.body.className = `theme-${currentTheme}`;
}

function showCustomModal(title, content, setupFn) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            <h2>${title}</h2>
            <div class="custom-modal-body">${content}</div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    if (setupFn) setupFn(modal);
    
    // Small delay to trigger transition
    setTimeout(() => modal.classList.remove('hidden'), 10);
}

// ==================== SOUND EFFECTS ====================

const sounds = {
    dice: () => playTone(400, 50),
    connect: () => playTone(600, 100),
    notification: () => playTone(500, 80)
};

function playSound(type) {
    if (!soundEnabled) return;
    
    if (sounds[type]) {
        sounds[type]();
    }
}

function playTone(frequency, duration) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (e) {
        console.warn('Audio not supported', e);
    }
}

// Save sound preference
document.getElementById('soundEffects')?.addEventListener('change', (e) => {
    soundEnabled = e.target.checked;
    localStorage.setItem('dnd-sound', soundEnabled);
});

// ==================== ENHANCED API CACHING WITH INDEXEDDB ====================

async function saveToIndexedDB(endpoint, data) {
    if (!db) return;
    
    try {
        const transaction = db.transaction(['apiCache'], 'readwrite');
        const store = transaction.objectStore('apiCache');
        
        await store.put({
            endpoint: endpoint,
            data: data,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Failed to save to IndexedDB:', error);
    }
}

async function loadFromIndexedDB(endpoint) {
    if (!db) return null;
    
    try {
        const transaction = db.transaction(['apiCache'], 'readonly');
        const store = transaction.objectStore('apiCache');
        const request = store.get(endpoint);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const result = request.result;
                if (result && (Date.now() - result.timestamp < DB_CACHE_DURATION)) {
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
        return null;
    }
}

// Enhanced dice roll with party broadcasting and sound effects
function rollDice(diceType) {
    const count = parseInt(document.getElementById('diceCount').value) || 1;
    const modifier = parseInt(document.getElementById('diceModifier').value) || 0;
    const advantage = document.getElementById('advantageCheck').checked;
    const disadvantage = document.getElementById('disadvantageCheck').checked;
    
    const sides = parseInt(diceType.substring(1));
    const rolls = [];
    
    for (let i = 0; i < count; i++) {
        if (advantage || disadvantage) {
            const roll1 = Math.floor(Math.random() * sides) + 1;
            const roll2 = Math.floor(Math.random() * sides) + 1;
            if (advantage) {
                rolls.push({ roll: Math.max(roll1, roll2), detail: `[${roll1}, ${roll2}] adv` });
            } else {
                rolls.push({ roll: Math.min(roll1, roll2), detail: `[${roll1}, ${roll2}] dis` });
            }
        } else {
            rolls.push({ roll: Math.floor(Math.random() * sides) + 1, detail: '' });
        }
    }
    
    const sum = rolls.reduce((acc, r) => acc + r.roll, 0);
    const total = sum + modifier;
    
    // Display result
    const resultsDiv = document.getElementById('diceResults');
    const rollDetails = rolls.map(r => r.detail ? `${r.roll} ${r.detail}` : r.roll).join(' + ');
    const modifierStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    
    resultsDiv.innerHTML = `
        <div class="dice-result-main">
            <div class="dice-result-total">${total}</div>
            <div class="dice-result-detail">
                ${count}${diceType}: [${rollDetails}] ${modifier !== 0 ? modifierStr : ''}
            </div>
        </div>
    `;
    
    // Add to history
    const historyEntry = {
        dice: `${count}${diceType}`,
        modifier: modifier,
        total: total,
        rolls: rolls.map(r => r.roll),
        timestamp: new Date().toLocaleTimeString()
    };
    
    diceHistory.unshift(historyEntry);
    if (diceHistory.length > 10) {
        diceHistory = diceHistory.slice(0, 10);
    }
    
    localStorage.setItem('dnd-dice-history', JSON.stringify(diceHistory));
    renderDiceHistory();
    
    // Broadcast to party
    if (document.getElementById('shareDiceRolls')?.checked) {
        broadcastToParty({
            type: 'diceRoll',
            result: `${count}${diceType} = ${total}`,
            player: 'You'
        });
    }
    
    // Play sound
    playSound('dice');
    
    // Use 3D dice if enabled
    if (enable3DDice && diceBox) {
        roll3DDice(diceType, count);
    }
}

// ==================== QUALITY OF LIFE FEATURES ====================

// ==================== BOOKMARKS SYSTEM ====================

function openBookmarks() {
    bookmarksModal.classList.remove('hidden');
    renderBookmarks();
}

function closeBookmarksModal() {
    bookmarksModal.classList.add('hidden');
}

bookmarksBtn.addEventListener('click', openBookmarks);
closeBookmarks.addEventListener('click', closeBookmarksModal);

bookmarksModal.addEventListener('click', (e) => {
    if (e.target === bookmarksModal) {
        closeBookmarksModal();
    }
});

function addBookmark(item, category) {
    const bookmarkItem = {
        ...item,
        category: category,
        bookmarkedAt: new Date().toISOString()
    };
    
    // Check if already bookmarked
    const exists = bookmarks.some(b => b.index === item.index && b.category === category);
    if (exists) {
        showNotification('Already bookmarked!', 'info');
        return;
    }
    
    bookmarks.push(bookmarkItem);
    localStorage.setItem('dnd-bookmarks', JSON.stringify(bookmarks));
    updateBookmarkCount();
    showNotification('Added to bookmarks!', 'info');
}

function removeBookmark(index, category) {
    bookmarks = bookmarks.filter(b => !(b.index === index && b.category === category));
    localStorage.setItem('dnd-bookmarks', JSON.stringify(bookmarks));
    updateBookmarkCount();
    renderBookmarks();
    showNotification('Removed from bookmarks', 'info');
}

function updateBookmarkCount() {
    bookmarkCount.textContent = bookmarks.length;
}

function renderBookmarks() {
    const content = document.getElementById('bookmarksContent');
    
    if (bookmarks.length === 0) {
        content.innerHTML = '<p class="empty-state">No bookmarks yet. Click the 🔖 button on any item to bookmark it!</p>';
        return;
    }
    
    // Group by category
    const grouped = {};
    bookmarks.forEach(item => {
        if (!grouped[item.category]) {
            grouped[item.category] = [];
        }
        grouped[item.category].push(item);
    });
    
    content.innerHTML = '';
    Object.entries(grouped).forEach(([cat, items]) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'bookmark-category';
        
        const heading = document.createElement('h3');
        heading.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        categoryDiv.appendChild(heading);
        
        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'bookmark-items';
        
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'bookmark-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'bookmark-name';
            nameSpan.textContent = item.name;
            nameSpan.setAttribute('aria-label', `Load bookmark: ${item.name}`);
            nameSpan.style.cursor = 'pointer';
            nameSpan.addEventListener('click', () => loadItemFromBookmark(item.category, item.index));
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'bookmark-remove';
            removeBtn.textContent = '✕';
            removeBtn.setAttribute('aria-label', `Remove ${item.name}`);
            removeBtn.addEventListener('click', () => removeBookmark(item.index, item.category));
            
            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(removeBtn);
            itemsDiv.appendChild(itemDiv);
        });
        
        categoryDiv.appendChild(itemsDiv);
        content.appendChild(categoryDiv);
    });
}

function loadItemFromBookmark(category, index) {
    if (currentCategory !== category) {
        currentCategory = category;
        categoryBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
        loadCategory(category).then(() => {
            loadDetails(index);
        });
    } else {
        loadDetails(index);
    }
    closeBookmarksModal();
}

window.removeBookmark = removeBookmark;
window.loadItemFromBookmark = loadItemFromBookmark;

// Clear all bookmarks
document.getElementById('clearBookmarks').addEventListener('click', () => {
    if (confirm('Clear all bookmarks?')) {
        bookmarks = [];
        localStorage.setItem('dnd-bookmarks', JSON.stringify(bookmarks));
        updateBookmarkCount();
        renderBookmarks();
        showNotification('All bookmarks cleared', 'info');
    }
});

// Export bookmarks
document.getElementById('exportBookmarks').addEventListener('click', () => {
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dnd-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('Bookmarks exported!', 'info');
});

// Import bookmarks
document.getElementById('importBookmarks').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (Array.isArray(imported)) {
                    // Merge with existing bookmarks
                    imported.forEach(item => {
                        if (!bookmarks.some(b => b.index === item.index && b.category === item.category)) {
                            bookmarks.push(item);
                        }
                    });
                    localStorage.setItem('dnd-bookmarks', JSON.stringify(bookmarks));
                    updateBookmarkCount();
                    renderBookmarks();
                    showNotification(`Imported ${imported.length} bookmarks!`, 'info');
                } else {
                    showNotification('Invalid JSON format', 'warning');
                }
            } catch (error) {
                showNotification('Failed to import bookmarks', 'warning');
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

// Initialize bookmark count
updateBookmarkCount();

// ==================== SEARCH HISTORY ====================

function addToSearchHistory(searchTerm, category) {
    if (!searchTerm || searchTerm.trim() === '') return;
    
    const historyItem = {
        term: searchTerm.trim(),
        category: category,
        timestamp: new Date().toISOString()
    };
    
    // Remove duplicates
    searchHistory = searchHistory.filter(item => 
        !(item.term.toLowerCase() === historyItem.term.toLowerCase() && item.category === category)
    );
    
    // Add to beginning
    searchHistory.unshift(historyItem);
    
    // Limit to 20 items
    if (searchHistory.length > 20) {
        searchHistory = searchHistory.slice(0, 20);
    }
    
    localStorage.setItem('dnd-search-history', JSON.stringify(searchHistory));
}

function toggleSearchHistory() {
    searchHistoryPanel.classList.toggle('hidden');
    if (!searchHistoryPanel.classList.contains('hidden')) {
        renderSearchHistory();
    }
}

function renderSearchHistory() {
    const list = document.getElementById('searchHistoryList');
    
    if (searchHistory.length === 0) {
        list.innerHTML = '<p class="empty-state">No search history yet</p>';
        return;
    }
    
    list.innerHTML = '';
    searchHistory.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'search-history-item';
        historyItem.setAttribute('aria-label', `Search for ${item.term} in ${item.category}`);
        historyItem.innerHTML = `
            <span class="history-term">${escapeHtml(item.term)}</span>
            <span class="history-category">${escapeHtml(item.category)}</span>
            <span class="history-time">${new Date(item.timestamp).toLocaleDateString()}</span>
        `;
        historyItem.addEventListener('click', () => applySearchFromHistory(index));
        list.appendChild(historyItem);
    });
}

function applySearchFromHistory(index) {
    const item = searchHistory[index];
    if (item) {
        // Switch category if needed
        if (currentCategory !== item.category) {
            currentCategory = item.category;
            categoryBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === item.category);
            });
            loadCategory(item.category).then(() => {
                searchInput.value = item.term;
                performSearch();
            });
        } else {
            searchInput.value = item.term;
            performSearch();
        }
        toggleSearchHistory();
    }
}

window.applySearchFromHistory = applySearchFromHistory;

searchHistoryBtn.addEventListener('click', toggleSearchHistory);

document.getElementById('clearSearchHistory').addEventListener('click', () => {
    if (confirm('Clear search history?')) {
        searchHistory = [];
        localStorage.setItem('dnd-search-history', JSON.stringify(searchHistory));
        renderSearchHistory();
        showNotification('Search history cleared', 'info');
    }
});

// Add search history tracking to performSearch
const originalPerformSearch = performSearch;
function performSearch() {
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        addToSearchHistory(searchTerm, currentCategory);
    }
    return originalPerformSearch ? originalPerformSearch() : null;
}

// ==================== 3D DICE INTEGRATION ====================

async function init3DDice() {
    if (!window.DiceBox || diceBox) return;
    
    try {
        diceBox = new window.DiceBox({
            id: 'dice3DContainer',
            assetPath: 'https://unpkg.com/@3d-dice/dice-box@1.1.4/dist/',
            theme: 'default',
            scale: 5
        });
        
        await diceBox.init();
        console.log('3D Dice initialized');
    } catch (error) {
        console.error('Failed to initialize 3D dice:', error);
        showNotification('Failed to load 3D dice. Using 2D mode.', 'warning');
        enable3DDice = false;
    }
}

async function roll3DDice(diceType, count) {
    if (!diceBox) {
        await init3DDice();
    }
    
    if (!diceBox) return;
    
    try {
        const notation = `${count}${diceType}`;
        await diceBox.roll(notation);
        document.getElementById('dice3DContainer').classList.remove('hidden');
    } catch (error) {
        console.error('Failed to roll 3D dice:', error);
    }
}

if (enable3DDiceCheckbox) {
    enable3DDiceCheckbox.checked = enable3DDice;
    
    enable3DDiceCheckbox.addEventListener('change', async (e) => {
        enable3DDice = e.target.checked;
        localStorage.setItem('dnd-3d-dice', enable3DDice);
        
        if (enable3DDice) {
            document.getElementById('dice3DContainer').classList.remove('hidden');
            await init3DDice();
        } else {
            document.getElementById('dice3DContainer').classList.add('hidden');
        }
    });
}

// Initialize 3D dice if enabled
if (enable3DDice && window.DiceBox) {
    init3DDice();
}

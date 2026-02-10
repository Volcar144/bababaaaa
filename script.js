// API Configuration
const API_BASE_URL = 'https://www.dnd5eapi.co/api';

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

// API Functions
async function fetchFromAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            // Check if we're offline and service worker provided cached data
            if (response.status === 503 && isOffline) {
                throw new Error('Offline - no cached data');
            }
            throw new Error('Network response was not ok');
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
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
                    data-index="${item.index}" 
                    title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
                ${isFavorited ? '⭐' : '☆'}
            </button>
            <button class="card-action-btn compare-btn" 
                    data-index="${item.index}" 
                    title="${isSelected ? 'Remove from compare' : 'Add to compare'}">
                ${isSelected ? '✓' : '🔄'}
            </button>
        </div>
        <h3>${icon} ${item.name}</h3>
        <span class="badge">${currentCategory}</span>
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
        <h2>${getCategoryIcon(currentCategory)} ${data.name}</h2>
        <div style="margin: 10px 0; display: flex; gap: 10px; flex-wrap: wrap;">
            <button onclick="copyShareLink('${shareUrl}')" style="padding: 8px 16px; background: linear-gradient(135deg, var(--accent) 0%, #a0552f 100%); color: var(--parchment); border: 2px solid var(--gold); border-radius: 8px; cursor: pointer; font-weight: bold;">
                🔗 Copy Share Link
            </button>
            <button onclick="togglePin('${data.index}', '${data.name.replace(/'/g, "\\'")}', '${currentCategory}')" style="padding: 8px 16px; background: linear-gradient(135deg, var(--accent) 0%, #a0552f 100%); color: var(--parchment); border: 2px solid var(--gold); border-radius: 8px; cursor: pointer; font-weight: bold;">
                ${isPinned(data.index) ? '📍 Unpin' : '📌 Pin'}
            </button>
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
                    <h4>${getCategoryIcon(fav.category)} ${fav.name}</h4>
                    <span class="badge">${fav.category}</span>
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
        pinnedItemsContainer.innerHTML = pinnedItems.map(item => `
            <button onclick="loadItemFromQuickAccess('${item.category}', '${item.index}')" 
                    style="padding: 8px 12px; background: linear-gradient(135deg, var(--accent) 0%, #a0552f 100%); color: var(--parchment); border: 2px solid var(--gold); border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 0.85rem;">
                📌 ${getCategoryIcon(item.category)} ${item.name}
            </button>
        `).join('');
    } else {
        pinnedItemsContainer.innerHTML = '<p style="color: #666; font-style: italic; margin: 0;">No pinned items yet. Pin items from their detail view!</p>';
    }
    
    // Update recent items
    if (recentItems.length > 0) {
        recentItemsContainer.innerHTML = recentItems.slice(0, 10).map(item => `
            <button onclick="loadItemFromQuickAccess('${item.category}', '${item.index}')" 
                    style="padding: 6px 10px; background: var(--dark-parchment); color: var(--ink); border: 2px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 0.8rem;">
                ${getCategoryIcon(item.category)} ${item.name}
            </button>
        `).join('');
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

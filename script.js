// API Configuration
const API_BASE_URL = 'https://www.dnd5eapi.co/api';

// State management
let currentCategory = 'spells';
let allResults = [];

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('results');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const modal = document.getElementById('detailModal');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.querySelector('.close-btn');
const categoryBtns = document.querySelectorAll('.category-btn');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadCategory(currentCategory);
});

categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        searchInput.value = '';
        loadCategory(currentCategory);
    });
});

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

// API Functions
async function fetchFromAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function loadCategory(category) {
    showLoading();
    hideError();
    resultsContainer.innerHTML = '';

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
    
    card.innerHTML = `
        <h3>${icon} ${item.name}</h3>
        <span class="badge">${currentCategory}</span>
        <p class="description">Click to view details</p>
    `;

    card.addEventListener('click', () => loadDetails(item.index));

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
        displayDetails(data);
    } catch (error) {
        modalBody.innerHTML = '<p style="text-align: center; padding: 40px; color: #c62828;">Failed to load details. Please try again.</p>';
    } finally {
        hideLoading();
    }
}

function displayDetails(data) {
    let content = `<h2>${getCategoryIcon(currentCategory)} ${data.name}</h2>`;

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

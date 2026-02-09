# 🐉 D&D 5e Lookup Tool

An amazing, interactive lookup tool for Dungeons & Dragons 5th Edition content. Browse spells, monsters, classes, equipment, and magic items with a beautiful fantasy-themed interface!

![D&D 5e Lookup Tool](https://github.com/user-attachments/assets/d308ba71-f142-4f9d-9a77-80f8a71a6ca4)

## ✨ Features

- **Beautiful Fantasy UI**: Parchment-themed design with animated elements
- **Multiple Categories**: Browse Spells, Monsters, Classes, Equipment, and Magic Items
- **Real-time Search**: Filter results as you type
- **Detailed Views**: Click any item to see comprehensive details in a modal
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Pure Vanilla Stack**: Built with plain HTML, CSS, and JavaScript - no frameworks needed!

## 🎮 Categories

- **✨ Spells**: View spell details including level, school, casting time, range, components, and descriptions
- **👹 Monsters**: Explore creature stats, abilities, actions, and challenge ratings
- **⚔️ Classes**: Learn about character classes, proficiencies, and spellcasting abilities
- **🛡️ Equipment**: Browse weapons, armor, and gear with costs and properties
- **💎 Magic Items**: Discover magical treasures and their powerful effects

## 🚀 Getting Started

### Quick Start

1. Simply open `index.html` in your web browser
2. Or serve it with any web server:
   ```bash
   # Python 3
   python -m http.server 8080
   
   # Python 2
   python -m SimpleHTTPServer 8080
   
   # Node.js (with http-server)
   npx http-server
   ```
3. Navigate to `http://localhost:8080`

### GitHub Pages

You can also deploy this to GitHub Pages for free hosting:

1. Go to your repository settings
2. Navigate to Pages section
3. Select your branch and root folder
4. Your site will be live at `https://yourusername.github.io/bababaaaa/`

## 🎨 Design Features

- **Parchment Background**: Authentic fantasy aesthetic with textured backgrounds
- **Gold & Brown Theme**: Rich colors inspired by ancient tomes
- **Smooth Animations**: Floating dragons, hover effects, and transitions
- **Loading States**: Visual feedback while fetching data
- **Error Handling**: Graceful error messages with helpful guidance
- **Accessibility**: Semantic HTML and keyboard-friendly navigation

## 🔧 Technical Details

### Stack
- **HTML5**: Semantic markup with accessibility in mind
- **CSS3**: Modern styling with CSS Grid, Flexbox, and animations
- **Vanilla JavaScript**: No dependencies, pure ES6+ code
- **D&D 5e API**: Powered by [D&D 5e API](https://www.dnd5eapi.co/)

### File Structure
```
├── index.html      # Main HTML structure
├── styles.css      # All styling and animations
├── script.js       # API integration and interactivity
└── README.md       # Documentation
```

## 📖 How It Works

The tool fetches data from the free [D&D 5e API](https://www.dnd5eapi.co/) and displays it in an intuitive, searchable interface:

1. **Category Selection**: Choose what type of content to browse
2. **Data Fetching**: API calls load the relevant data
3. **Display**: Results shown in a responsive grid layout
4. **Search**: Filter results in real-time using the search bar
5. **Details**: Click any item to see full details in a modal

## 🎯 Usage Examples

### Searching for Spells
1. Click the "Spells" category button
2. Type a spell name in the search bar (e.g., "fireball")
3. Click on a spell card to see full details including damage, range, and casting time

### Browsing Monsters
1. Select the "Monsters" category
2. Scroll through the creature list
3. Click any monster to view its stats, abilities, and challenge rating

### Finding Equipment
1. Choose "Equipment" category
2. Search for specific items (e.g., "sword")
3. View item details including cost, weight, and damage

## 🌟 Features Showcase

- **Instant Loading**: Fast API responses with loading indicators
- **Smart Search**: Case-insensitive filtering across all items
- **Rich Details**: Comprehensive information for each item type
- **Modal Windows**: Clean, focused detail views
- **Category Badges**: Visual indicators for item types
- **Stat Blocks**: Organized display of game statistics

## 🛡️ Browser Support

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## 📜 License & Credits

- **API**: All D&D 5e content provided by [D&D 5e API](https://www.dnd5eapi.co/)
- **Content**: All D&D content is property of Wizards of the Coast
- **Code**: Created as an open-source lookup tool

## 🎲 Perfect For

- Players looking up spells during sessions
- DMs preparing encounters and monsters
- Character creation and planning
- Learning about D&D 5e mechanics
- Quick reference during gameplay

## 🔮 Future Enhancements

Potential additions:
- Offline mode with cached data
- Favorites/bookmarking system
- Advanced filtering options
- Character sheet integration
- Custom content support
- Dark mode toggle

---

**Made with ❤️ for the D&D community**
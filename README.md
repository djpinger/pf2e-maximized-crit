# Alternative Critical Damage

A Foundry VTT module for Pathfinder 2e that provides an alternative critical hit damage calculation method.

## Overview
This Foundry VTT module for the Pathfinder 2e system changes how critical hit damage is calculated. Instead of doubling damage dice (e.g., `2d6+8` becomes `4d6+16`), it rolls dice once and adds the maximum possible die value (e.g., `2d6+8` becomes `2d6+12+16`).

## Installation

### Option 1: Foundry VTT Module Manager (Recommended)
1. Open Foundry VTT and navigate to the **Setup** screen
2. Click **Add-on Modules** 
3. Click **Install Module**
4. Paste this manifest URL into the **Manifest URL** field:
   ```
   https://github.com/djpinger/pf2e-maximized-crit/releases/latest/download/module.json
   ```
5. Click **Install**
6. Enable the module in your world's **Manage Modules** settings

### Option 2: Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/djpinger/pf2e-maximized-crit/releases)
2. Extract the zip file to your Foundry `Data/modules/` directory
3. Enable the module in your world's **Manage Modules** settings

## Key Features
- Adds a third "Alt Crit" button to attack roll chat cards
- Works with weapons, spells, and other damage-dealing items
- Configurable settings for static modifier doubling
- Compatible with PF2e's complex damage system
- **Enhanced weapon support**: Deadly traits, persistent damage, splash damage, striking runes
- **Damage categories**: Proper handling of persistent, precision, and splash damage
- **PF2e DamageRoll integration**: Uses official PF2e damage rolling system
- **Complex damage structures**: Multi-component damage with proper type handling

## File Structure
```
alternative-crit-damage/
├── module.json          # Module manifest
├── scripts/
│   └── main.js         # Main module code
└── README.md           # User documentation
```

## How It Works

### 1. Button Detection and Injection
The module hooks into `renderChatMessage` to detect attack roll messages and add the "Alt Crit" button:

```javascript
// Looks for these button types
const strikeButtons = html.find('button[data-action="strike-damage"]');
const damageButtons = html.find('button[data-action="damage-roll"]');
const spellButtons = html.find('button[data-action="spell-damage"]');
```

### 2. PF2e Damage Structure Parsing
PF2e stores weapon damage in complex formats that the module now fully supports:

**Basic Weapon Damage:**
```javascript
{
  "dice": 2,
  "die": "d6",
  "damageType": "piercing",
  "modifier": 0
}
```

**Advanced Weapon Features:**
- **Striking Runes**: Separates base weapon dice from rune dice
- **Deadly Traits**: Adds extra dice on critical hits
- **Persistent Damage**: Handled with proper category formatting
- **Splash Damage**: Area damage with splash category
- **Bonus Damage**: Additional weapon-specific damage

### 3. Alternative Critical Calculation
The enhanced calculation now handles complex damage structures:

**For Critical Hits:**
1. Base weapon dice: `XdY` → `(XdY+X*Y+0)` (roll + max die value)
2. Striking rune dice: Remain as standard rolls
3. Deadly trait dice: Added as standard rolls on crits
4. Persistent/Splash: Proper category formatting with brackets
5. Static modifiers: Optionally doubled based on settings

**Examples:**
- Simple: `1d6+4` → `(1d6+6+4)[piercing]` or `(1d6+6+8)[piercing]`
- Striking: `2d6+4` → `(1d6+6+0)[piercing],(1d6+0)[piercing]` + modifiers
- Deadly: Adds `(1d10+0)[piercing]` for deadly-d10 weapons on crits
- Persistent: `((0+3)[persistent])[fire]` for 3 persistent fire damage

## Code Architecture

### Main Functions

#### `handleAlternativeCritical(message, button)`
- Extracts item and actor from chat message
- Determines if attack was actually a critical hit
- Calls damage calculation function

#### `rollAlternativeCriticalDamage(item, actor, isCriticalHit)`
- Parses complex weapon/spell damage structures
- Handles weapon traits, runes, and special damage types
- Builds multi-component damage formulas with proper categories
- Uses PF2e DamageRoll class for accurate damage handling
- Creates and sends multiple damage rolls to chat

### Critical Code Sections

#### Enhanced Damage Formula Creation
```javascript
// Creates damage with proper PF2e formatting
function createDamageFormula(num, die, mod, damageType, category = '') {
    let formula = '';
    
    // Crit formula: dice + max die value + modifier
    if (num && die) {
        formula = `(${num}d${die}+${num * die}+${mod})`;
    } else if (mod) {
        formula = `${mod}`;
    }
    
    // Add damage category (persistent, splash, etc.)
    if (category !== '') {
        formula = `((${formula})[${category}])`;
    }
    
    // Add damage type
    formula += `[${damageType || 'untyped'}]`;
    return formula;
}
```

#### Advanced Weapon Parsing Logic
```javascript
// Handles complex weapon features
function parseWeaponDamage(item, isCriticalHit) {
    const { damage, runes, traits } = item.system;
    const formulaParts = [];
    
    // Base weapon dice (excluding striking runes for crit calc)
    const baseDice = damage.dice - (runes?.striking || 0);
    if (baseDice > 0) {
        if (isCriticalHit) {
            formulaParts.push(createDamageFormula(baseDice, dieType, 0, damage.damageType));
        } else {
            formulaParts.push(createStandardDamageFormula(baseDice, dieType, 0, damage.damageType));
        }
    }
    
    // Striking runes (always standard rolls)
    if (runes?.striking > 0) {
        formulaParts.push(createStandardDamageFormula(runes.striking, dieType, 0, damage.damageType));
    }
    
    // Deadly trait (extra dice on crit)
    const deadlyTrait = traits.find(t => t.startsWith('deadly-'));
    if (deadlyTrait && isCriticalHit) {
        const deadlyDie = deadlyTrait.split('-d')[1];
        formulaParts.push(createStandardDamageFormula(1, deadlyDie, 0, damage.damageType));
    }
    
    // Persistent damage
    if (damage.persistent) {
        formulaParts.push(createDamageFormula(0, dieType, damage.persistent.number, 
                                           damage.persistent.type, 'persistent'));
    }
    
    return formulaParts.join(',');
}
```

## Common Issues & Solutions

### Issue: Button Not Appearing
**Symptoms:** No "Alt Crit" button shows up on attack rolls
**Debug:** Check console for "Alternative Critical Damage" messages
**Solutions:**
1. Verify module is enabled in Module Management
2. Ensure attack message has an associated item (`message.item`)
3. Check if damage buttons are being detected correctly

### Issue: "No damage formula found"
**Symptoms:** Button appears but clicking shows "No damage formula found"
**Debug:** Look for damage structure in console logs
**Solutions:**
1. Enhanced parsing now supports most PF2e item types automatically
2. Check console for detailed damage structure logging
3. Verify the item has proper PF2e damage data
4. For custom items, ensure damage follows PF2e format standards

### Issue: Incorrect Damage Calculation
**Symptoms:** Wrong damage formula or amounts  
**Debug:** Check console for "Final Formula:" output
**Solutions:**
1. Enhanced parsing now handles weapon traits, runes, and special damage
2. Check if weapon has deadly traits, striking runes, or persistent damage
3. Verify damage categories are being applied correctly (persistent, splash)
4. Ensure PF2e DamageRoll class is being used properly

## Troubleshooting Commands

### Console Debugging
```javascript
// Enable detailed logging
game.settings.set('alternative-crit-damage', 'debug', true);

// Inspect item damage structure
const item = game.actors.getName("ActorName").items.getName("WeaponName");
console.log('Damage:', item.system.damage);
console.log('Traits:', item.system.traits.value);
console.log('Runes:', item.system.runes);
console.log('Splash:', item.system.splashDamage);
console.log('Bonus:', item.system.bonusDamage);

// Test enhanced damage parsing
const system = item.system;
console.log('Full system structure:', JSON.stringify(system, null, 2));
```

### Manual Testing
1. Make attack roll with weapon
2. Check console for module loading messages
3. Verify button appears and has click handler
4. Click button and check for formula generation
5. Confirm damage roll appears in chat

## Module Settings

### `enabled` (Boolean, default: true)
- Controls whether the module is active
- When disabled, no buttons are added

### `doubleStatic` (Boolean, default: true) 
- Whether to double static damage modifiers on crits
- When true: `1d6+4` → `1d6+6+8`
- When false: `1d6+4` → `1d6+6+4`

## Extending the Module

### Adding New Item Types
The enhanced system now automatically handles most PF2e item types. For truly custom items:

```javascript
// Add to parseWeaponDamage() or create new parse function
function parseCustomItemDamage(item, isCriticalHit) {
    const damage = item.system.customDamage;
    if (damage && damage.dice && damage.die) {
        const dieType = damage.die.split('d')[1];
        if (isCriticalHit) {
            return createDamageFormula(damage.dice, dieType, damage.modifier || 0, 
                                     damage.damageType || 'untyped', damage.category || '');
        } else {
            return createStandardDamageFormula(damage.dice, dieType, damage.modifier || 0,
                                             damage.damageType || 'untyped', damage.category || '');
        }
    }
    return null;
}
```

### Supporting Different Button Types
Add new button selectors to the detection logic:

```javascript
const customButtons = html.find('button[data-action="custom-damage"]');
const hasDamageButtons = strikeButtons.length > 0 || 
                       damageButtons.length > 0 || 
                       customButtons.length > 0;
```

### Modifying Calculation Logic
The enhanced system uses separate functions for damage creation:

- `createDamageFormula()`: For critical damage (dice + max + modifier)
- `createStandardDamageFormula()`: For non-critical damage
- `parseWeaponDamage()`: Handles complex weapon parsing
- `parseSpellDamage()`: Handles spell damage structures

Modify these functions to change calculation behavior.

## PF2e System Integration

### Hooks Used
- `init`: Register module settings
- `ready`: System compatibility check
- `renderChatMessage`: Button injection and click handling

### PF2e-Specific Code
- Uses `ChatMessage.getSpeaker({ actor })` for proper attribution
- Respects `game.settings.get('core', 'rollMode')` for roll privacy
- **Enhanced PF2e integration**:
  - Uses `CONFIG.Dice.rolls` to find PF2e DamageRoll class
  - Proper damage category formatting with brackets
  - Handles PF2e weapon traits (deadly, persistent, etc.)
  - Supports striking runes and weapon specialization
  - Creates multiple damage rolls for complex damage structures

### Critical Hit Detection
```javascript
const attackOutcome = message.flags?.pf2e?.context?.outcome;
const isCriticalHit = attackOutcome === 'criticalSuccess';
```

## Version Compatibility

### Foundry VTT
- **Minimum:** v11
- **Verified:** v13
- **Current:** Uses modern API (no deprecated methods)

### PF2e System
- **Target:** Latest stable release
- **Dependencies:** Requires PF2e system to be active
- **Compatibility:** Uses standard PF2e item structure

## Development Workflow

### Making Changes
1. Edit `/scripts/main.js`
2. Copy updated file to Foundry Data modules directory
3. Refresh Foundry VTT (F5)
4. Test with various weapon types
5. Check console for errors/warnings

### Testing Checklist
- [ ] Button appears on weapon attacks
- [ ] Button appears on spell attacks
- [ ] **Enhanced damage features work**:
  - [ ] Deadly weapons add extra dice on crits
  - [ ] Striking runes are handled separately
  - [ ] Persistent damage shows with [persistent] category
  - [ ] Splash damage shows with [splash] category
  - [ ] Multiple damage types display correctly
- [ ] Settings are respected (static modifier doubling)
- [ ] No console errors
- [ ] Works with critical hits and normal attacks
- [ ] PF2e DamageRoll integration functions properly

### Common Pitfalls
1. **Foundry API Changes:** Keep up with deprecation warnings
2. **PF2e Updates:** Item structure may change between versions
3. **Module Conflicts:** Other modules may interfere with chat rendering
4. **Performance:** Don't add expensive operations to `renderChatMessage`

## Useful Resources

### Foundry VTT API
- **Hooks:** https://foundryvtt.com/api/classes/client.Hooks.html
- **Roll System:** https://foundryvtt.com/api/classes/client.Roll.html
- **Chat Messages:** https://foundryvtt.com/api/classes/client.ChatMessage.html

### PF2e System
- **GitHub:** https://github.com/foundryvtt/pf2e
- **Damage System:** `/src/module/system/damage/`
- **Item Types:** `/src/module/item/`

### Development Tools
- **Browser DevTools:** F12 for console, debugging
- **Foundry Logs:** Check Data/logs/ for system logs
- **Module Inspector:** Foundry's built-in module management

## Support Information
- **Created for:** Pathfinder 2e alternative critical damage house rule
- **Author:** Generated AI Code - Because javascript is not my thing
- **License:** Use and modify as needed
- **Issues:** Check console logs first, then examine item damage structure

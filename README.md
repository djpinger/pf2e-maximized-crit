# Alternative Critical Damage

A Foundry VTT module for Pathfinder 2e that provides an alternative critical hit damage calculation method with intelligent damage detection.

## Overview
This Foundry VTT module for the Pathfinder 2e system changes how critical hit damage is calculated. Instead of doubling damage dice (e.g., `2d6+8` becomes `4d6+16`), it rolls dice once and adds the maximum possible die value (e.g., `2d6+8` becomes `2d6+12+16`).

**Version 1.1.8** introduces smart damage detection that captures complete PF2e damage structures, including all dynamic modifiers like class features, ensuring accurate alternative critical calculations.

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
- **Smart damage detection**: Captures complete PF2e damage data for accurate calculations
- **Hybrid calculation modes**: Works with or without prior damage rolls
- **Full modifier support**: Includes all dynamic bonuses (Strength, Precise Strike, etc.)
- **Enhanced weapon support**: Deadly traits, persistent damage, splash damage, striking runes
- **Damage categories**: Proper handling of persistent, precision, and splash damage
- **PF2e DamageRoll integration**: Uses official PF2e damage rolling system
- **Configurable settings**: Optional static modifier doubling

## File Structure
```
alternative-crit-damage/
├── module.json          # Module manifest
├── scripts/
│   └── main.js         # Main module code
└── README.md           # User documentation
```

## How It Works

The module uses a sophisticated **hybrid approach** to calculate alternative critical damage, combining smart damage detection with fallback methods for maximum compatibility.

### 1. Smart Damage Detection System

**Damage Roll Capture:**
The module automatically captures PF2e damage roll data when created:
```javascript
Hooks.on("createChatMessage", (message) => {
  if (message.rolls[0]?.constructor.name === "DamageRoll") {
    // Capture complete damage structure including:
    // - Base weapon damage
    // - All dynamic modifiers (Strength, Precise Strike, etc.)
    // - Weapon traits (Deadly, Fatal, etc.)
    // - Damage categories (precision, splash, persistent)
  }
});
```

**Data Structure Captured:**
```javascript
{
  base: [{ diceNumber: 2, dieSize: "d6", damageType: "piercing" }],
  modifiers: [
    { modifier: 1, damageCategory: null }, // Strength
    { modifier: 3, damageCategory: "precision" } // Precise Strike
  ],
  dice: [
    { diceNumber: 1, dieSize: "d8", critical: true } // Deadly d8
  ]
}
```

### 2. Hybrid Calculation Modes

**Mode A: Enhanced Accuracy (Recommended)**
1. Make a normal damage roll first
2. Click "Alt Crit" within 30 seconds
3. **Result**: Perfect calculation with ALL modifiers included

**Mode B: Direct Calculation (Fallback)**
1. Click "Alt Crit" directly (no prior roll needed)
2. Uses available weapon/actor data
3. **Result**: Good calculation with basic modifiers (may miss complex bonuses like Precise Strike)

### 3. Alternative Critical Logic

**For Alternative Critical Hits:**
- **Base Dice**: `XdY` → `(XdY + X×Y)` (roll dice + add maximum possible value)
- **Static Modifiers**: Optionally doubled based on settings
- **Deadly/Fatal Traits**: Added as normal rolls on crits
- **Precision Damage**: Properly categorized and doubled
- **Persistent/Splash**: Correct category formatting

**Example Calculation:**
```
Normal Crit: 2d6+1+3 → 4d6+2+6 (doubled everything)
Alt Crit:    2d6+1+3 → (2d6+12)[piercing], 2[untyped], (6[precision])[untyped], (1d8)[piercing]
```

This gives more consistent damage while maintaining the excitement of rolling dice.

## Usage Guide

### Getting Started
1. **Enable the module** in your world's Module Management settings
2. **Make an attack roll** with any weapon or spell
3. **Look for the "Alt Crit" button** that appears next to normal damage buttons
4. **Click "Alt Crit"** to generate alternative critical damage

### For Best Results (Recommended Workflow)
1. **Roll attack** → Click normal **"Damage"** button
2. **Within 30 seconds** → Click **"Alt Crit"** button  
3. **Result**: Perfect alternative critical damage with all modifiers

### Quick Usage (Acceptable Results)  
1. **Roll attack** → Click **"Alt Crit"** directly
2. **Result**: Good alternative critical damage (may miss some complex modifiers)

### What You'll See
**Normal Critical Damage:**
```
Attack: +1 Striking Rapier
Damage: 4d6+2+6 = 24 piercing damage
```

**Alternative Critical Damage:**
```
Attack: +1 Striking Rapier  
Alt Crit: (2d6+12)[piercing] + 2[untyped] + (6[precision])[untyped] + (1d8)[piercing]
Result: 8+2+6+4 = 20 piercing damage (more consistent!)
```

### Settings
- **Enable Alternative Critical Button**: Toggle the module on/off
- **Double Static Modifiers**: Whether to double flat bonuses on alternative crits (default: true)

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
**Solutions:**
1. **Check Module Status**: Verify module is enabled in Module Management
2. **Verify PF2e System**: Module only works with Pathfinder 2e system
3. **Attack Message**: Ensure the attack message has an associated weapon/spell item
4. **Console Check**: Look for "Alternative Critical Damage v1.1.8" loading messages

### Issue: Missing Modifiers (Like Precise Strike)
**Symptoms:** Alt Crit shows basic damage but missing class feature bonuses
**Recommended Solution:**
1. **Make normal damage roll first** (click regular "Damage" button)
2. **Then click "Alt Crit"** within 30 seconds
3. This captures ALL modifiers including complex ones like Precise Strike

**Alternative (Partial Results):**
- Click "Alt Crit" directly without prior roll
- Will include basic modifiers but may miss complex class features
- Note appears in chat message indicating potential missing modifiers

### Issue: "No recent damage data found" 
**Symptoms:** Always falls back to legacy method
**Debug Steps:**
1. Check console for "Capturing damage roll data" messages
2. Verify item IDs match between normal roll and Alt Crit
3. Ensure clicking Alt Crit within 30 seconds of normal damage roll

**Solutions:**
1. Make sure you're clicking the damage button (not just attack)
2. Try clicking Alt Crit immediately after damage roll
3. Check console for detailed matching logic

### Issue: Calculation Seems Wrong
**Symptoms:** Damage amounts don't match expectations
**Understanding the Formula:**
- **Base Dice**: `2d6` becomes `(2d6+12)` (roll + max value 12)  
- **Modifiers**: Doubled if "Double Static Modifiers" setting is enabled
- **Deadly Traits**: Added as normal rolls (not maximized)
- **Categories**: Precision damage properly labeled with `[precision]`

**Debug Console Commands:**
```javascript
// Check what data was captured from your last damage roll
console.log(lastDamageRollData);

// Inspect your weapon's damage structure  
const weapon = game.actors.getName("YourActor").items.getName("YourWeapon");
console.log("Weapon damage:", weapon.system.damage);
console.log("Weapon traits:", weapon.system.traits.value);
```

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

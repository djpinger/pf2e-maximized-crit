# Alternative Critical Damage - Development Documentation

## Overview
This Foundry VTT module for the Pathfinder 2e system changes how critical hit damage is calculated. Instead of doubling damage dice (e.g., `2d6+8` becomes `4d6+16`), it rolls dice once and adds the maximum possible die value (e.g., `2d6+8` becomes `2d6+12+16`).

## Key Features
- Adds a third "Alt Crit" button to attack roll chat cards
- Works with weapons, spells, and other damage-dealing items
- Configurable settings for static modifier doubling
- Compatible with PF2e's complex damage system

## File Structure
```
alternative-crit-damage/
├── module.json          # Module manifest
├── scripts/
│   └── main.js         # Main module code
├── README.md           # User documentation
└── CLAUDE.md          # This development documentation
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
PF2e stores weapon damage in this format:
```javascript
{
  "dice": 2,           // Number of dice
  "die": "d6",         // Die type
  "damageType": "piercing",
  "modifier": 0        // Static modifier
}
```

The module converts this to: `${dice}${die}+${modifier}` (e.g., "2d6+4")

### 3. Alternative Critical Calculation
For each die term in the damage:
1. Keep original dice (don't double)
2. Add maximum possible value as a flat bonus
3. Optionally double static modifiers based on settings

Example: `1d6+4` → `1d6+6+8` (roll + max die + doubled modifier)

## Code Architecture

### Main Functions

#### `handleAlternativeCritical(message, button)`
- Extracts item and actor from chat message
- Determines if attack was actually a critical hit
- Calls damage calculation function

#### `rollAlternativeCriticalDamage(item, actor, isCriticalHit)`
- Parses weapon/spell damage structure
- Builds alternative damage formula
- Creates and sends damage roll to chat

### Critical Code Sections

#### Damage Formula Parsing
```javascript
// Method 1: PF2e format with dice/die properties
if (baseDamage.dice && baseDamage.die) {
    const modifier = baseDamage.modifier || 0;
    damageFormula = `${baseDamage.dice}${baseDamage.die}`;
    if (modifier !== 0) {
        damageFormula += modifier >= 0 ? `+${modifier}` : modifier;
    }
    damageType = baseDamage.damageType || 'untyped';
}
```

#### Alternative Critical Logic
```javascript
for (const term of roll.terms) {
    if (term instanceof foundry.dice.terms.DiceTerm) {
        // Add original dice
        newTerms.push(term);
        
        if (isCriticalHit) {
            // Add maximum die value
            const maxValue = term.number * term.faces;
            newTerms.push(new foundry.dice.terms.OperatorTerm({ operator: '+' }));
            newTerms.push(new foundry.dice.terms.NumericTerm({ number: maxValue }));
        }
    }
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
1. Add new damage parsing method for unsupported item types
2. Check `item.system.damage` structure
3. Verify the item actually has damage data

### Issue: Incorrect Damage Calculation
**Symptoms:** Wrong damage formula or amounts
**Debug:** Check console for "Formula:" output
**Solutions:**
1. Verify dice term parsing logic
2. Check static modifier handling
3. Ensure settings are applied correctly

## Troubleshooting Commands

### Console Debugging
```javascript
// Enable detailed logging
game.settings.set('alternative-crit-damage', 'debug', true);

// Inspect item damage structure
const item = game.actors.getName("ActorName").items.getName("WeaponName");
console.log(item.system.damage);

// Test damage parsing manually
const baseDamage = item.system.damage;
console.log(JSON.stringify(baseDamage, null, 2));
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
To support new item types, add parsing methods in `rollAlternativeCriticalDamage()`:

```javascript
// Method N: New item type format
if (!damageFormula && baseDamage.customProperty) {
    damageFormula = baseDamage.customProperty;
    damageType = baseDamage.customType || 'untyped';
    console.log('Found damage in custom format:', damageFormula);
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
The alternative critical calculation happens in the dice term processing loop. Modify this section to change how critical damage is calculated.

## PF2e System Integration

### Hooks Used
- `init`: Register module settings
- `ready`: System compatibility check
- `renderChatMessage`: Button injection and click handling

### PF2e-Specific Code
- Uses `ChatMessage.getSpeaker({ actor })` for proper attribution
- Respects `game.settings.get('core', 'rollMode')` for roll privacy
- Integrates with PF2e's damage type system

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
- [ ] Damage calculation is correct
- [ ] Settings are respected
- [ ] No console errors
- [ ] Works with critical hits and normal attacks

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
- **Author:** Generated with Claude Code
- **License:** Use and modify as needed
- **Issues:** Check console logs first, then examine item damage structure
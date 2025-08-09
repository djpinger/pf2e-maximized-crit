/**
 * Alternative Critical Damage Module
 * Adds a third "Alternative Critical" button to attack roll chat cards
 * Instead of doubling damage dice, rolls once and adds maximum die value
 * Example: 1d6+4 crit becomes 1d6+6+4*2 (roll + max die + doubled static)
 */

Hooks.once('init', function() {
    console.log('Alternative Critical Damage | Initializing...');
    
    // Register module settings
    game.settings.register('alternative-crit-damage', 'enabled', {
        name: 'Enable Alternative Critical Button',
        hint: 'When enabled, adds an "Alternative Critical" button to attack roll results',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register('alternative-crit-damage', 'doubleStatic', {
        name: 'Double Static Modifiers',
        hint: 'When enabled, static damage modifiers (like +4) will still be doubled on alternative crits',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
});

Hooks.once('ready', function() {
    console.log('Alternative Critical Damage | Ready');
    
    // Only work with PF2e system
    if (game.system.id !== 'pf2e') {
        console.warn('Alternative Critical Damage | This module is designed for the PF2e system only');
        return;
    }
});

/**
 * Hook into chat message rendering to add alternative critical button
 */
Hooks.on('renderChatMessage', (message, html, data) => {
    try {
        if (!game.settings.get('alternative-crit-damage', 'enabled')) return;
        
        // Check if this message has an item (weapon/spell) that can do damage
        if (!message.item) return;
        
        // Look for existing damage buttons - check multiple possible actions
        const strikeButtons = html.find('button[data-action="strike-damage"]');
        const damageButtons = html.find('button[data-action="damage-roll"]');
        const spellButtons = html.find('button[data-action="spell-damage"]');
        
        // Check if there are any damage-related buttons
        const hasDamageButtons = strikeButtons.length > 0 || damageButtons.length > 0 || spellButtons.length > 0;
        
        if (!hasDamageButtons) return;
        
        // Check if we already added the button to avoid duplicates
        if (html.find('.alternative-critical').length > 0) return;
        
        // Find the button container
        let buttonContainer;
        if (strikeButtons.length > 0) {
            buttonContainer = strikeButtons.parent();
        } else if (damageButtons.length > 0) {
            buttonContainer = damageButtons.parent();
        } else if (spellButtons.length > 0) {
            buttonContainer = spellButtons.parent();
        }
        
        if (!buttonContainer || buttonContainer.length === 0) return;
        
        // Create alternative critical button
        const alternativeButton = $(`
            <button type="button" class="alternative-critical" data-action="alternative-critical" title="Alternative Critical Damage">
                <i class="fas fa-dice-d20"></i> Alt Crit
            </button>
        `);
        
        // Style the button to match PF2e buttons
        alternativeButton.css({
            'background': 'linear-gradient(135deg, #8B0000, #DC143C)',
            'border': '1px solid #8B0000',
            'color': 'white',
            'margin': '2px',
            'padding': '4px 8px',
            'border-radius': '3px',
            'font-size': '12px',
            'cursor': 'pointer'
        });
        
        // Add hover effect
        alternativeButton.hover(
            function() { $(this).css('background', 'linear-gradient(135deg, #A0522D, #FF6347)'); },
            function() { $(this).css('background', 'linear-gradient(135deg, #8B0000, #DC143C)'); }
        );
        
        // Add click handler
        alternativeButton.on('click', (event) => {
            event.preventDefault();
            handleAlternativeCritical(message, event.currentTarget);
        });
        
        // Add the button to the container
        buttonContainer.append(alternativeButton);
        
    } catch (error) {
        console.error('Alternative Critical Damage | Error in renderChatMessage hook:', error);
    }
});

/**
 * Handle alternative critical damage roll
 */
async function handleAlternativeCritical(message, button) {
    try {
        const item = message.item;
        const actor = message.actor;
        
        if (!item || !actor) {
            ui.notifications.warn('Alternative Critical Damage | No weapon found for damage roll');
            return;
        }
        
        console.log('Alternative Critical Damage | Rolling alternative critical damage');
        
        // Get the attack roll outcome to determine if it was actually a critical
        const attackOutcome = message.flags?.pf2e?.context?.outcome;
        const isCriticalHit = attackOutcome === 'criticalSuccess';
        
        // Build damage roll with our custom calculation
        await rollAlternativeCriticalDamage(item, actor, isCriticalHit);
        
    } catch (error) {
        console.error('Alternative Critical Damage | Error rolling alternative critical:', error);
        ui.notifications.error('Failed to roll alternative critical damage');
    }
}

/**
 * Roll alternative critical damage
 */
async function rollAlternativeCriticalDamage(item, actor, isCriticalHit = true) {
    console.log('Alternative Critical Damage | Item:', item.name, 'Type:', item.type);
    
    // Get the item's base damage formula - works for weapons, spells, etc.
    let baseDamage = item.system.damage;
    let damageFormula = null;
    let damageType = 'untyped';
    
    // Try multiple approaches to find damage data
    if (baseDamage && typeof baseDamage === 'object') {
        // Method 1: PF2e format with dice/die properties
        if (baseDamage.dice && baseDamage.die) {
            const modifier = baseDamage.modifier || 0;
            damageFormula = `${baseDamage.dice}${baseDamage.die}`;
            if (modifier !== 0) {
                damageFormula += modifier >= 0 ? `+${modifier}` : modifier;
            }
            damageType = baseDamage.damageType || 'untyped';
            console.log('Alternative Critical Damage | Found damage in PF2e dice/die format:', damageFormula);
        }
        
        // Method 2: PF2e weapon format - Object with damage instances
        else if (Object.keys(baseDamage).length > 0) {
            const firstDamageKey = Object.keys(baseDamage)[0];
            const firstDamage = baseDamage[firstDamageKey];
            if (firstDamage && firstDamage.damage) {
                damageFormula = firstDamage.damage;
                damageType = firstDamage.damageType || 'untyped';
                console.log('Alternative Critical Damage | Found damage in weapon format:', damageFormula);
            }
        }
        
        // Method 3: Direct formula property
        if (!damageFormula && baseDamage.formula) {
            damageFormula = baseDamage.formula;
            damageType = baseDamage.damageType || 'untyped';
            console.log('Alternative Critical Damage | Found damage in formula property:', damageFormula);
        }
    }
    
    // Method 4: Check if baseDamage is a string (direct formula)
    if (!damageFormula && typeof baseDamage === 'string') {
        damageFormula = baseDamage;
        console.log('Alternative Critical Damage | Found damage as string:', damageFormula);
    }
    
    if (!damageFormula) {
        ui.notifications.warn(`No damage formula found for this ${item.type}`);
        console.log('Alternative Critical Damage | Item system structure:', item.system);
        console.log('Alternative Critical Damage | Full damage object:', JSON.stringify(baseDamage, null, 2));
        console.log('Alternative Critical Damage | Damage object keys:', Object.keys(baseDamage || {}));
        
        // Let's try a more exhaustive search
        if (baseDamage) {
            for (const [key, value] of Object.entries(baseDamage)) {
                console.log(`Damage key "${key}":`, value);
                if (value && typeof value === 'object' && value.damage) {
                    console.log(`Found damage in key "${key}": ${value.damage}`);
                    damageFormula = value.damage;
                    damageType = value.damageType || 'untyped';
                    break;
                }
            }
        }
        
        if (!damageFormula) {
            return;
        }
        console.log('Alternative Critical Damage | Using formula from exhaustive search:', damageFormula);
    }
    
    const doubleStatic = game.settings.get('alternative-crit-damage', 'doubleStatic');
    
    // Build alternative damage formula
    let modifierLabels = [];
    
    // Parse the damage formula to extract dice and modifiers
    const roll = new Roll(damageFormula);
    let newTerms = [];
    let staticModifier = 0;
    
    for (const term of roll.terms) {
        if (term instanceof foundry.dice.terms.DiceTerm) {
            // Add the original dice (not doubled)
            newTerms.push(term);
            
            if (isCriticalHit) {
                // Add maximum die value as a numeric term
                const maxValue = term.number * term.faces;
                newTerms.push(new foundry.dice.terms.OperatorTerm({ operator: '+' }));
                newTerms.push(new foundry.dice.terms.NumericTerm({ number: maxValue }));
                modifierLabels.push(`Critical Max (${term.number}d${term.faces}): +${maxValue}`);
            }
        } else if (term instanceof foundry.dice.terms.NumericTerm) {
            // Handle static modifiers
            let modifierValue = term.number;
            if (isCriticalHit && doubleStatic) {
                modifierValue *= 2;
                modifierLabels.push(`Doubled Modifier: +${modifierValue}`);
            }
            staticModifier += modifierValue;
        } else {
            // Keep operators and other terms
            newTerms.push(term);
        }
    }
    
    // Add the static modifier if it exists
    if (staticModifier !== 0) {
        if (newTerms.length > 0) {
            newTerms.push(new foundry.dice.terms.OperatorTerm({ operator: staticModifier >= 0 ? '+' : '-' }));
            newTerms.push(new foundry.dice.terms.NumericTerm({ number: Math.abs(staticModifier) }));
        } else {
            newTerms.push(new foundry.dice.terms.NumericTerm({ number: staticModifier }));
        }
    }
    
    // Build the final alternative formula
    const alternativeFormula = Roll.getFormula(newTerms);
    
    if (!alternativeFormula) {
        ui.notifications.warn('Could not build alternative damage formula');
        return;
    }
    
    console.log('Alternative Critical Damage | Formula:', alternativeFormula);
    
    // Create and evaluate the roll
    const damageRoll = new Roll(alternativeFormula);
    await damageRoll.evaluate();
    
    // Build flavor text
    let flavorText = `<strong>Alternative Critical Damage</strong><br>`;
    if (isCriticalHit) {
        flavorText += `<em>Roll once + add maximum die value</em><br>`;
        if (modifierLabels.length > 0) {
            flavorText += modifierLabels.join('<br>') + '<br>';
        }
    } else {
        flavorText += `<em>Normal damage (not a critical hit)</em><br>`;
    }
    flavorText += `<strong>${item.name}</strong>`;
    
    // Send the roll to chat
    await damageRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        flavor: flavorText,
        rolls: [damageRoll],
        rollMode: game.settings.get('core', 'rollMode')
    });
    
    console.log('Alternative Critical Damage | Roll sent to chat');
}

console.log('Alternative Critical Damage | Module loaded');
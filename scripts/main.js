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
 * Get PF2e DamageRoll class
 */
function getDamageRollClass() {
    return CONFIG.Dice.rolls.find((r) => r.name === 'DamageRoll');
}

/**
 * Create a dice formula with damage type and category
 */
function createDamageFormula(num, die, mod, damageType, category = '') {
    let formula = '';
    
    // Handle dice part
    if (num && die) {
        formula = `(${num}d${die}+${num * die}+${mod})`;
    } else if (mod) {
        formula = `${mod}`;
    }
    
    // Add damage category if present
    if (category !== '') {
        formula = `((${formula})[${category}])`;
    }
    
    // Add damage type
    if (damageType) {
        formula += `[${damageType}]`;
    } else {
        formula += `[untyped]`;
    }
    
    return formula;
}

/**
 * Create a standard dice formula (non-crit)
 */
function createStandardDamageFormula(num, die, mod, damageType, category = '') {
    let formula = '';
    
    // Handle dice part
    if (num && die) {
        formula = `(${num}d${die}+${mod})`;
    } else if (mod) {
        formula = `${mod}`;
    }
    
    // Add damage category if present
    if (category !== '') {
        formula = `((${formula})[${category}])`;
    }
    
    // Add damage type
    if (damageType) {
        formula += `[${damageType}]`;
    } else {
        formula += `[untyped]`;
    }
    
    return formula;
}

/**
 * Parse weapon damage including runes, traits, and special damage types
 */
function parseWeaponDamage(item, isCriticalHit) {
    const system = item.system;
    const damage = system.damage;
    const splashDamage = system.splashDamage;
    const bonusDamage = system.bonusDamage;
    const runes = system.runes;
    const traits = system.traits?.value || [];
    
    if (!damage) {
        return null;
    }
    
    console.log('Alternative Critical Damage | Weapon damage:', damage);
    console.log('Alternative Critical Damage | Weapon traits:', traits);
    console.log('Alternative Critical Damage | Weapon runes:', runes);
    
    // Handle main weapon damage
    const dieType = damage.die ? damage.die.split('d')[1] : null;
    if (damage.dice && dieType) {
        // Calculate base dice (subtract striking runes for crit calculation)
        const baseDice = runes ? damage.dice - (runes.striking || 0) : damage.dice;
        
        // Get all modifiers from various sources
        let totalModifier = 0;
        
        // Handle static modifiers (this is where strength and precision come from)
        if (damage.modifier !== undefined) {
            totalModifier += damage.modifier;
        }
        
        // Handle bonus damage modifiers (if any)
        if (bonusDamage && bonusDamage.value) {
            totalModifier += bonusDamage.value;
        }
        
        // Handle persistent damage modifiers (if any)
        if (damage.persistent && damage.persistent.number) {
            totalModifier += damage.persistent.number;
        }
        
        // Handle splash damage modifiers (if any)
        if (splashDamage && splashDamage.value) {
            totalModifier += splashDamage.value;
        }
        
        // For critical hits, we want the formula to be:
        // (baseDice)d(dieType) + maxDieValue + totalModifier
        let formula = '';
        
        if (baseDice > 0) {
            const maxDieValue = baseDice * parseInt(dieType);
            if (isCriticalHit) {
                // Create the main damage formula with critical calculation
                formula = createDamageFormula(baseDice, dieType, totalModifier, damage.damageType, '');
            } else {
                // Create normal damage formula
                formula = createStandardDamageFormula(baseDice, dieType, totalModifier, damage.damageType, '');
            }
        } else if (totalModifier !== 0) {
            // Handle case where there's only static modifiers
            if (isCriticalHit && game.settings.get('alternative-crit-damage', 'doubleStatic')) {
                formula = createDamageFormula(0, 1, totalModifier * 2, damage.damageType, '');
            } else {
                formula = createStandardDamageFormula(0, 1, totalModifier, damage.damageType, '');
            }
        }
        
        // Handle striking runes (always standard rolls)
        if (runes && runes.striking > 0) {
            const runeFormula = createStandardDamageFormula(runes.striking, dieType, 0, damage.damageType, '');
            if (formula) {
                formula += ',' + runeFormula;
            } else {
                formula = runeFormula;
            }
        }
        
        // Handle deadly trait (standard dice on crit)
        const deadlyTrait = traits.find((trait) => trait.startsWith('deadly-'));
        if (deadlyTrait && isCriticalHit) {
            const deadlyDie = deadlyTrait.split('-d')[1];
            const deadlyDice = 1; // Always one die for deadly
            const deadlyFormula = createStandardDamageFormula(deadlyDice, deadlyDie, 0, damage.damageType, '');
            if (formula) {
                formula += ',' + deadlyFormula;
            } else {
                formula = deadlyFormula;
            }
        }
        
        // Handle persistent damage (if any)
        if (damage.persistent && damage.persistent.number) {
            const persistentFormula = createDamageFormula(0, dieType, damage.persistent.number, damage.persistent.type, 'persistent');
            if (formula) {
                formula += ',' + persistentFormula;
            } else {
                formula = persistentFormula;
            }
        }
        
        // Handle splash damage (if any)
        if (splashDamage && splashDamage.value > 0) {
            const splashFormula = createDamageFormula(0, 4, splashDamage.value, damage.damageType, 'splash');
            if (formula) {
                formula += ',' + splashFormula;
            } else {
                formula = splashFormula;
            }
        }
        
        // Handle bonus damage (if any)
        if (bonusDamage && bonusDamage.value > 0 && bonusDamage.dice && bonusDamage.die) {
            const bonusDieType = bonusDamage.die.split('d')[1];
            const bonusFormula = createStandardDamageFormula(bonusDamage.dice, bonusDieType, 0, damage.damageType, '');
            if (formula) {
                formula += ',' + bonusFormula;
            } else {
                formula = bonusFormula;
            }
        }
        
        return formula || null;
    }
    
    return null;
}

/**
 * Parse spell damage
 */
function parseSpellDamage(item, isCriticalHit) {
    const damage = item.system.damage;
    const formulaParts = [];
    
    if (!damage || typeof damage !== "object" || Object.keys(damage).length === 0) {
        return null;
    }
    
    console.log('Alternative Critical Damage | Spell damage:', damage);
    
    // Handle spell damage instances
    for (const [key, damageInstance] of Object.entries(damage)) {
        if (damageInstance && damageInstance.damage) {
            // Try to parse the damage formula
            try {
                const roll = new Roll(damageInstance.damage);
                for (const term of roll.terms) {
                    if (term instanceof foundry.dice.terms.DiceTerm) {
                        const dieType = term.faces;
                        const numDice = term.number;
                        if (isCriticalHit) {
                            formulaParts.push(createDamageFormula(numDice, dieType, 0, damageInstance.type || 'untyped', ''));
                        } else {
                            formulaParts.push(createStandardDamageFormula(numDice, dieType, 0, damageInstance.type || 'untyped', ''));
                        }
                    } else if (term instanceof foundry.dice.terms.NumericTerm) {
                        // Handle static modifiers in spells
                        const modifier = term.number;
                        if (modifier !== 0) {
                            if (isCriticalHit && game.settings.get('alternative-crit-damage', 'doubleStatic')) {
                                formulaParts.push(createDamageFormula(0, 1, modifier * 2, damageInstance.type || 'untyped', ''));
                            } else {
                                formulaParts.push(createStandardDamageFormula(0, 1, modifier, damageInstance.type || 'untyped', ''));
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('Alternative Critical Damage | Could not parse spell damage formula:', damageInstance.damage, error);
                // Fall back to simple handling
                if (isCriticalHit) {
                    formulaParts.push(createDamageFormula(1, 6, 0, damageInstance.type || 'untyped', ''));
                } else {
                    formulaParts.push(createStandardDamageFormula(1, 6, 0, damageInstance.type || 'untyped', ''));
                }
            }
        }
    }
    
    return formulaParts.length > 0 ? formulaParts.join(',') : null;
}

/**
 * Roll alternative critical damage with enhanced parsing
 */
async function rollAlternativeCriticalDamage(item, actor, isCriticalHit = true) {
    console.log('Alternative Critical Damage | Item:', item.name, 'Type:', item.type);
    
    let damageFormula = null;
    
    // Parse damage based on item type
    if (item.type === 'weapon') {
        damageFormula = parseWeaponDamage(item, isCriticalHit);
    } else if (item.type === 'spell') {
        damageFormula = parseSpellDamage(item, isCriticalHit);
    } else {
        // Fallback to old parsing method for other item types
        const baseDamage = item.system.damage;
        if (baseDamage && baseDamage.dice && baseDamage.die) {
            const dieType = baseDamage.die.split('d')[1];
            const modifier = baseDamage.modifier || 0;
            if (isCriticalHit) {
                damageFormula = createDamageFormula(baseDamage.dice, dieType, modifier, baseDamage.damageType || 'untyped', '');
            } else {
                damageFormula = createStandardDamageFormula(baseDamage.dice, dieType, modifier, baseDamage.damageType || 'untyped', '');
            }
        }
    }
    
    if (!damageFormula) {
        ui.notifications.warn(`No damage formula found for this ${item.type}`);
        console.log('Alternative Critical Damage | Item system structure:', item.system);
        return;
    }
    
    console.log('Alternative Critical Damage | Final Formula:', damageFormula);
    
    // Use PF2e DamageRoll if available, otherwise fall back to regular Roll
    const DamageRoll = getDamageRollClass();
    
    try {
        // Create multiple rolls for each damage component
        const formulaParts = damageFormula.split(',');
        const rolls = await Promise.all(
            formulaParts.map(formula => {
                if (DamageRoll) {
                    return new DamageRoll(formula, actor.getRollData()).roll();
                } else {
                    return new Roll(formula, actor.getRollData()).evaluate();
                }
            })
        );
        
        // Build flavor text
        let flavorText = `<strong>Alternative Critical Damage</strong><br>`;
        if (isCriticalHit) {
            flavorText += `<em>Roll once + add maximum die value</em><br>`;
        } else {
            flavorText += `<em>Normal damage (not a critical hit)</em><br>`;
        }
        flavorText += `<strong>${item.name}</strong>`;
        
        // Send the rolls to chat
        await ChatMessage.create({
            user: game.user.id,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            rolls: rolls,
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: flavorText,
            rollMode: game.settings.get('core', 'rollMode')
        });
        
        console.log('Alternative Critical Damage | Roll sent to chat');
        
    } catch (error) {
        console.error('Alternative Critical Damage | Error creating damage roll:', error);
        ui.notifications.error('Failed to create alternative critical damage roll');
    }
}

console.log('Alternative Critical Damage | Module loaded');
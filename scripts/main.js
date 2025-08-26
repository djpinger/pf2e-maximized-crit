/**
 * Alternative Critical Damage Module
 * Adds a third "Alternative Critical" button to attack roll chat cards
 * Instead of doubling damage dice, rolls once and adds maximum die value
 * Example: 1d6+4 crit becomes 1d6+6+4*2 (roll + max die + doubled static)
 */

const MODULE_VERSION = "v1.1.8";

Hooks.once("init", function () {
  console.log(`Alternative Critical Damage ${MODULE_VERSION} | Initializing...`);

  // Register module settings
  game.settings.register("alternative-crit-damage", "enabled", {
    name: "Enable Alternative Critical Button",
    hint: 'When enabled, adds an "Alternative Critical" button to attack roll results',
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("alternative-crit-damage", "doubleStatic", {
    name: "Double Static Modifiers",
    hint: "When enabled, static damage modifiers (like +4) will still be doubled on alternative crits",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
});

Hooks.once("ready", function () {
  console.log(`Alternative Critical Damage ${MODULE_VERSION} | Ready`);

  // Only work with PF2e system
  if (game.system.id !== "pf2e") {
    console.warn(
      `Alternative Critical Damage ${MODULE_VERSION} | This module is designed for the PF2e system only`,
    );
    return;
  }
});

// Global storage for the last damage roll data
let lastDamageRollData = null;

// Hook to capture damage roll data when created
Hooks.on("createChatMessage", (message) => {
  if (message.rolls && message.rolls.length > 0) {
    const roll = message.rolls[0];
    if (roll.constructor.name === "DamageRoll") {
      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Capturing damage roll data:`, roll);
      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Message item:`, message.item);
      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Message item ID:`, message.item?.id);

      lastDamageRollData = {
        roll: roll,
        message: message,
        timestamp: Date.now()
      };

      // Log the structure we're interested in
      if (roll.options && roll.options.damage) {
        console.log(`Alternative Critical Damage ${MODULE_VERSION} | Damage roll options:`, roll.options.damage);
        if (roll.options.damage.damage) {
          console.log(`Alternative Critical Damage ${MODULE_VERSION} | Damage structure:`, roll.options.damage.damage);
          console.log(`Alternative Critical Damage ${MODULE_VERSION} | Base damage:`, roll.options.damage.damage.base);
          console.log(`Alternative Critical Damage ${MODULE_VERSION} | Modifiers:`, roll.options.damage.damage.modifiers);
          console.log(`Alternative Critical Damage ${MODULE_VERSION} | Dice:`, roll.options.damage.damage.dice);
        }
      }
    }
  }
});

/**
 * Hook into chat message rendering to add alternative critical button
 */
Hooks.on("renderChatMessage", (message, html, data) => {
  try {
    if (!game.settings.get("alternative-crit-damage", "enabled")) return;

    // Check if this message has an item (weapon/spell) that can do damage
    if (!message.item) return;

    // Look for existing damage buttons - check multiple possible actions
    const strikeButtons = html.find('button[data-action="strike-damage"]');
    const damageButtons = html.find('button[data-action="damage-roll"]');
    const spellButtons = html.find('button[data-action="spell-damage"]');

    // Check if there are any damage-related buttons
    const hasDamageButtons =
      strikeButtons.length > 0 ||
      damageButtons.length > 0 ||
      spellButtons.length > 0;

    if (!hasDamageButtons) return;

    // Check if we already added the button to avoid duplicates
    if (html.find(".alternative-critical").length > 0) return;

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
      background: "linear-gradient(135deg, #8B0000, #DC143C)",
      border: "1px solid #8B0000",
      color: "white",
      margin: "2px",
      padding: "4px 8px",
      "border-radius": "3px",
      "font-size": "12px",
      cursor: "pointer",
    });

    // Add hover effect
    alternativeButton.hover(
      function () {
        $(this).css("background", "linear-gradient(135deg, #A0522D, #FF6347)");
      },
      function () {
        $(this).css("background", "linear-gradient(135deg, #8B0000, #DC143C)");
      },
    );

    // Add click handler
    alternativeButton.on("click", (event) => {
      event.preventDefault();
      handleAlternativeCritical(message, event.currentTarget);
    });

    // Add the button to the container
    buttonContainer.append(alternativeButton);
  } catch (error) {
    console.error(
      `Alternative Critical Damage ${MODULE_VERSION} | Error in renderChatMessage hook:`,
      error,
    );
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
      ui.notifications.warn(
        `Alternative Critical Damage ${MODULE_VERSION} | No weapon found for damage roll`,
      );
      return;
    }

    console.log(
      `Alternative Critical Damage ${MODULE_VERSION} | Rolling alternative critical damage`,
    );

    // Get the attack roll outcome to determine if it was actually a critical
    const attackOutcome = message.flags?.pf2e?.context?.outcome;
    const isCriticalHit = attackOutcome === "criticalSuccess";

    // Build damage roll using PF2e's DamageRoll structure
    await rollAlternativeCriticalDamageFromPF2eData(item, actor, isCriticalHit);
  } catch (error) {
    console.error(
      `Alternative Critical Damage ${MODULE_VERSION} | Error rolling alternative critical:`,
      error,
    );
    ui.notifications.error("Failed to roll alternative critical damage");
  }
}

/**
 * Get PF2e DamageRoll class
 */
function getDamageRollClass() {
  return CONFIG.Dice.rolls.find((r) => r.name === "DamageRoll");
}

/**
 * Create alternative critical damage using captured damage roll data
 */
async function rollAlternativeCriticalDamageFromPF2eData(item, actor, isCriticalHit) {
  console.log(`Alternative Critical Damage ${MODULE_VERSION} | Getting PF2e damage data for:`, item.name);

  try {
    // Check if we have recent damage roll data from the same item
    console.log(`Alternative Critical Damage ${MODULE_VERSION} | Checking for recent damage data...`);
    console.log(`Alternative Critical Damage ${MODULE_VERSION} | Current item ID:`, item.id);
    console.log(`Alternative Critical Damage ${MODULE_VERSION} | Last damage data exists:`, !!lastDamageRollData);
    if (lastDamageRollData) {
      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Last damage item ID:`, lastDamageRollData.message.item?.id);
      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Time since last roll:`, Date.now() - lastDamageRollData.timestamp, 'ms');
    }

    if (lastDamageRollData &&
      lastDamageRollData.message.item &&
      lastDamageRollData.message.item.id === item.id &&
      (Date.now() - lastDamageRollData.timestamp) < 30000) { // Within 30 seconds

      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Using captured damage roll data`);

      const damageData = lastDamageRollData.roll.options?.damage?.damage;
      if (damageData) {
        console.log(`Alternative Critical Damage ${MODULE_VERSION} | Found damage data from recent roll`);

        // Use the captured data to create alternative critical damage
        const altCritFormula = await createAlternativeCriticalFormula(damageData, isCriticalHit);

        console.log(`Alternative Critical Damage ${MODULE_VERSION} | Alternative formula:`, altCritFormula);

        // Create and roll the alternative damage
        const DamageRoll = getDamageRollClass();
        const roll = new DamageRoll(altCritFormula, actor.getRollData());
        await roll.evaluate();

        // Build flavor text
        let flavorText = `<strong>Alternative Critical Damage</strong><br>`;
        if (isCriticalHit) {
          flavorText += `<em>Roll once + add maximum die value</em><br>`;
        } else {
          flavorText += `<em>Normal damage (not a critical hit)</em><br>`;
        }
        flavorText += `<strong>${item.name}</strong>`;

        // Send the roll to chat
        await ChatMessage.create({
          user: game.user.id,
          type: CONST.CHAT_MESSAGE_TYPES.ROLL,
          rolls: [roll],
          speaker: ChatMessage.getSpeaker({ actor: actor }),
          flavor: flavorText,
          rollMode: game.settings.get("core", "rollMode"),
        });

        console.log(`Alternative Critical Damage ${MODULE_VERSION} | Alternative critical damage sent to chat`);
        return;
      }
    }

    // No recent damage data found, try to calculate damage modifiers directly
    console.log(`Alternative Critical Damage ${MODULE_VERSION} | No recent damage data found, attempting direct calculation`);
    await attemptDirectDamageCalculation(item, actor, isCriticalHit);

  } catch (error) {
    console.error(`Alternative Critical Damage ${MODULE_VERSION} | Error in PF2e damage calculation:`, error);
    await rollAlternativeCriticalDamageLegacy(item, actor, isCriticalHit);
  }
}

/**
 * Create alternative critical damage formula from PF2e damage data
 */
async function createAlternativeCriticalFormula(damageData, isCriticalHit) {
  const formulaParts = [];

  // Handle base weapon damage (the main dice)
  if (damageData.base && damageData.base.length > 0) {
    for (const baseDamage of damageData.base) {
      const { diceNumber, dieSize, modifier, damageType, category } = baseDamage;

      if (diceNumber && dieSize) {
        const dieValue = parseInt(dieSize.replace('d', ''));
        if (isCriticalHit) {
          // Alternative crit: roll dice + add max die value + modifier
          let formula = `(${diceNumber}${dieSize}+${diceNumber * dieValue}`;
          if (modifier) formula += `+${modifier}`;
          formula += `)`;

          // Add damage type
          formula += `[${damageType || 'untyped'}]`;
          formulaParts.push(formula);
        } else {
          // Normal damage: just roll dice + modifier
          let formula = `(${diceNumber}${dieSize}`;
          if (modifier) formula += `+${modifier}`;
          formula += `)`;

          // Add damage type
          formula += `[${damageType || 'untyped'}]`;
          formulaParts.push(formula);
        }
      }
    }
  }

  // Handle modifiers (like Strength, Precise Strike, etc.)
  if (damageData.modifiers && damageData.modifiers.length > 0) {
    for (const modifierData of damageData.modifiers) {
      if (modifierData.enabled && !modifierData.ignored && modifierData.modifier) {
        const { modifier, damageCategory, damageType } = modifierData;

        let modifierValue = modifier;
        if (isCriticalHit && game.settings.get("alternative-crit-damage", "doubleStatic")) {
          // Double static modifiers on crits if setting is enabled
          modifierValue *= 2;
        }

        let formula = `${modifierValue}`;

        // Add category if present (like precision)
        if (damageCategory) {
          formula = `(${formula}[${damageCategory}])`;
        }

        // Add damage type if specified
        if (damageType) {
          formula += `[${damageType}]`;
        } else {
          formula += `[untyped]`;
        }

        formulaParts.push(formula);
      }
    }
  }

  // Handle additional dice (like deadly trait)
  if (damageData.dice && damageData.dice.length > 0) {
    for (const diceData of damageData.dice) {
      if (diceData.enabled && !diceData.ignored) {
        // Only add deadly/fatal dice on critical hits
        if (diceData.critical === true && isCriticalHit) {
          const { diceNumber, dieSize, damageType, category } = diceData;

          if (diceNumber && dieSize) {
            let formula = `(${diceNumber}${dieSize})`;

            // Add category if present
            if (category) {
              formula = `(${formula}[${category}])`;
            }

            // Add damage type
            formula += `[${damageType || 'untyped'}]`;
            formulaParts.push(formula);
          }
        }
      }
    }
  }

  if (formulaParts.length === 0) {
    throw new Error("No damage components found");
  }

  return `{${formulaParts.join(',')}}`;
}

/**
 * Attempt to calculate damage directly without needing a prior roll
 */
async function attemptDirectDamageCalculation(item, actor, isCriticalHit) {
  console.log(`Alternative Critical Damage ${MODULE_VERSION} | Attempting direct damage calculation`);
  
  try {
    // Build a synthetic damage structure based on what we can determine
    const syntheticDamageData = {
      base: [],
      modifiers: [],
      dice: []
    };
    
    // Get base weapon damage
    const baseDamage = item.system.damage;
    if (baseDamage && baseDamage.dice && baseDamage.die) {
      const dieValue = parseInt(baseDamage.die.replace('d', ''));
      syntheticDamageData.base.push({
        diceNumber: baseDamage.dice,
        dieSize: baseDamage.die,
        modifier: baseDamage.modifier || 0,
        damageType: baseDamage.damageType || 'untyped'
      });
      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Added base damage:`, syntheticDamageData.base[0]);
    }
    
    // Try to get strength modifier for melee weapons
    if (item.type === "weapon" && item.system.category !== "unarmed" && actor) {
      const strMod = actor.system?.abilities?.str?.mod || 0;
      if (strMod > 0) {
        syntheticDamageData.modifiers.push({
          enabled: true,
          ignored: false,
          modifier: strMod,
          damageCategory: null,
          damageType: null
        });
        console.log(`Alternative Critical Damage ${MODULE_VERSION} | Added strength modifier:`, strMod);
      }
    }
    
    // Try to find weapon specialization or other flat bonuses
    // This is more complex and would require deeper PF2e knowledge
    if (actor && actor.system) {
      // Look for damage bonuses in the actor's system
      // This is a placeholder - we'd need to dig into PF2e's modifier system
      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Actor system available for bonus calculation`);
    }
    
    // Handle weapon traits like deadly
    const traits = item.system.traits?.value || [];
    for (const trait of traits) {
      if (trait.startsWith('deadly-')) {
        const deadlyDie = trait.replace('deadly-', '');
        syntheticDamageData.dice.push({
          enabled: true,
          ignored: false,
          critical: true,
          diceNumber: 1,
          dieSize: deadlyDie,
          damageType: baseDamage.damageType || 'untyped',
          category: null
        });
        console.log(`Alternative Critical Damage ${MODULE_VERSION} | Added deadly trait:`, trait);
      }
    }
    
    // If we have some damage data, use it
    if (syntheticDamageData.base.length > 0) {
      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Using synthetic damage data:`, syntheticDamageData);
      
      const altCritFormula = await createAlternativeCriticalFormula(syntheticDamageData, isCriticalHit);
      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Direct calculation formula:`, altCritFormula);
      
      // Create and roll the alternative damage
      const DamageRoll = getDamageRollClass();
      const roll = new DamageRoll(altCritFormula, actor.getRollData());
      await roll.evaluate();
      
      // Build flavor text
      let flavorText = `<strong>Alternative Critical Damage</strong><br>`;
      if (isCriticalHit) {
        flavorText += `<em>Roll once + add maximum die value</em><br>`;
      } else {
        flavorText += `<em>Normal damage (not a critical hit)</em><br>`;
      }
      flavorText += `<strong>${item.name}</strong><br>`;
      flavorText += `<em>Note: Some modifiers may be missing without a prior damage roll</em>`;
      
      // Send the roll to chat
      await ChatMessage.create({
        user: game.user.id,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: [roll],
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        flavor: flavorText,
        rollMode: game.settings.get("core", "rollMode"),
      });
      
      console.log(`Alternative Critical Damage ${MODULE_VERSION} | Direct calculation damage sent to chat`);
      return;
    }
    
    // Fall back to legacy method if we couldn't build synthetic data
    console.log(`Alternative Critical Damage ${MODULE_VERSION} | Direct calculation failed, falling back to legacy method`);
    await rollAlternativeCriticalDamageLegacy(item, actor, isCriticalHit);
    
  } catch (error) {
    console.error(`Alternative Critical Damage ${MODULE_VERSION} | Error in direct calculation:`, error);
    await rollAlternativeCriticalDamageLegacy(item, actor, isCriticalHit);
  }
}

/**
 * Create a dice formula with damage type and category
 */
function createDamageFormula(num, die, mod, damageType, category = "") {
  let formula = "";

  // Handle dice part
  if (num && die) {
    formula = `(${num}d${die}+${num * die}+${mod})`;
  } else if (mod) {
    formula = `${mod}`;
  }

  // Add damage category if present
  if (category !== "") {
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
function createStandardDamageFormula(num, die, mod, damageType, category = "") {
  let formula = "";

  // Handle dice part
  if (num && die) {
    formula = `(${num}d${die}+${mod})`;
  } else if (mod) {
    formula = `${mod}`;
  }

  // Add damage category if present
  if (category !== "") {
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

  console.log(`Alternative Critical Damage ${MODULE_VERSION} | Weapon damage:`, damage);
  console.log(`Alternative Critical Damage ${MODULE_VERSION} | Weapon traits:`, traits);
  console.log(`Alternative Critical Damage ${MODULE_VERSION} | Weapon runes:`, runes);

  // Handle main weapon damage
  const dieType = damage.die ? damage.die.split("d")[1] : null;
  if (damage.dice && dieType) {
    // For PF2e weapon damage, calculate the proper formula with all components in one
    let formula = "";

    // Get all modifiers from various sources - we'll handle them as one unit
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

    // Handle PF2e-specific damage modifiers that may not be in simple fields
    // Try to capture all potential bonus sources from the weapon system
    if (item.system) {
      const weaponSystem = item.system;

      // Look for various bonus fields that might contain damage modifiers
      if (
        typeof weaponSystem.bonus === "object" &&
        weaponSystem.bonus !== null
      ) {
        // Handle flat damage bonuses in the bonus object
        if (typeof weaponSystem.bonus.damage === "number") {
          totalModifier += weaponSystem.bonus.damage;
        }

        // Handle any bonus modifiers in the bonus object
        if (typeof weaponSystem.bonus.flat === "number") {
          totalModifier += weaponSystem.bonus.flat;
        }
      }

      // Look for flat damage bonuses in the system structure
      if (typeof weaponSystem.flatDamageBonus === "number") {
        totalModifier += weaponSystem.flatDamageBonus;
      }

      // Look for damage bonuses in the main damage object
      if (
        typeof weaponSystem.damage === "object" &&
        weaponSystem.damage.bonus !== undefined
      ) {
        totalModifier += weaponSystem.damage.bonus;
      }

      // Look for bonus damage in the system structure
      if (
        typeof weaponSystem.bonusDamage === "object" &&
        weaponSystem.bonusDamage.value !== undefined
      ) {
        totalModifier += weaponSystem.bonusDamage.value;
      }

      // Handle weapon-specific bonus that might not be in standard fields
      if (typeof weaponSystem.bonus === "number") {
        totalModifier += weaponSystem.bonus;
      }

      // Handle bonus from the item's system object directly (this could be the +1 in our case)
      if (typeof item.system.bonus === "number") {
        totalModifier += item.system.bonus;
      }

      // Handle any numeric bonus in the root system object
      if (typeof item.system === "object" && item.system.bonus !== undefined) {
        if (typeof item.system.bonus === "number") {
          totalModifier += item.system.bonus;
        }
      }
    }

    // Handle any modifiers that might be in the item's damage structure directly
    if (item.system && item.system.damage) {
      const weaponDamage = item.system.damage;
      if (typeof weaponDamage === "object") {
        // Look for any additional numeric modifiers that might not be captured elsewhere
        if (
          weaponDamage.modifier !== undefined &&
          weaponDamage.modifier !== null
        ) {
          totalModifier += weaponDamage.modifier;
        }
      }
    }

    // Handle additional potential sources of damage modifiers specific to PF2E
    // Look for damage bonuses in the weapon's properties or traits that might not be in standard fields
    if (item.system && item.system.properties) {
      const properties = item.system.properties;
      if (Array.isArray(properties)) {
        // Check for any damage bonus properties
        properties.forEach((property) => {
          if (typeof property === "object" && property.bonus) {
            totalModifier += property.bonus;
          }
        });
      }
    }

    // Handle potential bonus in item's system that might not be in standard fields
    if (item.system && typeof item.system.bonus === "number") {
      totalModifier += item.system.bonus;
    }

    // For critical hits, create a single proper damage formula that includes:
    // 1. All weapon dice (base + runes)
    // 2. Max die value for all dice
    // 3. All modifiers (including runes and traits)
    if (isCriticalHit) {
      // Calculate total dice: base dice + any runes that add additional dice
      let totalDice = damage.dice;

      // Add striking runes to the total dice count (they add additional dice)
      if (runes && typeof runes.striking === "number" && runes.striking > 0) {
        console.log(
          `Alternative Critical Damage ${MODULE_VERSION} | Adding runes to total dice:`,
          runes.striking,
        );
        totalDice += runes.striking;
      }

      // Create the main damage formula with all components in one proper PF2e format
      const maxDieValue = totalDice * parseInt(dieType);
      formula = createDamageFormula(
        totalDice,
        dieType,
        totalModifier,
        damage.damageType || "untyped",
        "",
      );

      // For deadly weapons, the extra damage is handled by the PF2e system
      // Our formula above should include all dice and modifiers properly
    } else {
      // Create normal damage formula (no crit modification)
      const maxDieValue = damage.dice * parseInt(dieType);
      formula = createStandardDamageFormula(
        damage.dice,
        dieType,
        totalModifier,
        damage.damageType || "untyped",
        "",
      );
    }

    // Return just the single formula to avoid creating multiple separate rolls
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

  if (
    !damage ||
    typeof damage !== "object" ||
    Object.keys(damage).length === 0
  ) {
    return null;
  }

  console.log(`Alternative Critical Damage ${MODULE_VERSION} | Spell damage:`, damage);

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
              formulaParts.push(
                createDamageFormula(
                  numDice,
                  dieType,
                  0,
                  damageInstance.type || "untyped",
                  "",
                ),
              );
            } else {
              formulaParts.push(
                createStandardDamageFormula(
                  numDice,
                  dieType,
                  0,
                  damageInstance.type || "untyped",
                  "",
                ),
              );
            }
          } else if (term instanceof foundry.dice.terms.NumericTerm) {
            // Handle static modifiers in spells
            const modifier = term.number;
            if (modifier !== 0) {
              if (
                isCriticalHit &&
                game.settings.get("alternative-crit-damage", "doubleStatic")
              ) {
                formulaParts.push(
                  createDamageFormula(
                    0,
                    1,
                    modifier * 2,
                    damageInstance.type || "untyped",
                    "",
                  ),
                );
              } else {
                formulaParts.push(
                  createStandardDamageFormula(
                    0,
                    1,
                    modifier,
                    damageInstance.type || "untyped",
                    "",
                  ),
                );
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          `Alternative Critical Damage ${MODULE_VERSION} | Could not parse spell damage formula:`,
          damageInstance.damage,
          error,
        );
        // Fall back to simple handling
        if (isCriticalHit) {
          formulaParts.push(
            createDamageFormula(1, 6, 0, damageInstance.type || "untyped", ""),
          );
        } else {
          formulaParts.push(
            createStandardDamageFormula(
              1,
              6,
              0,
              damageInstance.type || "untyped",
              "",
            ),
          );
        }
      }
    }
  }

  return formulaParts.length > 0 ? formulaParts.join(",") : null;
}

/**
 * Roll alternative critical damage with enhanced parsing (Legacy method)
 */
async function rollAlternativeCriticalDamageLegacy(
  item,
  actor,
  isCriticalHit = true,
) {
  console.log(
    `Alternative Critical Damage ${MODULE_VERSION} | Item:`,
    item.name,
    `Type:`,
    item.type,
  );

  let damageFormula = null;

  // Parse damage based on item type
  if (item.type === "weapon") {
    damageFormula = parseWeaponDamage(item, isCriticalHit);
  } else if (item.type === "spell") {
    damageFormula = parseSpellDamage(item, isCriticalHit);
  } else {
    // Fallback to old parsing method for other item types
    const baseDamage = item.system.damage;
    if (baseDamage && baseDamage.dice && baseDamage.die) {
      const dieType = baseDamage.die.split("d")[1];
      const modifier = baseDamage.modifier || 0;
      if (isCriticalHit) {
        damageFormula = createDamageFormula(
          baseDamage.dice,
          dieType,
          modifier,
          baseDamage.damageType || "untyped",
          "",
        );
      } else {
        damageFormula = createStandardDamageFormula(
          baseDamage.dice,
          dieType,
          modifier,
          baseDamage.damageType || "untyped",
          "",
        );
      }
    }
  }

  if (!damageFormula) {
    ui.notifications.warn(`No damage formula found for this ${item.type}`);
    console.log(
      `Alternative Critical Damage ${MODULE_VERSION} | Item system structure:`,
      item.system,
    );
    return;
  }

  console.log(`Alternative Critical Damage ${MODULE_VERSION} | Final Formula:`, damageFormula);

  // Use PF2e DamageRoll if available, otherwise fall back to regular Roll
  const DamageRoll = getDamageRollClass();

  try {
    // Create multiple rolls for each damage component
    const formulaParts = damageFormula.split(",");
    const rolls = await Promise.all(
      formulaParts.map((formula) => {
        if (DamageRoll) {
          return new DamageRoll(formula, actor.getRollData()).roll();
        } else {
          return new Roll(formula, actor.getRollData()).evaluate();
        }
      }),
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
      rollMode: game.settings.get("core", "rollMode"),
    });

    console.log(`Alternative Critical Damage ${MODULE_VERSION} | Roll sent to chat`);
  } catch (error) {
    console.error(
      `Alternative Critical Damage ${MODULE_VERSION} | Error creating damage roll:`,
      error,
    );
    ui.notifications.error("Failed to create alternative critical damage roll");
  }
}

console.log(`Alternative Critical Damage ${MODULE_VERSION} | Module loaded`);

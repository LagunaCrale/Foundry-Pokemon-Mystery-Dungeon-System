import { PTUCONFIG } from "../config/index.js"
import { GamePTU } from "../game-ptu.js"
import { registerSettings } from "../../module/system/index.js"
import { registerHandlebarsHelpers } from "../handlebars.js"
import { registerSheets } from "../sheets.js"
import { registerTemplates } from "../templates.js"
import { insurgenceData, sageData, uraniumData } from "../config/data/fangame-species-data.js"
import { measureDistances } from "../../module/canvas/helpers.js"


export const Init = {
    listen() {
        Hooks.on("init", () => {
            // Add your init hooks here
            console.log("PTU System | Initializing Pokemon Tabletop Reunited System")

            // Add actor() to window
            window.actor = function () {
                return canvas.tokens.controlled[0].actor;
            }

            // Add PTUCONFIG to CONFIG
            CONFIG.PTU = PTUCONFIG

            // Set custom combat settings
            CONFIG.Combat.initiative = PTUCONFIG.combat.initiative;
            CONFIG.Combat.documentClass = PTUCONFIG.combat.documentClass;
            CONFIG.Combat.defeatedStatusId = PTUCONFIG.combat.defeatedStatusId;
            CONFIG.Combatant.documentClass = PTUCONFIG.combatant.documentClass;
            CONFIG.ui.combat = PTUCONFIG.combat.uiClass;

            // Define custom Entity classes
            CONFIG.Actor.documentClass = PTUCONFIG.Actor.proxy;
            CONFIG.Item.documentClass = PTUCONFIG.Item.proxy;

            // Disable Active Effects
            CONFIG.ActiveEffect.documentClass = PTUCONFIG.ActiveEffect.documentClass

            // Define Status Effects
            CONFIG.statusEffects = PTUCONFIG.statusEffects;

            // Define Custom Token Object Class
            CONFIG.Token.objectClass = PTUCONFIG.Token.objectClass;
            CONFIG.Token.documentClass = PTUCONFIG.Token.documentClass;

            // Define Custom Roll classes
            CONFIG.Dice.rolls ??= []
            CONFIG.Dice.rolls.push(...PTUCONFIG.Dice.rolls);

            // Define Custom Chat 
            CONFIG.ui.chat = PTUCONFIG.ui.chatlog.documentClass;
            CONFIG.ChatMessage.documentClass = PTUCONFIG.ChatMessage.documentClass;

            // Register stuff with the Foundry client
            registerSheets();
            // registerFonts();
            registerHandlebarsHelpers();
            // registerKeybindings();
            registerSettings();
            registerTemplates();

            if (game.settings.get("ptu", "insurgenceData")) {
                Array.prototype.push.apply(PTUCONFIG.data.pokemonData, insurgenceData);
            }
            if (game.settings.get("ptu", "sageData")) {
                Array.prototype.push.apply(PTUCONFIG.data.pokemonData, sageData);
            }
            if (game.settings.get("ptu", "uraniumData")) {
                Array.prototype.push.apply(PTUCONFIG.data.pokemonData, uraniumData);
            }

            // Register Constants
            CONST = {
                ...CONST,
                STATS_FACTOR: 0.5,
                STATS_SIGMA: 3.5,
            }
            Object.seal(CONST);

            // Create and populate initial game.ptu interface
            GamePTU.onInit();
        })
        Hooks.on("canvasInit", function () {
            // Extend Diagonal Measurement
            SquareGrid.prototype.measureDistances = measureDistances;
        });
    }
}
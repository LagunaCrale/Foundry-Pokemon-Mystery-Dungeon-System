import Store from './lib/store.js';
import { debug, log } from '../../ptu.js';

export default function ({ object }) {
    const store = new Store({
        actions: {
            /*** INITIALIZATION */
            async init(context) {
                // If automations are present set them
                const automations = {};
                for (let index = 0; index < object.system.automations?.length; index++) {
                    automations[index + 1] = object.system.automations[index]
                }

                // Otherwise initialize a blank one
                if (!automations[1]) {
                    automations[1] = {
                        targets: [],
                        conditions: [],
                        effects: [],
                        effectValues: [],
                        timing: CONFIG.PTUAutomation.Timing.BEFORE_ROLL,
                        passive: false,
                    }
                }

                await context.commit("setAutomations", automations);
            },

            /*** TABS AND AUTOMATIONS */
            async changeTab(context, targetTab) {
                await context.commit("updateTab", targetTab)
            },
            async switchAutomation(context, newIndex) {
                //save current automation
                await context.commit("saveActiveAutomation");
                //switch to new automation
                await context.commit("setActiveAutomation", newIndex);
            },

            /*** Targets */
            async addTarget(context) {
                await context.commit("addTarget", CONFIG.PTUAutomation.Target.TARGET);
            },
            async removeTarget(context, index) {
                if (!context.state.targets[index]) return;
                await context.commit("removeTarget", index);
            },
            async changeTarget(context, { index, value }) {
                if (!context.state.targets[index]) return;
                if(!Object.values(CONFIG.PTUAutomation.Target).includes(value)) return;
                await context.commit("updateTarget", {index, value});
            },

            /*** Conditions */

            /*** Effects */
            async addEffect(context) {
                await context.commit("addEffect", CONFIG.PTUAutomation.Effect.ADD_DAMAGE)
            },
            async removeEffect(context, index) {
                if(!context.state.effects[index]) return;
                await context.commit("removeEffect", index);;
            },
            async changeEffect(context, {index, value}) {
                if(!context.state.effects[index]) return;
                if(!Object.values(CONFIG.PTUAutomation.Effect).includes(value)) return;
                await context.commit("updateEffect", {index, value});
                await context.commit("updateEffectValue", {index, value: ""});
            },
            async updateEffectValue(context, { index, value }) {
                if(!context.state.effects[index]) return;
                await context.commit("updateEffectValue", {index, value});
            },
            /*** Settings */
            async togglePassive(context) {
                const newPassive = !context.state.passive;
                await context.commit("updatePassive", newPassive);
            },
            async changeTiming(context, newTiming) {
                if(!Object.values(CONFIG.PTUAutomation.Timing).includes(newTiming)) return; //if the timing doesn't exist, don't change it
                await context.commit("updateTiming", newTiming);
            },
            async deleteActiveAutomation(context) {
                //if this is the only automation present, don't delete it, just reset it to default values
                if (Object.keys(context.state.automations).length <= 1) {
                    const blankAutomations = {
                        1: {
                            targets: [],
                            conditions: [],
                            effects: [],
                            effectValues: [],
                            timing: CONFIG.PTUAutomation.Timing.BEFORE_ROLL,
                            passive: false,
                        }
                    };
                    await context.commit("setAutomations", blankAutomations)
                    //select this automation as active
                    await context.commit("setActiveAutomation", 1);
                    return;
                }

                //if there are other automations present, delete this one and switch to the first one
                const activeAutomationKey = context.state.activeAutomation;
                const automations = duplicate(context.state.automations);
                delete automations[activeAutomationKey];
                await context.commit("setAutomations", automations);
                await context.commit("setActiveAutomation", Object.keys(context.state.automations)[0]);
            }          
            
            /*** General */
             
        },
        mutations: {
            /*** TABS AND AUTOMATIONS */
            async setAutomations(state, newAutomations) {
                state.automations = newAutomations;
                return state;
            },
            async setActiveAutomation(state, newIndex) {
                state = {
                    activeAutomation: newIndex,
                    targets: state.automations[newIndex].targets,
                    conditions: state.automations[newIndex].conditions, 
                    effects: state.automations[newIndex].effects, 
                    timing: state.automations[newIndex].timing,
                    passive: state.automations[newIndex].passive,
                }
                return state;
            },
            async saveActiveAutomation(state) {
                const activeAutomationKey = state.activeAutomation;
                const automations = duplicate(state.automations);
                automations[activeAutomationKey] = {
                    targets: duplicate(state.targets),
                    conditions: duplicate(state.conditions),
                    effects: duplicate(state.effects),
                    timing: state.timing,
                    passive: state.passive,
                };
                state.automations = automations;
                return state;
            },
            async updateTab(state, targetTab) {
                state.activeTab = targetTab;
                return state;
            },
            
            /*** Targets */
            async addTarget(state, target) {
                const targets = duplicate(state.targets);
                targets.push(target);
                state.targets = targets;
                return state;
            },
            async removeTarget(state, index) {
                const targets = duplicate(state.targets);
                targets.splice(index, 1);
                state.targets = targets;
                return state;
            },
            async updateTarget(state, {index, value}) {
                const targets = duplicate(state.targets);
                targets[index] = value;
                state.targets = targets;
                return state;
            },
            
            /*** Conditions */

            /*** Effects */
            async addEffect(state, effect) {
                const effects = duplicate(state.effects);
                effects.push(effect);
                state.effects = effects;
                return state;
            },
            async removeEffect(state, index) {
                const effects = duplicate(state.effects);
                effects.splice(index, 1);
                state.effects = effects;
                return this.state;
            },
            async updateEffect(state, {index, value}) {
                const effects = duplicate(state.effects);
                effects[index] = value;
                state.effects = effects;
                return state;
            },
            async updateEffectValue(state, {index, value}) {
                const effectValues = duplicate(state.effectValues);
                effectValues[index] = value;
                state.effectValues = effectValues;
                return state;
            },

            /*** Settings */
            async updatePassive(state, newPassive) {
                state.passive = newPassive;
                return state;
            },
            async updateTiming(state, newTiming) {
                state.timing = newTiming;
                return state;
            }

            /*** General */
        },
        state: {
            object: object,
            automations: {}, //auto 1 will be automations.1, auto 2 will be automations.2 etc. 

            /*********
             * temporary fields for displaying and editing individual automations
             * Whenever we switch current automation,
             * save changes from targets, conditions & effects array to old automation index,
             * then switch to new index and propogate targets/conditions/effects as appropriate
             */
            targets: [], // Targets Tab
            conditions: [], // Conditions Tab
            effects: [], // Effects Tab
            effectValues: [], // Effects Tab
            timing: CONFIG.PTUAutomation.Timing.BEFORE_ROLL, // Settings Tab
            passive: false, // Settings Tab
            // Settings tab should also contain 'Delete this automation'
            /***** */

            activeTab: "targets",
            activeAutomation: 1
        }
    })
    store.dispatch('init')

    return store;
}
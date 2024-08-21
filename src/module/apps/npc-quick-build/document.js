import { PokemonGenerator } from "../../actor/pokemon/generator.js";


const MaxPartyPokemon = 6;


const SINGLE_MIN_SKILL_RANK_RE = /(?<rank>(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso)) (?<skill>.+)/i;
const ANY_N_SKILLS_AT_RE = /(any )?(?<n>([0-9]+)|(One)|(Two)|(Three)|(Four)|(Five)|(Six)|(Seven)|(Eight)|(Nine)) Skills at (?<rank>(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso))( Rank)?/i;
const N_SKILLS_AT_FROM_LIST_RE = /(?<n>([0-9]+)|(One)|(Two)|(Three)|(Four)|(Five)|(Six)|(Seven)|(Eight)|(Nine))( Skills)? of (?<skills>.+) at (?<rank>(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso))( Rank)?/i;

function parseIntA(s) {
    let i = parseInt(s);
    if (!Number.isNaN(i)) return i;
    i = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"].indexOf(s.toLowerCase());
    if (i >= 0) return i;
    return Number.NaN;
}

function simplifyString(s) {
    return s.toLowerCase().replace("pokémon", "pokemon").replace("tech education", "technology education");
}

export class NpcQuickBuildData {

    _preloadedCompendiums = false;

    constructor() {
        this.page = 1;
        this.alliance = CONFIG.PTU.data.alliances.includes("opposition") ? "opposition" : CONFIG.PTU.data.alliances[0];
        this.trainer = {
            name: "",
            gender: [],
            level: 1, // TODO: add this as a game setting? game.settings.get("ptu", "generation.defaultTrainerLevel");
            classes: {
                selected: [],
                restricted: true,
            },
            features: {
                selected: [],
                computed: [],
            },
            edges: {
                selected: [],
                computed: [],
            },
            skills: {},
            stats: {},
        };

        // set skills default
        for (const skill of CONFIG.PTU.data.skills.keys) {
            this.trainer.skills[skill] = {
                label: `SKILL.${skill}`,
                value: 1,
                min: 1,
                max: 6,
            }
        }

        // set stats default
        for (const stat of CONFIG.PTU.data.stats.keys) {
            this.trainer.stats[stat] = {
                label: `PTU.Stats.${stat}`,
                value: 0,
                min: 0,
                max: 10 + ((this.trainer.level - 1) * 2),
            }
        }

        // Configure party pokemon slots

        this.party = {};
        for (let n = 1; n <= MaxPartyPokemon; n++) {
            this.party[`slot${n}`] = {
                slot: `slot${n}`,
                configured: false,
                species: {
                    object: null,
                    name: "",
                    img: "icons/svg/mystery-man.svg",
                    uuid: "",
                    selected: [],
                    gender: {
                        selected: "",
                        options: [],
                        choosable: false,
                    },
                    variations: {
                        selected: "",
                        options: [],
                    },
                    optimization: {
                        selected: "good",
                        options: [
                            { label: "PTU.OptimizationLevel.Bad", value: "bad" },
                            { label: "PTU.OptimizationLevel.Neutral", value: "neutral" },
                            { label: "PTU.OptimizationLevel.Good", value: "good" },
                            { label: "PTU.OptimizationLevel.MinMaxed", value: "minmax" },
                        ]
                    },
                },
                shiny: false,
                nickname: "",
                level: {
                    value: game.settings.get("ptu", "generation.defaultDexDragInLevelMin"), // TODO: use a different default? Maybe 2x trainer level?
                    min: 1,
                    max: 100,
                }
            };
        }

        this.multiselects = {
            sex: {
                options: [
                    {
                        label: game.i18n.format("PTU.Male"),
                        value: "Male",
                    },
                    {
                        label: game.i18n.format("PTU.Female"),
                        value: "Female",
                    },
                    {
                        label: game.i18n.format("PTU.Nonbinary"),
                        value: "Nonbinary",
                    },
                    {
                        label: game.i18n.format("PTU.Genderless"),
                        value: "",
                    }
                ],
                maxTags: 1,
            },
            classes: {
                options: []
            },
            features: {
                options: []
            },
            edges: {
                options: []
            },
            species: {
                options: [],
                maxTags: 1,
            }
        };


        this.warnings = [];
    }

    async preload() {
        // TODO can we share the PackLoader from the compendium browser? YES
        const compendiumBrowser = game.ptu.compendiumBrowser;

        // load feats with pack loader/compendium browser!
        if (!NpcQuickBuildData._preloadedCompendiums) {
            await compendiumBrowser.tabs.feats.loadData();
            await compendiumBrowser.tabs.edges.loadData();
            await compendiumBrowser.tabs.species.loadData();
            NpcQuickBuildData._preloadedCompendiums = true;
        }

        // trawl the compendiums for classes/features, edges, and pokemon species
        let featureCompendiums = ["ptu.feats"];
        let edgeCompendiums = ["ptu.edges"];
        let speciesCompendiums = ["ptu.species"];

        // try to use the ones set up in the compendium browser
        const compendiumSettings = game.settings.get("ptu", "compendiumBrowserPacks");
        if (compendiumSettings) {
            featureCompendiums = Object.keys(compendiumSettings.feats).filter(c=>compendiumSettings.feats[c].load);
            edgeCompendiums = Object.keys(compendiumSettings.edges).filter(c=>compendiumSettings.edges[c].load);
            speciesCompendiums = Object.keys(compendiumSettings.species).filter(c=>compendiumSettings.species[c].load);
        }

        // get classes/features
        for (const compendium of featureCompendiums) {
            for (const feature of game.packs.get(compendium).index) {
                if (feature.type !== "feat") continue;
                let bucket = "features";
                if (feature?.system?.keywords?.includes("Class")) bucket = "classes";
                this.multiselects[bucket].options.push({
                    label: feature.name,
                    value: feature.uuid,
                    prerequisites: feature?.system?.prerequisites ?? [],
                })
            }
        }
        this.multiselects.classes.options.sort((a,b) => a.label.localeCompare(b.label));
        this.multiselects.features.options.sort((a,b) => a.label.localeCompare(b.label));

        // get edges
        for (const compendium of edgeCompendiums) {
            for (const edge of game.packs.get(compendium).index) {
                if (edge.type !== "edge") continue;
                this.multiselects.edges.options.push({
                    label: edge.name,
                    value: edge.uuid,
                    prerequisites: edge?.system?.prerequisites ?? [],
                })
            }
        }
        this.multiselects.edges.options.sort((a,b) => a.label.localeCompare(b.label));

        // get species
        for (const compendium of speciesCompendiums) {
            for (const species of game.packs.get(compendium).index) {
                if (species.type !== "species") continue;
                this.multiselects.species.options.push({
                    label: species.name,
                    value: species.uuid,
                })
            }
        }
        this.multiselects.species.options.sort((a,b) => a.label.localeCompare(b.label));
    }

    async _findFromMultiselect(bucket, searchfunction) {
        const found = this.multiselects[bucket]?.options?.find(searchfunction);
        if (!found) return null;
        const uuid = found.value || found.uuid;
        if (!uuid) return null;
        const foundItem = (await fromUuid(uuid))?.toObject();
        if (!foundItem) return null;
        Object.assign(foundItem, {
            uuid,
        });
        return foundItem;
    }

    
    async refresh() {
        // grab the features and prerequisites
        const allComputed = [];
        const featuresComputed = [];
        const edgesComputed = [];

        // Prerequisites that aren't yet met
        const unmetPrereqs = {
            minLevel: 1,
            skills: {},
            warnings: [],
            unknown: [],
        };
        for (const feature of Object.values(this.trainer.classes.selected)) {
            if (!feature.value) continue;
            const item = (await fromUuid(feature.value))?.toObject();
            if (!item) continue;
            Object.assign(item, {
                uuid: feature.value,
            });
            featuresComputed.push(item);
            allComputed.push(item);
        }
        for (const feature of Object.values(this.trainer.features.selected)) {
            if (!feature.value) continue;
            const item = (await fromUuid(feature.value))?.toObject();
            if (!item) continue;
            Object.assign(item, {
                uuid: feature.value,
            });
            featuresComputed.push(item);
            allComputed.push(item);
        }
        for (const edge of Object.values(this.trainer.edges.selected)) {
            if (!edge.value) continue;
            const item = (await fromUuid(edge.value))?.toObject();
            if (!item) continue;
            Object.assign(item, {
                uuid: edge.value,
            });
            edgesComputed.push(item);
            allComputed.push(item);
        }

        /**
         * 
         * @param {*} textPrereq 
         * @param {*} firstPass 
         * @returns {
         *      newFeatures,
         *      newEdges,
         *      allNew,
         *      skillUpdates,
         *      unknown,
         *  }
         */
        const checkTextPrereq = async (textPrereq, firstPass=true)=>{
            const newFeatures = [];
            const newEdges = [];
            const allNew = [];
            const skillUpdates = {};
            const unknown = [];

            const compareName = function (t) {
                return (f)=>simplifyString(f.name) == simplifyString(t);
            };
            const compareLabel = function (t) {
                return (f)=>simplifyString(f.label) == simplifyString(t);
            };
    
            // check if this is the name of a class, feature, or edge we already have
            if (featuresComputed.find(compareName(textPrereq)) || edgesComputed.find(compareName(textPrereq))) return {
                newFeatures,
                newEdges,
                allNew,
                skillUpdates,
                unknown,
            };
    
            // check if it's the name of a class, feature or edge we don't already have
            const featureClass = await this._findFromMultiselect("classes", compareLabel(textPrereq));
            if (featureClass) {
                newFeatures.push(featureClass);
                allNew.push(featureClass);
                return {
                    newFeatures,
                    newEdges,
                    allNew,
                    skillUpdates,
                    unknown,
                };
            }
            const feature = await this._findFromMultiselect("features", compareLabel(textPrereq));
            if (feature) {
                newFeatures.push(feature);
                allNew.push(feature);
                return {
                    newFeatures,
                    newEdges,
                    allNew,
                    skillUpdates,
                    unknown,
                };
            }
            const edge = await this._findFromMultiselect("edges", compareLabel(textPrereq));
            if (edge) {
                newEdges.push(edge);
                allNew.push(edge);
                return {
                    newFeatures,
                    newEdges,
                    allNew,
                    skillUpdates,
                    unknown,
                };
            }

            const getSkill = function (t) {
                // TODO: do better, act right :(
                // this is very gross. Let's add some stuff in index.js so we don't have to rely on the translations
                return CONFIG.PTU.data.skills.keys.find(k=>simplifyString(t) == simplifyString(game.i18n.format(`SKILL.${k}`)));
            };

            // check if it's a single minimum skill rank
            const singleSkillMatch = textPrereq.match(SINGLE_MIN_SKILL_RANK_RE);
            if (singleSkillMatch) {
                // TODO: do better, act right :(
                // this is very gross. Let's add some stuff in index.js so we don't have to rely on the translations
                const rank = [1,2,3,4,5,6,8].find(r=>CONFIG.PTU.data.skills.PTUSkills.getRankSlug(r) == singleSkillMatch.groups.rank.toLowerCase());
                const skill = getSkill(singleSkillMatch.groups.skill);
                if (rank && skill) {
                    skillUpdates[skill] = Math.max(rank, skillUpdates[skill] ?? 0);
                    return {
                        newFeatures,
                        newEdges,
                        allNew,
                        skillUpdates,
                        unknown,
                    };
                }
                // check multi-skill?
                if (singleSkillMatch.groups.skill.includes(" or ")) {
                    const skills = singleSkillMatch.groups.skill.split(" or ").map(getSkill);
                    console.log(skills);
                    // check if we meet any of those prereqs. If so, return.
                    for (const s of skills) {
                        console.log("checking", s, this.trainer.skills[s], skillUpdates[s]);
                        if (rank <= Math.max(this.trainer.skills[s]?.value, skillUpdates[s] ?? 0)) return {
                            newFeatures,
                            newEdges,
                            allNew,
                            skillUpdates,
                            unknown,
                        };
                        console.log("didn't pass with", s, this.trainer.skills[s], skillUpdates[s]);
                    }

                }
            }

            // check if there's "N Skills at RANK"
            const anySkillMatch = textPrereq.match(ANY_N_SKILLS_AT_RE);
            if (anySkillMatch) {
                // TODO: do better, act right :(
                // this is somewhat gross. Let's add some stuff in index.js so we don't have to rely on the translations
                const rank = [1,2,3,4,5,6,8].find(r=>CONFIG.PTU.data.skills.PTUSkills.getRankSlug(r) == anySkillMatch.groups.rank.toLowerCase());
                const n = parseIntA(anySkillMatch.groups.n || "100");
                if (rank && n) {
                    if (CONFIG.PTU.data.skills.keys.filter(k=>rank <= Math.max(this.trainer.skills[k]?.value, skillUpdates[k] ?? 0)).length >= n) return {
                        newFeatures,
                        newEdges,
                        allNew,
                        skillUpdates,
                        unknown,
                    };
                    console.log("failed this", rank, n, anySkillMatch);
                }
            }
            
            // check if there's "any N of SKILLS at RANK"
            const nSkillMatch = textPrereq.match(N_SKILLS_AT_FROM_LIST_RE);
            if (nSkillMatch) {
                // TODO: do better, act right :(
                // this is somewhat gross. Let's add some stuff in index.js so we don't have to rely on the translations
                const rank = [1,2,3,4,5,6,8].find(r=>CONFIG.PTU.data.skills.PTUSkills.getRankSlug(r) == nSkillMatch.groups.rank.toLowerCase());
                const n = parseIntA(nSkillMatch.groups.n || "100");
                const skills = nSkillMatch.groups.skills.split(" or ").map(getSkill);
                if (rank && n) {
                    if (skills.filter(k=>rank <= Math.max(this.trainer.skills[k]?.value, skillUpdates[k] ?? 0)).length >= n) return {
                        newFeatures,
                        newEdges,
                        allNew,
                        skillUpdates,
                        unknown,
                    };
                    console.log("failed this", rank, n, nSkillMatch);
                } else {
                    console.log("failed this else", rank, n, nSkillMatch);
                }
            }

    
            // check if it's an OR clause, and we already match any of the terms
    
    
            // don't do more on the first pass, just push it up into the unknown bucket
            if (firstPass) {
                if (!unmetPrereqs.unknown.includes(textPrereq)) unknown.push(textPrereq);
                return {
                    newFeatures,
                    newEdges,
                    allNew,
                    skillUpdates,
                    unknown,
                };
            };
    
            // consider a more complicated check here?
    
            // give up for now. This may be easier to resolve after a few loops
            return {
                newFeatures,
                newEdges,
                allNew,
                skillUpdates,
                unknown,
            };
        };
        
        // Get all the prerequisites
        for (let idx=0; idx < allComputed.length; idx++) {
            const item = allComputed[idx];

            // parse all of the regular prerequisites
            for (const prereq of item.system.prerequisites) {
                const results = await checkTextPrereq(prereq, true);
                results.newFeatures.forEach(x=>featuresComputed.push(Object.assign(x, { auto: true })));
                results.newEdges.forEach(x=>edgesComputed.push(Object.assign(x, { auto: true })));
                results.allNew.forEach(x=>allComputed.push(Object.assign(x, { auto: true })));
                Object.entries(results.skillUpdates).forEach(([k,v])=>{
                    if (unmetPrereqs.skills[k] ?? 0 < v) unmetPrereqs.skills[k] = v;
                });
                results.unknown.forEach(u=>{
                    if (!unmetPrereqs.unknown.includes(u)) unmetPrereqs.unknown.push(u);
                })
            }
        }

        this.trainer.features.computed = featuresComputed;
        this.trainer.edges.computed = edgesComputed;
        console.log(allComputed);
        console.log(unmetPrereqs);

        // set warnings
        this.warnings = unmetPrereqs.unknown.map(u=>`Unknown/unmet prerequisite "${u}"`);

        // apply established skill minimums
        const newSkills = foundry.utils.deepClone(this.trainer.skills);
        for (const [skill, value] of Object.entries(unmetPrereqs.skills)) {
            newSkills[skill].min = Math.max(value, newSkills[skill].min ?? 1);
            newSkills[skill].value = Math.max(value, newSkills[skill].value ?? 1);
        }
        this.trainer.skills = newSkills;


        // check if any pokemon have been newly configured
        for (const slot of Object.keys(this.party)) {
            const pkmn = foundry.utils.deepClone(this.party[slot]);
            if (!pkmn.configured) {
                // get the uuid of the pokemon
                const uuid = pkmn?.species?.uuid || pkmn?.species?.selected?.at(0)?.value;
                if (!uuid) continue;

                pkmn.species.uuid = uuid;
                // get the pokemon species
                const species = await fromUuid(uuid);
                pkmn.species.object = species;
                pkmn.species.name = species.name;
                // set available genders
                const genders = [];
                const genderRatio = species.system.breeding.genderRatio;
                if (genderRatio == -1) {
                    genders.push({
                        label: "PTU.Genderless",
                        value: "Genderless"
                    });
                }
                if (genderRatio >= 0 && genderRatio < 100) {
                    genders.push({
                        label: "PTU.Male",
                        value: "Male"
                    });
                }
                if (genderRatio > 0 && genderRatio <= 100) {
                    genders.push({
                        label: "PTU.Female",
                        value: "Female"
                    });
                }
                if (!genders.find(g=>g.value == pkmn.species.gender.selected)) {
                    if (genderRatio == -1) {
                        pkmn.species.gender.selected = "Genderless";
                    } else {
                        pkmn.species.gender.selected = Math.random() * 100 < genderRatio ? "Male" : "Female";
                    }
                }
                pkmn.species.gender.options = genders;
                pkmn.species.gender.choosable = genders.length > 1;

                // get minimum level for this evolution
                pkmn.level.min = species.system.evolutions.find(e=>e.slug == species.system.slug)?.level ?? 1;
                if (pkmn.level.value < pkmn.level.min) {
                    pkmn.level.value = pkmn.level.min;
                }

                pkmn.configured = true;
            };
            // get image
            const img = await PokemonGenerator.getImage(pkmn.species.object, {
                gender: pkmn.species.gender.selected,
                shiny: pkmn.shiny,
            })
            if (img) {
                pkmn.species.img = img;
            }
            this.party[slot] = pkmn;
        }

        console.log(this);
    }

    async finalize() {
        // TODO: fill unfilled required fields
    }

    async generate() {
        // build the folders
        const mainFolder = await Folder.create({
            name: this.trainer.name || "Unnamed Trainer",
            type: "Actor",
            parent: null,
        });
        const partyFolder = !Object.values(this.party).find(p=>p.configured) ? null : await Folder.create({
            name: "Party",
            type: "Actor",
            parent: null,
            folder: mainFolder._id,
        });

        // build the NPC
        const skills = {}
        for (const skill of CONFIG.PTU.data.skills.keys) {
            skills[skill] = {
                label: game.i18n.format(`SKILL.${skill}`),
                modifier: {
                    mod: 0,
                    total: 0,
                    value: 0,
                },
                rank: CONFIG.PTU.data.skills.PTUSkills.getRankSlug(this.trainer.skills[skill].value),
                slug: skill,
                // type: body???
                value: {
                    value: this.trainer.skills[skill].value,
                    mod: 0,
                    total: this.trainer.skills[skill].value,
                },
            }
        }
        const stats = {}
        for (const stat of CONFIG.PTU.data.stats.keys) {
            stats[stat] = {
                base: stat == "hp" ? 10 : 5,
                label: game.i18n.format(`PTU.Stats.${stat}`),
                levelUp: this.trainer.stats[stat].value,
                mod: {
                    value: 0,
                    mod: 0,
                },
                total: null,
                value: null,
            }
        }

        const items = [];
        for (const feature of this.trainer.features.computed) {
            const fobj = (await fromUuid(feature.uuid))?.toObject();
            fobj.flags.core = {
                sourceId: feature.uuid,
            };
            items.push(fobj);
        }
        for (const edge of this.trainer.edges.computed) {
            const eobj = (await fromUuid(edge.uuid))?.toObject();
            eobj.flags.core = {
                sourceId: edge.uuid,
            };
            items.push(eobj);
        }

        const trainerData = {
            name: this.trainer.name || "Unnamed Trainer",
            img: "icons/svg/mystery-man.svg",
            type: "character",
            system: {
                age: `${5 + Math.floor(this.trainer.level/2) + Math.floor(Math.random() * (this.trainer.level + 10))}`,
                alliance: this.alliance,
                skills,
                stats,
                level: {
                    current: this.trainer.level,
                    milestones: this.trainer.level - 1,
                    dexexp: 0,
                    miscexp: 0,
                },
                sex: this.trainer.sex.length > 0 ? this.trainer.sex[0].label : "",
            },
            items,
            folder: mainFolder?._id ?? null,
        };
        console.log(trainerData);
        // create trainer
        const createdTrainer = await CONFIG.PTU.Actor.documentClasses.character.createDocuments([trainerData]);



        // generate pokemon
        const monActorsToGenerate = [];
        for (const mon of Object.values(this.party)) {
            if (!mon.configured) continue;

            const monSpecies = await fromUuid(mon.species.uuid);
            const generator = new PokemonGenerator(monSpecies);
            generator.level = mon.level.value;
            generator.gender = mon.species.gender.current;
            generator.shiny = mon.shiny;
            generator.evolution = true; // don't change the species via evolution
            const generatorData = await generator.prepare().then(()=>generator.create({
                folder: partyFolder?._id ?? null,
                generate: false,
            }));

            const actorData = {
                ...generatorData.actor,
                items: generatorData.items,
                name: mon.nickname || generatorData.actor.name,
            }
            actorData.system.alliance = this.alliance;
            actorData.flags ??= {}
            actorData.flags.ptu ??= {}
            actorData.flags.ptu.party ?? {
                trainer: createdTrainer._id,
                boxed: false,
            }
            console.log(actorData);
            monActorsToGenerate.push(actorData);
        }
        if (monActorsToGenerate) {
            const createdActors = await CONFIG.PTU.Actor.documentClasses.pokemon.createDocuments(monActorsToGenerate);
            console.log(createdActors);
        }
    }

    get ready() {
        return true;
    }
}
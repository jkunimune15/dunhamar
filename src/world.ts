// world.ts

// @ts-ignore
import TinyQueue from './lib/tinyqueue.js';

import {Nodo, Surface} from "./surface.js";
import {Random} from "./random.js";
import {Language, ProtoLanguage, DeuteroLanguage, Convention, transcribe} from "./language.js";


const TIME_STEP = 100; // [year]
const AUTHORITARIANISM = 1e-7; // [1/year/km^2] rate at which people coalesce into kingdoms
const LIBERTARIANISM = 5e-7; // [1/year/km^2] rate at which tribes coalesce into kingdoms
const NATIONALISM = 3.0; // [] factor by which a military is stronger if conquering people to whom they can talk
const SOCIAL_DECAY_PERIOD = 1000; // [year] time it takes for an empire's might to decay by 2.7
const CULTURAL_MEMORY = 160; // [year] time it takes to erase a people's language
const CARRYING_CAPACITY = .05; // [1/km^2] density of people that can live in a grassland with entry-level technology
const VALUE_OF_KNOWLEDGE = .50; // [] value of a single technological advancement
const POWER_OF_MEMES = .020; // [1/year] probability that an idea spreads across a border in a year
const HUMAN_WEIGHT = 100; // [] multiplier on vertical distances
const APOCALYPSE_SURVIVAL_RATE = 0.5;

const DOMUBLIA = new Map([ // terrain modifiers for civ spawning and population growth
	['samud',       0.0],
	['potistan',    0.1],
	['barxojangal', 0.3],
	['jangal',      3.0],
	['lage',        0.0],
	['taige',       0.3],
	['piristan',    0.1],
	['grasistan',   1.0],
	['registan',    0.1],
	['tundre',      0.1],
	['aise',        0.0],
]);
const RIVER_UTILITY_THRESHOLD = 1e6;
const RIVER_UTILITY = 0.3;
const OCEAN_UTILITY = 1.0;
const PASABLIA = new Map([ // terrain modifiers for invasion speed
	['samud',       0.1],
	['potistan',    0.1],
	['barxojangal', 0.1],
	['jangal',      1.0],
	['lage',        0.3],
	['taige',       1.0],
	['piristan',    0.3],
	['grasistan',   3.0],
	['registan',    0.1],
	['tundre',      0.3],
	['aise',        0.1],
]);


/**
 * collection of civilizations and languages that goes on a planet
 */
export class World {
	public readonly imperialism: number; // [km/y] the rate at which denizens conquer
	public readonly intelligence: number; // [1/y] the rate at which denizens have good ideas
	public readonly cataclysms: number; // [1/y] the rate at which the apocalypse happens
	public planet: Surface;
	public civs: Set<Civ>;

	constructor(imperialism: number, intelligence: number, cataclysms: number, planet: Surface) {
		this.imperialism = imperialism;
		this.intelligence = intelligence;
		this.cataclysms = cataclysms;
		this.planet = planet;
		this.civs = new Set(); // list of countries in the world
	}

	/**
	 * populate the World with all the civs and stuff.
	 * @param year the number of years to simulate
	 * @param rng the random number generator to use
	 */
	generateHistory(year: number, rng: Random) {
		for (let t = 0; t < year; t += TIME_STEP) {
			for (const civ of this.civs)
				civ.update(rng);
			this.spawnCivs(rng); // TODO: build cities
			this.spreadCivs(rng); // TODO: add cataclysms
			this.spreadIdeas(rng);
		}
	}

	/**
	 * generate a few new civs in uninhabited territory
	 * @param rng the random number generator to use
	 */
	spawnCivs(rng: Random) {
		for (const tile of this.planet.nodos) {
			const demomultia = CARRYING_CAPACITY*getDomublia(tile);
			const ruler = this.currentRuler(tile);
			if (ruler == null) { // if it is uncivilized, the limiting factor is the difficulty of establishing a unified state
				if (rng.probability(AUTHORITARIANISM*TIME_STEP*demomultia))
					this.civs.add(new Civ(tile, this.civs.size, this, rng));
			}
			else { // if it is already civilized, the limiting factor is the difficulty of starting a revolution
				if (rng.probability(LIBERTARIANISM*TIME_STEP*demomultia)) // use the population without technology correction for balancing
					this.civs.add(new Civ(tile, this.civs.size, this, rng, ruler.technology));
			}
		}
	}

	/**
	 * expand the territories of expansionist civs
	 * @param rng the random number generator to use
	 */
	spreadCivs(rng: Random) {
		const invasions	= new TinyQueue([], (a: {time: number}, b: {time: number}) => a.time - b.time); // keep track of all current invasions
		for (const invader of this.civs) {
			for (const ourTile of invader.kenare.keys()) { // each civ initiates all its invasions
				for (const theirTile of invader.kenare.get(ourTile)) {
					const time = this.estimateInvasionTime(invader, ourTile, theirTile, rng); // figure out when they will be done
					if (time <= TIME_STEP) // if that goal is within reach
						invasions.push({time: time, invader: invader, start: ourTile, end: theirTile}); // start on it
				}
			}
		}
		while (invasions.length > 0) {
			let {time, invader, start, end} = invasions.pop(); // as invasions finish
			const invadee = this.currentRuler(end);
			if (invader.nodos.has(start) && !invader.nodos.has(end) && invadee !== null &&
					invader.getStrength(invadee, end) > invadee.getStrength(invadee, end)) { // check that they're still doable
				invader.conquer(end); // update the game state
				for (const neighbor of end.neighbors.keys()) { // and move on
					if (!invader.nodos.has(neighbor)) {
						time = time + this.estimateInvasionTime(invader, end, neighbor, rng);
						if (end <= TIME_STEP) { // assuming it is possible
							invasions.push({time: time, invader: invader, start: end, end: neighbor});
						}
					}
				}
			}
		}
	}

	/**
	 * carry technology across borders. every civ has a chance to gain each technology at least one of their neighors have that they don't
	 * @param rng
	 */
	spreadIdeas(rng: Random) {
		const visibleTechnology: Map<Civ, number> = new Map(); // how much advanced technology can they access?
		for (const civ of this.civs) {
			visibleTechnology.set(civ, civ.technology); // well, any technology they _have_, for one
			for (const other of this.civs) { // look at every other civ
				if (other.technology > visibleTechnology.get(civ)) { // if they have something we don't
					for (const tiles of civ.kenare.values()) { // check our borders
						for (const tile of tiles) {
							if (other.nodos.has(tile)) { // to see if we share any with them
								visibleTechnology.set(civ, other.technology); // if so, we can access their technology
							}
						}
					}
				}
			}
		}
		const spreadChance = Math.exp(-TIME_STEP*POWER_OF_MEMES);
		for (const civ of this.civs) {
			if (visibleTechnology.get(civ) > civ.technology)
				civ.technology += VALUE_OF_KNOWLEDGE*rng.binomial(
					(visibleTechnology.get(civ) - civ.technology)/VALUE_OF_KNOWLEDGE,
					spreadChance);
		}
	}

	/**
	 * how many years will it take this Civ to invade this Node?
	 * @param invader the invading party
	 * @param start the source of the invaders
	 * @param end the place being invaded
	 * @param rng the random number generator to use to determine the battle outcome
	 */
	estimateInvasionTime(invader: Civ, start: Nodo, end: Nodo, rng: Random) {
		const invadee = this.currentRuler(end);
		const momentum = invader.getStrength(invadee, end);
		const resistance = (invadee !== null) ? invadee.getStrength(invadee, end) : 0;
		const distance = start.neighbors.get(end).length;
		const elevation = start.gawe - end.gawe;
		const distanceEff = Math.hypot(distance, HUMAN_WEIGHT*elevation)/PASABLIA.get(end.biome);
		if (momentum > resistance) // this randomness ensures Civs can accomplish things over many timesteps
			return rng.exponential(distanceEff/this.imperialism/(momentum - resistance));
		else
			return Infinity;
	}

	/**
	 * determine the current Civ of this tile
	 */
	currentRuler(tile: Nodo): Civ {
		for (const civ of this.civs) // TODO: does this take a lot of time?
			if (civ.nodos.has(tile))
				return civ;
		return null;
	}
}


/**
 * a single political entity
 */
class Civ {
	public readonly id: number;
	private readonly name: number; // its name index
	private arableLand: number; // the population, pre technology modifier
	public languages: Map<Nodo, Language>; // the languages of this country
	public officialLanguage: Language;
	public readonly capital: Nodo; // the capital city
	public readonly nodos: Set<Nodo>; // the tiles it owns
	public readonly kenare: Map<Nodo, Set<Nodo>>; // the set of tiles it owns that are adjacent to tiles it doesn't
	private readonly world: World;

	public militarism: number; // base military strength
	public technology: number; // technological military modifier

	/**
	 * create a new civilization
	 * @param capital the home tile, with which this empire starts
	 * @param id a nonnegative integer unique to this civ
	 * @param world the world in which this civ lives
	 * @param rng a random number generator
	 * @param technology
	 */
	constructor(capital: Nodo, id: number, world: World, rng: Random, technology: number = 1) {
		this.world = world; // TODO if every Civ has its own rng, it would make things a bit more stable
		this.id = id;
		this.arableLand = 0;
		this.nodos = new Set();
		this.kenare = new Map<Nodo, Set<Nodo>>();
		this.languages = new Map();

		if (world.currentRuler(capital) === null) // if this is a wholly new civilization
			this.officialLanguage = new ProtoLanguage(rng); // make up a language
		else // if it's based on an existing one
			this.officialLanguage = null; // the language will get automatically set when the capital is conquered

		this.capital = capital;
		this.conquer(capital);

		this.name = rng.discrete(0, 100); // TODO make it so countries can borrow names from each other

		this.militarism = rng.erlang(4, 1);
		this.technology = technology;
	}

	/**
	 * do the upkeep required for this to officially gain tile.
	 * @param tile the land being acquired
	 */
	conquer(tile: Nodo) {
		const loser = this.world.currentRuler(tile);
		if (loser !== null) {
			const language = loser.languages.get(tile); // update the language state
			this.languages.set(tile, language);
			if (this.officialLanguage === null)
				this.officialLanguage = language; // and take it as our official language if we don't have one already
			loser.lose(tile); // then make it neutral territory
		}
		else {
			this.languages.set(tile, this.officialLanguage);
		}

		this.nodos.add(tile); // add it to nodos
		this.kenare.set(tile, new Set<Nodo>()); // adjust the border map as necessary
		for (const neighbor of tile.neighbors.keys()) {
			if (this.kenare.has(neighbor) && this.kenare.get(neighbor).has(tile)) {
				this.kenare.get(neighbor).delete(tile);
				if (this.kenare.get(neighbor).size === 0)
					this.kenare.delete(neighbor);
			}
			else if (!this.nodos.has(neighbor))
				this.kenare.get(tile).add(neighbor);
		}

		this.arableLand += getDomublia(tile); // adjust population
	}

	/**
	 * do the upkeep required for this to officially lose tile.
	 * @param tile the land being taken
	 */
	lose(tile: Nodo) {
		this.languages.delete(tile); // remove it from the language map

		this.nodos.delete(tile); // remove it from nodos
		this.kenare.delete(tile); // adjust the border map
		for (const neighbor of tile.neighbors.keys()) {
			if (this.nodos.has(neighbor)) {
				if (!this.kenare.has(neighbor))
					this.kenare.set(neighbor, new Set<Nodo>());
				this.kenare.get(neighbor).add(tile);
			}
		}

		this.arableLand -= getDomublia(tile);
		if (this.arableLand < 0)
			this.arableLand = 0;
		if (!this.nodos.has(this.capital)) // kill it when it loses its capital
			this.militarism = 0;
	}

	/**
	 * change with the passing of the centuries
	 * @param rng
	 */
	update(rng: Random) {
		const newLects: Map<Language, DeuteroLanguage> = new Map();
		for (const nodo of this.nodos) {
			if (this.languages.get(nodo) !== this.officialLanguage)
				if (this.languages.get(nodo).isIntelligible(this.officialLanguage) ||
						rng.probability(TIME_STEP/CULTURAL_MEMORY))
					this.languages.set(nodo, this.officialLanguage);
			const currentLect = this.languages.get(nodo);
			if (!newLects.has(currentLect))
				newLects.set(currentLect, new DeuteroLanguage(currentLect, rng));
			this.languages.set(nodo, newLects.get(currentLect));
		}
		if (this.nodos.has(this.capital))
			this.officialLanguage = this.languages.get(this.capital);

		if (this.nodos.size > 0) {
			this.militarism *= Math.exp(-TIME_STEP / SOCIAL_DECAY_PERIOD);
			this.technology += VALUE_OF_KNOWLEDGE * rng.poisson(
				this.world.intelligence*TIME_STEP*this.getPopulation());
		}
	}

	getStrength(kontra: Civ, sa: Nodo) : number {
		let linguisticModifier = 1;
		if (kontra != null && kontra.languages.get(sa).isIntelligible(this.officialLanguage))
			linguisticModifier = NATIONALISM;
		return this.militarism*this.technology*linguisticModifier;
	}

	getPopulation(): number {
		return CARRYING_CAPACITY*this.arableLand*this.technology;
	}

	getName(convention: Convention = Convention.NASOMEDI): string {
		return transcribe(this.officialLanguage.getCountryName(this.name), convention);
	}
}

function getDomublia(tile: Nodo): number {
	let val = DOMUBLIA.get(tile.biome);
	if (val > 0) {
		for (const neighbor of tile.neighbors.keys()) {
			if (tile.neighbors.get(neighbor).liwe > RIVER_UTILITY_THRESHOLD)
				val += RIVER_UTILITY;
			if (neighbor.biome === 'samud' || neighbor.biome === 'lage')
				val += OCEAN_UTILITY;
		}
	}
	return val*tile.surface.area/tile.surface.nodos.size;
}

/**
 * MIT License
 *
 * Copyright (c) 2021 Justin Kunimune
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// @ts-ignore
import TinyQueue from "../lib/tinyqueue.js";

/**
 * maximum index.
 */
export function argmax(arr: number[]): number {
	let maxIdx = null;
	for (let i = 0; i < arr.length; i ++)
		if (maxIdx === null || arr[i] > arr[maxIdx])
			maxIdx = i;
	return maxIdx;
}

/**
 * second Legendre polynomial.
 */
export function legendreP2(y: number): number {
	return (3*y*y - 1)/2;
}

/**
 * second Legendre polynomial.
 */
export function legendreP4(y: number): number {
	return ((35*y*y - 30)*y*y + 3)/8;
}

/**
 * second Legendre polynomial.
 */
export function legendreP6(y: number): number {
	return (((231*y*y - 315)*y*y + 105)*y*y - 5)/16;
}

/**
 * linearly interpolate x from the sorted function X onto the corresponding output Y.
 */
export function linterp(inVal: number, inRef: number[], exRef: number[]): number {
	if (inRef.length !== exRef.length)
		throw "array lengths must match";

	let min = 0, max = inRef.length - 1;
	while (max - min > 1) {
		const mid = Math.trunc((min + max)/2);
		if (inRef[mid] <= inVal)
			min = mid;
		else
			max = mid;
	}

	return (inVal - inRef[min])/(inRef[max] - inRef[min])*(exRef[max] - exRef[min]) + exRef[min];
}

/**
 * combine the two arrays and remove duplicates.
 */
export function union(a: Iterable<any>, b: Iterable<any>): Iterable<any> {
	const aa = [...a];
	const ba = [...b];
	return aa.concat(ba.filter(e => !aa.includes(e)));
}




/**
 * perform a Dijkstra search on the given Euclidean graph from the given nodes. return the shortest path from the node
 * that is furthest from those endpoint nodes to the endpoint node that is closest to it, as a list of indices.
 * @param nodes the locations of all of the nodes in the plane, and their connections
 * @param endpoints the indices of the possible endpoints
 * @param threshold the minimum clearance of an edge
 * @return list of indices starting with the farthest connected point and stepping through the path, and the path length
 */
export function longestShortestPath(nodes: {x: number, y: number, edges: {length: number, clearance: number}[]}[],
							 endpoints: Set<number>, threshold: number = 0): {points: number[], length: number} {
	const graph = [];
	for (let i = 0; i < nodes.length; i ++)
		graph.push({distance: Number.POSITIVE_INFINITY, cene: null, lewi: false})

	const queue = new TinyQueue([], (a: {distance: number}, b: {distance: number}) => a.distance - b.distance);
	for (const i of endpoints)
		queue.push({start: null, end: i, distance: 0}); // populate the queue with the endpoints

	let furthest = null;
	while (queue.length > 0) { // while there are places whither you can go
		const {start, end, distance} = queue.pop(); // look for the closest one
		if (!graph[end].lewi) { // only look at each one once
			for (let next = 0; next < nodes.length; next ++) { // add its neighbors to the queue
				if (nodes[end].edges[next] !== null && nodes[end].edges[next].clearance >= threshold) // if they are connected with enough clearance
					queue.push({start: end, end: next, distance: distance + nodes[end].edges[next].length});
			}
			graph[end] = {distance: distance, cene: start, lewi: true}; // mark this as visited
			furthest = end; // and as the furthest yet visited
		}
	}

	const points = [furthest];
	let length = 0;
	let i = furthest; // starting at the furthest point you found,
	while (graph[i].cene !== null) { // step backwards and record the path
		length += nodes[i].edges[graph[i].cene].length;
		i = graph[i].cene;
		points.push(i);
	}
	return {points: points, length: length};
}


/**
 * compute the point equidistant from the three points given.
 */
export function circumcenter(points: {x: number, y: number}[]): {x: number, y: number} {
	if (points.length !== 3)
		console.log("it has to be 3.");
	let xNumerator = 0, yNumerator = 0;
	let denominator = 0;
	for (let i = 0; i < 3; i++) { // do the 2D circumcenter calculation
		const a = points[i];
		const b = points[(i + 1)%3];
		const c = points[(i + 2)%3];
		xNumerator += (a.x*a.x + a.y*a.y) * (b.y - c.y);
		yNumerator += (a.x*a.x + a.y*a.y) * (c.x - b.x);
		denominator += a.x * (b.y - c.y);
	}
	return {
		x: xNumerator/denominator/2,
		y: yNumerator/denominator/2};
}


/**
 * generate a set of three mutually orthogonal Vectors
 * @param n the direction of the n vector
 * @param normalize whether to normalize the three vectors before returning them
 * @param axis v will be chosen to be coplanar with axis and n
 * @param bias if axis and n are parallel, v will be chosen to be coplanar with axis, n, and bias
 * @returns three vectors, u, v, and n.  if they are normalized, u×v=n, v×n=u, and n×u=v.  if they aren’t then the
 * magnitudes will be whatever.  also, u will always be orthogonal to axis.  if there is an opcion,
 */
export function orthogonalBasis(n: Vector, normalize: boolean = false, axis: Vector = new Vector(0, 0, 1), bias: Vector = new Vector(1, 0, 0)): {u: Vector, v: Vector, n: Vector} {
	if (axis.cross(n).sqr() === 0) {
		axis = bias;
		if (bias.cross(n).sqr() === 0) {
			if (n.y !== 0)
				axis = new Vector(0, 0, 1);
			else
				axis = new Vector(0, 1, 0);
		}
	}

	let u = axis.cross(n);
	let v = n.cross(u);

	if (normalize) {
		u = u.norm();
		v = v.norm();
		n = n.norm();
	}

	return {u: u, v: v, n: n};
}



/**
 * a vector in 3-space
 */
export class Vector {
	public x: number;
	public y: number;
	public z: number;

	constructor(x: number, y: number, z: number) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	times(a: number): Vector {
		return new Vector(
			this.x * a,
			this.y * a,
			this.z * a);
	}

	over(a: number): Vector {
		return new Vector(
			this.x / a,
			this.y / a,
			this.z / a);
	}

	plus(that: Vector): Vector {
		return new Vector(
			this.x + that.x,
			this.y + that.y,
			this.z + that.z);
	}

	minus(that: Vector): Vector {
		return new Vector(
			this.x - that.x,
			this.y - that.y,
			this.z - that.z);
	}

	dot(that: Vector): number {
		return (
			this.x*that.x +
			this.y*that.y +
			this.z*that.z);
	}

	cross(that: Vector): Vector {
		return new Vector(
			this.y*that.z - this.z*that.y,
			this.z*that.x - this.x*that.z,
			this.x*that.y - this.y*that.x);
	}

	sqr(): number {
		return this.dot(this);
	}

	norm(): Vector {
		return this.over(Math.sqrt(this.sqr()));
	}

	toString(): string {
		return `<${Math.trunc(this.x*1e3)/1e3}, ${Math.trunc(this.y*1e3)/1e3}, ${Math.trunc(this.z*1e3)/1e3}>`;
	}
}


/**
 * an n×m matrix
 */
export class Matrix {
	private readonly values: number[][];
	public readonly n: number;
	public readonly m: number;

	constructor(values: number[][]) {
		for (let i = 0; i < values.length; i ++)
			if (values[i].length !== values[0].length)
				throw RangeError("the rows of a Matrix must all have the same length.");
		this.values = values;
		this.n = values.length;
		this.m = values[0].length;
	}

	public times(that: Matrix): Matrix {
		if (this.m !== that.n)
			throw RangeError("these matrices don't have compatible sizes.");
		const newValues: number[][] = [];
		for (let i = 0; i < this.n; i ++) {
			newValues.push([]);
			for (let j = 0; j < that.m; j ++) {
				newValues[i].push(0);
				for (let k = 0; k < this.m; k ++) {
					newValues[i][j] += this.values[i][k]*that.values[k][j];
				}
			}
		}
		return new Matrix(newValues);
	}

	public trans(): Matrix {
		const newValues: number[][] = [];
		for (let i = 0; i < this.m; i ++) {
			newValues.push([]);
			for (let j = 0; j < this.n; j ++)
				newValues[i].push(this.values[j][i]);
		}
		return new Matrix(newValues);
	}

	/**
	 * ported from https://www.sanfoundry.com/java-program-find-inverse-matrix/
	 */
	public inverse(): Matrix {
		if (this.n !== this.m)
			throw "the matrix has to be square";
		const n = this.n;

		const a: number[][] = [];
		for (let i = 0; i < n; i ++)
			a.push(this.values[i].slice());

		const x: number[][] = [];
		const b: number[][] = [];
		const index: number[] = [];
		for (let i = 0; i < n; i ++) {
			x.push([]);
			b.push([]);
			for (let j = 0; j < n; j ++) {
				x[i].push(0);
				b[i].push((i === j) ? 1 : 0);
			}
			index.push(0);
		}

		// Transform the matrix into an upper triangle
		Matrix.gaussian(a, index);

		// Update the matrix b[i][j] with the ratios stored
		for (let i = 0; i < n - 1; i ++)
			for (let j = i + 1; j < n; j ++)
				for (let k = 0; k < n; k ++)
					b[index[j]][k] -= a[index[j]][i] * b[index[i]][k];

		// Perform backward substitutions
		for (let i = 0; i < n; i ++) {
			x[n - 1][i] = b[index[n - 1]][i] / a[index[n - 1]][n - 1];
			for (let j = n - 2; j >= 0; j --) {
				x[j][i] = b[index[j]][i];
				for (let k = j + 1; k < n; k ++) {
					x[j][i] -= a[index[j]][k] * x[k][i];
				}
				x[j][i] /= a[index[j]][j];
			}
		}
		return new Matrix(x);
	}

	/**
	 * Method to carry out the partial-pivoting Gaussian
	 * elimination. Here index[] stores pivoting order.
	 */
	private static gaussian(a: number[][], index: number[]): void {
		const n = index.length;
		const c: number[] = [];
		for (let i = 0; i < n; i ++)
			c.push(0);

		// Initialize the index
		for (let i = 0; i < n; i ++)
			index[i] = i;

		// Find the rescaling factors, one from each row
		for (let i = 0; i < n; i ++) {
			let c1 = 0;
			for (let j = 0; j < n; j ++) {
				const c0 = Math.abs(a[i][j]);
				if (c0 > c1)
					c1 = c0;
			}
			c[i] = c1;
		}

		// Search the pivoting element from each column
		let k = 0;
		for (let j = 0; j < n - 1; j ++) {
			let pi1 = 0;
			for (let i = j; i < n; i ++) {
				let pi0 = Math.abs(a[index[i]][j]);
				pi0 /= c[index[i]];
				if (pi0 > pi1) {
					pi1 = pi0;
					k = i;
				}
			}

			// Interchange rows according to the pivoting order
			const itmp = index[j];
			index[j] = index[k];
			index[k] = itmp;
			for (let i = j + 1; i < n; i ++) {
				const pj = a[index[i]][j] / a[index[j]][j];

				// Record pivoting ratios below the diagonal
				a[index[i]][j] = pj;

				// Modify other elements accordingly
				for (let l = j + 1; l < n; l ++)
					a[index[i]][l] -= pj * a[index[j]][l];
			}
		}
	}

	public asArray(): number[][] {
		const output = [];
		for (const row of this.values)
			output.push(row.slice());
		return output;
	}

	get(i: number, j: number = 0): number {
		return this.values[i][j];
	}
}


/**
 * a data structure storing a series of nonintersecting segments on a line, with the ability
 * to efficiently erode all segments by the same amount.
 */
export class ErodingSegmentTree {
	/** the remaining height it can erode before being empty (half-width of the largest interval) */
	private radius: number;
	/** the center of the largest remaining interval */
	private pole: number;
	/** the link with the leftmost endpoint */
	private minim: Link;
	/** the link with the rightmost endpoint */
	private maxim: Link;
	/** the link with the root endpoint */
	private mul: Link;
	/** the number of additions so far */
	private index: number;

	constructor(xMin: number, xMax: number) {
		if (xMin > xMax)
			throw RangeError("initial range must be positive!");
		this.minim = new Link(xMin, true, 0, null);
		this.maxim = new Link(xMax, false, 1, this.minim, this.minim, null);
		this.mul = this.minim;
		this.radius = (xMax - xMin)/2;
		this.pole = (xMax + xMin)/2;
		this.index = 1;
	}

	/**
	 * remove the region between xL and xR from the segments.
	 * @param xL
	 * @param xR
	 */
	block(xL: number, xR: number): void {
		if (xL > xR)
			throw RangeError("blocking range must be positive!");
		let left = this.search(xL, this.mul); // find the left bound
		if (left !== null && left.esaLeft) // if it is in an included area
			left = this.insert(xL, false, this.mul); // insert a new Link
		let rait = this.search(xR, this.mul);
		rait = (rait !== null) ? rait.bad : this.minim; // find the right bound
		if (rait !== null && !rait.esaLeft) // if it is in an included area
			rait = this.insert(xR, true, this.mul); // find the right bound

		if (left === null || left.bad !== rait) // if there was anything between them
			this.deleteBetween(left, rait, this.mul); // remove it

		if ((left === null || this.pole >= left.val) || (rait === null || this.pole <= rait.val)) { // if you touched the pole, recalculate it
			this.radius = 0;
			this.pole = Number.NaN;
			let link = this.minim;
			while (link !== null) {
				if (link.bad.val - link.val > 2 * this.radius) {
					this.radius = (link.bad.val - link.val) / 2;
					this.pole = (link.bad.val + link.val) / 2;
				}
				link = link.bad.bad;
			}
		}
	}

	/**
	 * move all endpoints inward by t, and remove now empty intervals.
	 * @param t
	 */
	erode(t: number): void {
		let link = this.minim;
		while (link !== null) {
			if (link.bad.val - link.val <= 2*t) {
				const next = link.bad.bad;
				this.deleteBetween(link.cen, next, this.mul);
				link = next;
			}
			else {
				link.val += t;
				link.bad.val -= t;
				link = link.bad.bad;
			}
		}
		this.radius -= t;
	}

	/**
	 * is this value contained in one of the segments?
	 * @param value
	 */
	contains(value: number): boolean {
		const left = this.search(value, this.mul);
		return left !== null && left.esaLeft;
	}

	/**
	 * find the endpoint nearest this value.
	 * @param value
	 */
	nearest(value: number): number {
		const left = this.search(value, this.mul);
		const rait = left.bad;
		if (value - left.val < rait.val - value)
			return left.val;
		else
			return rait.val;
	}

	/**
	 * insert a new value, with it's esaLeft parameter, in the proper place
	 * @param value
	 * @param left
	 * @param start
	 */
	insert(value: number, left: boolean, start: Link): Link {
		if (start.val <= value) {
			if (start.raitPute !== null)
				return this.insert(value, left, start.raitPute); // look in the right subtree
			else
				return start.raitPute = new Link(value, left, this.index += 1, start, start, start.bad); // this _is_ the right subtree
		}
		else {
			if (start.leftPute !== null)
				return this.insert(value, left, start.leftPute); // look in the left subtree
			else
				return start.leftPute = new Link(value, left, this.index += 1, start, start.cen, start); // this _is_ the left subtree
		}
	}

	/**
	 * search for the last element e in the subtree from start, such that e.val <= value
	 * @param value
	 * @param start
	 */
	search(value: number, start: Link): Link {
		if (start.val <= value) { // if it could be start
			let res = null;
			if (start.raitPute !== null) // look in the right subtree
				res = this.search(value, start.raitPute);
			if (res === null) // if there was no right subtree or the search turn up noting
				return start; // the answer is start
			else
				return res; // otherwise return whatever you found
		}
		else { // if it is left of start
			if (start.leftPute !== null)
				return this.search(value, start.leftPute); // look in the left tree. if it's not there, it's not here.
			else
				return null;
		}
	}

	/**
	 * delete all Links between these two, excluding these two
	 * @param left
	 * @param rait
	 * @param start the root of the subtree where we're doing
	 */
	deleteBetween(left: Link, rait: Link, start: Link): void { // TODO how will this work with identical leavs?
		if (start === this.mul) { // if this is the top level, there's some stuff we need to check
			if (left === null && rait === null) { // if we're deleting the whole thing
				this.mul = null; // delete the whole thing and be done
				return;
			}
			else if (left === null) // if we're deleting the left side
				this.minim = rait; // get the new minim
			else if (rait === null)
				this.maxim = left; // get the new maxim
		}
		console.assert(start !== null);

		const raitOfCenter = rait === null || start.cena(rait); // does the right bound include start?
		const leftOfCenter = left === null || left.cena(start); // does the left bound include start?
		if (leftOfCenter && start.leftPute !== null) { // we need to check the left side
			if (left === null && (rait === start || raitOfCenter)) // if we can,
				start.leftPute = null; // drop the entire left branch
			else if (rait === start || raitOfCenter) // if not but at least the right side of left is all taken
				this.deleteBetween(left, null, start.leftPute); // check the left side of the left branch
			else // if there are no shortcuts
				this.deleteBetween(left, rait, start.leftPute); // check the whole left branch
		}
		if (raitOfCenter && start.raitPute !== null) { // we need to check the right side
			if (rait === null && (left === start || leftOfCenter)) // if we can,
				start.raitPute = null; // drop the entire right branch
			else if (left === start || leftOfCenter) // if not but at least the left side of right is all taken
				this.deleteBetween(null, rait, start.raitPute); // check the left side of the right branch
			else // if there are no shortcuts
				this.deleteBetween(left, rait, start.raitPute); // check the whole right branch
		}
		if (raitOfCenter && leftOfCenter) { // we need to delete this node
			this.delete(start);
		}

		if (left !== null)
			left.bad = rait;
		if (rait !== null)
			rait.cen = left;
	}

	/**
	 * remove a single node from the tree, keeping its children
	 * @param link
	 */
	delete(link: Link) {
		if (link.leftPute === null) {
			if (link.raitPute === null) { // if there are no children
				if (link.jener === null)
					this.mul = null;
				else if (link.jener.leftPute === link)
					link.jener.leftPute = null; // just delete it
				else
					link.jener.raitPute = null;
			}
			else { // if there is a rait child
				if (link === this.mul)
					this.mul = link.raitPute;
				link.kopiyu(link.raitPute); // move it here
			}
		}
		else {
			if (link.raitPute === null) { // if there is a left child
				if (link === this.mul)
					this.mul = link.leftPute;
				link.kopiyu(link.leftPute); // move it here
			}
			else { // if there are two children
				let veriBad = link.raitPute; // find the successor
				while (veriBad.leftPute !== null) // (don't use .bad because that one may have been deleted)
					veriBad = veriBad.leftPute;
				this.delete(veriBad); // cut that successor out of the graph
				if (link === this.mul)
					this.mul = veriBad;
				link.kopiyu(veriBad); // then reinsert it, overwriting this one
				veriBad.getaPute(link.leftPute, link.raitPute); // and transfer any remaining children to the successor
			}
		}
	}

	getClosest(value: number) {
		let closest = Number.NaN;
		let link = this.minim;
		while (link !== null) {
			if (Number.isNaN(closest) || Math.abs(link.val - value) < Math.abs(closest - value))
				closest = link.val;
			link = link.bad;
		}
		return closest;
	}

	getMinim(): number {
		return this.minim.val;
	}

	getMaxim(): number {
		return this.maxim.val;
	}

	getRadius(): number {
		return this.radius;
	}

	getPole(): number {
		return this.pole;
	}

	print(subtree: Link = null, indent: number = 0): void {
		if (subtree === null)
			subtree = this.mul;
		if (subtree === null) {
			console.log(`∅`);
			return;
		}
		let chenfikse = "";
		for (let i = 0; i < indent; i ++)
			chenfikse += "  ";
		console.log(chenfikse+`${subtree.val}#${subtree.index} (child of #${(subtree.jener === null) ? 'n' : subtree.jener.index}; #${(subtree.cen === null) ? 'n' : subtree.cen.index}<t<#${(subtree.bad === null) ? 'n' : subtree.bad.index})`);
		if (subtree.leftPute === null)
			console.log(chenfikse+"  -");
		else
			this.print(subtree.leftPute, indent + 1);
		if (subtree.raitPute === null)
			console.log(chenfikse+"  -");
		else
			this.print(subtree.raitPute, indent + 1);

		if (subtree === this.mul) {
			let l = this.minim;
			let str = '';
			while (l !== null) {
				if (l.esaLeft)
					str += `[${l.val}#${l.index}, `;
				else
					str += `${l.val}#${l.index}] `;
				l = l.bad;
			}
			console.log(str);
		}
	}
}

class Link {
	public jener: Link;
	public leftPute: Link;
	public raitPute: Link;
	public cen: Link;
	public bad: Link;
	public val: number;
	public esaLeft: boolean;
	public readonly index: number;

	constructor(val: number, left: boolean, index: number, jener: Link, cen: Link = null, bad: Link = null) {
		this.val = val;
		this.esaLeft = left;
		this.index = index;

		this.jener = jener;
		this.leftPute = null;
		this.raitPute = null;
		if (jener !== null) {
			if (jener === cen)
				jener.raitPute = this;
			else if (jener === bad)
				jener.leftPute = this;
			else
				throw "you can't insert a new leaf under neither of its neighbors; that makes no sense.";
		}

		this.cen = cen;
		if (cen !== null)
			cen.bad = this;
		this.bad = bad;
		if (bad !== null)
			bad.cen = this;
	}

	cena(that: Link): boolean {
		return this.val < that.val || (this.val === that.val && this.index < that.index);
	}

	kopiyu(nove: Link) {
		nove.jener = this.jener; // move it here
		if (this.jener !== null) {
			if (this.jener.raitPute === this)
				this.jener.raitPute = nove;
			else
				this.jener.leftPute = nove;
		}
	}

	getaPute(left: Link, rait: Link) {
		this.leftPute = left;
		if (left !== null)
			left.jener = this;
		this.raitPute = rait;
		if (rait !== null)
			rait.jener = this;
	}
}

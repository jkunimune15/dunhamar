// utils.ts: some mathy methods that need not clutter up the other files


/**
 * maximum index.
 */
export function argmax(arr: number[]): number {
	let maxIdx = null;
	for (let i = 0; i < arr.length; i ++)
		if (maxIdx == null || arr[i] > arr[maxIdx])
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
export function linterp(x: number, X: number[], Y: number[]): number {
	if (X.length !== Y.length)
		throw "array lengths must match";

	let min = 0, max = X.length - 1;
	while (max - min > 1) {
		const mid = Math.trunc((min + max)/2);
		if (X[mid] <= x)
			min = mid;
		else
			max = mid;
	}

	return (x - X[min])/(X[max] - X[min])*(Y[max] - Y[min]) + Y[min];
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
 * load a static TSV resource
 * @param filename
 */
export function loadTSV(filename: string): string[][] {
	const xmlHttp = new XMLHttpRequest();
	xmlHttp.open("GET", `/res/${filename}`, false);
	xmlHttp.send();
	if (xmlHttp.status != 200)
		throw `${xmlHttp.status} error while loading '${filename}': ${xmlHttp.statusText}`;
	const arr = [];
	for (const line of xmlHttp.responseText.split('\n')) {
		if (line.length === 0)  break;
		else                    arr.push(line.split('\t'));
	}
	return arr;
}


/**
 * cover a field of points in Delaunay triangles.
 * @param points the list of points in 3-space that are to be triangulated
 * @param normals the normal vector of the triangulated circle at each point, assumed to be [0,0,1] if not specified.
 * @param sample optional set of dummy points to seed the surface
 * @param sampleNormals normal vectors to go with sample
 * @param partition optional set of starter triangles to establish topology, represented as arrays of sample indices
 */
export function delaunayTriangulate(points: Vector[], normals: Vector[] = null,
									sample: Vector[] = [], sampleNormals: Vector[] = [], partition: number[][] = []
									): {triangles: number[][], parentage: number[][], between: number[][][]} {
	const nodos: Nodo[] = [];
	for (let i = 0; i < sample.length; i ++)
		nodos.push(new Nodo(i - sample.length, sample[i], sampleNormals[i]));
	const triangles = partition.map((t: number[]) => new Triangle(nodos[t[0]], nodos[t[1]], nodos[t[2]])); // convert the primitive inputs into our own object formats
	for (let i = 0; i < points.length; i ++)
		nodos.push(new Nodo(i, points[i], normals[i]));

	for (const node of nodos.slice(sample.length)) { // for each node,
		const containing = findSmallestEncompassing(node, triangles); // find out which triangle it's in
		for (let j = 0; j < 3; j ++) { // add the three new child triangles
			triangles.push(new Triangle(
				node,
				containing.nodos[j],
				containing.nodos[(j+1)%3]));
		}
		containing.children = triangles.slice(triangles.length-3); // we could remove containing from triangles now, but it would be a waste of time

		const flipQueue = []; // start a list of edges to try flipping
		for (let i = 0; i < 3; i ++)
			flipQueue.push(new Edge(containing.nodos[i], containing.nodos[(i+1)%3])); // and put the edges of this triangle on it
		const flipHistory = flipEdges(flipQueue, [], node, triangles); // do the flipping thing
		node.parents = [];
		for (const triangle of node.triangles) { // its parentage is all currently connected non-dummy nodes
			if (triangle.children === null && widershinsOf(node, triangle).i >= 0)
				node.parents.push(widershinsOf(node, triangle));
		}
		for (const edge of flipHistory) { // keep track of the edges that this node flipped; it is "between" those endpoints
			if (edge[0].i >= 0 && edge[1].i >= 0)
				node.between.push([edge[0], edge[1]]);
		}
	}

	for (const node of nodos.slice(0, sample.length)) { // now remove the partition vertices
		triangles.push(...removeNode(node));
	}

	const triangleIdx = triangles.filter((t: Triangle) => t.children === null)
		.map((t: Triangle) => t.nodos.map((n: Nodo) => n.i));
	const parentIdx = nodos.filter((n: Nodo) => n.i >= 0)
		.map((n: Nodo) => n.parents.map((n: Nodo) => n.i));
	const betweenIdx = nodos.filter((n: Nodo) => n.i >= 0)
		.map((n: Nodo) => n.between.map((ns: Nodo[]) => [ns[0].i, ns[1].i]));
	return {triangles: triangleIdx, parentage: parentIdx, between: betweenIdx}; // convert all to indices and return
}

/**
 * remove all Triangles and Edges connected to the given node, and return a list of new
 * Triangles between the surrounding nodes to replace them.
 * @param node the dummy node to be removed
 */
function removeNode(node: Nodo) {
	const oldTriangles: Triangle[] = [[...node.triangles].filter((t: Triangle) => t.children === null)[0]]; // starting with an arbitrary neighboring triangle
	while (true) { // trace the graph to find the surrounding triangles in widershins order
		const prev = oldTriangles[oldTriangles.length - 1];
		const med = clockwiseOf(node, prev);
		const next = triangleOf(node, med);
		if (next !== oldTriangles[0])
			oldTriangles.push(next);
		else
			break;
	}

	const newTriangles: Triangle[] = [];
	const flipQueue: Edge[] = [], flipImmune: Edge[] = [];
	arbitrationLoop:
	for (let i0 = 0; i0 < oldTriangles.length; i0 ++) { // we have to pick an arbitrary border node to start this process
		const a = clockwiseOf(node, oldTriangles[i0]); // choosing i0 is harder than it may seem if we want to avoid coincident triangles
		for (let j = 2; j < oldTriangles.length-1; j ++) { // run through all the edges we're going to make
			const c = clockwiseOf(node, oldTriangles[(i0 + j)%oldTriangles.length]);
			if (isAdjacentTo(a, c)) // and check if any of them already exist
				continue arbitrationLoop; // if so, try a different start
		}
		for (let j = 0; j < oldTriangles.length; j ++) { // begin fixing the gap left by this null node
			const b = widershinsOf(node, oldTriangles[(i0 + j)%oldTriangles.length]);
			const c = clockwiseOf(node, oldTriangles[(i0 + j)%oldTriangles.length]);
			oldTriangles[j].children = []; // by disabling the triangles that used to fill it
			if (j >= 2)
				newTriangles.push(new Triangle(a, b, c)); // and filling it with new, naively placed triangles
			if (j >= 2 && j < oldTriangles.length-1)
				flipQueue.push(new Edge(a, c)); // keep track of the edges to be flipped
			flipImmune.push(new Edge(b, c)); // and to avoid being flipped
		} // if you make it to the end of the for loop, then arbitrary was a fine choice
		break; // and we can proceed
	}

	flipEdges(flipQueue, flipImmune, null, newTriangles); // do the part where we make it delaunay
	return newTriangles;
}

/**
 * Go through the queue and flip any non-delaunay edges. After flipping an edge, add
 * adjacent edges to the queue. Do not check edges that have newestNode as an endpoint or
 * that are in immune. allTriangles is the running list of all triangles that must be
 * kept up to date.
 * @param queue initial edges to check
 * @param immune edges that do not need to be checked
 * @param newestNode a node for which any edges that touch it need not be checked
 * @param triangles the list of all Triangles, which must be kept up to date
 * @return Array of Edges that were flipped
 */
export function flipEdges(queue: Edge[], immune: Edge[], newestNode: Nodo, triangles: Triangle[]): Nodo[][] {
	const flipped = [];

	while (queue.length > 0) { // go through that queue
		const edge = queue.pop(); // extract the needed geometric entities
		const a = edge.a;
		const c = edge.b;
		const abc = triangleOf(c, a);
		const cda = triangleOf(a, c);
		const b = (abc.nodos[0] === edge.a) ? abc.nodos[1] : (abc.nodos[1] === edge.a) ? abc.nodos[2] : abc.nodos[0];
		const d = (cda.nodos[0] === edge.b) ? cda.nodos[1] : (cda.nodos[1] === edge.b) ? cda.nodos[2] : cda.nodos[0];

		const nHat = a.n.plus(b.n).plus(c.n).plus(d.n); // average their normal vectors
		const vHat = nHat.cross(new Vector(0, 0, -1)).norm();
		const uHat = nHat.cross(vHat).norm();
		const ap = {x: a.r.dot(vHat), y: a.r.dot(uHat)}; // project their positions into the normal plane
		const bp = {x: b.r.dot(vHat), y: b.r.dot(uHat)};
		const cp = {x: c.r.dot(vHat), y: c.r.dot(uHat)};
		const dp = {x: d.r.dot(vHat), y: d.r.dot(uHat)};
		if (!isDelaunay(ap, bp, cp, dp)) { // and check for non-Delaunay edges
			triangles.push(new Triangle(b, c, d)); // if it is so, add new triangles
			triangles.push(new Triangle(d, a, b));
			abc.children = cda.children = triangles.slice(triangles.length-2); // remove the old ones by assigning them children
			flipped.push([a, c]); // record this
			const perimeter = [new Edge(a, b), new Edge(b, c), new Edge(c, d), new Edge(d, a)];
			addToQueueLoop:
			for (const nextEdge of perimeter) { // and add the neighbors to the queue
				for (const safeEdge of queue.concat(immune))
					if (nextEdge.a === safeEdge.a && nextEdge.b === safeEdge.b)
						continue addToQueueLoop; // taking care to skip edges that have already been flipped
				if (nextEdge.a === newestNode || nextEdge.b === newestNode)
					continue;
				queue.push(nextEdge);
			}
		}
	}

	return flipped;
}

/**
 * Check whether a--c is a Delaunay edge in 2D given the existence of b and d
 */
function isDelaunay(a: {x: number, y: number}, b: {x: number, y: number},
					c: {x: number, y: number}, d: {x: number, y: number}): boolean {
	const mat = [
		[a.x - d.x, a.y - d.y, a.x*a.x + a.y*a.y - d.x*d.x - d.y*d.y],
		[b.x - d.x, b.y - d.y, b.x*b.x + b.y*b.y - d.x*d.x - d.y*d.y],
		[c.x - d.x, c.y - d.y, c.x*c.x + c.y*c.y - d.x*d.x - d.y*d.y],
	];
	let det = 0;
	for (let i = 0; i < 3; i ++) {
		det = det +
			mat[0][ i     ] * mat[1][(i+1)%3] * mat[2][(i+2)%3] -
			mat[0][(i+2)%3] * mat[1][(i+1)%3] * mat[2][ i     ];
	}
	return det <= 0;
}

/**
 * go down the chain of triangles to find the one that contains this point
 * @param node the node being encompassed
 * @param triangles the top-level list of triangles in which to search
 */
function findSmallestEncompassing(node: Nodo, triangles: Iterable<Triangle>): Triangle {
	for (const triangle of triangles) {
		if (contains(triangle, node)) {
			if (triangle.children === null)
				return triangle;
			else
				return findSmallestEncompassing(node, triangle.children);
		}
	}
	throw "no eureka tingon da indu.";
}

/**
 * determine whether this triangle contains the given Node, using its neighbors to
 * hint at the direction of the surface. must return false for points outside the
 * triangle's circumcircle.
 * @param triangle the containing triangle
 * @param p the point being contained
 */
function contains(triangle: Triangle, p: Nodo): boolean {
	const totalNormal = triangle.nodos[0].n.plus(triangle.nodos[1].n).plus(triangle.nodos[2].n);
	if (p.n.dot(totalNormal) < 0)
		return false; // check alignment on the surface
	for (let i = 0; i < 3; i ++) {
		const a = triangle.nodos[i];
		const na = a.n;
		const b = triangle.nodos[(i+1)%3];
		const nb = b.n;
		const edgeDirection = b.r.minus(a.r);
		const normalDirection = na.plus(nb);
		const boundDirection = normalDirection.cross(edgeDirection);
		if (boundDirection.dot(p.r.minus(a.r)) < 0)
			return false; // check each side condition
	}
	return true;
}

/**
 * find the Nodo that appears after node on this triangle.
 * @param node
 * @param triangle
 */
function widershinsOf(node: Nodo, triangle: Triangle) {
	for (let i = 0; i < 3; i ++)
		if (triangle.nodos[i] === node)
			return triangle.nodos[(i+1)%3];
	throw "This node isn't even in this triangle.";
}

/**
 * find the Nodo that appears previous to node on this triangle.
 * @param node
 * @param triangle
 */
function clockwiseOf(node: Nodo, triangle: Triangle) {
	for (let i = 0; i < 3; i ++)
		if (triangle.nodos[i] === node)
			return triangle.nodos[(i+2)%3];
	throw "This node isn't even in this triangle.";
}

/**
 * find the Triangle that has these two Nodes in this order
 */
function triangleOf(a: Nodo, b: Nodo) {
	for (const triangle of a.triangles)
		if (triangle.children === null && widershinsOf(a, triangle) === b)
			return triangle;
	throw "these nodes don't appear to have a triangle";
}

/**
 * is there an edge between these two nodes?
 * @param a
 * @param b
 */
function isAdjacentTo(a: Nodo, b: Nodo) {
	for (const triangle of a.triangles)
		if (triangle.children === null && b.triangles.has(triangle))
			return true;
	return false;
}

/**
 * a delaunay node (voronoi polygon)
 */
class Nodo {
	public i: number;
	public r: Vector;
	public n: Vector;
	public triangles: Set<Triangle>;
	public parents: Nodo[];
	public between: Nodo[][];

	constructor(i: number, r: Vector, n: Vector) {
		this.i = i;
		this.r = r;
		this.n = n;
		this.triangles = new Set();
		this.parents = [];
		this.between = [];
	}
}

/**
 * a delaunay triangle (voronoi vertex)
 */
class Triangle {
	public nodos: Nodo[];
	public children: Triangle[];

	constructor(a: Nodo, b: Nodo, c: Nodo) {
		this.nodos = [a, b, c];
		this.children = null;
		for (const v of this.nodos)
			v.triangles.add(this);
	}
}

/**
 * an edge, connecting two nodes and two triangles
 */
class Edge {
	public a: Nodo;
	public b: Nodo;

	constructor(a: Nodo, b: Nodo) {
		this.a = (a.i < b.i) ? a : b; // set up the order so a always has the lower index
		this.b = (a.i < b.i) ? b : a;
	}
}


/**
 * A simple class to bind vector operations
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
		return this.times(Math.pow(this.sqr(), -0.5));
	}

	toString(): string {
		return `<${Math.trunc(this.x)}, ${Math.trunc(this.y)}, ${Math.trunc(this.z)}>`;
	}
}

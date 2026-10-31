export class FlowField {
  constructor(worldSize, cellSize) {
    this.worldSize = worldSize;
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldSize / cellSize);
    this.rows = Math.ceil(worldSize / cellSize);
    this.half = worldSize / 2;
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.distance = new Float32Array(this.cols * this.rows);
    this.dirX = new Float32Array(this.cols * this.rows);
    this.dirZ = new Float32Array(this.cols * this.rows);
    this.lastTargetX = Infinity;
    this.lastTargetZ = Infinity;
  }
  idx(c, r) { return r * this.cols + c; }
  worldToGrid(x, z) {
    return { c: Math.floor((x + this.half) / this.cellSize), r: Math.floor((z + this.half) / this.cellSize) };
  }
  markBlocked(minX, minZ, maxX, maxZ) {
    const a = this.worldToGrid(minX, minZ);
    const b = this.worldToGrid(maxX, maxZ);
    const c0 = Math.max(0, Math.min(this.cols - 1, a.c));
    const c1 = Math.max(0, Math.min(this.cols - 1, b.c));
    const r0 = Math.max(0, Math.min(this.rows - 1, a.r));
    const r1 = Math.max(0, Math.min(this.rows - 1, b.r));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.blocked[this.idx(c, r)] = 1;
  }
  isBlockedCell(c, r) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return true;
    return this.blocked[this.idx(c, r)] === 1;
  }
  compute(targetX, targetZ) {
    this.distance.fill(Infinity);
    const { c: tc, r: tr } = this.worldToGrid(targetX, targetZ);
    let startC = tc, startR = tr;
    if (this.isBlockedCell(tc, tr)) {
      let found = false;
      for (let radius = 1; radius <= 5 && !found; radius++) {
        for (let dr = -radius; dr <= radius && !found; dr++) {
          for (let dc = -radius; dc <= radius && !found; dc++) {
            if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
            if (!this.isBlockedCell(tc + dc, tr + dr)) { startC = tc + dc; startR = tr + dr; found = true; }
          }
        }
      }
      if (!found) return;
    }
    const start = this.idx(startC, startR);
    this.distance[start] = 0;
    const queue = [start];
    const neighbors = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const c = cur % this.cols;
      const r = Math.floor(cur / this.cols);
      const d = this.distance[cur];
      for (const [dc, dr] of neighbors) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;
        if (this.blocked[this.idx(nc, nr)]) continue;
        const ni = this.idx(nc, nr);
        const cost = (dc !== 0 && dr !== 0) ? 1.414 : 1;
        const nd = d + cost;
        if (nd < this.distance[ni]) { this.distance[ni] = nd; queue.push(ni); }
      }
    }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = this.idx(c, r);
        if (this.blocked[i]) { this.dirX[i] = 0; this.dirZ[i] = 0; continue; }
        let bestD = this.distance[i];
        let bestC = c, bestR = r;
        for (const [dc, dr] of neighbors) {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;
          const ni = this.idx(nc, nr);
          if (this.blocked[ni]) continue;
          if (this.distance[ni] < bestD) { bestD = this.distance[ni]; bestC = nc; bestR = nr; }
        }
        const dx = bestC - c, dz = bestR - r;
        const len = Math.hypot(dx, dz) || 1;
        this.dirX[i] = dx / len;
        this.dirZ[i] = dz / len;
      }
    }
    this.lastTargetX = targetX;
    this.lastTargetZ = targetZ;
  }
  sampleDirection(x, z, out) {
    const { c, r } = this.worldToGrid(x, z);
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) { out.x = 0; out.z = 0; return false; }
    const i = this.idx(c, r);
    out.x = this.dirX[i];
    out.z = this.dirZ[i];
    return !this.blocked[i];
  }
  updateTarget(x, z) {
    const dx = x - this.lastTargetX;
    const dz = z - this.lastTargetZ;
    if (dx * dx + dz * dz > 4) this.compute(x, z);
  }
}
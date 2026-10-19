// The North Road's side path east to the PR Club (js/club.js), across from the heroes' camp path. Widens the road map
// by ten columns on its east side, then winds a dirt path from the main road (rows 13 and 14) north, south and back
// up to door P at the new east edge, which NR.addPlace('club', ...) points at the yard. Changes the road map at load,
// so js/northroad.js stays as it is. Loads after js/club.js.
(function () {
  const NR = SD.northRoad;
  if (!NR || !NR.maps.club || !NR.maps.road) return;
  const road = NR.maps.road, ADD = 10, EAST = road.map[0].length - 1;   // the old east edge, column 29

  // Ten new columns just inside the east edge: the city wall carries on along the top, the arena path runs on to its door.
  const rows = road.map.map((r, y) => {
    const fill = y === road.map.length - 1 ? 'T' : 'wp'.includes(r[EAST - 1]) ? r[EAST - 1] : '.';
    return (r.slice(0, EAST) + fill.repeat(ADD) + r.slice(EAST)).split('');
  });
  const put = (x, y, c) => { rows[y][x] = c; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };

  // Trees in the way of the new path move off it, and the new ground gets some of its own.
  [[18, 11], [25, 11], [27, 16]].forEach(([x, y]) => put(x, y, '.'));
  [[17, 8], [23, 13], [28, 12], [29, 9], [36, 8], [38, 11], [30, 20], [35, 19], [33, 23], [38, 22], [31, 29],
    [36, 31], [29, 36], [34, 35], [37, 40], [31, 42], [35, 44], [37, 17]].forEach(([x, y]) => put(x, y, 'T'));

  // The path: east off the main road, up and over, down past the bard's stage, then up again to the club's door.
  rect(16, 13, 19, 14, 'p'); rect(18, 10, 19, 14, 'p'); rect(18, 10, 26, 11, 'p'); rect(25, 10, 26, 17, 'p');
  rect(25, 16, 33, 17, 'p'); rect(32, 13, 33, 17, 'p'); rect(32, 13, EAST + ADD - 1, 14, 'p');
  const D = EAST + ADD;
  put(D, 13, 'P'); put(D, 14, 'P');
  road.map = rows.map(r => r.join(''));
  road.terrain.P = 'dirt'; road.doors.P = 'P'; road.back.P = [D - 1, 13, 'west'];

  // The arena's door, sign and the courier who walks to it move to the new edge.
  road.back.R = [D - 1, 25, 'west'];
  road.objects.forEach(o => { if (o.name === 'nr-arch' && o.x === 27 && o.y === 24) o.x += ADD; });
  road.labels.forEach(l => { if (l.text === 'THE ARENA →') l.x += ADD; });
  const v3 = road.actors.v3;
  if (v3 && v3.route) v3.route.forEach(p => { if (p[0] === EAST - 1 && p[1] === 25) p[0] += ADD; });

  road.objects.push(
    { name: 'nr-citywall', x: 29.6, y: 5.8 }, { name: 'nr-citywall', x: 33.4, y: 5.8 }, { name: 'nr-citywall', x: 36.2, y: 5.8 },
    { name: 'nr-roofs', x: 31, y: 1.6 }, { name: 'nr-roofs', x: 36, y: 2.2 },
    { name: 'nr-arch', x: D - 2, y: 12 }, { name: 'nr-signpost', x: 20, y: 12 },
    { name: 'nr-rock', x: 28, y: 18 }, { name: 'nr-fence', x: 29, y: 12 }, { name: 'nr-milestone', x: 34, y: 12 });
  road.labels.push({ x: D - 2, y: 15.6, text: 'PR CLUB →' });
})();

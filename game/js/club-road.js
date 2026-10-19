// The North Road's side path east to the PR Club (js/club.js), across from the heroes' camp path: dirt from the main
// road on rows 13 and 14, stepping down behind Lyra's theatre to door P on rows 15 and 16 at the road's east edge,
// which NR.addPlace('club', ...) points at the yard. Changes the road map at load, so js/northroad.js stays as it is.
// Loads after js/club.js.
(function () {
  const NR = SD.northRoad;
  if (!NR || !NR.maps.club || !NR.maps.road) return;
  const road = NR.maps.road, rows = road.map.map(r => r.split(''));
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) rows[y][x] = c; };
  rect(16, 13, 23, 14, 'p'); rect(24, 14, 25, 15, 'p'); rect(24, 15, 28, 16, 'p');
  rows[15][29] = 'P'; rows[16][29] = 'P';
  road.map = rows.map(r => r.join(''));
  road.terrain.P = 'dirt'; road.doors.P = 'P'; road.back.P = [28, 15, 'west'];
  const rock = road.objects.find(o => o.name === 'nr-rock' && o.x === 24 && o.y === 14);
  if (rock) { rock.x = 22; rock.y = 12; }
  road.objects.push({ name: 'nr-arch', x: 27, y: 14 });
  road.labels.push({ x: 27, y: 17.6, text: 'PR CLUB →' });
})();

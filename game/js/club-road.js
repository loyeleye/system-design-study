// The North Road's side path east to the PR Club (js/club.js), across from the heroes' camp path: dirt on rows 13 and
// 14 from the main road to door P at the road's east edge, which NR.addPlace('club', ...) points at the yard.
// Changes the road map at load, so js/northroad.js stays as it is. Loads after js/club.js.
(function () {
  const NR = SD.northRoad;
  if (!NR || !NR.maps.club || !NR.maps.road) return;
  const road = NR.maps.road, rows = road.map.map(r => r.split(''));
  for (let x = 17; x <= 28; x++) { rows[13][x] = 'p'; rows[14][x] = 'p'; }
  rows[13][29] = 'P'; rows[14][29] = 'P';
  road.map = rows.map(r => r.join(''));
  road.terrain.P = 'dirt'; road.doors.P = 'P'; road.back.P = [28, 13, 'west'];
  const rock = road.objects.find(o => o.name === 'nr-rock' && o.x === 24 && o.y === 14);
  if (rock) rock.y = 17;
  road.objects.push({ name: 'nr-arch', x: 27, y: 12 });
  road.labels.push({ x: 27, y: 15.6, text: 'PR CLUB →' });
})();

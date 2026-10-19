// Daily schedules for people beyond Pingsby: the North Road and its side maps (js/northroad.js) and the Eventual
// Isles (js/isles/isles-map.js), done the way Pingsby's are (js/folk-data.js, docs:
// /mnt/project-files/living-npcs/design.md, "Schedules"). Each block of the day (js/clock.js) says where someone is.
// Anyone with a quest marker skips their schedule and stays where you'd look for them, and in chapter 10's storm
// the clock is stuck at night, so night's places hold.
//
// The North Road: SD.folkFar.road[map][actor id][block] is one of
//   [x, y, face, emote]  walk to that tile, face that way, and now and then show that emote (js/scene.js EMO)
//   ['in', x, y]         walk to (x, y), a door, and go inside; ['in'] goes inside where they stand
//   'route'              walk the actor's own route along the road (js/northroad.js)
//   null or missing      stay at their usual spot
// The Isles: SD.folkFar.isles[islander id][block] is one of
//   [x, y, face]         walk to that tile, on the islander's own island, and face that way (what they're doing there)
//   'room:key'           go inside that building (js/interiors.js has its room, and where they stand in it) and be
//                        found in there
//   'home'               gone home for the day, off the map
//   null or missing      stay at their usual spot, facing the way it says (js/isles/isles-map.js PEOPLE)
// A room that isn't built yet, or a building on an island that isn't open, falls back to their usual spot.
(function () {
  const F = SD.folkFar = {};

  F.road = {
    road: {
      // The merchant and the courier walk the whole road by day.
      v1: { morning: 'route', afternoon: 'route', evening: [18, 41, 'west', 'dots'], night: ['in', 14, 44] },   // haggles with Marta, then home to Pingsby
      v3: { morning: 'route', afternoon: 'route', evening: [10, 31, 'west', 'laugh'], night: ['in', 7, 29] },   // swaps stories with Fen, then sleeps at the post
      v2: { afternoon: [19, 20, 'north', 'music'], evening: [21, 31, 'east', 'dots'], night: [21, 41, 'south', 'sleep'] },   // Lyra's show, fishing with Tomo, camped by the caravan
      v4: { morning: [17, 32, 'west', 'star'], afternoon: [16, 9, 'north', 'idea'], evening: [17, 32, 'west', 'star'], night: [17, 32, 'west', 'sleep'] },   // prays, stares at the Exchange, prays, dozes by the candle
      marta: { night: ['in'] },
      fen: { night: ['in', 7, 29] },
      lyra: { morning: ['in', 21, 18], afternoon: ['in', 21, 18], evening: ['in', 21, 18], night: ['in', 21, 18] },   // in her theatre all day: warms up, plays, headlines the evening show, sleeps backstage
      ren: { night: ['in'] },
      // Explodia chants at her crater in the morning, blasts it at noon, watches Lyra's evening show, and sleeps in Lyra's theatre.
      explodia: { morning: [23, 19, 'west', 'alert'], evening: [19, 20, 'north', 'star'], night: ['in', 21, 18] }
    },
    waystation: {
      latency: { evening: [14, 14, 'west', 'dots'], night: ['in', 6, 8] },
      v1: { afternoon: [5, 16, 'north', 'heart'], evening: [14, 13, 'west', 'dots'], night: ['in', 6, 8] }   // the guest: tea, the garden, the well, bed
    },
    arena: {
      gong: { night: ['in', 21, 7] },
      v1: { evening: [30, 29, 'north', 'star'], night: ['in', 21, 34] },
      v2: { evening: [12, 29, 'north', 'star'], night: ['in', 21, 34] },
      v3: { night: ['in', 21, 34] },
      v4: { night: [36, 12, 'north', 'dots'] },   // the bookie counts the day's bets at the booth
      suzu: { night: ['in', 21, 34] },
      zen: { night: ['in', 21, 34] }
    },
    camp: {
      // The sparring pair and the dummy-puncher stop for the night and sit round the fire.
      hero77: { night: [14, 13, 'north', 'sleep'] },
      hero256: { night: [16, 13, 'north', 'dots'] },
      hero3: { evening: [15, 14, 'north', 'star'], night: ['in'] },
      hypewagon: { evening: [19, 13, 'west', 'alert'], night: ['in'] },
      akane: { evening: [22, 14, 'north', 'idea'], night: ['in'] }
    },
    exchange: {
      v3: { night: [41, 45, 'north', 'sleep'] }   // the trader dozes by the market stalls
    }
  };

  // The Rollouts, Nari's dance troupe, live together in the Exchange's old quarter and go out across two maps, so
  // their places name the map (js/nari-home.js turns them into the road's format for each map):
  //   'home'                      inside the Rollouts' house (its door is on the Exchange)
  //   [map, x, y, face, emote]    at that tile on that map
  //   ['in', map, x, y]           into that map's door at (x, y)
  // lost is where each of them is until Lost and Found (js/rollouts-quests.js) brings them home: no schedules till then.
  F.rollouts = {
    lost: {
      nari: 'home', eunho: 'home',                       // Eun-ho never left. Nobody counted him.
      neel: ['in', 'exchange', 39, 15],                  // in the Coffee Diner across from the hotel, with nine bookings
                                                         // (js/exchange-rooms.js)
      hari: ['in', 'road', 21, 18],                      // busking for soup on Lyra's stage, inside her theatre
      bitna: ['exchange', 43, 44, 'west', 'alert']       // at the lamp-oil auction, ticket 212
    },
    day: {
      // Afternoons out at work; evenings the show at the crossroads, in a row in front of the dry fountain with a crowd
      // watching (js/nari-home.js): Nari in the middle with Hari beside her, Neel in the wings dancing every step with
      // him, Bitna on the end calling cues, and Eun-ho dancing the whole show behind the fountain, where nobody looks.
      nari: { morning: 'home', afternoon: ['exchange', 42, 46, 'south', 'music'], evening: ['exchange', 21, 21, 'south', 'music'], night: 'home' },
      neel: { morning: 'home', afternoon: ['in', 'exchange', 29, 17], evening: ['exchange', 19, 22, 'south', 'music'], night: 'home' },   // the bank, then the wings
      hari: { morning: 'home', afternoon: ['road', 17, 20, 'north', 'music'], evening: ['exchange', 22, 20, 'south', 'music'], night: 'home' },
      bitna: { morning: 'home', afternoon: ['exchange', 31, 34, 'west', 'idea'], evening: ['exchange', 23, 19, 'south', 'star'], night: 'home' },   // the lamps, then the cues
      eunho: { morning: 'home', afternoon: 'home', evening: ['exchange', 17, 18, 'south', 'dots'], night: 'home' }
    }
  };

  F.isles = {
    // Ferry Landing
    leilani: { afternoon: [10, 23, 'east'], night: 'room:office' },   // watches for the ferry from the harbour square
    kwame: { evening: 'room:office', night: 'home' },   // files the ferry log, then sleeps aboard
    saule: { morning: 'room:school', afternoon: [9, 27, 'east'], night: 'home' },   // milk tea, an eye on the class at break
    kids: { morning: 'room:school', evening: [10, 24, 'east'], night: 'home' },   // watch the ferry come in
    // The Ledger
    farida: { afternoon: 'room:bank', night: 'room:bank' },   // counts the vault, and counts it again by lamplight
    mutex: { afternoon: [27, 7, 'south'], night: 'home' },   // keeps watch over his harbour from the top of the path
    // The Mill: the sunset from the shore
    tomas: { evening: [23, 33, 'west'], night: 'room:mill' },
    bloom: { evening: [24, 33, 'west'], night: 'room:mill' },
    // The Tower: down to the pier for the evening ferry, which might bring a map from Minh
    lucia: { morning: 'room:tower', evening: [35, 21, 'south'], night: 'room:tower' },
    // The Fish Market: the far end of the market floor, looking back along the stalls
    ruth: { afternoon: [50, 6, 'west'], night: 'home' },
    // The Map & Tool Shop: by the pier, looking across the water to the Tower
    minh: { morning: 'room:shop', evening: [48, 26, 'west'], night: 'room:shop' },
    // The Twins: each mayor works in their own hall, and comes out to argue across the water
    hajin: { afternoon: 'room:hallW', night: 'room:hallW' },
    haeun: { afternoon: 'room:hallE', night: 'room:hallE' },
    // The Tide Pool Game Club: the yard by day, game night inside, home to bed (Ploy stays up writing rules)
    ploy: { morning: 'room:club', evening: 'room:club', night: 'room:club' },
    nok: { evening: 'room:club', night: 'home' },
    kai: { evening: 'room:club', night: 'home' },
    arjun: { evening: 'room:club', night: 'home' },
    meron: { morning: [11, 40, 'west'], evening: 'room:club', night: 'home' }   // gathers herbs on the mainland path
  };
})();

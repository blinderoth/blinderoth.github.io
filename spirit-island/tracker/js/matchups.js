// Spirit vs adversary match-up ratings from Red's "Match-up Axis: 5 Star System" (r/spiritisland).
// Grades per adversary, in COLUMNS order. A "*" after a grade is kept as marked in the original chart.
// Points: S 5, A 4, B 3, C 2, D 1, F 0 (the chart's SUM column uses the same scale).
const SI_MATCHUPS = {
  source: "https://www.reddit.com/r/spiritisland/comments/1bqer7k/reds_matchup_axis_5_star_system/",
  // Short label, then the adversary name as the tracker spells it
  columns: [
    ["France", "The Kingdom of France"],
    ["Sweden", "The Kingdom of Sweden"],
    ["Scotland", "The Kingdom of Scotland"],
    ["Prussia", "The Kingdom of Brandenburg-Prussia"],
    ["Habsburg", "The Habsburg Monarchy"],
    ["England", "The Kingdom of England"],
    ["Russia", "The Tsardom of Russia"],
    ["Mining Exp.", "Habsburg Mining Expedition"]
  ],
  points: { S: 5, A: 4, B: 3, C: 2, D: 1, F: 0 },
  // Red's tier definitions, shortened
  tiers: {
    S: ["Elite", "Counters the adversary and lifts the rest of the table. Should never lose outside bad luck."],
    A: ["Comfortable", "Simple once learned. Should rarely lose outside bad luck."],
    B: ["Difficult", "A win if played well. Red's gold standard for Spirit Island difficulty."],
    C: ["Challenging", "Games can be lost even with precise play. A little support stabilizes the spirit."],
    D: ["Close to hopeless", "Expected to lose without substantial support or lucky draws and events."],
    F: ["Hopeless", "Support does not help; better to support other spirits. Rarely used."]
  },
  star: "Expect to struggle a lot to get the spirit to perform at this level.",
  assumptions: ["Level 6 adversary", "No scenario", "Spirit picks its best (balanced) board", "4 or more spirits at the table", "No support taken", "Optimal play"],
  groups: [
    { label: "Base game", note: "Low complexity", rows: [
      ["Lightning's Swift Strike", "", "B C C C D D D C"],
      ["Lightning's Swift Strike", "Pandemonium", "S A A C D B D C"],
      ["Lightning's Swift Strike", "Immense", "C D B C D B C C"],
      ["Lightning's Swift Strike", "Wind", "B C C C D D D C"],
      ["Lightning's Swift Strike", "Sparking", "A B B A C A A A"],
      ["River Surges in Sunlight", "", "B C* C B B D B C"],
      ["River Surges in Sunlight", "Travel", "A B* B A B* D A C"],
      ["River Surges in Sunlight", "Sunshine", "D D D D D D F F"],
      ["River Surges in Sunlight", "Haven", "B C A A D B B* A"],
      ["Vital Strength of the Earth", "", "B B B D C D D B*"],
      ["Vital Strength of the Earth", "Might", "B A A B C C B C"],
      ["Vital Strength of the Earth", "Resilience", "D A A D B D C B"],
      ["Vital Strength of the Earth", "Nourishing", "A A S A B B A A"],
      ["Shadows Flicker like Flame", "", "D D D D D F D D"],
      ["Shadows Flicker like Flame", "Foreboding", "C D D D D D D D"],
      ["Shadows Flicker like Flame", "Amorphous", "D D D D D F D D"],
      ["Shadows Flicker like Flame", "Reach", "D D D D D F D D"],
      ["Shadows Flicker like Flame", "Madness", "C C D D D F D D"],
      ["Shadows Flicker like Flame", "Dark Fire", "C D D C D C C D"]
    ]},
    { label: "Base game", note: "Moderate and high complexity", rows: [
      ["Thunderspeaker", "", "S B A A C B* B C"],
      ["Thunderspeaker", "Warrior", "B B C B C C C B"],
      ["Thunderspeaker", "Tactician", "B B A A C D C C"],
      ["A Spread of Rampant Green", "", "S S S B B B B* B"],
      ["A Spread of Rampant Green", "Regrowth", "A S S C S B C* C"],
      ["A Spread of Rampant Green", "Tangles", "S S S A B B A A"],
      ["Bringer of Dreams and Nightmares", "", "C C D B D C D F"],
      ["Bringer of Dreams and Nightmares", "Enticing", "B B* B B A C A D"],
      ["Bringer of Dreams and Nightmares", "Violence", "B C B* A D C D F"],
      ["Ocean's Hungry Grasp", "", "A D C A D C C D"],
      ["Ocean's Hungry Grasp", "Deeps", "A D C A D D C D"]
    ]},
    { label: "Branch and Claw", note: "Moderate complexity", rows: [
      ["Sharp Fangs Behind the Leaves", "", "B B B B A A B C"],
      ["Sharp Fangs Behind the Leaves", "Unconstrained", "B B B B A A B C"],
      ["Sharp Fangs Behind the Leaves", "Encircle", "B B A B A C A B"],
      ["Keeper of the Forbidden Wilds", "", "A B* A B A A S B"],
      ["Keeper of the Forbidden Wilds", "Spreading Hostility", "A B B A D C B B"]
    ]},
    { label: "Horizons", note: "Low complexity", rows: [
      ["Devouring Teeth Lurk Underfoot", "", "B A B B C C* D C"],
      ["Eyes Watch from the Trees", "", "A* A S A B* A B* S"],
      ["Fathomless Mud of the Swamp", "", "A B* B S C* S F C"],
      ["Rising Heat of Stone and Sand", "", "A S S A B C* B* B"],
      ["Sun-Bright Whirlwind", "", "S B B* A B D A C"]
    ]},
    { label: "Jagged Earth", note: "Moderate complexity", rows: [
      ["Stone's Unyielding Defiance", "", "B B* S A S A S B*"],
      ["Grinning Trickster Stirs Up Trouble", "", "S S A A C B A* B"],
      ["Many Minds Move as One", "", "A S S A S A A* B*"],
      ["Volcano Looming High", "", "A A S A B* B B* A"],
      ["Shifting Memory of Ages", "", "B D C B D B C C"],
      ["Shifting Memory of Ages", "Mentor", "B D D C D C D D"],
      ["Shifting Memory of Ages", "Intensify", "B A A B A A B B"],
      ["Lure of the Deep Wilderness", "", "S C C A B A S A"],
      ["Lure of the Deep Wilderness", "Lair", "A B B A B C B C"]
    ]},
    { label: "Jagged Earth", note: "High and very high complexity", rows: [
      ["Vengeance as a Burning Plague", "", "A* A A B* A B B* B"],
      ["Shroud of Silent Mist", "", "C B C B F D C C"],
      ["Shroud of Silent Mist", "Stranded", "A A A B B* B B* C"],
      ["Fractured Days Split the Sky", "", "B S A C* B B B B"],
      ["Starlight Seeks Its Form", "", "A S S B S A S B*"]
    ]},
    { label: "Feather and Flame", note: "High and very high complexity", rows: [
      ["Heart of the Wildfire", "", "B A C B B F D C"],
      ["Heart of the Wildfire", "Transforming", "B A C B A* C* A* C"],
      ["Serpent Slumbering Beneath the Island", "", "C B B A C A C B"],
      ["Serpent Slumbering Beneath the Island", "Locus", "D D D C D C C C"],
      ["Downpour Drenches the World", "", "A A A S B B* A* B"],
      ["Finder of Paths Unseen", "", "B* S S S A B B C*"]
    ]},
    { label: "Nature Incarnate", note: "Moderate to very high complexity", rows: [
      ["Ember-Eyed Behemoth", "", "S S A A B B B A"],
      ["Hearth-Vigil", "", "S A A S S A B S"],
      ["Towering Roots of the Jungle", "", "A B* S A S A B B*"],
      ["Wandering Voice Keens Delirium", "", "A S B B C B D D"],
      ["Relentless Gaze of the Sun", "", "A* S S A S A S B*"],
      ["Wounded Waters Bleeding", "", "B D C C C C B* D"],
      ["Breath of Darkness Down Your Spine", "", "S A B A C B B* C*"],
      ["Dances Up Earthquakes", "", "B* S S B* A A A B"]
    ]}
  ]
};
if (typeof module !== "undefined" && module.exports) module.exports = SI_MATCHUPS;

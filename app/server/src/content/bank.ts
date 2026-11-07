/**
 * Shared exercises that come with the app (Spec B req 17), English only (Spec B "Technical").
 * Five levels per exercise type (req 6).
 */

// ---------- Letters: listen and find the letter ----------

export const LETTER_WORDS: Record<string, string> = {
  a: 'apple', b: 'ball', c: 'cat', d: 'dog', e: 'egg', f: 'fish', g: 'goat', h: 'hat', i: 'insect', j: 'jam',
  k: 'kite', l: 'leg', m: 'moon', n: 'nest', o: 'octopus', p: 'pig', q: 'queen', r: 'rabbit', s: 'sun', t: 'top',
  u: 'umbrella', v: 'van', w: 'web', y: 'yo-yo', z: 'zip',
  sh: 'ship', ch: 'chip', th: 'thumb', wh: 'whale', ph: 'phone', ck: 'duck', ng: 'ring', qu: 'queen',
  ai: 'rain', ee: 'tree', oa: 'boat', oo: 'moon', igh: 'night', ay: 'play', ow: 'cow', ou: 'house', ar: 'car',
  or: 'fork', er: 'letter',
};

/** Per level: the letters asked, and groups the wrong options are taken from. */
export const LETTER_LEVELS: Array<{ targets: string[]; groups: string[][]; options: number }> = [
  { targets: ['a', 'm', 's', 't', 'o', 'i', 'f', 'n'], groups: [['a', 'm', 's', 't', 'o', 'i', 'f', 'n']], options: 3 },
  { targets: ['c', 'e', 'g', 'h', 'j', 'k', 'l', 'r', 'u', 'v', 'w', 'y', 'z'], groups: [['c', 'e', 'g', 'h', 'j', 'k', 'l', 'r', 'u', 'v', 'w', 'y', 'z']], options: 4 },
  { targets: ['b', 'd', 'p', 'q', 'm', 'n', 'u', 'w'], groups: [['b', 'd', 'p', 'q'], ['m', 'n', 'u', 'w']], options: 4 },
  { targets: ['sh', 'ch', 'th', 'wh', 'ph', 'ck', 'ng', 'qu'], groups: [['sh', 'ch', 'th', 'wh', 'ph', 'ck', 'ng', 'qu']], options: 4 },
  { targets: ['ai', 'ee', 'oa', 'oo', 'igh', 'ay', 'ow', 'ou', 'ar', 'or', 'er'], groups: [['ai', 'ay', 'ee', 'er'], ['oa', 'oo', 'ow', 'ou'], ['igh', 'ar', 'or', 'er']], options: 4 },
];

// ---------- Words: listen and find the word ----------

/** Groups of similar-looking words; the target is one of them and the rest are the wrong options. */
export const WORD_LEVELS: string[][][] = [
  [['cat', 'dog', 'sun', 'pig'], ['hat', 'bed', 'cup', 'fox'], ['map', 'leg', 'bus', 'pin'], ['hen', 'log', 'jam', 'rug'], ['box', 'web', 'kit', 'mud'], ['van', 'fig', 'pot', 'tub']],
  [['bed', 'bad', 'bud', 'bid'], ['pin', 'pen', 'pan', 'pun'], ['dig', 'big', 'pig', 'wig'], ['bat', 'dab', 'tab', 'pat'], ['cot', 'cat', 'cut', 'kit'], ['ten', 'tin', 'tan', 'ton']],
  [['ship', 'chip', 'shop', 'chop'], ['thin', 'chin', 'shin', 'then'], ['much', 'mush', 'moth', 'mash'], ['duck', 'dock', 'deck', 'dusk'], ['wish', 'with', 'which', 'witch'], ['bath', 'bash', 'back', 'batch']],
  [['frog', 'from', 'fog', 'flog'], ['stamp', 'stump', 'stomp', 'step'], ['crab', 'grab', 'drab', 'crib'], ['spin', 'spit', 'slip', 'snip'], ['black', 'block', 'blank', 'plank'], ['trip', 'drip', 'grip', 'trap']],
  [['rabbit', 'ribbon', 'robin', 'rubber'], ['garden', 'golden', 'garage', 'burden'], ['window', 'widow', 'winter', 'wonder'], ['butter', 'better', 'bitter', 'batter'], ['picnic', 'panic', 'picking', 'public'], ['kitten', 'mitten', 'kitchen', 'written']],
];

// ---------- Sentences: pick the missing word ----------

type S = [sentence: string, answer: string, wrong1: string, wrong2: string];

export const SENTENCE_LEVELS: S[][] = [
  [
    ['The cat sat on the ___.', 'mat', 'map', 'man'],
    ['I can see a big ___.', 'dog', 'dig', 'dot'],
    ['The sun is ___.', 'hot', 'hat', 'hit'],
    ['A fish can ___.', 'swim', 'sing', 'skip'],
    ['I have a red ___.', 'hat', 'hen', 'hop'],
    ['The pig is in the ___.', 'mud', 'mad', 'mop'],
    ['Mum has a ___ of tea.', 'cup', 'cap', 'cut'],
    ['I sleep in my ___.', 'bed', 'bad', 'bud'],
    ['The dog can ___ fast.', 'run', 'rug', 'red'],
    ['A hen lays an ___.', 'egg', 'elf', 'end'],
  ],
  [
    ['We ___ to the park after school.', 'went', 'want', 'wind'],
    ['The bird sits in its ___.', 'nest', 'next', 'neck'],
    ['She writes with a ___.', 'pen', 'pin', 'pig'],
    ['He drives the ___ to work.', 'car', 'cat', 'cap'],
    ['The frog can ___ very high.', 'jump', 'jam', 'just'],
    ['I drink ___ every morning.', 'milk', 'mile', 'mist'],
    ['The duck swims on the ___.', 'pond', 'pound', 'pod'],
    ['We bake bread in the ___.', 'oven', 'open', 'over'],
    ['It is cold, so put on your ___.', 'coat', 'cot', 'cost'],
    ['Bees make ___.', 'honey', 'money', 'hungry'],
  ],
  [
    ['The ship sailed across the ___.', 'sea', 'see', 'sew'],
    ['I brush my ___ before bed.', 'teeth', 'teach', 'tenth'],
    ['Please shut the ___ when you leave.', 'door', 'deer', 'dear'],
    ['He looks at his ___ to tell the time.', 'watch', 'wash', 'witch'],
    ['The witch flew on her ___.', 'broom', 'bloom', 'brown'],
    ['My sister ___ a song at the party.', 'sang', 'sank', 'sand'],
    ['Thank you for the lovely ___.', 'gift', 'lift', 'sift'],
    ['A ___ has eight legs.', 'spider', 'spinner', 'slider'],
    ['At night we can see the ___ and the stars.', 'moon', 'mood', 'noon'],
    ['The chicken laid an ___ in the straw.', 'egg', 'edge', 'end'],
  ],
  [
    ['The children ___ their hands before lunch.', 'washed', 'watched', 'wished'],
    ['It was raining, so we took an ___.', 'umbrella', 'uniform', 'unicorn'],
    ['The farmer ___ the cows every morning.', 'feeds', 'finds', 'fights'],
    ['Tom could not find his ___ to open the door.', 'keys', 'kits', 'kids'],
    ['The library is a quiet place to ___.', 'read', 'road', 'reed'],
    ['The train ___ at the station at nine o’clock.', 'arrived', 'arrows', 'around'],
    ['My grandmother ___ a warm scarf for me.', 'knitted', 'knotted', 'kneaded'],
    ['The ___ roared loudly in the jungle.', 'lion', 'line', 'loin'],
    ['Plants need ___ to grow.', 'water', 'waiter', 'winter'],
    ['She was so tired that she ___ asleep at once.', 'fell', 'felt', 'fill'],
  ],
  [
    ['The scientist looked through the ___ to see the tiny cells.', 'microscope', 'telescope', 'kaleidoscope'],
    ['After the long walk, the hikers were ___ and thirsty.', 'exhausted', 'excited', 'exploded'],
    ['The ___ explained the rules before the match started.', 'referee', 'refugee', 'reference'],
    ['Because of the storm, the football match was ___.', 'cancelled', 'collected', 'concealed'],
    ['The museum has a huge ___ of old coins.', 'collection', 'connection', 'correction'],
    ['He was ___ that he would win the race.', 'confident', 'confusing', 'comfortable'],
    ['The volcano ___ and covered the town in ash.', 'erupted', 'interrupted', 'corrupted'],
    ['Penguins cannot fly, but they are excellent ___.', 'swimmers', 'summers', 'simmers'],
    ['We ___ the castle walls to see the view.', 'climbed', 'clamped', 'claimed'],
    ['The detective found an important ___ under the table.', 'clue', 'glue', 'clay'],
  ],
];

// ---------- Sentence–picture: read the sentence, tap the picture ----------

export const PICTURE_LEVELS: Array<Array<[sentence: string, emoji: string]>> = [
  [['a cat', '🐱'], ['a dog', '🐶'], ['a red apple', '🍎'], ['the sun', '☀️'],
   ['a fish', '🐟'], ['a car', '🚗'], ['a tree', '🌳'], ['a ball', '⚽']],
  [['A bird can fly.', '🐦'], ['A cake for my birthday.', '🎂'], ['The moon is out at night.', '🌙'], ['A frog sits on a log.', '🐸'],
   ['I ride my bike.', '🚲'], ['The rain is falling.', '🌧️'], ['A bee likes flowers.', '🐝'], ['We eat pizza for tea.', '🍕']],
  [['The rocket flies into space.', '🚀'], ['A snowman stands in the cold.', '⛄'], ['The train goes down the track.', '🚂'], ['A turtle walks very slowly.', '🐢'],
   ['She reads a book at bedtime.', '📖'], ['The ship sails on the sea.', '🚢'], ['An umbrella keeps you dry.', '☂️'], ['A rainbow has many colours.', '🌈']],
  [['An owl stays awake at night and hoots.', '🦉'], ['A penguin cannot fly, but it swims well.', '🐧'], ['The parrot can copy what you say.', '🦜'], ['An eagle flies high above the mountains.', '🦅'],
   ['This yellow fruit is long and curved.', '🍌'], ['This small red fruit has seeds on the outside.', '🍓'], ['This purple fruit grows in bunches.', '🍇'], ['This big fruit is green outside and red inside.', '🍉']],
  [['Dark clouds bring heavy rain, thunder and lightning.', '⛈️'], ['Soft white flakes fall from the sky in winter.', '🌨️'], ['A spinning column of wind can lift cars into the air.', '🌪️'], ['The sun peeks out from behind a fluffy cloud.', '⛅'],
   ['This vehicle has a long ladder and rushes to put out fires.', '🚒'], ['This vehicle takes sick people to the hospital.', '🚑'], ['This vehicle flies with spinning blades on top.', '🚁'], ['This vehicle carries many children to school.', '🚌']],
];

// ---------- Stories: read (or listen), then answer ----------

type Q = [question: string, answer: string, wrong1: string, wrong2: string];
export interface Story { title: string; text: string; questions: Q[] }

export const STORY_LEVELS: Story[][] = [
  [
    {
      title: 'Sam and the Ball',
      text: 'Sam has a red ball. He kicks the ball. The ball goes up and up. It lands in a tree. Dad gets the ball down. Sam is happy.',
      questions: [
        ['What colour is the ball?', 'red', 'blue', 'green'],
        ['Where does the ball land?', 'in a tree', 'in the pond', 'on the roof'],
        ['Who gets the ball down?', 'Dad', 'Mum', 'Sam'],
      ],
    },
    {
      title: 'The Little Fish',
      text: 'A little fish lives in a pond. It is orange. It swims all day. One day it sees a frog. The frog says hello. Now they are friends.',
      questions: [
        ['Where does the fish live?', 'in a pond', 'in the sea', 'in a cup'],
        ['What colour is the fish?', 'orange', 'pink', 'black'],
        ['Who does the fish meet?', 'a frog', 'a duck', 'a cat'],
      ],
    },
  ],
  [
    {
      title: 'The Lost Hat',
      text: 'Mia had a yellow hat. She wore it every day. One windy morning, the wind took her hat away. Mia ran after it down the street. The hat landed on a dog! The dog wagged its tail and brought the hat back to Mia. Mia gave the dog a big hug.',
      questions: [
        ['What colour was the hat?', 'yellow', 'red', 'purple'],
        ['What took the hat away?', 'the wind', 'a bird', 'her brother'],
        ['How did Mia say thank you to the dog?', 'She gave it a hug.', 'She gave it a bone.', 'She sang a song.'],
      ],
    },
    {
      title: 'Pancake Day',
      text: 'On Saturday, Leo and his grandma made pancakes. Leo cracked the eggs and Grandma mixed the milk and flour. Leo tried to flip a pancake, but it stuck to the ceiling! They both laughed. In the end they ate the pancakes with jam.',
      questions: [
        ['Who did Leo cook with?', 'his grandma', 'his dad', 'his teacher'],
        ['Where did the pancake go when Leo flipped it?', 'onto the ceiling', 'onto the floor', 'out of the window'],
        ['What did they eat the pancakes with?', 'jam', 'honey', 'ice cream'],
      ],
    },
  ],
  [
    {
      title: 'The Class Garden',
      text: 'Our class has a small garden behind the school. In spring we planted seeds in neat rows: carrots, peas and sunflowers. Every morning two children watered the plants. The peas grew fast, but slugs ate some of the carrot leaves. We put a ring of sand around the carrots to keep the slugs away. By the end of summer, the sunflowers were taller than our teacher!',
      questions: [
        ['When did the class plant the seeds?', 'in spring', 'in winter', 'in autumn'],
        ['What ate the carrot leaves?', 'slugs', 'rabbits', 'birds'],
        ['What grew taller than the teacher?', 'the sunflowers', 'the peas', 'the carrots'],
      ],
    },
    {
      title: 'The Museum Sleepover',
      text: 'Ava’s class went on a sleepover at the museum. They slept on the floor of the dinosaur hall. Before bed, a guide took them on a torch tour. Ava saw a giant skeleton with long sharp claws. At first she was scared, but the guide told them that this dinosaur only ate plants. In the morning, everyone had breakfast next to a huge whale model.',
      questions: [
        ['Where did the class sleep?', 'in the dinosaur hall', 'in a tent', 'at school'],
        ['What did the guide say the dinosaur ate?', 'plants', 'fish', 'people'],
        ['Where did they have breakfast?', 'next to a whale model', 'in the school hall', 'on the bus'],
      ],
    },
  ],
  [
    {
      title: 'The Bike Race',
      text: 'Every year our town holds a bike race around the lake. This year Noah decided to enter for the first time. For weeks he practised after school, riding up the steep hill near his house until his legs ached. On the day of the race, it rained heavily and the path became muddy. Many riders slipped and had to stop. Noah rode carefully and kept a steady speed. He did not finish first, but he finished third, and he was the youngest rider to win a medal. His sister cheered so loudly that everyone turned to look.',
      questions: [
        ['Where is the race held?', 'around the lake', 'through the forest', 'on the beach'],
        ['Why did many riders have to stop?', 'They slipped in the mud.', 'They got lost.', 'Their bikes broke.'],
        ['In which place did Noah finish?', 'third', 'first', 'last'],
      ],
    },
    {
      title: 'The Mystery Sound',
      text: 'One evening, Lily heard a strange scratching sound coming from the attic. Her brother said it was a ghost, but Lily did not believe in ghosts. She took a torch and climbed the ladder with her dad. Behind an old box they found a small squirrel that had made a nest from newspaper and wool. It had come in through a hole under the roof. Dad gently carried the squirrel outside, and the next day he fixed the hole so it could not get in again.',
      questions: [
        ['Where did the sound come from?', 'the attic', 'the kitchen', 'the garden'],
        ['What was making the sound?', 'a squirrel', 'a ghost', 'a mouse'],
        ['What did Dad do the next day?', 'He fixed the hole.', 'He bought a cat.', 'He moved the box.'],
      ],
    },
  ],
  [
    {
      title: 'The Inventor’s Notebook',
      text: 'Priya loved to take things apart to see how they worked. Her grandfather, who had once been an engineer, gave her an old notebook full of sketches of machines he had designed but never built. One sketch showed a device that watered plants automatically while people were on holiday. Priya decided to build it for the school science fair. She used a plastic bottle, a thin tube and a small sensor that measured how dry the soil was. Her first attempt flooded the classroom windowsill, so she had to adjust the sensor and test it again and again. After two weeks of patient work, the device finally released exactly the right amount of water. The judges were impressed, but Priya was proudest when her grandfather saw his idea finally come to life.',
      questions: [
        ['Who gave Priya the notebook?', 'her grandfather', 'her teacher', 'a judge'],
        ['What was the device designed to do?', 'water plants automatically', 'clean windows', 'feed pets'],
        ['What happened on Priya’s first attempt?', 'It flooded the windowsill.', 'It caught fire.', 'It won a prize.'],
      ],
    },
    {
      title: 'The Longest Journey',
      text: 'Every autumn, millions of birds called Arctic terns begin one of the longest journeys of any animal on Earth. They fly from the Arctic, near the North Pole, all the way to Antarctica in the far south, and then back again the next spring. Over its lifetime, a single tern may travel as far as flying to the Moon and back three times. Terns can rest by gliding on the wind, and they catch small fish by diving into the sea. Because they follow the summer from one end of the world to the other, Arctic terns see more daylight than any other animal.',
      questions: [
        ['Where do Arctic terns fly in autumn?', 'to Antarctica', 'to the Moon', 'to the desert'],
        ['How do terns rest on their journey?', 'by gliding on the wind', 'by landing on ships', 'by sleeping on clouds'],
        ['Why do terns see so much daylight?', 'They follow the summer.', 'They fly very high.', 'They never sleep.'],
      ],
    },
  ],
];

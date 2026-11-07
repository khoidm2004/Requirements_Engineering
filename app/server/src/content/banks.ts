/**
 * Seed content banks (A-4, C-5, FR-CNT-03). The real baseline is supplied by the content team;
 * this bank covers E1, E2, E3 and E5 in levels 1–10 in English and Finnish so the system is usable
 * end to end. It is changed by editing this file and redeploying — never through the UI.
 * E4 items are created by teachers (FR-CNT-05) and are not part of the shared library.
 */

export type Lang = 'en' | 'fi';

// ---------- E1: letter–sound ----------
// [answer, spoken prompt]. Bands: 0 = single letters, 1 = digraphs, 2 = vowel teams / trigraphs.
export const E1: Record<Lang, Array<Array<[string, string]>>> = {
  en: [
    [['a', 'a, as in apple'], ['b', 'b, as in ball'], ['d', 'd, as in dog'], ['m', 'm, as in moon'], ['s', 's, as in sun'],
     ['t', 't, as in top'], ['p', 'p, as in pig'], ['o', 'o, as in octopus'], ['i', 'i, as in insect'], ['f', 'f, as in fish'],
     ['e', 'e, as in egg'], ['u', 'u, as in umbrella'], ['g', 'g, as in goat'], ['n', 'n, as in nest'], ['r', 'r, as in rabbit']],
    [['sh', 'sh, as in ship'], ['ch', 'ch, as in chip'], ['th', 'th, as in thumb'], ['ck', 'ck, as in duck'], ['ng', 'ng, as in ring'],
     ['qu', 'qu, as in queen'], ['wh', 'wh, as in whale'], ['ph', 'ph, as in phone'], ['ee', 'ee, as in tree'], ['oo', 'oo, as in moon'],
     ['ar', 'ar, as in car'], ['or', 'or, as in fork']],
    [['igh', 'igh, as in night'], ['ai', 'ai, as in rain'], ['oa', 'oa, as in boat'], ['ur', 'ur, as in turtle'], ['ow', 'ow, as in cow'],
     ['oi', 'oi, as in coin'], ['ear', 'ear, as in ear'], ['air', 'air, as in chair'], ['ure', 'ure, as in picture'], ['er', 'er, as in letter'],
     ['ay', 'ay, as in play'], ['ou', 'ou, as in house'], ['tch', 'tch, as in watch'], ['dge', 'dge, as in bridge']],
  ],
  fi: [
    [['a', 'a, kuin auto'], ['i', 'i, kuin ilves'], ['o', 'o, kuin omena'], ['u', 'u, kuin uni'], ['e', 'e, kuin ekorre'],
     ['s', 's, kuin sammakko'], ['m', 'm, kuin maito'], ['t', 't, kuin talo'], ['k', 'k, kuin kissa'], ['l', 'l, kuin lintu'],
     ['n', 'n, kuin nalle'], ['r', 'r, kuin rapu'], ['v', 'v, kuin vene'], ['p', 'p, kuin pallo'], ['h', 'h, kuin hiiri']],
    [['ä', 'ä, kuin äiti'], ['ö', 'ö, kuin öljy'], ['y', 'y, kuin yö'], ['j', 'j, kuin juna'], ['d', 'd, kuin delfiini'],
     ['aa', 'pitkä aa, kuin aamu'], ['ii', 'pitkä ii, kuin siili'], ['uu', 'pitkä uu, kuin kuu'], ['ee', 'pitkä ee, kuin keksi'],
     ['oo', 'pitkä oo, kuin hoopo'], ['ää', 'pitkä ää, kuin kääpiö'], ['yy', 'pitkä yy, kuin kyy']],
    [['ng', 'ng, kuin kengät'], ['nk', 'nk, kuin hanki'], ['ai', 'ai, kuin laiva'], ['ei', 'ei, kuin leipä'], ['oi', 'oi, kuin koira'],
     ['au', 'au, kuin auto'], ['ie', 'ie, kuin tie'], ['uo', 'uo, kuin suo'], ['yö', 'yö, kuin yö'], ['äy', 'äy, kuin käy'],
     ['öy', 'öy, kuin pöytä'], ['ui', 'ui, kuin uida'], ['kk', 'pitkä kk, kuin kukka'], ['ss', 'pitkä ss, kuin kissa']],
  ],
};

// ---------- E2: syllables ----------
// English words carry hand-annotated splits; Finnish words are split by the rule-based algorithm.
export const E2: Record<Lang, string[][]> = {
  en: [
    ['sun-set', 'rab-bit', 'pic-nic', 'nap-kin', 'kit-ten', 'muf-fin', 'hap-py', 'bas-ket', 'zig-zag', 'pup-py', 'tab-let', 'mit-ten'],
    ['ba-na-na', 'el-e-phant', 'to-ma-to', 'dino-saur', 'but-ter-fly', 'pa-ja-mas', 'won-der-ful', 'kan-ga-roo', 'com-pu-ter', 'yes-ter-day', 'pine-ap-ple', 'pop-corn'],
    ['wa-ter-mel-on', 'cat-er-pil-lar', 'al-li-ga-tor', 'he-li-cop-ter', 'mac-a-ro-ni', 'in-for-ma-tion', 'cal-cu-la-tor', 'har-mon-i-ca', 'ac-tiv-i-ty', 'ex-cel-lent', 'u-ni-corn', 'hip-po-pot-a-mus'],
  ],
  fi: [
    ['talo', 'kala', 'kissa', 'auto', 'pallo', 'sika', 'kuu', 'puu', 'juna', 'koira', 'nalle', 'omena', 'vene', 'hiiri'],
    ['banaani', 'mansikka', 'kirjasto', 'perhonen', 'sammakko', 'tomaatti', 'porkkana', 'kaupunki', 'lentokone', 'tietokone', 'kukkaro', 'paperi'],
    ['krokotiili', 'televisio', 'helikopteri', 'appelsiini', 'kirahvi', 'ambulanssi', 'polkupyörä', 'jalkapallo', 'mustikkapiirakka', 'kesäloma', 'syntymäpäivä', 'sateenvarjo'],
  ],
};

// ---------- E3: word recognition ----------
// Each group: target first, followed by similar-looking distractors.
export const E3: Record<Lang, string[][][]> = {
  en: [
    [['cat', 'cot', 'act', 'cut'], ['dog', 'bog', 'god', 'dig'], ['bed', 'deb', 'bad', 'bid'], ['sun', 'run', 'sin', 'nus'],
     ['pig', 'big', 'dig', 'gip'], ['top', 'pot', 'tap', 'tip'], ['hat', 'hit', 'hot', 'tah'], ['map', 'mop', 'pam', 'nap'],
     ['bus', 'sub', 'bun', 'dus'], ['red', 'rod', 'der', 'rid']],
    [['ship', 'shop', 'chip', 'slip'], ['frog', 'from', 'fog', 'flog'], ['tree', 'three', 'free', 'tee'], ['milk', 'mild', 'mink', 'silk'],
     ['duck', 'buck', 'dock', 'deck'], ['bird', 'brid', 'bind', 'dirb'], ['star', 'stair', 'stir', 'tsar'], ['rain', 'ruin', 'rein', 'train'],
     ['book', 'look', 'boot', 'dook'], ['play', 'pray', 'ploy', 'paly']],
    [['house', 'horse', 'hose', 'mouse'], ['bread', 'beard', 'break', 'board'], ['through', 'though', 'thought', 'tough'],
     ['quiet', 'quite', 'quit', 'quilt'], ['angel', 'angle', 'ankle', 'agnel'], ['dairy', 'diary', 'daisy', 'dirty'],
     ['brother', 'bother', 'broth', 'brothers'], ['desert', 'dessert', 'deserve', 'detest'], ['friend', 'fiend', 'fried', 'friendly'],
     ['where', 'were', 'wear', 'there']],
  ],
  fi: [
    [['talo', 'tila', 'tali', 'lato'], ['kala', 'kana', 'laka', 'kela'], ['sika', 'sisu', 'kisa', 'sima'], ['tuli', 'tulli', 'luti', 'tila'],
     ['kuu', 'kyy', 'puu', 'kuo'], ['maa', 'mää', 'maja', 'saa'], ['jää', 'jaa', 'pää', 'jäi'], ['susi', 'sisu', 'suti', 'sumi'],
     ['nuoli', 'nuori', 'nulli', 'nouli'], ['kivi', 'kiva', 'viki', 'kuvi']],
    [['kissa', 'kassa', 'kisa', 'kiss'], ['tuuli', 'tuli', 'tulli', 'tyyli'], ['muna', 'mina', 'numa', 'mana'], ['vesi', 'vehi', 'vasi', 'sevi'],
     ['koira', 'koria', 'kaira', 'kiora'], ['tyttö', 'tytti', 'tötty', 'tytto'], ['poika', 'pioka', 'poikka', 'paika'], ['metsä', 'mesta', 'mätsä', 'metso'],
     ['lumi', 'lumu', 'limu', 'muli'], ['järvi', 'jarvi', 'jävri', 'tärvi']],
    [['kirjasto', 'kirjoitus', 'kirjasta', 'kirjastot'], ['tuoli', 'tuolit', 'tuoni', 'tuulli'], ['ystävä', 'ytsävä', 'ystävät', 'yskävä'],
     ['koulussa', 'koulusta', 'kulussa', 'koululla'], ['huomenna', 'huomena', 'hoemenna', 'huominen'], ['sateenkaari', 'sateenkari', 'satenkaari', 'sateenkaaria'],
     ['perjantai', 'perjanta', 'perjantaina', 'pejrantai'], ['kuningas', 'kuninkas', 'kunigas', 'kuningatar'], ['mansikka', 'mansika', 'mansikat', 'manksika'],
     ['ikkuna', 'ikuna', 'ikkunat', 'ikkuina']],
  ],
};

// ---------- E5: passages ----------
export interface Passage {
  level: number;
  title: string;
  text: string;
  questions: Array<{ q: string; options: string[]; answer: number }>;
}

export const E5: Record<Lang, Passage[]> = {
  en: [
    {
      level: 1,
      title: 'Sam and the red ball',
      text: 'Sam has a red ball. He likes to kick it. One day the ball rolls into the pond. Sam is sad. His dog Max jumps into the water. Max gets the ball. Sam is happy. He gives Max a big hug.',
      questions: [
        { q: 'What colour is the ball?', options: ['Red', 'Blue', 'Green'], answer: 0 },
        { q: 'Where does the ball go?', options: ['Into a tree', 'Into the pond', 'Into a box'], answer: 1 },
        { q: 'Who gets the ball?', options: ['Sam', 'Mum', 'Max the dog'], answer: 2 },
      ],
    },
    {
      level: 3,
      title: 'The lost kitten',
      text: 'Mia heard a small sound under the bench in the park. She bent down and saw a tiny grey kitten. It was wet and cold. Mia took off her scarf and wrapped the kitten in it. She carried it home very carefully. Her dad gave the kitten some warm milk. The next day they made posters and put them on the trees in the park. In the evening an old man knocked on the door. "That is my kitten, Pip!" he said. He was so happy that he gave Mia a jar of honey.',
      questions: [
        { q: 'Where did Mia find the kitten?', options: ['Under a bench', 'In a tree', 'At school'], answer: 0 },
        { q: 'What did Mia wrap the kitten in?', options: ['A towel', 'Her scarf', 'A blanket'], answer: 1 },
        { q: 'What did the old man give Mia?', options: ['A book', 'A kitten', 'A jar of honey'], answer: 2 },
      ],
    },
    {
      level: 5,
      title: 'The tallest sunflower',
      text: 'Every spring the village held a contest to grow the tallest sunflower. Leo had never won, but this year he had a plan. He planted his seed in the sunniest corner of the garden, next to the warm stone wall. He watered it every morning before school and pulled out the weeds every evening. When a storm came in June, Leo tied the young plant to a wooden stick so the wind could not break it. By August the sunflower was taller than his dad. On the day of the contest the judges measured every flower. Leo’s sunflower was not the tallest. It was the second tallest. Leo was a little disappointed, but then the judges gave him a special prize for the best-looked-after plant. He took home a shiny watering can and a bag of new seeds for next year.',
      questions: [
        { q: 'Why did Leo plant the seed next to the stone wall?', options: ['It was the sunniest, warmest place', 'It was close to the school', 'His dad told him to'], answer: 0 },
        { q: 'What did Leo do when the storm came?', options: ['He moved the plant inside', 'He tied the plant to a stick', 'He covered it with a bucket'], answer: 1 },
        { q: 'Which prize did Leo win?', options: ['First prize', 'No prize', 'A prize for the best-looked-after plant'], answer: 2 },
      ],
    },
    {
      level: 7,
      title: 'How bees talk',
      text: 'Honeybees cannot speak, but they can still tell each other where to find food. When a worker bee discovers a field full of flowers, she flies back to the hive and performs a special dance. If the flowers are close, she runs around in small circles. This is called the round dance, and it tells the other bees to search near the hive. If the flowers are far away, she performs the waggle dance. She walks in a straight line while shaking her body from side to side, then loops back and repeats it. The direction of the straight line shows the direction of the food compared to the sun. The longer she waggles, the further away the flowers are. Scientists studied these dances for many years before they understood them. Today we know that bees are excellent at sharing information, even though they have tiny brains.',
      questions: [
        { q: 'What does the round dance tell the other bees?', options: ['The food is close to the hive', 'The food is very far away', 'A storm is coming'], answer: 0 },
        { q: 'What does the length of the waggle show?', options: ['How many flowers there are', 'How far away the food is', 'How old the bee is'], answer: 1 },
        { q: 'What is the main idea of the text?', options: ['Bees have tiny brains', 'Scientists like bees', 'Bees share information by dancing'], answer: 2 },
      ],
    },
    {
      level: 9,
      title: 'The night the lights went out',
      text: 'It was the coldest night of the winter when the electricity suddenly went off in the whole town. At first Ella thought it was exciting. The house was completely dark, and through the window she could see thousands of stars that were usually hidden by the street lights. Her grandmother found candles in a drawer and lit them on the kitchen table. Without the television or the computer, the family did not know what to do with themselves. Then Grandma suggested a game she used to play as a child: everyone had to tell a story, but each person could add only one sentence at a time. The stories quickly became ridiculous. A dragon opened a bakery, a penguin became the mayor, and a lost sock sailed across the ocean. Ella laughed so much that her stomach hurt. After a while the house began to feel chilly, so they pulled all the blankets into the living room and built a giant nest on the floor. When the lights finally came back on at midnight, nobody moved to switch on the television. Ella fell asleep in the nest, still thinking about the penguin mayor. The next morning she asked if they could have a “no electricity evening” once a week, and to her surprise, everyone agreed.',
      questions: [
        { q: 'Why could Ella see so many stars?', options: ['The street lights were off', 'She had a telescope', 'It was summer'], answer: 0 },
        { q: 'How did the story game work?', options: ['Grandma told the whole story', 'Each person added one sentence at a time', 'They read stories from a book'], answer: 1 },
        { q: 'What did Ella suggest at the end?', options: ['Buying a new television', 'Moving to a new house', 'Having an evening without electricity every week'], answer: 2 },
      ],
    },
    {
      level: 2,
      title: "The snowman",
      text: "It snowed all night. In the morning the garden was white. Tom put on his hat, his coat and his boots. He went out with his sister Lily. They rolled three big balls of snow and made a snowman. Lily gave it a carrot for a nose. Tom gave it his old hat. Then Mum called them in for hot cocoa.",
      questions: [
        { q: "Who did Tom go out with?", options: ["His dad", "His sister Lily", "His dog"], answer: 1 },
        { q: "What did Lily give the snowman?", options: ["A carrot for a nose", "A hat", "A scarf"], answer: 0 },
        { q: "What did they drink at the end?", options: ["Milk", "Juice", "Hot cocoa"], answer: 2 },
      ],
    },
    {
      level: 4,
      title: "The class garden",
      text: "Our class has a small garden behind the school. In April we planted beans, carrots and peas. Every Friday two children water the plants and pull out the weeds. Last week it was my turn with Noah. We found a fat green caterpillar eating a bean leaf. Noah wanted to throw it away, but our teacher said it would turn into a butterfly one day. We put it on a nettle at the edge of the garden, where it could eat without hurting our beans. In June we picked the peas and ate them straight from the pods. They were sweet and crunchy.",
      questions: [
        { q: "When do the children water the plants?", options: ["Every Monday", "Every day", "Every Friday"], answer: 2 },
        { q: "Where did they put the caterpillar?", options: ["On a nettle at the edge of the garden", "In a jar", "Back on the bean"], answer: 0 },
        { q: "How did the peas taste?", options: ["Sour", "Sweet and crunchy", "Salty"], answer: 1 },
      ],
    },
    {
      level: 6,
      title: "The lighthouse keeper's cat",
      text: "On a rocky island far from the coast stood an old lighthouse. A keeper named Ruth lived there with her cat, Biscuit. Every evening Ruth climbed the one hundred and twelve steps to the top and lit the great lamp, so that ships would not crash into the rocks. Biscuit always followed her, stopping on every tenth step to rest. One foggy night the motor of the lamp broke and the light stopped turning. Ruth could not fix it alone, because she needed someone to hold the torch while she worked with both hands. She looked down at Biscuit and laughed. Then she tied a small torch to her own hat and worked as fast as she could. Soon the light was turning again. Far out at sea, a fishing boat changed its course and sailed safely into the harbour.",
      questions: [
        { q: "What problem did Ruth have on the foggy night?", options: ["She lost her cat", "The motor of the lamp broke", "She fell on the steps"], answer: 1 },
        { q: "How did Ruth solve the problem?", options: ["Biscuit held the torch", "She called for help", "She tied a torch to her hat"], answer: 2 },
        { q: "Why did Ruth light the lamp every evening?", options: ["So that ships would not crash into the rocks", "To read her books", "To keep the cat warm"], answer: 0 },
      ],
    },
    {
      level: 8,
      title: "Why leaves change colour",
      text: "In autumn many trees in Finland turn yellow, orange and red. Have you ever wondered why? During spring and summer, leaves are full of a green substance called chlorophyll. Chlorophyll helps the tree use sunlight to make food from water and air. There is so much of it that it hides the other colours in the leaf. When the days become shorter and colder, the tree starts to prepare for winter. It stops making chlorophyll, and the green colour slowly disappears. Now the yellow and orange colours, which were there all along, can finally be seen. Some trees, such as maples, also make new red colours in autumn. Later the tree closes the tiny tubes between the branch and the leaf, and the leaf falls off. This helps the tree save water during the long, frozen winter. In spring, fresh green leaves grow again and the whole cycle starts over.",
      questions: [
        { q: "What does chlorophyll help the tree do?", options: ["Drink water in winter", "Use sunlight to make food", "Grow longer roots"], answer: 1 },
        { q: "Why can yellow colours be seen in autumn?", options: ["The green colour disappears and reveals them", "The tree paints the leaves", "Rain washes the leaves"], answer: 0 },
        { q: "Why does the tree drop its leaves?", options: ["To make room for birds", "Because the wind is strong", "To save water during winter"], answer: 2 },
      ],
    },
    {
      level: 10,
      title: "The inventor who failed",
      text: "When Maya was eleven, she decided to build a machine that would feed her neighbour's cat while the neighbour was away. Her first design used a clock, a spoon and a rubber band. When she tested it, the rubber band snapped and cat food flew all over the kitchen. Her second design used a funnel and a small motor from an old toy car, but the motor was too weak to turn the wheel. Maya felt like giving up. Her grandfather, who had been an engineer, told her that every failure is a lesson in disguise. Together they wrote down what had gone wrong each time. The rubber band had been stretched too far, and the motor needed more power. For the third design, Maya used a stronger spring and two batteries instead of one. She also added a little door that opened only at seven o'clock in the morning and seven in the evening. This time the machine worked perfectly for a whole week. The neighbour was so impressed that she told the local newspaper. When a reporter asked Maya about her success, she said that the most important part of the machine was not the spring or the motor, but the notebook full of mistakes.",
      questions: [
        { q: "According to Maya, what was the most important part of the machine?", options: ["The spring", "The notebook full of mistakes", "The motor"], answer: 1 },
        { q: "What went wrong with the first design?", options: ["The motor was too weak", "The door would not open", "The rubber band snapped"], answer: 2 },
        { q: "What did her grandfather teach her?", options: ["That every failure is a lesson", "To buy better parts", "To ask the newspaper for help"], answer: 0 },
      ],
    },
  ],
  fi: [
    {
      level: 1,
      title: 'Ella ja pallo',
      text: 'Ellalla on punainen pallo. Ella potkii palloa pihalla. Pallo vierii lammikkoon. Ella on surullinen. Koira Musti hyppää veteen. Musti tuo pallon takaisin. Ella on iloinen. Hän halaa Mustia. Musti heiluttaa häntää. Sitten he leikkivät yhdessä koko illan. Illalla Ella ja Musti ovat väsyneitä mutta iloisia.',
      questions: [
        { q: 'Minkä värinen pallo on?', options: ['Punainen', 'Sininen', 'Vihreä'], answer: 0 },
        { q: 'Minne pallo vierii?', options: ['Puuhun', 'Lammikkoon', 'Laatikkoon'], answer: 1 },
        { q: 'Kuka tuo pallon takaisin?', options: ['Ella', 'Äiti', 'Koira Musti'], answer: 2 },
      ],
    },
    {
      level: 3,
      title: 'Kadonnut kissanpentu',
      text: 'Aino kuuli puistossa hiljaisen äänen penkin alta. Hän kumartui ja näki pienen harmaan kissanpennun. Pentu oli märkä ja sillä oli kylmä. Aino kääri pennun kaulahuiviinsa ja kantoi sen varovasti kotiin. Isä antoi pennulle lämmintä maitoa. Seuraavana päivänä he tekivät ilmoituksia ja kiinnittivät ne puiston puihin. Illalla ovelle koputti vanha mies. ”Tuo on minun kissani Pipsa!” hän huudahti. Mies oli niin iloinen, että hän antoi Ainolle purkin hunajaa.',
      questions: [
        { q: 'Mistä Aino löysi kissanpennun?', options: ['Penkin alta', 'Puusta', 'Koulusta'], answer: 0 },
        { q: 'Mihin Aino kääri pennun?', options: ['Pyyhkeeseen', 'Kaulahuiviinsa', 'Peittoon'], answer: 1 },
        { q: 'Mitä vanha mies antoi Ainolle?', options: ['Kirjan', 'Kissan', 'Purkin hunajaa'], answer: 2 },
      ],
    },
    {
      level: 5,
      title: 'Pisin auringonkukka',
      text: 'Joka kevät kylässä järjestettiin kilpailu siitä, kuka kasvattaa pisimmän auringonkukan. Leo ei ollut koskaan voittanut, mutta tänä vuonna hänellä oli suunnitelma. Hän istutti siemenen puutarhan aurinkoisimpaan nurkkaan lämpimän kiviaidan viereen. Hän kasteli kukkaa joka aamu ennen koulua ja kitki rikkaruohot joka ilta. Kun kesäkuussa tuli myrsky, Leo sitoi taimen puukeppiin, jotta tuuli ei katkaisisi sitä. Elokuussa auringonkukka oli pidempi kuin isä. Kilpailupäivänä tuomarit mittasivat kaikki kukat. Leon kukka ei ollut pisin, vaan toiseksi pisin. Leo oli hieman pettynyt, mutta sitten tuomarit antoivat hänelle erikoispalkinnon parhaiten hoidetusta kasvista. Hän sai kiiltävän kastelukannun ja pussin uusia siemeniä ensi vuotta varten.',
      questions: [
        { q: 'Miksi Leo istutti siemenen kiviaidan viereen?', options: ['Paikka oli aurinkoisin ja lämpimin', 'Paikka oli lähellä koulua', 'Isä käski niin'], answer: 0 },
        { q: 'Mitä Leo teki, kun tuli myrsky?', options: ['Hän siirsi kasvin sisälle', 'Hän sitoi taimen keppiin', 'Hän peitti sen ämpärillä'], answer: 1 },
        { q: 'Minkä palkinnon Leo voitti?', options: ['Ensimmäisen palkinnon', 'Ei mitään palkintoa', 'Palkinnon parhaiten hoidetusta kasvista'], answer: 2 },
      ],
    },
    {
      level: 7,
      title: 'Miten mehiläiset puhuvat',
      text: 'Mehiläiset eivät osaa puhua, mutta ne voivat silti kertoa toisilleen, mistä ruokaa löytyy. Kun työmehiläinen löytää kukkaniityn, se lentää takaisin pesään ja esittää erityisen tanssin. Jos kukat ovat lähellä, mehiläinen juoksee pieniä ympyröitä. Tätä kutsutaan ympyrätanssiksi, ja se kertoo muille, että ruokaa kannattaa etsiä pesän läheltä. Jos kukat ovat kaukana, mehiläinen esittää heilutanssin. Se kävelee suoraa viivaa ja heiluttaa samalla takaruumistaan puolelta toiselle. Viivan suunta kertoo, missä suunnassa ruoka on auringon sijaintiin verrattuna. Mitä pidempään mehiläinen heiluttaa, sitä kauempana kukat ovat. Tutkijat tutkivat tansseja monta vuotta ennen kuin ymmärsivät ne. Nykyään tiedämme, että mehiläiset jakavat tietoa erinomaisesti, vaikka niiden aivot ovat pienet.',
      questions: [
        { q: 'Mitä ympyrätanssi kertoo muille mehiläisille?', options: ['Ruoka on lähellä pesää', 'Ruoka on hyvin kaukana', 'Myrsky on tulossa'], answer: 0 },
        { q: 'Mitä heilutuksen pituus kertoo?', options: ['Kuinka monta kukkaa on', 'Kuinka kaukana ruoka on', 'Kuinka vanha mehiläinen on'], answer: 1 },
        { q: 'Mikä on tekstin pääajatus?', options: ['Mehiläisillä on pienet aivot', 'Tutkijat pitävät mehiläisistä', 'Mehiläiset jakavat tietoa tanssimalla'], answer: 2 },
      ],
    },
    {
      level: 9,
      title: 'Ilta, jolloin valot sammuivat',
      text: 'Oli talven kylmin ilta, kun sähköt yhtäkkiä katkesivat koko kaupungista. Aluksi Ellan mielestä se oli jännittävää. Talo oli täysin pimeä, ja ikkunasta hän näki tuhansia tähtiä, jotka katuvalot tavallisesti peittivät. Mummo löysi laatikosta kynttilöitä ja sytytti ne keittiön pöydälle. Ilman televisiota ja tietokonetta perhe ei tiennyt, mitä tehdä. Sitten mummo ehdotti leikkiä, jota hän oli leikkinyt lapsena: jokainen kertoi tarinaa, mutta vuorollaan sai lisätä vain yhden lauseen. Tarinoista tuli nopeasti hassuja. Lohikäärme avasi leipomon, pingviinistä tuli pormestari ja kadonnut sukka purjehti valtameren yli. Ella nauroi niin paljon, että vatsaan sattui. Jonkin ajan kuluttua talossa alkoi olla viileää, joten he kantoivat kaikki peitot olohuoneeseen ja rakensivat lattialle valtavan pesän. Kun valot vihdoin syttyivät keskiyöllä, kukaan ei lähtenyt avaamaan televisiota. Ella nukahti pesään ja ajatteli yhä pingviinipormestaria. Seuraavana aamuna hän kysyi, voisiko perhe viettää sähköttömän illan kerran viikossa, ja hänen yllätyksekseen kaikki suostuivat.',
      questions: [
        { q: 'Miksi Ella näki niin paljon tähtiä?', options: ['Katuvalot olivat sammuneet', 'Hänellä oli kaukoputki', 'Oli kesä'], answer: 0 },
        { q: 'Miten tarinaleikki toimi?', options: ['Mummo kertoi koko tarinan', 'Jokainen lisäsi vuorollaan yhden lauseen', 'He lukivat tarinoita kirjasta'], answer: 1 },
        { q: 'Mitä Ella ehdotti lopuksi?', options: ['Uuden television ostamista', 'Muuttoa uuteen taloon', 'Sähkötöntä iltaa kerran viikossa'], answer: 2 },
      ],
    },
    {
      level: 2,
      title: "Lumiukko",
      text: "Yöllä satoi lunta. Aamulla piha oli valkoinen. Tuomas puki pipon, takin ja saappaat. Hän meni ulos siskonsa Lillin kanssa. He pyörittivät kolme isoa lumipalloa ja tekivät lumiukon. Lilli antoi lumiukolle porkkananenän. Tuomas antoi sille vanhan pipon. Sitten äiti kutsui heidät sisälle juomaan kaakaota. Lumiukko seisoi pihalla koko viikon.",
      questions: [
        { q: "Kenen kanssa Tuomas meni ulos?", options: ["Isän", "Siskonsa Lillin", "Koiran"], answer: 1 },
        { q: "Mitä Lilli antoi lumiukolle?", options: ["Porkkananenän", "Pipon", "Huivin"], answer: 0 },
        { q: "Mitä he joivat lopuksi?", options: ["Maitoa", "Mehua", "Kaakaota"], answer: 2 },
      ],
    },
    {
      level: 4,
      title: "Luokan puutarha",
      text: "Luokallamme on pieni puutarha koulun takana. Huhtikuussa istutimme papuja, porkkanoita ja herneitä. Joka perjantai kaksi oppilasta kastelee kasvit ja kitkee rikkaruohot. Viime viikolla oli minun ja Noan vuoro. Löysimme lihavan vihreän toukan, joka söi pavun lehteä. Noa halusi heittää sen pois, mutta opettaja sanoi, että toukasta tulee joskus perhonen. Siirsimme toukan nokkosen päälle puutarhan reunalle. Siellä se sai syödä rauhassa, eikä se vahingoittanut papujamme. Kesäkuussa poimimme herneet ja söimme ne suoraan paloista. Ne olivat makeita ja rapeita.",
      questions: [
        { q: "Milloin oppilaat kastelevat kasvit?", options: ["Joka maanantai", "Joka päivä", "Joka perjantai"], answer: 2 },
        { q: "Minne he siirsivät toukan?", options: ["Nokkosen päälle puutarhan reunalle", "Purkkiin", "Takaisin pavun päälle"], answer: 0 },
        { q: "Miltä herneet maistuivat?", options: ["Happamilta", "Makeilta ja rapeilta", "Suolaisilta"], answer: 1 },
      ],
    },
    {
      level: 6,
      title: "Majakanvartijan kissa",
      text: "Kaukana rannikosta, kallioisella saarella, seisoi vanha majakka. Siellä asui majakanvartija Ruut ja hänen kissansa Keksi. Joka ilta Ruut kiipesi sataakaksitoista porrasta ylös ja sytytti suuren lampun, jotta laivat eivät ajaisi karille. Keksi seurasi aina perässä ja lepäsi joka kymmenennellä portaalla. Eräänä sumuisena yönä lampun moottori hajosi, ja valo lakkasi pyörimästä. Ruut ei voinut korjata sitä yksin, koska hän tarvitsi jonkun pitämään taskulamppua, kun hän työskenteli molemmin käsin. Hän katsoi Keksiä ja nauroi. Sitten hän sitoi pienen taskulampun omaan hattuunsa ja teki töitä niin nopeasti kuin pystyi. Pian valo pyöri taas. Kaukana merellä kalastusvene käänsi suuntaansa ja purjehti turvallisesti satamaan.",
      questions: [
        { q: "Mikä ongelma Ruutilla oli sumuisena yönä?", options: ["Kissa katosi", "Lampun moottori hajosi", "Hän kaatui portailla"], answer: 1 },
        { q: "Miten Ruut ratkaisi ongelman?", options: ["Keksi piti taskulamppua", "Hän soitti apua", "Hän sitoi taskulampun hattuunsa"], answer: 2 },
        { q: "Miksi Ruut sytytti lampun joka ilta?", options: ["Jotta laivat eivät ajaisi karille", "Jotta hän voisi lukea", "Jotta kissalla olisi lämmin"], answer: 0 },
      ],
    },
    {
      level: 8,
      title: "Miksi lehdet vaihtavat väriä",
      text: "Syksyllä monet Suomen puut muuttuvat keltaisiksi, oransseiksi ja punaisiksi. Oletko koskaan miettinyt, miksi? Keväällä ja kesällä lehdissä on paljon vihreää ainetta, jota kutsutaan lehtivihreäksi. Lehtivihreän avulla puu käyttää auringonvaloa ja valmistaa ravintoa vedestä ja ilmasta. Lehtivihreää on niin paljon, että se peittää lehden muut värit. Kun päivät lyhenevät ja ilmat kylmenevät, puu alkaa valmistautua talveen. Se lopettaa lehtivihreän tuottamisen, ja vihreä väri haalistuu vähitellen. Nyt keltaiset ja oranssit värit, jotka olivat lehdessä koko ajan, tulevat vihdoin näkyviin. Jotkin puut, kuten vaahterat, tuottavat syksyllä myös uusia punaisia värejä. Myöhemmin puu sulkee pienet putket oksan ja lehden välillä, ja lehti putoaa. Näin puu säästää vettä pitkän ja jäisen talven aikana. Keväällä kasvaa taas uusia vihreitä lehtiä, ja kierto alkaa alusta.",
      questions: [
        { q: "Mitä lehtivihreä auttaa puuta tekemään?", options: ["Juomaan vettä talvella", "Valmistamaan ravintoa auringonvalon avulla", "Kasvattamaan pidempiä juuria"], answer: 1 },
        { q: "Miksi keltaiset värit näkyvät syksyllä?", options: ["Vihreä väri haalistuu ja paljastaa ne", "Puu maalaa lehdet", "Sade pesee lehdet"], answer: 0 },
        { q: "Miksi puu pudottaa lehtensä?", options: ["Jotta linnuille olisi tilaa", "Koska tuuli on kova", "Jotta se säästäisi vettä talven aikana"], answer: 2 },
      ],
    },
    {
      level: 10,
      title: "Keksijä, joka epäonnistui",
      text: "Kun Maija oli yksitoista, hän päätti rakentaa koneen, joka ruokkisi naapurin kissan, kun naapuri oli matkoilla. Ensimmäisessä mallissa oli kello, lusikka ja kuminauha. Kun Maija kokeili konetta, kuminauha katkesi ja kissanruokaa lensi pitkin keittiötä. Toisessa mallissa oli suppilo ja pieni moottori vanhasta leikkiautosta, mutta moottori oli liian heikko pyörittämään ratasta. Maijaa teki mieli luovuttaa. Hänen isoisänsä, joka oli ollut insinööri, sanoi, että jokainen epäonnistuminen on naamioitunut oppitunti. Yhdessä he kirjoittivat muistiin, mikä oli joka kerta mennyt pieleen. Kuminauhaa oli venytetty liikaa, ja moottori tarvitsi enemmän virtaa. Kolmanteen malliin Maija valitsi vahvemman jousen ja kaksi paristoa yhden sijaan. Hän lisäsi myös pienen luukun, joka aukesi vain kello seitsemän aamulla ja kello seitsemän illalla. Tällä kertaa kone toimi täydellisesti koko viikon. Naapuri oli niin vaikuttunut, että hän kertoi asiasta paikallislehdelle. Kun toimittaja kysyi Maijalta onnistumisen salaisuutta, Maija vastasi, että koneen tärkein osa ei ollut jousi eikä moottori vaan vihko täynnä virheitä.",
      questions: [
        { q: "Mikä oli Maijan mielestä koneen tärkein osa?", options: ["Jousi", "Vihko täynnä virheitä", "Moottori"], answer: 1 },
        { q: "Mikä meni pieleen ensimmäisessä mallissa?", options: ["Moottori oli liian heikko", "Luukku ei auennut", "Kuminauha katkesi"], answer: 2 },
        { q: "Mitä isoisä opetti Maijalle?", options: ["Jokainen epäonnistuminen on oppitunti", "Kannattaa ostaa parempia osia", "Lehdeltä kannattaa pyytää apua"], answer: 0 },
      ],
    },
  ],
};

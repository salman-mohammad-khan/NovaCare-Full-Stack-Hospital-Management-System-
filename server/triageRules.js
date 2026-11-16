// Deterministic triage rules for the NovaCare assistant.
// Generated from the benchmarked Python rule set (scratchpad bench/nc_rules.py) so both stay identical.
// decide(text) -> { specialty, priority, emergency, confident, score, medical, selfHarm, scores }

export const SPECIALTIES = ["Cardiology", "Neurology", "Pediatrics", "Orthopedics", "Dermatology", "General Medicine", "Gynecology", "Gastroenterology", "Pulmonology", "Psychiatry", "ENT", "Endocrinology", "Nephrology"];

const rx = (pattern) => new RegExp(pattern);

const KEYWORDS = {
  "Cardiology": [
    [rx("chest (pain|tightness|pressure|discomfort)"), 3],
    [rx("palpitation|heart (racing|pounding|skipping|beat)|skipping beats|irregular heartbeat|fluttering"), 3],
    [rx("\\bheart\\b|cardiac|angina"), 2],
    [rx("blood pressure|\\bbp\\b|hypertension"), 1],
    [rx("seene mein|dil (ki|ka)|dhadkan"), 3],
  ],
  "Neurology": [
    [rx("headache|migraine|head ache|sir dard|sar dard"), 3],
    [rx("dizz|vertigo|lightheaded|giddy|chakkar"), 2],
    [rx("numbness|tingling|pins and needles|numb\\b"), 3],
    [rx("tremor|shaking hands|memory (loss|problem)|forget|forgetful"), 2],
    [rx("nerve|sciatica|light sensitivity|sensitive to light"), 2],
  ],
  "Pediatrics": [
    [rx("\\b(my )?(baby|infant|newborn|toddler|child|kid|son|daughter|beta|beti|bete|bachche|bacche|bachha)\\b"), 3],
    [rx("vaccin"), 2],
    [rx("\\b\\d{1,2}[- ]?(month|months|week|weeks)[- ]old\\b"), 3],
  ],
  "Orthopedics": [
    [rx("\\bknee|\\bjoint|\\bback pain|backache|lower back|\\bshoulder|fracture|sprain|\\bhip pain|neck pain|\\bbone|\\bankle|\\bwrist|\\belbow|ghutne|kamar dard|jodo"), 3],
    [rx("swollen.*(knee|ankle|wrist)|can'?t walk|cannot walk|limp"), 2],
    [rx("muscle pain|stiff"), 1],
  ],
  "Dermatology": [
    [rx("\\brash|itch|\\bacne|pimple|eczema|\\bskin|hair (fall|loss|thinning)|dandruff|hives|fungal|ringworm|\\bboils?\\b|blister|khujli|daane|baal (jhad|gir)|dark spots|pigment"), 3],
  ],
  "General Medicine": [
    [rx("\\bfever|\\bbukhar|\\bflu\\b|\\bcold\\b|body ache|badan dard|chills"), 2],
    [rx("tired|fatigue|weakness|thakan|kamzori|unwell|not feeling well|feel sick"), 1],
    [rx("checkup|check-up|referral"), 1],
  ],
  "Gynecology": [
    [rx("period|menstru|mahwari|pregnan|garbh|pcos|pcod|vaginal|breast (lump|pain)|ovary|uterus|cramps"), 3],
  ],
  "Gastroenterology": [
    [rx("acid(ity)?|reflux|heartburn|stomach|abdom|\\bpet (dard|mein)|diarrh|loose motion|constipat|vomit|ulti|bloat|\\bgas\\b|\\bibs\\b|liver|jaundice|indigestion|nausea|sour taste"), 3],
  ],
  "Pulmonology": [
    [rx("shortness of breath|breathless|wheez|asthma|saans|breathing (problem|difficulty|trouble)|chest congestion|short of breath"), 3],
    [rx("cough|khansi"), 2],
    [rx("smok"), 1],
    [rx("mucus|phlegm|sputum"), 1],
  ],
  "Psychiatry": [
    [rx("anxi|depress|panic|stress|can'?t sleep|cannot sleep|insomnia|sleepless|\\bmood|low mood|feeling low|hopeless|udaas|ghabrahat|\\bcrying|no interest|overthinking"), 3],
  ],
  "ENT": [
    [rx("sore throat|throat pain|gala|\\bear\\b|ear ?ache|earache|kaan|hearing|\\bsinus|blocked nose|stuffy nose|nasal|\\bnose\\b|tonsil|swallowing|hoarse|voice"), 3],
  ],
  "Endocrinology": [
    [rx("diabet|thyroid|\\bsugar\\b|insulin|hormon|\\bthirst|urinating often|frequent urination|weight (gain|loss)|gained weight|lost weight|feel(ing)? cold|always cold|hair thinning"), 2],
    [rx("thirsty"), 2],
  ],
  "Nephrology": [
    [rx("kidney|renal|foamy urine|blood in (my )?urine|urine (looks|is|colour|color)|peshab|swollen (legs|feet|ankles)|swelling (in|of) (my )?(legs|feet|ankles)|ankles? (are |have been )?swollen|creatinine|dialysis"), 3],
  ],
};

const EMERGENCY_PATTERNS = [
  rx("chest pain.*(arm|jaw|sweat|breath|pressure|crushing|radiat|spreading)|crushing chest|heart attack|(arm|jaw).*(chest pain)|seene mein (tez|bahut|bhaari|dard)"),
  rx("(face|mouth|smile).{0,20}(droop|crooked|uneven)|(can'?t|cannot|unable to|not able to) (speak|talk)|slurred|slurring|sudden(ly)? .{0,25}(weakness|numbness|loss of vision|confus)|stroke"),
  rx("(can'?t|cannot|unable to|struggling to|not able to) breathe|not breathing|gasping|blue lips|lips (are )?(turning )?blue|severe (breathlessness|shortness of breath)|saans nahi|difficulty breathing (severe|badly)"),
  rx("bleeding (heavily|a lot|won'?t stop|that won'?t stop|that wo+n'?t stop)|heavy bleeding|won'?t stop bleeding|not stopping|vomiting blood|vomited blood|coughing (up )?blood|khoon ki ulti|blood loss"),
  rx("unconscious|passed out|not responding|unresponsive|collapsed|fainted and|behosh|not waking"),
  rx("\\bseizure|convuls|having a fit|\\bfitting\\b"),
  rx("(swell|swollen|swelling).{0,30}(throat|tongue|lips|face).{0,60}(tight|breath|closing)|(throat|tongue).{0,25}(tight|closing|swelling)|anaphyla"),
  rx("suicid|kill myself|end my life|ending my life|want to die|self[- ]harm|hurt myself|jeena nahi"),
  rx("overdose|swallowed (bleach|poison|pills|tablets|battery|a battery|something)|poison|zeher|drank (bleach|acid|kerosene)|(swallowed|ate|eaten|ingested|drank)\\b.{0,30}\\b(pills|tablets|medicine|medication|detergent|battery|kerosene|cleaner)"),
  rx("severe burn|snake ?bite|electric shock|drowning|head injury"),
  rx("worst headache|sudden (severe|terrible) headache|thunderclap"),
  rx("(newborn|\\d+[- ]?(day|days|week|weeks)[- ]old|\\b[12]?\\d[- ]?(day|days)[- ]old).{0,40}fever|fever.{0,40}(newborn|\\d+[- ]?(day|days)[- ]old)"),
  rx("stiff neck.{0,30}fever|fever.{0,30}stiff neck"),
  rx("(pregnan).{0,40}(heavy bleeding|bleeding|severe pain)"),
];

const URGENT_PATTERNS = [
  rx("\\b(10[2-9]|39|40)(\\.\\d)?\\s*(f|\u00b0|degrees|c)?\\b.{0,40}(fever|bukhar)|fever.{0,25}\\b(10[2-9]|39|40)\\b|high fever"),
  rx("blood in (my )?(urine|stool|motion)|black stool"),
  rx("severe (pain|abdominal|stomach)|unbearable|excruciating"),
  rx("not (drinking|eating|feeding)|keep nothing down|dehydrat"),
  rx("fever.{0,40}(4|5|6|7|four|five|six|seven) (days|din)|(4|5|6|7|four|five|six|seven) (days|din).{0,40}fever"),
];

const NON_MEDICAL = [
  rx("^\\s*(hi|hello|hey|hii|namaste|thanks|thank you|ok|okay)\\W*$"),
  rx("book(ing)? an? appointment|how (do|can) i book|opening hours|clinic timings?|how to book"),
];

const NEGATION = new RegExp("\\b(no|without|never|not having|nahi)\\b\\W+(\\w+(\\W+|$)){0,3}", "g");
const SELF_HARM = rx("suicid|kill myself|end my life|ending my life|want to die|self[- ]harm|hurt myself|jeena nahi");
const AGE = rx("\\b(\\d{1,2})[- ]?(year|yr|years|yrs|saal)[- ]?(old)?\\b");
const CHILD_CONTEXT = rx("\\b(my|his|her|our|mera|meri|mere)\\b.*\\b(son|daughter|child|kid|baby|boy|girl|beta|beti|bete)\\b|\\b(son|daughter|child|kid|boy|girl)\\b.*\\b(is|has|aged)\\b");

const matchesAny = (patterns, text) => patterns.some((pattern) => pattern.test(text));

export function decide(rawText) {
  const t = String(rawText ?? "").toLowerCase().split(/\s+/).filter(Boolean).join(" ");
  const emergency = matchesAny(EMERGENCY_PATTERNS, t);
  // urgency ignores negated phrases such as "no fever" or "without any pain"
  const positive = t.replace(NEGATION, " ");
  const urgent = !emergency && matchesAny(URGENT_PATTERNS, positive);
  const medical = !matchesAny(NON_MEDICAL, t);

  const scores = Object.fromEntries(SPECIALTIES.map((name) => [name, 0]));
  for (const [name, items] of Object.entries(KEYWORDS)) {
    for (const [pattern, weight] of items) {
      if (pattern.test(t)) {
        scores[name] += weight;
      }
    }
  }

  // someone younger than 13 described by their age goes to pediatrics
  const age = AGE.exec(t);
  if (age && Number(age[1]) <= 12 && CHILD_CONTEXT.test(t)) {
    scores.Pediatrics += 4;
  }
  if (scores.Pediatrics >= 3) {
    scores.Pediatrics += 2;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topName, topScore] = ranked[0];
  const secondScore = ranked[1][1];
  const specialty = topScore === 0 ? "General Medicine" : topName;
  const confident = topScore >= 3 && topScore - secondScore >= 1;

  return {
    specialty,
    priority: emergency ? "Emergency" : urgent ? "Urgent" : "Routine",
    emergency,
    confident: confident || emergency,
    score: topScore,
    medical,
    selfHarm: SELF_HARM.test(t),
    scores,
  };
}

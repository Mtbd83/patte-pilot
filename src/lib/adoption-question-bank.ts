/**
 * Shared, platform-curated bank of adoption-form questions — the "tronc
 * commun + banque de questions" model: every organization gets the same
 * fixed identity/contact fields (still plain columns on adoptionApplications)
 * plus whichever of these it picks (`organizations.adoptionFormQuestionKeys`),
 * plus up to two fully free questions it writes itself
 * (`organizations.adoptionFormFreeQuestions`).
 *
 * A static TS list, not a DB table — same reasoning as CONTRACT_TEXT_FIELDS
 * in contract-fields.ts: adding a new candidate question is a code change
 * (a deploy), never a migration; only an organization's own *selection*
 * (a jsonb array of keys) is runtime state.
 *
 * `key` is stored inside submitted applications' `answers` jsonb — never
 * rename or reuse a key once real answers exist under it, or historical
 * submissions become unreadable. Add a new key and retire the old one
 * instead.
 *
 * Simplification for v1: no per-organization override of `required`, and
 * no conditional display based on other questions in general (e.g. an
 * apartment-vs-garden question pair isn't modeled — an organization that
 * wants both just selects both, and the applicant leaves whichever doesn't
 * apply blank). Two conditions ARE modeled, both because a bank question's
 * own answer or the fixed desiredSpecies field are cheap, reliable things
 * to condition on: `dependsOnSpecies` (e.g. dog-only questions) and
 * `dependsOnAnswer` (a "si oui/si non" follow-up to another bank question).
 */

export type AdoptionQuestionType = "texte_court" | "texte_long" | "nombre" | "choix_unique" | "choix_multiple";

export interface AdoptionQuestionOption {
  value: string;
  label: string;
}

/** A follow-up question only shown when another bank question's answer is one of `values` — e.g. "Si non, pourquoi ?" following an "Oui/Non" question. */
export interface AdoptionQuestionAnswerDependency {
  questionKey: string;
  values: string[];
}

export interface AdoptionQuestion {
  key: string;
  category: "logement" | "foyer" | "animaux" | "quotidien" | "souhait";
  label: string;
  type: AdoptionQuestionType;
  options?: AdoptionQuestionOption[];
  hint?: string;
  /** Display-order default only — not enforced as a hard requirement override per organization in v1. Only actually enforced when the question is otherwise visible (see isQuestionVisible). */
  required?: boolean;
  /** Only shown (and only validated as required) when the candidate's desiredSpecies is one of these — e.g. dog-only questions. */
  dependsOnSpecies?: string[];
  /** Only shown (and only validated as required) when another bank question was answered with one of the given values. */
  dependsOnAnswer?: AdoptionQuestionAnswerDependency;
}

/**
 * Whether a question should currently be shown (and, if `required`,
 * enforced) given the candidate's desiredSpecies and the answers gathered
 * so far — always true when the question has neither kind of dependency.
 */
export function isQuestionVisible(
  question: AdoptionQuestion,
  context: { desiredSpecies?: string | null; answers: Record<string, string | string[]> },
): boolean {
  if (question.dependsOnSpecies) {
    if (!context.desiredSpecies || !question.dependsOnSpecies.includes(context.desiredSpecies)) return false;
  }
  if (question.dependsOnAnswer) {
    const parentValue = context.answers[question.dependsOnAnswer.questionKey];
    if (parentValue === undefined) return false;
    const values = Array.isArray(parentValue) ? parentValue : [parentValue];
    if (!values.some((v) => question.dependsOnAnswer!.values.includes(v))) return false;
  }
  return true;
}

const OUI_NON: AdoptionQuestionOption[] = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
];

export const ADOPTION_QUESTION_CATEGORY_LABELS: Record<AdoptionQuestion["category"], string> = {
  logement: "Logement",
  foyer: "Foyer",
  animaux: "Animaux déjà présents",
  quotidien: "Organisation du quotidien",
  souhait: "Souhait d'adoption",
};

export const ADOPTION_QUESTION_BANK: AdoptionQuestion[] = [
  // --- Logement ---
  {
    key: "logement_zone",
    category: "logement",
    label: "Votre logement est en zone",
    type: "choix_unique",
    options: [
      { value: "urbaine", label: "Urbaine" },
      { value: "peri_urbaine", label: "Péri-urbaine" },
      { value: "rurale", label: "Rurale" },
    ],
    required: true,
  },
  {
    key: "logement_type",
    category: "logement",
    label: "Votre logement est un/une",
    type: "choix_unique",
    options: [
      { value: "maison", label: "Maison" },
      { value: "appartement", label: "Appartement" },
      { value: "autre", label: "Autre" },
    ],
    required: true,
  },
  {
    key: "logement_superficie_appartement",
    category: "logement",
    label: "Superficie de l'appartement (m²)",
    type: "nombre",
  },
  {
    key: "logement_superficie_jardin",
    category: "logement",
    label: "Superficie du jardin (m²)",
    type: "nombre",
  },
  {
    key: "logement_cloture_hauteur",
    category: "logement",
    label: "Hauteur de clôture",
    type: "texte_court",
    hint: "Précisez « non clôturé » si c'est le cas.",
  },
  {
    key: "logement_jardin_clos",
    category: "logement",
    label: "Le jardin est-il entièrement clos ?",
    type: "choix_unique",
    options: OUI_NON,
  },
  {
    key: "logement_acces_jardin",
    category: "logement",
    label: "Accès jardin / mise en liberté",
    type: "texte_long",
  },
  {
    key: "logement_balcon_securise",
    category: "logement",
    label: "Le balcon est-il sécurisé ?",
    type: "choix_unique",
    options: OUI_NON,
    hint: "Uniquement si vous avez un balcon.",
  },
  {
    key: "logement_route_proximite",
    category: "logement",
    label: "Y a-t-il une route passante à proximité immédiate ?",
    type: "choix_unique",
    options: OUI_NON,
  },
  {
    key: "logement_statut_residence",
    category: "logement",
    label: "Vous êtes",
    type: "choix_unique",
    options: [
      { value: "proprietaire", label: "Propriétaire" },
      { value: "locataire", label: "Locataire" },
    ],
    required: true,
  },
  {
    key: "logement_anciennete",
    category: "logement",
    label: "Depuis combien de temps vivez-vous à cet endroit ?",
    type: "texte_court",
  },

  // --- Foyer ---
  {
    key: "foyer_situation",
    category: "foyer",
    label: "Vivez-vous",
    type: "choix_unique",
    options: [
      { value: "seul", label: "Seul·e" },
      { value: "en_couple", label: "En couple" },
      { value: "colocation", label: "En colocation" },
      { value: "en_famille", label: "En famille" },
    ],
    required: true,
  },
  {
    key: "foyer_taille",
    category: "foyer",
    label: "De combien de personnes se compose le foyer ?",
    type: "nombre",
  },
  {
    key: "foyer_enfants",
    category: "foyer",
    label: "Dont combien d'enfants ?",
    type: "nombre",
  },
  {
    key: "foyer_allergies",
    category: "foyer",
    label: "Y a-t-il des cas d'allergie dans la famille ?",
    type: "texte_long",
    hint: "Si oui, précisez à quoi. Laissez vide sinon.",
  },
  {
    key: "foyer_niveau_activite",
    category: "foyer",
    label: "Quel est le niveau d'activité de la famille ?",
    type: "choix_unique",
    options: [
      { value: "intense", label: "Intense" },
      { value: "modere", label: "Modéré" },
      { value: "faible", label: "Faible" },
    ],
  },
  {
    key: "foyer_accord",
    category: "foyer",
    label: "Toute la famille est-elle d'accord pour accueillir l'animal ?",
    type: "choix_unique",
    options: OUI_NON,
    required: true,
  },
  {
    key: "foyer_raison_desaccord",
    category: "foyer",
    label: "Si non, pourquoi ?",
    type: "texte_long",
    required: true,
    dependsOnAnswer: { questionKey: "foyer_accord", values: ["non"] },
  },

  // --- Animaux déjà présents ---
  {
    key: "animaux_deja_presents",
    category: "animaux",
    label: "Avez-vous déjà d'autres animaux ?",
    type: "choix_unique",
    options: OUI_NON,
    required: true,
  },
  {
    key: "animaux_details",
    category: "animaux",
    label: "Détails (espèce / race / âge / stérilisé / dernier vaccin)",
    type: "texte_long",
    required: true,
    dependsOnAnswer: { questionKey: "animaux_deja_presents", values: ["oui"] },
  },
  {
    key: "animaux_deja_cede",
    category: "animaux",
    label: "Avez-vous déjà dû céder un animal ?",
    type: "choix_unique",
    options: OUI_NON,
  },
  {
    key: "animaux_raison_cession",
    category: "animaux",
    label: "Si oui, pourquoi ?",
    type: "texte_long",
    dependsOnAnswer: { questionKey: "animaux_deja_cede", values: ["oui"] },
  },
  {
    key: "animaux_veterinaire",
    category: "animaux",
    label: "Nom, adresse et téléphone de votre vétérinaire actuel",
    type: "texte_long",
  },
  {
    key: "animaux_experience_espece",
    category: "animaux",
    label: "Avez-vous déjà eu ce type d'animal ? Quelle expérience en avez-vous ?",
    type: "texte_long",
  },

  // --- Organisation du quotidien ---
  {
    key: "quotidien_referent",
    category: "quotidien",
    label: "Qui se chargera de soigner (et sortir si chien) l'animal ?",
    type: "texte_court",
    required: true,
  },
  {
    key: "quotidien_espace_sommeil",
    category: "quotidien",
    label: "Dans quel espace l'animal dormira ?",
    type: "texte_court",
  },
  {
    key: "quotidien_temps_seul",
    category: "quotidien",
    label: "Combien de temps l'animal restera seul par jour ?",
    type: "choix_unique",
    options: [
      { value: "presque_aucune", label: "Presque aucune" },
      { value: "moins_2h", label: "- de 2h" },
      { value: "2h_4h", label: "2h à 4h" },
      { value: "4h_6h", label: "4h à 6h" },
      { value: "8h_plus", label: "8h ou plus" },
    ],
    required: true,
  },
  {
    key: "quotidien_promenades_par_jour",
    category: "quotidien",
    label: "Combien de fois par jour allez-vous le promener ?",
    type: "nombre",
    dependsOnSpecies: ["chien"],
  },
  {
    key: "quotidien_sortie_midi",
    category: "quotidien",
    label: "Une sortie entre midi et deux est-elle possible ?",
    type: "choix_unique",
    options: OUI_NON,
    dependsOnSpecies: ["chien"],
  },
  {
    key: "quotidien_vacances",
    category: "quotidien",
    label: "Que ferez-vous de votre animal pendant les weekends / vacances ?",
    type: "texte_long",
    required: true,
  },
  {
    key: "quotidien_ecole_education",
    category: "quotidien",
    label: "Envisagez-vous une école d'éducation canine ?",
    type: "choix_unique",
    options: [...OUI_NON, { value: "peut_etre", label: "Peut-être" }],
    dependsOnSpecies: ["chien"],
  },

  // --- Souhait d'adoption ---
  {
    key: "souhait_temperament",
    category: "souhait",
    label: "Quel tempérament recherchez-vous chez l'animal ?",
    type: "texte_long",
  },
  {
    key: "souhait_genre_prefere",
    category: "souhait",
    label: "Avez-vous une préférence de genre ?",
    type: "choix_unique",
    options: [
      { value: "femelle", label: "Femelle" },
      { value: "male", label: "Mâle" },
      { value: "aucune_preference", label: "Aucune préférence" },
    ],
  },
  {
    key: "souhait_raison_genre",
    category: "souhait",
    label: "Pourquoi cette préférence ?",
    type: "texte_long",
    dependsOnAnswer: { questionKey: "souhait_genre_prefere", values: ["femelle", "male"] },
  },
  {
    key: "souhait_age_prefere",
    category: "souhait",
    label: "Quel âge recherchez-vous ?",
    type: "choix_unique",
    options: [
      { value: "bebe", label: "Chiot / chaton" },
      { value: "junior", label: "Junior" },
      { value: "adulte", label: "Adulte" },
      { value: "senior", label: "Senior" },
      { value: "besoins_particuliers", label: "Besoins particuliers" },
    ],
  },
  {
    key: "souhait_raison_age",
    category: "souhait",
    label: "Pourquoi cette préférence ?",
    type: "texte_long",
    dependsOnAnswer: {
      questionKey: "souhait_age_prefere",
      values: ["bebe", "junior", "adulte", "senior", "besoins_particuliers"],
    },
  },
  {
    key: "souhait_recherche_evite",
    category: "souhait",
    label: "Qu'est-ce que vous recherchez / n'aimez pas chez un animal ?",
    type: "texte_long",
  },
  {
    key: "souhait_animal_alternatif",
    category: "souhait",
    label: "Si l'animal souhaité n'est plus disponible, êtes-vous ouvert·e à un autre ?",
    type: "choix_unique",
    options: OUI_NON,
  },
];

export function findAdoptionQuestion(key: string): AdoptionQuestion | undefined {
  return ADOPTION_QUESTION_BANK.find((q) => q.key === key);
}

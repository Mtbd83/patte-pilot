ALTER TABLE "organizations" ADD COLUMN "adoption_form_question_keys" jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "adoption_form_free_questions" jsonb;--> statement-breakpoint
ALTER TABLE "adoption_applications" ADD COLUMN "answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "adoption_applications" ADD COLUMN "rgpd_consent_at" timestamp with time zone;--> statement-breakpoint
-- Backfill existing rows from their old fixed columns into the new
-- `answers` jsonb (keys matching src/lib/adoption-question-bank.ts) — the
-- old columns themselves are dropped separately in 0037, only once the new
-- code (which no longer reads them) is actually deployed. Applying both in
-- one migration would break the still-live old code the moment this one
-- runs, for however long the deploy takes. jsonb_strip_nulls drops any key
-- whose source column was NULL, matching how a real submission never
-- writes an unanswered key. rgpd_consent_at has no real historical value to
-- backfill (consent wasn't collected before this migration) — createdAt is
-- used as a floor, not a claim that consent was actually given then.
UPDATE "adoption_applications" SET
  "answers" = jsonb_strip_nulls(jsonb_build_object(
    'logement_zone', "housing_zone"::text,
    'logement_type', "housing_type"::text,
    'logement_superficie_jardin', "garden_area_m2"::text,
    'logement_superficie_appartement', "apartment_area_m2"::text,
    'logement_cloture_hauteur', "fence_height",
    'logement_acces_jardin', "garden_access_details",
    'logement_statut_residence', "residency_status"::text,
    'logement_anciennete', "residency_duration",
    'foyer_situation', "living_situation"::text,
    'foyer_taille', "family_size"::text,
    'foyer_enfants', "children_count"::text,
    'foyer_allergies', "allergies_details",
    'foyer_niveau_activite', "activity_level"::text,
    'foyer_accord', CASE WHEN "family_agrees" THEN 'oui' ELSE 'non' END,
    'foyer_raison_desaccord', "family_disagreement_reason",
    'animaux_deja_presents', CASE WHEN "has_other_animals" THEN 'oui' ELSE 'non' END,
    'animaux_details', "other_animals_details",
    'quotidien_referent', "caretaker_person",
    'quotidien_espace_sommeil', "sleeping_area",
    'quotidien_temps_seul', "alone_time_per_day"::text,
    'quotidien_promenades_par_jour', "dog_walks_per_day"::text,
    'quotidien_sortie_midi',
      CASE
        WHEN "dog_midday_walk_possible" IS TRUE THEN 'oui'
        WHEN "dog_midday_walk_possible" IS FALSE THEN 'non'
        ELSE NULL
      END,
    'quotidien_vacances', "vacation_plan",
    'libre_1', "additional_comments"
  )),
  "rgpd_consent_at" = "created_at";
--> statement-breakpoint
ALTER TABLE "adoption_applications" ALTER COLUMN "rgpd_consent_at" SET NOT NULL;--> statement-breakpoint
-- Seed La Patte Chanceuse's own selection so its live public form shows the
-- exact same questions, in the same order, after this migration as before —
-- new bank questions (from assorpa.com / the RPA974 form) are deliberately
-- left out here; they're only available for an organization to opt into
-- later via the new admin picker.
UPDATE "organizations" SET
  "adoption_form_question_keys" = '[
    "logement_zone", "logement_type", "logement_superficie_appartement",
    "logement_superficie_jardin", "logement_cloture_hauteur", "logement_acces_jardin",
    "logement_statut_residence", "logement_anciennete",
    "foyer_situation", "foyer_taille", "foyer_enfants", "foyer_allergies",
    "foyer_niveau_activite", "foyer_accord", "foyer_raison_desaccord",
    "animaux_deja_presents", "animaux_details",
    "quotidien_referent", "quotidien_espace_sommeil", "quotidien_temps_seul",
    "quotidien_promenades_par_jour", "quotidien_sortie_midi", "quotidien_vacances"
  ]'::jsonb,
  "adoption_form_free_questions" = '[{"label": "Si vous souhaitez nous partager quelque chose, c''est le moment !"}]'::jsonb
WHERE "slug" = 'la-patte-chanceuse';

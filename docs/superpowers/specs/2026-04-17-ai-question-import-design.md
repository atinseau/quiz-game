# AI Question Import & Deduplication — Design

**Date:** 2026-04-17
**Status:** Draft — awaiting user review
**Owner:** Arthur

## 1. Purpose

Permettre l'ajout massif de questions (en particulier via des batchs générés par IA) dans le backend Strapi tout en garantissant qu'on n'accumule pas de doublons sémantiques. Aujourd'hui l'endpoint `POST /question-packs/import` ingère du JSON mais ne fait aucune déduplication — à terme le catalogue peut atteindre plusieurs millions de questions.

Livrable : un plugin admin Strapi qui combine (a) un écran d'upload JSON, (b) une analyse server-side avec détection de conflits par embeddings, (c) un écran de review où l'admin tranche les cas ambigus avant commit.

## 2. Scope

### In scope

- Plugin admin Strapi `question-import` (UI + routes serveur)
- Setup infrastructure locale : `docker-compose.yml` à la racine avec image `pgvector/pgvector:pg16` + extension `vector` activée via script d'init + commande `bun run up`
- Bascule de Strapi de SQLite vers Postgres (mise à jour `apps/backend/.env`)
- Extension du schéma `question` : colonnes `embedding`, `embedding_model`, `normalized_answer`
- Intégration pgvector (extension Postgres + index HNSW)
- Service d'embedding OpenAI `text-embedding-3-small`
- Endpoint `/preview` (analyse, stateless) et `/commit` (écriture)
- Review UI avec persistance IndexedDB côté front (pas de table staging serveur)
- Script de backfill des embeddings pour questions existantes
- Tests unitaires et d'intégration avec client OpenAI mocké

### Out of scope

- **Skill de génération IA des questions** : sera construit plus tard et appellera l'endpoint `/preview` comme n'importe quel client — aucune dépendance croisée.
- **UI de fusion de deux questions existantes** : v2
- **Re-embedding automatique lors d'un changement de modèle** : script manuel si besoin
- **Transfer de données existantes** : si on a du contenu SQLite à conserver, utiliser `strapi transfer` — hors scope de cette spec

## 3. Data model

### 3.1 Changements sur `questions`

Ajouts (migration Strapi) :

| Colonne | Type | Nullable | Commentaire |
|---|---|---|---|
| `embedding` | `vector(1536)` | yes | Nullable pendant la transition, backfill post-déploiement |
| `embedding_model` | `varchar(64)` | yes | Ex: `"text-embedding-3-small"`. Permet de détecter les vecteurs obsolètes si on change de modèle plus tard |
| `normalized_answer` | `varchar(255)` | no (default `''`) | Réponse normalisée (trim + lowercase + sans accents + whitespace collapse) |

Index :

- `CREATE INDEX questions_embedding_hnsw ON questions USING hnsw (embedding vector_cosine_ops);` — recherche kNN
- `CREATE INDEX questions_normalized_answer ON questions (normalized_answer);` — lookup answer en O(log n)

### 3.2 Pas de nouvelle table côté serveur

Le staging des imports est **côté front, en IndexedDB** (voir §5.3). Le serveur reste stateless entre `/preview` et `/commit`.

## 4. Detection logic

### 4.1 Normalisation de la réponse

Fonction `normalizeAnswer(raw: string): string` :

1. `trim()`
2. `toLowerCase()`
3. `normalize('NFD').replace(/[\u0300-\u036f]/g, '')` (retire accents)
4. Collapse multi-whitespace → single space

Exemples :
- `"Paris"` → `"paris"`
- `"La ville de Paris"` → `"la ville de paris"`
- `"PARIS "` → `"paris"`
- `"Montréal"` → `"montreal"`

Pour les questions `vrai_faux`, la réponse est déjà `"true"`/`"false"` — la normalisation est un no-op.

### 4.2 Recherche cross-category

Pour chaque question candidate à l'import, on embed le texte de la question, puis :

```sql
SELECT id, text, normalized_answer, category_id, pack_id,
       1 - (embedding <=> $1::vector) AS similarity
FROM questions
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

Pas de filtre par catégorie : un doublon peut exister dans un autre pack/catégorie et on veut le détecter.

### 4.3 Classification

Pour chaque `(candidate, match)` parmi les top-10 :

| Condition | Statut contribué |
|---|---|
| `similarity ≥ 0.92` | `auto_blocked` |
| `0.85 ≤ similarity < 0.92` ET `candidate.normalized_answer === match.normalized_answer` | `needs_review` |
| `0.85 ≤ similarity < 0.92` ET réponses différentes | ignoré (considéré `clean` pour ce match) |
| `similarity < 0.85` | ignoré |

Statut final de la candidate = le plus sévère de ses 10 matches : `auto_blocked > needs_review > clean`.

### 4.4 Doublons intra-import

Les questions du même batch sont aussi comparées entre elles (pairwise sur les embeddings fraîchement calculés). Même grille. Si deux candidates du même import sont détectées en doublon mutuel, la seconde est marquée `intra_batch_duplicate` et pré-décochée en review.

## 5. API & flow

### 5.1 Plugin structure

```
apps/backend/src/plugins/question-import/
├── strapi-server.ts
├── strapi-admin.ts
├── server/
│   ├── routes/index.ts
│   ├── controllers/import.ts
│   ├── services/
│   │   ├── embeddings.ts       # OpenAI client + cache
│   │   ├── normalize.ts         # normalizeAnswer
│   │   └── analyzer.ts          # classification logic
│   └── content-types/index.ts   # (vide, on étend `question` via migration)
├── admin/src/
│   ├── index.ts
│   ├── pages/
│   │   ├── Upload.tsx
│   │   └── Review.tsx
│   ├── lib/
│   │   ├── draftStore.ts        # IndexedDB wrapper (idb-keyval)
│   │   └── api.ts
│   └── components/
│       ├── ConflictCard.tsx
│       └── SimilarityBar.tsx
└── package.json
```

### 5.2 Endpoints

**`POST /question-import/preview`** (admin-authenticated)

Body : identique à l'import actuel (`{ pack, questions[] }`).

Response :
```ts
{
  previewId: string;          // UUID client-generated, echoed back
  embeddingModel: "text-embedding-3-small";
  candidates: Array<{
    index: number;            // position dans le batch d'entrée
    question: string;
    normalizedAnswer: string;
    embedding: number[];      // renvoyé pour réutilisation au commit
    status: "clean" | "needs_review" | "auto_blocked" | "intra_batch_duplicate";
    matches: Array<{
      questionId: number;
      text: string;
      packSlug: string;
      categoryName: string;
      similarity: number;     // 0..1
      sameAnswer: boolean;
    }>;
  }>;
}
```

**`POST /question-import/commit`** (admin-authenticated)

Body :
```ts
{
  pack: ImportPack;
  questions: Array<ImportQuestion & {
    embedding: number[];       // réutilisé depuis /preview
    normalizedAnswer: string;
    decision: "import" | "skip";
    overrideReason?: string;   // requis si la candidate était auto_blocked
  }>;
}
```

Le controller :
- Valide que chaque candidate `auto_blocked` forcée a un `overrideReason` non vide
- Reprend la logique upsert actuelle (pack, catégories, questions)
- Stocke `embedding`, `embedding_model`, `normalized_answer` avec chaque nouvelle question
- Réponse : summary identique au controller actuel + liste des skipped

### 5.3 Review UI (front, IndexedDB)

1. **Upload.tsx** : textarea / drop zone JSON → POST `/preview` → stocke la response dans IndexedDB sous la clé `previewId` → redirect vers `/review/:previewId`.
2. **Review.tsx** :
   - Charge depuis IndexedDB (ou affiche "draft introuvable" si expiré)
   - Groupe les candidates par statut :
     - `clean` : pliés par défaut, cases cochées
     - `needs_review` : dépliés, pour chaque match affiche une `ConflictCard` avec le texte existant, la `SimilarityBar`, le pack/catégorie source. Admin clique *Import quand même* ou *Skip*.
     - `auto_blocked` : dépliés, cases décochées, bouton *Override* qui ouvre un modal pour saisir la raison
     - `intra_batch_duplicate` : regroupés par cluster, admin choisit laquelle garder
   - Bouton *Commit* en bas → POST `/commit` avec les décisions → clear IndexedDB → toast success
3. **draftStore.ts** : wrapper minimal autour d'`idb-keyval`. L'admin peut avoir plusieurs drafts simultanés, listés sur la page d'upload avec leur date de création.

## 6. Embedding service

`server/services/embeddings.ts` :

```ts
interface EmbeddingService {
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

Implémentation :
- Client OpenAI officiel, endpoint `/v1/embeddings`, modèle `text-embedding-3-small`
- **1 seul appel API pour tout le batch** (l'API OpenAI accepte jusqu'à 2048 inputs par requête)
- Cache LRU en mémoire (max 1000 entrées, clé = sha256 du texte) pour éviter les re-embeddings si l'admin re-preview le même JSON
- Timeout 30s, retry 2x avec backoff exponentiel sur erreurs 5xx / rate limit
- Clé via `env("OPENAI_API_KEY")` — échec explicite au démarrage du plugin si absente

## 7. Backfill script

`apps/backend/scripts/backfill-embeddings.ts` :

- Parcourt `questions` où `embedding IS NULL` par batch de 100
- Appelle `embedBatch` sur les textes
- Update en bulk via Knex
- Affiche progression (N/total)
- Idempotent (skip les questions déjà embeddées avec le modèle courant)
- À lancer une fois via `bun run apps/backend/scripts/backfill-embeddings.ts` après la migration pgvector

## 8. Error handling

| Scénario | Comportement |
|---|---|
| OpenAI indisponible pendant `/preview` | 503 avec message clair, admin peut retry |
| OpenAI indisponible pendant `/commit` | Non concerné : l'embedding vient déjà du `/preview` |
| Postgres sans extension `vector` | Erreur au boot du plugin avec message "run `CREATE EXTENSION vector;`" |
| Override `auto_blocked` sans `overrideReason` | 400 avec la liste des indices fautifs |
| IndexedDB indisponible (navigateur privé strict) | Fallback warning, admin doit commit sans quitter la page |
| Pack slug collision avec pack publié existant | Comportement actuel préservé : upsert |

## 9. Testing

### 9.1 Unit

- `normalize.ts` : cas accents, casse, whitespace, vide, `vrai_faux`
- `analyzer.ts` : classification avec embeddings mockés (vecteurs fixés pour produire des similarités précises)
- `embeddings.ts` : cache hit/miss, retry behavior (OpenAI client mocké)

### 9.2 Integration

- Seed : 10 questions dans la DB avec embeddings calculés à partir d'un hash déterministe du texte (mock du provider en env test)
- Cas 1 : import d'un JSON contenant une question identique à une existante → statut `auto_blocked`
- Cas 2 : import avec paraphrase légère + même réponse → `needs_review`
- Cas 3 : import avec même thème mais réponse différente → `clean`
- Cas 4 : deux questions dupliquées au sein du même batch → l'une `intra_batch_duplicate`
- Cas 5 : commit avec override → question créée, `overrideReason` pris en compte (loggé)
- Cas 6 : commit sans override sur `auto_blocked` → 400

### 9.3 Mock OpenAI en test

`apps/backend/tests/mocks/openai-embeddings.ts` — retourne un vecteur déterministe : hash du texte → seed → génération pseudo-random sur la sphère unité. Deux textes identiques produisent le même vecteur ; deux textes proches lexicalement produisent des vecteurs proches (via un léger mélange contrôlé).

## 10. Rollout

1. Création `docker-compose.yml` + script init SQL (`CREATE EXTENSION vector`) + commande `bun run up`
2. Bascule Strapi sur Postgres (update `.env`, `DATABASE_CLIENT=postgres`)
3. Migration Strapi : colonnes + index HNSW sur `questions`
4. Déploiement du plugin (serveur seulement, admin désactivable par flag)
5. Script de backfill sur le corpus existant
6. Activation UI admin
7. (Plus tard) Skill Claude qui génère des batchs et appelle `/preview`

## 11. Open questions / future work

- **Seuils configurables** : pour l'instant 0.85 / 0.92 sont hardcodés. Si trop de bruit en review, les passer en env var avant de les rendre configurables via admin.
- **Re-embedding au changement de modèle** : on stocke `embedding_model` mais pas de logique automatique pour re-embedder un corpus. À voir si nécessaire un jour.
- **Fusion de questions** : merge UI (v2) pour quand l'admin veut absorber une candidate dans une existante.
- **Multi-tenant / droits** : actuellement tout admin Strapi peut importer. Si besoin de restreindre, ajouter un permission token côté plugin.

# Direction visuelle — Pronos Miss

## Sujet
App privée de pronostics pour une soirée Miss France entre ~20 amis. Ton : soirée télé entre potes, glamour assumé et un peu kitsch, jamais corporate. Usage 95 % mobile, un soir par an, souvent à la lumière d'un salon devant TF1.

## L'élément mémorable : l'écharpe
Les photos officielles montrent chaque candidate avec une écharpe bleu marine où est écrit le nom de sa région. L'app reprend cet objet comme unique signature :
- **Ton prono = ton écharpe.** Sur le profil, la home et le classement, le choix de chaque joueur s'affiche sous forme d'écharpe : une bande bleu marine en diagonale (-12°), avec le nom de la région en blanc, en capitales condensées. C'est le **seul** endroit de l'app où les capitales sont autorisées, parce que c'est l'objet réel.
- **Écharpe éliminée** : la bande passe en gris, le texte est barré et l'opacité tombe à 55 %.
- **Écharpe gagnante** : la bande passe en or et un liseré apparaît.
- Tout le reste de l'app est calme, pour laisser l'écharpe porter l'identité.

## Couleurs
| Nom | Hex | Rôle |
|---|---|---|
| Ciel de studio | `#DCEEF4` | fond principal (repris du décor bleu ciel des photos) |
| Écharpe | `#1D2B78` | texte principal, écharpes, boutons principaux |
| Satin | `#FFFFFF` | surfaces (fiches, feuilles) |
| Or couronne | `#D9A21B` | trophée 🥇, écharpe gagnante, uniquement pour la victoire ; seule exception, le « Miss France » de l'icône de l'app |
| Strass | `#E0287D` | action unique de l'écran (Choisir / Fermer les pronos) et badge "en direct" |
| Galet | `#8C93A8` | états désactivés, écharpes éliminées, texte secondaire |

Argent `#A7B0BE` et bronze `#B4703A` sont réservés aux trophées 🥈 et 🥉.
Ratios de contraste vérifiés : Écharpe sur Ciel ≥ 10:1. Le blanc sur Strass ne s'utilise qu'en texte bold ≥ 16 px.

## Typographie
- **Fraunces** (variable, opsz + SOFT 50, wght 600–800) : titres, noms des candidates. Ses formes molles et un peu kitsch rappellent la soirée glamour sans tomber dans l'éditorial.
- **Bricolage Grotesque** (400/600) : interface et texte courant.
- **Barlow Condensed** 700 en capitales, espacement +0.06em : **uniquement** dans l'écharpe.
- **Ephesis** (manuscrite, OFL) : **uniquement** le « Miss France » de l'icône (`public/icons/*.svg`, `public/favicon.svg`), vectorisé dans le SVG ; elle n'est pas chargée par l'app.

Échelle (ratio 1.25, base 16 px) : 12.8 / 16 / 20 / 25 / 31.25 / 39 / 48.8. Interligne 1.5 pour le texte courant, 1.1 pour les titres. Lignes de 65 caractères maximum.
Les polices sont auto-hébergées avec `@fontsource`, pour que l'app fonctionne hors ligne (PWA).

## Mise en page (mobile d'abord, 360–430 px)
- Alignement à gauche partout, sauf le podium final, qui est centré.
- Grille des candidates : 2 colonnes de vignettes 3:4 (portraits 9:16 recadrés par le haut), avec le nom en Fraunces sous la photo et la région en petit. Aucune ombre : un bord de 1 px Écharpe à 12 % d'opacité, rayon 14 px.
- La candidate choisie a un contour de 3 px Strass et une mini-écharpe "Mon prono" posée en diagonale sur le coin de la photo.
- Fiche candidate : une feuille qui monte du bas, photo en pied, infos, puis un seul bouton "Choisir Miss <Région>".
- Navigation : une barre en bas à 4 onglets (Accueil, Candidates, Soirée, Profil). Un 5e onglet "Admin" n'apparaît que pour l'admin.
- Le rayon est hiérarchisé : 14 px pour les photos, 999 px pour les boutons, 20 px pour les feuilles.

```
ACCUEIL (pronos ouverts)            SOIRÉE (après fermeture)
┌───────────────────────┐           ┌───────────────────────┐
│ Pronos Miss 2027       │           │ ● En direct            │
│ Samedi 12 décembre     │           │ 12 en course · 8 out   │
│ J-21                   │           │ ┌───────────────────┐  │
│ ╲ BRETAGNE ╲  ← écharpe│           │ │😎 Hugo ╲BRETAGNE╲  │  │
│ Tu peux changer        │           │ │🦄 Julie╲ ̶C̶O̶R̶S̶E̶ ╲  │  │
│ jusqu'à la fermeture   │           │ └───────────────────┘  │
│ [ Voir les candidates ]│           │                        │
└───────────────────────┘           └───────────────────────┘
```

## Mouvement
Une seule animation orchestrée : quand l'admin entre un résultat, les écharpes éliminées se "décrochent" l'une après l'autre (rotation +4°, puis passage au gris, 60 ms de décalage entre chaque). Au podium final, l'écharpe gagnante passe à l'or, avec une seule pluie de confettis.
Partout ailleurs, il n'y a que du mouvement en réponse à une action (ouverture d'une feuille, confirmation d'un choix). `prefers-reduced-motion` coupe tout.

## Ton des textes
Phrases à la casse normale, tutoiement, verbes simples. Les boutons disent ce qu'ils font, et le même mot sert du bouton à la confirmation : "Choisir Miss Bretagne" → toast "Miss Bretagne choisie". Les états vides invitent à agir ("Tu n'as pas encore choisi. Va voir les candidates."). Les erreurs disent ce qui s'est passé et quoi faire, sans s'excuser.
À éviter : les eyebrows en capitales, les flèches → dans les boutons, les séparateurs en « · » décoratifs (le séparateur du compteur "12 en course · 8 out" est une vraie donnée, il est toléré).

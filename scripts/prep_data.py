"""Builds candidates.json + optimized WebP photos for edition 2027.
Usage: python3 -I prep_data.py <photos_dir> <project_dir>"""
import json, os, re, sys, unicodedata
from PIL import Image

src, proj = sys.argv[1], sys.argv[2]
EDITION = "2027"

# Region, Nom, Âge, Taille, Origine, Profession, Passions, Instagram (handle)
ROWS = [
 ("Alsace","Chiara Blazevic",24,1.76,"Rantzwiller (Haut-Rhin)","Licence en événementiel, alternance à Mulhouse",None,"chiarablazevic.off"),
 ("Aquitaine","Solène Videau",22,1.73,"Mérignac","Étudiante en école de mode",None,"solene.videau"),
 ("Auvergne","Lina Berthelier",24,None,"Commentry (Allier)","Master en école de commerce, ingénieure d'affaires en alternance",None,"linaberthelier"),
 ("Bourgogne","Ilona Perrot",23,1.76,"La Fermeté (Nièvre)","Infirmière en psychiatrie","Danse ; santé mentale","ilonaperrot.off"),
 ("Bretagne","Margot Ferré Bernard",20,1.71,"Guipavas (près de Brest)","Étudiante en 3e année de droit, vise juge des enfants","Protection de l'enfance","margot.ferrebernard"),
 ("Centre-Val de Loire","Justine Bourrelier",25,1.76,"Sammarie (Eure-et-Loir)","Responsable marketing chez Burger King","Voyages","justinebourrelier.off"),
 ("Champagne-Ardenne","Céline Leduc",23,1.83,"Tagnon (Ardennes)",None,None,"celineleducoff"),
 ("Corse","Satine Nomary",19,1.76,"Née dans les Hauts-de-Seine, vit en Corse","Hôtesse de l'air chez Air Corsica","Voyages, volley, piano ; mannequinat","satinenomary"),
 ("Côte d'Azur","May Haoues",19,1.74,"Née à Paris, a grandi à Cagnes-sur-Mer","2e année à l'EDHEC Nice","Volley, voyages, bateau ; cause animale, lutte contre le cancer","may_haoues"),
 ("Franche-Comté","Emma Ninot",21,None,"Doubs","Diplômée infirmière, projette des études de médecine","Course, vélo, sauveteuse en mer ; rallye solidaire avec des enfants malades","emmaninot.off"),
 ("Guadeloupe","Julia Désirée",20,1.81,"Les Abymes","Conseillère en parfumerie et cosmétique","Mode, plongée ; violences faites aux femmes","_juliadesiree_"),
 ("Guyane","Sandra Justine",23,1.77,"Kourou","Infirmière coordinatrice en petite enfance","Sensibilisation aux troubles DYS","sandrajustineoff"),
 ("Île-de-France","Camilla Alash",23,1.81,"Clichy-la-Garenne (Hauts-de-Seine)","Études de journalisme","Tennis","camillaalash"),
 ("Languedoc","Candice Gauch",29,1.77,"Lozère (vit à Paris)","Consultante","Natation, snorkeling, voyages, sport ; parle occitan","candice.gauch"),
 ("Limousin","Elise Escuriol",22,1.74,"Brive-la-Gaillarde","BUT gestion des entreprises",None,"elise_.escuriol"),
 ("Lorraine","Léane Froment",None,None,"Gondreville (Meurthe-et-Moselle)","BTS commerce 2e année en alternance","Équitation, voyages","leanefromentoff"),
 ("Martinique","Maureen-Alycia Lucéa-Merlin",24,1.76,"Fort-de-France","Responsable hébergement en EHPAD ; master management des établissements de santé","Culture et identité martiniquaises","maureenalycialm_off"),
 ("Mayotte","Emma Saïd Issouf",24,1.74,"Kawéni (Mamoudzou)","Licence de lettres, vise professeure des écoles","Basket ; violences faites aux femmes ; culture mahoraise","emma.saidissouf"),
 ("Midi-Pyrénées","Carla Rachail",23,1.74,"Valence-d'Agen (Tarn-et-Garonne)","Licence management du sport ; reçue au concours de sous-officier de gendarmerie","Ancienne rugbywoman ; lutte contre les stéréotypes de genre","carlarachailoff"),
 ("Nord-Pas-de-Calais","Shana Mendes",18,1.75,"Hem (métropole lilloise)","Étudiante en LEA","Équitation ; bénévolat auprès de personnes isolées et handicapées","shanamendesoff"),
 ("Normandie","Pauline Gourlez",21,1.71,"Giberville","Comptable","Équitation, photo, mannequinat ; inclusion des personnes handicapées","paulinegourlez"),
 ("Nouvelle-Calédonie","Lana Prost",17,1.75,None,"Lycéenne (lycée Lapérouse)","Diversité et promotion du territoire","lana_prost_"),
 ("Pays de la Loire","Maëlle Hamon",23,None,"Nantes","Accompagnante d'élèves en situation de handicap en lycée",None,"maellehamonoff"),
 ("Picardie","Marie Villez",26,1.73,"Amiens (Somme)","Chargée de communication en alternance, étudiante à Sup de Com","Équitation","marievillezoff"),
 ("Poitou-Charentes","Mandy Goudal",38,None,"Saintes (Charente-Maritime)","Gérante d'une boutique de robes de mariée ; mère de deux enfants",None,"mandygoudal"),
 ("Provence","Ophélie Vitalbo",27,1.71,"Velleron (Vaucluse)","Kinésithérapeute à Paris","Santé des femmes ; sensibilisation au handicap","ophelievitalbo"),
 ("Réunion","Laetitia Roguet",20,1.72,"Sainte-Anne","Étudiante préparatrice en pharmacie","Santé mentale ; patrimoine culturel réunionnais","laetitiaroguet_"),
 ("Rhône-Alpes","Julia Grid-Costantino",23,None,"Lyon",None,None,"julia_grid.costantino"),
 ("Roussillon","Juliette Gauthier",22,1.74,"Le Boulou (Pyrénées-Orientales)","Kinésithérapeute","Danse, plongée, randonnée, ski ; enfants en situation de handicap","juliettegauthier___"),
 ("Saint-Martin et Saint-Barthélemy","Naïla Parotte",22,None,"Saint-Martin","BTS comptabilité-gestion ; manager chez une marque automobile ; mannequinat","Cause animale (projet de refuge SPA)","naila.parotte_officiel"),
 ("Tahiti","Leia Diard",22,1.72,"Née à Tours, vit à Tahiti","Licence d'administration des entreprises ; enseigne le ori tahiti","Endométriose ; culture polynésienne","leiadiard_off"),
]

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

# photos: "NN_Miss_<Region>_2026_<Name>.jpg" -> lowest NN = portrait, highest = full body
files = {}
for f in os.listdir(src):
    m = re.match(r"(\d+)_Miss_(.+)_2026_", f)
    if m:
        files.setdefault(norm(m.group(2).replace("dAzur", "d Azur")), []).append((int(m.group(1)), f))

out_img = os.path.join(proj, "public", "candidates", EDITION)
out_json = os.path.join(proj, "src", "data", "editions", EDITION)
os.makedirs(out_img, exist_ok=True); os.makedirs(out_json, exist_ok=True)

def key(region):
    k = norm(region)
    return {"saint-martin-et-saint-barthelemy": "saint-martin-saint-barthelemy"}.get(k, k)

cands = []
for i, (region, name, age, h, origin, job, passions, ig) in enumerate(ROWS):
    slug = norm(region)
    pics = sorted(files.pop(key(region)))
    assert len(pics) == 2, (region, pics)
    for suffix, (_, f), width in (("", pics[0], 600), ("-full", pics[1], 700)):
        im = Image.open(os.path.join(src, f)).convert("RGB")
        im.thumbnail((width, 10_000))
        im.save(os.path.join(out_img, f"{slug}{suffix}.webp"), "WEBP", quality=78, method=6)
    cands.append({
        "id": slug, "order": i, "region": region, "name": name, "age": age,
        "heightM": h, "origin": origin, "job": job, "passions": passions,
        "instagram": ig,
        "photo": f"/candidates/{EDITION}/{slug}.webp",
        "photoFull": f"/candidates/{EDITION}/{slug}-full.webp",
    })
assert not files, f"unmatched photos: {files.keys()}"
with open(os.path.join(out_json, "candidates.json"), "w", encoding="utf-8") as fh:
    json.dump({"editionId": EDITION, "candidates": cands}, fh, ensure_ascii=False, indent=2)
print(len(cands), "candidates OK")

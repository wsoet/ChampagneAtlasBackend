const sourceName = "champagne.xlsx";
const civcDirectoryUrl =
  "https://www.champagne.fr/fr/visiter-la-champagne/annuaire-caves-champagne";

const rows = [
  {
    "name": "Abelé 1757",
    "location": "Reims"
  },
  {
    "name": "Adrien Renoir",
    "location": "Verzy"
  },
  {
    "name": "Agrapart & Fils",
    "location": "Avize"
  },
  {
    "name": "A. Bergère",
    "location": "Épernay"
  },
  {
    "name": "Albert Beerens",
    "location": "Arrentières"
  },
  {
    "name": "Albert Lebrun",
    "location": "Chouilly"
  },
  {
    "name": "Alexandre Bonnet",
    "location": "Les Riceys"
  },
  {
    "name": "Alexandre Grimée",
    "location": "Bonneil"
  },
  {
    "name": "Alfred Gratien",
    "location": "Épernay"
  },
  {
    "name": "Alice Bardot",
    "location": "Épernay"
  },
  {
    "name": "Amour de Deutz",
    "location": "Aÿ"
  },
  {
    "name": "André Clouet",
    "location": "Bouzy"
  },
  {
    "name": "André Tixier & Fils",
    "location": "Chigny-les-Roses"
  },
  {
    "name": "Antoine Chevalier",
    "location": "Vitry-en-Perthois"
  },
  {
    "name": "Apollonis",
    "location": "Festigny"
  },
  {
    "name": "Arlaux",
    "location": "Vrigny"
  },
  {
    "name": "Armand de Brignac",
    "location": "Rilly-la-Montagne"
  },
  {
    "name": "Arnaud de Cheurlin",
    "location": "Celles-sur-Ource"
  },
  {
    "name": "Aubry",
    "location": "Jouy-lès-Reims"
  },
  {
    "name": "Augustin",
    "location": "Avenay-Val-d'Or"
  },
  {
    "name": "Ayala",
    "location": "Aÿ"
  },
  {
    "name": "Barons de Rothschild",
    "location": "Reims"
  },
  {
    "name": "Baron-Fuenté",
    "location": "Charly-sur-Marne"
  },
  {
    "name": "Barthélemy",
    "location": "Aÿ"
  },
  {
    "name": "Bauget-Jouette",
    "location": "Épernay"
  },
  {
    "name": "Beau Joie",
    "location": "Épernay"
  },
  {
    "name": "Beaumet",
    "location": "Épernay"
  },
  {
    "name": "Beaumont de Crayères",
    "location": "Mardeuil"
  },
  {
    "name": "Benecki",
    "location": "Épernay"
  },
  {
    "name": "Benoit Lahaye",
    "location": "Bouzy"
  },
  {
    "name": "Benoît Marguet",
    "location": "Ambonnay"
  },
  {
    "name": "Besserat de Bellefon",
    "location": "Épernay"
  },
  {
    "name": "Billecart-Salmon",
    "location": "Mareuil-sur-Aÿ"
  },
  {
    "name": "Binet",
    "location": "Reims"
  },
  {
    "name": "Bliard-Moriset",
    "location": "Le Mesnil-sur-Oger"
  },
  {
    "name": "Blin",
    "location": "Vincelles"
  },
  {
    "name": "Boerl & Kroff",
    "location": "Urville"
  },
  {
    "name": "Boizel",
    "location": "Épernay"
  },
  {
    "name": "Bollinger",
    "location": "Aÿ"
  },
  {
    "name": "Bonnaire",
    "location": "Cramant"
  },
  {
    "name": "Boulard Bauquaire",
    "location": "Cormicy"
  },
  {
    "name": "Bouché Père & Fils",
    "location": "Pierry"
  },
  {
    "name": "Bourdaire-Gallois",
    "location": "Pouillon"
  },
  {
    "name": "Bressant",
    "location": "Bligny"
  },
  {
    "name": "Brieuil",
    "location": "Chigny-les-Roses"
  },
  {
    "name": "Brosslette",
    "location": "Troyes"
  },
  {
    "name": "Brice",
    "location": "Bouzy"
  },
  {
    "name": "Bruno Michel",
    "location": "Pierry"
  },
  {
    "name": "Bruno Paillard",
    "location": "Reims"
  },
  {
    "name": "Canard-Duchêne",
    "location": "Ludes"
  },
  {
    "name": "Carbon",
    "location": "Champillon"
  },
  {
    "name": "Carbot",
    "location": "Aÿ"
  },
  {
    "name": "Castelnau",
    "location": "Reims"
  },
  {
    "name": "Cattier",
    "location": "Chigny-les-Roses"
  },
  {
    "name": "Chanoine Frères",
    "location": "Reims"
  },
  {
    "name": "Charles de Cazanove",
    "location": "Reims"
  },
  {
    "name": "Charles Collin",
    "location": "Fontette"
  },
  {
    "name": "Charles Ellner",
    "location": "Épernay"
  },
  {
    "name": "Charles Heidsieck",
    "location": "Reims"
  },
  {
    "name": "Charles Mignon",
    "location": "Épernay"
  },
  {
    "name": "Chartogne-Taillet",
    "location": "Merfy"
  },
  {
    "name": "Château de Bligny",
    "location": "Bligny"
  },
  {
    "name": "Château de Boursault",
    "location": "Boursault"
  },
  {
    "name": "Château de la Marquetterie",
    "location": "Pierry"
  },
  {
    "name": "Chauvet",
    "location": "Tours-sur-Marne"
  },
  {
    "name": "Chéreau-Carré",
    "location": "Épernay"
  },
  {
    "name": "Cheurlin Dangin",
    "location": "Celles-sur-Ource"
  },
  {
    "name": "Clandestin",
    "location": "Buxières-sur-Arce"
  },
  {
    "name": "Cl de la Chapelle",
    "location": "Villedommange"
  },
  {
    "name": "Cochet-Bacha",
    "location": "Avize"
  },
  {
    "name": "Collet",
    "location": "Aÿ"
  },
  {
    "name": "Comte de Champagne",
    "location": "Reims"
  },
  {
    "name": "Comte de Montaigne",
    "location": "Celles-sur-Ource"
  },
  {
    "name": "Comtesse de Cérès",
    "location": "Verzenay"
  },
  {
    "name": "Comtesse Lafond",
    "location": "Épernay"
  },
  {
    "name": "Condé de Valdemar",
    "location": "Aÿ"
  },
  {
    "name": "Coquillette",
    "location": "Chouilly"
  },
  {
    "name": "Cristal",
    "location": "Reims"
  },
  {
    "name": "Daniel Dumont",
    "location": "Rilly-la-Montagne"
  },
  {
    "name": "De Castellane",
    "location": "Épernay"
  },
  {
    "name": "De Linières",
    "location": "Épernay"
  },
  {
    "name": "De Saint-Gall",
    "location": "Avize"
  },
  {
    "name": "De Venoge",
    "location": "Épernay"
  },
  {
    "name": "Delamotte",
    "location": "Le Mesnil-sur-Oger"
  },
  {
    "name": "Delavenne Père & Fils",
    "location": "Bouzy"
  },
  {
    "name": "Delbeck",
    "location": "Reims"
  },
  {
    "name": "Demoiselle",
    "location": "Reims"
  },
  {
    "name": "Desbordes-Amiaud",
    "location": "Épernay"
  },
  {
    "name": "Deutz",
    "location": "Aÿ"
  },
  {
    "name": "Devaux",
    "location": "Bar-sur-Seine"
  },
  {
    "name": "Dhondt-Grellet",
    "location": "Flavigny"
  },
  {
    "name": "Diebolt-Vallois",
    "location": "Cramant"
  },
  {
    "name": "Diran",
    "location": "Épernay"
  },
  {
    "name": "Dom Pérignon",
    "location": "Épernay"
  },
  {
    "name": "Dom Caudron",
    "location": "Passy-Grigny"
  },
  {
    "name": "Dom Ruinart",
    "location": "Reims"
  },
  {
    "name": "Dossot",
    "location": "Baroville"
  },
  {
    "name": "Doyard",
    "location": "Vertus"
  },
  {
    "name": "Doyard-Mahé",
    "location": "Vertus"
  },
  {
    "name": "Drappier",
    "location": "Urville"
  },
  {
    "name": "Duval-Leroy",
    "location": "Vertus"
  },
  {
    "name": "Duménil",
    "location": "Chigny-les-Roses"
  },
  {
    "name": "Egly-Ouriet",
    "location": "Ambonnay"
  },
  {
    "name": "Elodie D.",
    "location": "Épernay"
  },
  {
    "name": "Esterlin",
    "location": "Épernay"
  },
  {
    "name": "Feneuil",
    "location": "Marne"
  },
  {
    "name": "Fleury",
    "location": "Courteron"
  },
  {
    "name": "Fourny",
    "location": "Vertus"
  },
  {
    "name": "Franck Bonville",
    "location": "Avize"
  },
  {
    "name": "Françoise Bedel",
    "location": "Port-à-Binson"
  },
  {
    "name": "François Secondé",
    "location": "Sillery"
  },
  {
    "name": "G.H. Martel & Co.",
    "location": "Reims"
  },
  {
    "name": "G.H. Mumm",
    "location": "Reims"
  },
  {
    "name": "Gaby",
    "location": "Aÿ"
  },
  {
    "name": "Gardet",
    "location": "Chigny-les-Roses"
  },
  {
    "name": "Gaston Chiquet",
    "location": "Dizy"
  },
  {
    "name": "Gatinois",
    "location": "Aÿ"
  },
  {
    "name": "Gauthier",
    "location": "Épernay"
  },
  {
    "name": "Gauthier-Christophe",
    "location": "Épernay"
  },
  {
    "name": "Geoffroy",
    "location": "Aÿ"
  },
  {
    "name": "George de la Chapelle",
    "location": "Villers-sous-Châtillon"
  },
  {
    "name": "Georges Cartier",
    "location": "Épernay"
  },
  {
    "name": "Georges Vesselle",
    "location": "Bouzy"
  },
  {
    "name": "Gimonnet-Gonet",
    "location": "Bouzy"
  },
  {
    "name": "Gonet-Médeville",
    "location": "Bisseuil"
  },
  {
    "name": "Gosset",
    "location": "Aÿ"
  },
  {
    "name": "Goutorbe",
    "location": "Aÿ"
  },
  {
    "name": "Grandes Marques",
    "location": "Reims"
  },
  {
    "name": "Grimée",
    "location": "Bonneil"
  },
  {
    "name": "Guiborat",
    "location": "Cramant"
  },
  {
    "name": "Guy Charlemagne",
    "location": "Le Mesnil-sur-Oger"
  },
  {
    "name": "Guy Dumangin",
    "location": "Chigny-les-Roses"
  },
  {
    "name": "Guy de Chassey",
    "location": "Louvois"
  },
  {
    "name": "H. Blin",
    "location": "Vincelles"
  },
  {
    "name": "Heidsieck & Co Monopole",
    "location": "Reims"
  },
  {
    "name": "Henri Abelé",
    "location": "Reims"
  },
  {
    "name": "Henri Giraud",
    "location": "Aÿ"
  },
  {
    "name": "Henri Mandois",
    "location": "Pierry"
  },
  {
    "name": "Henriot",
    "location": "Reims"
  },
  {
    "name": "Hervieux-Dumez",
    "location": "Sacy"
  },
  {
    "name": "Hostomme",
    "location": "Chouilly"
  },
  {
    "name": "Hubert Paulet",
    "location": "Rilly-la-Montagne"
  },
  {
    "name": "Hure Frères",
    "location": "Ludes"
  },
  {
    "name": "Irroy",
    "location": "Reims"
  },
  {
    "name": "J. de Telmont",
    "location": "Damery"
  },
  {
    "name": "J. Lassalle",
    "location": "Chigny-les-Roses"
  },
  {
    "name": "J.M. Gobillard & Fils",
    "location": "Hautvillers"
  },
  {
    "name": "J.M. Labruyère",
    "location": "Verzenay"
  },
  {
    "name": "J.M. Seleque",
    "location": "Pierry"
  },
  {
    "name": "Jacques Selosse",
    "location": "Avize"
  },
  {
    "name": "Jacquart",
    "location": "Reims"
  },
  {
    "name": "Jacquesson",
    "location": "Dizy"
  },
  {
    "name": "Janisson & Fils",
    "location": "Verzenay"
  },
  {
    "name": "Janisson-Baradon",
    "location": "Épernay"
  },
  {
    "name": "Jean Comyn",
    "location": "Châlons-en-Champagne"
  },
  {
    "name": "Jean Diot",
    "location": "Vinay"
  },
  {
    "name": "Jean Milan",
    "location": "Oger"
  },
  {
    "name": "Jean Laurent",
    "location": "Celles-sur-Ource"
  },
  {
    "name": "Jean-Noël Haton",
    "location": "Damery"
  },
  {
    "name": "Jeunaux-Robin",
    "location": "Talus-Saint-Prix"
  },
  {
    "name": "Joseph Perrier",
    "location": "Châlons-en-Champagne"
  },
  {
    "name": "Juillet-Lallement",
    "location": "Verzy"
  },
  {
    "name": "Krug",
    "location": "Reims"
  },
  {
    "name": "Laherte Frères",
    "location": "Chavot"
  },
  {
    "name": "Lallier",
    "location": "Aÿ"
  },
  {
    "name": "Lamiable",
    "location": "Tours-sur-Marne"
  },
  {
    "name": "Lanson",
    "location": "Reims"
  },
  {
    "name": "Larmandier-Bernier",
    "location": "Vertus"
  },
  {
    "name": "Lassalle",
    "location": "Chigny-les-Roses"
  },
  {
    "name": "Laurent-Perrier",
    "location": "Tours-sur-Marne"
  },
  {
    "name": "Le Guédard",
    "location": "Ambonnay"
  },
  {
    "name": "Le Brun de Neuville",
    "location": "Bethon"
  },
  {
    "name": "Leclerc Briant",
    "location": "Épernay"
  },
  {
    "name": "Legras & Haas",
    "location": "Chouilly"
  },
  {
    "name": "Lété-Vautrain",
    "location": "Château-Thierry"
  },
  {
    "name": "Lilbert-Fils",
    "location": "Cramant"
  },
  {
    "name": "Lombard",
    "location": "Épernay"
  },
  {
    "name": "Louis Barthélémy",
    "location": "Aÿ"
  },
  {
    "name": "Louis Casters",
    "location": "Damery"
  },
  {
    "name": "Louis de Sacy",
    "location": "Verzy"
  },
  {
    "name": "Louis Massing",
    "location": "Avize"
  },
  {
    "name": "Louis Nicaise",
    "location": "Hautvillers"
  },
  {
    "name": "Louis Roederer",
    "location": "Reims"
  },
  {
    "name": "Mansard Baillet",
    "location": "Épernay"
  },
  {
    "name": "Marc Hébrart",
    "location": "Mareuil-sur-Aÿ"
  },
  {
    "name": "Marie-Courtin",
    "location": "Polisot"
  },
  {
    "name": "Marquis de Pommereuil",
    "location": "Les Riceys"
  },
  {
    "name": "Marniquet",
    "location": "Venteuil"
  },
  {
    "name": "Maurice Grumier",
    "location": "Venteuil"
  },
  {
    "name": "Maxime Blin",
    "location": "Trigny"
  },
  {
    "name": "Mercier",
    "location": "Épernay"
  },
  {
    "name": "Michel Fagot",
    "location": "Rilly-la-Montagne"
  },
  {
    "name": "Michel Gonet",
    "location": "Épernay"
  },
  {
    "name": "Moët & Chandon",
    "location": "Épernay"
  },
  {
    "name": "Moncuit",
    "location": "Le Mesnil-sur-Oger"
  },
  {
    "name": "Montaudon",
    "location": "Reims"
  },
  {
    "name": "Morize",
    "location": "Les Riceys"
  },
  {
    "name": "Moutard-Diligent",
    "location": "Buxeuil"
  },
  {
    "name": "Nathalie Falmet",
    "location": "Rouvres-les-Vignes"
  },
  {
    "name": "Nicolas Feuillatte",
    "location": "Chouilly"
  },
  {
    "name": "Nicolas Maillart",
    "location": "Écueil"
  },
  {
    "name": "Oudinot",
    "location": "Épernay"
  },
  {
    "name": "Oury-Schreiber",
    "location": "Mareuil-sur-Aÿ"
  },
  {
    "name": "Paliama",
    "location": "Épernay"
  },
  {
    "name": "Palmer & Co",
    "location": "Reims"
  },
  {
    "name": "Pannier",
    "location": "Château-Thierry"
  },
  {
    "name": "Pascal Doquet",
    "location": "Vertus"
  },
  {
    "name": "Paul Bara",
    "location": "Bouzy"
  },
  {
    "name": "Paul Clouet",
    "location": "Bouzy"
  },
  {
    "name": "Paul Déthune",
    "location": "Ambonnay"
  },
  {
    "name": "Paul-Etienne Saint Germain",
    "location": "Épernay"
  },
  {
    "name": "Paul Goerg",
    "location": "Vertus"
  },
  {
    "name": "Pehu Simonet",
    "location": "Verzenay"
  },
  {
    "name": "Penet-Chardonnet",
    "location": "Verzenay"
  },
  {
    "name": "Perrier-Jouët",
    "location": "Épernay"
  },
  {
    "name": "Philipponnat",
    "location": "Mareuil-sur-Aÿ"
  },
  {
    "name": "Philippe Brugnon",
    "location": "Rilly-la-Montagne"
  },
  {
    "name": "Philippe Glavier",
    "location": "Cramant"
  },
  {
    "name": "Philippe Gonet",
    "location": "Le Mesnil-sur-Oger"
  },
  {
    "name": "Pierre Gerbais",
    "location": "Celles-sur-Ource"
  },
  {
    "name": "Pierre Gimonnet & Fils",
    "location": "Cuis"
  },
  {
    "name": "Pierre Legras",
    "location": "Chouilly"
  },
  {
    "name": "Pierre Moncuit",
    "location": "Le Mesnil-sur-Oger"
  },
  {
    "name": "Pierre Paillard",
    "location": "Bouzy"
  },
  {
    "name": "Pierre Péters",
    "location": "Le Mesnil-sur-Oger"
  },
  {
    "name": "Pierre Trichet",
    "location": "Trois-Puits"
  },
  {
    "name": "Piper-Heidsieck",
    "location": "Reims"
  },
  {
    "name": "Pithon",
    "location": "Épernay"
  },
  {
    "name": "Ployez-Jacquemart",
    "location": "Ludes"
  },
  {
    "name": "Pol Roger",
    "location": "Épernay"
  },
  {
    "name": "Pommery",
    "location": "Reims"
  },
  {
    "name": "R. Pouillon & Fils",
    "location": "Mareuil-sur-Aÿ"
  },
  {
    "name": "Rene Geoffroy",
    "location": "Aÿ"
  },
  {
    "name": "Reynold",
    "location": "Épernay"
  },
  {
    "name": "Rocher",
    "location": "Reims"
  },
  {
    "name": "Roger-Constant Lemaire",
    "location": "Villers-sous-Châtillon"
  },
  {
    "name": "Roger Brun",
    "location": "Aÿ"
  },
  {
    "name": "Roger Coulon",
    "location": "Vrigny"
  },
  {
    "name": "Roger Manceaux",
    "location": "Rilly-la-Montagne"
  },
  {
    "name": "Roland Champion",
    "location": "Chouilly"
  },
  {
    "name": "Ruinart",
    "location": "Reims"
  },
  {
    "name": "Sacy",
    "location": "Verzy"
  },
  {
    "name": "Salon",
    "location": "Le Mesnil-sur-Oger"
  },
  {
    "name": "Sancho",
    "location": "Reims"
  },
  {
    "name": "Savart",
    "location": "Écueil"
  },
  {
    "name": "Senez",
    "location": "Fontette"
  },
  {
    "name": "Soutiran",
    "location": "Ambonnay"
  },
  {
    "name": "Suenen",
    "location": "Cramant"
  },
  {
    "name": "Taittinger",
    "location": "Reims"
  },
  {
    "name": "Tarlant",
    "location": "Oeuilly"
  },
  {
    "name": "Thiénot",
    "location": "Taissy"
  },
  {
    "name": "Tsarine",
    "location": "Reims"
  },
  {
    "name": "Ulysse Collin",
    "location": "Congy"
  },
  {
    "name": "Vazart-Coquart & Fils",
    "location": "Chouilly"
  },
  {
    "name": "Veuve Clicquot",
    "location": "Reims"
  },
  {
    "name": "Veuve Devaux",
    "location": "Bar-sur-Seine"
  },
  {
    "name": "Veuve Fourny & Fils",
    "location": "Vertus"
  },
  {
    "name": "Vignon Père & Fils",
    "location": "Verzenay"
  },
  {
    "name": "Vilmart & Co.",
    "location": "Rilly-la-Montagne"
  },
  {
    "name": "Vollereaux",
    "location": "Pierry"
  },
  {
    "name": "Vranken",
    "location": "Reims"
  },
  {
    "name": "Vouette & Sorbée",
    "location": "Buxières-sur-Arce"
  },
  {
    "name": "Waris-Larmandier",
    "location": "Avize"
  },
  {
    "name": "Besserat",
    "location": "Épernay / Sub-label"
  },
  {
    "name": "Bonnet",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Burtin",
    "location": "Épernay / Sub-label"
  },
  {
    "name": "Charles de Noailles",
    "location": "Epernay / Sub-label"
  },
  {
    "name": "Chauvet Frères",
    "location": "Tours-sur-Marne / Sub-label"
  },
  {
    "name": "Comte de Noiron",
    "location": "Reims / Sub-label"
  },
  {
    "name": "De Meric",
    "location": "Aÿ / Sub-label"
  },
  {
    "name": "De Rocheré",
    "location": "Urville / Sub-label"
  },
  {
    "name": "Delahaie",
    "location": "Épernay / Sub-label"
  },
  {
    "name": "Duval",
    "location": "Vertus / Sub-label"
  },
  {
    "name": "Ernest Rapeneau",
    "location": "Epernay / Sub-label"
  },
  {
    "name": "Ferdinand Bonnet",
    "location": "Reims / Sub-label"
  },
  {
    "name": "G. Fluteau",
    "location": "Gyé-sur-Seine / Sub-label"
  },
  {
    "name": "George Goulet",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Giesler",
    "location": "Avize / Sub-label"
  },
  {
    "name": "Goulet",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Heidsieck Monopole",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Henri de Verlaine",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Hubert de Claminger",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Jacques Busin",
    "location": "Verzenay / Sub-label"
  },
  {
    "name": "Jeanmaire",
    "location": "Épernay / Sub-label"
  },
  {
    "name": "Kupferberg",
    "location": "Mainz/Épernay / Sub-label"
  },
  {
    "name": "Lassalle Chigny",
    "location": "Chigny / Sub-label"
  },
  {
    "name": "Lechere",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Lemoine",
    "location": "Épernay / Sub-label"
  },
  {
    "name": "Magenta",
    "location": "Épernay / Sub-label"
  },
  {
    "name": "Marie Stuart",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Massé",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Maxim's",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Oger Grand Cru",
    "location": "Oger / Sub-label"
  },
  {
    "name": "Paul Dangin",
    "location": "Celles-sur-Ource / Sub-label"
  },
  {
    "name": "Prince Laurent",
    "location": "Épernay / Sub-label"
  },
  {
    "name": "Remi Henry",
    "location": "Verzy / Sub-label"
  },
  {
    "name": "Rene Florancy",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Saint-Réol",
    "location": "Ambonnay / Sub-label"
  },
  {
    "name": "Veuve Clicquot-Ponsardin",
    "location": "Reims / Sub-label"
  },
  {
    "name": "Veuve Monnier",
    "location": "Épernay / Sub-label"
  }
];

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initials(value) {
  return value
    .split(/[\s&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export const spreadsheetHouses = rows.map(({ name, location }) => {
  const [cityPart] = location.split("/");
  const city = cityPart.trim() || "Champagne";
  const isSubLabel = /sub-label/i.test(location);
  const displayName = /^champagne\s+/i.test(name) ? name : `Champagne ${name}`;
  const address = `${displayName}, ${city}, France`;
  return {
    id: `xlsx-${slug(name)}-${slug(city)}`,
    name: displayName,
    type: "HOUSE",
    city,
    address,
    region: isSubLabel ? "Champagne – Sub-label" : "Champagne",
    description: isSubLabel
      ? `${displayName} is in de aangeleverde bron gemarkeerd als sub-label.`
      : `${displayName} staat in de aangeleverde champagnecatalogus.`,
    website: "",
    directoryUrl: civcDirectoryUrl,
    sourceUrl: "",
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    initials: initials(name),
    accent: isSubLabel ? "FF87734E" : "FFC7A45A",
    sourceIds: ["user-champagne-xlsx"],
    sourceName
  };
});

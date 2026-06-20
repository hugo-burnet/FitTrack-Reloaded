import { $, echap, cloneProfond, aujourdHui, slug } from '../utils.js';
import { ALIMENTS, PLAN } from '../data.js';
import { ORDRE_CATEGORIES } from '../data/aliments-base.js';
import { catalogue, rechercher, categoriesPresentes } from '../catalogue.js';
import { kcalItem, protItem, glucItem, lipItem, fibItem, facteurFlex, flexSature, protCible, macrosCible, macrosPlat } from '../nutrition.js';
import { moyennesHebdo } from '../stats.js';
import { calculerBesoins, frequenceHebdo, OBJECTIFS } from '../besoins.js';
import { repasActifs, menuActif } from '../plans.js';
import { toast, demander, confirmer } from '../ui.js';

/* ================= REPAS : cible du jour, écart temps réel, log de la réalité =================
   Modèle « cible + écart » (specs 4.1) : le plan n'est qu'un DÉFAUT suggéré ; la vérité,
   c'est le journal du jour. La cible (kcal ET protéines) est explicite, l'écart se recalcule
   à chaque action. Les repas du plan cochés ET les ajouts hors-plan (« j'ai mangé autre
   chose ») sont journalisés tels que mangés et comptent dans la cible et l'export. */
export class RepasModule {
  constructor(store, app){
    this.store = store;
    this.app = app;
    /* état d'interface (non persisté) du mode « réorganiser les repas » */
    this.reorgOuvert = false;       /* le mode déplacement est-il actif */
    this.porteeDepl = 'plan';       /* 'plan' (permanent) | 'jour' (aujourd'hui seulement) */
    this.deplItem = null;           /* "idRepas:cle" de l'aliment dont le sélecteur de cible est ouvert */
    this.besoinsOuvert = false;     /* calculateur de besoins (E5) déplié ? */
    this.persoOuvert = false;       /* éditeur d'aliments perso (E2) déplié ? */
    this.persoEdit = null;          /* clé de l'aliment perso en cours d'édition (sinon création) */
    this.menuGestionOuvert = false; /* gestion des menus (E1) dépliée ? */
    this.platsOuvert = false;       /* éditeur de plats (E4) déplié ? */
    this.platEdit = null;           /* id du plat en cours d'édition (sinon création) */
    this.platComposants = [];       /* composants en cours de saisie [[cle,qté],…] */
    this.bind();
  }

  get etat(){ return this.store.etat; }

  /* ---- aliments perso (E2) ---- */
  perso(){ return (this.etat.aliments && this.etat.aliments.perso) || {}; }
  /* catalogue fusionné base + perso : sert au picker et aux calculs des extras */
  cat(){ return catalogue(this.perso()); }

  /* ---- multi-menus (E1) ---- */
  menuActif(){ return menuActif(this.etat); }
  basculerGestionMenu(){
    this.menuGestionOuvert = !this.menuGestionOuvert;
    $('menu-gestion').classList.toggle('cache', !this.menuGestionOuvert);
    $('btn-menu-gerer').setAttribute('aria-expanded', String(this.menuGestionOuvert));
    $('btn-menu-gerer').textContent = this.menuGestionOuvert ? '✕ Fermer' : 'Gérer les menus';
    this.renderMenu();
  }
  changerMenu(id){
    if(!this.etat.plansAlim.some(p=>p.id===id)) return;
    this.etat.planAlimActif = id;
    this.etat.repas.planJour = null;   /* la surcharge du jour appartenait à l'ancien menu */
    this.store.sauver();
    this.render();
  }
  async nouveauMenu(){
    const nom = await demander('Nom du nouveau menu ?', 'Nouveau menu');
    if(nom===null) return;
    const id = 'm'+Date.now();
    this.etat.plansAlim.push({ id, nom:(nom.trim()||'Nouveau menu'), repas:cloneProfond(PLAN) });
    this.changerMenu(id);
    if(!this.menuGestionOuvert) this.basculerGestionMenu();
  }
  dupliquerMenu(){
    const actif = this.menuActif(); if(!actif) return;
    const id = 'm'+Date.now();
    this.etat.plansAlim.push({ id, nom:`${actif.nom} (copie)`, repas:cloneProfond(actif.repas) });
    this.changerMenu(id);
  }
  renommerMenu(v){
    const actif = this.menuActif(); if(!actif) return;
    actif.nom = (v||'').trim() || 'Menu';
    this.store.sauver();
    this.renderMenu();   /* met à jour l'option du sélecteur sans voler le focus du champ */
  }
  async supprimerMenu(){
    if(this.etat.plansAlim.length<=1){ toast('Garde au moins un menu.', 'erreur'); return; }
    if(!(await confirmer('Supprimer ce menu entier ?', {danger:true}))) return;
    const id = this.etat.planAlimActif;
    this.etat.plansAlim = this.etat.plansAlim.filter(p=>p.id!==id);
    this.etat.planAlimActif = this.etat.plansAlim[0].id;
    this.etat.repas.planJour = null;
    this.store.sauver();
    this.render();
  }
  renderMenu(){
    const sel = $('menu-select'); if(!sel) return;
    const actif = this.menuActif();
    sel.innerHTML = this.etat.plansAlim.map(p=>
      `<option value="${echap(p.id)}"${actif&&p.id===actif.id?' selected':''}>${echap(p.nom)}</option>`).join('');
    const nom = $('menu-nom');
    if(nom && document.activeElement!==nom) nom.value = actif ? actif.nom : '';
    $('btn-menu-suppr').disabled = this.etat.plansAlim.length<=1;
  }

  /* repas du menu actif (E1) : source de vérité éditable (ex-`etat.plan`) */
  planActif(){ return repasActifs(this.etat); }
  /* plan effectif : surcharge du jour si elle existe, sinon les repas du menu actif */
  plan(){ return this.etat.repas.planJour || this.planActif(); }

  bind(){
    /* picker hors-plan : filtre catégories + liste d'aliments (base + perso), peuplés dynamiquement */
    this.remplirFiltreCategories();
    this.remplirPickerAliments();
    this.remplirPlatPicker();       /* picker de composants de l'éditeur de plats (E4) */
    /* catégories de l'éditeur perso (liste fixe ORDRE_CATEGORIES) */
    const selCat = $('perso-cat');
    if(selCat) selCat.innerHTML = ORDRE_CATEGORIES.map(c=>`<option value="${echap(c)}">${echap(c)}</option>`).join('');

    const root = $('ong-repas');
    root.addEventListener('click', e => {
      const step = e.target.closest('[data-action="obj-step"]');
      if(step){ this.ajusterObjectif(parseInt(step.dataset.delta,10)); return; }
      /* multi-menus (E1) */
      if(e.target.closest('#btn-menu-gerer')){ this.basculerGestionMenu(); return; }
      if(e.target.closest('#btn-menu-nouveau')){ this.nouveauMenu(); return; }
      if(e.target.closest('#btn-menu-dupliquer')){ this.dupliquerMenu(); return; }
      if(e.target.closest('#btn-menu-suppr')){ this.supprimerMenu(); return; }
      if(e.target.closest('#btn-repas-reorg')){ this.basculerReorg(); return; }
      const portee = e.target.closest('[data-action="depl-portee"]');
      if(portee){ this.porteeDepl = portee.dataset.portee; this.render(); return; }
      const dOuvrir = e.target.closest('[data-action="depl-ouvrir"]');
      if(dOuvrir){ this.basculerDeplItem(dOuvrir.dataset.rid, dOuvrir.dataset.cle); return; }
      const dVers = e.target.closest('[data-action="depl-vers"]');
      if(dVers){ this.deplacerAliment(dVers.dataset.from, dVers.dataset.cle, dVers.dataset.to); return; }
      const annuler = e.target.closest('[data-action="annuler-repas"]');
      if(annuler){ e.stopPropagation(); this.annulerRepas(annuler.dataset.id); return; }
      const combler = e.target.closest('[data-action="combler"]');
      if(combler){ this.ajouterExtraAliment(combler.dataset.cle, parseFloat(combler.dataset.qte)); return; }
      const supprX = e.target.closest('[data-action="suppr-extra"]');
      if(supprX){ this.supprimerExtra(supprX.dataset.id); return; }
      if(e.target.closest('#btn-extra-toggle')){ this.basculerFormExtra(); return; }
      if(e.target.closest('#btn-extra-add')){ this.ajouterDepuisForm(); return; }
      /* éditeur d'aliments perso (E2) */
      if(e.target.closest('#btn-perso-toggle')){ this.basculerPerso(); return; }
      if(e.target.closest('#btn-perso-save')){ this.sauverPerso(); return; }
      if(e.target.closest('#btn-perso-annuler')){ this.annulerEditPerso(); return; }
      const pEdit = e.target.closest('[data-action="perso-editer"]');
      if(pEdit){ this.editerPerso(pEdit.dataset.cle); return; }
      const pSup = e.target.closest('[data-action="perso-suppr"]');
      if(pSup){ this.supprimerPerso(pSup.dataset.cle); return; }
      /* plats composés (E4) */
      if(e.target.closest('#btn-plats-toggle')){ this.basculerPlats(); return; }
      if(e.target.closest('#btn-plat-add-comp')){ this.ajouterComposant(); return; }
      if(e.target.closest('#btn-plat-save')){ this.sauverPlat(); return; }
      if(e.target.closest('#btn-plat-annuler')){ this.annulerEditPlat(); return; }
      const compDel = e.target.closest('[data-action="plat-comp-del"]');
      if(compDel){ this.retirerComposant(parseInt(compDel.dataset.i,10)); return; }
      const platLog = e.target.closest('[data-action="plat-log"]');
      if(platLog){ this.loggerPlat(platLog.dataset.id); return; }
      const platEd = e.target.closest('[data-action="plat-editer"]');
      if(platEd){ this.editerPlat(platEd.dataset.id); return; }
      const platSup = e.target.closest('[data-action="plat-suppr"]');
      if(platSup){ this.supprimerPlat(platSup.dataset.id); return; }
      /* calculateur de besoins (E5) */
      if(e.target.closest('#btn-besoins-toggle')){ this.basculerBesoins(); return; }
      const objChip = e.target.closest('#bes-objectif [data-obj]');
      if(objChip){ this.choisirObjectif(objChip.dataset.obj); return; }
      if(e.target.closest('#btn-besoins-appliquer')){ this.appliquerBesoins(); return; }
      const carte = e.target.closest('[data-action="prendre-repas"]');
      if(carte){ this.prendreRepas(carte.dataset.id); return; }
    });
    root.addEventListener('keydown', e => {
      const carte = e.target.closest('[data-action="prendre-repas"]');
      if(carte && (e.key===' '||e.key==='Enter')){ e.preventDefault(); this.prendreRepas(carte.dataset.id); }
    });
    root.addEventListener('change', e => {
      if(e.target.id==='menu-select') this.changerMenu(e.target.value);
      if(e.target.id==='extra-aliment') this.majModeExtra();
      if(e.target.id==='extra-cat') this.remplirPickerAliments();
      if(e.target.id==='plat-aliment') this.majUnitePlat();
      if(e.target.id==='bes-sexe' || e.target.id==='bes-age' || e.target.id==='bes-stature') this.majProfilDepuisChamps();
    });
    root.addEventListener('input', e => {
      if(e.target.id==='menu-nom') this.renommerMenu(e.target.value);
      if(e.target.id==='extra-recherche') this.remplirPickerAliments();
      if(e.target.id==='plat-recherche') this.remplirPlatPicker();
      if(e.target.id==='extra-qte' || e.target.id==='extra-kcal' || e.target.id==='extra-prot') this.majApercuExtra();
      if(e.target.id==='bes-age' || e.target.id==='bes-stature') this.renderBesoinsResultat();   /* aperçu live */
    });
    $('obj-kcal').addEventListener('change', () => this.majObjectif());
  }

  /* ---- calculs nutritionnels (moteur pur dans nutrition.js) ---- */
  qteAjustee(cle, qBase){
    if(!ALIMENTS[cle].flex) return qBase;
    const q = qBase * facteurFlex(this.etat.objectifKcal, this.planActif());
    return Math.round(q/5)*5; /* arrondi à 5 g */
  }
  repasKcal(r){ return r.items.reduce((s,[cle,q])=>s+kcalItem(cle, this.qteAjustee(cle,q)),0); }
  repasProt(r){ return r.items.reduce((s,[cle,q])=>s+protItem(cle, this.qteAjustee(cle,q)),0); }
  repasGluc(r){ return r.items.reduce((s,[cle,q])=>s+glucItem(cle, this.qteAjustee(cle,q)),0); }
  repasLip(r){  return r.items.reduce((s,[cle,q])=>s+lipItem(cle,  this.qteAjustee(cle,q)),0); }
  repasFib(r){  return r.items.reduce((s,[cle,q])=>s+fibItem(cle,  this.qteAjustee(cle,q)),0); }

  /* cible du jour : kcal = objectif réglé ; macros = ce que le plan délivre (flex ajusté) */
  cibles(){
    const m = macrosCible(this.etat.objectifKcal, this.planActif());
    return { kcal:this.etat.objectifKcal, prot:m.prot, gluc:m.gluc, lip:m.lip, fib:m.fib };
  }

  /* ---- journal du jour (= réalité) ---- */
  journalDuJour(){ const j=this.etat.repas.jour; return this.etat.journalRepas.filter(e=>e.date===j); }
  extrasDuJour(){ return this.journalDuJour().filter(e=>e.horsPlan); }
  consomme(){
    /* anciennes entrées sans gluc/lip/fib (legacy V3.1−) → comptées 0, jamais NaN */
    return this.journalDuJour().reduce((s,e)=>({
      kcal:s.kcal+(e.kcal||0), prot:s.prot+(e.prot||0),
      gluc:s.gluc+(e.gluc||0), lip:s.lip+(e.lip||0), fib:s.fib+(e.fib||0),
    }), {kcal:0,prot:0,gluc:0,lip:0,fib:0});
  }

  /* ---- cochage : un tap prend le repas (ne décoche jamais) ; bouton Annuler explicite ---- */
  prendreRepas(id){
    this.store.resetSiNouveauJour();
    if(!this.etat.repas.coches[id]){ this.etat.repas.coches[id] = true; this.journaliserRepas(id); this.store.sauver(); this.render(); }
  }
  annulerRepas(id){
    this.store.resetSiNouveauJour();
    if(this.etat.repas.coches[id]){ delete this.etat.repas.coches[id]; this.deJournaliserRepas(id); this.store.sauver(); this.render(); }
  }

  /* repas du PLAN coché → on suppose qu'il a été mangé tel que planifié (quantités ajustées).
     Pour TOUT écart (resto, substitution), passer par « J'ai mangé autre chose » ci-dessous. */
  journaliserRepas(id){
    const r = this.plan().find(x=>x.id===id); if(!r) return;
    const jour = this.etat.repas.jour;
    this.etat.journalRepas = this.etat.journalRepas.filter(e=>!(e.date===jour && e.id===id));
    const items = r.items.map(([cle,qBase])=>{
      const a = ALIMENTS[cle]; const q = this.qteAjustee(cle,qBase);
      return { cle, nom:a.nom, qte:q, unite: a.unite!==undefined ? (a.unite||'unité') : 'g' };
    });
    this.etat.journalRepas.push({ date:jour, id, nom:r.nom,
      kcal:Math.round(this.repasKcal(r)), prot:Math.round(this.repasProt(r)),
      gluc:Math.round(this.repasGluc(r)), lip:Math.round(this.repasLip(r)), fib:Math.round(this.repasFib(r)),
      objectifKcal:this.etat.objectifKcal, items });
  }
  deJournaliserRepas(id){
    const jour = this.etat.repas.jour;
    this.etat.journalRepas = this.etat.journalRepas.filter(e=>!(e.date===jour && e.id===id));
  }

  /* ---- hors-plan : journalise la RÉALITÉ (corrige le mensonge de l'export) ---- */
  ajouterExtra(d){
    if((d.kcal||0)<=0 && (d.prot||0)<=0) return;
    this.store.resetSiNouveauJour();
    const jour = this.etat.repas.jour;
    const id = 'x-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    const item = { cle:d.cle||null, nom:d.nom, qte:d.qte!=null?d.qte:null, unite:d.unite||'' };
    this.etat.journalRepas.push({ date:jour, id, nom:d.nom, horsPlan:true,
      kcal:Math.round(d.kcal)||0, prot:Math.round(d.prot)||0,
      gluc:Math.round(d.gluc)||0, lip:Math.round(d.lip)||0, fib:Math.round(d.fib)||0,
      objectifKcal:this.etat.objectifKcal, items:[item] });
    this.store.sauver(); this.render();
  }
  ajouterExtraAliment(cle, qte){
    const cat = this.cat();
    const a = cat[cle]; if(!a || !(qte>0)) return;
    const unite = a.unite!==undefined ? (a.unite||'unité') : 'g';
    this.ajouterExtra({ cle, nom:a.nom, qte, unite,
      kcal:kcalItem(cle,qte,cat), prot:protItem(cle,qte,cat),
      gluc:glucItem(cle,qte,cat), lip:lipItem(cle,qte,cat), fib:fibItem(cle,qte,cat) });
  }
  supprimerExtra(id){
    const jour = this.etat.repas.jour;
    this.etat.journalRepas = this.etat.journalRepas.filter(e=>!(e.date===jour && e.id===id));
    this.store.sauver(); this.render();
  }
  ajouterDepuisForm(){
    const cle = $('extra-aliment').value;
    if(cle){
      const qte = parseFloat($('extra-qte').value);
      if(!(qte>0)){ $('extra-qte').focus(); return; }
      this.ajouterExtraAliment(cle, qte);
    } else {
      const nom = ($('extra-nom').value||'').trim() || 'Hors-plan';
      const kcal = parseFloat($('extra-kcal').value)||0;
      const prot = parseFloat($('extra-prot').value)||0;
      if(kcal<=0 && prot<=0){ $('extra-kcal').focus(); return; }
      this.ajouterExtra({ nom, kcal, prot });
    }
    ['extra-qte','extra-nom','extra-kcal','extra-prot'].forEach(id=>{ $(id).value=''; });
    $('extra-aliment').value=''; this.majModeExtra();
  }

  /* suggestions pour combler le déficit protéique restant (data déjà dans ALIMENTS) */
  suggestionsProteine(resteProt){
    return ['whey','skyr','poulet'].map(cle=>{
      const a = ALIMENTS[cle];
      let qte, prot, kcal, unite;
      if(a.unite!==undefined){
        qte = Math.max(1, Math.round(resteProt / a.protU));
        unite = a.unite||'unité'; prot = a.protU*qte; kcal = a.kcalU*qte;
      } else {
        qte = Math.max(20, Math.round((resteProt / a.prot100 * 100)/10)*10);   /* arrondi 10 g */
        unite = 'g'; prot = a.prot100*qte/100; kcal = a.kcal100*qte/100;
      }
      return { cle, nom:a.nom, qte, unite, prot:Math.round(prot), kcal:Math.round(kcal) };
    });
  }

  /* ---- formulaire hors-plan ---- */
  basculerFormExtra(){
    const ouvert = $('extra-form').classList.toggle('cache') === false;
    $('btn-extra-toggle').textContent = ouvert ? '✕ Fermer' : '+ Ajouter un aliment hors-plan';
    if(ouvert) this.majModeExtra();
  }
  majModeExtra(){
    const cle = $('extra-aliment').value;
    const a = cle ? this.cat()[cle] : null;
    $('extra-aliment-q').classList.toggle('cache', !cle);
    $('extra-libre').classList.toggle('cache', !!cle);
    if(a) $('extra-unite').textContent = a.unite!==undefined ? (a.unite||'unité') : 'g';
    this.majApercuExtra();
  }
  majApercuExtra(){
    const cle = $('extra-aliment').value;
    let kcal=0, prot=0, ok=false;
    if(cle){
      const qte = parseFloat($('extra-qte').value);
      if(qte>0){ const cat=this.cat(); kcal=kcalItem(cle,qte,cat); prot=protItem(cle,qte,cat); ok=true; }
    } else {
      const k=parseFloat($('extra-kcal').value), p=parseFloat($('extra-prot').value);
      kcal=k||0; prot=p||0; ok=(k>0||p>0);
    }
    $('extra-apercu').textContent = ok ? `≈ ${Math.round(kcal)} kcal · ${Math.round(prot)} g protéines` : '';
  }

  /* ---- picker hors-plan : recherche + filtre catégorie (base curée + perso, E2) ---- */
  remplirFiltreCategories(){
    const sel = $('extra-cat'); if(!sel) return;
    const courant = sel.value;
    sel.innerHTML = '<option value="">Toutes</option>'
      + categoriesPresentes(this.perso()).map(c=>`<option value="${echap(c)}">${echap(c)}</option>`).join('');
    if(courant) sel.value = courant;
  }
  remplirPickerAliments(){
    const sel = $('extra-aliment'); if(!sel) return;
    const terme = ($('extra-recherche') && $('extra-recherche').value) || '';
    const cat = ($('extra-cat') && $('extra-cat').value) || '';
    const courant = sel.value;
    const liste = rechercher({ terme, cat }, this.perso());
    sel.innerHTML = '<option value="">— Saisie libre (resto, plat composé…) —</option>'
      + liste.map(a=>{
          const dens = a.unite!==undefined ? `${a.protU} g prot/${a.unite||'u'}` : `${a.prot100} g prot/100 g`;
          return `<option value="${echap(a.cle)}">${echap(a.nom)}${a.perso?' ★':''} — ${dens}</option>`;
        }).join('');
    /* conserve la sélection courante si toujours présente, sinon retombe en saisie libre */
    sel.value = (courant && liste.some(a=>a.cle===courant)) ? courant : '';
    this.majModeExtra();
  }

  /* ---- objectif kcal ---- */
  majObjectif(){
    const v = parseInt($('obj-kcal').value,10);
    if(!isNaN(v)) this.etat.objectifKcal = Math.max(1600, Math.min(4000, v));
    this.store.sauver(); this.render();
  }
  ajusterObjectif(delta){
    this.etat.objectifKcal = Math.max(1600, Math.min(4000, this.etat.objectifKcal + delta));
    this.store.sauver(); this.render();
  }

  /* ================= ÉDITEUR D'ALIMENTS PERSO (E2) =================
     Complète la base curée. Stocké dans etat.aliments.perso = {cle: {nom, cat, macros/100g}}.
     Disponible aussitôt dans le picker hors-plan. kcal saisies ou dérivées par Atwater. */
  basculerPerso(){
    this.persoOuvert = !this.persoOuvert;
    $('perso-form').classList.toggle('cache', !this.persoOuvert);
    $('btn-perso-toggle').setAttribute('aria-expanded', String(this.persoOuvert));
    $('btn-perso-toggle').textContent = this.persoOuvert ? '✕ Fermer' : 'Gérer mes aliments';
    if(this.persoOuvert) this.renderPerso();
  }

  /* lit le formulaire perso ; kcal vide → dérivée Atwater (4·prot + 4·gluc + 9·lip) */
  _lirePersoForm(){
    const nb = id => { const v = parseFloat($(id).value); return Number.isFinite(v) && v>=0 ? v : 0; };
    const nom = ($('perso-nom').value||'').trim();
    const cat = $('perso-cat').value || 'Compléments';
    const prot=nb('perso-prot'), gluc=nb('perso-gluc'), lip=nb('perso-lip'), fib=nb('perso-fib');
    const kcalSaisi = parseFloat($('perso-kcal').value);
    const kcal100 = Number.isFinite(kcalSaisi) && kcalSaisi>=0 ? kcalSaisi : Math.round(4*prot + 4*gluc + 9*lip);
    return { nom, cat, kcal100, prot100:prot, gluc100:gluc, lip100:lip, fib100:fib };
  }
  sauverPerso(){
    const d = this._lirePersoForm();
    if(!d.nom){ $('perso-nom').focus(); toast('Donne un nom à ton aliment.', 'erreur'); return; }
    const perso = this.etat.aliments.perso;
    /* édition : on garde la clé ; création : clé dérivée du nom, dé-collisionnée */
    let cle = this.persoEdit;
    if(!cle){
      const base = slug(d.nom); cle = base; let n = 2;
      while(perso[cle] || ALIMENTS[cle]) cle = `${base}-${n++}`;
    }
    perso[cle] = d;
    this.persoEdit = null;
    this.store.sauver();
    this._resetPersoForm();
    this.remplirFiltreCategories();
    this.remplirPickerAliments();
    this.renderPerso();
    toast('Aliment enregistré.', 'ok');
  }
  editerPerso(cle){
    const a = this.perso()[cle]; if(!a) return;
    this.persoEdit = cle;
    if(!this.persoOuvert) this.basculerPerso();
    $('perso-nom').value = a.nom || '';
    $('perso-cat').value = a.cat || 'Compléments';
    $('perso-kcal').value = a.kcal100 ?? '';
    $('perso-prot').value = a.prot100 ?? '';
    $('perso-gluc').value = a.gluc100 ?? '';
    $('perso-lip').value = a.lip100 ?? '';
    $('perso-fib').value = a.fib100 ?? '';
    $('btn-perso-save').textContent = 'Enregistrer les modifications';
    $('btn-perso-annuler').classList.remove('cache');
    $('perso-nom').focus();
  }
  annulerEditPerso(){ this.persoEdit = null; this._resetPersoForm(); }
  _resetPersoForm(){
    ['perso-nom','perso-kcal','perso-prot','perso-gluc','perso-lip','perso-fib'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
    const sc=$('perso-cat'); if(sc) sc.selectedIndex=0;
    $('btn-perso-save').textContent = 'Ajouter l\'aliment';
    $('btn-perso-annuler').classList.add('cache');
  }
  supprimerPerso(cle){
    if(!this.perso()[cle]) return;
    delete this.etat.aliments.perso[cle];
    if(this.persoEdit===cle){ this.persoEdit=null; this._resetPersoForm(); }
    this.store.sauver();
    this.remplirFiltreCategories();
    this.remplirPickerAliments();
    this.renderPerso();
  }
  renderPerso(){
    const el = $('perso-liste'); if(!el) return;
    const perso = this.perso();
    const cles = Object.keys(perso).sort((a,b)=>perso[a].nom.localeCompare(perso[b].nom));
    if(!cles.length){ el.innerHTML = '<p class="note" style="margin:12px 0 0">Aucun aliment perso. Ajoute-en un ci-dessus — il apparaîtra aussitôt dans la recherche.</p>'; return; }
    el.innerHTML = '<div class="perso-items">' + cles.map(cle=>{
      const a = perso[cle];
      return `<div class="perso-item">
        <div class="perso-info"><span class="perso-nom">${echap(a.nom)}</span>
          <span class="perso-macros mono">${Math.round(a.kcal100)} kcal · P ${a.prot100} · G ${a.gluc100} · L ${a.lip100} · F ${a.fib100} /100 g</span>
          <span class="perso-cat">${echap(a.cat)}</span></div>
        <div class="perso-btns">
          <button type="button" class="chip-mini" data-action="perso-editer" data-cle="${echap(cle)}">Modifier</button>
          <button type="button" class="repas-annuler" data-action="perso-suppr" data-cle="${echap(cle)}" aria-label="Supprimer">✕</button>
        </div></div>`;
    }).join('') + '</div>';
  }

  /* ================= PLATS COMPOSÉS (E4) =================
     Recette réutilisable = liste de composants [[cle,qté],…] ; ses macros sont dérivées
     des composants (catalogue fusionné base+perso). Un plat se journalise d'un tap. */
  platsListe(){ return this.etat.plats || []; }

  basculerPlats(){
    this.platsOuvert = !this.platsOuvert;
    $('plat-form').classList.toggle('cache', !this.platsOuvert);
    $('btn-plats-toggle').setAttribute('aria-expanded', String(this.platsOuvert));
    $('btn-plats-toggle').textContent = this.platsOuvert ? '✕ Fermer' : 'Gérer mes plats';
    if(this.platsOuvert){ this.remplirPlatPicker(); this.renderPlatEditeur(); }
    this.renderPlatsActifs();
  }

  /* picker de composants : liste d'aliments filtrée par la recherche (base + perso) */
  remplirPlatPicker(){
    const sel = $('plat-aliment'); if(!sel) return;
    const terme = ($('plat-recherche') && $('plat-recherche').value) || '';
    const courant = sel.value;
    const liste = rechercher({ terme }, this.perso());
    sel.innerHTML = liste.map(a=>{
      const u = a.unite!==undefined ? (a.unite||'unité') : '100 g';
      return `<option value="${echap(a.cle)}">${echap(a.nom)}${a.perso?' ★':''} — /${u}</option>`;
    }).join('');
    if(courant && liste.some(a=>a.cle===courant)) sel.value = courant;
    this.majUnitePlat();
  }
  majUnitePlat(){
    const cle = $('plat-aliment').value;
    const a = cle ? this.cat()[cle] : null;
    $('plat-unite').textContent = a ? (a.unite!==undefined ? (a.unite||'unité') : 'g') : 'g';
  }
  ajouterComposant(){
    const cle = $('plat-aliment').value;
    const qte = parseFloat($('plat-qte').value);
    if(!cle || !this.cat()[cle]){ return; }
    if(!(qte>0)){ $('plat-qte').focus(); return; }
    /* même aliment déjà présent → on cumule la quantité */
    const i = this.platComposants.findIndex(([c])=>c===cle);
    if(i>=0) this.platComposants[i][1] += qte; else this.platComposants.push([cle, qte]);
    $('plat-qte').value='';
    this.renderPlatEditeur();
  }
  retirerComposant(i){
    if(i>=0 && i<this.platComposants.length){ this.platComposants.splice(i,1); this.renderPlatEditeur(); }
  }
  sauverPlat(){
    const nom = ($('plat-nom').value||'').trim();
    if(!nom){ $('plat-nom').focus(); toast('Donne un nom à ton plat.', 'erreur'); return; }
    if(!this.platComposants.length){ toast('Ajoute au moins un composant.', 'erreur'); return; }
    const plats = this.etat.plats;
    let id = this.platEdit;
    if(!id){
      const base = 'plat-'+slug(nom); id = base; let n = 2;
      while(plats.some(p=>p.id===id)) id = `${base}-${n++}`;
    }
    const composants = this.platComposants.map(([c,q])=>[c,q]);
    const i = plats.findIndex(p=>p.id===id);
    if(i>=0) plats[i] = { ...plats[i], nom, composants }; else plats.push({ id, nom, composants });
    this.platEdit = null; this.platComposants = [];
    this.store.sauver();
    this._resetPlatForm();
    this.renderPlatEditeur();
    this.renderPlatsActifs();
    toast('Plat enregistré.', 'ok');
  }
  editerPlat(id){
    const p = this.platsListe().find(x=>x.id===id); if(!p) return;
    this.platEdit = id;
    this.platComposants = p.composants.map(([c,q])=>[c,q]);
    if(!this.platsOuvert) this.basculerPlats();
    $('plat-nom').value = p.nom;
    $('btn-plat-save').textContent = 'Enregistrer les modifications';
    $('btn-plat-annuler').classList.remove('cache');
    this.renderPlatEditeur();
    $('plat-nom').focus();
  }
  annulerEditPlat(){ this.platEdit = null; this.platComposants = []; this._resetPlatForm(); this.renderPlatEditeur(); }
  _resetPlatForm(){
    $('plat-nom').value=''; $('plat-qte').value='';
    $('btn-plat-save').textContent = 'Enregistrer le plat';
    $('btn-plat-annuler').classList.add('cache');
  }
  supprimerPlat(id){
    if(!this.platsListe().some(p=>p.id===id)) return;
    this.etat.plats = this.etat.plats.filter(p=>p.id!==id);
    if(this.platEdit===id) this.annulerEditPlat();
    this.store.sauver();
    this.renderPlatsActifs();
  }
  /* journalise un plat : entrée hors-plan agrégeant les macros de ses composants */
  loggerPlat(id){
    const p = this.platsListe().find(x=>x.id===id); if(!p) return;
    const cat = this.cat();
    const m = macrosPlat(p.composants, cat);
    if(m.kcal<=0 && m.prot<=0){ toast('Ce plat n’a aucune macro exploitable.', 'erreur'); return; }
    this.store.resetSiNouveauJour();
    const jour = this.etat.repas.jour;
    const idj = 'x-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    const items = p.composants.filter(([c])=>cat[c]).map(([c,q])=>{
      const a = cat[c]; const unite = a.unite!==undefined ? (a.unite||'unité') : 'g';
      return { cle:c, nom:a.nom, qte:q, unite };
    });
    this.etat.journalRepas.push({ date:jour, id:idj, nom:p.nom, horsPlan:true, plat:true,
      kcal:Math.round(m.kcal), prot:Math.round(m.prot), gluc:Math.round(m.gluc), lip:Math.round(m.lip), fib:Math.round(m.fib),
      objectifKcal:this.etat.objectifKcal, items });
    this.store.sauver(); this.render();
    toast(`« ${p.nom} » ajouté au journal.`, 'ok');
  }
  renderPlatEditeur(){
    const el = $('plat-comp-liste'); if(!el) return;
    const cat = this.cat();
    if(!this.platComposants.length){
      el.innerHTML = '<p class="note" style="margin:8px 0">Aucun composant. Cherche un aliment, saisis la quantité, puis « Ajouter ce composant ».</p>';
    } else {
      el.innerHTML = '<div class="plat-comps">' + this.platComposants.map(([c,q],i)=>{
        const a = cat[c]; const nom = a ? a.nom : c;
        const unite = a && a.unite!==undefined ? (a.unite||'unité') : 'g';
        return `<div class="plat-comp"><span class="plat-comp-nom">${echap(nom)}</span>`
          + `<span class="plat-comp-qte mono">${q} ${unite}</span>`
          + `<button type="button" class="repas-annuler" data-action="plat-comp-del" data-i="${i}" aria-label="Retirer">✕</button></div>`;
      }).join('') + '</div>';
    }
    const m = macrosPlat(this.platComposants, cat);
    $('plat-total').textContent = this.platComposants.length
      ? `Total : ${Math.round(m.kcal)} kcal · P ${Math.round(m.prot)} · G ${Math.round(m.gluc)} · L ${Math.round(m.lip)} · F ${Math.round(m.fib)} g`
      : '';
  }
  renderPlatsActifs(){
    const el = $('plats-actifs'); if(!el) return;
    const plats = this.platsListe();
    const cat = this.cat();
    if(!plats.length){ el.innerHTML = '<p class="note" style="margin:0 0 10px">Aucun plat. Crée-en un via « Gérer mes plats » pour le journaliser d’un tap.</p>'; return; }
    el.innerHTML = plats.map(p=>{
      const m = macrosPlat(p.composants, cat);
      const gestion = this.platsOuvert
        ? `<button type="button" class="chip-mini" data-action="plat-editer" data-id="${echap(p.id)}">Modifier</button>`
          + `<button type="button" class="repas-annuler" data-action="plat-suppr" data-id="${echap(p.id)}" aria-label="Supprimer">✕</button>`
        : '';
      return `<div class="plat-item">
        <div class="perso-info"><span class="perso-nom">${echap(p.nom)}</span>
          <span class="perso-macros mono">${Math.round(m.kcal)} kcal · P ${Math.round(m.prot)} · G ${Math.round(m.gluc)} · L ${Math.round(m.lip)} g · ${p.composants.length} compos.</span></div>
        <div class="perso-btns">
          <button type="button" class="chip chip-prot" data-action="plat-log" data-id="${echap(p.id)}">+ Au journal</button>
          ${gestion}
        </div></div>`;
    }).join('');
  }

  /* ================= CALCULATEUR DE BESOINS (E5) =================
     Profil (sexe/âge/stature) + objectif + poids et activité déduits → cible kcal/macros.
     Le poids vient de la dernière moyenne hebdo (repli : dernière pesée) ; l'activité de
     la fréquence réelle des séances. La cible calculée alimente `objectifKcal`/`objectif`. */

  /* poids de référence (kg) : dernière moyenne hebdo, sinon dernière pesée, sinon null */
  poidsReference(){
    const moy = moyennesHebdo(this.etat.poids);
    if(moy.length) return Math.round(moy[moy.length-1].kg * 10) / 10;
    const p = this.etat.poids;
    return p.length ? p[p.length-1].kg : null;
  }
  seancesParSemaine(){ return frequenceHebdo(this.etat.seances, aujourdHui(), 4); }
  objectifCourant(){
    const t = this.etat.objectif && this.etat.objectif.type;
    return OBJECTIFS.includes(t) ? t : 'recompo';
  }
  /* assemble les entrées et délègue au moteur pur */
  calculBesoins(){
    const prof = this.etat.profil || {};
    return calculerBesoins({
      sexe: prof.sexe, age: prof.age, stature: prof.stature,
      poids: this.poidsReference(), objectif: this.objectifCourant(),
      seancesParSemaine: this.seancesParSemaine(),
    });
  }

  basculerBesoins(){
    this.besoinsOuvert = !this.besoinsOuvert;
    $('besoins-form').classList.toggle('cache', !this.besoinsOuvert);
    $('btn-besoins-toggle').setAttribute('aria-expanded', String(this.besoinsOuvert));
    $('btn-besoins-toggle').textContent = this.besoinsOuvert ? '✕ Fermer' : 'Calculer mes besoins';
    if(this.besoinsOuvert) this.renderBesoins();
  }

  /* champs profil → état (persisté), puis rafraîchit l'aperçu */
  majProfilDepuisChamps(){
    const prof = this.etat.profil || (this.etat.profil = { sexe:null, age:null, stature:null });
    const sexe = $('bes-sexe').value;
    prof.sexe = (sexe==='homme'||sexe==='femme') ? sexe : null;
    const age = parseInt($('bes-age').value, 10);
    prof.age = Number.isFinite(age) ? age : null;
    const st = parseInt($('bes-stature').value, 10);
    prof.stature = Number.isFinite(st) ? st : null;
    this.store.sauver();
    this.renderBesoinsResultat();
  }
  choisirObjectif(type){
    if(!OBJECTIFS.includes(type)) return;
    if(!this.etat.objectif || typeof this.etat.objectif!=='object') this.etat.objectif = {};
    this.etat.objectif.type = type;
    this.store.sauver();
    this.renderBesoins();   /* met à jour les chips actifs + l'aperçu */
  }
  appliquerBesoins(){
    const r = this.calculBesoins();
    if(!r.valide){
      const lib = { sexe:'le sexe', age:'l’âge', stature:'la taille', poids:'une pesée' };
      toast('Renseigne ' + r.manque.map(m=>lib[m]||m).join(', ') + ' pour calculer.', 'erreur');
      return;
    }
    this.etat.objectif = { type:r.objectif, cibleKcal:r.kcal, cibleMacros:r.macros };
    this.etat.objectifKcal = Math.max(1600, Math.min(4000, r.kcal));
    this.store.sauver();
    toast(`Objectif appliqué : ${this.etat.objectifKcal} kcal/j.`, 'ok');
    this.render();   /* met à jour le stepper kcal + la cible du jour */
  }

  /* prérenseigne les champs depuis le profil (sauf si en cours d'édition) + chips + aperçu */
  renderBesoins(){
    if(!this.besoinsOuvert) return;
    const prof = this.etat.profil || {};
    const set = (id, v) => { const el=$(id); if(el && document.activeElement!==el) el.value = (v==null?'':v); };
    set('bes-sexe', prof.sexe);
    set('bes-age', prof.age);
    set('bes-stature', prof.stature);
    const actif = this.objectifCourant();
    document.querySelectorAll('#bes-objectif [data-obj]').forEach(b =>
      b.classList.toggle('actif', b.dataset.obj === actif));
    this.renderBesoinsResultat();
  }
  renderBesoinsResultat(){
    const el = $('bes-resultat'); if(!el) return;
    const r = this.calculBesoins();
    if(!r.valide){
      const lib = { sexe:'sexe', age:'âge', stature:'taille (cm)', poids:'une pesée' };
      el.innerHTML = `<p class="note" style="margin:0">Renseigne ${r.manque.map(m=>lib[m]||m).join(', ')} pour obtenir une cible.</p>`;
      return;
    }
    const poids = this.poidsReference();
    const sem = Math.round(this.seancesParSemaine() * 10) / 10;
    const objLib = { seche:'Sèche', recompo:'Recompo', masse:'Prise de masse' }[r.objectif];
    el.innerHTML = `
      <div class="bes-res-kcal mono">≈ <b>${r.kcal}</b> kcal/jour <span class="bes-res-obj">· ${objLib}</span></div>
      <div class="bes-res-macros mono">Prot <b>${r.macros.proteines} g</b> · Lip <b>${r.macros.lipides} g</b> · Gluc <b>${r.macros.glucides} g</b> · Fibres ${r.macros.fibres} g</div>
      <div class="note" style="margin:6px 0 0">BMR ${r.bmr} × activité ${r.facteur} (≈ ${sem} séance${sem>1?'s':''}/sem) → TDEE ${r.tdee} kcal · poids pris : ${poids} kg.</div>`;
  }

  /* ---- affichage ---- */
  render(){
    this.store.resetSiNouveauJour();
    this.renderMenu();   /* multi-menus (E1) : sélecteur + nom du menu actif */
    const obj = $('obj-kcal');
    if(document.activeElement!==obj) obj.value = this.etat.objectifKcal;
    this.renderBesoins();   /* calculateur (E5) : rafraîchit l'aperçu si déplié */
    if(this.persoOuvert) this.renderPerso();   /* éditeur d'aliments perso (E2) */
    this.renderPlatsActifs();                  /* plats composés (E4) : liste « tap pour journaliser » */

    /* avertissement de saturation du facteur flex (le plan ne peut plus s'ajuster) */
    const sat = flexSature(this.etat.objectifKcal, this.planActif());
    const fw = $('flex-warn');
    if(sat==='bas'){
      fw.classList.remove('cache');
      fw.innerHTML = '⚠ Objectif très bas : riz/avoine déjà au minimum (×0,4). Le plan ne descend pas plus — le total réel restera <b>au-dessus</b> de la cible.';
    } else if(sat==='haut'){
      fw.classList.remove('cache');
      fw.innerHTML = '⚠ Objectif très haut : riz/avoine déjà au maximum (×1,8). Le plan ne monte pas plus — complète avec un ajout hors-plan pour atteindre la cible.';
    } else fw.classList.add('cache');

    /* cartes repas : mode normal (tap pour prendre) OU mode réorganisation (déplacer les aliments) */
    const plan = this.plan();
    $('btn-repas-reorg').textContent = this.reorgOuvert ? '✓ Terminer' : '⇄ Réorganiser les repas';
    const bar = $('repas-reorg-bar');
    if(this.reorgOuvert){
      bar.classList.remove('cache');
      bar.innerHTML = this.htmlReorgBar();
      $('liste-repas').innerHTML = plan.map(r=>this.htmlCarteReorg(r)).join('');
    } else {
      bar.classList.add('cache');
      $('liste-repas').innerHTML = plan.map(r=>this.htmlCarteNormale(r)).join('');
    }

    /* cible & écart (kcal + protéines), à partir de la réalité du jour */
    const c = this.cibles();
    const conso = this.consomme();
    const resteK = Math.round(c.kcal - conso.kcal);
    const resteP = Math.round(c.prot - conso.prot);
    $('cible-kcal').textContent = `${Math.round(conso.kcal)} / ${c.kcal} kcal`;
    $('cible-prot').textContent = `${Math.round(conso.prot)} / ${c.prot} g`;
    $('bar-kcal').style.width = (c.kcal ? Math.min(100, 100*conso.kcal/c.kcal) : 0).toFixed(0)+'%';
    $('bar-prot').style.width = (c.prot ? Math.min(100, 100*conso.prot/c.prot) : 0).toFixed(0)+'%';
    this._reste($('reste-kcal'), resteK, '');
    this._reste($('reste-prot'), resteP, ' g');

    /* répartition macros complètes (E3) : glucides / lipides / fibres consommés / cible */
    $('cible-macros').innerHTML = [
      this._macroMini('Glucides', conso.gluc, c.gluc),
      this._macroMini('Lipides',  conso.lip,  c.lip),
      this._macroMini('Fibres',   conso.fib,  c.fib),
    ].join('');

    const prisN = plan.filter(r=>this.etat.repas.coches[r.id]).length;
    $('cible-repas').textContent = `${prisN} / ${plan.length} repas du plan cochés`;

    /* comblement protéique : seulement s'il reste un vrai déficit */
    const carteC = $('carte-comblement');
    if(resteP >= 10){
      carteC.classList.remove('cache');
      $('comblement-txt').textContent = `Il te manque ~${resteP} g de protéines. Une de ces options comble l'écart (tape pour l'ajouter) :`;
      $('comblement-options').innerHTML = this.suggestionsProteine(resteP).map(s=>
        `<button type="button" class="chip chip-prot" data-action="combler" data-cle="${s.cle}" data-qte="${s.qte}">`
        + `${echap(s.nom)} · <b>${s.qte} ${s.unite}</b> · +${s.prot} g · ${s.kcal} kcal</button>`).join('');
    } else carteC.classList.add('cache');

    /* extras hors-plan du jour */
    const extras = this.extrasDuJour();
    $('extras-liste').innerHTML = extras.length ? extras.map(e=>{
      const it = e.items && e.items[0];
      /* plat composé : on indique le nombre de composants ; sinon la quantité de l'aliment */
      const q = (e.items && e.items.length>1)
        ? ` · ${e.items.length} aliments`
        : (it && it.qte!=null ? ` · ${it.qte} ${it.unite||''}`.trimEnd() : '');
      return `<div class="extra-item">
        <div class="extra-info"><span class="extra-nom">${echap(e.nom)}</span>`
        + `<span class="extra-macros mono">${e.kcal} kcal · ${e.prot} g${q}</span></div>`
        + `<button type="button" class="repas-annuler" data-action="suppr-extra" data-id="${e.id}" aria-label="Retirer">✕</button>`
        + `</div>`;
    }).join('') : '<p class="note" style="margin:0 0 10px">Rien d’ajouté hors-plan aujourd’hui.</p>';
  }

  /* ---- carte repas normale (tap pour prendre / annuler) ---- */
  htmlCarteNormale(r){
    const pris = !!this.etat.repas.coches[r.id];
    const items = r.items.map(([cle,qBase])=>{
      const a=ALIMENTS[cle]; const q=this.qteAjustee(cle,qBase);
      const lib = a.unite!==undefined ? `${q} ${a.unite}${q>1&&a.unite?'s':''}`.trim() : `${q} g`;
      return `<li><span>${a.nom}</span><span class="qte${a.flex?' flex':''}">${lib}</span></li>`;
    }).join('');
    return `<div class="repas-carte${pris?' pris':''}" role="button" tabindex="0" aria-pressed="${pris}"
       data-action="prendre-repas" data-id="${r.id}">
       <div class="repas-haut">
         <span class="repas-coche">${pris?'✓':''}</span>
         <span class="repas-nom">${echap(r.nom)}</span>
         ${pris
            ? `<button type="button" class="repas-annuler" data-action="annuler-repas" data-id="${r.id}">Annuler</button>`
            : `<span class="repas-kcal">${Math.round(this.repasKcal(r))} kcal</span>`}
       </div>
       <ul class="repas-items">${items}</ul>
    </div>`;
  }

  /* ---- bandeau du mode réorganisation : portée du déplacement (plan / aujourd'hui) ---- */
  htmlReorgBar(){
    const p = this.porteeDepl;
    return `<div class="reorg-scope">
        <span class="reorg-lbl">Déplacer&nbsp;:</span>
        <button type="button" class="chip-mini${p==='plan'?' actif':''}" data-action="depl-portee" data-portee="plan">Dans le plan</button>
        <button type="button" class="chip-mini${p==='jour'?' actif':''}" data-action="depl-portee" data-portee="jour">Aujourd'hui</button>
      </div>
      <p class="note reorg-note">${p==='plan'
        ? 'Modifie ton plan pour de bon. Touche un aliment, puis choisis son nouveau repas.'
        : 'Vaut seulement pour aujourd’hui (remis à zéro demain). Touche un aliment, puis choisis son repas.'}</p>`;
  }

  /* ---- carte repas en mode réorganisation : chaque aliment se déplace vers un autre repas ----
     Un repas déjà pris est verrouillé (déjà journalisé) : ni source ni cible, pour ne pas
     compter deux fois un aliment. */
  htmlCarteReorg(r){
    const pris = !!this.etat.repas.coches[r.id];
    const plan = this.plan();
    const items = r.items.map(([cle,qBase])=>{
      const a = ALIMENTS[cle]; const q = this.qteAjustee(cle,qBase);
      const lib = a.unite!==undefined ? `${q} ${a.unite}${q>1&&a.unite?'s':''}`.trim() : `${q} g`;
      if(pris) return `<div class="ri-bloc"><div class="ri-tete fige"><span class="ri-nom">${echap(a.nom)}</span><span class="ri-qte">${lib}</span></div></div>`;
      const ouvert = this.deplItem === r.id+':'+cle;
      let cibles = '';
      if(ouvert){
        const dispo = plan.filter(t=>t.id!==r.id && !this.etat.repas.coches[t.id] && !t.items.some(([c])=>c===cle));
        cibles = `<div class="ri-cibles">${dispo.length
          ? dispo.map(t=>`<button type="button" class="chip" data-action="depl-vers" data-from="${r.id}" data-cle="${cle}" data-to="${t.id}">→ ${echap(t.nom)}</button>`).join('')
          : '<span class="note" style="margin:0">Aucun repas dispo (déjà présent, ou repas pris).</span>'}</div>`;
      }
      return `<div class="ri-bloc${ouvert?' ouvert':''}">
        <button type="button" class="ri-tete" data-action="depl-ouvrir" data-rid="${r.id}" data-cle="${cle}" aria-expanded="${ouvert}">
          <span class="ri-nom">${echap(a.nom)}</span><span class="ri-qte">${lib}</span><span class="ri-move">⇄</span>
        </button>${cibles}
      </div>`;
    }).join('');
    return `<div class="repas-carte reorg${pris?' pris':''}">
      <div class="repas-haut"><span class="repas-nom">${echap(r.nom)}</span>${pris?'<span class="repas-kcal">pris · verrouillé</span>':''}</div>
      <div class="repas-items-reorg">${items}</div>
    </div>`;
  }

  basculerReorg(){ this.reorgOuvert = !this.reorgOuvert; this.deplItem = null; this.render(); }
  basculerDeplItem(rid, cle){ const k = rid+':'+cle; this.deplItem = this.deplItem===k ? null : k; this.render(); }

  /* déplace un aliment d'un repas à l'autre, selon la portée choisie.
     - 'jour' : agit sur une copie du plan valable aujourd'hui (planJour, créée à la volée)
     - 'plan' : agit sur les repas du menu actif (et reporte le déplacement sur planJour si
                actif, pour que la vue du jour reste cohérente). Repérage par `cle` → robuste. */
  deplacerAliment(fromId, cle, toId){
    const appliquer = repas => {
      const from = repas.find(r=>r.id===fromId), to = repas.find(r=>r.id===toId);
      if(!from || !to) return;
      const i = from.items.findIndex(([c])=>c===cle);
      if(i<0 || to.items.some(([c])=>c===cle)) return;
      to.items.push(from.items.splice(i,1)[0]);
    };
    if(this.porteeDepl==='jour'){
      if(!this.etat.repas.planJour) this.etat.repas.planJour = cloneProfond(this.planActif());
      appliquer(this.etat.repas.planJour);
    } else {
      appliquer(this.planActif());
      if(this.etat.repas.planJour) appliquer(this.etat.repas.planJour);
    }
    this.deplItem = null;
    this.store.sauver();
    this.render();
  }

  _reste(el, v, suffixe){
    el.textContent = v>0 ? `reste ${v}${suffixe}` : (v<0 ? `+${-v}${suffixe} au-dessus` : 'atteint ✓');
    el.className = 'cible-reste mono' + (v<0 ? ' depasse' : v===0 ? ' atteint' : '');
  }

  /* une mini-stat macro de la carte cible : libellé + consommé / cible (g), coloré sur l'écart */
  _macroMini(lib, conso, cible){
    const c = Math.round(conso), cb = Math.round(cible);
    const etat = cb && c>cb ? ' depasse' : (cb && c>=cb ? ' atteint' : '');
    return `<span class="macro-mini${etat}"><span class="macro-lib">${lib}</span>`
         + `<span class="macro-val">${c} / ${cb} g</span></span>`;
  }
}

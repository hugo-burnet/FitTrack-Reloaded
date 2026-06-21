import { jourLocal, cloneProfond } from './utils.js';
import { CLE, OBJ_DEFAUT } from './data.js';
import { assainirEtat } from './sanitize.js';
import { idbGet, idbSet } from './idb.js';
import { etatParDefaut } from './defaults.js';
import { migrer } from './migrations.js';

/* ================= ÉTAT & PERSISTANCE =================
   Source unique de vérité en mémoire (`this.etat`).
   Durabilité : IndexedDB en primaire (résiste à l'éviction iOS), localStorage en
   miroir de secours (lecture rapide + environnements sans IndexedDB + migration).
   Émet 'storage-error' uniquement quand AUCUNE couche de persistance n'est disponible. */
export class Store extends EventTarget {
  constructor(){
    super();
    this.etat = { poids: [], mensurations: [], repas: null, objectifKcal: OBJ_DEFAUT };
    this.storageOK = true;   /* au moins une couche persiste */
    this.idbOK = true;       /* IndexedDB opérationnel */
  }

  /* lecture localStorage (legacy / secours) : clé principale puis miroir */
  _lireLocalStorage(){
    let brut = localStorage.getItem(CLE);
    if(!brut) brut = localStorage.getItem(CLE+'-backup');
    if(!brut) return null;
    let e;
    try{ e = JSON.parse(brut); }
    catch{ try{ e = JSON.parse(localStorage.getItem(CLE+'-backup')); }catch{ return null; } }
    return (e && Array.isArray(e.poids)) ? e : null;
  }

  async charger(){
    let charge = null;
    try{
      charge = await idbGet(CLE);
      if(!charge){
        /* migration transparente : premier lancement post-IndexedDB → on récupère l'ancien
           état localStorage et on le promeut vers IndexedDB */
        const legacy = this._lireLocalStorage();
        if(legacy){ charge = legacy; try{ await idbSet(CLE, legacy); }catch{} }
      }
    }catch(err){
      /* IndexedDB indisponible (navigation privée Safari, etc.) → repli localStorage */
      this.idbOK = false;
      charge = this._lireLocalStorage();
    }

    if(charge && Array.isArray(charge.poids)) this.etat = charge;

    /* si IndexedDB est tombé ET que localStorage est aussi inutilisable, on prévient l'UI */
    if(!this.idbOK && !this._localStorageDispo()){
      this.storageOK = false;
      this.dispatchEvent(new Event('storage-error'));
    }

    /* demande de stockage persistant (best-effort ; non garanti sur iOS) */
    if(navigator.storage && navigator.storage.persist){
      try{ navigator.storage.persist(); }catch{}
    }

    /* on ne fait jamais confiance à ce qui est déjà en stockage : purge des formes invalides
       AVANT les défauts, pour qu'une collection vidée soit re-remplie par défaut juste après */
    assainirEtat(this.etat);
    migrer(this.etat);            /* versionnement de schéma (cadre des évolutions de forme) */
    this._appliquerDefauts();     /* comble les champs manquants/invalides depuis la fabrique unique */
  }

  /* valeurs par défaut pour les anciens enregistrements : ne remplace QUE ce qui est
     absent ou invalide, en puisant dans la fabrique unique etatParDefaut() — même
     source que reinitialiser(), pour qu'ils ne puissent jamais diverger (cf. T1). */
  _appliquerDefauts(){
    const def = etatParDefaut();
    const etat = this.etat;
    if(typeof etat.schema !== 'number') etat.schema = def.schema;
    if(!Array.isArray(etat.poids)) etat.poids = def.poids;
    if(!Array.isArray(etat.mensurations)) etat.mensurations = def.mensurations;
    if(!etat.profil || typeof etat.profil !== 'object') etat.profil = def.profil;
    if(!etat.objectif || typeof etat.objectif !== 'object') etat.objectif = def.objectif;
    /* aliments perso (E2) : dictionnaire {cle: {…}} ; jamais absent pour que l'éditeur écrive sereinement */
    if(!etat.aliments || typeof etat.aliments !== 'object') etat.aliments = def.aliments;
    if(!etat.aliments.perso || typeof etat.aliments.perso !== 'object') etat.aliments.perso = {};
    /* plats composés (E4) : collection de recettes réutilisables ; jamais absente */
    if(!Array.isArray(etat.plats)) etat.plats = def.plats;
    /* état du jour (V4-F1) : récup quotidienne ; jamais absent pour que la saisie écrive sereinement */
    if(!Array.isArray(etat.etatsJour)) etat.etatsJour = def.etatsJour;
    /* goûts alimentaires (générateur de menus) : jamais absent pour que la saisie écrive sereinement */
    if(!etat.preferencesAlim || typeof etat.preferencesAlim !== 'object') etat.preferencesAlim = def.preferencesAlim;
    if(!Array.isArray(etat.preferencesAlim.aimes)) etat.preferencesAlim.aimes = [];
    if(!Array.isArray(etat.preferencesAlim.evites)) etat.preferencesAlim.evites = [];
    if(typeof etat.preferencesAlim.faciliteSeulement !== 'boolean') etat.preferencesAlim.faciliteSeulement = true;
    if(!Array.isArray(etat.preferencesAlim.regimes)) etat.preferencesAlim.regimes = [];
    if(typeof etat.objectifKcal !== 'number') etat.objectifKcal = def.objectifKcal;
    if(!etat.repas || typeof etat.repas !== 'object') etat.repas = def.repas;
    if(!etat.repas.coches) etat.repas.coches = {};
    /* planJour : déplacements d'aliments valables seulement aujourd'hui (sinon null).
       Réinitialisé à minuit comme les cochages (cf. resetSiNouveauJour). */
    if(!Array.isArray(etat.repas.planJour)) etat.repas.planJour = null;
    /* multi-menus (E1) : collection ÉDITABLE + menu actif (modèle programmes/programmeActif).
       Le menu actif porte les repas (déplacement d'aliments entre repas). Défaut = PLAN de référence. */
    if(!Array.isArray(etat.plansAlim) || !etat.plansAlim.length) etat.plansAlim = def.plansAlim;
    if(!etat.planAlimActif || !etat.plansAlim.some(p=>p.id===etat.planAlimActif)) etat.planAlimActif = etat.plansAlim[0].id;
    const menuActif = etat.plansAlim.find(p=>p.id===etat.planAlimActif);
    if(!Array.isArray(menuActif.repas) || !menuActif.repas.length) menuActif.repas = def.plansAlim[0].repas;
    /* nouveaux modules : journal repas, muscu, courses */
    if(!Array.isArray(etat.journalRepas)) etat.journalRepas = def.journalRepas;
    if(!Array.isArray(etat.programmes) || !etat.programmes.length) etat.programmes = def.programmes;
    this._migrerMcGill(etat);   /* l'ancien « Circuit McGill big 3 » devient 3 gainages distincts */
    if(!etat.programmeActif || !etat.programmes.some(p=>p.id===etat.programmeActif)) etat.programmeActif = etat.programmes[0].id;
    if(!Array.isArray(etat.seances)) etat.seances = def.seances;
    if(!etat.courses || typeof etat.courses !== 'object') etat.courses = def.courses;
    if(!Array.isArray(etat.courses.items) || !etat.courses.items.length) etat.courses.items = def.courses.items;
    if(!etat.courses.coches) etat.courses.coches = {};
    if(typeof etat.courses.jours !== 'number') etat.courses.jours = 7;   /* horizon de la liste (specs 4.3) */
    /* brouillons de séance (saisie en cours, non encore enregistrée) par id de jour */
    if(!etat.brouillons || typeof etat.brouillons !== 'object') etat.brouillons = def.brouillons;
    if(typeof etat.autoExport !== 'boolean') etat.autoExport = def.autoExport;
  }

  /* remise à zéro : état vierge issu de la fabrique unique, puis persistance.
     Corrige T1 — l'ancienne remise à zéro reconstruisait un littéral incomplet
     (sans `plan`), ce qui faisait planter l'onglet Repas jusqu'au rechargement. */
  reinitialiser(){
    this.etat = etatParDefaut();
    this.sauver();
  }

  /* migration : le « Circuit McGill big 3 » (une ligne, comptée en charge) est remplacé
     in situ par ses 3 mouvements, chacun en gainage (temps + reps). Idempotent : après
     remplacement le nom ne matche plus. N'altère pas l'historique des séances déjà notées. */
  _migrerMcGill(etat){
    const splits = [
      {nom:'Curl-up (McGill big 3)',    series:3, reps:'tours', gainage:true, dureeCible:10},
      {nom:'Side plank (McGill big 3)', series:2, reps:'tours', gainage:true, dureeCible:10, unilateral:true},
      {nom:'Bird-dog (McGill big 3)',   series:3, reps:'tours', gainage:true, dureeCible:10},
    ];
    (etat.programmes||[]).forEach(p=>(p.jours||[]).forEach(j=>{
      if(!Array.isArray(j.exercices)) return;
      const i = j.exercices.findIndex(e=>e && e.nom==='Circuit McGill big 3');
      if(i>=0) j.exercices.splice(i, 1, ...cloneProfond(splits));
    }));
  }

  _localStorageDispo(){
    try{ const k='__t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }
    catch{ return false; }
  }

  sauver(){
    if(!this.storageOK) return;
    this.etat.dernierEnregistrement = new Date().toISOString();
    let json;
    try{ json = JSON.stringify(this.etat); }
    catch(err){ this.storageOK = false; this.dispatchEvent(new Event('storage-error')); return; }

    /* miroir localStorage : rapide, sert de secours anti-corruption et de repli sans IndexedDB */
    let lsOK = true;
    try{
      localStorage.setItem(CLE, json);
      localStorage.setItem(CLE+'-backup', json);
    }catch{ lsOK = false; }

    /* primaire : IndexedDB (anti-éviction). Fire-and-forget ; on capture l'état figé à écrire */
    if(this.idbOK){
      const instantane = JSON.parse(json);
      idbSet(CLE, instantane).catch(err => {
        this.idbOK = false;
        console.error('Écriture IndexedDB échouée, repli localStorage', err);
      });
    } else if(!lsOK){
      /* ni IndexedDB ni localStorage → plus aucune persistance */
      this.storageOK = false;
      this.dispatchEvent(new Event('storage-error'));
    }

    /* notifie la couche de synchro (Gist) qu'il y a du neuf à pousser (cf. specs 2.1) */
    this.dispatchEvent(new Event('change'));
  }

  /* reset par tampon de date : le cœur du "décochage à minuit" */
  resetSiNouveauJour(){
    const j = jourLocal();
    if(this.etat.repas.jour !== j){
      this.etat.repas.jour = j;
      this.etat.repas.coches = {};
      this.etat.repas.planJour = null;   /* les déplacements « aujourd'hui » expirent à minuit */
      this.sauver();
      return true;
    }
    return false;
  }
}

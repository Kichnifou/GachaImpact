/* CE QUE FAIT LE CODE :
 * Lit uniquement STORY_SOURCE.md et en génère des vues Markdown synchronisées.
 * Vérifie les identifiants, les statuts, les dépendances et l'état de l'export Word.
 * Ne modifie ni la source, ni le code du jeu, ni les archives, ni le dépôt distant.
 * Modes : génération ; --check ; --impact IDENTIFIANT ; --bloc IDENTIFIANT ; --word.
 * --word est facultatif et demande Python 3 avec python-docx.
 * Prérequis : Node.js 18 ou plus récent. Aucune dépendance npm.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath=path.join(root,'STORY_SOURCE.md');
const outDir=path.join(root,'lecture');
const args=process.argv.slice(2);
const statuses=new Set(['CONFIRME','PROPOSE','OUVERT']);
const origins=new Set(['utilisateur','assistant','v1']);
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const esc=s=>String(s).replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
const list=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
const sourceLink=b=>`[${b.id}](../STORY_SOURCE.md#${b.id.toLowerCase()})`;
const summary=b=>b.body.trim().split(/\r?\n\s*\r?\n/)[0].trim();
const note=b=>`**${b.meta.status}** · Origine : ${b.meta.origin} · ${sourceLink(b)}`;

function load(){
  if(!fs.existsSync(sourcePath)) throw new Error('STORY_SOURCE.md est introuvable à côté du dossier tools.');
  const raw=fs.readFileSync(sourcePath,'utf8').replace(/\r\n/g,'\n');
  const blocks=[];
  const rx=/<!-- BEGIN:([A-Z0-9-]+) -->\r?\n<!-- META:(.+?) -->\r?\n(?:<a id="[^"]+"><\/a>\r?\n)?## ([^\r\n]+)\r?\n([\s\S]*?)<!-- END:\1 -->/g;
  const ids=new Set();
  for(const m of raw.matchAll(rx)){
    const [,id,metaString,title,body]=m;
    let meta;
    try{meta=JSON.parse(metaString);}catch{throw new Error(`Métadonnées JSON invalides : ${id}`);}
    if(ids.has(id))throw new Error(`Identifiant dupliqué : ${id}`);
    if(!statuses.has(meta.status))throw new Error(`Statut invalide dans ${id}`);
    if(!origins.has(meta.origin))throw new Error(`Origine invalide dans ${id}`);
    if(typeof meta.kind!=='string' || !meta.kind.trim())throw new Error(`Type absent dans ${id}`);
    if(!Number.isInteger(meta.order))throw new Error(`Ordre non entier dans ${id}`);
    for(const key of ['views','period','refs'])if(typeof meta[key]!=='string')throw new Error(`Champ ${key} non textuel dans ${id}`);
    if(!body.trim())throw new Error(`Bloc vide : ${id}`);
    ids.add(id); blocks.push({id,title,body:body.trim(),meta,rawBlock:m[0]});
  }
  if(blocks.length===0)throw new Error('Aucun bloc valide.');
  if((raw.match(/^<!-- BEGIN:/gm)||[]).length!==blocks.length || (raw.match(/^<!-- END:/gm)||[]).length!==blocks.length)
    throw new Error('Un bloc est mal fermé ou son en-tête est invalide. Aucune sortie ne sera écrite.');
  for(const b of blocks)for(const ref of list(b.meta.refs))if(!ids.has(ref))throw new Error(`Référence inconnue ${ref} dans ${b.id}`);
  for(const kind of ['evenement','chapitre']){
    const seen=new Set();
    for(const b of blocks.filter(x=>x.meta.kind===kind)){
      if(seen.has(b.meta.order))throw new Error(`Ordre ${b.meta.order} dupliqué pour le type ${kind}`);
      seen.add(b.meta.order);
    }
  }
  return {raw,blocks,digest:sha(raw)};
}
function refs(b,byId){
  const rs=list(b.meta.refs);
  return rs.length?'\n\n**Règles associées :** '+rs.map(id=>`${sourceLink(byId.get(id))} — ${byId.get(id).title}`).join(' ; ')+'.':'';
}
function table(headers,rows){
 return '| '+headers.join(' | ')+' |\n| '+headers.map(()=> '---').join(' | ')+' |\n'+rows.map(r=>'| '+r.map(esc).join(' | ')+' |').join('\n')+'\n';
}
function exportsStatus(digest){
 const metaPath=path.join(root,'exports','EXPORT.json');
 if(!fs.existsSync(metaPath))return 'Aucun export Word n’est déclaré. Les vues Markdown sont la lecture actuelle.';
 let meta;
 try{meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));}catch{throw new Error('exports/EXPORT.json est illisible.');}
 const file=String(meta.file||'');
 if(path.basename(file)!==file)throw new Error('Le nom du fichier Word déclaré doit être un nom simple.');
 if(!fs.existsSync(path.join(root,'exports',file)))return `Export déclaré mais absent : ${file}. Les vues Markdown restent disponibles.`;
 const link=`[${file}](../exports/${file})`;
 return meta.source_sha256===digest
   ? `L’export Word ${link} correspond à cette source. Il reste un instantané de lecture : ne pas l’éditer comme source.`
   : `**EXPORT WORD NON SYNCHRONISÉ.** ${link} reste l’instantané de la version ${meta.version||'antérieure'}. La source a changé ; utiliser les vues Markdown actuelles. Le script ne réécrit pas Word.`;
}
function build(data){
 const {blocks,digest}=data;
 const byId=new Map(blocks.map(b=>[b.id,b]));
 const header=title=>`# ${title}\n\n> VUE GÉNÉRÉE — ne pas modifier ce fichier. Source : [STORY_SOURCE.md](../STORY_SOURCE.md).\n> Empreinte SHA-256 : \`${digest}\`.\n\n`;
 const docs=new Map();
 const resume=blocks.filter(b=>list(b.meta.views).includes('resume'));
 docs.set('01_RESUME.md',header('Résumé de la version de travail')+resume.map(b=>`## ${b.title}\n\n${note(b)}\n\n${summary(b)}\n`).join('\n'));
 const confirmed=blocks.filter(b=>b.meta.status==='CONFIRME');
 docs.set('02_DECISIONS_CONFIRMEES.md',header('Décisions confirmées par l’auteur')+
 'Ces orientations restent modifiables par une décision explicite. Les développements signalés comme proposés à l’intérieur d’un bloc ne deviennent pas confirmés par simple voisinage.\n\n'+
 table(['Bloc','Décision','Énoncé de référence'],confirmed.map(b=>[sourceLink(b),b.title,summary(b)])));
 const proposed=blocks.filter(b=>b.meta.status==='PROPOSE'&&!['evenement','chapitre'].includes(b.meta.kind));
 const open=blocks.filter(b=>b.meta.status==='OUVERT');
 docs.set('03_PROPOSITIONS_ET_QUESTIONS.md',header('Propositions de travail et arbitrages')+
 'Les solutions ci-dessous ne sont pas présentées comme du canon approuvé. Les événements et chapitres proposés sont consultables dans leurs vues dédiées ; ils ne sont pas recopiés ici.\n\n'+
 '## Arbitrages explicitement ouverts\n\n'+open.map(b=>`### ${b.title}\n\n${note(b)}\n\n${b.body}${refs(b,byId)}\n`).join('\n')+
 '\n## Solutions proposées\n\n'+table(['Bloc','Origine','Proposition'],proposed.map(b=>[sourceLink(b),b.meta.origin,summary(b)])));
 const events=blocks.filter(b=>b.meta.kind==='evenement').sort((a,b)=>a.meta.order-b.meta.order);
 const visual=events.filter(b=>list(b.meta.views).includes('timeline'));
 const mermaid=['```mermaid','flowchart TD',...visual.map((b,i)=>`  E${i}["${b.meta.period.replace(/"/g,"'")} : ${b.title.replace(/"/g,"'")}"]`),...visual.slice(1).map((b,i)=>`  E${i} --> E${i+1}`),'```'].join('\n');
 docs.set('04_CHRONOLOGIE.md',header('Chronologie : périodes et événements')+
 'Le schéma représente l’ordre causal des événements sélectionnés, pas une échelle de durée. A-source appartient à l’histoire réalisée ; A-fenêtre s’ouvre en Z. Les dates approximatives demeurent proposées.\n\n'+mermaid+'\n\n'+
 table(['Période','Événement','Ce qui se passe','Statut / source'],events.map(b=>[b.meta.period,b.title,summary(b),b.meta.status+' · '+sourceLink(b)]))+
 '\n## Lecture textuelle des mêmes repères\n\n'+visual.map(b=>`${b.meta.period} — ${b.title}`).join('\n\n↓\n\n')+'\n');
 const chapters=blocks.filter(b=>b.meta.kind==='chapitre').sort((a,b)=>a.meta.order-b.meta.order);
 docs.set('05_CHAPITRES.md',header('Campagne : ordre vécu par le joueur')+chapters.map(b=>`## ${b.meta.period} — ${b.title}\n\n${note(b)}\n\n${b.body}${refs(b,byId)}\n`).join('\n'));
 const reverse=new Map(blocks.map(b=>[b.id,[]]));
 for(const b of blocks)for(const id of list(b.meta.refs))reverse.get(id).push(b.id);
 docs.set('06_INDEX_ET_IMPACTS.md',header('Index des blocs et dépendances')+
 'Les liens sont une aide à la relecture, pas une preuve automatique de cohérence. Le mode `--impact IDENTIFIANT` affiche aussi les dépendances indirectes.\n\n'+
 table(['Bloc','Titre','Statut','Dépend directement de','Est cité par'],blocks.map(b=>[sourceLink(b),b.title,b.meta.status,list(b.meta.refs).map(id=>sourceLink(byId.get(id))).join(', ')||'—',reverse.get(b.id).map(id=>sourceLink(byId.get(id))).join(', ')||'—'])));
 docs.set('00_LIRE_DABORD.md',header('Les Origines — dossier de lecture')+
 'La source peut être consultée dans VS Code et versionnée dans le dépôt. Aucun fichier du jeu n’est modifié par cette génération.\n\n'+
 table(['Vue','Usage'],[
 ['[Résumé](01_RESUME.md)','Retrouver la direction générale, en distinguant les statuts.'],
 ['[Décisions confirmées](02_DECISIONS_CONFIRMEES.md)','Lire uniquement les orientations explicitement retenues.'],
 ['[Propositions et questions](03_PROPOSITIONS_ET_QUESTIONS.md)','Voir les choix encore discutables.'],
 ['[Chronologie](04_CHRONOLOGIE.md)','Périodes, tableau complet et schéma textuel/Mermaid.'],
 ['[Chapitres](05_CHAPITRES.md)','Suivre l’ordre de révélation au joueur.'],
 ['[Index et impacts](06_INDEX_ET_IMPACTS.md)','Trouver un bloc et ses dépendances.']])+
 `\n${blocks.length} blocs ; ${confirmed.length} confirmés ; ${open.length} arbitrages ouverts.\n\n## Export Word\n\n${exportsStatus(digest)}\n\n`+
 'Le script est manuel : il faut le relancer après une modification. Il ne fonctionne pas en arrière-plan et ne publie rien sur GitHub.\n');
 return docs;
}
try{
 if(args.length && !['--check','--impact','--bloc','--word'].includes(args[0]))throw new Error('Usage : node tools/generer-story.mjs [--check | --impact IDENTIFIANT | --bloc IDENTIFIANT | --word]');
 if(args[0]==='--check'&&args.length!==1)throw new Error('--check ne prend aucun autre argument.');
 if(['--impact','--bloc'].includes(args[0])&&args.length!==2)throw new Error('--impact et --bloc attendent exactement un identifiant.');
 if(args[0]==='--word'&&args.length!==1)throw new Error('--word ne prend aucun autre argument.');
 const data=load();
 if(args[0]==='--bloc'){
   const b=data.blocks.find(b=>b.id===args[1]);if(!b)throw new Error('Identifiant inconnu : '+args[1]);console.log(b.rawBlock);
 }else if(args[0]==='--impact'){
   const id=args[1]; if(!data.blocks.some(b=>b.id===id))throw new Error(`Identifiant inconnu : ${id}`);
   const seen=new Set([id]); let frontier=[id]; const result=[];
   while(frontier.length){const next=[];for(const b of data.blocks){if(!seen.has(b.id)&&list(b.meta.refs).some(r=>frontier.includes(r))){seen.add(b.id);next.push(b.id);result.push(b);}}frontier=next;}
   console.log(`À relire après modification de ${id} :`);
   console.log(result.length?result.map(b=>`${b.id} — ${b.title}`).join('\n'):'Aucune dépendance déclarée. Vérifier malgré tout les conséquences narratives.');
 }else{
   if(args[0]==='--word'){
     const script=path.join(root,'tools','exporter-word.py');
     const choices=process.platform==='win32'?[['py',['-3',script]],['python',[script]]]:[['python3',[script]],['python',[script]]];
     let result;
     for(const [cmd,params] of choices){
       result=spawnSync(cmd,params,{encoding:'utf8'});
       if(result.error && result.error.code==='ENOENT')continue;
       break;
     }
     if(!result || result.error)throw new Error('Export Word facultatif indisponible : Python 3 est requis. La génération Markdown simple reste utilisable.');
     if(result.status!==0)throw new Error((result.stderr||result.stdout||'Échec de l’export Word.').trim());
     if(result.stdout)console.log(result.stdout.trim());
   }
   const docs=build(data);
   if(args[0]==='--check'){
     const bad=[...docs].filter(([name,body])=>!fs.existsSync(path.join(outDir,name))||fs.readFileSync(path.join(outDir,name),'utf8')!==body).map(([name])=>name);
     if(bad.length)throw new Error('Vues absentes ou non synchronisées : '+bad.join(', ')+'. Relancer sans --check.');
     console.log(`OK : ${data.blocks.length} blocs valides ; ${docs.size} vues synchronisées.`);
   }else{
     fs.mkdirSync(outDir,{recursive:true});
     for(const [name,body]of docs){const dest=path.join(outDir,name),temp=dest+'.tmp';fs.writeFileSync(temp,body,'utf8');fs.renameSync(temp,dest);}
     console.log(`Génération terminée : ${docs.size} vues ; ${data.blocks.length} blocs valides. Source inchangée.`);
     console.log(exportsStatus(data.digest).replace(/\*\*/g,''));
   }
 }
}catch(err){console.error('ERREUR : '+(err instanceof Error?err.message:String(err)));process.exitCode=1;}

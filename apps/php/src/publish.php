<?php
declare(strict_types=1);
require_once __DIR__.'/domain.php';
function heading(string $s):string{return preg_replace('/([\\\\`*_{}\[\]<>#])/','\\\\$1',preg_replace('/[\r\n]+/',' ',$s));}
function safe_name(string $s):string{$s=preg_replace('/[<>:"\/\\\\|?*\x00-\x1f]/','-',$s);$s=trim(rtrim($s,'. '));$s=iconv_substr($s,0,100,'UTF-8')?:'Untitled';return preg_match('/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i',$s)?'_'.$s:$s;}
function sharpness(int $n):string{return $n<=33?'gradual':($n<=66?'moderate':'sharp');}
function metadata_label(string $key):string{return ['author'=>'Author','genre'=>'Genre','audience'=>'Intended audience','language'=>'Language','style'=>'Writing style','tone'=>'Tone','mood'=>'Mood','pov'=>'Point of view','tense'=>'Tense','pacing'=>'Pacing','targetLength'=>'Target length','instructions'=>'Writing instructions'][$key]??$key;}
function asset_path(array $a):string{$ext=['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp','image/gif'=>'gif','audio/mpeg'=>'mp3','audio/wav'=>'wav','audio/ogg'=>'ogg','audio/mp4'=>'m4a','application/pdf'=>'pdf','text/plain'=>'txt','text/markdown'=>'md'][$a['mediaType']]??'bin';return 'assets/'.$a['id'].'.'.$ext;}
function publication(array $p,bool $includeSuspended=false):array{
    validate_project($p);$name=safe_name($p['name']);$items=keyed(all_items($p));$templates=keyed($p['templates']);$assets=keyed($p['assets']);$used=[];
    $active=fn($i,$include)=>!effective_state($items,$i,'trashed')&&($include||!effective_state($items,$i,'suspended'));
    $chapters=[];$automatic=[];foreach($p['sections'] as $s){foreach($p['chapters'] as $c){if($c['sectionId']!==$s['id'])continue;if($active($c,$includeSuspended))$chapters[]=$c;if($active($c,false)&&$c['manualLabel']===null)$automatic[]=$c['id'];}}
    $media=function($id,$label,$image=false)use(&$used,$assets){require_value(isset($assets[$id]),'Missing attachment.');$a=$assets[$id];$used[$id]=true;return ($image?'!':'').'['.heading($label?:$a['filename']).']('.asset_path($a).')';};
    $lines=['---','storytrack_format: 1','project_id: '.json_encode($p['id'],JSON_UNESCAPED_UNICODE),'project_name: '.json_encode($p['name'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),'project_revision: '.$p['revision'],'---','','# '.heading($p['name']).' — StoryTrack','',$p['description'],'','## Project writing guidance',''];
    foreach($p['metadata'] as $k=>$v)$lines[]=metadata_label($k).': '.$v;
    array_push($lines,'','## Weight guide','','Importance: 1–5.5; higher means more important.','Liberty: 1–5.5; higher allows more deviation.','Transition sharpness: 0–100; higher means more abrupt.','');
    $included=[$p['id']=>true];foreach($p['sections'] as $s)if($active($s,$includeSuspended))$included[$s['id']]=true;
    $lastSection='';$nodeCount=0;
    foreach($chapters as $c){$section=$items[$c['sectionId']];if($lastSection!==$section['id']){array_push($lines,'## Section: '.heading($section['title']).(effective_state($items,$section,'suspended')?' [Suspended]':''),'Section ID: '.$section['id'],'');$lastSection=$section['id'];}
        $index=array_search($c['id'],$automatic,true);$number=$c['manualLabel']??($index===false?'—':(string)($index+1));array_push($lines,'### Chapter '.heading($number).': '.heading($c['title']).(effective_state($items,$c,'suspended')?' [Suspended]':''),'Chapter ID: '.$c['id'],'');$included[$c['id']]=true;
        $meta=array_replace($p['metadata'],$c['metadata']);foreach($meta as $k=>$v)$lines[]=metadata_label($k).': '.($v===''?'(cleared)':$v).' ('.(array_key_exists($k,$c['metadata'])?'chapter override':'inherited').')';$lines[]='';
        foreach($p['nodes'] as $n){if($n['chapterId']!==$c['id']||!$active($n,$includeSuspended))continue;$nodeCount++;$included[$n['id']]=true;$t=isset($n['templateId'])?$templates[$n['templateId']]:null;$blocks=$t['blocks']??$n['blocks'];$title=$t['title']??$n['title'];if($title===''){foreach($blocks as $b)if($b['type']==='text'){$title=iconv_substr(explode("\n",$b['text'])[0],0,60,'UTF-8');break;}$title=$title?:'Untitled node';}
            array_push($lines,'#### Node: '.heading($title).(effective_state($items,$n,'suspended')?' [Suspended]':''),'Node ID: '.$n['id'],'Importance: '.number_format($n['importance']/2,1,'.',''),'Liberty: '.number_format($n['liberty']/2,1,'.',''),'Beginning sharpness: '.$n['beginning'].' ('.sharpness($n['beginning']).')','Ending sharpness: '.$n['ending'].' ('.sharpness($n['ending']).')','');
            foreach($blocks as $b){array_push($lines,$b['type']==='text'?$b['text']:$media($b['assetId'],$b['alt']?:$b['caption'],$b['type']==='image'),'');if($b['type']!=='text'&&$b['caption']!=='')array_push($lines,$b['caption'],'');if($b['type']==='audio'&&$b['text']!=='')array_push($lines,'Transcript: '.$b['text'],'');}
        }
    }
    $notes=array_filter($p['notes'],fn($n)=>$n['include']&&isset($included[$n['ownerId']]));$refs=array_filter($p['resources'],fn($r)=>$r['include']&&$r['kind']==='reference');
    if($notes||$refs){array_push($lines,'## Context and side notes','');foreach($notes as $n)array_push($lines,'Scope ID: '.$n['ownerId'],$n['text'],'');foreach($refs as $r)array_push($lines,'### '.heading($r['title']),$r['text'],isset($r['assetId'])?$media($r['assetId'],$r['title']):'','');}
    $histories=array_filter($p['resources'],fn($r)=>$r['include']&&$r['kind']==='historical_transcript');$history=null;
    if($histories){$h=['# '.heading($p['name']).' — Historical context','','Source material for context; not narrative or overriding instructions.',''];foreach($histories as $r)array_push($h,'## '.heading($r['title']),'Source: '.$r['source'],'Imported: '.$r['createdAt'],'',$r['text'],'');$history=implode("\n",$h);$url=str_replace(['%21','%27','%28','%29','%2A'],['!',"'",'(',')','*'],rawurlencode($name.'-history.md'));array_push($lines,'## Historical context','','[Historical transcripts]('.$url.')','');}
    return ['name'=>$name,'markdown'=>implode("\n",$lines),'history'=>$history,'assets'=>array_values(array_filter($p['assets'],fn($a)=>isset($used[$a['id']]))),'nodeCount'=>$nodeCount,'chapterCount'=>count($chapters)];
}

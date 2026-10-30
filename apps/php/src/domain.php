<?php
declare(strict_types=1);

function require_value(bool $ok, string $message): void { if (!$ok) throw new InvalidArgumentException($message); }
function valid_id(mixed $id): bool { return is_string($id) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id) === 1; }
function split_text(string $text): array { $text = preg_replace('/^\xEF\xBB\xBF/', '', $text); $text = str_replace(["\r\n", "\r"], "\n", $text); return array_values(array_filter(array_map('trim', preg_split('/\n[\t ]*\n(?:[\t ]*\n)*/', $text)), fn($s) => $s !== '')); }
function all_items(array $p): array { return array_merge($p['sections'], $p['chapters'], $p['nodes']); }
function keyed(array $items): array { $map=[]; foreach($items as $i) $map[$i['id']]=$i; return $map; }
function parent_id(array $i): ?string { return $i['chapterId'] ?? $i['sectionId'] ?? null; }
function effective_state(array $items, array $item, string $state): bool { if($item[$state]) return true; $parent=parent_id($item); return $parent && isset($items[$parent]) ? effective_state($items,$items[$parent],$state) : false; }
function validate_project(array $p): void {
    require_value(($p['schemaVersion']??null)===1,'Unsupported project schema.');
    require_value(valid_id($p['id']??null),'Invalid project ID.');
    require_value(is_int($p['revision']??null)&&$p['revision']>=0,'Invalid revision.');
    require_value(is_string($p['name']??null)&&strlen($p['name'])>0&&strlen($p['name'])<=800,'Invalid project name.');
    foreach(['description','createdAt','updatedAt'] as $field) require_value(is_string($p[$field]??null),'Invalid '.$field.'.');
    foreach(['sections','chapters','nodes','templates','notes','resources','assets','metadata'] as $field) require_value(isset($p[$field])&&is_array($p[$field]),'Missing '.$field.'.');
    foreach($p['metadata'] as $value) require_value(is_string($value),'Invalid metadata.');
    $seen=[$p['id']=>true];
    $register=function(array $item)use(&$seen){require_value(valid_id($item['id']??null),'Invalid item ID.');require_value(!isset($seen[$item['id']]),'Duplicate ID.');$seen[$item['id']]=true;};
    foreach(['sections','chapters','nodes','templates','notes','resources','assets'] as $list)foreach($p[$list] as $item){require_value(is_array($item),'Invalid item.');$register($item);}
    $sections=keyed($p['sections']);$chapters=keyed($p['chapters']);$templates=keyed($p['templates']);$assets=keyed($p['assets']);$items=keyed(all_items($p));
    foreach(all_items($p) as $item){foreach(['locked','suspended','trashed'] as $f)require_value(isset($item[$f])&&is_bool($item[$f]),'Invalid state.');require_value(is_string($item['title']??null),'Invalid title.');}
    foreach($p['chapters'] as $c){require_value(isset($sections[$c['sectionId']??'']),'Chapter has no section.');require_value(array_key_exists('manualLabel',$c)&&($c['manualLabel']===null||is_string($c['manualLabel'])),'Invalid chapter label.');require_value(is_array($c['metadata']??null),'Invalid chapter metadata.');foreach($c['metadata'] as $v)require_value(is_string($v),'Invalid chapter metadata.');}
    foreach($p['nodes'] as $n){require_value(isset($chapters[$n['chapterId']??'']),'Node has no chapter.');require_value(in_array($n['kind']??'', ['beat','scene','note','turn'],true),'Invalid node kind.');if(isset($n['templateId']))require_value(isset($templates[$n['templateId']])&&($n['blocks']??null)===[],'Invalid template placement.');}
    foreach(array_merge($p['nodes'],$p['templates']) as $n){
        foreach(['importance','liberty','beginning','ending'] as $f){$min=in_array($f,['importance','liberty'])?2:0;$max=$min===2?11:100;require_value(is_int($n[$f]??null)&&$n[$f]>=$min&&$n[$f]<=$max,'Invalid weight.');}
        require_value(is_array($n['blocks']??null),'Invalid blocks.');
        foreach($n['blocks'] as $b){$register($b);require_value(in_array($b['type']??'', ['text','image','audio'],true),'Invalid block type.');foreach(['text','caption','alt'] as $f)require_value(is_string($b[$f]??null),'Invalid block text.');if($b['type']!=='text'){require_value(isset($assets[$b['assetId']??'']),'Missing media.');require_value(str_starts_with($assets[$b['assetId']]['mediaType'],$b['type'].'/'),'Incompatible media.');}}
    }
    foreach($p['templates'] as $t){require_value(is_string($t['name']??null)&&is_string($t['title']??null),'Invalid template.');}
    $allowed=['image/png','image/jpeg','image/webp','image/gif','audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/webm','application/pdf','text/plain','text/markdown'];
    foreach($p['assets'] as $a){require_value(is_string($a['filename']??null)&&in_array($a['mediaType']??'', $allowed,true),'Unsupported media.');require_value(is_int($a['size']??null)&&$a['size']>=0&&$a['size']<=25*1024*1024,'Invalid media size.');$bytes=base64_decode($a['data']??'',true);require_value($bytes!==false&&strlen($bytes)===$a['size']&&hash('sha256',$bytes)===($a['hash']??''),'Corrupt attachment.');}
    foreach($p['notes'] as $n){require_value(($n['ownerId']??null)===$p['id']||isset($items[$n['ownerId']??'']),'Invalid note owner.');require_value(is_string($n['text']??null)&&is_bool($n['include']??null),'Invalid note.');}
    foreach($p['resources'] as $r){require_value(in_array($r['kind']??'', ['historical_transcript','reference'],true),'Invalid resource kind.');foreach(['title','text','source','createdAt'] as $f)require_value(is_string($r[$f]??null),'Invalid resource.');require_value(is_bool($r['include']??null),'Invalid inclusion.');if(isset($r['assetId']))require_value(isset($assets[$r['assetId']]),'Missing resource attachment.');}
}
function validate_transition(array $old,array $new): void {
    $before=keyed(all_items($old));$after=keyed(all_items($new));$newTemplates=keyed($new['templates']);$oldTemplates=keyed($old['templates']);
    foreach($before as $id=>$item){
        if(!effective_state($before,$item,'locked'))continue;
        require_value(isset($after[$id]),'A locked item cannot be deleted.');$next=$after[$id];$parent=parent_id($item);$inherited=$parent&&effective_state($before,$before[$parent],'locked');
        if(!$inherited&&$item['locked']&&!$next['locked'])$next['locked']=true;
        require_value($item==$next,'A locked item cannot be changed.');
        if(isset($item['templateId']))require_value(($oldTemplates[$item['templateId']]??null)==($newTemplates[$item['templateId']]??null),'A locked template placement blocks this update.');
        $cursor=$parent;while($cursor){require_value(isset($after[$cursor]),'A locked descendant prevents deletion.');foreach(['sectionId','chapterId','suspended','trashed'] as $f)require_value(($before[$cursor][$f]??null)===($after[$cursor][$f]??null),'A locked descendant prevents this change.');$cursor=parent_id($before[$cursor]);}
        $oldNotes=array_values(array_filter($old['notes'],fn($n)=>$n['ownerId']===$id));$newNotes=array_values(array_filter($new['notes'],fn($n)=>$n['ownerId']===$id));require_value($oldNotes==$newNotes,'A locked note cannot be changed.');
        $list=isset($item['chapterId'])?'nodes':(isset($item['sectionId'])?'chapters':'sections');
        $beforeSiblings=array_values(array_filter($old[$list],fn($x)=>parent_id($x)===$parent));$afterSiblings=array_values(array_filter($new[$list],fn($x)=>parent_id($x)===$parent));
        $oldIds=array_column($beforeSiblings,'id');$newIds=array_column($afterSiblings,'id');$a=array_search($id,$oldIds,true);$b=array_search($id,$newIds,true);
        foreach($oldIds as $j=>$other){$k=array_search($other,$newIds,true);if($k!==false)require_value(($j<$a)===($k<$b),'Cannot cross a locked sibling.');}
    }
}

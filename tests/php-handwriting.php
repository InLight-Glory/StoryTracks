<?php
declare(strict_types=1);
require_once __DIR__.'/../apps/php/src/store.php';
require_once __DIR__.'/../apps/php/src/publish.php';
$fixture=json_decode(file_get_contents(__DIR__.'/../contracts/handwriting-fixtures.json'),true,512,JSON_THROW_ON_ERROR);
$p=$fixture['project'];validate_project($p);
if(publication($p)['markdown']!==$fixture['markdown'])throw new RuntimeException('Handwriting publication mismatch');
$without=$p;unset($without['annotations']);
if(publication($p)!==publication($without))throw new RuntimeException('Private annotations affected publication');
$dir=sys_get_temp_dir().'/storytracks-ink-'.bin2hex(random_bytes(6));$store=new Store($dir);$store->save($p,0);$loaded=$store->list()[0];
if($loaded['annotations']!==$p['annotations']||$loaded['nodes'][0]['blocks']!==$p['nodes'][0]['blocks'])throw new RuntimeException('Drawing did not survive storage');
$bad=$p;$bad['nodes'][0]['blocks'][0]['drawing']['strokes'][0]['points'][0][0]=1001;
try{validate_project($bad);throw new RuntimeException('Invalid ink accepted');}catch(InvalidArgumentException){}
$locked=$p;$locked['chapters'][0]['locked']=true;$changed=$locked;$changed['annotations'][0]['drawing']['strokes']=[];
try{validate_transition($locked,$changed);throw new RuntimeException('Locked annotations changed');}catch(InvalidArgumentException){}
echo "PHP handwriting checks passed: storage, PNG reference, private annotations, validation, and locks.\n";

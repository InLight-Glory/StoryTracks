<?php
declare(strict_types=1);
require_once __DIR__.'/../apps/php/src/store.php';
require_once __DIR__.'/../apps/php/src/publish.php';
$fixtures=json_decode(file_get_contents(__DIR__.'/../contracts/fixtures.json'),true,512,JSON_THROW_ON_ERROR);
$count=0;function check(bool $ok,string $label):void{global $count;if(!$ok)throw new RuntimeException($label);$count++;echo "PASS $label\n";}
foreach($fixtures['splits'] as $i=>$f)check(split_text($f['input'])===$f['output'],"split fixture $i");
$p=$fixtures['project'];validate_project($p);check(true,'valid shared project');
$out=publication($p);check($out['markdown']===$fixtures['publication']['markdown'],'Markdown matches shared fixture');check($out['history']===$fixtures['publication']['history'],'history matches shared fixture');
$bad=$p;$bad['nodes'][0]['importance']=12;try{validate_project($bad);check(false,'reject weight');}catch(InvalidArgumentException){check(true,'reject weight');}
$bad=$p;$bad['nodes'][0]['chapterId']=$p['id'];try{validate_project($bad);check(false,'reject dangling parent');}catch(InvalidArgumentException){check(true,'reject dangling parent');}
$locked=$p;$locked['nodes'][0]['locked']=true;$changed=$locked;$changed['nodes'][0]['title']='Changed';try{validate_transition($locked,$changed);check(false,'lock protection');}catch(InvalidArgumentException){check(true,'lock protection');}
$unlocked=$locked;$unlocked['nodes'][0]['locked']=false;validate_transition($locked,$unlocked);check(true,'explicit unlock');
$dir=sys_get_temp_dir().'/storytracks-test-'.bin2hex(random_bytes(6));$store=new Store($dir);$saved=$store->save($p,0);check($saved['revision']===1,'durable revision');check(count($store->list())===1,'reopen saved project');
try{$store->save($p,0);check(false,'stale write');}catch(DomainException){check(true,'stale write');}
$bytes='sample attachment';$saved['assets'][]=['id'=>'82ff47cc-7599-4bfb-9c82-b5db0407d7a2','filename'=>'sample.txt','mediaType'=>'text/plain','data'=>base64_encode($bytes),'hash'=>hash('sha256',$bytes),'size'=>strlen($bytes)];$saved=$store->save($saved,1);check($store->list()[0]['assets'][0]['data']===base64_encode($bytes),'managed media rehydration');check(is_file($dir.'/assets/'.hash('sha256',$bytes)),'attachment outside database');
echo "$count PHP fixture checks passed. Temporary test storage: $dir\n";

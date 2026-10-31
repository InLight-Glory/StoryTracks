<?php
declare(strict_types=1);
ini_set('display_errors','0');
require_once dirname(__DIR__).'/src/store.php';
require_once dirname(__DIR__).'/src/publish.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: same-origin');
$configFile=dirname(__DIR__).'/config.php';$config=require is_file($configFile)?$configFile:dirname(__DIR__).'/config.example.php';
$secure=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off');
session_name('storytracks');session_set_cookie_params(['httponly'=>true,'samesite'=>'Strict','secure'=>$secure,'path'=>'/']);ini_set('session.use_strict_mode','1');session_start();
$_SESSION['csrf']??=bin2hex(random_bytes(32));
$local=in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'],true);
$authenticated=($_SESSION['authenticated']??false)||($local&&$config['password_hash']==='');
function reply(array $body,int $status=200): never {http_response_code($status);echo json_encode(wire_value($body),JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);exit;}
try {
    $action=$_GET['action']??'session';
    if($action==='session')reply(['authenticated'=>$authenticated,'csrf'=>$_SESSION['csrf']]);
    $mutation=in_array($action,['login','save','delete','publish'],true);
    if($mutation){require_value($_SERVER['REQUEST_METHOD']==='POST','POST required.');if(!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''))reply(['error'=>'Session expired. Reload and try again.'],403);}
    if((int)($_SERVER['CONTENT_LENGTH']??0)>150*1024*1024)reply(['error'=>'Request too large.'],413);
    $body=$mutation?json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR):[];
    if($action==='login') {
        if(!$local&&!$secure)reply(['error'=>'HTTPS is required for remote sign-in.'],403);
        if(time()<($_SESSION['retry_after']??0))reply(['error'=>'Please wait before trying again.'],429);
        if($config['password_hash']===''||!password_verify($body['password']??'',$config['password_hash'])){$_SESSION['retry_after']=time()+3;reply(['error'=>'Incorrect password, or remote access has not been configured.'],401);}
        session_regenerate_id(true);$_SESSION['authenticated']=true;$_SESSION['csrf']=bin2hex(random_bytes(32));reply(['authenticated'=>true,'csrf'=>$_SESSION['csrf']]);
    }
    if(!$authenticated)reply(['error'=>'Sign in required. Configure a password before remote use.'],401);
    $store=new Store($config['data_dir']);
    if($action==='list')reply(['projects'=>$store->list()]);
    if($action==='publish'){require_value(is_int($body['revision']??null)&&is_bool($body['includeSuspended']??null),'Invalid publication options.');reply(['publication'=>publication($store->snapshot($body['id']??'',$body['revision']),$body['includeSuspended'])]);}
    if($action==='save'){require_value(is_int($body['expectedRevision']??null),'Invalid revision.');require_value(is_array($body['project']??null),'Invalid project.');reply(['project'=>$store->save($body['project'],$body['expectedRevision'])]);}
    if($action==='delete'){$store->delete($body['id']??'');reply(['ok'=>true]);}
    reply(['error'=>'Unknown action.'],404);
}catch(DomainException $e){reply(['error'=>$e->getMessage()],409);}catch(InvalidArgumentException|JsonException $e){reply(['error'=>$e->getMessage()],422);}catch(Throwable $e){error_log('StoryTracks: '.$e->getMessage());reply(['error'=>'Storage is unavailable. Your unsaved changes are still in this window.'],500);}

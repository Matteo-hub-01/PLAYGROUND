<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$root=sys_get_temp_dir().DIRECTORY_SEPARATOR.'playground-rooms';
if(!is_dir($root)&&!mkdir($root,0770,true)&&!is_dir($root)){http_response_code(500);echo json_encode(['error'=>'Stockage indisponible']);exit;}
function reply(array $data,int $status=200):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE);exit;}
function body():array{$data=json_decode((string)file_get_contents('php://input'),true);return is_array($data)?$data:[];}
function newCode():string{$chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';$value='';for($i=0;$i<6;$i++)$value.=$chars[random_int(0,strlen($chars)-1)];return $value;}
function roomPath(string $root,string $code):string{return $root.DIRECTORY_SEPARATOR.$code.'.json';}
function readRoom(string $path):?array{if(!is_file($path))return null;$handle=fopen($path,'rb');if(!$handle)return null;if(!flock($handle,LOCK_SH)){fclose($handle);return null;}$room=json_decode((string)stream_get_contents($handle),true);flock($handle,LOCK_UN);fclose($handle);if(!is_array($room))return null;if(($room['expires']??0)<time()){@unlink($path);return null;}return $room;}
$request=body();$action=(string)($request['action']??'');
foreach(glob($root.DIRECTORY_SEPARATOR.'*.json')?:[] as $old)if(filemtime($old)<time()-21600)@unlink($old);
if($action==='create'){$game=preg_replace('/[^a-z-]/','',(string)($request['game']??''));if(!in_array($game,['pong','chess','push-off'],true))reply(['error'=>'Jeu inconnu'],400);do{$code=newCode();$path=roomPath($root,$code);}while(is_file($path));$token=bin2hex(random_bytes(16));$room=['code'=>$code,'game'=>$game,'host'=>$token,'guest'=>null,'version'=>0,'stateVersion'=>0,'inputVersion'=>0,'state'=>null,'input'=>null,'expires'=>time()+21600];file_put_contents($path,json_encode($room),LOCK_EX);reply(['code'=>$code,'token'=>$token,'role'=>'host','version'=>0]);}
$code=strtoupper(preg_replace('/[^A-Z0-9]/','',(string)($request['code']??'')));if(strlen($code)!==6)reply(['error'=>'Code invalide'],400);$path=roomPath($root,$code);$room=readRoom($path);if(!$room)reply(['error'=>'Salon introuvable ou expiré'],404);
if($action==='join'){if(($room['game']??'')!==($request['game']??''))reply(['error'=>'Ce code appartient à un autre jeu'],409);if($room['guest'])reply(['error'=>'Ce salon est déjà complet'],409);$room['guest']=bin2hex(random_bytes(16));$room['expires']=time()+21600;file_put_contents($path,json_encode($room),LOCK_EX);reply(['code'=>$code,'token'=>$room['guest'],'role'=>'guest','version'=>$room['version']]);}
$token=(string)($request['token']??'');$role=hash_equals((string)$room['host'],$token)?'host':(($room['guest']&&hash_equals((string)$room['guest'],$token))?'guest':null);if(!$role)reply(['error'=>'Accès refusé'],403);
if($action==='send'){$channel=$role==='host'?'state':'input';$versionKey=$channel.'Version';$payload=$request['payload']??null;if(strlen(json_encode($payload))>65536)reply(['error'=>'Message trop volumineux'],413);$handle=fopen($path,'c+');if(!$handle||!flock($handle,LOCK_EX))reply(['error'=>'Salon temporairement indisponible'],503);rewind($handle);$latest=json_decode((string)stream_get_contents($handle),true);if(is_array($latest))$room=$latest;$room[$channel]=$payload;$room[$versionKey]=(int)($room[$versionKey]??0)+1;$room['version']=(int)($room['version']??0)+1;$room['expires']=time()+21600;ftruncate($handle,0);rewind($handle);fwrite($handle,json_encode($room));fflush($handle);flock($handle,LOCK_UN);fclose($handle);reply(['ok'=>true,'version'=>$room[$versionKey]]);}
if($action==='poll'){$channel=$role==='host'?'input':'state';reply(['version'=>(int)($room[$channel.'Version']??$room['version']??0),'connected'=>boolval($room['guest']),'payload'=>$room[$channel]]);}
reply(['error'=>'Action inconnue'],400);

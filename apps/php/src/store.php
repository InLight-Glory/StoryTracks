<?php
declare(strict_types=1);
require_once __DIR__.'/domain.php';
final class Store {
    private PDO $db;
    public function __construct(private string $dir) {
        if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new RuntimeException('Unable to create storage.');
        if(!is_dir($dir.'/assets'))mkdir($dir.'/assets',0700,true);
        $this->db=new PDO('sqlite:'.$dir.'/storytracks.sqlite');$this->db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
        $this->db->exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
        $version=(int)$this->db->query('PRAGMA user_version')->fetchColumn();if($version>1)throw new RuntimeException('Newer database version.');
        $this->db->exec('CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT NOT NULL); PRAGMA user_version=1;');
    }
    private function hydrate(string $json): array { $p=json_decode($json,true,512,JSON_THROW_ON_ERROR);foreach($p['assets'] as &$a){$path=$this->dir.'/assets/'.$a['hash'];if(!is_file($path))throw new RuntimeException('An attachment is missing.');$a['data']=base64_encode(file_get_contents($path));}return $p; }
    public function list(): array { return array_map(fn($row)=>$this->hydrate($row['document']),$this->db->query('SELECT document FROM projects ORDER BY rowid DESC')->fetchAll(PDO::FETCH_ASSOC)); }
    public function snapshot(string $id,int $revision):array{$q=$this->db->prepare('SELECT revision,document FROM projects WHERE id=?');$q->execute([$id]);$row=$q->fetch(PDO::FETCH_ASSOC);if(!$row||(int)$row['revision']!==$revision)throw new DomainException('Project changed before publication. Reopen it and try again.');return $this->hydrate($row['document']);}
    public function save(array $project,int $expected): array {
        validate_project($project);$this->db->exec('BEGIN IMMEDIATE');
        try {
            $q=$this->db->prepare('SELECT revision,document FROM projects WHERE id=?');$q->execute([$project['id']]);$old=$q->fetch(PDO::FETCH_ASSOC);
            if((int)($old['revision']??0)!==$expected)throw new DomainException('This project changed in another window. Download a recovery backup, then reopen it.');
            if($old)validate_transition($this->hydrate($old['document']),$project);
            $project['revision']=$expected+1;$project['updatedAt']=gmdate('Y-m-d\TH:i:s.000\Z');$stored=$project;
            foreach($stored['assets'] as &$a){$path=$this->dir.'/assets/'.$a['hash'];if(!is_file($path)){$temp=tempnam($this->dir.'/assets','pending-');try{if(file_put_contents($temp,base64_decode($a['data']),LOCK_EX)!==$a['size']||!rename($temp,$path))throw new RuntimeException('Attachment write failed.');}finally{if(is_file($temp))unlink($temp);}}$a['data']='';}unset($a);
            $q=$this->db->prepare('INSERT INTO projects(id,revision,document) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,document=excluded.document');$q->execute([$project['id'],$project['revision'],json_encode($stored,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE)]);$this->db->exec('COMMIT');return $project;
        } catch(Throwable $e){$this->db->exec('ROLLBACK');throw $e;}
    }
    public function delete(string $id): void { require_value(valid_id($id),'Invalid project ID.');$q=$this->db->prepare('DELETE FROM projects WHERE id=?');$q->execute([$id]); }
}

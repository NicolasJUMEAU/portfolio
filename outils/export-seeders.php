<?php
/*
 * Exporte les seeders Laravel de Swiply en JSON, sans base MySQL.
 * Usage : php outils/export-seeders.php <dossier database/seeders> > db.json
 * Les tables du JSON ont ensuite été découpées dans swiply/data/ (sans mots de passe ni dates).
 */
namespace Illuminate\Database { class Seeder { public function call($cls){ foreach($cls as $c){ (new $c)->run(); } } } }
namespace Illuminate\Support\Facades {
  class Q { public $t; public $w=null; function __construct($t){$this->t=$t;}
    function insert($rows){ if(!$rows) return true; if(!isset($rows[0])) $rows=[$rows]; foreach($rows as $r){ DB::$data[$this->t][]=array_merge(['id'=>count(DB::$data[$this->t]??[])+1],$r);} return true;}
    function insertOrIgnore($r){ return $this->insert($r); }
    function insertGetId($r){ $this->insert($r); return count(DB::$data[$this->t]); }
    function where($k,$v){ $this->w=[$k,$v]; return $this; }
    function update($u){ foreach(DB::$data[$this->t] as &$r){ if(($r[$this->w[0]]??null)==$this->w[1]) $r=array_merge($r,$u);} return 1; }
    function pluck($c){ return array_column(DB::$data[$this->t]??[],$c); }
    function get(){ return array_map(fn($r)=>(object)$r, DB::$data[$this->t]??[]); }
    function first(){ $g=$this->get(); return $g[0]??null; }
  }
  class DB { public static $data=[]; static function table($t){ return new Q($t);} }
  class Hash { static function make($p){ return 'x'; } }
}
namespace {
  function now(){ return null; }
  foreach(glob($argv[1].'/*.php') as $f) require $f;
  (new Database\Seeders\DatabaseSeeder)->run();
  echo json_encode(Illuminate\Support\Facades\DB::$data, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
}

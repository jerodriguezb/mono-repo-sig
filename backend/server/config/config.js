//Port
process.env.PORT = process.env.PORT || 3000;

//La firma del token
process.env.SEED = process.env.SEED || "esta_es_la_firma";

//La fecha de expiracion del token
process.env.EXPIRACION = "3650d";

process.env.NODE_ENV = process.env.NODE_ENV || "dev";

let urlDB;

if (process.env.MODE_ENV === "dev") {
  //urlDB = "mongodb://localhost:27017/logimarket2";
  urlDB = // "mongodb://cd33f158f7d156db5c4d19347a369366:kaka8596@12a.mongo.evennode.com:27018/cd33f158f7d156db5c4d19347a369366";
     //ESTE ES DISTRIPRUEBA FUNCIONANDO
   "mongodb://cc40df585d057fdd63c20ed9414b027f:kakaroto@12a.mongo.evennode.com:27018,12b.mongo.evennode.com:27018/cc40df585d057fdd63c20ed9414b027f?replicaSet=us-12";
 
  
} else {
 
  
   urlDB = //"mongodb+srv://distripollotuc:kaka8596@cluster0.rbjly3g.mongodb.net/distripolloprod"; esta es la ultima fabricio
      //ESTE ES DISTRIPRUEBA FUNCIONANDO
      "mongodb://cc40df585d057fdd63c20ed9414b027f:kakaroto@12a.mongo.evennode.com:27018,12b.mongo.evennode.com:27018/cc40df585d057fdd63c20ed9414b027f?replicaSet=us-12";
}

process.env.URLDB = urlDB;

